/* Opt-in check against real Canvas pages that open without a login. Read-only: it only loads the pages.
 * Set BC_CANVAS_PAGES to comma-separated *.instructure.com URLs, and BC_BROWSER_SCRATCH. Build first. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."), scratch = process.env.BC_BROWSER_SCRATCH;
const pages = (process.env.BC_CANVAS_PAGES || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!scratch || !pages.length) throw Error("Set BC_CANVAS_PAGES and BC_BROWSER_SCRATCH");
for (const url of pages) if (!/^https:\/\/[a-z0-9-]+\.instructure\.com\//.test(url)) throw Error("Not an instructure.com page: " + url);

// Visible text against the background it actually sits on, alpha included.
// Text over images is skipped because its background can't be read.
function contrastAudit() {
  const parse = (c) => {
    let m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(c);
    return m ? { r: m[1] * 255, g: m[2] * 255, b: m[3] * 255, a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = (c) => [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const background = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== "none" && !/gradient/.test(s.backgroundImage)) return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    return layers.reduceRight((under, top) => blend(top, under), { r: 255, g: 255, b: 255, a: 1 });
  };
  let total = 0; const fails = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("svg, script, style, noscript, [aria-hidden=true]")) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (!r.width || !r.height || s.visibility === "hidden" || +s.opacity === 0 || r.bottom < 0 || r.top > innerHeight * 3) continue;
    const bg = background(el), fg = parse(s.color);
    if (!bg || !fg) continue;
    const text = blend(fg, bg), [hi, lo] = [lum(text), lum(bg)].sort((a, b) => b - a), ratio = (hi + 0.05) / (lo + 0.05);
    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700);
    total++;
    if (ratio < (large ? 3 : 4.5)) fails.push({ ratio: +ratio.toFixed(2), text: el.textContent.trim().slice(0, 40), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""), color: s.color, bg: `rgb(${bg.r | 0}, ${bg.g | 0}, ${bg.b | 0})` });
  }
  fails.sort((a, b) => a.ratio - b.ratio);
  // Controls that only show on focus or inside dialogs, measured on their own fill.
  const controls = [];
  for (const el of document.querySelectorAll("#skip_navigation_link, .btn-primary, .Button--primary")) {
    const s = getComputedStyle(el), bg = parse(s.backgroundColor), fg = parse(s.color);
    if (!bg || bg.a < 1 || !fg) continue;
    const [hi, lo] = [lum(blend(fg, bg)), lum(bg)].sort((a, b) => b - a);
    controls.push({ ratio: +((hi + 0.05) / (lo + 0.05)).toFixed(2), text: el.textContent.trim().slice(0, 30), color: s.color, bg: s.backgroundColor });
  }
  return { total, failing: fails.length, worst: fails.slice(0, 8), controls };
}

(async () => {
  let browser;
  const report = { pages: [] };
  try {
    fs.mkdirSync(scratch, { recursive: true });
    const profile = fs.mkdtempSync(path.join(scratch, "real-canvas-profile-"));
    const extension = path.join(root, "dist", "chrome");
    browser = await chromium.launchPersistentContext(profile, {
      executablePath: chromium.executablePath(), headless: true, viewport: { width: 1366, height: 900 },
      ignoreDefaultArgs: ["--disable-extensions"], args: ["--disable-extensions-except=" + extension, "--load-extension=" + extension],
    });
    const worker = browser.serviceWorkers()[0] || await browser.waitForEvent("serviceworker", { timeout: 15000 });
    report.browser = browser.browser()?.version() || "chromium";
    for (const [index, url] of pages.entries()) {
      const entry = { url };
      for (const mode of ["off", "on"]) {
        // Dark mode also gets a light custom accent: the hard case for text on accent fills.
        await worker.evaluate((darkMode) => chrome.storage.local.set({ bcSettings: { version: 5, enabled: true, onboarding: { seen: true },
          theming: darkMode === "on" ? { darkMode, accentColor: "#a5b4fc" } : { darkMode } } }), mode);
        const page = await browser.newPage(), errors = [];
        // Uncaught errors from every world, including the extension's content scripts.
        const cdp = await browser.newCDPSession(page);
        await cdp.send("Runtime.enable");
        cdp.on("Runtime.exceptionThrown", ({ exceptionDetails: d }) => errors.push({ ext: /chrome-extension:/.test(JSON.stringify(d)), text: (d.exception?.description || d.text || "").split("\n")[0] }));
        cdp.on("Runtime.consoleAPICalled", (e) => { if (e.type === "error") errors.push({ ext: /chrome-extension:/.test(JSON.stringify(e.stackTrace || {})), text: e.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200) }); });
        await page.goto(url, { waitUntil: "load", timeout: 60000 });
        await page.waitForTimeout(5000);
        const [state] = await worker.evaluate(async (pageUrl) => {
          const [tab] = await chrome.tabs.query({ url: pageUrl.split("#")[0] });
          return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({
            running: !!BC.storage?.current, diag: BC.diag.entries.map((e) => e.source + ": " + e.error),
            nodes: [...new Set([...document.querySelectorAll("[data-bc-node]")].map((n) => n.dataset.bcNode))].sort(),
          }) });
        }, url);
        const audit = await page.evaluate(contrastAudit);
        await page.screenshot({ path: path.join(scratch, "real-canvas-" + index + "-" + mode + ".png") });
        entry[mode] = { ...state.result, dark: await page.evaluate(() => document.documentElement.classList.contains("bc-dark")), contrast: audit,
          extensionErrors: errors.filter((e) => e.ext).map((e) => e.text), pageErrors: errors.filter((e) => !e.ext).length };
        await page.close();
      }
      report.pages.push(entry);
    }
    fs.writeFileSync(path.join(scratch, "real-canvas-results.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
    for (const p of report.pages) for (const mode of ["off", "on"]) {
      assert.ok(p[mode].running, p.url + " did not run the extension");
      assert.deepEqual(p[mode].extensionErrors, [], p.url);
      // Signed-out visitors get 401s from the API; anything else, or a repeat, is a bug.
      const diag = p[mode].diag.filter((d) => !/Canvas API 401/.test(d));
      assert.deepEqual(diag, [], p.url);
      assert.equal(new Set(p[mode].diag).size, p[mode].diag.length, p.url + " repeated a failing request");
      assert.equal(p[mode].dark, mode === "on", p.url);
      for (const c of p[mode].contrast.controls) assert.ok(c.ratio >= 4.5, p.url + " " + mode + ": " + JSON.stringify(c));
    }
  } finally {
    if (browser) await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
