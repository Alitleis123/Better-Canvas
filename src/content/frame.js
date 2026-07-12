/*
 * Better Canvas — subframe dark mode.
 * The main bundle only runs in the top document, so SpeedGrader submission
 * previews, New Quizzes (LTI), canvadocs, and the rich-content editor iframe
 * stayed white in dark mode. This tiny script runs in every same-origin
 * subframe, reads settings straight from chrome.storage.local, and applies
 * the shared dark palette plus a generic dark sheet. Live-updates on change.
 */
(function () {
  "use strict";
  if (window.top === window) return; // top document is handled by the full bundle
  const BC = globalThis.BC;
  if (!BC || !BC.color || typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;

  const STYLE_ID = "bc-frame-style";
  let lastMode = "";

  function buildCss(pd) {
    return `
      :root {
        --bc-surface-1: ${pd.bg}; --bc-surface-2: ${pd.bg2}; --bc-surface-3: ${pd.bg3};
        --bc-border: ${pd.border}; --bc-text: ${pd.text}; --bc-muted: ${pd.muted};
        --bc-link: ${pd.link}; --bc-accent: ${pd.accent};
      }
      html.bc-dark, html.bc-dark body {
        background: var(--bc-surface-1) !important; color: var(--bc-text) !important;
      }
      html.bc-dark a { color: var(--bc-link) !important; }
      html.bc-dark input, html.bc-dark select, html.bc-dark textarea, html.bc-dark button {
        background: var(--bc-surface-3) !important; color: var(--bc-text) !important;
        border-color: var(--bc-border) !important;
      }
      html.bc-dark table, html.bc-dark th, html.bc-dark td {
        background: var(--bc-surface-2) !important; color: var(--bc-text) !important;
        border-color: var(--bc-border) !important;
      }
      html.bc-dark hr { border-color: var(--bc-border) !important; }
      html.bc-dark [role="dialog"], html.bc-dark [class*="card" i],
      html.bc-dark .user_content, html.bc-dark .quiz-header, html.bc-dark .question,
      html.bc-dark [style*="background-color: rgb(255, 255, 255)"],
      html.bc-dark [style*="background: rgb(255, 255, 255)"],
      html.bc-dark [style*="background-color:#fff" i],
      html.bc-dark [style*="background: #fff" i] {
        background-color: var(--bc-surface-2) !important; color: var(--bc-text) !important;
      }
      html.bc-dark ::selection { background: var(--bc-accent); color: #fff; }
    `;
  }

  function setStyle(cssText) {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    if (el.textContent !== cssText) el.textContent = cssText;
  }

  function removeStyle() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  function apply(settings) {
    try {
      const doc = document.documentElement;
      if (!doc) return;
      lastMode = (settings && settings.theming && settings.theming.darkMode) || "";
      const dark = !!settings && settings.enabled !== false && BC.isDarkActive(settings);
      doc.classList.toggle("bc-dark", dark);
      if (!dark) { removeStyle(); return; }
      setStyle(buildCss(BC.color.themePalettes(settings.theming).dark));
    } catch (_) {}
  }

  function load() {
    chrome.storage.local.get(BC.SETTINGS_KEY, (res) => {
      apply(BC.mergeDefaults(res && res[BC.SETTINGS_KEY]));
    });
  }

  load();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[BC.SETTINGS_KEY]) {
      apply(BC.mergeDefaults(changes[BC.SETTINGS_KEY].newValue));
    }
  });
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", load);
  } catch (_) {}
  setInterval(() => { if (lastMode === "scheduled") load(); }, 60000);
})();
