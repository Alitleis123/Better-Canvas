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

  const storage = (BC.storage = {
    get current() { return current; },
    get local() { return local; },

    load() {
      if (loadPromise) return loadPromise;
      loadPromise = new Promise((resolve) => {
        if (!area()) { current = BC.cloneDefaults(); local = local || emptyLocal(); return resolve(current); }
        area().get([KEY, LOCAL_KEY], (res) => {
          const stored = res && res[KEY];
          const carry = {};
          current = BC.mergeDefaults(stored, carry);
          local = (res && res[LOCAL_KEY]) || emptyLocal();
          if (carry.gradeHistory) {
            local.gradeHistory = Object.assign({}, carry.gradeHistory, local.gradeHistory || {});
          }
          // Generic carry-over so future migrations can move any subtree from
          // bcSettings into bcLocal without bespoke code here. Never clobber a
          // value that already exists locally.
          if (carry.local) {
            for (const k of Object.keys(carry.local)) if (local[k] === undefined) local[k] = carry.local[k];
          }
          if (stored && (stored.version || 1) < BC.SETTINGS_VERSION) {
            area().set({ [KEY]: current, [LOCAL_KEY]: local });
          }
          resolve(current);
        });
      });
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
    adopt(settings) { if (settings) current = settings; },

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
        capMap(d.gradeHistory, 30);
        if (Array.isArray(d.notifHistory) && d.notifHistory.length > 100) d.notifHistory = d.notifHistory.slice(0, 100);
        // Legacy draft keys used a global textarea index and cannot be mapped to the
        // structural scheme — restoring one would land in the wrong field.
        for (const k of Object.keys(d.drafts || {})) if (/#\d+$/.test(k)) delete d.drafts[k];
        const gh = d.gradeHistory || {};
        for (const id of Object.keys(gh)) {
          if (Array.isArray(gh[id]) && gh[id].length > 90) gh[id] = gh[id].slice(-90);
        }

        // Per-task planner metadata is keyed by planner item id, so it accrues an
        // entry for every task ever starred, tagged, snoozed or dragged and NOTHING
        // ever removed one. Over a few terms that is the largest thing in bcLocal,
        // and it grows toward the quota that would start failing writes for
        // everything else. The items themselves are long gone from Canvas, so the
        // oldest entries are dead weight by definition.
        const todo = d.todo || {};
        for (const k of ["stars", "priorities", "tagsByItem", "subtasks", "notes",
                         "estimates", "status", "scheduled", "snoozed"]) {
          capMap(todo[k], 500);
        }
        // One bucket per recurring rule, each holding completed days.
        capMap(todo.recurringDone, 50);
        for (const id of Object.keys(todo.recurringDone || {})) capMap(todo.recurringDone[id], 400);

        capMap(d.rubricDrafts, 100);

        // Attendance is course -> day -> user. Keep a term's worth of days.
        const att = d.attendance || {};
        capMap(att, 20);
        for (const courseId of Object.keys(att)) capMap(att[courseId], 200);
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
        local = changes[LOCAL_KEY].newValue || emptyLocal();
        for (const cb of localListeners) BC.util.guard(() => cb(local), "local storage");
      }
    });
  }
})();
