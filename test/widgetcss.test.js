"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, ROOT } = require("./harness");

const BC = loadCore(createSandbox());
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// The failure mode this exists for: a class renamed in the stylesheet and not
// in the markup (or the reverse) produces an unstyled widget with no error
// anywhere — the CSS is valid, the HTML is valid, they just do not meet. Two
// hand-maintained lists of the same names always drift; this makes the drift a
// test failure instead of something the user reports as "it looks broken".

// Class selectors a stylesheet defines.
function definedClasses(css) {
  const out = new Set();
  // Strip comments first: they describe old class names on purpose.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Selector position only — never a class named inside a declaration value.
  for (const block of code.split("}")) {
    const sel = block.split("{")[0];
    if (!sel) continue;
    for (const m of sel.matchAll(/\.(bc-[\w-]+)/g)) out.add(m[1]);
  }
  return out;
}

// Classes the JS actually puts on an element, from both template markup and
// classList/className calls.
function usedClasses(src) {
  const out = new Set();
  const add = (blob) => {
    // Drop ${...} interpolations: what they contribute is decided at runtime,
    // and the literal text around them is still worth checking.
    for (let tok of blob.replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) {
      // An interpolation containing a quote (`${x ? " on" : ""}`) truncates the
      // class attribute mid-token, so cut at the brace and keep the prefix.
      const brace = tok.indexOf("${");
      if (brace >= 0) tok = tok.slice(0, brace);
      // A trailing dash is the stub of a stripped interpolation
      // (bc-todo-prog--${style}), not a class anyone applies.
      if (/^bc-[\w-]*[\w]$/.test(tok)) out.add(tok);
    }
  };
  for (const m of src.matchAll(/class="([^"]*)"/g)) add(m[1]);
  // progressHtml builds its markup by concatenation, so the class attribute is
  // opened in one string literal and closed in another.
  for (const m of src.matchAll(/class="([^"'\n]*)/g)) add(m[1]);
  for (const m of src.matchAll(/className\s*=\s*"([^"]*)"/g)) add(m[1]);
  for (const m of src.matchAll(/classList\.(?:add|remove|toggle)\("([^"]+)"/g)) add(m[1]);
  // Interpolated conditionals still name real classes: ${x ? " on" : ""}.
  for (const m of src.matchAll(/\$\{[^}]*?"\s*(bc-[\w-]+)\s*"[^}]*?\}/g)) out.add(m[1]);
  return out;
}

// Classes used purely as a handle for JS to find an element again. These need
// no rule of their own and it is not a defect when they have none.
function queriedClasses(src) {
  const out = new Set();
  for (const m of src.matchAll(/querySelector(?:All)?\("[^"]*?\.(bc-[\w-]+)/g)) out.add(m[1]);
  for (const m of src.matchAll(/closest\("\.(bc-[\w-]+)/g)) out.add(m[1]);
  return out;
}

const todoSrc = read("src/content/features/todo.js");
const widgetCss = todoSrc.slice(todoSrc.indexOf("const WIDGET_CSS = `"), todoSrc.indexOf("const POM_CSS = `"));
const pomCss = todoSrc.slice(todoSrc.indexOf("const POM_CSS = `"), todoSrc.indexOf("const HIDE_NATIVE_CSS"));

// Provided by the shared kit or the token layer rather than by this widget.
const SHARED = new Set(["bc-num", "bc-sr-only", "bc-ic", "bc-ic-wrap", "bc-lit",
                        "bc-dark", "bc-panel", "bc-btn", "bc-iconbtn", "bc-empty"]);

module.exports = {
  "every layout the settings offer is styled"() {
    // A layout in the picker with no stylesheet behind it is a menu entry that
    // silently does nothing.
    const css = read("src/content/features/todo.js");
    const ui = read("src/shared/settings/index.js");
    const offered = [...ui.matchAll(/\{ value: "(\w+)",\s+label: "(?:Comfortable|Compact|Cards|Minimal|Timeline)"/g)].map((m) => m[1]);
    assert.ok(offered.length >= 5, "expected five layouts in the picker, found " + offered.length);
    for (const id of offered) {
      if (id === "comfortable") continue; // the default IS the base stylesheet
      assert.match(css, new RegExp('\\[data-bc-layout="' + id + '"\\]'), id + " is offered but never styled");
    }
  },

  "every styled layout is actually reachable"() {
    // The reverse: a stylesheet for a layout nobody can select is dead weight.
    const css = read("src/content/features/todo.js");
    const defaults = read("src/shared/defaults.js");
    const styled = new Set([...css.matchAll(/\[data-bc-layout="(\w+)"\]/g)].map((m) => m[1]));
    const listed = (defaults.match(/layout: "comfortable",\s*\/\/ ([^\n]+)/) || [])[1] || "";
    for (const id of styled) {
      assert.ok(listed.includes(id), id + " is styled but not in the documented set: " + listed);
    }
  },

  "no layout hides a control"() {
    // A layout changes presentation. One that drops the checkbox, the link or
    // the actions is a different feature set wearing a layout's name -- and the
    // user has no way to know a control exists somewhere else.
    const css = read("src/content/features/todo.js");
    const block = css.slice(css.indexOf("---- layouts"), css.indexOf("---- composer"));
    const offenders = [];
    for (const m of block.matchAll(/([^\n{]+)\{([^}]*display:\s*none[^}]*)\}/g)) {
      const sel = m[1].trim();
      // The tag/subtask row in compact is the documented exception: both are
      // still reachable on the detail popover, which nothing else is.
      if (/bc-todo-tags/.test(sel)) continue;
      // Suppressing the timeline node inside kanban is geometry, not a control.
      if (/::before/.test(sel)) continue;
      if (/bc-todo-(check|name|actions|more|star|snooze)/.test(sel)) offenders.push(sel);
    }
    assert.deepEqual(offenders, [], "layouts that hide a control: " + offenders.join(", "));
  },

  "the layout attribute is part of the render signature"() {
    // The widget skips rebuilds when its signature is unchanged. A layout not in
    // that signature means switching layouts does nothing until something else
    // happens to change.
    const src = read("src/content/features/todo.js");
    const sig = src.slice(src.indexOf("const sig = ["), src.indexOf("].join(\"|\")"));
    assert.match(sig, /t\.layout/, "changing layout would not trigger a re-render");
  },

  "an unknown layout falls back instead of rendering unstyled"() {
    const src = read("src/content/features/todo.js");
    assert.match(src, /LAYOUTS\.indexOf\(t\.layout\) >= 0 \? t\.layout : "comfortable"/);
  },

  "every class the planner markup uses is styled somewhere"() {
    const defined = new Set([
      ...definedClasses(widgetCss),
      ...definedClasses(pomCss),
      ...definedClasses(todoSrc.slice(todoSrc.indexOf("const CLEAN_CSS = `"), todoSrc.indexOf("const WIDGET_CSS = `"))),
      ...definedClasses(read("src/content/core/ui.js")),
    ]);
    const queried = queriedClasses(todoSrc);
    // Neither styled, nor a JS handle: a typo or a leftover.
    const missing = [...usedClasses(todoSrc)]
      .filter((c) => !defined.has(c) && !SHARED.has(c) && !queried.has(c));
    assert.deepEqual(missing.sort(), [],
      "classes that are neither styled nor queried: " + missing.join(", "));
  },

  "the planner stylesheet carries no dead rules"() {
    // After a redesign the old rules are the ones that quietly stay behind,
    // and they are what a later reader mistakes for the current design.
    const used = usedClasses(todoSrc);
    // Structural helpers matched via a parent or a state, not applied by name.
    const INDIRECT = new Set(["bc-todo", "bc-drop", "bc-dragging", "bc-prog-done",
                              "bc-todo-prog", "bc-break", "bc-on"]);
    const dead = [...definedClasses(widgetCss), ...definedClasses(pomCss)]
      .filter((c) => !used.has(c) && !INDIRECT.has(c));
    assert.deepEqual(dead.sort(), [], "styled but never applied: " + dead.join(", "));
  },

  "the widget takes every length from the spacing scale"() {
    // The density setting (compact/spacious/cozy) reaches every other surface we
    // ship by scaling --bc-space-unit. This widget hardcoded px, so it was the
    // one panel that ignored the setting entirely.
    const code = widgetCss.replace(/\/\*[\s\S]*?\*\//g, "");
    const offenders = [];
    for (const [i, line] of code.split("\n").entries()) {
      for (const m of line.matchAll(/(?:^|[;{]|\s)(padding|margin|gap|row-gap|column-gap)(-\w+)?\s*:\s*([^;\n]+)/g)) {
        const value = m[3];
        if (value.includes("var(--bc-space") || value.includes("var(--bc-radius")) continue;
        if (/^\s*(0|auto|inherit|0px)\s*$/.test(value)) continue;
        // A hairline or an optical nudge below one unit has nowhere to go on the
        // scale; anything a user would notice does.
        if (/^\s*[0-3]px\s*$/.test(value)) continue;
        offenders.push(`line ${i + 1}: ${m[1]}${m[2] || ""}: ${value.trim()}`);
      }
    }
    assert.deepEqual(offenders, [],
      "hardcoded spacing ignores the density setting:\n  " + offenders.join("\n  "));
  },

  "the widget reads its type sizes from the scale too"() {
    // Same argument for the font-size slider: a literal px is a size that never
    // grows for someone who needs it larger.
    const code = widgetCss.replace(/\/\*[\s\S]*?\*\//g, "");
    const offenders = [];
    for (const [i, line] of code.split("\n").entries()) {
      for (const m of line.matchAll(/font-size:\s*([^;\n]+)/g)) {
        if (m[1].includes("var(--bc-text") || m[1].includes("inherit")) continue;
        offenders.push(`line ${i + 1}: ${m[1].trim()}`);
      }
    }
    assert.deepEqual(offenders, [], "hardcoded font sizes: " + offenders.join(", "));
  },

  "every icon the planner asks for exists"() {
    // BC.icons.svg returns "" for an unknown name, so a typo is an invisible
    // control rather than an error.
    const missing = [];
    for (const m of todoSrc.matchAll(/BC\.icons\.svg\("([\w-]+)"/g)) {
      if (!BC.icons.has(m[1])) missing.push(m[1]);
    }
    // The same for the settings UI's tab rail and swatches.
    const idx = read("src/shared/settings/index.js");
    for (const m of idx.matchAll(/BC\.icons\.svg\("([\w-]+)"/g)) {
      if (!BC.icons.has(m[1])) missing.push("settings: " + m[1]);
    }
    // Buttons name their icon as a property rather than calling svg() directly,
    // and an unknown name there renders a button with an empty box in front of
    // it. That is how "refresh" shipped without existing.
    for (const m of idx.matchAll(/\bicon:\s*"([\w-]+)"/g)) {
      if (!BC.icons.has(m[1])) missing.push("icon prop: " + m[1]);
    }
    const railNames = [...idx.matchAll(/^\s+\w+: "([\w-]+)",/gm)].map((m) => m[1]);
    assert.deepEqual([...new Set(missing)], [], "icons referenced but not defined: " + missing.join(", "));
    assert.ok(railNames.length > 0, "the tab rail map went missing");
  },

  "the tab rail names only real icons"() {
    const idx = read("src/shared/settings/index.js");
    const block = idx.slice(idx.indexOf("const TAB_ICON = {"), idx.indexOf("};", idx.indexOf("const TAB_ICON = {")));
    const bad = [];
    for (const m of block.matchAll(/(\w+):\s*"([\w-]+)"/g)) {
      if (!BC.icons.has(m[2])) bad.push(`${m[1]} -> ${m[2]}`);
    }
    assert.deepEqual(bad, [], "tabs pointing at icons that do not exist: " + bad.join(", "));
  },

  "every icon-only control in the planner has an accessible name"() {
    // The widget is now icons where it used to be words, which moves the whole
    // burden of meaning onto the label.
    const unlabelled = [];
    for (const m of todoSrc.matchAll(/<button[^>]*class="[^"]*bc-todo-ibtn[^"]*"[^>]*>/g)) {
      // The shared helper receives its label through ${attrs}; its call sites
      // are checked below.
      if (m[0].includes("${attrs}")) continue;
      if (!/aria-label=/.test(m[0])) unlabelled.push(m[0].slice(0, 90));
    }
    // Every iconBtn(...) call must pass one.
    for (const m of todoSrc.matchAll(/iconBtn\("[\w-]+",\s*'([^']*)'/g)) {
      if (!/aria-label=/.test(m[1])) unlabelled.push("iconBtn: " + m[1].slice(0, 60));
    }
    assert.deepEqual(unlabelled, [],
      "icon buttons with no aria-label: " + unlabelled.join(" | "));
  },

  "the planner no longer stacks four dropdowns above the list"() {
    // The declutter this was: in a 280px Canvas sidebar those four selects were
    // most of the widget's height before a single task appeared.
    assert.noMatch(todoSrc, /class="bc-todo-controls"/,
      "the four-select control block is back");
    // The detail popover is a form and legitimately full of selects. The point
    // is that none of them sit in the widget's permanent chrome.
    const toolbar = todoSrc.slice(todoSrc.indexOf('<div class="bc-todo-toolbar">'),
                                  todoSrc.indexOf('<div class="bc-todo-list">'));
    const outside = toolbar.slice(0, toolbar.indexOf('<div class="bc-todo-pane">'));
    assert.noMatch(outside, /<select/, "a select is back in the permanent toolbar");
    const inPane = (toolbar.match(/<select/g) || []).length;
    assert.equal(inPane, 3, "range, grouping and course all belong in the pane");
    assert.match(todoSrc, /class="bc-todo-filters"/, "the filter pane is missing");
    // And the view switch is a real group, not a fourth dropdown.
    assert.match(todoSrc, /role="group" aria-label="View"/);
    assert.match(todoSrc, /aria-pressed="\$\{view === id\}"/,
      "the segmented view control must report which option is active");
  },
};
