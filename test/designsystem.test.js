"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, ROOT } = require("./harness");

const BC = loadCore(createSandbox());
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Files that legitimately contain literal colours: they DEFINE the palette, or
// they compute against fixed endpoints.
const PALETTE_SOURCES = new Set([
  "src/shared/tokens.js",       // the token values themselves
  "src/shared/themes.js",       // tone and preset definitions
  "src/shared/skins.js",        // gradient endpoints and colour fallbacks
  "src/shared/skin-catalog.js", // the skin palettes themselves
  "src/content/core/color.js",  // contrast maths against black/white endpoints
  "src/shared/defaults.js",     // default cosmetic background colours
  "src/content/core/toast.js",  // documented exception, see below
  "src/background/service-worker.js", // chrome.action badge colour, not CSS
]);

// Blank out comments while keeping the line structure, so a scan can still
// report a line number. Checking only whether a line STARTS with * or /* misses
// every continuation line of a block comment, and prose describing CSS ("...
// border-radius:50% was applied to...") then reads as a declaration.
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      // Keep the newlines so line numbers survive.
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
    } else if (src[i] === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      const stop = nl === -1 ? src.length : nl;
      out += " ".repeat(stop - i);
      i = stop;
    } else {
      out += src[i];
      i++;
    }
  }
  return out;
}

function jsFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

// Real CSS properties that take a colour. Matching on the property name (rather
// than on anything shaped like "key: #hex") is what keeps JS object literals --
// an <input type="color"> default, a chrome.action badge colour -- out of the
// results.
const COLOR_PROPS = [
  "color", "background", "background-color", "background-image", "border",
  "border-color", "border-top", "border-right", "border-bottom", "border-left",
  "border-top-color", "border-bottom-color", "border-left-color", "border-right-color",
  "outline", "outline-color", "box-shadow", "text-shadow", "fill", "stroke",
  "caret-color", "accent-color", "column-rule", "text-decoration-color",
];
const DECL = new RegExp("(?:^|[;{]|\\s)(" + COLOR_PROPS.join("|") + ")\\s*:");

// A literal colour inside a CSS declaration, ignoring var() fallbacks and comments.
function cssColorLiterals(src) {
  const out = [];
  for (const [i, line] of stripComments(src).split("\n").entries()) {
    const code = line;
    if (!DECL.test(code)) continue;
    for (const m of code.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const before = code.slice(0, m.index);
      if (/var\(--[\w-]+,\s*[^)]*$/.test(before)) continue;   // documented fallback
      out.push({ line: i + 1, color: m[0], text: code.trim().slice(0, 120) });
    }
  }
  return out;
}

module.exports = {
  "no feature stylesheet hardcodes a colour outside the token system"() {
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      if (PALETTE_SOURCES.has(rel)) continue;
      const found = cssColorLiterals(fs.readFileSync(abs, "utf8"));
      // theming.js's high-contrast focus ring is a deliberate fixed yellow.
      const violations = found.filter((f) => !(rel.endsWith("theming.js") && f.color === "#ffeb3b"));
      assert.equal(violations.length, 0,
        `${rel} hardcodes ${violations.map((v) => v.color + " @" + v.line).join(", ")}; use a --bc-* token so it re-tints per mode`);
    }
  },

  "the toast palette exception is still accurate"() {
    // toast.js keeps fixed dark chips on purpose: a surface-coloured toast
    // disappears against the page in dark mode. The claim is that each chip
    // clears AA against white text, so verify that rather than trusting it.
    const chips = { info: "#1f2937", success: "#0f5132", warn: "#8a5a00", error: "#7f1d1d" };
    const src = read("src/content/core/toast.js");
    for (const [level, hex] of Object.entries(chips)) {
      assert.ok(src.includes(".bc-toast." + level) && src.includes(hex),
        `toast.${level} is no longer ${hex}; re-check its contrast`);
      const ratio = BC.color.contrastRatio("#ffffff", hex);
      assert.ok(ratio >= 4.5, `white on the ${level} toast is ${ratio.toFixed(2)}:1`);
    }
  },

  "the settings switch adapts to the theme in both states"() {
    const src = read("src/shared/settings/index.js");
    assert.match(src, /\.bc-switch \{[^}]*background: var\(/, "the off state must use a token");
    assert.match(src, /\.bc-switch-thumb \{[^}]*background: var\(/, "the thumb must use a token");
  },

  "text on the accent uses the derived contrast colour"() {
    // The accent is user-chosen, so white is not always legible on it.
    const src = read("src/shared/settings/index.js");
    assert.match(src, /\.bc-logo \{[\s\S]*?color: var\(--bc-accent-contrast/);
  },

  "every --bc-* variable a stylesheet reads is one the token layer emits"() {
    // A typo'd token silently falls back to the literal default forever.
    const emitted = new Set();
    const r = BC.tokens.resolve({});
    for (const k of Object.keys(r.light)) emitted.add("--bc-" + k);
    for (const m of BC.tokens.staticCss().matchAll(/(--bc-[\w-]+)\s*:/g)) emitted.add(m[1]);
    // Aliases and runtime-set properties.
    // Set at runtime rather than emitted by the token layer: aliases, values
    // driven by a setting, and per-element stamps whose value differs per node
    // (--bc-course is one course colour per card, so it cannot be a rule).
    for (const extra of ["--bc-d-bg", "--bc-d-bg2", "--bc-d-bg3", "--bc-d-border",
                         "--bc-d-text", "--bc-d-muted", "--bc-d-link",
                         "--bc-density", "--bc-todo-accent", "--bc-sidebar-w",
                         "--bc-pattern-ink", "--bc-ruler-tint", "--bc-note-bg",
                         "--bc-note-border", "--bc-note-text", "--bc-course"]) emitted.add(extra);

    const missing = new Map();
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      const src = fs.readFileSync(abs, "utf8");
      for (const m of src.matchAll(/var\((--bc-[\w-]+)/g)) {
        // Some tokens are built by concatenation, e.g. "var(--bc-grade-" + band.
        // Accept a name that is a prefix of at least one emitted token.
        if (emitted.has(m[1])) continue;
        if ([...emitted].some((e) => e.startsWith(m[1]))) continue;
        if (!missing.has(m[1])) missing.set(m[1], rel);
      }
    }
    assert.equal(missing.size, 0,
      "unknown tokens referenced: " + [...missing].map(([k, f]) => `${k} (${f})`).join(", "));
  },

  "the z-index scale covers every layer the UI stacks"() {
    const css = BC.tokens.staticCss();
    const layers = ["dock", "underlay", "hud", "popover", "drawer", "modal", "palette", "toast"];
    const values = layers.map((l) => {
      const m = css.match(new RegExp("--bc-z-" + l + ":\\s*(\\d+)"));
      assert.ok(m, `--bc-z-${l} is missing`);
      return Number(m[1]);
    });
    for (let i = 1; i < values.length; i++) {
      assert.ok(values[i] > values[i - 1],
        `z-index scale is out of order: ${layers[i]} (${values[i]}) must sit above ${layers[i - 1]} (${values[i - 1]})`);
    }
  },

  "toasts sit above every other floating surface"() {
    const css = BC.tokens.staticCss();
    const get = (n) => Number(css.match(new RegExp("--bc-z-" + n + ":\\s*(\\d+)"))[1]);
    for (const other of ["dock", "hud", "popover", "drawer", "modal", "palette"]) {
      assert.ok(get("toast") > get(other), `toasts must outrank ${other}`);
    }
  },

  "the bottom-right corner is arbitrated by one shared variable"() {
    // The toast stack, the Pomodoro dock and the page-utility buttons all anchor
    // in this corner. They share it by arbitration rather than by each feature
    // guessing an offset, and the toast stack starts above the sum.
    const staticCss = BC.tokens.staticCss();
    assert.match(staticCss, /--bc-dock-bottom:/);
    assert.match(staticCss, /--bc-utility-h:/);
    assert.match(read("src/content/core/toast.js"),
      /bottom: calc\([^)]*var\(--bc-dock-bottom[^)]*\)[^)]*var\(--bc-utility-h/,
      "the toast stack must clear every slot, not just one");
    // Each feature raises its own slot rather than positioning around others.
    assert.match(read("src/content/features/todo.js"), /--bc-dock-bottom/);
    const prod = read("src/content/features/productivity.js");
    assert.match(prod, /--bc-utility-h/, "the utility buttons must publish their footprint");
    assert.noMatch(prod, /\.bc-copyurl-btn, \.bc-print-btn \{[^}]*left: 16px/,
      "left:16px places them on top of Canvas's global navigation rail");
  },

  "motion respects both the in-app switch and the OS setting"() {
    const css = BC.tokens.staticCss();
    assert.match(css, /:root\[data-bc-motion="0"\]/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  },

  "spacing, radius and type all derive from a single scale"() {
    const css = BC.tokens.staticCss();
    assert.match(css, /--bc-space-unit: calc\(4px \* var\(--bc-space-scale/);
    assert.match(css, /--bc-radius-md: var\(--bc-radius\)/);
    assert.match(css, /--bc-text-md:\s*calc\(14px \* var\(--bc-font-scale\)\)/);
  },

  "corner radius always derives from the user's slider"() {
    // A literal radius ignores the global corner-radius setting, so turning it
    // to 0 left some surfaces rounded and the panels stopped matching.
    // 999px (pill) and 50% (circle) are shapes, not radii, and are exempt.
    const SHAPES = new Set(["999px", "50%", "0", "inherit"]);
    const offenders = [];
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      const src = stripComments(fs.readFileSync(abs, "utf8"));
      for (const [i, line] of src.split("\n").entries()) {
        for (const m of line.matchAll(/border-radius:\s*([^;\n]+)/g)) {
          const v = m[1].replace("!important", "").trim();
          if (v.includes("var(") || SHAPES.has(v) || v.startsWith("${")) continue;
          offenders.push(`${rel}:${i + 1} (${v})`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      "literal border-radius values ignore the radius slider: " + offenders.join(", "));
  },

  // Every settings-UI assertion in this repo reads its file as TEXT. Nothing
  // required src/shared/settings/index.js, so a stray backtick inside its CSS
  // template literal -- which terminates the literal and makes the rest of the
  // file garbage -- left the whole suite green while the drawer was dead on
  // arrival. Parsing is the cheapest possible check and nothing else did it.
  "every shipped source file actually parses"() {
    const vm = require("vm");
    const broken = [];
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      try { new vm.Script(fs.readFileSync(abs, "utf8"), { filename: rel }); }
      catch (e) { broken.push(rel + ": " + e.message); }
    }
    assert.deepEqual(broken, [], "source files that do not parse:\n  " + broken.join("\n  "));
  },

  // The bug this pins: `.bc-row { grid-template-columns: 1fr auto }` sized the
  // CONTROL to max-content and gave the label whatever survived. A colour row
  // -- swatch + hex field + Clear -- is ~230px, so in the drawer's body it left
  // a 130px label column and wrapped a one-line hint over five lines. Measured
  // in a real engine after the fix: narrowest label 250px, deepest hint 2 lines.
  //
  // The row is a three-track grid now (mark / label / control), so the check is
  // on the SHAPE of the tracks rather than on the absence of a grid: the label
  // track must be the one that takes the slack, and it must be allowed to shrink
  // below its content rather than forcing the row wider than the panel.
  "a settings row guarantees its label a minimum width"() {
    const css = read("src/shared/settings/index.js");
    const row = css.match(/\.bc-row \{[^}]*\}/);
    assert.ok(row, ".bc-row rule not found");
    const tracks = row[0].match(/grid-template-columns:\s*([^;]+);/);
    assert.ok(tracks, ".bc-row must declare its tracks explicitly");
    assert.noMatch(tracks[1], /^\s*1fr\s+auto\s*$/,
      "a max-content control column starves the label; the row must not be that grid again");
    assert.match(tracks[1], /minmax\(0,\s*1fr\)/,
      "the label track takes the slack and may shrink; anything else starves it again");
    // A control too wide to share the line gets the whole line UNDER the label,
    // left-aligned. The old fallback let it wrap while keeping margin-left:auto,
    // which parked it against the right edge with nothing above it to align to.
    const wide = css.match(/\.bc-row-wide \.bc-row-control \{[^}]*\}/);
    assert.ok(wide, "there is no wide-row rule, so a long control has nowhere to go");
    assert.match(wide[0], /grid-column:\s*2 \/ -1/,
      "a wide control must span from the label track to the end");
    assert.match(wide[0], /justify-content:\s*flex-start/,
      "a control on its own line aligns with the label above it, not the right edge");
  },

  "our own surfaces take their spacing and type from the scale"() {
    // The density setting (compact/spacious/cozy) and the font-size setting work
    // by scaling --bc-space-unit and --bc-font-scale. A hardcoded px is a value
    // that ignores both, and 157 of them meant the sliders reached almost none
    // of the panels we ship.
    //
    // Exempt: anything below one unit (a hairline, an optical nudge), viewport
    // units, a reset to zero, and interpolated values whose maths is elsewhere.
    const offenders = [];
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      const src = stripComments(fs.readFileSync(abs, "utf8"));
      for (const [i, line] of src.split("\n").entries()) {
        // A JS assignment is not a declaration; PREVIEW_PAD is deliberately a
        // number because buildPreview does arithmetic against it.
        if (line.includes("=") || line.includes("PREVIEW_PAD")) continue;
        for (const m of line.matchAll(/(?:^|[;{]|\s)(padding|margin|gap|row-gap|column-gap)(-\w+)?\s*:\s*([^;\n}]+)/g)) {
          const v = m[3];
          if (/var\(--bc-|\$\{|calc\(|%|vh|vw|\bC\b/.test(v)) continue;
          // Exempt when every component is zero, auto, or under one unit: a
          // shorthand like "0 3px" is two hairlines, not a spacing decision.
          const parts = v.replace("!important", "").trim().split(/\s+/);
          if (parts.every((x) => /^(0|auto|inherit|-?[0-3](\.\d+)?px)$/.test(x))) continue;
          offenders.push(`${rel}:${i + 1} ${m[1]}${m[2] || ""}: ${v.trim()}`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      "spacing that ignores the density setting:\n  " + offenders.join("\n  "));
  },

  "our own surfaces take their type sizes from the scale"() {
    const offenders = [];
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      const src = stripComments(fs.readFileSync(abs, "utf8"));
      for (const [i, line] of src.split("\n").entries()) {
        for (const m of line.matchAll(/font-size:\s*([^;\n}]+)/g)) {
          const v = m[1];
          if (/var\(--bc-text|inherit|\$\{|calc\(|%|em\b|0\s*(!important)?\s*$/.test(v)) continue;
          offenders.push(`${rel}:${i + 1} font-size: ${v.trim()}`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      "type sizes that ignore the font-size setting:\n  " + offenders.join("\n  "));
  },

  "top-level feature panels share one surface treatment"() {
    // These are the panels a user sees side by side on the dashboard; they used
    // to disagree on radius (10 vs 12) and padding (10 vs 12 vs 14).
    const panels = [
      ["src/content/features/announcements.js", ".bc-ann-panel"],
      ["src/content/features/calendar.js", ".bc-mini-cal"],
      ["src/content/features/semester.js", ".bc-semester"],
      ["src/content/features/modules.js", ".bc-mod-summary"],
      ["src/content/features/syllabus.js", ".bc-syl"],
      ["src/content/features/quizsaver.js", ".bc-quiz-banner"],
      ["src/content/features/todo.js", ".bc-todo"],
    ];
    for (const [file, sel] of panels) {
      const src = read(file);
      const i = src.indexOf(sel + " {");
      assert.ok(i > -1, `${sel} not found in ${file}`);
      const block = src.slice(i, src.indexOf("}", i));
      assert.match(block, /border-radius:\s*var\(--bc-radius/,
        `${sel} must take its radius from the token scale`);
      assert.match(block, /padding:\s*[^;]*var\(--bc-space/,
        `${sel} must take its padding from the spacing scale so density applies`);
    }
  },

  "a per-element custom property is set alongside a fallback"() {
    // --bc-course is one colour per card, so it cannot be a stylesheet rule. Any
    // rule reading it must still render sensibly on a card whose colour could
    // not be resolved.
    const src = read("src/content/features/dashboard.js");
    for (const m of src.matchAll(/var\(--bc-course([^)]*)\)/g)) {
      assert.match(m[1], /^,\s*\S/, "var(--bc-course) must carry a fallback");
    }
    assert.match(src, /card\.style\.setProperty\("--bc-course"/,
      "the property has to actually be stamped on the card");
    assert.match(src, /clearCourseIdentity/, "and cleared on teardown");
  },

  // Two of our own rules, both !important, on the same property and the same
  // element: the more specific one wins, and it is not necessarily the one the
  // user just moved a slider for. theming's global radius rule is (0,3,0) on
  // .ic-DashboardCard and the dashboard's own rule is (0,1,0), so the Dashboard
  // tab's corner-radius control rendered 8px whatever it was set to.
  "the dashboard owns its card radius"() {
    // Comments stripped first: the note above the rule names the selector it is
    // warning about, and an unstripped match starts inside the comment.
    const theming = read("src/content/features/theming.js").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = theming.match(/:root\[data-bc-radius\][^{]*\{[^}]*\}/);
    assert.ok(rule, "the global radius rule is missing");
    assert.ok(!/ic-DashboardCard/.test(rule[0]),
      "the global radius rule must not claim the dashboard card; it outranks the card's own control");
    const dash = read("src/content/features/dashboard.js");
    assert.match(dash, /\.ic-DashboardCard \{ border-radius: \$\{rad\}/,
      "the dashboard must still set the card radius from its own setting");
  },

  // A setting that writes a CSS custom property nobody reads is a control that
  // silently does nothing. theming.sidebarWidth wrote --bc-sidebar-w to :root
  // and no rule anywhere consumed it, so the Appearance tab's "Sidebar width"
  // had never moved a pixel. Nothing would ever have surfaced that: the write
  // succeeds, the value is correct, and the page just ignores it.
  "every custom property we write from JS is read by some rule"() {
    const files = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".js") || e.name.endsWith(".css")) files.push(p);
      }
    };
    walk(path.join(ROOT, "src"));
    const all = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

    const written = new Set();
    for (const m of all.matchAll(/setProperty\(\s*["`](--bc-[a-z0-9-]+)["`]/g)) written.add(m[1]);
    assert.ok(written.size >= 5, "expected several JS-written properties; found " + written.size);

    const dead = [...written].filter((v) => all.split("var(" + v).length - 1 === 0);
    assert.deepEqual(dead, [], "custom properties written but never read: " + dead.join(", "));
  },
};
