"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, ROOT } = require("./harness");

const BC = loadCore(createSandbox());
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ---------------------------------------------------------------------------
// A geometry evaluator, because "it's an SVG string" proves nothing about what
// gets painted. A typo'd path renders silently: empty, off-centre, or spilling
// past the viewBox where it clips. This walks the actual drawing commands and
// reports the painted bounds, so those three defects are test failures rather
// than something a human has to notice in a 16px glyph.
// ---------------------------------------------------------------------------

// Arc → centre parameterisation (SVG implementation notes F.6.5), then sampled.
// Arcs are most of the curvature in this set; bounding them by their endpoints
// would pass a semicircle that bulges well outside the grid.
function arcPoints(x1, y1, rx, ry, phi, largeArc, sweep, x2, y2) {
  if (rx === 0 || ry === 0) return [[x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const rad = (phi * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
  const x1p = cos * dx2 + sin * dy2;
  const y1p = -sin * dx2 + cos * dy2;
  // Scale up radii that cannot span the chord, exactly as a renderer does.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }
  const sign = largeArc === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const d = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    const a = Math.acos(Math.min(1, Math.max(-1, d)));
    return ux * vy - uy * vx < 0 ? -a : a;
  };
  const theta = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = theta + (delta * i) / 24;
    const ex = cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin;
    const ey = cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos;
    pts.push([ex, ey]);
  }
  return pts;
}

// Cubic and quadratic beziers are sampled too rather than hulled: a control
// point outside the grid is fine as long as the curve itself stays inside.
function bezier(p0, ps, steps = 16) {
  const pts = [];
  const n = ps.length;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let cur = [p0].concat(ps);
    while (cur.length > 1) {
      const next = [];
      for (let j = 0; j < cur.length - 1; j++) {
        next.push([cur[j][0] + (cur[j + 1][0] - cur[j][0]) * t,
                   cur[j][1] + (cur[j + 1][1] - cur[j][1]) * t]);
      }
      cur = next;
    }
    pts.push(cur[0]);
  }
  return pts;
}

function pathPoints(d) {
  const toks = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const pts = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0;
  const num = () => parseFloat(toks[i++]);
  const push = (px, py) => { pts.push([px, py]); };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "Z") { x = sx; y = sy; push(x, y); continue; }
    if (C === "M") {
      const nx = num(), ny = num();
      x = rel ? x + nx : nx; y = rel ? y + ny : ny;
      sx = x; sy = y; push(x, y);
      cmd = rel ? "l" : "L";                   // subsequent pairs are implicit lineto
    } else if (C === "L") {
      const nx = num(), ny = num();
      x = rel ? x + nx : nx; y = rel ? y + ny : ny; push(x, y);
    } else if (C === "H") { const nx = num(); x = rel ? x + nx : nx; push(x, y); }
    else if (C === "V") { const ny = num(); y = rel ? y + ny : ny; push(x, y); }
    else if (C === "C" || C === "S" || C === "Q" || C === "T") {
      const count = C === "C" ? 3 : C === "S" || C === "Q" ? 2 : 1;
      const ctrl = [];
      for (let k = 0; k < count; k++) {
        const nx = num(), ny = num();
        ctrl.push([rel ? x + nx : nx, rel ? y + ny : ny]);
      }
      for (const p of bezier([x, y], ctrl)) push(p[0], p[1]);
      x = ctrl[ctrl.length - 1][0]; y = ctrl[ctrl.length - 1][1];
    } else if (C === "A") {
      const rx = num(), ry = num(), rot = num(), laf = num(), sf = num();
      const nx = num(), ny = num();
      const ex = rel ? x + nx : nx, ey = rel ? y + ny : ny;
      for (const p of arcPoints(x, y, rx, ry, rot, laf, sf, ex, ey)) push(p[0], p[1]);
      x = ex; y = ey;
    } else { i++; }                            // unknown token: skip rather than spin
  }
  return pts;
}

// Painted bounds of a whole icon body: every <path>, <circle> and <rect>.
function bodyBounds(body) {
  const pts = [];
  for (const m of body.matchAll(/\sd="([^"]+)"/g)) pts.push(...pathPoints(m[1]));
  for (const m of body.matchAll(/<circle([^>]*)\/>/g)) {
    const at = (n) => { const r = m[1].match(new RegExp(n + '="([^"]+)"')); return r ? parseFloat(r[1]) : null; };
    const cx = at("cx"), cy = at("cy"), r = at("r");
    if (cx == null || cy == null || r == null) continue;
    pts.push([cx - r, cy - r], [cx + r, cy + r]);
  }
  for (const m of body.matchAll(/<rect([^>]*)\/>/g)) {
    const at = (n) => { const r = m[1].match(new RegExp(n + '="([^"]+)"')); return r ? parseFloat(r[1]) : null; };
    const rx = at("x"), ry = at("y"), w = at("width"), h = at("height");
    if (rx == null || ry == null || w == null || h == null) continue;
    pts.push([rx, ry], [rx + w, ry + h]);
  }
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY,
           cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

// Half the stroke hangs outside the path itself, so the ink extends 0.75 beyond
// the geometry. 16 minus that on both sides is what can actually be drawn.
const STROKE = 1.5;
const INK = STROKE / 2;

module.exports = {
  "the icon set is not empty and every name resolves"() {
    const names = BC.icons.names();
    assert.ok(names.length >= 40, `only ${names.length} icons`);
    for (const n of names) {
      assert.ok(BC.icons.has(n), `has(${n}) is false`);
      assert.ok(BC.icons.svg(n).length > 0, `${n} renders empty`);
    }
  },

  "an unknown icon renders nothing instead of throwing"() {
    // Call sites interpolate into template strings, where a throw would take out
    // the whole widget for one missing glyph.
    assert.equal(BC.icons.svg("no-such-icon"), "");
  },

  "every icon paints inside its viewBox"() {
    const bad = [];
    for (const name of BC.icons.names()) {
      const b = bodyBounds(BC.icons.paths[name]);
      if (!b) { bad.push(`${name}: paints nothing`); continue; }
      if (b.minX - INK < -0.01 || b.minY - INK < -0.01 || b.maxX + INK > 16.01 || b.maxY + INK > 16.01) {
        bad.push(`${name}: ink spans x ${(b.minX - INK).toFixed(2)}..${(b.maxX + INK).toFixed(2)}, ` +
                 `y ${(b.minY - INK).toFixed(2)}..${(b.maxY + INK).toFixed(2)}`);
      }
    }
    assert.deepEqual(bad, [], "icons clip at the viewBox edge: " + bad.join("; "));
  },

  "every icon is optically centred on the grid"() {
    // An icon whose mass sits off-centre reads as misaligned next to its
    // neighbours in a row, which is exactly how a hand-typed glyph set looks.
    const bad = [];
    for (const name of BC.icons.names()) {
      const b = bodyBounds(BC.icons.paths[name]);
      if (!b) continue;
      if (Math.abs(b.cx - 8) > 0.75 || Math.abs(b.cy - 8) > 0.75) {
        bad.push(`${name}: centre (${b.cx.toFixed(2)}, ${b.cy.toFixed(2)})`);
      }
    }
    assert.deepEqual(bad, [], "off-centre icons: " + bad.join("; "));
  },

  "every icon fills enough of the grid to read at 16px"() {
    // A glyph drawn at half scale looks broken beside one drawn full width. The
    // bar is the long axis, not the area: a chevron is legitimately 4 wide and a
    // pause is two thin bars, while both stand a full 8 tall. 7 (44% of the
    // grid) is below every deliberate shape here and above a scale mistake.
    const bad = [];
    for (const name of BC.icons.names()) {
      const b = bodyBounds(BC.icons.paths[name]);
      if (!b) continue;
      if (Math.max(b.w, b.h) < 7) bad.push(`${name}: ${b.w.toFixed(1)}x${b.h.toFixed(1)}`);
    }
    assert.deepEqual(bad, [], "undersized icons: " + bad.join("; "));
  },

  "the whole set shares one grid and one stroke weight"() {
    for (const name of BC.icons.names()) {
      const s = BC.icons.svg(name);
      assert.match(s, /viewBox="0 0 16 16"/, `${name} is off-grid`);
      assert.match(s, /stroke-width="1\.5"/, `${name} disagrees on weight`);
      assert.match(s, /stroke="currentColor"/, `${name} must inherit colour`);
      assert.match(s, /stroke-linecap="round"/, `${name} must use round caps`);
    }
  },

  "a solid fill is always declared explicitly"() {
    // fill defaults to none on the <svg>; a shape meaning "filled" has to say so,
    // and one meaning "outline" must never inherit a fill by accident.
    for (const name of BC.icons.names()) {
      const body = BC.icons.paths[name];
      for (const m of body.matchAll(/fill="currentColor"/g)) {
        const at = m.index;
        const tagStart = body.lastIndexOf("<", at);
        const tag = body.slice(tagStart, body.indexOf(">", at) + 1);
        // Strokes on a filled shape double its apparent weight, except where the
        // outline is the point (a filled star still wants its stroked rim).
        assert.ok(/stroke="none"/.test(tag) || name === "star-filled",
          `${name}: a filled shape must also set stroke="none"`);
      }
    }
  },

  "icons are decorative unless given a title"() {
    assert.match(BC.icons.svg("check"), /aria-hidden="true"/);
    assert.noMatch(BC.icons.svg("check"), /aria-label/);
    const titled = BC.icons.svg("check", { title: "Done" });
    assert.match(titled, /role="img"/);
    assert.match(titled, /aria-label="Done"/);
    assert.noMatch(titled, /aria-hidden/);
  },

  "an icon title is escaped"() {
    // Titles reach innerHTML, and a course name can carry anything.
    const s = BC.icons.svg("check", { title: '"><script>x</script>' });
    assert.noMatch(s, /<script>/);
  },

  "the size is a render option, not baked into the geometry"() {
    const s = BC.icons.svg("check", { size: 24 });
    assert.match(s, /width="24" height="24"/);
    assert.match(s, /viewBox="0 0 16 16"/, "the grid must not change with the size");
  },

  "the UI draws its icons instead of typing them"() {
    // The regression this whole set exists to prevent, checked across every
    // source file rather than the three that happened to be worst. Each of
    // these rendered in colour, at the wrong weight, or as an empty box,
    // depending on the font Canvas happened to serve that day.
    //
    // Typographic punctuation is deliberately allowed: an em dash, a middot, an
    // ellipsis and a multiplication sign are text, not iconography.
    const ALLOWED = new Set([..."\u2014\u00b7\u2026\u2013\u2019\u201c\u201d\u00d7\u00b0" +
                             "\u2318\u21e7\u2325\u21a9\u2192\u00e9\u00a0\u2116"]);
    const offenders = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) { walk(abs); continue; }
        if (!/\.(js|css|html)$/.test(e.name)) continue;
        const rel = path.relative(ROOT, abs).split(path.sep).join("/");
        // tokens.js carries a Latin-range regex for validating a font name.
        if (rel === "src/shared/tokens.js") continue;
        for (const [i, line] of fs.readFileSync(abs, "utf8").split("\n").entries()) {
          // Comments describe the glyphs they replaced, which is worth keeping.
          if (/^\s*(\/\/|\*|\/\*|<!--)/.test(line)) continue;
          for (const ch of line) {
            if (ch.codePointAt(0) < 128 || ALLOWED.has(ch)) continue;
            offenders.push(`${rel}:${i + 1} ${JSON.stringify(ch)}`);
            break;
          }
        }
      }
    };
    walk(path.join(ROOT, "src"));
    assert.deepEqual(offenders, [],
      "glyphs that should come from BC.icons:\n  " + offenders.join("\n  "));
  },

  "a glyph cannot hide behind a unicode escape"() {
    // "\u2212" is pure ASCII in the source and a MINUS SIGN on screen, so the
    // character scan above walked straight past the preview's zoom-out button.
    const offenders = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) { walk(abs); continue; }
        if (!e.name.endsWith(".js")) continue;
        const rel = path.relative(ROOT, abs).split(path.sep).join("/");
        for (const [i, line] of fs.readFileSync(abs, "utf8").split("\n").entries()) {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
          for (const m of line.matchAll(/\\u\{?([0-9a-fA-F]{4,6})\}?/g)) {
            const cp = parseInt(m[1], 16);
            // Symbols, dingbats, arrows, geometric shapes and emoji — the
            // ranges an icon would be drawn from. Letters and accents are fine.
            const iconish = (cp >= 0x2000 && cp <= 0x2bff) || cp >= 0x1f000;
            // Typographic punctuation stays: dashes, quotes, ellipsis, nbsp.
            const punctuation = [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2018, 0x2019,
                                 0x201c, 0x201d, 0x2022, 0x2026, 0x00a0, 0x2192].includes(cp);
            if (iconish && !punctuation) offenders.push(`${rel}:${i + 1} \\u${m[1]}`);
          }
        }
      }
    };
    walk(path.join(ROOT, "src"));
    assert.deepEqual(offenders, [],
      "escaped glyphs that should come from BC.icons: " + offenders.join(", "));
  },

  "every icon in the set is actually used"() {
    // An icon nobody references is one nobody maintains, and the next reader
    // cannot tell whether it is load-bearing.
    const sources = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs);
        else if (/\.(js|html)$/.test(e.name) && !abs.endsWith("icons.js")) {
          sources.push(fs.readFileSync(abs, "utf8"));
        }
      }
    };
    walk(path.join(ROOT, "src"));
    const all = sources.join("\n");
    // A bare quoted name is not enough evidence: `inp.type = "file"`, a route
    // called "inbox" and a groupBy value of "tag" all matched icons that
    // nothing actually drew. So only lines that reach the icon set count —
    // plus the two lookup tables that hold nothing but icon names.
    const CONTEXT = /BC\.icons|\bicon\b|\bic\(|dbtn\(|iconBtn\(|step\(|data-icon/;
    const tables = [];
    for (const src of sources) {
      for (const marker of ["const TAB_ICON = {", "const VIEWS = ["]) {
        let i = src.indexOf(marker);
        while (i !== -1) {
          tables.push(src.slice(i, src.indexOf(marker.endsWith("{") ? "};" : "];", i) + 2));
          i = src.indexOf(marker, i + 1);
        }
      }
      // A function that exists to name icons (iconNameFor, iconFor) returns them
      // bare, one per line, with nothing on the line to mark them as icons.
      for (const m of src.matchAll(/function\s+\w*[iI]con\w*\s*\([^)]*\)\s*\{/g)) {
        tables.push(src.slice(m.index, src.indexOf("\n  }", m.index)));
      }
    }
    const evidence = sources.join("\n").split("\n").filter((l) => CONTEXT.test(l))
      .concat(tables).join("\n");
    const unused = BC.icons.names().filter((n) => !evidence.includes(`"${n}"`));
    assert.deepEqual(unused, [], "icons defined but never used: " + unused.join(", "));
  },

  "the settings tab rail and the features share one icon source"() {
    // Two copies of a set drift: the drawer got drawn icons and the widget kept
    // its glyphs, which is the state this replaced.
    const idx = read("src/shared/settings/index.js");
    assert.noMatch(idx, /const TAB_ICONS = \{/, "tab icons must come from BC.icons");
    assert.match(idx, /BC\.icons/, "the settings UI must use the shared set");
    assert.match(read("src/content/features/todo.js"), /BC\.icons/,
      "the planner must use the shared set");
  },

  "icons.js is registered everywhere the settings UI runs"() {
    // The drawer, the options page and the popup all render the same controls.
    // A missing script tag means every icon silently renders as nothing.
    for (const m of ["manifest.json", "manifest.firefox.json"]) {
      const js = JSON.parse(read(m)).content_scripts[0].js;
      assert.ok(js.includes("src/shared/icons.js"), `${m} does not load icons.js`);
      assert.ok(js.indexOf("src/shared/icons.js") < js.indexOf("src/shared/settings/index.js"),
        `${m} loads icons.js after the settings UI that uses it`);
    }
    assert.match(read("src/options/options.html"), /shared\/icons\.js/);
    assert.match(read("src/popup/popup.html"), /shared\/icons\.js/);
  },
};
