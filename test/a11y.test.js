"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, load, ROOT } = require("./harness");

const BC = loadCore(createSandbox());
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function jsFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

module.exports = {
  "nothing fakes a button with a div or span"() {
    // role="button" on a non-button is focusable but does not activate on Enter
    // or Space unless the handler is written by hand, which none of ours were.
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      const src = fs.readFileSync(abs, "utf8");
      for (const [i, line] of src.split("\n").entries()) {
        if (!/role\s*=\s*["']button["']|"role",\s*"button"/.test(line)) continue;
        // A real <button> is fine, and so is an <a> that has been given full
        // button semantics (the drawer trigger adds a Space handler explicitly).
        if (/<button|createElement\("button"|el\("button"/.test(line)) continue;
        if (/<a\b/.test(line)) continue;
        if (rel.endsWith("settings-panel.js") && /^\s*a\.setAttribute/.test(line)
            && src.includes('e.key === " " || e.key === "Spacebar"')) continue;
        assert.ok(false, `${rel}:${i + 1} gives role="button" to a non-button: ${line.trim().slice(0, 110)}`);
      }
    }
  },

  "the file star is a real button with a pressed state"() {
    const src = read("src/content/features/files.js");
    assert.match(src, /<button type="button" class="bc-file-star/);
    assert.match(src, /aria-pressed=/);
    assert.match(src, /aria-label="Star /);
  },

  "the planner detail popover has dialog semantics"() {
    const src = read("src/content/features/todo.js");
    assert.match(src, /pop\.setAttribute\("role", "dialog"\)/);
    assert.match(src, /pop\.setAttribute\("aria-label", "Task details"\)/);
  },

  "the planner popover can be dismissed and restores focus"() {
    const src = read("src/content/features/todo.js");
    assert.match(src, /document\.addEventListener\("mousedown", onDocDown/,
      "a popover with no outside-click dismiss traps the user in it");
    assert.match(src, /anchor\.focus\(\)/, "focus must return to the opener, not <body>");
  },

  "every modal surface traps focus and restores it on close"() {
    for (const [file, what] of [
      ["src/content/core/commandPalette.js", "command palette"],
      ["src/content/features/settings-panel.js", "settings drawer"],
    ]) {
      const src = read(file);
      assert.match(src, /focusTrap\(/, `${what} does not trap focus`);
    }
    // The trap itself restores focus on release.
    assert.match(read("src/content/core/ui.js"), /previous\.focus\(\)/);
  },

  "the focus trap reads activeElement through the shadow root"() {
    // From outside a shadow root document.activeElement reports the HOST, so a
    // naive trap never matches and lets focus escape the drawer immediately.
    assert.match(read("src/content/core/ui.js"), /container\.activeElement \|\| document\.activeElement/);
  },

  "modal surfaces are labelled and marked modal"() {
    assert.match(read("src/content/core/commandPalette.js"), /aria-modal/);
    assert.match(read("src/content/core/commandPalette.js"), /aria-label", "Command palette/);
    assert.match(read("src/content/features/settings-panel.js"), /aria-modal/);
    assert.match(read("src/content/features/settings-panel.js"), /aria-label", "Better Canvas settings/);
  },

  "the command palette exposes listbox semantics"() {
    const src = read("src/content/core/commandPalette.js");
    for (const attr of ["combobox", "listbox", "option", "aria-activedescendant", "aria-selected"]) {
      assert.match(src, new RegExp(attr), `palette is missing ${attr}`);
    }
  },

  "toasts are announced, with urgency matching the level"() {
    const src = read("src/content/core/toast.js");
    assert.match(src, /aria-live/);
    assert.match(src, /level === "warn" \|\| level === "error"/,
      "warnings and errors must use an assertive region, info and success a polite one");
    assert.match(src, /"assertive" : "polite"/);
  },

  "the toast dismiss control has an accessible name"() {
    assert.match(read("src/content/core/toast.js"), /close\.setAttribute\("aria-label", "Dismiss"\)/);
  },

  "icon-only buttons are required to carry a label"() {
    const src = read("src/content/core/ui.js");
    assert.match(src, /if \(!label\) BC\.util\.warn\("ui\.iconButton called without a label"/);
    assert.match(src, /"aria-label": label/);
  },

  "progress and skeleton surfaces expose their state"() {
    const src = read("src/content/core/ui.js");
    assert.match(src, /role: "progressbar"/);
    assert.match(src, /aria-valuenow/);
    assert.match(src, /role: "status", "aria-label": "Loading"/);
  },

  "error states are announced as alerts"() {
    assert.match(read("src/content/core/ui.js"), /class: "bc-error", role: "alert"/);
  },

  "the settings drawer trigger reports its expanded state"() {
    const src = read("src/content/features/settings-panel.js");
    assert.match(src, /aria-expanded/);
    assert.match(src, /setExpanded\(true\)/);
    assert.match(src, /setExpanded\(false\)/);
  },

  "the drawer trigger handles Space as well as Enter"() {
    // <a role="button"> activates on Enter but not Space.
    assert.match(read("src/content/features/settings-panel.js"),
      /e\.key === " " \|\| e\.key === "Spacebar"/);
  },

  "decorative glyphs are hidden from assistive tech"() {
    assert.match(read("src/content/core/ui.js"), /"aria-hidden": "true", text: glyph/);
    assert.match(read("src/content/features/accessibility.js"), /aria-hidden/);
  },

  "numeric badges carry a text alternative"() {
    // A bare count conveys nothing on its own.
    assert.match(read("src/content/features/dashboard.js"), /b\.setAttribute\("aria-label", label\)/);
    assert.match(read("src/content/features/instructor.js"), /b\.setAttribute\("aria-label", label\)/);
  },

  "charts carry a role and a label"() {
    assert.match(read("src/content/core/ui.js"), /role="img" aria-label=/);
    assert.match(read("src/content/features/grades.js"), /role="img" aria-label="Grade trend chart"/);
    assert.match(read("src/content/features/grades.js"), /role="img" aria-label="Assignment group weights"/);
  },

  "motion is gated on both the app switch and the OS preference"() {
    const src = read("src/content/core/ui.js");
    assert.match(src, /data-bc-motion/);
    assert.match(src, /prefers-reduced-motion: reduce/);
  },

  "the reduced-motion helper is consulted before JS-driven animation"() {
    // CSS cannot reach scrollIntoView or rAF sequences.
    assert.match(read("src/content/core/toast.js"), /BC\.ui\.motion\.reduced\(\)/);
  },

  "dimmed text uses a token rather than opacity"() {
    // Fading text that already sits at AA drops it below AA.
    for (const f of ["src/content/features/todo.js", "src/content/features/syllabus.js",
                     "src/shared/settings/index.js"]) {
      const src = read(f);
      assert.noMatch(src, /\.(done|added|bc-concluded)[^{]*\{[^}]*opacity:\s*\.[0-9]/,
        `${f} dims text with opacity instead of --bc-text-subtle`);
    }
  },

  "focus-visible styling exists inside the shadow root"() {
    // With `all: initial` the UA ring often does not render at all.
    assert.match(read("src/shared/settings/index.js"), /\.bc-app :focus-visible \{/);
  },

  "colour is never the only signal for attendance state"() {
    const src = read("src/content/features/instructor.js");
    assert.match(src, /pBtn\.textContent = "P"/);
    assert.match(src, /aBtn\.textContent = "A"/);
  },

  "every grade band pairs its fill with a guaranteed-contrast foreground"() {
    const r = BC.tokens.resolve({});
    for (const mode of ["light", "dark"]) {
      for (const band of ["a", "b", "c", "d", "f"]) {
        const ratio = BC.color.contrastRatio(r[mode]["grade-" + band + "-fg"], r[mode]["grade-" + band]);
        assert.ok(ratio >= 4.5, `grade ${band} in ${mode} is ${ratio.toFixed(2)}:1`);
      }
    }
  },

  "the live region helper serves both politeness levels"() {
    const src = read("src/content/core/ui.js");
    assert.match(src, /bc-live-assertive/);
    assert.match(src, /bc-live-polite/);
    assert.match(src, /node\.textContent = "";/, "an identical string is not re-announced unless cleared first");
  },

  "dark mode never leaves inherited light text on an undarkened surface"() {
    // The global rule sets `color` with !important on html/body, and colour
    // inherits while background does not. Every surface the background allowlist
    // misses therefore renders our near-white text on its own light background
    // and goes blank. The dashboard header was the visible case.
    const src = read("src/content/features/theming.js");
    assert.match(src, /html\.bc-dark, html\.bc-dark body \{ background-color: [^;]*; color:/,
      "the global rule should still set both, so bare text on body stays legible");
    // Page chrome must be covered, and by substring matching rather than exact
    // class names, because Canvas renames these between releases.
    assert.match(src, /\[class\*="Dashboard-header" i\]/,
      "the dashboard header must be darkened or its title is white on white");
    assert.match(src, /\[class\*="PageHeader" i\]/);
    assert.match(src, /\[class\*="Toolbar" i\]/);
  },

  "headings inside darkened page chrome get an explicit colour"() {
    // They inherit rather than setting their own, so they need to be named.
    const src = read("src/content/features/theming.js");
    assert.match(src, /\[class\*="Dashboard-header" i\] h1/);
  },

  "every rule that darkens a surface also sets the text colour on it"() {
    // A rule that sets a dark background without a colour leaves whatever
    // Canvas had there, which may be dark text.
    const src = read("src/content/features/theming.js");
    const i = src.indexOf("const staticCSS = `");
    const css = src.slice(i, src.indexOf("`;", i));
    // Each declaration block that assigns --bc-d-bg* as a background.
    for (const m of css.matchAll(/\{([^}]*background:\s*var\(--bc-d-bg[^}]*)\}/g)) {
      const block = m[1];
      assert.match(block, /color:\s*var\(--bc-d-text/,
        "a block sets a dark background without setting the text colour: " + block.trim().slice(0, 90));
    }
  },

  "a utility button's name does not depend on a visual state"() {
    // The label is clipped to zero width at rest, not hidden, so it stays in the
    // accessibility tree; and each button carries an aria-label regardless, so
    // the name never depends on hover.
    const src = read("src/content/features/productivity.js");
    for (const name of ["Copy page URL", "Print this page"]) {
      assert.ok(src.includes(name), `a utility button is missing the aria-label "${name}"`);
    }
    assert.match(src, /\.bc-util-label \{[^}]*max-width: 0;/,
      "the label must be clipped, not display:none, or it leaves the a11y tree");
    assert.noMatch(src, /\.bc-util-label \{[^}]*display:\s*none/);
    assert.match(src, /class: "bc-util-ic", "aria-hidden": "true"/,
      "the decorative glyph must be hidden from assistive tech");
  },

  "the utility label reveals on focus, not only on hover"() {
    // Hover-only would make it unreachable by keyboard.
    const src = read("src/content/features/productivity.js");
    assert.match(src, /:focus-visible \.bc-util-label/,
      "the label must expand on keyboard focus too");
  },

  "the utility label does not animate under reduced motion"() {
    const src = read("src/content/features/productivity.js");
    assert.match(src, /data-bc-motion="0"\] \.bc-util-label \{ transition: none/);
    assert.match(src, /prefers-reduced-motion: reduce\) \{ \.bc-util-label \{ transition: none/);
  },

  "the utility label is shown outright where there is no hover"() {
    // A touch device never fires hover, so a hover-only reveal would leave the
    // icon alone to carry the button for the whole of that platform.
    const src = read("src/content/features/productivity.js");
    assert.match(src, /@media \(hover: none\) \{\s*\.bc-util-label \{[^}]*max-width: 140px/,
      "the label must be visible outright on a device that cannot hover");
  },

  "the utility buttons have an edge that reads against the page"() {
    // These float directly on surface-1, and surface-2 against surface-1 is
    // 1.14:1, so the fill cannot carry the shape. The boundary is the border,
    // which has to clear 3:1 for a control (WCAG 1.4.11). Plain --bc-border is
    // guarded against surface-2, not against the page, and came out at 1.6:1.
    const src = read("src/content/features/productivity.js");
    const rule = src.match(/\.bc-copyurl-btn, \.bc-print-btn \{[^}]*\}/);
    assert.ok(rule, "the utility button rule is missing");
    assert.match(rule[0], /border: 1px solid var\(--bc-border-strong/,
      "a floating control needs the strong border to be visible on the page");
  },

  "the settings tab icons are drawn, not typed"() {
    // Same failure as the utility buttons, in the surface the user actually
    // navigates: these were geometric glyphs, including a telephone for
    // announcements and a shogi piece for notifications, and an emoji for
    // accessibility that broke the monochrome set on every platform.
    const src = read("src/shared/settings/index.js");
    assert.noMatch(src, /\{ id: "\w+",\s*label: "[^"]*",\s*icon: "/,
      "a settings tab must not carry a text glyph as its icon");
    assert.match(src, /const TAB_ICONS = \{/, "the tab icon set is missing");
    assert.match(src, /<svg width="16" height="16"[^>]*stroke="currentColor"/,
      "tab icons must inherit the tab's colour");
  },

  "the utility icons are drawn, not typed"() {
    // At rest the icon is the entire affordance. A unicode glyph is at the mercy
    // of the host page's font: U+2302 and U+26AD are tofu where the font lacks
    // them, and a house and a marriage symbol where it has them.
    const src = read("src/content/features/productivity.js");
    assert.noMatch(src, /class: "bc-util-ic"[^}]*text:/,
      "a utility icon must not be a text glyph");
    assert.match(src, /<svg width="16" height="16"[^>]*stroke="currentColor"/,
      "a utility icon must be an SVG that inherits the button's colour");
  },
};
