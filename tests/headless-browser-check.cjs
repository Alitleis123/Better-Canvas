/* Local synthetic pages only. Requires a built unpacked extension and Playwright Chromium. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { server } = require("./studio-fixture.cjs");
const root = path.resolve(__dirname, ".."), scratch = process.env.BC_BROWSER_SCRATCH;
if (!scratch) throw Error("Set BC_BROWSER_SCRATCH to an approved temporary directory");

(async () => {
  let browser;
  const results = { extension: [], studio: [], errors: [] };
  try {
    fs.mkdirSync(scratch, { recursive: true });
    const profile = fs.mkdtempSync(path.join(scratch, "browser-profile-"));
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(8076, "0.0.0.0", resolve); });
    const extension = path.join(root, "dist", "chrome");
    const manifest = JSON.parse(fs.readFileSync(path.join(extension, "manifest.json"), "utf8"));
    browser = await chromium.launchPersistentContext(profile, {
      executablePath: chromium.executablePath(), headless: true,
      viewport: { width: 1440, height: 900 }, ignoreDefaultArgs: ["--disable-extensions"],
      args: ["--disable-extensions-except=" + extension, "--load-extension=" + extension,
        "--host-resolver-rules=MAP bc-test.instructure.com 127.0.0.1", "--no-proxy-server"],
    });
    await browser.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (["127.0.0.1", "bc-test.instructure.com"].includes(url.hostname) || url.protocol === "chrome-extension:") return route.continue();
      return route.abort("blockedbyclient");
    });
    const worker = browser.serviceWorkers()[0] || await browser.waitForEvent("serviceworker", { timeout: 15000 });
    await worker.evaluate(() => chrome.storage.local.set({ bcSettings: { version: 5, enabled: false } }));
    const page = await browser.newPage();
    page.on("pageerror", (error) => results.errors.push(error.message));
    await page.goto("http://bc-test.instructure.com:8076/extension-check");
    const inspect = () => worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "http://bc-test.instructure.com:8076/*" });
      const [value] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({
        count: BC.PRESET_THEMES.length, anime: BC.PRESET_THEMES.filter((p) => p.category === "anime").length,
        version: BC.VERSION, top: window.top === window,
      }) });
      return { ...value.result, buildVersion: chrome.runtime.getManifest().version };
    });
    const first = await inspect();
    for (const [key, value] of Object.entries({ count: 34, anime: 6, version: "3.3.1", top: true, buildVersion: "3.3.1" })) {
      assert.equal(first[key], value); results.extension.push(key + " = " + value);
    }
    await worker.evaluate(async (files) => {
      const [tab] = await chrome.tabs.query({ url: "http://bc-test.instructure.com:8076/*" });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
    }, manifest.content_scripts.find((s) => s.all_frames).js);
    assert.deepEqual(await inspect(), first); results.extension.push("Repeated all-frames bundle preserves top-page state");
    await page.goto("http://127.0.0.1:8076/");
    await page.waitForFunction(() => document.querySelector("#bc-drawer")?.shadowRoot?.querySelector(".bcs-app, .bc-app"));
    results.studio = await page.evaluate(fs.readFileSync(path.join(__dirname, "studio-browser-checks.js"), "utf8"));
    assert.equal(results.errors.length, 0);
    await page.evaluate(async () => {
      await Promise.all(document.getElementById("bc-drawer").getAnimations().map((animation) => animation.finished));
    });
    await page.screenshot({ path: path.join(scratch, "studio-3.3.1.png") });
    const report = { browser: browser.browser().version(), profile, ...results };
    fs.writeFileSync(path.join(scratch, "headless-results.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
