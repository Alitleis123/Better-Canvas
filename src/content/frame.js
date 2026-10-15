/*
 * Better Canvas — subframe dark mode.
 * The main bundle only runs in the top document, so SpeedGrader submission
 * previews, New Quizzes (LTI), canvadocs, and the rich-content editor iframe
 * stayed white in dark mode. This tiny script runs in every same-origin
 * subframe, reads settings straight from chrome.storage.local, and runs the
 * shared dark mode engine. Live-updates on change.
 */
(function () {
  "use strict";
  if (window.top === window) return; // top document is handled by the full bundle
  const BC = globalThis.BC;
  if (!BC || !BC.color || !BC.darkEngine || typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;

  const STYLE_ID = "bc-frame-style";
  let lastMode = "";

  // The same tokens, hand-written rules and computed-colour engine as the top
  // document, so a submission preview or quiz frame matches the page around it.
  function buildCss(settings) {
    return BC.tokens.css(settings.theming, { scope: "html.bc-dark", mode: "dark" }) + "\n" +
      BC.darkEngine.baseCss() + "\n" + BC.darkEngine.tagCss();
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
      if (!dark) { BC.darkEngine.stop(); removeStyle(); return; }
      setStyle(buildCss(settings));
      whenBody(() => BC.darkEngine.start());
    } catch (_) {}
  }

  // Runs at document_start, before <body> exists.
  function whenBody(fn) {
    if (document.body) { fn(); return; }
    document.addEventListener("DOMContentLoaded", fn, { once: true });
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
