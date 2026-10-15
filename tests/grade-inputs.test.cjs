const assert = require("node:assert/strict");
const test = require("node:test");
const { load, domContext, settle } = require("./audit-helpers.cjs");
const payload = '"><img src=x onerror=alert(1)>';

test("grade imports reject HTML, nonfinite values and out-of-range goals and rubric points", () => {
  const { dom, context } = domContext();
  try {
    load(context, "src/shared/defaults.js");
    const settings = context.BC.mergeDefaults({ grades: { goals: { bad: { target: payload }, tooHigh: { target: 151 }, good: { target: "0" } } } });
    assert.equal(settings.grades.goals.bad, undefined);
    assert.equal(settings.grades.goals.tooHigh, undefined);
    assert.equal(settings.grades.goals.good.target, 0);
    const data = context.BC.cleanLocalData({ rubricDrafts: { 1: { bad: payload, negative: -1, infinite: "Infinity", good: "5" } } });
    assert.equal(Object.keys(data.rubricDrafts[1]).join(), "good");
    assert.equal(data.rubricDrafts[1].good, 5);
  } finally { dom.window.close(); }
});

test("grade and rubric renderers validate stored values, avoid injected elements and name inputs", async () => {
  const { dom, context } = domContext('<div id="main"><div id="grades_summary"></div></div><div id="right-side"></div>');
  try {
    load(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/datetime.js", "src/content/core/ui.js", "src/content/core/lifecycle.js");
    const BC = context.BC, nodes = new Map();
    BC.injector = { setStyle() {}, removeNode() {}, ensureNode(id, host, factory) { if (!nodes.has(id)) nodes.set(id, factory()); return nodes.get(id); } };
    BC.registry = { register(feature) { BC.feature = feature; } };
    BC.api = { assignmentGroups: async () => [], assignment: async () => ({ id: 1, rubric: [{ id: "c", points: 10, description: "Criterion" }] }) };
    BC.storage = { local: { rubricDrafts: { 1: { c: payload } } }, updateLocal() {}, update() {} };
    load(context, "src/content/features/grades.js");
    const settings = BC.cloneDefaults(); settings.grades.autoRefresh = false; settings.grades.goals = { 7: { target: payload } };
    BC.feature.apply(settings, { page: "grades", courseId: "7", path: "/courses/7/grades" });
    await settle();
    const goal = dom.window.document.querySelector("[data-goal]");
    assert.ok(goal);
    assert.equal(goal.value, "");
    for (const field of ["data-goal", "data-target", "data-weight"]) assert.ok(dom.window.document.querySelector("[" + field + "]").getAttribute("aria-label"));
    BC.feature.apply(settings, { page: "assignment", courseId: "7", path: "/courses/7/assignments/1" });
    await settle();
    assert.equal(dom.window.document.querySelector('input[type="range"]').value, "10");
    assert.equal(dom.window.document.querySelector("img"), null);
    assert.equal(dom.window.document.querySelector("[onerror]"), null);
  } finally { dom.window.close(); }
});
