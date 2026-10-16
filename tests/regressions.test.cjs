const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const copy = (value) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise((resolve) => setImmediate(resolve));

function createContext(extra = {}) {
  const context = vm.createContext({
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    queueMicrotask, structuredClone, navigator: { platform: "Win32" }, ...extra,
  });
  load(context, "src/shared/defaults.js", "src/content/core/util.js");
  return context;
}

function load(context, ...files) {
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
}

const { database: storageMock } = require("./storage-harness.cjs");

test("settings imports reject prototype keys at every depth, including arrays", () => {
  const context = createContext();
  context.payload = '{"__proto__":{"html":"injected"},"theming":{"constructor":{"prototype":{"injected":true}}},"customThemes":[{"settings":{"__proto__":{"nested":true},"theming":{"accentColor":"#123456"}}}]}';
  const settings = vm.runInContext("BC.mergeDefaults(JSON.parse(payload))", context);
  assert.equal(vm.runInContext("Object.prototype.html", context), undefined);
  assert.equal(vm.runInContext("Object.prototype.injected", context), undefined);
  assert.equal(settings.customThemes[0].settings.theming.accentColor, "#123456");
  assert.equal(Object.hasOwn(settings.theming, "constructor"), false);
  assert.equal(Object.hasOwn(settings.customThemes[0].settings, "__proto__"), false);
});

test("backup cleaning preserves planner data and removes prototype keys", () => {
  const context = createContext();
  const clean = context.BC.cleanData(JSON.parse('{"todo":{"stars":{"assignment:3":true},"__proto__":{"html":"injected"}},"drafts":{"field":"saved prose"}}'));
  assert.deepEqual(copy(clean), { todo: { stars: { "assignment:3": true } }, drafts: { field: "saved prose" } });
});

test("UI construction does not render inherited attributes", () => {
  const context = createContext({ document: {
    createElement: () => ({ textContent: "", innerHTML: "", setAttribute() {}, addEventListener() {}, appendChild() {} }),
  } });
  load(context, "src/content/core/ui.js");
  const element = vm.runInContext('BC.ui.el("div", Object.assign(Object.create({html:"injected"}), {text:"safe"}))', context);
  assert.equal(element.textContent, "safe");
  assert.equal(element.innerHTML, "");
});

test("applying a shared theme cannot pollute prototypes", () => {
  const context = createContext();
  context.BC.util.throttle = (fn) => fn;
  load(context, "src/shared/settings/state.js");
  const store = context.BC.SettingsState.create({ getState: context.BC.cloneDefaults, save: async () => {} });
  store.applyPreset(JSON.parse('{"settings":{"__proto__":{"html":"injected"},"theming":{"darkMode":"on"}}}'));
  assert.equal(store.get().theming.darkMode, "on");
  assert.equal(vm.runInContext("Object.prototype.html", context), undefined);
  assert.equal(Object.hasOwn(store.get(), "__proto__"), false);
});

test("an acknowledged settings echo does not suppress a later foreign edit", () => {
  const context = createContext();
  context.BC.util.throttle = (fn) => fn;
  load(context, "src/shared/settings/state.js");
  let incoming;
  const store = context.BC.SettingsState.create({
    getState: context.BC.cloneDefaults, save: async () => {},
    subscribe: (callback) => { incoming = callback; },
  });
  store.set((settings) => { settings.dashboard.layout = "list"; });
  const previous = copy(store.get());
  incoming(previous);
  store.set((settings) => { settings.dashboard.layout = "grid"; });
  incoming(previous);
  assert.equal(store.get().dashboard.layout, "list");
});

test("interleaved tab events cannot roll memory back and erase the last committed edit", async () => {
  const mock = storageMock();
  const a = mock.tab(), b = mock.tab();
  await Promise.all([a.storage.load(), b.storage.load()]);
  await a.storage.updateLocal((data) => { data.notes.first = "A"; });
  b.deliver(mock.events[0]);
  await settle();
  await b.storage.updateLocal((data) => { data.notes.foreign = "B"; });
  await a.storage.updateLocal((data) => { data.notes.last = "A"; });
  for (const event of mock.events.slice()) a.deliver(event);
  await settle();
  const observer = mock.tab(); await observer.storage.load();
  assert.deepEqual(copy(a.storage.local), copy(observer.storage.local));
  await a.storage.updateLocal((data) => { data.notes.next = "A"; });
  assert.equal(a.storage.local.notes.last, "A");
});

test("a delayed storage read cannot replace a newer local write", async () => {
  const mock = storageMock(), a = mock.tab();
  await a.storage.load();
  mock.holdReads(true);
  a.deliver({ bcLocal: { newValue: copy(mock.persisted.bcLocal) } });
  await settle();
  const oldRead = mock.reads.shift();
  mock.holdReads(false);
  await a.storage.updateLocal((data) => { data.notes.newer = "keep"; });
  oldRead();
  assert.equal(a.storage.local.notes.newer, "keep");
  for (const read of mock.reads.splice(0)) read();
  mock.holdReads(false);
});

test("out-of-order storage reads retain the latest external value", async () => {
  const mock = storageMock(), a = mock.tab();
  await a.storage.load();
  mock.holdReads(true);
  mock.persisted.bcLocal.notes.external = "old";
  a.deliver({ bcLocal: { newValue: copy(mock.persisted.bcLocal) } });
  await settle();
  mock.persisted.bcLocal.notes.external = "new";
  a.deliver({ bcLocal: { newValue: copy(mock.persisted.bcLocal) } });
  await settle();
  mock.reads.pop()();
  mock.reads.pop()();
  await settle();
  assert.equal(a.storage.local.notes.external, "new");
});

test("storage events preserve a drawer preview that has not been saved yet", async () => {
  const mock = storageMock(), a = mock.tab();
  await a.storage.load();
  const saved = copy(a.storage.current);
  const preview = copy(saved);
  preview.theming.darkMode = "on";
  a.storage.adopt(preview);
  a.deliver({ bcSettings: { newValue: saved } });
  await settle();
  assert.equal(a.storage.current.theming.darkMode, "on");
  await a.storage.save(preview);
  await settle();
  assert.equal(a.storage.current.theming.darkMode, "on");
  assert.equal(mock.persisted.bcSettings.theming.darkMode, "on");
});

test("a no-op local save does not hide a later external change", async () => {
  const mock = storageMock(), a = mock.tab(), b = mock.tab();
  await Promise.all([a.storage.load(), b.storage.load()]);
  await a.storage.saveLocal(copy(a.storage.local));
  await b.storage.updateLocal((data) => { data.notes.external = "visible"; });
  a.deliver(mock.events.at(-1));
  await settle();
  assert.equal(a.storage.local.notes.external, "visible");
});

test("storage write failures reject instead of reporting a successful save", async () => {
  const mock = storageMock(), a = mock.tab();
  await a.storage.load();
  mock.fail("Quota exceeded");
  await assert.rejects(a.storage.updateLocal((data) => { data.notes.failed = "no"; }), /Quota exceeded/);
});

test("settings migrations commit the schema and carried local data together", async () => {
  const mock = storageMock();
  mock.persisted.bcSettings = { version: 2, grades: { gradeHistory: { "7": [{ date: "2026-10-14", score: 93 }] } } };
  const a = mock.tab();
  await a.storage.load();
  await settle();
  assert.equal(mock.events.length, 1);
  assert.ok(mock.events[0].bcSettings);
  assert.ok(mock.events[0].bcLocal);
  assert.equal(mock.persisted.bcSettings.version, a.context.BC.SETTINGS_VERSION);
  assert.equal(mock.persisted.bcLocal.gradeHistory["7"][0].score, 93);
});

test("simultaneous independent contexts preserve notes, planner stars and separate note records", async () => {
  const mock = storageMock(), a = mock.tab(), b = mock.tab();
  mock.persisted.bcLocal.notes.legacy = "Keep legacy data";
  await Promise.all([a.storage.load(), b.storage.load()]);
  await Promise.all([
    a.storage.updateLocal((data) => { data.notes.a = "Note A"; }),
    b.storage.updateLocal((data) => { data.todo = { stars: { task: true } }; }),
  ]);
  // No storage-change events are delivered. Both caches can still be stale.
  await Promise.all([
    a.storage.updateLocal((data) => { data.notes.another = "Another note"; }),
    b.storage.updateLocal((data) => { data.notes.b = "Note B"; }),
  ]);
  const reader = mock.tab(); await reader.storage.load();
  assert.deepEqual(copy(reader.storage.local.notes), { legacy: "Keep legacy data", a: "Note A", another: "Another note", b: "Note B" });
  assert.equal(reader.storage.local.todo.stars.task, true);
});

test("serialized local updates and snapshot saves retain unrelated records and persist deletion", async () => {
  const mock = storageMock(), a = mock.tab(), b = mock.tab();
  mock.persisted.bcLocal.notes.old = "Delete this";
  await Promise.all([a.storage.load(), b.storage.load()]);
  const imported = copy(a.storage.local); imported.notes.imported = "Backup note";
  await Promise.all([
    a.storage.saveLocal(imported),
    b.storage.updateLocal((data) => { data.todo = { stars: { other: true } }; }),
    b.storage.updateLocal((data) => { delete data.notes.old; }),
    b.storage.updateLocal((data) => { data.notes.last = "Queued note"; }),
  ]);
  const reader = mock.tab(); await reader.storage.load();
  assert.equal(reader.storage.local.notes.old, undefined);
  assert.equal(reader.storage.local.notes.imported, "Backup note");
  assert.equal(reader.storage.local.notes.last, "Queued note");
  assert.equal(reader.storage.local.todo.stars.other, true);
  assert.equal(mock.persisted.bcLocal.notes.old, undefined, "3.3.0 reads current data directly");
});
