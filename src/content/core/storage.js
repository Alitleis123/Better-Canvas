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
  function emptyLocal() { return { notes: {}, drafts: {}, cache: {} }; }

  // Change events can describe an older write than the value now in storage.
  // Re-read the committed value instead of identifying our echoes by their JSON:
  // another tab can write between two of ours, or write the same JSON later.
  const revisions = { [KEY]: 0, [LOCAL_KEY]: 0 };
  const writing = { [KEY]: 0, [LOCAL_KEY]: 0 };
  const reads = { [KEY]: 0, [LOCAL_KEY]: 0 };
  let savedSettings = null;
  const refreshKeys = new Set();
  let refreshQueued = false;

  function refresh(key) {
    refreshKeys.add(key);
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      const keys = [...refreshKeys];
      refreshKeys.clear();
      const a = area();
      if (!a) return;
      const before = { ...revisions };
      const sequence = {};
      for (const k of keys) sequence[k] = ++reads[k];
      a.get(keys, (res) => {
        if (chrome.runtime && chrome.runtime.lastError) return;
        for (const k of keys) {
          // A local edit after this read started is newer, and a pending write
          // will request another read when it finishes.
          if (before[k] !== revisions[k] || sequence[k] !== reads[k] || writing[k]) continue;
          if (k === KEY) {
            // The drawer previews unsaved edits immediately. A storage read must
            // not replace that preview with its previous saved snapshot.
            if (current && JSON.stringify(current) !== savedSettings) continue;
            current = BC.mergeDefaults(res && res[KEY]);
            savedSettings = JSON.stringify(current);
            for (const cb of listeners) BC.util.guard(() => cb(current), "storage");
          } else {
            local = BC.cleanLocalData((res && res[LOCAL_KEY]) || emptyLocal());
            for (const cb of localListeners) BC.util.guard(() => cb(local), "local storage");
          }
        }
      });
    });
  }

  function readValues(keys) {
    return new Promise((resolve, reject) => {
      if (!area()) return resolve({});
      const done = (result) => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve(result || {});
      };
      try {
        const promise = area().get(keys, done);
        if (promise && promise.then) promise.then(done, reject);
      } catch (error) { reject(error); }
    });
  }

  function writeValues(values) {
    return new Promise((resolve, reject) => {
      const a = area();
      if (!a) return resolve();
      const keys = Object.keys(values);
      for (const key of keys) writing[key]++;
      let finished = false;
      const done = (error) => {
        if (finished) return;
        finished = true;
        for (const key of keys) { writing[key]--; refresh(key); }
        if (error) reject(new Error(error.message || String(error)));
        else resolve();
      };
      try {
        const promise = a.set(values, () => done(chrome.runtime && chrome.runtime.lastError));
        if (promise && promise.then) promise.then(() => done(), done);
      } catch (e) { done(e); }
    });
  }

  function write(key, value) { return writeValues({ [key]: value }); }

  const storage = (BC.storage = {
    get current() { return current; },
    get local() { return local; },

    load() {
      if (loadPromise) return loadPromise;
      loadPromise = (async () => {
        const res = await readValues([KEY, LOCAL_KEY]);
        const stored = res[KEY], carry = {};
        current = BC.mergeDefaults(stored, carry);
        savedSettings = JSON.stringify(current);
        local = BC.cleanLocalData(res[LOCAL_KEY] || emptyLocal());
        if (carry.gradeHistory) local.gradeHistory = Object.assign({}, carry.gradeHistory, local.gradeHistory || {});
        if (carry.local) {
          for (const k of Object.keys(carry.local)) if (local[k] === undefined) local[k] = carry.local[k];
        }
        if (stored && (stored.version || 1) < BC.SETTINGS_VERSION) {
          revisions[KEY]++; revisions[LOCAL_KEY]++;
          await writeValues({ [KEY]: current, [LOCAL_KEY]: local });
        }
        return current;
      })().catch((error) => { loadPromise = null; throw error; });
      return loadPromise;
    },

    // Delegates to load(), which already reads bcLocal in the same round-trip and
    // applies migration carry-over. This used to be an independent read that raced
    // load() and unconditionally reassigned `local` — so whichever finished last
    // won. When it was loadLocal(), the carried-over data was dropped from memory
    // and the next updateLocal() persisted the stale object, silently destroying it
    // (this already ate gradeHistory on the v3 upgrade). Delegating removes the
    // race by construction and saves a storage round-trip.
    loadLocal() {
      if (!localLoadPromise) localLoadPromise = storage.load().then(() => local);
      return localLoadPromise;
    },

    // Adopt an in-memory settings object without waiting for a storage
    // round-trip, so the settings drawer can preview a change in the same frame.
    // `current` is a getter, so assigning BC.storage.current throws in strict mode.
    adopt(settings) { if (settings) { current = settings; revisions[KEY]++; } },

    // `json` is an optional pre-serialized copy, so update() doesn't stringify the
    // same object twice.
    save(settings, json) {
      current = settings;
      savedSettings = json || JSON.stringify(settings);
      revisions[KEY]++;
      return write(KEY, settings);
    },

    saveLocal(data) {
      local = data;
      revisions[LOCAL_KEY]++;
      return write(LOCAL_KEY, data);
    },

    async update(mutator) {
      const s = current || (await storage.load());
      const before = JSON.stringify(s);
      const draft = JSON.parse(before);
      mutator(draft);
      const after = JSON.stringify(draft);
      if (after === before) return s;
      await storage.save(draft, after);
      return draft;
    },

    async updateLocal(mutator) {
      const s = local || (await storage.loadLocal());
      const before = JSON.stringify(s);
      const draft = JSON.parse(before);
      mutator(draft);
      const after = JSON.stringify(draft);
      if (after === before) return s;
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
        capMap(d.gradeHistory, 30);
        if (Array.isArray(d.notifHistory) && d.notifHistory.length > 100) d.notifHistory = d.notifHistory.slice(0, 100);
        // Legacy draft keys used a global textarea index and cannot be mapped to the
        // structural scheme — restoring one would land in the wrong field.
        for (const k of Object.keys(d.drafts || {})) if (/#\d+$/.test(k)) delete d.drafts[k];
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
      if (changes[KEY]) refresh(KEY);
      if (changes[LOCAL_KEY]) refresh(LOCAL_KEY);
    });
  }
})();
