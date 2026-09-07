"use strict";
const { createSandbox, loadCore, load } = require("./harness");

function setup(seed) {
  const sb = createSandbox();
  loadCore(sb);
  if (seed) for (const [k, v] of Object.entries(seed)) sb.chrome._store[k] = v;
  load(sb, "src/content/core/storage.js");
  return { BC: sb.BC, store: sb.chrome._store, sb };
}

const KEY = "bcSettings", LOCAL = "bcLocal";
const bigMap = (n, make) => {
  const o = {};
  for (let i = 0; i < n; i++) o["k" + i] = make ? make(i) : true;
  return o;
};

module.exports = {
  async "load merges stored settings over defaults"() {
    const { BC } = setup({ [KEY]: { version: 4, theming: { darkMode: "on" } } });
    const s = await BC.storage.load();
    assert.equal(s.theming.darkMode, "on");
    assert.equal(s.dashboard.enabled, true);
  },

  async "load with nothing stored yields defaults"() {
    const { BC } = setup();
    const s = await BC.storage.load();
    assert.equal(s.theming.darkMode, "off");
  },

  async "load is memoised so concurrent callers share one read"() {
    const { BC } = setup();
    const [a, b] = await Promise.all([BC.storage.load(), BC.storage.load()]);
    assert.equal(a, b);
  },

  async "loadLocal resolves against the same read as load"() {
    // An independent read raced load() and whichever finished last won, which is
    // what silently destroyed carried-over gradeHistory on the v3 upgrade.
    const { BC } = setup({ [LOCAL]: { notes: { a: [] } } });
    const [, local] = await Promise.all([BC.storage.load(), BC.storage.loadLocal()]);
    assert.equal(local, BC.storage.local);
    assert.deepEqual(Object.keys(local.notes), ["a"]);
  },

  async "a v3 upgrade carries gradeHistory into bcLocal and persists it"() {
    const { BC, store } = setup({ [KEY]: { version: 2, grades: { gradeHistory: { "7": [{ date: "2026-01-01", score: 91 }] } } } });
    await BC.storage.load();
    assert.ok(BC.storage.local.gradeHistory, "carried data must land in memory");
    assert.deepEqual(BC.storage.local.gradeHistory["7"], [{ date: "2026-01-01", score: 91 }]);
    assert.ok(store[LOCAL].gradeHistory, "carried data must be written to bcLocal");
    assert.equal(store[KEY].grades.gradeHistory, undefined, "and removed from settings");
  },

  async "a v4 upgrade carries planner metadata into bcLocal"() {
    const { BC, store } = setup({ [KEY]: { version: 3, todo: { local: { stars: { x: true } } } } });
    await BC.storage.load();
    assert.deepEqual(BC.storage.local.todo, { stars: { x: true } });
    assert.deepEqual(store[LOCAL].todo, { stars: { x: true } });
  },

  async "carry-over never clobbers a value already in bcLocal"() {
    const { BC } = setup({
      [KEY]: { version: 3, todo: { local: { stars: { fromSettings: true } } } },
      [LOCAL]: { todo: { stars: { alreadyLocal: true } } },
    });
    await BC.storage.load();
    assert.deepEqual(BC.storage.local.todo, { stars: { alreadyLocal: true } },
      "existing local data wins over migrated data");
  },

  async "update writes only when the mutation changes something"() {
    const { BC, store } = setup();
    await BC.storage.load();
    const before = JSON.stringify(store[KEY] || {});
    await BC.storage.update((d) => { d.theming.darkMode = d.theming.darkMode; });
    assert.equal(JSON.stringify(store[KEY] || {}), before, "a no-op must not write");
    await BC.storage.update((d) => { d.theming.darkMode = "on"; });
    assert.equal(store[KEY].theming.darkMode, "on");
  },

  async "update does not mutate the live object until the write succeeds"() {
    const { BC } = setup();
    const s = await BC.storage.load();
    await BC.storage.update((d) => { d.theming.radius = 20; });
    assert.notEqual(BC.storage.current, s, "update must swap in a fresh object");
    assert.equal(BC.storage.current.theming.radius, 20);
  },

  async "adopt swaps in an object without a storage round trip"() {
    const { BC, store } = setup();
    await BC.storage.load();
    const before = JSON.stringify(store[KEY] || {});
    const draft = BC.cloneDefaults();
    draft.theming.darkMode = "on";
    BC.storage.adopt(draft);
    assert.equal(BC.storage.current.theming.darkMode, "on");
    assert.equal(JSON.stringify(store[KEY] || {}), before, "adopt must not persist");
  },

  async "subscribers fire on an external settings change"() {
    const { BC, sb } = setup();
    await BC.storage.load();
    let seen = null;
    BC.storage.subscribe((s) => { seen = s; });
    sb.chrome.storage.local.set({ [KEY]: { version: 4, theming: { darkMode: "on" } } });
    assert.ok(seen, "a change in another tab must reach subscribers");
    assert.equal(seen.theming.darkMode, "on");
  },

  async "local subscribers fire on an external bcLocal change"() {
    const { BC, sb } = setup();
    await BC.storage.load();
    let seen = null;
    BC.storage.subscribeLocal((l) => { seen = l; });
    sb.chrome.storage.local.set({ [LOCAL]: { notes: {} } });
    assert.ok(seen);
  },

  async "unsubscribe stops delivery"() {
    const { BC, sb } = setup();
    await BC.storage.load();
    let n = 0;
    const off = BC.storage.subscribe(() => n++);
    sb.chrome.storage.local.set({ [KEY]: { version: 4, theming: { radius: 2 } } });
    off();
    sb.chrome.storage.local.set({ [KEY]: { version: 4, theming: { radius: 3 } } });
    assert.equal(n, 1);
  },

  // ---- prune ------------------------------------------------------------

  async "prune caps the note and draft stores"() {
    const { BC } = setup({ [LOCAL]: { notes: bigMap(300), drafts: bigMap(500) } });
    await BC.storage.load();
    await BC.storage.prune();
    assert.equal(Object.keys(BC.storage.local.notes).length, 100);
    assert.equal(Object.keys(BC.storage.local.drafts).length, 200);
  },

  async "prune drops legacy index-keyed drafts"() {
    // Those keys used a global textarea index, so restoring one would land the
    // text in an unrelated field.
    const { BC } = setup({ [LOCAL]: { drafts: { "https://x/y#id=a": "keep", "https://x/y#2": "drop" } } });
    await BC.storage.load();
    await BC.storage.prune();
    assert.equal(BC.storage.local.drafts["https://x/y#id=a"], "keep");
    assert.equal(BC.storage.local.drafts["https://x/y#2"], undefined);
  },

  async "prune bounds grade history by course and by length"() {
    const { BC } = setup({
      [LOCAL]: { gradeHistory: bigMap(50, () => Array.from({ length: 200 }, (_, i) => ({ date: "d" + i, score: i }))) },
    });
    await BC.storage.load();
    await BC.storage.prune();
    const gh = BC.storage.local.gradeHistory;
    assert.equal(Object.keys(gh).length, 30);
    for (const id of Object.keys(gh)) assert.ok(gh[id].length <= 90);
  },

  async "prune caps the notification history"() {
    const { BC } = setup({ [LOCAL]: { notifHistory: Array.from({ length: 400 }, (_, i) => ({ i })) } });
    await BC.storage.load();
    await BC.storage.prune();
    assert.equal(BC.storage.local.notifHistory.length, 100);
  },

  async "prune bounds every per-task planner map"() {
    // These are keyed by planner item id and nothing ever removed an entry, so
    // they were the fastest-growing thing in bcLocal.
    const { BC } = setup({
      [LOCAL]: {
        todo: {
          stars: bigMap(2000), priorities: bigMap(2000), tagsByItem: bigMap(2000),
          subtasks: bigMap(2000), notes: bigMap(2000), estimates: bigMap(2000),
          status: bigMap(2000), scheduled: bigMap(2000), snoozed: bigMap(2000),
        },
      },
    });
    await BC.storage.load();
    await BC.storage.prune();
    const t = BC.storage.local.todo;
    for (const k of Object.keys(t)) {
      assert.ok(Object.keys(t[k]).length <= 500, `todo.${k} grew to ${Object.keys(t[k]).length}`);
    }
  },

  async "prune bounds recurring completion history"() {
    const { BC } = setup({ [LOCAL]: { todo: { recurringDone: bigMap(200, () => bigMap(1000)) } } });
    await BC.storage.load();
    await BC.storage.prune();
    const rd = BC.storage.local.todo.recurringDone;
    assert.ok(Object.keys(rd).length <= 50);
    for (const id of Object.keys(rd)) assert.ok(Object.keys(rd[id]).length <= 400);
  },

  async "prune bounds rubric drafts and attendance"() {
    const { BC } = setup({
      [LOCAL]: { rubricDrafts: bigMap(500), attendance: bigMap(100, () => bigMap(1000)) },
    });
    await BC.storage.load();
    await BC.storage.prune();
    assert.ok(Object.keys(BC.storage.local.rubricDrafts).length <= 100);
    const att = BC.storage.local.attendance;
    assert.ok(Object.keys(att).length <= 20);
    for (const c of Object.keys(att)) assert.ok(Object.keys(att[c]).length <= 200);
  },

  async "prune keeps the newest entries and drops the oldest"() {
    // Insertion order approximates age, so the survivors must be the tail.
    const { BC } = setup({ [LOCAL]: { notes: bigMap(150) } });
    await BC.storage.load();
    await BC.storage.prune();
    const keys = Object.keys(BC.storage.local.notes);
    assert.equal(keys.length, 100);
    assert.equal(keys[keys.length - 1], "k149", "the newest entry must survive");
    assert.equal(BC.storage.local.notes.k0, undefined, "the oldest must be dropped");
  },

  async "prune leaves an already-small store untouched"() {
    const { BC } = setup({ [LOCAL]: { notes: { a: [1] }, todo: { stars: { x: true } } } });
    await BC.storage.load();
    await BC.storage.prune();
    assert.deepEqual(BC.storage.local.notes, { a: [1] });
    assert.deepEqual(BC.storage.local.todo.stars, { x: true });
  },

  async "prune survives a completely empty local store"() {
    const { BC } = setup();
    await BC.storage.load();
    await BC.storage.prune();
    assert.ok(BC.storage.local);
  },
};
