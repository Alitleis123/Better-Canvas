/* Better Canvas — toolbar popup. */
(function () {
  "use strict";
  const BC = globalThis.BC;
  const $ = (id) => document.getElementById(id);

  let settings = BC.cloneDefaults();

  let ready = false;
  function showError(error) {
    let box = $("save-error");
    if (!box) { box = document.createElement("p"); box.id = "save-error"; box.setAttribute("role", "alert"); document.body.appendChild(box); }
    box.textContent = "Could not save settings: " + error.message + ". Reopen the popup to retry.";
  }
  function load() {
    for (const id of ["enabled", "dashEnabled", "darkMode", "notifsIn"]) $(id).disabled = true;
    BC.storage.load().then((value) => {
      settings = value; ready = true; render();
      for (const id of ["enabled", "dashEnabled", "darkMode", "notifsIn"]) $(id).disabled = false;
    }).catch(showError);
  }
  function save(mutator) {
    if (!ready) return;
    BC.storage.update(mutator).then((saved) => {
      settings = saved;
      if ($("save-error")) $("save-error").textContent = "";
      paintTokens();
    }).catch(showError);
  }

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

  function render() {
    paintTokens();
    $("enabled").checked = settings.enabled;
    $("dashEnabled").checked = settings.dashboard.enabled;
    $("darkMode").value = settings.theming.darkMode;
    $("notifsIn").checked = !!(settings.notifications && settings.notifications.inPage);
    const v = document.querySelector(".bc-ver"); if (v) v.textContent = "v" + (BC.VERSION || "");
  }

  $("enabled").addEventListener("change", (e) => { const value = e.target.checked; save((d) => { d.enabled = value; }); });
  $("dashEnabled").addEventListener("change", (e) => { const value = e.target.checked; save((d) => { d.dashboard.enabled = value; }); });
  $("darkMode").addEventListener("change", (e) => { const value = e.target.value; save((d) => { d.theming.darkMode = value; }); });
  $("notifsIn").addEventListener("change", (e) => { const value = e.target.checked; save((d) => { d.notifications.inPage = value; }); });

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
      chrome.tabs.sendMessage(tab.id, { type: "bc:openPalette" }, (resp) => {
        // Not a Canvas tab (or the page hasn't loaded us): say so instead of closing
        // silently as though it had worked.
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          const box = $("site-status");
          if (box) box.textContent = "The palette works on Canvas pages — open one and try again.";
          return;
        }
        window.close();
      });
    }
  });

  async function checkSite() {
    const box = $("site-status");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) { box.textContent = "No active tab."; return; }
    let url; try { url = new URL(tab.url); } catch { box.textContent = "This page can't be customized."; return; }
    if (!/^https?:$/.test(url.protocol)) { box.textContent = "Open a Canvas page to use Better Canvas."; return; }
    const isInstructure = /(^|\.)instructure\.com$/.test(url.hostname);
    const origin = url.origin + "/*";
    chrome.tabs.sendMessage(tab.id, { type: "bc:ping" }, (resp) => {
      const active = !chrome.runtime.lastError && resp && resp.canvas;
      if (active) { box.classList.add("is-active"); box.textContent = "Active on this Canvas page ✓"; return; }
      if (isInstructure) { box.textContent = "Canvas detected — reload the page if controls don't appear."; return; }
      chrome.permissions.contains({ origins: [origin] }, (has) => {
        box.textContent = has ? "Enabled here. Reload the page to activate." : "Using a custom school Canvas domain?";
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
