const assert = require("node:assert/strict");
const test = require("node:test");
const { load, domContext, settle, copy } = require("./audit-helpers.cjs");

for (const deleted of [false, true]) {
  test("a " + (deleted ? "deleted" : "failed") + " locker item does not block another dirty item's save", async () => {
    const db = require("./storage-harness.cjs").database({
      "bcLocker:item:a": { id: "a", type: "note", title: "A", body: "old A" },
      "bcLocker:item:b": { id: "b", type: "note", title: "B", body: "old B" },
    });
    const page = domContext("", { chrome: db.client().chrome });
    load(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/storage.js", "src/shared/settings/locker.js");
    const BC = page.context.BC, errors = [], attempts = [];
    BC.toast = { error: (message) => errors.push(message) };
    const save = BC.storage.request;
    BC.storage.request = (message) => {
      if (message.action === "update") {
        attempts.push(message.item.id);
        if (!deleted && message.item.id === "a") return Promise.reject(new Error("quota for A"));
      }
      return save(message);
    };
    const root = BC.renderLocker(); page.dom.window.document.body.append(root);
    const select = (name) => [...root.querySelectorAll(".bcs-locker-item")].find((b) => b.textContent.startsWith(name)).click();
    const edit = (text) => { const input = root.querySelector("textarea"); input.value = text; input.dispatchEvent(new page.dom.window.Event("input")); };
    const clickSave = () => [...root.querySelectorAll("button")].find((b) => b.textContent === "Save").click();
    try {
      await settle(); await settle(); select("A");
      if (deleted) {
        const other = db.tab(); load(other.context, "src/shared/settings/locker.js");
        await other.context.BC.Locker.remove("a");
      }
      edit("retained A edit"); select("B"); edit("important new B"); clickSave();
      await settle(); await settle();
      assert.equal(db.data["bcLocker:item:b"].body, "important new B");
      assert.match(root.querySelector('[role="status"]').textContent, deleted ? /deleted in another window/ : /Could not save/);
      assert.match(errors.at(-1), deleted ? /deleted in another window/ : /quota for A/);
      const beforeRetry = attempts.length;
      clickSave(); await settle(); await settle();
      assert.equal(attempts.slice(beforeRetry).includes("a"), !deleted);
      if (deleted) assert.equal(db.data["bcLocker:item:a"], undefined);
      else {
        BC.storage.request = save; clickSave(); await settle(); await settle();
        assert.equal(db.data["bcLocker:item:a"].body, "retained A edit");
      }
    } finally { await root.dispose().catch(() => {}); page.dom.window.close(); }
  });
}

test("failed locker edits stay dirty across item switches and export retries inactive edits", async () => {
  const db = require("./storage-harness.cjs").database({
    "bcLocker:item:a": { id: "a", type: "note", title: "A", body: "old A" },
    "bcLocker:item:b": { id: "b", type: "note", title: "B", body: "old B" },
  });
  const page = domContext("", { chrome: db.client().chrome, Blob });
  let exported;
  page.context.URL.createObjectURL = (blob) => { exported = blob; return "blob:test"; };
  page.context.URL.revokeObjectURL = () => {};
  page.dom.window.HTMLAnchorElement.prototype.click = () => {};
  load(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/storage.js", "src/shared/settings/locker.js");
  page.context.BC.toast = { error() {} };
  const root = page.context.BC.renderLocker(); page.dom.window.document.body.append(root);
  const select = (name) => [...root.querySelectorAll(".bcs-locker-item")].find((b) => b.textContent.startsWith(name)).click();
  const button = (text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text);
  const edit = (text) => { const ta = root.querySelector("textarea"); ta.value = text; ta.dispatchEvent(new page.dom.window.Event("input")); };
  try {
    await settle(); await settle(); select("A"); edit("unsaved important edit");
    db.fail("quota"); button("Save").click(); await settle(); await settle();
    select("B"); await settle(); await settle();
    assert.match(root.querySelector('[role="status"]').textContent, /Could not save/);
    db.fail(null); select("A"); button("Save").click(); await settle(); await settle();
    assert.equal(db.data["bcLocker:item:a"].body, "unsaved important edit");
    assert.equal(root.querySelector("textarea").value, "unsaved important edit");
    assert.equal(root.querySelector('[role="status"]').textContent, "Saved on this device");
    edit("second unsaved edit"); db.fail("quota"); select("B"); await settle(); await settle();
    db.fail(null); button("Export").click();
    for (let i = 0; i < 100 && !exported; i++) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(exported);
    assert.equal(JSON.parse(await exported.text()).items.find((item) => item.id === "a").body, "second unsaved edit");
  } finally { db.fail(null); await root.dispose(); page.dom.window.close(); }
});

test("failed locker deletion keeps the dirty editor available for retry", async () => {
  const db = require("./storage-harness.cjs").database({ "bcLocker:item:a": { id: "a", type: "note", title: "A", body: "old" } });
  const remove = db.api.remove;
  db.api.remove = (_keys, callback) => {
    queueMicrotask(() => { db.runtime.lastError = { message: "Delete failed" }; callback(); delete db.runtime.lastError; });
  };
  const page = domContext("", { chrome: db.client().chrome, confirm: () => true });
  load(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/storage.js", "src/shared/settings/locker.js");
  page.context.BC.toast = { error() {} };
  const root = page.context.BC.renderLocker(); page.dom.window.document.body.append(root);
  const button = (text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text);
  try {
    await settle(); await settle(); root.querySelector(".bcs-locker-item").click();
    const ta = root.querySelector("textarea"); ta.value = "keep this edit"; ta.dispatchEvent(new page.dom.window.Event("input"));
    db.fail("quota"); button("Delete").click(); await settle(); await settle();
    assert.equal(root.querySelector("textarea").value, "keep this edit");
    assert.match(root.querySelector('[role="status"]').textContent, /Could not save/);
    db.api.remove = remove; db.fail(null); button("Save").click(); await settle(); await settle();
    assert.equal(db.data["bcLocker:item:a"].body, "keep this edit");
  } finally { db.fail(null); await root.dispose(); page.dom.window.close(); }
});

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


test("locker export flushes local editors and reads creates and deletes from another context", async () => {
  const db = require("./storage-harness.cjs").database({
    "bcLocker:item:edit": { id: "edit", type: "note", title: "Editing", body: "old" },
    "bcLocker:item:gone": { id: "gone", type: "note", title: "Deleted elsewhere" },
    "bcLocker:item:untouched": { id: "untouched", type: "note", title: "Old cached title" },
  });
  const page = domContext("", { chrome: db.client().chrome, Blob });
  let exported;
  page.context.URL.createObjectURL = (blob) => { exported = blob; return "blob:test"; };
  page.context.URL.revokeObjectURL = () => {};
  page.dom.window.HTMLAnchorElement.prototype.click = () => {};
  load(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/storage.js", "src/shared/settings/locker.js");
  const BC = page.context.BC, roots = [BC.renderLocker(), BC.renderLocker()];
  for (const root of roots) page.dom.window.document.body.append(root);
  const other = db.tab(); load(other.context, "src/shared/settings/locker.js");
  try {
    await settle(); await settle();
    for (const [index, root] of roots.entries()) {
      [...root.querySelectorAll(".bcs-locker-item")].find((button) => button.textContent.includes(index ? "Old cached title" : "Editing")).click();
    }
    const title = roots[0].querySelector('[aria-label="Title"]'); title.value = "Unsaved local edit";
    title.dispatchEvent(new page.dom.window.Event("input"));
    await other.context.BC.Locker.create({ id: "new", type: "note", title: "Created elsewhere" });
    await other.context.BC.Locker.remove("gone");
    await other.context.BC.Locker.save({ id: "untouched", type: "note", title: "Current stored title" });
    [...roots[0].querySelectorAll("button")].find((button) => button.textContent === "Export").click();
    for (let i = 0; i < 100 && !exported; i++) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(exported);
    const data = JSON.parse(await exported.text());
    assert.deepEqual(data.items, copy(await BC.Locker.list()));
    assert.equal(data.items.find((item) => item.id === "edit").title, "Unsaved local edit");
    assert.equal(data.items.find((item) => item.id === "untouched").title, "Current stored title");
    assert.equal(data.items.some((item) => item.id === "new"), true);
    assert.equal(data.items.some((item) => item.id === "gone"), false);
    assert.equal(db.data["bcLocker:item:edit"].title, "Unsaved local edit");
  } finally { await Promise.all(roots.map((root) => root.dispose())); page.dom.window.close(); }
});
