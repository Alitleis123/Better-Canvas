/*
 * Better Canvas — settings UI state store.
 * Wraps the adapter (in-page drawer OR options page) with a diffing layer,
 * change subscribers, and an undo/redo history.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.SettingsState = BC.SettingsState || {};

  BC.SettingsState.create = function (adapter) {
    let state = adapter.getState() || BC.cloneDefaults();
    let saved = JSON.stringify(state);
    const listeners = new Set();
    const past = [];
    const future = [];
    const HISTORY = 30;
    let saveTimer = null;
    let suspended = false;

    function clone(x) { return JSON.parse(JSON.stringify(x)); }

    function notify() { for (const cb of listeners) BC.util.guard(() => cb(state), "state listener"); }

    function scheduleSave() {
      const cur = JSON.stringify(state);
      if (cur === saved) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        saved = cur;
        try { await adapter.save(state); } catch (e) { BC.util.warn("save", e); }
      }, 220);
    }

    function set(mutator, opts) {
      const before = clone(state);
      const draft = clone(state);
      mutator(draft);
      const after = clone(draft);
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      if (!(opts && opts.replay)) {
        past.push(before);
        if (past.length > HISTORY) past.shift();
        future.length = 0;
      }
      state = after;
      notify();
      scheduleSave();
    }

    function undo() {
      if (!past.length) return false;
      const prev = past.pop();
      future.push(clone(state));
      state = prev;
      notify();
      scheduleSave();
      return true;
    }

    function redo() {
      if (!future.length) return false;
      const next = future.pop();
      past.push(clone(state));
      state = next;
      notify();
      scheduleSave();
      return true;
    }

    // React to external changes (other tabs, popup).
    if (adapter.subscribe) {
      adapter.subscribe((incoming) => {
        if (suspended) return;
        if (JSON.stringify(incoming) === JSON.stringify(state)) return;
        past.push(clone(state));
        if (past.length > HISTORY) past.shift();
        state = clone(incoming);
        saved = JSON.stringify(state);
        notify();
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
      exportJSON() { return JSON.stringify(state, null, 2); },
      importJSON(text) {
        try {
          const parsed = JSON.parse(text);
          if (!parsed || typeof parsed !== "object") throw new Error("invalid");
          const merged = BC.mergeDefaults(parsed);
          past.push(clone(state)); if (past.length > HISTORY) past.shift(); future.length = 0;
          state = merged; notify(); scheduleSave();
          return true;
        } catch (e) { return false; }
      },
      reset() {
        past.push(clone(state)); if (past.length > HISTORY) past.shift(); future.length = 0;
        state = BC.cloneDefaults();
        notify(); scheduleSave();
      },
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
