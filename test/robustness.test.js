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

  "the drawer preview clone cannot answer for the real page"() {
    // The preview is a live copy of the shell sitting in the light DOM, so every
    // marker it carries is a second answer to a document query. Install guards
    // ask for [data-bc-node], and ids make querySelectorAll report the page
    // twice, so both are stripped. The nav is the exception: hiding a nav item
    // is a rule on that item's id.
    const src = read("src/content/features/settings-panel.js");
    assert.match(src, /clone\.querySelectorAll\("\[data-bc-node\]"\)\.forEach\(\(n\) => n\.removeAttribute\("data-bc-node"\)\)/,
      "the clone must not carry our install markers");
    assert.match(src, /clone\.querySelectorAll\("\[id\]"\)/,
      "the clone must not carry duplicate ids");
    assert.match(src, /clone\.querySelector\("#menu"\)/,
      "the nav keeps its ids so nav hiding stays previewable");
    assert.match(src, /clone\.querySelectorAll\("script,iframe,object,embed"\)\.forEach\(\(n\) => n\.remove\(\)\)/,
      "the clone must not re-run or re-fetch anything");
  },

  "the drawer locks the page it is covering"() {
    // A fixed overlay does not stop a wheel event, so without this the page
    // scrolled underneath a preview that could not follow it. Both elements are
    // locked because which one scrolls depends on the page.
    const src = read("src/content/features/settings-panel.js");
    assert.match(src, /function lockPageScroll/, "the drawer must lock page scroll");
    const i = src.indexOf("function lockPageScroll");
    const body = src.slice(i, src.indexOf("function unlockPageScroll"));
    assert.match(body, /el\.style\.overflow = "hidden"/);
    assert.match(body, /bd\.style\.overflow = "hidden"/);
    assert.match(body, /paddingRight/, "the removed scrollbar must be compensated or the page shifts");
    const u = src.slice(src.indexOf("function unlockPageScroll"));
    assert.match(u.slice(0, 400), /scrollLock\.htmlOv/, "the original value must be restored, not assumed empty");
    assert.match(u.slice(0, 400), /scrollLock\.bodyOv/);
  },

  "the preview stage does not punch a hole in the modal"() {
    // The stage sits above the scrim. With pointer-events:none it let clicks and
    // wheel through to the page; the clone inside stays inert instead.
    const src = read("src/content/features/settings-panel.js");
    const i = src.indexOf("previewHost.style.cssText");
    const css = src.slice(i, i + 700);
    assert.match(css, /pointer-events:auto/, "the stage must take events, not pass them on");
    assert.match(css, /overflow:hidden/, "the stage must clip a zoomed preview");
    assert.match(src, /transform-origin: top left; pointer-events:none/,
      "the cloned page itself must stay inert");
  },

  "opening the drawer does not wait for the preview"() {
    // Cloning the shell is the expensive part and nothing about it needs to
    // happen in the frame that shows the panel.
    const src = read("src/content/features/settings-panel.js");
    assert.match(src, /schedulePreview\(\);/, "open must schedule the preview, not build it");
    assert.match(src, /function schedulePreview[\s\S]{0,240}requestIdleCallback/,
      "the preview build must be deferred to idle");
    assert.match(src, /function prewarm[\s\S]{0,240}requestIdleCallback/,
      "the settings form must be built before the first click, not during it");
  },

  "the drawer preview releases its subscription on close"() {
    // It rebuilds the whole shell on every settings change, so a subscription
    // left running after close is a rebuild of a hidden element for the rest of
    // the page's life.
    const src = read("src/content/features/settings-panel.js");
    const i = src.indexOf("function hidePreview");
    assert.ok(i > 0, "hidePreview is missing");
    const body = src.slice(i, i + 420);
    assert.match(body, /previewUnsub/, "hidePreview must release the store subscription");
    assert.match(body, /clearTimeout\(previewTimer\)/, "a pending rebuild must be cancelled");
  },
};
