/*
 * Better Canvas — re-render survival.
 * Canvas is a SPA: it re-renders chunks of the DOM and navigates via pushState
 * without full reloads. We watch for both and re-run all features (debounced).
 * Because every feature's apply() is idempotent, repeated calls are cheap and
 * never loop, even when our own changes trigger the observer.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const observer = (BC.observer = {
    _started: false,

    start(onChange) {
      if (observer._started) return;
      observer._started = true;
      const trigger = BC.util.debounce(onChange, 180);

      const mo = new MutationObserver(() => trigger());
      mo.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      // SPA navigation detection.
      const fireNav = () => {
        // Slight delay so the new view has begun rendering.
        setTimeout(onChange, 0);
        setTimeout(onChange, 250);
      };
      for (const m of ["pushState", "replaceState"]) {
        const orig = history[m];
        history[m] = function () {
          const r = orig.apply(this, arguments);
          fireNav();
          return r;
        };
      }
      window.addEventListener("popstate", fireNav);
      window.addEventListener("hashchange", fireNav);

      // React to dark-mode mode changes that depend on wall-clock or OS theme.
      if (window.matchMedia) {
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .addEventListener("change", () => onChange());
      }
    },
  });
})();
