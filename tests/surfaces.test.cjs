const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { root, load, domContext, copy, settle } = require("./audit-helpers.cjs");

async function surface(name, fail = false) {
  const data = { bcSettings: { version: 2, grades: { gradeHistory: { 7: [{ score: 93 }] } }, todo: { local: { stars: { a: true } } } } };
  const writes = [], runtime = {}, chrome = { runtime, tabs: { query: async () => [] }, storage: { local: {
    get: (_keys, cb) => queueMicrotask(() => cb(copy(data))),
    set: (values, cb) => { writes.push(copy(values)); queueMicrotask(() => {
      if (fail) runtime.lastError = { message: "Quota exceeded" }; else Object.assign(data, copy(values));
      cb(); delete runtime.lastError;
    }); },
  }, onChanged: { addListener() {} } } };
  const html = fs.readFileSync(path.join(root, "src", name, name + ".html"), "utf8");
  const { dom, context } = domContext(html, { chrome });
  let adapter;
  load(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/storage.js");
  context.BC.SettingsUI = { render(_root, value) { adapter = value; } };
  load(context, "src/" + name + "/" + name + ".js");
  await settle(); await settle();
  return { data, writes, dom, context, adapter, fail: (value) => { fail = value; } };
}

for (const name of ["options", "popup"]) {
  test(name + " first upgrade commits legacy history and planner metadata before edits", async () => {
    const s = await surface(name);
    try {
      assert.equal(s.writes[0].bcSettings.version, 5);
      assert.equal(s.writes[0].bcLocal.gradeHistory[7][0].score, 93);
      assert.equal(s.writes[0].bcLocal.todo.stars.a, true);
      if (name === "options") await s.adapter.save(s.context.BC.cloneDefaults());
      else s.dom.window.document.getElementById("enabled").dispatchEvent(new s.dom.window.Event("change"));
      await settle();
      assert.equal(s.data.bcLocal.gradeHistory[7][0].score, 93);
      assert.equal(s.data.bcLocal.todo.stars.a, true);
    } finally { s.dom.window.close(); }
  });
  test(name + " migration failure shows an error and prevents editing", async () => {
    const s = await surface(name, true);
    try {
      assert.match(s.dom.window.document.querySelector('[role="alert"]').textContent, /Quota exceeded/);
      assert.equal(s.data.bcSettings.version, 2);
      if (name === "options") assert.equal(s.adapter, undefined);
      else assert.equal(s.dom.window.document.getElementById("enabled").disabled, true);
    } finally { s.dom.window.close(); }
  });
}

test("options adapters reject callback failures and promise rejections; popup reports failed saves", async () => {
  const options = await surface("options"), popup = await surface("popup");
  try {
    options.fail(true);
    await assert.rejects(options.adapter.save(options.context.BC.cloneDefaults()), /Quota exceeded/);
    await assert.rejects(options.adapter.saveLocal({ notes: {} }), /Quota exceeded/);
    options.context.chrome.storage.local.set = () => Promise.reject(new Error("Disk unavailable"));
    await assert.rejects(options.adapter.save(options.context.BC.cloneDefaults()), /Disk unavailable/);
    popup.fail(true);
    popup.dom.window.document.getElementById("enabled").dispatchEvent(new popup.dom.window.Event("change"));
    await settle();
    assert.match(popup.dom.window.document.getElementById("save-error").textContent, /Quota exceeded/);
  } finally { options.dom.window.close(); popup.dom.window.close(); }
});

test("settings flush rejects failed saves so Apply and import can await persistence", async () => {
  const { dom, context } = domContext();
  try {
    load(context, "src/shared/defaults.js", "src/content/core/util.js", "src/shared/settings/state.js");
    const store = context.BC.SettingsState.create({ getState: context.BC.cloneDefaults, save: async () => { throw Error("Disk full"); } });
    store.importJSON('{"grades":{"goals":{"bad":{"target":"<img>"}}}}');
    assert.equal(store.get().grades.goals.bad, undefined);
    await assert.rejects(store.flush(), /Disk full/);
    assert.match(store.saveError.message, /Disk full/);
    store.destroy();
  } finally { dom.window.close(); }
});
