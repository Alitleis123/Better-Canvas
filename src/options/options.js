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
  async function findCanvasTab() {
    const perms = await chrome.permissions.getAll();
    const patterns = new Set(["*://*.instructure.com/*", ...(perms.origins || [])]);
    let tabs = [];
    for (const p of patterns) { try { tabs = tabs.concat(await chrome.tabs.query({ url: p })); } catch (_) {} }
    const seen = new Set();
    tabs = tabs.filter((t) => t.id != null && !seen.has(t.id) && seen.add(t.id));
    for (const t of tabs) { const r = await sendToTab(t.id, { type: "bc:ping" }); if (r && r.canvas) return t; }
    return null;
  }
  async function fromTab(type) {
    const tab = await findCanvasTab();
    if (!tab) throw new Error("no Canvas tab");
    const resp = await sendToTab(tab.id, { type });
    if (!resp || !resp.ok) throw new Error("request failed");
    return resp.courses;
  }

  let current = BC.cloneDefaults();
  const adapter = {
    getState() { return current; },
    save(s) { current = s; return new Promise((res) => chrome.storage.local.set({ [KEY]: s }, res)); },
    subscribe(cb) {
      const handler = (changes, area) => {
        if (area === "local" && changes[KEY]) { current = BC.mergeDefaults(changes[KEY].newValue); cb(current); }
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    },
    getCourses() { return fromTab("bc:getCourses"); },
    getGpaData() { return fromTab("bc:gpaData"); },
  };

  chrome.storage.local.get(KEY, (r) => {
    current = BC.mergeDefaults(r[KEY]);
    BC.SettingsUI.render(document.getElementById("bc-settings-root"), adapter);
  });
})();
