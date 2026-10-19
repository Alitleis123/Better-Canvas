const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { root, load, domContext, settingsUIFiles } = require("./audit-helpers.cjs");

for (const filename of ["manifest.json", "manifest.firefox.json"]) {
  test(filename + " preserves all themes and shared state after the frame bundle", () => {
    const { dom, context } = domContext("", { chrome: {
      runtime: { id: "test", onMessage: { addListener() {} }, getURL: (s) => s },
      storage: { local: { get() {} }, onChanged: { addListener() {} } },
    } });
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, filename)));
      const [main, frames] = manifest.content_scripts;
      load(context, ...main.js);
      assert.equal(context.BC.PRESET_THEMES.length, 30, "photo presets load with the settings workspace");
      load(context, ...settingsUIFiles());
      const ids = context.BC.PRESET_THEMES.map((p) => p.id), firstAnime = context.BC.PRESET_THEMES.findIndex((p) => p.category === "anime");
      assert.deepEqual([...ids.slice(firstAnime - 4, firstAnime)], ["photos-nature", "photos-space", "photos-city", "photos-art"], "photo presets keep their place in front of the anime ones");
      const before = { ...context.BC };
      load(context, ...frames.js);
      assert.equal(context.BC.PRESET_THEMES.length, 34);
      assert.equal(context.BC.PRESET_THEMES.filter((p) => p.category === "anime").length, 6);
      for (const key of Object.keys(before)) assert.equal(context.BC[key], before[key], key);
      load(context, ...frames.js);
      for (const key of Object.keys(before)) assert.equal(context.BC[key], before[key], key);
      assert.equal(dom.window.document.querySelector("#bc-frame-style"), null);
    } finally { dom.window.close(); }
  });
}
