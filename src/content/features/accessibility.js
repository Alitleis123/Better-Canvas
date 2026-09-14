/*
 * Better Canvas — accessibility features.
 * TTS ("Speak" button) on text content, larger click targets + dyslexia font
 * (applied via CSS from theming), color-blind SVG filters.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-tts-btn {
      display: inline-flex; align-items: center; gap: var(--bc-space-1, 4px);
      background: transparent; border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-md, 6px); padding: 2px var(--bc-space-2, 6px); font-size: var(--bc-text-xs, 12px); cursor: pointer;
      color: inherit; margin-left: var(--bc-space-2, 6px);
    }
    .bc-tts-btn.playing { background: var(--bc-accent, #0374b5); color: var(--bc-accent-contrast, #fff); }
  `;

  const TTS_SELECTOR = ".show-content, .description, .assignment-description, .announcement, .discussion-topic-body";

  // apply() runs several times a second, so bail before the loop when the set of
  // candidates has not changed. The count is what moves when Canvas mounts new
  // content, and it resets on teardown so a re-enable rescans.
  let ttsCount = -1;
  function installTts() {
    if (!("speechSynthesis" in window)) return;
    const scope = document.querySelectorAll(TTS_SELECTOR);
    if (scope.length === ttsCount) return;
    ttsCount = scope.length;
    for (const el of scope) {
      if (el._bcTts) continue; el._bcTts = true;
      const btn = document.createElement("button");
      btn.className = "bc-tts-btn";
      btn.type = "button";
      btn.setAttribute("data-bc-node", "bc-tts-btn");   // declared below, so teardown removes it
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = BC.icons.svg("speaker", { size: 13 }) + "<span>Speak</span>";
      btn.addEventListener("click", () => {
        try {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            btn.classList.remove("playing");
            btn.setAttribute("aria-pressed", "false");
            return;
          }
          const utter = new SpeechSynthesisUtterance((el.textContent || "").slice(0, 20000));
          utter.rate = 1.05;
          utter.onend = () => { btn.classList.remove("playing"); btn.setAttribute("aria-pressed", "false"); };
          btn.classList.add("playing");
          btn.setAttribute("aria-pressed", "true");
          window.speechSynthesis.speak(utter);
        } catch (e) { BC.toast.error("TTS failed"); }
      });
      el.parentNode && el.parentNode.insertBefore(btn, el);
    }
  }

  // Color-blind daltonization SVG filters (mount once).
  function installCbFilters() {
    if (document.getElementById("bc-cb-filters")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", "bc-cb-filters");
    // Marks the node as ours for the observer's ownership check and makes it
    // removable by teardown — an id alone is invisible to both.
    svg.setAttribute("data-bc-node", "bc-cb-filters");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML = `
      <filter id="bc-cb-protanopia"><feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/></filter>
      <filter id="bc-cb-deuteranopia"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/></filter>
      <filter id="bc-cb-tritanopia"><feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/></filter>
    `;
    document.documentElement.appendChild(svg);
  }

  function apply(settings) {
    const a = settings.accessibility || {};
    BC.injector.setStyle("bc-a11y-css", CSS);
    installCbFilters();
    if (a.tts) installTts();
    // Switching the setting OFF had no branch at all, so the Speak buttons
    // stayed on the page until a reload -- and the _bcTts expando meant they
    // would not come back afterwards either. Same teardown the unmount hook
    // does, so there is one definition of "no TTS here".
    else if (ttsCount !== -1) removeTts();
  }

  function removeTts() {
    ttsCount = -1;
    for (const el of document.querySelectorAll(TTS_SELECTOR)) {
      if (el._bcTts) delete el._bcTts;
    }
    BC.injector.removeNode("bc-tts-btn");
  }

  BC.registry.register({
    id: "accessibility", styles: ["bc-a11y-css"], nodes: ["bc-cb-filters", "bc-tts-btn"], apply,
    // The _bcTts expandos outlived teardown, so after a disable/enable cycle
    // installTts() skipped every element it had already marked and the Speak buttons
    // (which teardown had just removed) never came back.
    unmount() {
      removeTts();
      if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    },
  });
})();
