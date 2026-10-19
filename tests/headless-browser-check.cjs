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
    const secondPage = await browser.newPage();
    await secondPage.goto("http://bc-test.instructure.com:8076/extension-check?second=1");
    const storageChecks = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: "http://bc-test.instructure.com:8076/*" });
      if (tabs.length !== 2) throw Error("Expected two independent extension contexts");
      await Promise.all(tabs.map((tab, index) => chrome.scripting.executeScript({ target: { tabId: tab.id },
        func: async (id) => { await BC.storage.load(); await BC.storage.updateLocal((d) => { (d.notes.extensionCheck ||= {})[id] = "saved"; }); }, args: [String(index)] })));
      const { bcLocal } = await chrome.storage.local.get(["bcLocal"]);
      if (bcLocal.notes.extensionCheck[0] !== "saved" || bcLocal.notes.extensionCheck[1] !== "saved") throw Error("Concurrent tab edits were lost");
      const [stale] = await chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, func: async () => {
        const snapshot = await BC.storage.request({ type: "bc:localRead" });
        await BC.storage.updateLocal((d) => { d.notes.newer = true; });
        return BC.storage.request({ type: "bc:localCommit", base: snapshot.base, value: snapshot.values.bcLocal });
      } });
      if (!stale.result.conflict) throw Error("Stale background commit was accepted");
      await chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, func: async () => BC.Locker.create({ id: "browser-check", type: "note", title: "Original" }) });
      await chrome.scripting.executeScript({ target: { tabId: tabs[1].id }, func: async () => BC.Locker.remove("browser-check") });
      const [deleted] = await chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, func: async () => {
        try { await BC.Locker.save({ id: "browser-check", type: "note", title: "Stale" }); return false; }
        catch (error) { return error.message.includes("deleted in another window"); }
      } });
      if (!deleted.result || (await chrome.storage.local.get(["bcLocker:item:browser-check"]))["bcLocker:item:browser-check"]) throw Error("Locker delete was undone");
      return ["Concurrent extension tab edits survive", "Raw bcLocal contains current downgrade-compatible data",
        "Background rejects stale content hashes", "Deleted locker item rejects a stale cross-context save"];
    });
    results.extension.push(...storageChecks);
    await secondPage.close();
    // A real submit navigates at once. The drafts must still be cleared, and a
    // cancelled submit must keep them.
    const drafts = () => worker.evaluate(async () => Object.keys((await chrome.storage.local.get(["bcLocal"])).bcLocal.quizDrafts || {}).sort());
    const until = async (check, label) => {
      for (let i = 0; i < 50; i++) { if (check(await drafts())) return; await new Promise((r) => setTimeout(r, 100)); }
      throw Error(label + ": " + (await drafts()).join(", "));
    };
    await worker.evaluate(async (old) => {
      const { bcLocal } = await chrome.storage.local.get(["bcLocal"]);
      bcLocal.quizDrafts = { "/courses/1/quizzes/2/take#attempt-1": old, "/courses/1/quizzes/9/take": old };
      await chrome.storage.local.set({ bcLocal, bcSettings: { version: 5, enabled: true, onboarding: { seen: true }, productivity: { quizDraftSaver: true } } });
    }, { savedAt: Date.now(), answers: { answer: "attempt one" } });
    await page.goto("http://bc-test.instructure.com:8076/courses/1/quizzes/2/take");
    await page.fill("#answer", "attempt two");
    await until((keys) => keys.includes("/courses/1/quizzes/2/take#attempt-2"), "The answer was never saved");
    await page.evaluate(() => document.getElementById("submit_quiz_form").addEventListener("submit", (e) => e.preventDefault(), { once: true }));
    await page.click("#submit_quiz_button");
    await new Promise((r) => setTimeout(r, 500));
    assert.equal((await drafts()).length, 3); results.extension.push("A cancelled quiz submit keeps the drafts");
    await Promise.all([page.waitForURL("**/quizzes/2/history"), page.click("#submit_quiz_button")]);
    await until((keys) => keys.join() === "/courses/1/quizzes/9/take", "Drafts survived a real submit");
    results.extension.push("A real quiz submit clears that quiz's drafts across the navigation");
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
