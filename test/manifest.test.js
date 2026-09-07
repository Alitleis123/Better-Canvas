"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, ROOT } = require("./harness");

const mv3 = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const ff = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.firefox.json"), "utf8"));
const sw = fs.readFileSync(path.join(ROOT, "src/background/service-worker.js"), "utf8");
const BC = loadCore(createSandbox());

const scriptsOf = (m, allFrames) =>
  m.content_scripts.find((c) => !!c.all_frames === allFrames).js;

// Every chrome.* namespace the source actually calls.
function usedNamespaces() {
  const out = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js")) {
        const src = fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        for (const m of src.matchAll(/\bchrome\.([a-zA-Z]+)\s*\./g)) out.add(m[1]);
      }
    }
  };
  walk(path.join(ROOT, "src"));
  return out;
}

module.exports = {
  "every declared version matches BC.VERSION"() {
    assert.equal(mv3.version, BC.VERSION, "manifest.json drifted from BC.VERSION");
    assert.equal(ff.version, BC.VERSION, "manifest.firefox.json drifted from BC.VERSION");
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    assert.equal(pkg.version, BC.VERSION, "package.json drifted from BC.VERSION");
  },

  "the build refuses to package a failing tree"() {
    const build = fs.readFileSync(path.join(ROOT, "build.ps1"), "utf8");
    assert.match(build, /Run-Tests/, "build.ps1 must run the suite");
    assert.match(build, /Test suite failed; not building/);
    // And the gate must come before the copy steps.
    assert.ok(build.indexOf("Run-Tests\nBuild-Target") > -1 || /Run-Tests\r?\nBuild-Target/.test(build),
      "Run-Tests must run before Build-Target");
  },

  "both manifests declare the same content script lists"() {
    assert.deepEqual(scriptsOf(ff, false), scriptsOf(mv3, false));
    assert.deepEqual(scriptsOf(ff, true), scriptsOf(mv3, true));
  },

  "every declared content script exists on disk"() {
    for (const m of [mv3, ff]) {
      for (const cs of m.content_scripts) {
        for (const f of cs.js) {
          assert.ok(fs.existsSync(path.join(ROOT, f)), `missing ${f}`);
        }
      }
    }
  },

  "every declared icon and page exists on disk"() {
    for (const p of Object.values(mv3.icons)) assert.ok(fs.existsSync(path.join(ROOT, p)), `missing ${p}`);
    assert.ok(fs.existsSync(path.join(ROOT, mv3.action.default_popup)));
    assert.ok(fs.existsSync(path.join(ROOT, mv3.options_page)));
    assert.ok(fs.existsSync(path.join(ROOT, mv3.background.service_worker)));
  },

  "the service worker derives its script lists from the manifest"() {
    // The lists injected on user-granted custom Canvas domains must be the same
    // ones the manifest declares for *.instructure.com. Restating them by hand is
    // the bug class this guards: a drifted copy is still valid JS, so nothing
    // would surface the difference.
    assert.noMatch(sw, /const\s+CONTENT_JS\s*=\s*\[/,
      "service worker must not restate the content script list; derive it from the manifest");
    assert.noMatch(sw, /const\s+FRAME_JS\s*=\s*\[/,
      "service worker must not restate the frame script list; derive it from the manifest");
    assert.match(sw, /getManifest\(\)\.content_scripts/,
      "service worker should read content_scripts from the manifest");
  },

  "the service worker's derived lists resolve to the manifest's"() {
    // Execute the real derivation against the real manifest.
    const sb = createSandbox();
    sb.chrome.runtime.getManifest = () => mv3;
    sb.chrome.scripting = { getRegisteredContentScripts: () => Promise.resolve([]), registerContentScripts: () => Promise.resolve(), unregisterContentScripts: () => Promise.resolve() };
    sb.chrome.permissions = { getAll: () => Promise.resolve({ origins: [] }), onAdded: { addListener() {} }, onRemoved: { addListener() {} } };
    sb.chrome.runtime.onInstalled = { addListener() {} };
    sb.chrome.runtime.onStartup = { addListener() {} };
    sb.chrome.contextMenus = { create() {}, onClicked: { addListener() {} } };
    require("vm").runInContext(sw + "\n;globalThis.__manifestScripts = manifestScripts;", sb, { filename: "service-worker.js" });
    assert.deepEqual(sb.__manifestScripts(false), scriptsOf(mv3, false));
    assert.deepEqual(sb.__manifestScripts(true), scriptsOf(mv3, true));
  },

  "the toolbar badge is scoped to the sending tab"() {
    // A global badge is overwritten by whichever Canvas tab scanned last, so the
    // count shown belongs to a different tab than the one in front of the user.
    assert.match(sw, /sender\s*&&\s*sender\.tab\s*&&\s*sender\.tab\.id/,
      "bc:setBadge must scope setBadgeText to sender.tab.id");
  },

  "declared permissions are all actually used"() {
    const used = usedNamespaces();
    // storage/scripting are used via chrome.storage.* and chrome.scripting.*.
    for (const p of mv3.permissions) {
      assert.ok(used.has(p), `permission "${p}" is declared but chrome.${p}.* is never called`);
    }
  },

  "every chrome namespace used is covered by a permission or is always available"() {
    // runtime, tabs (for sendMessage to our own content scripts), permissions and
    // action need no separate permission entry under MV3.
    const alwaysAvailable = new Set(["runtime", "permissions", "action", "tabs", "storage"]);
    for (const ns of usedNamespaces()) {
      assert.ok(mv3.permissions.includes(ns) || alwaysAvailable.has(ns),
        `chrome.${ns}.* is called but no permission declares it`);
    }
  },

  "the top-frame bundle loads dependencies before dependents"() {
    const js = scriptsOf(mv3, false);
    const idx = (f) => js.indexOf(f);
    const before = (a, b) => assert.ok(idx(a) > -1 && idx(b) > -1 && idx(a) < idx(b), `${a} must load before ${b}`);
    before("src/shared/defaults.js", "src/content/core/storage.js");
    before("src/content/core/util.js", "src/content/core/lifecycle.js");
    before("src/content/core/color.js", "src/shared/tokens.js");
    before("src/shared/tokens.js", "src/content/features/theming.js");
    before("src/content/core/lifecycle.js", "src/content/features/theming.js");
    before("src/content/core/injector.js", "src/content/features/theming.js");
    before("src/content/core/ui.js", "src/content/features/dashboard.js");
    // The entry point must come last so every feature has registered.
    assert.equal(js[js.length - 1], "src/content/content.js");
  },

  "the settings panel registers last so teardown can skip it"() {
    const js = scriptsOf(mv3, false);
    const features = js.filter((f) => f.startsWith("src/content/features/"));
    assert.equal(features[features.length - 1], "src/content/features/settings-panel.js");
  },

  "the options page loads the same shared modules the content bundle does"() {
    const html = fs.readFileSync(path.join(ROOT, "src/options/options.html"), "utf8");
    const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    for (const s of srcs) {
      assert.ok(fs.existsSync(path.join(ROOT, "src/options", s)), `options.html references missing ${s}`);
    }
    for (const need of ["../shared/defaults.js", "../shared/tokens.js", "../shared/settings/index.js"]) {
      assert.ok(srcs.includes(need), `options.html must load ${need}`);
    }
  },

  "the popup loads the shared modules it depends on"() {
    const html = fs.readFileSync(path.join(ROOT, "src/popup/popup.html"), "utf8");
    const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    for (const s of srcs) {
      assert.ok(fs.existsSync(path.join(ROOT, "src/popup", s)), `popup.html references missing ${s}`);
    }
    // popup.js calls BC.tokens.staticCss() and BC.isDarkActive().
    for (const need of ["../shared/defaults.js", "../shared/themes.js", "../shared/tokens.js"]) {
      assert.ok(srcs.includes(need), `popup.html must load ${need}`);
    }
  },

  "every surface that resolves dark mode can evaluate a schedule"() {
    // isDarkActive() falls back to false without BC.dt, so a surface missing
    // datetime.js renders light during a scheduled dark window with no error.
    for (const [page, dir] of [["src/popup/popup.html", "src/popup"],
                               ["src/options/options.html", "src/options"]]) {
      const html = fs.readFileSync(path.join(ROOT, page), "utf8");
      const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
      assert.ok(srcs.some((s) => s.endsWith("core/datetime.js")),
        `${page} resolves dark mode but never loads datetime.js`);
      assert.ok(srcs.some((s) => s.endsWith("shared/themes.js")), `${page} must load themes.js`);
    }
    // And the content bundle, which is where scheduled mode is re-evaluated.
    const js = scriptsOf(mv3, false);
    assert.ok(js.includes("src/content/core/datetime.js"));
    assert.ok(js.indexOf("src/content/core/datetime.js") < js.indexOf("src/shared/themes.js")
              || js.includes("src/shared/themes.js"),
      "themes.js and datetime.js must both be present in the bundle");
  },

  "host permissions are scoped, with wide access left optional"() {
    assert.deepEqual(mv3.host_permissions, ["*://*.instructure.com/*"]);
    assert.deepEqual(mv3.optional_host_permissions, ["*://*/*"],
      "broad access must stay optional so install shows no all-sites warning");
  },
};
