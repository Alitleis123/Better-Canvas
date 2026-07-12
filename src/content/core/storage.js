/*
 * Better Canvas — settings storage over chrome.storage.local.
 * Also exposes local (unsynced) storage for feature caches, notes, highlights.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const KEY = BC.SETTINGS_KEY;
  const LOCAL_KEY = BC.LOCAL_KEY;

  const listeners = new Set();
  const localListeners = new Set();
  let current = null;
  let local = null;
  let loadPromise = null;
  let localLoadPromise = null;

  function area() { return chrome.storage && chrome.storage.local; }

  const storage = (BC.storage = {
    get current() { return current; },
    get local() { return local; },

    load() {
      if (loadPromise) return loadPromise;
      loadPromise = new Promise((resolve) => {
        if (!area()) { current = BC.cloneDefaults(); return resolve(current); }
        area().get([KEY, LOCAL_KEY], (res) => {
          const stored = res && res[KEY];
          const carry = {};
          current = BC.mergeDefaults(stored, carry);
          local = (res && res[LOCAL_KEY]) || { notes: {}, highlights: {}, drafts: {}, cache: {} };
          if (carry.gradeHistory) {
            local.gradeHistory = Object.assign({}, carry.gradeHistory, local.gradeHistory || {});
          }
          if (stored && (stored.version || 1) < BC.SETTINGS_VERSION) {
            area().set({ [KEY]: current, [LOCAL_KEY]: local });
          }
          resolve(current);
        });
      });
      return loadPromise;
    },

    loadLocal() {
      if (localLoadPromise) return localLoadPromise;
      localLoadPromise = new Promise((resolve) => {
        if (!area()) { local = { notes: {}, highlights: {}, drafts: {}, cache: {} }; return resolve(local); }
        area().get(LOCAL_KEY, (res) => {
          local = (res && res[LOCAL_KEY]) || { notes: {}, highlights: {}, drafts: {}, cache: {} };
          resolve(local);
        });
      });
      return localLoadPromise;
    },

    save(settings) {
      current = settings;
      return new Promise((resolve) => {
        if (!area()) return resolve();
        area().set({ [KEY]: settings }, () => resolve());
      });
    },

    saveLocal(data) {
      local = data;
      return new Promise((resolve) => {
        if (!area()) return resolve();
        area().set({ [LOCAL_KEY]: data }, () => resolve());
      });
    },

    async update(mutator) {
      const s = current || (await storage.load());
      const before = JSON.stringify(s);
      const draft = JSON.parse(before);
      mutator(draft);
      if (JSON.stringify(draft) === before) return s;
      await storage.save(draft);
      return draft;
    },

    async updateLocal(mutator) {
      const s = local || (await storage.loadLocal());
      const before = JSON.stringify(s);
      const draft = JSON.parse(before);
      mutator(draft);
      if (JSON.stringify(draft) === before) return s;
      await storage.saveLocal(draft);
      return draft;
    },

    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    subscribeLocal(cb) { localListeners.add(cb); return () => localListeners.delete(cb); },

    // Bound the unbounded stores so bcLocal can't crawl toward the quota.
    // Maps drop oldest-inserted entries first (insertion order ≈ age).
    prune() {
      const capMap = (obj, max) => {
        if (!obj) return;
        const keys = Object.keys(obj);
        if (keys.length <= max) return;
        for (const k of keys.slice(0, keys.length - max)) delete obj[k];
      };
      return storage.updateLocal((d) => {
        capMap(d.notes, 100);
        capMap(d.drafts, 200);
        capMap(d.highlights, 200);
        capMap(d.gradeHistory, 30);
        const gh = d.gradeHistory || {};
        for (const id of Object.keys(gh)) {
          if (Array.isArray(gh[id]) && gh[id].length > 90) gh[id] = gh[id].slice(-90);
        }
      }).then(() => {
        const a = area();
        if (!a || typeof a.getBytesInUse !== "function") return; // Firefox lacks getBytesInUse
        a.getBytesInUse(null, (bytes) => {
          if (bytes > 8 * 1024 * 1024 && BC.toast) {
            BC.toast.info("Better Canvas storage is nearly full — clear old notes or drafts in Settings.");
          }
        });
      }).catch(() => {});
    },
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (changes[KEY]) {
        current = BC.mergeDefaults(changes[KEY].newValue);
        for (const cb of listeners) BC.util.guard(() => cb(current), "storage");
      }
      if (changes[LOCAL_KEY]) {
        local = changes[LOCAL_KEY].newValue || { notes: {}, highlights: {}, drafts: {}, cache: {} };
        for (const cb of localListeners) BC.util.guard(() => cb(local), "local storage");
      }
    });
  }
})();
