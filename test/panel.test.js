"use strict";
/*
 * What the settings panel promises, as tests.
 *
 * These exist because every item here was a complaint, not a preference, and
 * each one is the kind of thing that drifts back one row at a time: a new
 * setting added without a mark, a sentence of explanation growing on a label
 * that already said it, a seventeenth tab. Measuring them makes the drift
 * visible in CI instead of six months later.
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { createSandbox, loadCore, ROOT } = require("./harness");

const BC = loadCore(createSandbox());
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const SRC = () => read("src/shared/settings/index.js");

// Every S.row({...}) call, captured up to its control.
function rows(src) {
  return [...src.matchAll(/S\.row\(\{([\s\S]{0,260}?)(?:control:|\}\))/g)].map((m) => m[1]);
}
const labelOf = (body) => ((body.match(/label: "([^"]*)"/) || [])[1] || "(dynamic)");
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

module.exports = {
  "every settings row carries a mark from the shared set"() {
    // The panel shipped with icons on the tab rail and nowhere else, so a tab of
    // fourteen switches was fourteen identical rectangles and the only way to
    // find one was to read every label.
    const src = SRC();
    const all = rows(src);
    assert.ok(all.length > 100, "expected the whole panel; found " + all.length + " rows");
    // `label, icon,` is the shorthand the shortcuts table uses to pass both
    // through from a data array.
    const bare = all.filter((b) => !/icon:\s*"/.test(b) && !/\blabel, icon\b/.test(b));
    assert.deepEqual(bare.map(labelOf), [], "rows with no icon");
  },

  "every icon named in the panel exists"() {
    // A typo used to render an empty box silently, which is the same defect as
    // a missing glyph arriving by a different route.
    const named = [...SRC().matchAll(/icon: "([^"]+)"/g)].map((m) => m[1]);
    const unknown = [...new Set(named)].filter((n) => !BC.icons.has(n));
    assert.deepEqual(unknown, [], "icons not in the shared set");
  },

  "the panel wears one bar of chrome, not two"() {
    // Brand, master switch, search, undo/redo and the destructive actions were
    // spread over two stacked bars that ate ~130px before any setting, and the
    // second one overflowed its own right edge -- Redo was clipped and sat under
    // the drawer's close button.
    const src = SRC();
    assert.doesNotMatch(src, /bc-topbar/, "the second chrome bar is back");
    const header = src.match(/\.bc-header \{[^}]*\}/);
    assert.ok(header, ".bc-header has no rule");
    assert.match(header[0], /grid-template-columns:[^;]*minmax\(0, 1fr\)/,
      "exactly one header track may take the slack, or the actions overflow again");
    assert.match(header[0], /padding:[^;]*46px/,
      "the header must reserve the corner the drawer's close button floats in");
  },

  "the tabs are grouped, and there are not seventeen of them"() {
    const src = SRC();
    const groups = [...src.matchAll(/\{ label: "([^"]+)", tabs: \[/g)].map((m) => m[1]);
    assert.ok(groups.length >= 3 && groups.length <= 6,
      "a flat list is what made this unnavigable; found " + groups.length + " groups");
    const tabs = [...src.matchAll(/\{ id: "\w+",\s*label: "[^"]*",\s*icon: "/g)];
    assert.ok(tabs.length <= 14, "too many tabs to scan: " + tabs.length);
    assert.ok(tabs.length >= 10, "tabs went missing rather than being merged: " + tabs.length);
  },

  "no hint is longer than a breath"() {
    // A hint earns its place by saying something the label cannot. Anything past
    // a clause is the label failing, and it was costing five wrapped lines in a
    // narrow drawer.
    const long = [...SRC().matchAll(/hint: "([^"]*)"/g)]
      .map((m) => m[1]).filter((h) => words(h) > 16);
    assert.deepEqual(long, [], "hints over 16 words");
  },

  "the panel's prose stays under budget"() {
    // Not a style rule -- a regression bar. 438 words of hint and section copy
    // shipped before; the budget is set just above where it landed so that
    // adding a section costs a sentence, not a paragraph.
    const src = SRC();
    const total = [...src.matchAll(/(?:hint|description): "([^"]*)"/g)]
      .reduce((n, m) => n + words(m[1]), 0);
    assert.ok(total <= 400, "panel prose is " + total + " words (budget 400)");
  },

  "a section heading never just repeats its first row"() {
    // "Mode" over "To Do list style"; "Dark mode" over "Dark mode"; "Light
    // theme" over "Light palette". Each one spent a heading saying nothing.
    const src = SRC();
    const dupes = [];
    for (const m of src.matchAll(/title: "([^"]+)"[\s\S]{0,200}?S\.row\(\{[\s\S]{0,80}?label: "([^"]+)"/g)) {
      const a = m[1].toLowerCase().trim(), b = m[2].toLowerCase().trim();
      if (a === b) dupes.push(m[1]);
    }
    assert.deepEqual(dupes, [], "sections whose heading repeats their first row");
  },

  "an unset colour does not render as black"() {
    // input[type=color] has no empty state: it reports #000000, and styling its
    // own background does nothing because the UA's ::-webkit-color-swatch paints
    // over it. So the swatch is ours and the input rides on top, invisible.
    const comp = read("src/shared/settings/components.js");
    assert.match(comp, /bc-swatch/, "the colour control must own its swatch");
    assert.match(comp, /bc-color-unset/, "there is no unset state");
    const css = SRC();
    const unset = css.match(/\.bc-color-unset \.bc-swatch \{[^}]*\}/);
    assert.ok(unset, "the unset swatch has no rule, so it paints as a chosen colour");
    assert.match(unset[0], /linear-gradient/, "unset must look unset, not like black");
    const sw = css.match(/\.bc-swatch input\[type=color\] \{[^}]*\}/);
    assert.ok(sw && /opacity: 0/.test(sw[0]), "the input must not be the visible surface");
  },

  "a dependent row is dimmed the moment it mounts"() {
    // enabledWhen only registered a binding, which the store does not run until
    // something changes -- so a planner-only control looked live while the
    // planner was off, until the user happened to touch an unrelated setting.
    const comp = read("src/shared/settings/components.js");
    const row = comp.match(/C\.row = function[\s\S]*?\n  \};/);
    assert.ok(row, "C.row not found");
    assert.match(row[0], /if \(C\.state\)/,
      "enabledWhen must be evaluated once at construction, not only on the next change");
    assert.match(read("src/shared/settings/state.js"), /SettingsComponents[^\n]*\.state = \(\) => state/,
      "the store must hand the components layer a reader for construction-time state");
  },

  "a tab that fails to render says so"() {
    // A throwing renderer left the PREVIOUS tab's body mounted while the rail
    // highlighted the new one, so the panel silently showed the wrong page.
    const src = SRC();
    const show = src.match(/function showTab\(id\) \{[\s\S]*?\n      \}/);
    assert.ok(show, "showTab not found");
    assert.match(show[0], /try \{[\s\S]*?tab\.render\([\s\S]*?\} catch/,
      "showTab must not let a renderer throw past it");
    assert.match(show[0], /body\.replaceChildren\(head, panel\)/,
      "the body must be swapped once, after the panel is known to exist");
  },

  "the row's narrow form is measured against the body, not the wrapper"() {
    // The wrapper includes the 200px tab rail. Querying it meant that at a 600px
    // drawer the query saw 552px and stayed in two-column mode while the body it
    // spoke for was 332px -- where the GPA "Scale" row came out with a 26px
    // label and a seven-line hint.
    const src = SRC();
    assert.match(src, /\.bc-body \{[^}]*container-name: bc-body/,
      "the body must be its own container for row-level queries");
    assert.match(src, /@container bc-body \(max-width: \d+px\)/,
      "the stacking query must be scoped to the body");
    assert.match(src, /@container bc-shell \(max-width: \d+px\)/,
      "the rail-collapse query must be scoped to the wrapper, or the two shadow each other");
    // A percentage cap is ignored while an auto track is being intrinsically
    // sized, so the ceiling has to be absolute.
    const sel = src.match(/\.bc-select \{[^}]*\}/);
    assert.ok(sel && /max-width: \d+px/.test(sel[0]),
      "a select sized to its widest option will starve the label again");
  },

 "the build runs without PowerShell"() {
    // build.ps1 is the only documented build and there is no pwsh on macOS, so
    // dist/ silently stayed weeks stale while src/ moved.
    const sh = read("build.sh");
    for (const step of ["node --check", "node test/run.js", "manifest.firefox.json"]) {
      assert.ok(sh.includes(step), "build.sh skips " + step);
    }
    const ps = read("build.ps1");
    // The two must stay in step; both build the same two targets from the same
    // two manifests.
    for (const m of ["manifest.json", "manifest.firefox.json"]) {
      assert.ok(sh.includes(m) && ps.includes(m), m + " is missing from one build script");
    }
  },

 "a narrow panel does not stack a row whose control is one switch"() {
    // The stacking rule exists for sliders, selects and time pickers. A switch is
    // 40px and fits beside a label at any width this panel can reach, and the
    // blanket rule turned a one-line toggle into two lines for most of the panel
    // at a 1100px window, which is the common laptop case.
    const src = SRC();
    const stack = src.match(/@container bc-body \(max-width: \d+px\) \{[\s\S]*?\n  \}/);
    assert.ok(stack, "the narrow-panel rule is missing");
    assert.match(stack[0], /\.bc-row:not\(\.bc-row-slim\)/,
      "a switch row must be exempt from stacking");
    const comp = read("src/shared/settings/components.js");
    assert.match(comp, /bc-row-slim/, "nothing marks a switch-only row as slim");
    // Read off the control, not declared per call site: there are ~70 of these.
    assert.match(comp, /classList\.contains\("bc-switch"\)/,
      "slimness must be derived from the control, not passed in by each caller");
  },

  "the popup and the panel are the same product"() {
    const pop = read("src/popup/popup.css");
    for (const shared of ["bc-master", "bc-switch-thumb", "bc-pop-ic"]) {
      assert.ok(pop.includes(shared), "the popup is missing " + shared);
    }
    assert.match(read("src/popup/popup.html"), /data-icon="moon"/,
      "the popup's rows must carry the same marks the panel's do");
    // The rule, not the word: the file's header comment explains why the old
    // one was removed, and matching that comment made this fail on its own note.
    assert.doesNotMatch(pop, /@media[^{]*prefers-color-scheme/,
      "the popup must follow the user's theme, not the OS");
  },
};
