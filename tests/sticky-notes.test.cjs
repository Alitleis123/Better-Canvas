const assert = require("node:assert/strict");
const test = require("node:test");
const { database } = require("./storage-harness.cjs");
const { domContext, load, settle } = require("./audit-helpers.cjs");

test("two independent productivity contexts edit different notes on the same page without loss", async () => {
  const key = "http://bc-test.instructure.com/";
  const db = database({ bcLocal: { notes: { [key]: [
    { id: "a", text: "old A", x: 120, y: 130 }, { id: "b", text: "old B", x: 220, y: 230 },
  ] } } });
  async function view() {
    const tab = db.client(), page = domContext("", { chrome: tab.chrome });
    load(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/lifecycle.js", "src/content/core/storage.js");
    const BC = page.context.BC;
    BC.injector = { setStyle() {}, removeNode() {} }; BC.util.debounce = (fn) => fn;
    await BC.storage.load();
    load(page.context, "src/content/features/productivity.js");
    BC.features.productivity.apply({ productivity: { stickyNotes: true, quickActions: false } });
    await settle();
    return { ...page, BC };
  }
  const a = await view(), b = await view();
  try {
    const edit = (page, id, text) => {
      const input = page.dom.window.document.querySelector(`[data-note-id="${id}"] textarea`);
      input.value = text; input.dispatchEvent(new page.dom.window.Event("input"));
    };
    edit(a, "a", "new A"); edit(b, "b", "new B");
    await Promise.all([a.BC.storage.updateLocal(() => {}), b.BC.storage.updateLocal(() => {})]);
    assert.deepEqual(db.data.bcLocal.notes[key], [
      { id: "a", text: "new A", x: 120, y: 130 }, { id: "b", text: "new B", x: 220, y: 230 },
    ]);
    // A stale editor cannot recreate a note deleted in another context.
    b.dom.window.document.querySelector('[data-note-id="a"] button').click();
    await b.BC.storage.updateLocal(() => {});
    edit(a, "a", "stale"); await a.BC.storage.updateLocal(() => {});
    assert.deepEqual(db.data.bcLocal.notes[key].map((n) => n.id), ["b"]);
    assert.ok(db.requests.every((keys) => JSON.stringify(keys) === '["bcLocal"]' || JSON.stringify(keys) === '["bcSettings","bcLocal"]'));
  } finally { a.BC.features.productivity.unmount(); b.BC.features.productivity.unmount(); a.dom.window.close(); b.dom.window.close(); }
});
