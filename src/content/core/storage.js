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
  // A theme being tried in the settings preview, and whether a settings read was
  // held back while it showed (see refresh).
  let draft = null, heldBack = false;
  let local = null;
  let loadPromise = null;
  let localWrites = Promise.resolve();
  let settingsWrites = Promise.resolve();

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
      readValues(keys).then((res) => {
        if (chrome.runtime && chrome.runtime.lastError) return;
        for (const k of keys) {
          // A local edit after this read started is newer, and a pending write
          // will request another read when it finishes.
          if (before[k] !== revisions[k] || sequence[k] !== reads[k] || writing[k]) continue;
          if (k === KEY) {
            // The drawer previews unsaved edits immediately. A storage read must
            // not replace that preview with its previous saved snapshot.
            if (current && JSON.stringify(current) !== savedSettings) { if (current === draft) heldBack = true; continue; }
            current = BC.mergeDefaults(res && res[KEY]);
            savedSettings = JSON.stringify(current);
            for (const cb of listeners) BC.util.guard(() => cb(current), "storage");
          } else {
            local = readLocal(res);
            for (const cb of localListeners) BC.util.guard(() => cb(local), "local storage");
          }
        }
      }).catch(() => {});
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

  function readLocal(values = {}) {
    return BC.cleanLocalData(Object.assign(emptyLocal(), values[LOCAL_KEY] || {}));
  }
  // Background writes (grade history, reminders seen) fail the same way as the
  // user's own, so one problem used to stack a toast per write. One a minute.
  let lastFailureToast = 0;
  function reportFailure(error) {
    BC.util.warn("local storage", error);
    if (!BC.toast || Date.now() - lastFailureToast < 60000) return;
    lastFailureToast = Date.now();
    BC.toast.error("Changes could not be saved: " + error.message);
  }
  function queueLocal(operation) {
    const result = localWrites.then(operation);
    localWrites = result.catch(reportFailure);
    return result;
  }
  function request(message) {
    return new Promise((resolve, reject) => {
      let finished = false;
      const done = (response) => {
        if (finished) return;
        finished = true;
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else if (!response || (!response.ok && !response.conflict)) reject(new Error(response?.error || "Storage writer unavailable. Refresh this page and try again."));
        else resolve(response);
      };
      try {
        const promise = chrome.runtime.sendMessage(message, done);
        if (promise?.then) promise.then(done, reject);
      } catch (error) { reject(error); }
    });
  }
  async function transact(mutator, migrate = false) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const snapshot = await request({ type: "bc:localRead", migrate });
      const fresh = snapshot.values;
      const draft = readLocal(fresh);
      const message = { type: "bc:localCommit", base: snapshot.base };
      if (migrate) {
        const carry = {};
        message.settings = BC.mergeDefaults(fresh[KEY], carry);
        message.settingsBase = snapshot.settingsBase;
        for (const [key, value] of Object.entries(carry.local || {})) if (draft[key] === undefined) draft[key] = value;
        if (carry.gradeHistory) draft.gradeHistory = Object.assign({}, carry.gradeHistory, draft.gradeHistory || {});
      }
      // Replacement results and small edits both run against the committed state.
      message.value = BC.cleanLocalData(mutator(draft) || draft);
      if (!migrate && JSON.stringify(message.value) === JSON.stringify(fresh[LOCAL_KEY])) { local = message.value; return local; }
      revisions[LOCAL_KEY]++;
      writing[LOCAL_KEY]++;
      let response;
      try { response = await request(message); }
      finally { writing[LOCAL_KEY]--; }
      if (response.conflict) continue;
      local = message.value;
      if (migrate) { current = message.settings; savedSettings = JSON.stringify(current); }
      for (const cb of localListeners) BC.util.guard(() => cb(local), "local storage");
      refresh(LOCAL_KEY);
      return local;
    }
    throw new Error("Other tabs kept changing this data. Try saving again.");
  }

  function queueSettings(operation) {
    const result = settingsWrites.then(operation);
    settingsWrites = result.catch(() => {});
    return result;
  }
  async function transactSettings(mutator) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const snapshot = await request({ type: "bc:settingsRead" });
      const draft = BC.mergeDefaults(snapshot.value);
      const value = BC.mergeDefaults(mutator(draft) || draft);
      revisions[KEY]++; writing[KEY]++;
      let response;
      try { response = await request({ type: "bc:settingsCommit", base: snapshot.base, value }); }
      finally { writing[KEY]--; }
      if (response.conflict) continue;
      return value;
    }
    throw new Error("Other tabs kept changing settings. Try saving again.");
  }
  function acceptSettings(value, before, edited) {
    savedSettings = JSON.stringify(value);
    current = BC.mergeSettingsEdits(before, edited, value);
    refresh(KEY);
    return value;
  }

  const storage = (BC.storage = {
    get current() { return current; },
    get local() { return local; },

    load() {
      if (loadPromise) return loadPromise;
      loadPromise = (async () => {
        const res = await readValues([KEY, LOCAL_KEY]);
        const stored = res[KEY];
        current = BC.mergeDefaults(stored);
        savedSettings = JSON.stringify(current);
        local = readLocal(res);
        if (stored && (stored.version || 1) < BC.SETTINGS_VERSION) await transact((draft) => draft, true);
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
      return storage.load().then(() => local);
    },

    // Adopt an in-memory settings object without waiting for a storage
    // round-trip, so the settings drawer can preview a change in the same frame.
    // `current` is a getter, so assigning BC.storage.current throws in strict mode.
    // A previewed theme is never saved, so a change from another tab that arrived
    // while it showed is read again once the preview ends.
    adopt(settings, preview) {
      if (!settings) return;
      current = settings; draft = preview ? settings : null; revisions[KEY]++;
      if (!preview && heldBack) { heldBack = false; refresh(KEY); }
    },

    // UI snapshots carry their baseline so unchanged fields cannot erase edits
    // from another context. Import/reset explicitly request full replacement.
    save(settings, json, options = {}) {
      const edited = JSON.parse(json || JSON.stringify(settings));
      const base = options.base || JSON.parse(savedSettings || JSON.stringify(BC.cloneDefaults()));
      current = settings; revisions[KEY]++;
      return queueSettings(async () => {
        const value = await transactSettings((fresh) => options.replace ? edited :
          BC.replaceSettingsPaths(BC.mergeSettingsEdits(base, edited, fresh), edited, options.replacePaths || []));
        return acceptSettings(value, edited, current);
      });
    },

    // Only imports/restores use full replacement. Snapshot its input now, but
    // apply it inside the queue so two queued restores finish with the last one.
    saveLocal(data) {
      const replacement = BC.cleanLocalData(data);
      return queueLocal(async () => { await storage.load(); return transact(() => replacement); });
    },

    request, // Locker uses the same background writer and error handling.

    update(mutator) {
      return queueSettings(async () => {
        await storage.load();
        const before = JSON.parse(savedSettings);
        const value = await transactSettings(mutator);
        return acceptSettings(value, before, current);
      });
    },

    // Mutators may run again after a conflict. Keep side effects outside them.
    updateLocal(mutator) {
      return queueLocal(async () => { await storage.load(); return transact(mutator); });
    },

    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    subscribeLocal(cb) { localListeners.add(cb); return () => localListeners.delete(cb); },

    // Bound the unbounded stores so bcLocal can't crawl toward the quota.
    // Maps drop oldest-inserted entries first (insertion order ≈ age). Sticky
    // notes are the user's own writing and are never capped; only empty page
    // lists go. Drafts expire a week after their last edit.
    prune() {
      const now = Date.now(), WEEK = 7 * 864e5;
      const capMap = (obj, max) => {
        if (!obj) return;
        const keys = Object.keys(obj);
        if (keys.length <= max) return;
        for (const k of keys.slice(0, keys.length - max)) delete obj[k];
      };
      const stale = (d) => {
        const savedAt = d.draftSavedAt || {};
        return Object.keys(d.drafts || {}).filter((k) => /#\d+$/.test(k) || !(now - savedAt[k] < WEEK));
      };
      // Most page loads have nothing to prune. Check the copy in memory first so
      // they skip the storage round trip.
      const due = (d) => !d || stale(d).length || Object.keys(d.drafts || {}).length > 200 ||
        Object.keys(d.draftSavedAt || {}).some((k) => !(d.drafts || {})[k]) ||
        Object.keys(d.gradeHistory || {}).length > 30 || (Array.isArray(d.notifHistory) && d.notifHistory.length > 100) ||
        Object.values(d.notes || {}).some((list) => Array.isArray(list) && !list.length) ||
        Object.values(d.gradeHistory || {}).some((h) => Array.isArray(h) && h.length > 90);
      if (!due(local)) return Promise.resolve();
      return storage.updateLocal((d) => {
        for (const [k, list] of Object.entries(d.notes || {})) if (Array.isArray(list) && !list.length) delete d.notes[k];
        const savedAt = (d.draftSavedAt = d.draftSavedAt || {});
        // Drafts saved before 3.3.2 have no time. Start their week now.
        for (const k of Object.keys(d.drafts || {})) if (!savedAt[k] && !/#\d+$/.test(k)) savedAt[k] = now;
        for (const k of stale(d)) delete d.drafts[k];
        capMap(d.drafts, 200);
        for (const k of Object.keys(savedAt)) if (!(d.drafts || {})[k]) delete savedAt[k];
        capMap(d.gradeHistory, 30);
        if (Array.isArray(d.notifHistory) && d.notifHistory.length > 100) d.notifHistory = d.notifHistory.slice(0, 100);
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
