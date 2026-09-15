/*
 * Better Canvas — standalone options page.
 * Adapter reads from chrome.storage; delegates course/GPA lookups to any open
 * Canvas tab (so we can piggy-back the user's session).
 */
(function () {
  "use strict";
  const BC = globalThis.BC;
  const KEY = BC.SETTINGS_KEY;

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
      const patterns = new Set(["*://*.instructure.com/*", ...(perms.origins || [])]);
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
    BC.tokens.applyRootAttrs(document.documentElement, settings.theming);
  }

  let current = BC.cloneDefaults();
  const adapter = {
    getState() { return current; },
    save(s) { current = s; return new Promise((res) => chrome.storage.local.set({ [KEY]: s }, res)); },
    // No page to re-apply here, but the options page should still restyle itself
    // live as you change the theme.
    preview(s) { paintTokens(s); },
    subscribe(cb) {
      const handler = (changes, area) => {
        if (area === "local" && changes[KEY]) { current = BC.mergeDefaults(changes[KEY].newValue); cb(current); }
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    },
    // bcLocal round-trip for export/import (planner metadata lives there now).
    getLocal() {
      return new Promise((res) => chrome.storage.local.get(BC.LOCAL_KEY, (r) => res((r && r[BC.LOCAL_KEY]) || null)));
    },
    saveLocal(obj) {
      return new Promise((res) => chrome.storage.local.set({ [BC.LOCAL_KEY]: obj }, res));
    },
    getCourses() { return fromTab("bc:getCourses"); },
    getGpaData() { return fromTab("bc:gpaData"); },
  };

  // Custom Canvas domains. This moved off the popup, which no longer exists:
  // chrome.permissions.request needs a user gesture in a foreground extension
  // page, so it cannot live in the service worker, and the toolbar click now
  // lands here whenever the active tab is not a running Canvas page.
  async function showSiteNotice() {
    const box = document.getElementById("bc-site");
    if (!box) return;
    const say = (text, action) => {
      box.hidden = false;
      box.textContent = "";
      box.appendChild(Object.assign(document.createElement("span"), { textContent: text }));
      if (action) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = action.label;
        b.addEventListener("click", action.run);
        box.appendChild(b);
      }
    };
    let tab;
    try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch (_) { return; }
    if (!tab || !tab.url) return;
    let url; try { url = new URL(tab.url); } catch (_) { return; }
    if (!/^https?:$/.test(url.protocol)) return;
    if (/(^|\.)instructure\.com$/.test(url.hostname)) return;   // covered by the manifest

    const origin = url.origin + "/*";
    const has = await new Promise((res) => chrome.permissions.contains({ origins: [origin] }, res));
    if (has) {
      say("Better Canvas is enabled on " + url.hostname + ". Reload that tab to start it.", {
        label: "Reload " + url.hostname,
        run: () => chrome.tabs.reload(tab.id),
      });
      return;
    }
    say("Is " + url.hostname + " your school's Canvas? Better Canvas needs your permission to run there.", {
      label: "Enable on " + url.hostname,
      run: () => chrome.permissions.request({ origins: [origin] }, (granted) => {
        if (!granted) return;
        chrome.runtime.sendMessage({ type: "bc:syncRegistration" }, () => chrome.tabs.reload(tab.id));
      }),
    });
  }

  chrome.storage.local.get(KEY, (r) => {
    current = BC.mergeDefaults(r[KEY]);
    paintTokens(current);
    BC.SettingsUI.render(document.getElementById("bc-settings-root"), adapter);
    showSiteNotice();
  });
})();
