const assert = require("node:assert/strict");
const test = require("node:test");
const { load, domContext, settle, copy } = require("./audit-helpers.cjs");

test("disposing a locker with pending autosave then deleting in another renderer stays deleted", async () => {
  const data = { "bcLocker:item:test": { id: "test", type: "note", title: "Original", body: "old" } };
  const timers = new Map(); let next = 0;
  const chrome = { runtime: {}, storage: { local: {
    get: (_key, cb) => queueMicrotask(() => cb(copy(data))),
    set: (values, cb) => queueMicrotask(() => { Object.assign(data, copy(values)); cb(); }),
    remove: (key, cb) => queueMicrotask(() => { delete data[key]; cb(); }),
  } } };
  const { dom, context } = domContext("", { chrome, confirm: () => true,
    setTimeout: (fn) => { timers.set(++next, fn); return next; }, clearTimeout: (id) => timers.delete(id),
  });
  try {
    load(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/shared/settings/locker.js");
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
    assert.equal(data["bcLocker:item:test"], undefined);
    assert.equal((await context.BC.Locker.list()).length, 0);
    assert.equal(timers.size, 0);
    await second.dispose();
  } finally { dom.window.close(); }
});
