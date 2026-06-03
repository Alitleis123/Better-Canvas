/*
 * Better Canvas — settings storage.
 * Source of truth is chrome.storage.local under one key. Content scripts and
 * extension pages all read/write here; live updates flow via storage.onChanged
 * so the UI never needs to message content scripts directly.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const KEY = BC.SETTINGS_KEY;

  const listeners = new Set();
  let current = null;
  let loadPromise = null;

  function area() {
    return chrome.storage && chrome.storage.local;
  }

  const storage = (BC.storage = {
    // Latest merged settings (null until load() resolves once).
    get current() {
      return current;
    },

    load() {
      if (loadPromise) return loadPromise;
      loadPromise = new Promise((resolve) => {
        if (!area()) {
          current = BC.cloneDefaults();
          return resolve(current);
        }
        area().get(KEY, (res) => {
          current = BC.mergeDefaults(res && res[KEY]);
          resolve(current);
        });
      });
      return loadPromise;
    },

    // Persist a full settings object.
    save(settings) {
      current = settings;
      return new Promise((resolve) => {
        if (!area()) return resolve();
        area().set({ [KEY]: settings }, () => resolve());
      });
    },

    // Read-modify-write helper. mutator receives a draft it can mutate.
    async update(mutator) {
      const s = current || (await storage.load());
      const draft = JSON.parse(JSON.stringify(s));
      mutator(draft);
      await storage.save(draft);
      return draft;
    },

    // Subscribe to setting changes. Returns an unsubscribe function.
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[KEY]) return;
      current = BC.mergeDefaults(changes[KEY].newValue);
      for (const cb of listeners) BC.util.guard(() => cb(current), "storage listener");
    });
  }
})();
