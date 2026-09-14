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

  "every section heading carries a mark too"() {
    // A tab is six cards deep. A heading is findable by shape while scrolling
    // past them; a line of 15px text is not. Four sections were missed the first
    // time because the check only looked 180 characters ahead of S.section and
    // their descriptions are longer than that, so the window is generous now.
    const src = SRC();
    const secs = [...src.matchAll(/S\.section\(\{([\s\S]{0,500}?)children:/g)];
    assert.ok(secs.length > 40, "expected the whole panel; found " + secs.length + " sections");
    const bare = secs.filter((m) => !/icon:/.test(m[1]))
      .map((m) => (m[1].match(/title: ("[^"]*"|[^,\n]+)/) || [])[1]);
    assert.deepEqual(bare, [], "sections with no heading icon");
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
    // The gutter is a token, not a literal: only the in-page drawer floats a
    // close button over this corner, and hardcoding 46px left the options page
    // with that much dead air and its overflow menu adrift from the cards.
    assert.match(header[0], /padding:[^;]*var\(--bc-panel-gutter/,
      "the header must reserve its host's gutter, whatever that host needs");
    assert.match(read("src/content/features/settings-panel.js"), /--bc-panel-gutter:\s*\d+px/,
      "the drawer must claim the corner its close button floats in");
    assert.match(BC.tokens.staticCss(), /--bc-panel-gutter:\s*var\(--bc-pad-card\)/,
      "a host with no chrome of its own should get the card padding, not dead air");
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

  "search does not hide the thing it was asked for"() {
    // Several sections are whole panels rather than lists of rows: the skin
    // gallery, the theme grids, the GPA table, the charts. Judging those by
    // "does it still have a visible row" hid every one of them for ANY query,
    // so typing "skin" on the Themes tab hid the skin gallery.
    const src = SRC();
    const fn = src.match(/function applySearch\(q\) \{[\s\S]*?\n      \}/);
    assert.ok(fn, "applySearch not found");
    assert.match(fn[0], /hasRows\s*\n?\s*\?/,
      "a rowless section must be matched on its own text, not on its rows");
    assert.match(fn[0], /sec\.textContent/,
      "a rowless section needs some way to match");
  },

  "a search that matches nothing says nothing matched"() {
    const src = SRC();
    assert.match(src, /bc-search-empty/, "there is no empty state for search");
    const fn = src.match(/function applySearch\(q\) \{[\s\S]*?\n      \}/);
    assert.match(fn[0], /empty\.classList\.toggle\("bc-hidden"/,
      "the empty state must be driven by the query, not left on screen");
    // It has to outlive a tab switch, which replaces the body wholesale.
    assert.match(src, /body\.replaceChildren\(head, panel, empty\)/,
      "the empty state must be re-attached when the tab changes");
  },

  "opening the drawer focuses something the user can see"() {
    // The trap takes the first tabbable in DOM order, and that is now the master
    // switch's visually hidden checkbox: a 1x1 box, so the focus ring landed
    // somewhere invisible.
    const panel = read("src/content/features/settings-panel.js");
    const call = panel.match(/BC\.ui\.focusTrap\(shadow, \{[\s\S]*?\}\)/);
    assert.ok(call, "the drawer does not install a focus trap");
    assert.match(call[0], /initial:[^,]*\.bc-search/,
      "the drawer must aim its initial focus at a visible control");
  },

  "a tab that fails to render says so"() {
    // A throwing renderer left the PREVIOUS tab's body mounted while the rail
    // highlighted the new one, so the panel silently showed the wrong page.
    const src = SRC();
    const show = src.match(/function showTab\(id\) \{[\s\S]*?\n      \}/);
    assert.ok(show, "showTab not found");
    assert.match(show[0], /try \{[\s\S]*?tab\.render\([\s\S]*?\} catch/,
      "showTab must not let a renderer throw past it");
    assert.match(show[0], /body\.replaceChildren\(head, panel/,
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
    assert.match(comp, /SLIM\.some\(\(c\) => control\.classList\.contains\(c\)\)/,
      "slimness must be derived from the control, not passed in by each caller");
    // A recorded key chip is as narrow as a switch, and its rows all stacked at
    // a 1200px window before it was added to the set.
    assert.match(comp, /const SLIM = \[[^\]]*"bc-key"/, "a keybind chip must count as slim");
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

  "the options page is the only extension surface left"() {
    // The toolbar button used to open a popup whose main control opened the real
    // settings. With the click going straight to the settings, the popup had one
    // unique job left -- the custom-domain permission prompt -- and that needs a
    // foreground extension page anyway, so it moved here and the popup went.
    const files = fs.readdirSync(path.join(ROOT, "src"));
    assert.ok(!files.includes("popup"), "src/popup is back; the toolbar click should not need it");
    const html = read("src/options/options.html");
    assert.match(html, /id="bc-site"/, "the options page must host the custom-domain prompt");
    const js = read("src/options/options.js");
    assert.match(js, /chrome\.permissions\.request/,
      "permissions.request needs a foreground extension page, and this is the only one");
    for (const mf of ["manifest.json", "manifest.firefox.json"]) {
      assert.doesNotMatch(read(mf), /popup/, mf + " still points at a popup");
    }
  },
};
