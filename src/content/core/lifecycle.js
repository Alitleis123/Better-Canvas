/*
 * Better Canvas — feature registry + lifecycle helpers.
 * Features self-register with their style/node teardown keys, so the entry
 * point derives cleanup lists instead of hand-maintaining them. Each feature
 * can request a "bag" of managed listeners/timers; page bags are cleared
 * automatically on SPA navigation. BC.diag keeps a ring buffer of feature
 * errors for debugging on a live Canvas instance.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  // ---- diagnostics -------------------------------------------------------
  const DIAG_MAX = 50;
  BC.diag = {
    entries: [],
    push(source, error) {
      try {
        BC.diag.entries.push({
          source: String(source || "anon"),
          error: String((error && error.message) || error),
          ts: Date.now(),
        });
        if (BC.diag.entries.length > DIAG_MAX) BC.diag.entries.shift();
      } catch (_) {}
    },
    clear() { BC.diag.entries.length = 0; },
  };

  // ---- registry ----------------------------------------------------------
  const features = new Map();
  BC.features = BC.features || {};

  BC.registry = {
    // def: { id, styles: [], nodes: [], apply(settings, ctx), unmount?() }
    register(def) {
      if (!def || !def.id || typeof def.apply !== "function") {
        BC.util.warn("registry: invalid feature definition", def && def.id);
        return def;
      }
      features.set(def.id, def);
      BC.features[def.id] = def;
      return def;
    },
    get(id) { return features.get(id); },
    all() { return Array.from(features.values()); },
    styleKeys() {
      const out = [];
      for (const f of features.values()) for (const k of f.styles || []) out.push(k);
      return out;
    },
    nodeKeys() {
      const out = [];
      for (const f of features.values()) for (const k of f.nodes || []) out.push(k);
      return out;
    },
  };

  // ---- lifecycle bags ----------------------------------------------------
  function makeBag() {
    const listeners = [];
    const timers = [];
    const marks = new Set();
    return {
      // Run a setup block once per bag lifetime (dedupe across apply() re-runs).
      once(key, fn) {
        if (marks.has(key)) return false;
        marks.add(key);
        fn();
        return true;
      },
      listen(el, ev, fn, opts) {
        el.addEventListener(ev, fn, opts);
        listeners.push([el, ev, fn, opts]);
        return fn;
      },
      interval(fn, ms) { const t = setInterval(fn, ms); timers.push(t); return t; },
      timeout(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; },
      clear() {
        for (const [el, ev, fn, opts] of listeners) {
          try { el.removeEventListener(ev, fn, opts); } catch (_) {}
        }
        listeners.length = 0;
        for (const t of timers) { clearInterval(t); clearTimeout(t); }
        timers.length = 0;
        marks.clear();
      },
    };
  }

  const bags = new Map();      // persistent: cleared on feature disable / full teardown
  const pageBags = new Map();  // per-page: also cleared on every SPA navigation

  BC.lifecycle = {
    bag(id) {
      let b = bags.get(id);
      if (!b) { b = makeBag(); bags.set(id, b); }
      return b;
    },
    pageBag(id) {
      let b = pageBags.get(id);
      if (!b) { b = makeBag(); pageBags.set(id, b); }
      return b;
    },
    clear(id) {
      const b = bags.get(id); if (b) b.clear();
      const p = pageBags.get(id); if (p) p.clear();
    },
    clearAll() {
      for (const b of bags.values()) b.clear();
      for (const b of pageBags.values()) b.clear();
    },
  };

  window.addEventListener("bc:navigate", () => {
    for (const b of pageBags.values()) b.clear();
  });
})();
