/* Better Canvas — popup: quick toggles + enable-on-custom-domain flow. */
(function () {
  "use strict";
  const BC = globalThis.BC;
  const KEY = BC.SETTINGS_KEY;
  const $ = (id) => document.getElementById(id);

  let settings = BC.cloneDefaults();

  function load() {
    chrome.storage.local.get(KEY, (r) => {
      settings = BC.mergeDefaults(r[KEY]);
      render();
    });
  }
  function save() {
    chrome.storage.local.set({ [KEY]: settings });
  }

  function render() {
    $("enabled").checked = settings.enabled;
    $("dashEnabled").checked = settings.dashboard.enabled;
    $("darkMode").value = settings.theming.darkMode;
  }

  $("enabled").addEventListener("change", (e) => {
    settings.enabled = e.target.checked;
    save();
  });
  $("dashEnabled").addEventListener("change", (e) => {
    settings.dashboard.enabled = e.target.checked;
    save();
  });
  $("darkMode").addEventListener("change", (e) => {
    settings.theming.darkMode = e.target.value;
    save();
  });
  // Prefer opening the in-page drawer on the active Canvas tab (no new tab).
  // Fall back to the standalone options page when the tab isn't Canvas.
  $("open-options").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { type: "bc:openSettings" }, (resp) => {
        if (!chrome.runtime.lastError && resp && resp.ok) {
          window.close();
        } else {
          chrome.runtime.openOptionsPage();
        }
      });
      return;
    }
    chrome.runtime.openOptionsPage();
  });

  // --- site status / enable-on-custom-domain ------------------------------
  async function checkSite() {
    const box = $("site-status");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      box.textContent = "No active tab.";
      return;
    }
    let url;
    try {
      url = new URL(tab.url);
    } catch {
      box.textContent = "This page can't be customized.";
      return;
    }
    if (!/^https?:$/.test(url.protocol)) {
      box.textContent = "Open a Canvas page to use Better Canvas.";
      return;
    }

    const isInstructure = /(^|\.)instructure\.com$/.test(url.hostname);
    const origin = url.origin + "/*";

    // Ask the content script whether it's loaded and on Canvas.
    chrome.tabs.sendMessage(tab.id, { type: "bc:ping" }, (resp) => {
      const active = !chrome.runtime.lastError && resp && resp.canvas;
      if (active) {
        box.classList.add("is-active");
        box.textContent = "Active on this Canvas page ✓";
        return;
      }
      if (isInstructure) {
        box.textContent = "Canvas detected — reload the page if controls don't appear.";
        return;
      }
      // Custom domain: offer to enable.
      chrome.permissions.contains({ origins: [origin] }, (has) => {
        box.textContent = has
          ? "Enabled here. Reload the page to activate."
          : "Using a custom school Canvas domain?";
        const btn = document.createElement("button");
        btn.textContent = has ? "Reload page" : "Enable on " + url.hostname;
        btn.addEventListener("click", () => {
          if (has) {
            chrome.tabs.reload(tab.id);
            window.close();
            return;
          }
          chrome.permissions.request({ origins: [origin] }, (granted) => {
            if (!granted) return;
            chrome.runtime.sendMessage({ type: "bc:syncRegistration" }, () => {
              chrome.tabs.reload(tab.id);
              window.close();
            });
          });
        });
        box.appendChild(btn);
      });
    });
  }

  load();
  checkSite();
})();
