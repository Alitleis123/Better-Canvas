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
};
