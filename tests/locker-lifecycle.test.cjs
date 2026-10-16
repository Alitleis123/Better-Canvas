const assert = require("node:assert/strict");
const test = require("node:test");
const { load, domContext, settle, copy } = require("./audit-helpers.cjs");

test("disposing a locker with pending autosave then deleting in another renderer stays deleted", async () => {
  const data = { "bcLocker:item:test": { id: "test", type: "note", title: "Original", body: "old" } };
  const timers = new Map(); let next = 0;
  const db = require("./storage-harness.cjs").database(data), chrome = db.client().chrome;
  const { dom, context } = domContext("", { chrome, confirm: () => true,
    setTimeout: (fn) => { timers.set(++next, fn); return next; }, clearTimeout: (id) => timers.delete(id),
  });
  try {
    load(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/storage.js", "src/shared/settings/locker.js");
    const first = context.BC.renderLocker(); dom.window.document.body.append(first); await settle();
    first.querySelector(".bcs-locker-item").click();
    const title = first.querySelector('[aria-label="Title"]'); title.value = "Pending edit";
    title.dispatchEvent(new dom.window.Event("input"));
    assert.equal(timers.size, 1);
    const staleCallback = [...timers.values()][0];
    const disposing = first.dispose(); first.remove();
    const second = context.BC.renderLocker(); dom.window.document.body.append(second); await settle();
    second.querySelector(".bcs-locker-item").click();
    [...second.querySelectorAll("button")].find((button) => button.textContent === "Delete").click();
    await disposing; await settle();
    staleCallback();
    // Detached controls and a callback already dispatched before cancellation cannot save.
    title.dispatchEvent(new dom.window.Event("input")); title.dispatchEvent(new dom.window.Event("blur"));
    await settle();
    assert.equal(db.data["bcLocker:item:test"], undefined);
    assert.equal((await context.BC.Locker.list()).length, 0);
    assert.equal(timers.size, 0);
    await second.dispose();
  } finally { dom.window.close(); }
});

test("deletion in an independent context wins over a pending locker autosave", async () => {
  const db = require("./storage-harness.cjs").database({ "bcLocker:item:shared": { id: "shared", type: "note", title: "Original", body: "old" } });
  async function view() {
    const timers = new Map(); let next = 0;
    const page = domContext("", { chrome: db.client().chrome, confirm: () => true,
      setTimeout: (fn) => { timers.set(++next, fn); return next; }, clearTimeout: (id) => timers.delete(id),
    });
    load(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/storage.js", "src/shared/settings/locker.js");
    const errors = []; page.context.BC.toast = { error: (message) => errors.push(message) };
    const root = page.context.BC.renderLocker(); page.dom.window.document.body.append(root); await settle();
    root.querySelector(".bcs-locker-item").click();
    return { ...page, root, timers, errors };
  }
  const a = await view(), b = await view();
  try {
    const title = a.root.querySelector('[aria-label="Title"]'); title.value = "Pending in A";
    title.dispatchEvent(new a.dom.window.Event("input"));
    const staleTimer = [...a.timers.values()][0];
    [...b.root.querySelectorAll("button")].find((button) => button.textContent === "Delete").click(); await settle();
    assert.equal(db.data["bcLocker:item:shared"], undefined);
    staleTimer(); await settle();
    assert.equal(db.data["bcLocker:item:shared"], undefined);
    assert.match(a.errors[0], /deleted in another window/);
    assert.equal((await a.context.BC.Locker.list()).length, 0);
    await assert.rejects(a.root.dispose(), /deleted in another window/);
    await b.root.dispose();
    assert.deepEqual(db.data["bcLocker:index"], []);
    assert.equal(Object.keys(db.data).some((key) => key.includes("tombstone")), false);
  } finally { a.dom.window.close(); b.dom.window.close(); }
});

test("locker creates are explicit and old-browser indexing scans only once", async () => {
  const db = require("./storage-harness.cjs").database(); delete db.api.getKeys;
  const a = db.tab();
  load(a.context, "src/shared/settings/locker.js");
  const item = { id: "explicit", type: "note", title: "new" };
  await assert.rejects(a.context.BC.Locker.save(item), /deleted in another window/);
  await a.context.BC.Locker.create(item);
  await assert.rejects(a.context.BC.Locker.create(item), /already exists/);
  await a.context.BC.Locker.remove(item.id);
  await assert.rejects(a.context.BC.Locker.save(item), /deleted in another window/);
  assert.equal(db.requests.filter((keys) => keys === null).length, 1);
});
