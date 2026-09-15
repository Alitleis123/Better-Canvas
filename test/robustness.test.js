"use strict";
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./harness");

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

module.exports = {
  "clipboard writes report failure instead of promising success"() {
    // writeText rejects on a denied permission, an insecure context or an
    // unfocused document. Both call sites used to toast success from a chain
    // with no catch, so a failure was silently reported as a success.
    for (const f of ["src/content/features/productivity.js", "src/shared/settings/index.js"]) {
      const src = read(f);
      const i = src.indexOf("clipboard.writeText");
      assert.ok(i > -1, `${f} should still write to the clipboard`);
      assert.match(src.slice(i, i + 400), /\.catch\(/,
        `${f} toasts clipboard success without handling rejection`);
    }
  },

  "file reads in the import flows handle a read error"() {
    const src = read("src/shared/settings/index.js");
    const reads = [...src.matchAll(/f\.text\(\)/g)];
    assert.ok(reads.length >= 2, "both import flows should read the chosen file");
    for (const m of reads) {
      assert.match(src.slice(m.index, m.index + 120), /\.catch\(/,
        "a failed file read must tell the user, not stop silently");
    }
  },

  "boot falls back to defaults if settings cannot be read"() {
    // Otherwise the extension simply never starts, with nothing in the console.
    const src = read("src/content/content.js");
    const i = src.indexOf("function boot()");
    assert.ok(i > -1);
    const body = src.slice(i, i + 700);
    assert.match(body, /\.catch\(/, "boot must not die silently on a storage failure");
    assert.match(body, /cloneDefaults\(\)/, "boot should fall back to defaults so settings stay reachable");
  },

  "every API consumer handles its own rejection"() {
    // A rejected BC.api call with no catch is an unhandled rejection and a panel
    // stuck on its loading state.
    const dir = path.join(ROOT, "src/content/features");
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".js")) continue;
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      for (const m of src.matchAll(/BC\.api\.\w+\([^)]*\)\s*\.then\(/g)) {
        // A chain that is returned (or is an arrow body) hands its rejection to
        // the caller, which is how the settings adapter is written.
        const before = src.slice(Math.max(0, m.index - 40), m.index);
        if (/(return|=>)\s*$/.test(before)) continue;
        // Look ahead far enough to clear the .then body.
        const tail = src.slice(m.index, m.index + 2500);
        assert.match(tail, /\.catch\(/,
          `${f}: a BC.api chain starting at offset ${m.index} has no catch`);
      }
    }
  },

  "storage writes from the planner surface their failure"() {
    // updateLocal rejects when the quota is exceeded; the planner writes on
    // nearly every interaction.
    const src = read("src/content/features/todo.js");
    assert.match(src, /function writeTodoLocal/);
    const i = src.indexOf("function writeTodoLocal");
    assert.match(src.slice(i, i + 500), /catch/,
      "writeTodoLocal must not let a failed write vanish");
  },

  "features contain their own errors so one cannot break the others"() {
    const src = read("src/content/content.js");
    assert.match(src, /BC\.util\.guard\(\(\) => f\.apply\(settings, ctx\), f\.id\)/,
      "every feature apply must run inside guard()");
    assert.match(src, /BC\.util\.guard\(\(\) => f\.unmount\(\)/,
      "every feature unmount must run inside guard()");
  },

  "guard records to diagnostics so a contained error is still reportable"() {
    const src = read("src/content/core/util.js");
    assert.match(src, /BC\.diag\.push/);
  },

  // The drawer used to render a scaled, inert CLONE of the page beside itself.
  // These tests pinned that machinery; it is gone, and what replaced it has the
  // opposite contract, so they assert the opposite things.

  "the drawer docks the real page rather than photographing it"() {
    // A clone could never be right. It stripped [data-bc-node] on the reasoning
    // that our styling targets classes -- true until a feature scoped its sheet
    // by node id, which dashgrid does for every rule, so the preview showed the
    // real card markup with none of the card CSS.
    const src = read("src/content/features/settings-panel.js");
    assert.ok(!/cloneNode\(true\)/.test(src), "there must be no clone of the page");
    assert.ok(!/removeAttribute\("data-bc-node"\)/.test(src),
      "nothing may strip the markers our own stylesheets are scoped by");
    assert.match(src, /function dockPage/, "the page is docked instead");
    assert.match(src, /:root\[data-bc-dock\] body \{ margin-right/,
      "docking is the page making room, not a second copy of it");
  },

  "the docked page keeps its scroll, and the drawer does not lock it"() {
    // The lock existed because a fixed overlay does not stop a wheel event and
    // the page drifted behind a preview that could not follow it. There is no
    // preview to follow now: the page IS the preview, and freezing it would
    // stop you scrolling to the part you are trying to restyle.
    const src = read("src/content/features/settings-panel.js");
    assert.ok(!/function lockPageScroll/.test(src), "the page must not be frozen");
    assert.ok(!/style\.overflow = "hidden"/.test(src));
  },

  "the docked page stays usable: no scrim, no trap, no click-to-close"() {
    // All three are correct for a modal and wrong for a dock. The scrim made the
    // page inert, the focus trap made it unreachable by keyboard, and
    // click-outside-to-close dismissed the panel the moment you touched the very
    // thing you were previewing.
    const src = read("src/content/features/settings-panel.js");
    assert.ok(!/bc-drawer-scrim/.test(src), "the scrim is gone");
    assert.ok(!/focusTrap\(shadow/.test(src), "focus is aimed, not trapped");
    assert.match(src, /NO click-outside-to-close/,
      "clicking the page is the point of the dock");
    assert.match(src, /first\.focus\(\{ preventScroll: true \}\)/,
      "focus still has to land somewhere visible");
    // Escape is the one dismissal that still makes sense.
    assert.match(src, /e\.key === "Escape" && isOpen/);
  },

  "closing the drawer lets the page slide back"() {
    // The transition is declared outside the [data-bc-dock] guard on purpose: a
    // rule that only exists while docked cannot animate the undock, so the page
    // would snap back while the drawer slid out.
    const src = read("src/content/features/settings-panel.js");
    const i = src.indexOf("function dockPage");
    const body = src.slice(i, src.indexOf("\n  }", i));
    assert.match(body, /body \{ transition: margin-right/);
    const guarded = body.indexOf(":root[data-bc-dock] body");
    const plain = body.indexOf("body { transition: margin-right");
    assert.ok(plain < guarded, "the transition must not be inside the docked-only rule");
    assert.match(body, /prefers-reduced-motion/);
  },

  "the settings form is built before the first click, not during it"() {
    const src = read("src/content/features/settings-panel.js");
    assert.match(src, /function prewarm[\s\S]{0,240}requestIdleCallback/);
  },
};
