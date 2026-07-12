/*
 * Better Canvas — re-render survival + SPA nav detection.
 * MutationObserver ignores our own injected nodes (data-bc-* / bc- classes)
 * so we don't trigger ourselves; classlists on documentElement/body flip
 * feature state.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  function isOurs(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.hasAttribute && (node.hasAttribute("data-bc-node") || node.hasAttribute("data-better-canvas"))) return true;
    if (node.classList && node.classList.length) {
      for (const c of node.classList) if (c.indexOf("bc-") === 0) return true;
    }
    return false;
  }

  const observer = (BC.observer = {
    _started: false,

    start(onChange) {
      if (observer._started) return;
      observer._started = true;
      const trigger = BC.util.debounce(onChange, 180);

      const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "childList") {
            let allOurs = true;
            for (const n of m.addedNodes) { if (!isOurs(n)) { allOurs = false; break; } }
            if (allOurs) {
              for (const n of m.removedNodes) { if (!isOurs(n)) { allOurs = false; break; } }
            }
            if (!allOurs) { trigger(); return; }
          } else if (m.type === "attributes") {
            if (m.target && !isOurs(m.target)) { trigger(); return; }
          }
        }
      });
      mo.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "data-testid"],
      });

      let lastPath = location.pathname;
      const fireNav = () => {
        // Only announce real page changes — Canvas replaceState()s query params constantly.
        if (location.pathname !== lastPath) {
          lastPath = location.pathname;
          try { window.dispatchEvent(new Event("bc:navigate")); } catch (_) {}
        }
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

      if (window.matchMedia) {
        try {
          window.matchMedia("(prefers-color-scheme: dark)")
                .addEventListener("change", () => onChange());
        } catch (_) {}
      }
    },
  });
})();
