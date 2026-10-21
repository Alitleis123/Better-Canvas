/* Local synthetic pages only. Runs the built Firefox package in a real Firefox through geckodriver.
 * Set BC_FIREFOX (firefox.exe), BC_GECKODRIVER (geckodriver.exe) and BC_BROWSER_SCRATCH, then build first. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { server } = require("./studio-fixture.cjs");
const root = path.resolve(__dirname, ".."), scratch = process.env.BC_BROWSER_SCRATCH;
const binary = process.env.BC_FIREFOX, driverPath = process.env.BC_GECKODRIVER;
if (!scratch || !binary || !driverPath) throw Error("Set BC_FIREFOX, BC_GECKODRIVER and BC_BROWSER_SCRATCH");
const SITE = "http://bc-test.instructure.com:8076";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const results = { checks: [], errors: [] };
  let driver, session, ws;
  const http = async (method, url, body) => {
    const res = await fetch("http://127.0.0.1:4447" + url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    const json = await res.json();
    if (json.value && json.value.error) throw Error(json.value.error + ": " + json.value.message);
    return json.value;
  };
  try {
    fs.mkdirSync(scratch, { recursive: true });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(8076, "0.0.0.0", resolve); });
    driver = spawn(driverPath, ["--port", "4447", "--host", "127.0.0.1"], { stdio: "ignore" });
    for (let i = 0; i < 50; i++) { try { await http("GET", "/status"); break; } catch { await sleep(100); } }
    const created = await http("POST", "/session", { capabilities: { alwaysMatch: { browserName: "firefox", webSocketUrl: true,
      "moz:firefoxOptions": { binary, args: ["-headless"], prefs: {
        // Every host name resolves to this machine, so the browser can't reach anything else.
        "network.dns.forceResolve": "127.0.0.1", "network.proxy.type": 0,
      } } } } });
    session = created.sessionId;
    const version = created.capabilities.browserVersion;
    ws = new WebSocket(created.capabilities.webSocketUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let nextId = 1; const pending = new Map();
    ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.type === "error" ? reject(Error(msg.error + ": " + msg.message)) : resolve(msg.result); return; }
      if (msg.method === "log.entryAdded" && (msg.params.level === "error" || msg.params.type === "javascript")) {
        results.errors.push((msg.params.source?.context ? "" : "[no context] ") + msg.params.text);
      }
    };
    const bidi = (method, params) => new Promise((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    await bidi("session.subscribe", { events: ["log.entryAdded"] });
    const [{ context }] = (await bidi("browsingContext.getTree", {})).contexts;
    // Classic navigation: BiDi refuses moz-extension pages.
    const go = (url) => http("POST", "/session/" + session + "/url", { url });
    // Runs in the page, or with the extension's APIs on its own pages; the function's result comes back as JSON.
    const run = async (fn, ...args) => {
      const r = await bidi("script.evaluate", { expression: "(async () => JSON.stringify(await (" + fn + ")(..." + JSON.stringify(args) + ")))()", target: { context }, awaitPromise: true });
      if (r.type === "exception") throw Error(r.exceptionDetails.text);
      return r.result.value === undefined ? undefined : JSON.parse(r.result.value);
    };
    const until = async (fn, label, ...args) => { for (let i = 0; i < 60; i++) { if (await run(fn, ...args).catch(() => false)) return; await sleep(100); } throw Error(label); };
    const check = (label) => results.checks.push(label);

    await http("POST", "/session/" + session + "/moz/addon/install", { path: path.join(root, "dist", "firefox"), temporary: true });
    check("Firefox " + version + " installs the built package as a temporary add-on");

    // Firefox won't let WebDriver open extension pages, so everything below goes
    // through the Canvas page and the settings drawer, as a user would.
    await go(SITE + "/firefox-check");
    await until(() => !!document.querySelector("style[data-better-canvas]") && !!document.getElementById("bc-open-settings"), "Content scripts did not start");
    check("Content scripts run on a Canvas page and add the settings menu item");
    // Proves the console listener works, so an empty error list means something.
    await run(() => { setTimeout(() => { throw Error("firefox-check probe"); }); });
    await sleep(300);
    assert.ok(results.errors.some((e) => e.includes("firefox-check probe")), "Console errors are not being captured");
    results.errors = results.errors.filter((e) => !e.includes("firefox-check probe"));
    assert.equal(await run(() => !!document.querySelector("#bc-drawer")), false);
    await run(() => document.getElementById("bc-open-settings").click());
    await until(() => !!document.querySelector("#bc-drawer")?.shadowRoot?.querySelector(".bcs-app, .bc-app"), "Settings workspace did not load");
    check("Opening settings has the background inject the workspace, then shows it");
    const drawer = "document.querySelector('#bc-drawer').shadowRoot";
    await run((drawer) => {
      const root = eval(drawer);
      root.querySelector('.bcs-subnav [data-tab="themes"]').click();
    }, drawer);
    await until((drawer) => !!eval(drawer).querySelector('[aria-label="Preview theme Rainy After Hours"]'), "Theme gallery missing", drawer);
    const mirror = drawer + ".querySelector('.bcs-mirror iframe.is-front')";
    await until((mirror) => { const d = eval(mirror)?.contentDocument; return d?.querySelector("#content")?.textContent === "Local synthetic Canvas page" && !d.querySelector("script, [data-bc-node=bc-drawer]"); }, "The settings preview did not copy the page", mirror);
    await run((drawer) => eval(drawer).querySelector('[aria-label="Preview theme Rainy After Hours"]').click(), drawer);
    await until((mirror) => { const d = eval(mirror)?.contentDocument, layer = d?.querySelector("#bc-bg-layer"); return !!layer && d.defaultView.getComputedStyle(layer).backgroundImage.includes("anime-night-wallpaper.webp"); }, "The settings preview did not show the theme being tried", mirror);
    check("The settings preview is a copy of the page and shows a theme before it's applied");
    await run((drawer) => [...eval(drawer).querySelectorAll("button")].find((b) => b.textContent.trim() === "Apply theme").click(), drawer);
    const wallpaper = () => (getComputedStyle(document.querySelector("#bc-bg-layer") || document.body).backgroundImage || "").includes("anime-night-wallpaper.webp");
    await until(wallpaper, "Applied theme did not paint its wallpaper");
    await sleep(800);
    await go(SITE + "/firefox-check");
    await until(() => document.documentElement.classList.contains("bc-dark"), "Dark mode did not survive a reload");
    await until(wallpaper, "Wallpaper did not survive a reload");
    check("Applying a theme saves through the background and survives a reload in dark mode");
    await until(() => document.documentElement.hasAttribute("data-bc-logo-tint"), "The scene theme did not tint the cross-origin school logo");
    check("A scene theme tints a cross-origin SVG school logo from a server that sends CORS headers only when asked");
    const sizes = await run(() => Promise.all(["", "-wallpaper"].map((suffix) => new Promise((resolve) => {
      const url = /url\("([^"]+)"\)/.exec(getComputedStyle(document.querySelector("#bc-bg-layer")).backgroundImage)[1].replace("-wallpaper", suffix);
      const img = new Image(); img.onload = () => resolve([img.naturalWidth, img.naturalHeight]); img.onerror = () => resolve(null); img.src = url;
    }))));
    assert.deepEqual(sizes, [[1086, 1448], [1536, 1024]]); check("The WebP atlas and wallpaper load from the page as web-accessible resources");

    await go(SITE + "/courses/1/quizzes/2/take");
    await until(() => !!document.querySelector("#answer"), "Quiz page missing");
    await run(() => { const a = document.querySelector("#answer"); a.value = "attempt two"; a.dispatchEvent(new Event("input", { bubbles: true })); });
    await sleep(1500);
    await go(SITE + "/courses/1/quizzes/2/take");
    await until(() => !!document.querySelector(".bc-quiz-banner"), "Saved answer was not offered after a reload");
    check("A quiz answer saves and is offered back after a reload");
    await run(() => { document.getElementById("submit_quiz_form").addEventListener("submit", (e) => e.preventDefault(), { once: true }); document.getElementById("submit_quiz_button").click(); });
    await sleep(600);
    await go(SITE + "/courses/1/quizzes/2/take");
    await until(() => !!document.querySelector(".bc-quiz-banner"), "A cancelled submit lost the draft");
    check("A cancelled submit keeps the draft");
    await run(() => document.getElementById("submit_quiz_button").click());
    await until(() => location.pathname === "/courses/1/quizzes/2/history" && document.readyState === "complete", "Submit did not navigate");
    await sleep(500);
    await go(SITE + "/courses/1/quizzes/2/take");
    await until(() => !!document.querySelector("#answer"), "Quiz page missing");
    await sleep(1000);
    assert.equal(await run(() => !!document.querySelector(".bc-quiz-banner")), false);
    check("A real submit clears the draft across the navigation");

    fs.writeFileSync(path.join(scratch, "firefox-results.json"), JSON.stringify({ browser: version, ...results }, null, 2) + "\n");
    console.log(JSON.stringify({ browser: version, ...results }, null, 2));
    assert.deepEqual(results.errors, []);
  } finally {
    if (ws) ws.close();
    if (session) await http("DELETE", "/session/" + session).catch(() => {});
    if (driver) driver.kill();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
