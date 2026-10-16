const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { root, load, domContext, settle, copy } = require("./audit-helpers.cjs");
const { database } = require("./storage-harness.cjs");
const key = "assignment:1";
async function view(db) {
  const client = db.client(), page = domContext("", { chrome: client.chrome, prompt: () => "Renamed" });
  load(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/datetime.js", "src/content/core/color.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/lifecycle.js", "src/content/core/storage.js");
  const BC = page.context.BC;
  await BC.storage.load(); BC.api = { plannerItemDone: () => false };
  BC.ui.sheet = (opts) => ({ open() { for (const node of opts.body) page.dom.window.document.body.append(node); }, close() {} });
  const source = fs.readFileSync(path.join(root, "src/content/features/todo.js"), "utf8")
    .replace("  BC.registry.register({", "  BC.testOpenDetails = openDetails; BC.testPruneSnoozes = pruneSnoozes;\n  BC.registry.register({");
  vm.runInContext(source, page.context);
  BC.testOpenDetails({ plannable_type: "assignment", plannable: { id: 1, title: "Assignment" } });
  const doc = page.dom.window.document;
  return { ...page, BC, client, doc,
    async drain() { await BC.storage.updateLocal(() => {}); await settle(); await settle(); },
    enter(label, text) { const input = doc.querySelector('[aria-label="' + label + '"]'); input.value = text; input.dispatchEvent(new page.dom.window.KeyboardEvent("keydown", { key: "Enter" })); },
    complete(index) { const input = doc.querySelectorAll('.pld-subs input')[index]; input.checked = true; input.dispatchEvent(new page.dom.window.Event("change")); },
  };
}
function seed() { return database({ bcLocal: { todo: { subtasks: { [key]: [{ text: "Read", done: false }, { text: "Write", done: false }] }, tagsByItem: { [key]: ["base"] } } } }); }

test("independent details sheets complete different legacy step ids without losing either edit", async () => {
  const db = seed(), a = await view(db), b = await view(db);
  try {
    const ids = copy(a.BC.storage.local.todo.subtasks[key].map((step) => step.id));
    assert.deepEqual(ids, copy(b.BC.storage.local.todo.subtasks[key].map((step) => step.id)));
    assert.equal(new Set(ids).size, 2);
    a.complete(0); await a.drain();
    b.client.deliver(db.events.at(-1)); await settle(); await settle();
    b.complete(1); await b.drain();
    assert.deepEqual(db.data.bcLocal.todo.subtasks[key].map((s) => s.done), [true, true]);
    assert.deepEqual(db.data.bcLocal.todo.subtasks[key].map((s) => s.id), ids);
  } finally { a.dom.window.close(); b.dom.window.close(); }
});

test("independent details sheets add tags and remove one tag while another adds one", async () => {
  const db = seed(), a = await view(db), b = await view(db);
  try {
    a.enter("Add a tag", "A"); await a.drain();
    b.client.deliver(db.events.at(-1)); await settle();
    b.enter("Add a tag", "B"); await b.drain();
    assert.deepEqual(db.data.bcLocal.todo.tagsByItem[key], ["base", "A", "B"]);
    // A still renders its original base chip and knows nothing about B's addition.
    a.doc.querySelector('.pld-chips button').click();
    b.enter("Add a tag", "C"); await Promise.all([a.drain(), b.drain()]);
    assert.deepEqual(new Set(db.data.bcLocal.todo.tagsByItem[key]), new Set(["A", "B", "C"]));
    a.enter("Add a tag", "B"); await a.drain();
    assert.equal(db.data.bcLocal.todo.tagsByItem[key].filter((tag) => tag === "B").length, 1);
  } finally { a.dom.window.close(); b.dom.window.close(); }
});

test("step add, remove and rename operate by id on fresh steps after another context changes them", async () => {
  const db = seed(), a = await view(db), b = await view(db);
  try {
    const removed = b.doc.querySelector(".pld-subs input");
    a.doc.querySelector('[aria-label="Remove Read"]').click(); await a.drain();
    b.doc.querySelector('[aria-label="Rename Write"]').click(); await b.drain();
    assert.deepEqual(db.data.bcLocal.todo.subtasks[key].map((s) => s.text), ["Renamed"]);
    // A retained handler for the removed row must not recreate it.
    removed.checked = true; removed.dispatchEvent(new b.dom.window.Event("change")); await b.drain();
    a.enter("Add a step", "A"); b.enter("Add a step", "B");
    await Promise.all([a.drain(), b.drain()]);
    assert.deepEqual(new Set(db.data.bcLocal.todo.subtasks[key].map((s) => s.text)), new Set(["Renamed", "A", "B"]));
    const steps = db.data.bcLocal.todo.subtasks[key];
    assert.equal(new Set(steps.map((s) => s.id)).size, 3);
    assert.equal(steps[0].done, false);
  } finally { a.dom.window.close(); b.dom.window.close(); }
});


test("expired snooze cleanup rechecks fresh data before deleting a rescheduled item", async () => {
  const db = seed(), a = await view(db), b = db.tab(); await b.storage.load();
  try {
    const expired = new Date(Date.now() - 10000).toISOString(), future = new Date(Date.now() + 86400000).toISOString();
    await b.storage.updateLocal((d) => { d.todo.snoozed = { task: expired, old: expired }; });
    await b.storage.updateLocal((d) => { d.todo.snoozed.task = future; });
    await a.BC.testPruneSnoozes(["task", "old"]);
    assert.deepEqual(db.data.bcLocal.todo.snoozed, { task: future });
  } finally { a.dom.window.close(); }
});
