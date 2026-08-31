"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, load, ROOT } = require("./harness");
const M = require("./cssmatch");
const FIX = require("./canvasfixture");

// Our emitted dark-mode CSS: the static sheet plus the token variables, with
// variables resolved so contrast can actually be measured.
function stylesheet(theming) {
  const sb = createSandbox();
  loadCore(sb);
  sb.BC.registry = { register() {} };
  sb.BC.injector = { setStyle() {}, removeNode() {}, ensureNode() {} };
  sb.BC.lifecycle = { pageBag: () => ({ once() {}, timeout() {} }) };
  load(sb, "src/content/features/theming.js");

  const src = fs.readFileSync(path.join(ROOT, "src/content/features/theming.js"), "utf8");
  const staticCss = src.match(/const staticCSS = `([\s\S]*?)`;/)[1];

  const BC = sb.BC;
  const tokens = BC.tokens.resolve(theming || {}).dark;
  const alias = {
    "--bc-d-bg": tokens["surface-1"], "--bc-d-bg2": tokens["surface-2"],
    "--bc-d-bg3": tokens["surface-3"], "--bc-d-border": tokens.border,
    "--bc-d-text": tokens.text, "--bc-d-muted": tokens.muted, "--bc-d-link": tokens.link,
  };
  const resolve = (css) => css.replace(/var\((--bc-[\w-]+)(?:,\s*([^)]*))?\)/g, (_, name, fallback) => {
    if (alias[name]) return alias[name];
    const key = name.replace(/^--bc-/, "");
    return tokens[key] || (fallback ? fallback.trim() : "transparent");
  });

  return { rules: M.parseCss(resolve(staticCss)), tokens, BC };
}

// Apply the runtime sweep to a fixture, using the extension's OWN predicate so
// the model cannot drift from the shipped rule. Static CSS alone is not what a
// user sees: the sweep is the safety net for every light surface no selector
// list names, so a legibility check that ignores it tests a page that never
// exists.
function applySweep(BC, fixture) {
  const tags = new Set(BC.theming.SWEEP_TAGS.split(",").map((t) => t.trim().toUpperCase()));
  const excluded = BC.theming.CONTENT_SCOPES.split(",").map((c) => c.trim().replace(/^\./, ""));
  let marked = 0;
  for (const el of M.walk(fixture)) {
    if (!tags.has(el.tag)) continue;
    // Our own UI and authored content are off limits, including their subtrees.
    let inExcluded = false, isOurs = false;
    for (let n = el; n; n = n.parent) {
      if (n.attrs["data-bc-node"]) { isOurs = true; break; }
      if (n.classes.some((c) => excluded.includes(c))) { inExcluded = true; break; }
    }
    if (isOurs) continue;
    if (!el.bg) continue;                       // transparent: nothing to repaint
    if (inExcluded) {
      // Authored boxes are not repainted, only marked so their ink can suit
      // their own background.
      const lum = BC.color.cssLuminance(el.bg);
      if (lum != null && lum >= BC.theming.LIGHT_CUTOFF) { el.attrs["data-bc-paper"] = ""; marked++; }
      continue;
    }
    if (!BC.theming.isSweepable(el.bg, el.bgImage ? "url(x)" : "none")) continue;
    el.attrs["data-bc-lit"] = "";
    marked++;
  }
  return marked;
}

// What the user actually sees on an element, given Canvas's own paint plus ours.
//
// Both colours resolve the same way: walk from the element upward and stop at
// the first node that declares the property, taking ours over Canvas's at the
// same node because ours is !important. That ordering is the whole point -- a
// colour declared directly on an element beats one inherited from an ancestor,
// so a model that always preferred our ancestor rule could never see text
// inheriting onto a surface Canvas painted light.
function resolve(rules, el, prop, canvasKey) {
  for (let n = el; n; n = n.parent) {
    const mine = M.declFor(rules, n, prop);
    if (mine) return { value: mine.d.value, selector: mine.r.selector, from: n, ours: true };
    if (n[canvasKey]) return { value: n[canvasKey], selector: "(canvas)", from: n, ours: false };
    // background-color does not inherit: only the element itself counts, but the
    // walk continues because what shows THROUGH is the nearest painted ancestor.
    if (prop === "color" && false) break;
  }
  return null;
}

function rendered(rules, el) {
  const bgHit = resolve(rules, el, "background-color", "bg");
  const fgHit = resolve(rules, el, "color", "fg");
  return {
    bg: bgHit && bgHit.value,
    fg: fgHit && fgHit.value,
    bgFromUs: !!(bgHit && bgHit.ours),
    bgSelector: bgHit && bgHit.selector,
    fgSelector: fgHit && fgHit.selector,
  };
}

const isColor = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim());

// Elements that hold text a user has to read.
const TEXTY = new Set(["H1", "H2", "H3", "H4", "SPAN", "A", "P", "TD", "TH", "LI", "BUTTON", "DIV"]);

const describe = (b) =>
  `${M.path(b.el).split(" > ").pop()} ${b.ratio.toFixed(2)}:1 ` +
  `[text ${b.fg} via ${b.fgSelector}] on [bg ${b.bg} via ${b.bgSelector}]`;

function legibilityFailures(fixture, theming) {
  const { rules, BC } = stylesheet(theming);
  applySweep(BC, fixture);
  const bad = [];
  for (const el of M.walk(fixture)) {
    if (!TEXTY.has(el.tag)) continue;
    // Only elements Canvas actually paints text on.
    if (!el.fg) continue;
    const r = rendered(rules, el);
    if (!isColor(r.bg) || !isColor(r.fg)) continue;
    const ratio = BC.color.contrastRatio(r.fg, r.bg);
    if (ratio < 3) bad.push({ el, ratio, ...r });
  }
  return bad;
}

module.exports = {
  "the CSS matcher agrees with real cascade rules"() {
    // Everything below rests on this.
    const rules = M.parseCss(`
      .a { color: red; }
      .a { color: blue; }
      #x { color: green; }
      .b { color: pink !important; }
      .b { color: grey; }
    `);
    const later = M.node("div", ".a");
    assert.equal(M.declFor(rules, later, "color").d.value, "blue", "later rule wins at equal specificity");
    const ided = M.node("div", "#x.a");
    assert.equal(M.declFor(rules, ided, "color").d.value, "green", "id beats class");
    const imp = M.node("div", ".b");
    assert.equal(M.declFor(rules, imp, "color").d.value, "pink", "!important beats source order");
  },

  "the matcher honours :not() and case-insensitive attribute matching"() {
    const rules = M.parseCss(`
      [class*="card" i]:not([class*="image" i]) { color: red; }
    `);
    assert.ok(M.declFor(rules, M.node("div", ".ic-Card"), "color"));
    assert.notOk(M.declFor(rules, M.node("div", ".ic-DashboardCard__header_image"), "color"));
  },

  // ---- the three reported defects --------------------------------------

  "the dashboard title is legible in dark mode"() {
    // It rendered near-white on Canvas's white header bar.
    const { rules, BC } = stylesheet();
    const fixture = FIX.dashboard();
    const title = M.byClass(fixture, "ic-Dashboard-header__title");
    const r = rendered(rules, title);
    assert.ok(isColor(r.bg) && isColor(r.fg), `unresolved colours: ${JSON.stringify(r)}`);
    const ratio = BC.color.contrastRatio(r.fg, r.bg);
    assert.ok(ratio >= 4.5,
      `the Dashboard heading renders at ${ratio.toFixed(2)}:1 (${r.fg} on ${r.bg})`);
  },

  "no course card artwork is repainted by us"() {
    // The image element was matched by a substring selector using the
    // `background` shorthand, which deleted the image outright.
    const { rules } = stylesheet();
    for (const fixture of [FIX.dashboard({ wrappedCards: true }), FIX.dashboard({ wrappedCards: false })]) {
      for (const cls of ["ic-DashboardCard__header_image", "ic-DashboardCard__header_hero"]) {
        const el = M.byClass(fixture, cls);
        assert.ok(el, `${cls} missing from the fixture`);
        const hit = M.declFor(rules, el, "background-color");
        assert.notOk(hit, `${cls} is repainted by "${hit && hit.r.selector}"`);
        assert.notOk(M.declFor(rules, el, "background"),
          `${cls} is hit by the background shorthand, which erases the image`);
      }
    }
  },

  "nothing on the dashboard renders text on a same-toned background"() {
    // The general form of the blank-heading defect.
    const bad = legibilityFailures(FIX.dashboard());
    assert.deepEqual(bad.map(describe), [], "unreadable text in dark mode");
  },

  "nothing on a course page renders text on a same-toned background"() {
    const bad = legibilityFailures(FIX.coursePage());
    assert.deepEqual(bad.map(describe), [], "unreadable text in dark mode");
  },

  "every modelled Canvas page is legible in dark mode"() {
    // The dashboard is not the only place this goes wrong; these are the pages
    // students actually spend their time on.
    for (const page of ["gradesPage", "modulesPage", "discussionPage", "assignmentPage"]) {
      const bad = legibilityFailures(FIX[page]());
      assert.deepEqual(bad.map(describe), [], `unreadable text on ${page}`);
    }
  },

  "every modelled page is legible in every dark tone"() {
    const sb = createSandbox();
    loadCore(sb);
    for (const tone of Object.keys(sb.BC.DARK_TONES)) {
      for (const page of ["dashboard", "coursePage", "gradesPage", "modulesPage",
                          "discussionPage", "assignmentPage"]) {
        const bad = legibilityFailures(FIX[page](), { darkTone: tone });
        assert.deepEqual(bad.map(describe), [], `${page} in tone "${tone}"`);
      }
    }
  },

  "authored message bodies keep their own colours on every page"() {
    // Instructor and student prose is theirs; we darken the shell around it.
    const { rules } = stylesheet();
    for (const page of ["discussionPage", "assignmentPage", "coursePage"]) {
      for (const el of M.walk(FIX[page]())) {
        if (!el.classes.includes("user_content") && !el.classes.includes("description")) continue;
        for (const child of M.walk(el).slice(1)) {
          const hit = M.declFor(rules, child, "background-color");
          assert.notOk(hit,
            `${page}: authored content ${M.path(child).split(" > ").pop()} repainted by "${hit && hit.r.selector}"`);
        }
      }
    }
  },

  "legibility holds for every dark tone we ship"() {
    const sb = createSandbox();
    loadCore(sb);
    for (const tone of Object.keys(sb.BC.DARK_TONES)) {
      const bad = legibilityFailures(FIX.dashboard(), { darkTone: tone });
      assert.equal(bad.length, 0,
        `tone "${tone}": ${bad.map((b) => M.path(b.el).split(" > ").pop() + " " + b.ratio.toFixed(2) + ":1").join(", ")}`);
    }
  },

  "instructor-authored content keeps its own colours"() {
    const { rules } = stylesheet();
    const fixture = FIX.coursePage();
    const callout = M.byClass(fixture, "callout");
    assert.ok(callout);
    const hit = M.declFor(rules, callout, "background-color");
    assert.notOk(hit, `authored content repainted by "${hit && hit.r.selector}"`);
  },

  "the test can actually detect the defect it was written for"() {
    // Guard against the fixture quietly not exercising anything: re-introduce
    // the bug and confirm the check fails.
    const { rules, BC } = stylesheet();
    const broken = rules.concat(M.parseCss(
      `html.bc-dark [class*="ic-Dashboard" i][class*="header" i] { background-color: #ffffff !important; }`
    ));
    const fixture = FIX.dashboard();
    const image = M.byClass(fixture, "ic-DashboardCard__header_image");
    assert.ok(M.declFor(broken, image, "background-color"),
      "the over-broad selector should be detected when present");
    const title = M.byClass(fixture, "ic-Dashboard-header__title");
    const r = (() => {
      let bg = null;
      for (let n = title; n; n = n.parent) {
        const mine = M.declFor(broken, n, "background-color");
        if (mine) { bg = mine.d.value; break; }
        if (n.bg) { bg = n.bg; break; }
      }
      const fg = M.computed(broken, title, "color");
      return { bg, fg: fg && fg.value };
    })();
    assert.ok(BC.color.contrastRatio(r.fg, r.bg) < 4.5,
      "with the bug re-introduced the heading should be unreadable");
  },
};
