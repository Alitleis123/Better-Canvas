/* Better Canvas — toolbar popup. */
(function () {
  "use strict";
  const BC = globalThis.BC;
  const KEY = BC.SETTINGS_KEY;
  const $ = (id) => document.getElementById(id);

  let settings = BC.cloneDefaults();

  function load() {
    chrome.storage.local.get(KEY, (r) => { settings = BC.mergeDefaults(r[KEY]); render(); });
  }
  function save() { chrome.storage.local.set({ [KEY]: settings }); paintTokens(); }

  // The popup is its own document, so nothing emits design tokens into it. Without
  // this it ignored the user's theme completely and shipped a third hardcoded
  // colour system of its own.
  function paintTokens() {
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
    document.documentElement.classList.toggle("bc-dark", dark);
  }

  // `data-icon` keeps the markup declarative and the geometry in the shared set.
  // A row gets a tile (same one the settings panel uses); a button gets a bare
  // glyph beside its label.
  function paintIcons() {
    for (const node of document.querySelectorAll("[data-icon]")) {
      const name = node.getAttribute("data-icon");
      if (!BC.icons || !BC.icons.has(name) || node.querySelector("svg")) continue;
      const isRow = node.classList.contains("bc-row");
      const ic = document.createElement("span");
      ic.className = isRow ? "bc-pop-ic" : "bc-btn-ic";
      ic.setAttribute("aria-hidden", "true");
      ic.innerHTML = BC.icons.svg(name, { size: isRow ? 15 : 14 });
      node.insertBefore(ic, node.firstChild);
    }
  }

  // The master switch is a pill that says On or Off, matching the settings
  // header. It used to be an unlabelled 18px checkbox next to a sentence.
  function paintMaster() {
    const pill = document.querySelector(".bc-master");
    const label = $("master-label");
    if (!pill || !label) return;
    const on = $("enabled").checked;
    pill.classList.toggle("bc-on", on);
    label.textContent = on ? "On" : "Off";
  }

  function render() {
    paintTokens();
    paintIcons();
    $("enabled").checked = settings.enabled;
    $("dashEnabled").checked = settings.dashboard.enabled;
    $("darkMode").value = settings.theming.darkMode;
    $("notifsIn").checked = !!(settings.notifications && settings.notifications.inPage);
    paintMaster();
    const v = document.querySelector(".bc-ver"); if (v) v.textContent = "v" + (BC.VERSION || "");
  }

  $("enabled").addEventListener("change", (e) => { settings.enabled = e.target.checked; paintMaster(); save(); });
  $("dashEnabled").addEventListener("change", (e) => { settings.dashboard.enabled = e.target.checked; save(); });
  $("darkMode").addEventListener("change", (e) => { settings.theming.darkMode = e.target.value; save(); });
  $("notifsIn").addEventListener("change", (e) => { settings.notifications.inPage = e.target.checked; save(); });

  $("open-options").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { type: "bc:openSettings" }, (resp) => {
        if (!chrome.runtime.lastError && resp && resp.ok) window.close();
        else chrome.runtime.openOptionsPage();
      });
      return;
    }
    chrome.runtime.openOptionsPage();
  });

  $("open-palette").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { type: "bc:openPalette" }, () => window.close());
    }
  });

  async function checkSite() {
    const box = $("site-status");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) { box.textContent = "No active tab."; return; }
    let url; try { url = new URL(tab.url); } catch { box.textContent = "Not a page we can change."; return; }
    if (!/^https?:$/.test(url.protocol)) { box.textContent = "Open a Canvas page."; return; }
    const isInstructure = /(^|\.)instructure\.com$/.test(url.hostname);
    const origin = url.origin + "/*";
    chrome.tabs.sendMessage(tab.id, { type: "bc:ping" }, (resp) => {
      const active = !chrome.runtime.lastError && resp && resp.canvas;
      if (active) { box.classList.add("is-active"); box.innerHTML = BC.icons.svg("check-circle", { size: 13 }) + "<span>Running on this page</span>"; return; }
      if (isInstructure) { box.textContent = "Canvas found — reload the page."; return; }
      chrome.permissions.contains({ origins: [origin] }, (has) => {
        box.textContent = has ? "Enabled here — reload to start." : "Is this your school's Canvas?";
        const btn = document.createElement("button");
        btn.textContent = has ? "Reload page" : "Enable on " + url.hostname;
        btn.addEventListener("click", () => {
          if (has) { chrome.tabs.reload(tab.id); window.close(); return; }
          chrome.permissions.request({ origins: [origin] }, (granted) => {
            if (!granted) return;
            chrome.runtime.sendMessage({ type: "bc:syncRegistration" }, () => { chrome.tabs.reload(tab.id); window.close(); });
          });
        });
        box.appendChild(btn);
      });
    });
  }

  load(); checkSite();
})();
