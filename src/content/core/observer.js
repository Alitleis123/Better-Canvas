/*
 * Better Canvas — re-render survival + SPA nav detection.
 * MutationObserver ignores our own injected nodes (data-bc-* / bc- classes)
 * so we don't trigger ourselves; classlists on documentElement/body flip
 * feature state.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  // Ownership is an ANCESTOR property, not a node property. Features routinely
  // write bare text nodes and unclassed children inside their own panels
  // (innerHTML with an <h3>, <option> children, day-spacer <div>s), and judging
  // those by the node alone reports them as foreign — which turns our own render
  // into another applyAll. Walking up also covers text nodes, which the old
  // nodeType===1 check rejected outright.
  // Stop before <body>/<html>: we put bc-dark and bc-focus on documentElement, so
  // walking all the way to the root would report EVERY node as ours the moment
  // dark mode is on and switch the observer off entirely. Our own nodes are always
  // either checked directly (some are children of documentElement) or live inside
  // a marked container below body.
  function ownedBy(node) {
    let n = node && node.nodeType === 1 ? node : node && node.parentElement;
    const body = document.body;
    for (; n && n !== body && n !== document.documentElement; n = n.parentElement) {
      if (n.hasAttribute && (n.hasAttribute("data-bc-node") || n.hasAttribute("data-better-canvas"))) return true;
      const cl = n.classList;
      if (cl && cl.length) for (const c of cl) if (c.indexOf("bc-") === 0) return true;
    }
    return false;
  }

  const observer = (BC.observer = {
    _started: false,

    start(onChange) {
      if (observer._started) return;
      observer._started = true;
      // onChange is content.js's requestApply, already debounced 120ms. A second
      // debounce here only added latency and jitter.
      const trigger = onChange;

      const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "childList") {
            if (ownedBy(m.target)) continue;   // churn inside one of our own subtrees
            let allOurs = true;
            for (const n of m.addedNodes) { if (!ownedBy(n)) { allOurs = false; break; } }
            if (allOurs) {
              for (const n of m.removedNodes) { if (!ownedBy(n)) { allOurs = false; break; } }
            }
            if (!allOurs) { trigger(); return; }
          } else if (m.type === "attributes") {
            if (m.target && !ownedBy(m.target)) { trigger(); return; }
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
