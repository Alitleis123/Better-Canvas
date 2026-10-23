const assert = require("node:assert/strict");
const test = require("node:test");
const { database } = require("./storage-harness.cjs");
const { copy, settle, load } = require("./audit-helpers.cjs");

test("queued restores replace committed state and remain readable by 3.3.0", async () => {
  const db = database(), a = db.tab(); await a.storage.load();
  await Promise.all([a.storage.saveLocal({ notes: { A: [] } }), a.storage.saveLocal({ notes: { B: [] } })]);
  assert.deepEqual(copy(a.storage.local.notes), { B: [] });
  // 3.3.0 reads the raw key without any record overlay or revision metadata.
  assert.deepEqual(JSON.parse(JSON.stringify(db.data.bcLocal)), { notes: { B: [] } });
  await a.storage.updateLocal((d) => { d.notes.B.push({ id: "n", text: "current", x: 120, y: 150 }); });
  assert.equal(db.data.bcLocal.notes.B[0].text, "current");
});

test("background rejects a mismatched base and retries the mutator against a 3.3.0 write", async () => {
  const db = database(), a = db.tab(); await a.storage.load();
  const snapshot = await a.storage.request({ type: "bc:localRead" });
  db.data.bcLocal.notes.foreign = "legacy writer";
  assert.equal((await a.storage.request({ type: "bc:localCommit", base: snapshot.base, value: {} })).conflict, true);
  assert.equal(db.data.bcLocal.notes.foreign, "legacy writer");
  let once = false, runs = 0;
  db.beforeSend((message) => { if (message.type === "bc:localCommit" && !once) { once = true; db.data.bcLocal.notes.newer = "keep"; } });
  await a.storage.updateLocal((d) => { runs++; d.notes.mine = "saved"; });
  assert.equal(runs, 2);
  assert.deepEqual(db.data.bcLocal.notes, { foreign: "legacy writer", newer: "keep", mine: "saved" });
});

test("conflict retries are bounded and failure reaches the existing toast UI", async () => {
  const db = database(), a = db.tab(); await a.storage.load();
  const errors = []; a.context.BC.toast = { error: (message) => errors.push(message) };
  let commits = 0;
  db.beforeSend((message) => { if (message.type === "bc:localCommit") db.data.bcLocal.notes.interference = ++commits; });
  await assert.rejects(a.storage.updateLocal((d) => { d.notes.mine = "no"; }), /Other tabs kept changing/);
  assert.equal(commits, 8); assert.match(errors[0], /could not be saved/);
  assert.equal(db.data.bcLocal.notes.mine, undefined);
  db.beforeSend(null);
  await a.storage.updateLocal((d) => { d.notes.recovered = true; });
  assert.equal(db.data.bcLocal.notes.recovered, true);
});

test("targeted reads exclude theme payloads and leftover locker data and quiz churn adds no keys or tombstones", async (t) => {
  const db = database({ bcSettings: { version: 5, customThemes: [{ image: "A".repeat(2 * 1024 * 1024) }] },
    "bcLocker:item:big": { id: "big", type: "note", body: "B".repeat(2 * 1024 * 1024) } });
  const a = db.tab(); await a.storage.load(); await settle(); db.requests.length = 0;
  for (let i = 0; i < 15; i++) {
    await a.storage.updateLocal((d) => { const stars = ((d.todo ||= {}).stars ||= {}); stars.task = !stars.task; }); await settle();
  }
  const toggleReads = db.requests.length;
  for (let i = 0; i < 100; i++) {
    await a.storage.updateLocal((d) => { (d.quizDrafts ||= {})[i] = { savedAt: i, answers: { question_1: { type: "text", value: "A" } } }; });
    await a.storage.updateLocal((d) => { delete d.quizDrafts[i]; });
  }
  await a.storage.updateLocal((d) => { d.notes.page = [{ id: "n", text: "note", x: 120, y: 120 }]; });
  a.context.BC.registry = { register() {} }; a.context.BC.dt = { ymd: () => "2026-10-15" };
  load(a.context, "src/content/features/grades.js"); a.context.BC.grades.recordScore("7", 93);
  await a.storage.updateLocal(() => {}); await settle();
  assert.equal(db.data.bcLocal.gradeHistory[7][0].score, 93);
  assert.deepEqual(db.data.bcLocal.quizDrafts, {});
  assert.equal(Object.keys(db.data).length, 3);
  assert.equal(db.requests.some((keys) => keys === null), false);
  assert.ok(db.requests.every((keys) => Array.isArray(keys) && keys.length === 1 && keys[0] === "bcLocal"));
  t.diagnostic(JSON.stringify({ plannerToggles: 15, toggleReads, fullReads: 0, themeReads: 0, lockerReads: 0, quizCycles: 100, storageKeys: Object.keys(db.data).length, tombstones: 0 }));
});

test("invalidated extension requests reject without an uncaught page error", async () => {
  const db = database(), a = db.tab(); await a.storage.load();
  const errors = []; a.context.BC.toast = { error: (message) => errors.push(message) };
  a.chrome.runtime.sendMessage = () => { throw Error("Extension context invalidated."); };
  await assert.rejects(a.storage.updateLocal((d) => { d.notes.lost = true; }), /context invalidated/);
  assert.match(errors[0], /context invalidated/);
});


test("background rejects foreign and missing sender ids before reads or writes", async () => {
  const db = database(), before = copy(db.data);
  for (const sender of [{ id: "foreign-extension" }, {}]) {
    for (const message of [
      { type: "bc:localRead" }, { type: "bc:localCommit", value: { notes: { foreign: true } } },
      { type: "bc:settingsCommit", value: { foreign: true } },
    ]) {
      let response;
      db.message(message, sender, (value) => { response = value; });
      assert.equal(response.ok, false); assert.match(response.error, /Untrusted/);
    }
  }
  await settle();
  assert.deepEqual(db.data, before);
  assert.equal(db.requests.length, 0);
  assert.equal(db.events.length, 0);
});
