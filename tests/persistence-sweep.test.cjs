const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { root, load } = require("./audit-helpers.cjs");
const { database } = require("./storage-harness.cjs");

async function feature(db, name, expose) {
  const tab = db.tab(); await tab.storage.load();
  tab.context.BC.registry = { register() {} }; tab.context.BC.util.warn = () => {};
  vm.runInContext(fs.readFileSync(path.join(root, "src/content/features/" + name + ".js"), "utf8")
    .replace("  BC.registry.register({", "  BC.testAction = " + expose + ";\n  BC.registry.register({"), tab.context);
  return tab;
}

test("navigation retries the same snapshot after a rejected write", async () => {
  const db = database(), a = await feature(db, "navigation", "snapshot"), BC = a.context.BC;
  BC.readGlobalNav = () => ["Dashboard"]; BC.readCourseNav = () => ["Grades"];
  db.fail("quota"); BC.testAction(); await a.storage.updateLocal(() => {});
  assert.equal(db.data.bcLocal.navItems, undefined);
  db.fail(null); BC.testAction(); await a.storage.updateLocal(() => {});
  assert.deepEqual(db.data.bcLocal.navItems, ["Dashboard"]);
  assert.deepEqual(db.data.bcLocal.courseNavItems, ["Grades"]);
});

test("a retained announcement scan cannot lower another context's high-water mark", async () => {
  const old = "2026-10-01T00:00:00Z", middle = "2026-10-02T00:00:00Z", latest = "2026-10-03T00:00:00Z";
  const db = database({ bcLocal: { annSeenAt: old } }), a = await feature(db, "notifications", "scanAnnouncements"), b = db.tab();
  await b.storage.load(); const BC = a.context.BC;
  load(a.context, "src/content/core/datetime.js");
  let release;
  BC.api = { courseAnnouncements: () => new Promise((resolve) => { release = () => resolve([{ id: 1, posted_at: middle }]); }) };
  BC.toast = { info() {} };
  const scan = BC.testAction({ notifications: { inPage: false, enabled: false } }, [{ id: 1 }]);
  assert.ok(release);
  await b.storage.updateLocal((d) => { d.annSeenAt = latest; });
  release(); await scan; await a.storage.updateLocal(() => {});
  assert.equal(db.data.bcLocal.annSeenAt, latest);
});
