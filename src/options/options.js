/*
 * Better Canvas — standalone options page.
 * Adapter reads from chrome.storage; delegates course/GPA lookups to any open
 * Canvas tab (so we can piggy-back the user's session).
 */
(function () {
  "use strict";
  const BC = globalThis.BC;

  function sendToTab(id, msg) {
    return new Promise((res) => chrome.tabs.sendMessage(id, msg, (r) => res(chrome.runtime.lastError ? null : r)));
  }
  // Memoized for 30s. This does a permissions.getAll() plus one tabs.query() per
  // origin pattern plus a bc:ping round-trip to every match — it was running that
  // whole storm on every getCourses/getGpaData call, i.e. once per control render.
  let tabP = null, tabAt = 0;
  function findCanvasTab() {
    if (tabP && Date.now() - tabAt < 30000) return tabP;
    tabAt = Date.now();
    tabP = (async () => {
      const perms = await chrome.permissions.getAll();
      const patterns = new Set(["*://*.instructure.com/*", ...(perms.origins || []).filter((p) => p !== "https://api.openverse.org/*")]);
      let tabs = [];
      for (const p of patterns) { try { tabs = tabs.concat(await chrome.tabs.query({ url: p })); } catch (_) {} }
      const seen = new Set();
      tabs = tabs.filter((t) => t.id != null && !seen.has(t.id) && seen.add(t.id));
      for (const t of tabs) { const r = await sendToTab(t.id, { type: "bc:ping" }); if (r && r.canvas) return t; }
      return null;
    })().catch(() => null);
    return tabP;
  }
  async function fromTab(type) {
    const tab = await findCanvasTab();
    if (!tab) throw new Error("no Canvas tab");
    const resp = await sendToTab(tab.id, { type });
    if (!resp || !resp.ok) throw new Error("request failed");
    return resp.courses;
  }

  // The options page is its own document, so nothing emits design tokens into it.
  // Without this it would ignore the user's theme entirely — which is exactly what
  // it did before.
  function paintTokens(settings) {
    if (!BC.tokens) return;
    let tag = document.getElementById("bc-token-style");
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "bc-token-style";
      document.head.appendChild(tag);
    }
    const css = BC.tokens.staticCss() + "\n" + BC.tokens.css(settings.theming);
    if (tag.textContent !== css) tag.textContent = css;
    const dark = BC.isDarkActive ? BC.isDarkActive(settings) : false;
    const root = document.documentElement;
    if (root.classList.contains("bc-dark") !== dark) root.classList.toggle("bc-dark", dark);
  }

  let current = BC.cloneDefaults();
  const adapter = {
    getState() { return current; },
    save(s, options) { return BC.storage.save(s, undefined, options).then((saved) => { current = saved; return saved; }); },
    preview(s) { paintTokens(s); },
    subscribe(cb) { return BC.storage.subscribe((s) => { current = s; cb(s); }); },
    getLocal() { return BC.storage.loadLocal(); },
    saveLocal(obj) { return BC.storage.saveLocal(obj); },
    updateLocal(mutator) { return BC.storage.updateLocal(mutator); },
    getCourses() { return fromTab("bc:getCourses"); },
    getGpaData() { return fromTab("bc:gpaData"); },
  };

  BC.storage.load().then((settings) => {
    current = settings;
    paintTokens(current);
    BC.SettingsUI.render(document.getElementById("bc-settings-root"), adapter, { variant: "page" });
  }).catch((error) => {
    const root = document.getElementById("bc-settings-root");
    root.setAttribute("role", "alert");
    root.textContent = "Could not load or migrate settings: " + error.message + ". Reopen this page to retry.";
  });
})();
