/*
 * Better Canvas — settings UI state store.
 * Wraps the adapter (in-page drawer OR options page) with a diffing layer,
 * change subscribers, and an undo/redo history.
 *
 * INVARIANT: `state` is mutated in place and never reassigned. Tab renderers
 * capture sub-objects (`const d = store.get().dashboard`) and close over them in
 * ~300 get()/set() pairs, so swapping the root object would leave every mounted
 * control reading a stale snapshot. overwrite() is the only way to replace the
 * contents wholesale, and it preserves identity all the way down.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.SettingsState = BC.SettingsState || {};

  const clone = typeof structuredClone === "function"
    ? (x) => structuredClone(x)
    : (x) => JSON.parse(JSON.stringify(x));

  // Deep in-place replace, so `target` and every sub-object a mounted control
  // captured keep a stable identity.
  function overwrite(target, src) {
    for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
    for (const k of Object.keys(src)) {
      const sv = src[k], tv = target[k];
      if (sv && typeof sv === "object" && !Array.isArray(sv) &&
          tv && typeof tv === "object" && !Array.isArray(tv)) overwrite(tv, sv);
      // Clone rather than alias: otherwise `state` would share a subtree with the
      // history entry or the incoming storage value we were handed.
      else target[k] = (sv && typeof sv === "object") ? clone(sv) : sv;
    }
  }

  BC.SettingsState.create = function (adapter) {
    // Clone up front: the drawer's adapter hands back BC.storage.current itself,
    // and we now mutate in place — writing through to the live settings object
    // would corrupt applyAll's view of it mid-edit.
    const state = clone(adapter.getState() || BC.cloneDefaults());
    const listeners = new Set();
    const past = [];
    const future = [];
    const HISTORY = 30;
    let dirty = false;
    let retry = 0;
    let unsubAdapter = null;

    function notify(kind) {
      for (const cb of listeners) BC.util.guard(() => cb(state, kind || "value"), "state listener");
      // Optional zero-latency path: the drawer adopts the in-memory settings and
      // re-applies before the next paint, instead of waiting out the save
      // debounce plus a chrome.storage round-trip (~345ms).
      if (adapter.preview) BC.util.guard(() => adapter.preview(state), "state preview");
    }

    // throttle, not debounce. With a debounce, holding or spamming a control kept
    // restarting the timer so nothing reached storage until the user stopped;
    // throttle writes immediately and then at most ~4.5Hz, and its trailing call
    // guarantees the final value still lands. chrome.storage.local has no
    // write-rate quota (that's storage.sync).
    const flushSave = BC.util.throttle(() => {
      const snapshot = clone(state);
      Promise.resolve(adapter.save(snapshot))
        .then(() => { dirty = false; retry = 0; })
        .catch((e) => {
          // The old code assigned `saved` BEFORE awaiting the write, so a failed
          // save was believed persisted and never retried — silent data loss on
          // the next reload.
          BC.util.warn("settings save failed, retrying", e);
          retry = Math.min(retry + 1, 5);
          setTimeout(() => { if (dirty) flushSave(); }, 500 * retry);
        });
    }, 220);

    function scheduleSave() { dirty = true; flushSave(); }

    function set(mutator, opts) {
      const before = clone(state);      // ONE clone, was 3 clones + 4 stringifies
      mutator(state);                   // in place, so captured sub-objects stay live
      if (BC.util.deepEqual(before, state)) return;
      if (!(opts && opts.replay)) {
        past.push(before);              // reuses the clone we already had to make
        if (past.length > HISTORY) past.shift();
        future.length = 0;
      }
      notify("value");
      scheduleSave();
    }

    // Wholesale content replacement (reset / import). "structural" tells the UI
    // that a targeted sync isn't enough and the tab needs rebuilding.
    function swap(next) {
      past.push(clone(state));
      if (past.length > HISTORY) past.shift();
      future.length = 0;
      overwrite(state, next);
      notify("structural");
      scheduleSave();
    }

    function undo() {
      if (!past.length) return false;
      future.push(clone(state));
      overwrite(state, past.pop());
      notify("structural");
      scheduleSave();
      return true;
    }

    function redo() {
      if (!future.length) return false;
      past.push(clone(state));
      overwrite(state, future.pop());
      notify("structural");
      scheduleSave();
      return true;
    }

    // React to external changes (another tab, the popup, the options page).
    if (adapter.subscribe) {
      unsubAdapter = adapter.subscribe((incoming) => {
        // Our own write echoes back through here; suppressing it keeps the echo
        // out of the undo stack, where it used to masquerade as a foreign edit
        // and make Undo appear to do nothing.
        if (!incoming || BC.util.deepEqual(incoming, state)) return;
        overwrite(state, incoming);
        notify("structural");
      });
    }

    return {
      get() { return state; },
      set,
      undo, redo,
      canUndo() { return past.length > 0; },
      canRedo() { return future.length > 0; },
      subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
      adapter,
      // Lets a re-mounted drawer dispose the previous store instead of leaving it
      // subscribed and rendering into a detached tree forever.
      destroy() {
        if (unsubAdapter) { BC.util.guard(unsubAdapter, "state unsub"); unsubAdapter = null; }
        listeners.clear();
      },
      exportJSON() { return JSON.stringify(state, null, 2); },
      importJSON(text) {
        try {
          const parsed = JSON.parse(text);
          if (!parsed || typeof parsed !== "object") throw new Error("invalid");
          swap(BC.mergeDefaults(parsed));
          return true;
        } catch (e) { return false; }
      },
      reset() { swap(BC.cloneDefaults()); },
      applyPreset(preset) {
        set((d) => {
          const src = preset.settings || preset;
          const deep = (t, s) => {
            for (const k of Object.keys(s)) {
              const v = s[k];
              if (Array.isArray(v)) t[k] = v.slice();
              else if (v && typeof v === "object") { if (!t[k] || typeof t[k] !== "object") t[k] = {}; deep(t[k], v); }
              else t[k] = v;
            }
          };
          deep(d, src);
        });
      },
    };
  };
})();
