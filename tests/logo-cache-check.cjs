/* Local synthetic pages only. Needs Playwright Chromium.
 * Canvas draws the school logo as a plain background, so Chromium caches it, and S3
 * sends its CORS header only to requests with an Origin. A CORS read of that URL then
 * gets the cached copy and fails. The scene logo tint must still see the logo. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."), PORT = 8077, LOGO = `http://localhost:${PORT}/logo.png`;
const shared = ["src/shared/defaults.js", "src/content/core/util.js", "src/shared/themes.js", "src/shared/theme-library.js", "src/shared/theme-scenes.js", "src/shared/theme-media.js"];
const origins = [];
let logo;
const server = http.createServer((req, res) => {
  if (req.url === "/logo.png") {
    origins.push(req.headers.origin || "none");
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "max-age=473354280, public",
      ...(req.headers.origin && { "Access-Control-Allow-Origin": "*", Vary: "Origin" }) });
    return res.end(logo);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><style>:root { --ic-brand-header-image: url('${LOGO}'); }
    .ic-app-header__logomark { display: block; width: 84px; height: 85px; background: var(--ic-brand-header-image) center / contain no-repeat; }</style>
    <div class="ic-app-header__logomark-container"><a class="ic-app-header__logomark" href="#"></a></div>`);
});

(async () => {
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(PORT, "0.0.0.0", resolve); });
    browser = await chromium.launch({ executablePath: chromium.executablePath() });
    const page = await browser.newPage();
    await page.setContent('<b style="font: 900 60px serif; color: #fff">N</b>');
    logo = await page.locator("b").screenshot({ omitBackground: true });
    // The load event waits for the background, so the plain copy is cached after this.
    await page.goto(`http://127.0.0.1:${PORT}/`);
    for (const f of shared) await page.addScriptTag({ content: fs.readFileSync(path.join(root, f), "utf8") });
    await page.evaluate(() => {
      BC.injector = { setStyle() {}, removeNode() {}, ensureNode(id, host, factory) { return factory(); } };
      BC.registry = { register(feature) { BC.feature = feature; } };
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, "src/content/features/cosmetics.js"), "utf8") });
    await page.evaluate(() => {
      const s = BC.cloneDefaults();
      BC.applyTheme(s, BC.PRESET_THEMES.find((p) => p.id === "scene-nebula"));
      BC.requestApply = () => BC.feature.apply(s);
      BC.feature.apply(s);
    });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-bc-logo-tint"), null, { timeout: 5000 });
    assert.deepEqual(origins, ["none", `http://127.0.0.1:${PORT}`], "one plain load by the page, then one fresh CORS read");
    console.log(JSON.stringify({ browser: browser.version(), checks: ["A scene theme tints a cross-origin logo the page already cached"] }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
