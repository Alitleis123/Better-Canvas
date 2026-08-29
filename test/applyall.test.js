"use strict";
const { createSandbox, loadCore, load } = require("./harness");

// Drive the real registry + a simulated page sequence through the same
// shouldApply rule content.js uses, with recording features standing in for the
// real ones.
function harness() {
  const sb = createSandbox();
  loadCore(sb);
  sb.window.addEventListener = () => {};
  load(sb, "src/content/core/lifecycle.js");
  const calls = [];
  const feature = (id, pages) => {
    const def = { id, pages, apply: (s, ctx) => calls.push(id + "@" + ctx.page) };
    sb.BC.registry.register(def);
    return def;
  };
  let lastPage = null;
  // Mirrors content.js's loop exactly.
  const applyAll = (page) => {
    const pageChanged = page !== lastPage;
    lastPage = page;
    for (const f of sb.BC.registry.all()) {
      if (!sb.BC.registry.shouldApply(f, page, pageChanged)) continue;
      f.apply({}, { page });
    }
  };
  return { BC: sb.BC, feature, applyAll, calls, reset: () => { calls.length = 0; } };
}

module.exports = {
  "the first pass applies every feature"() {
    const h = harness();
    h.feature("global");
    h.feature("dash", ["dashboard"]);
    h.feature("grades", ["grades"]);
    h.applyAll("dashboard");
    assert.deepEqual(h.calls.sort(), ["dash@dashboard", "global@dashboard", "grades@dashboard"]);
  },

  "steady-state ticks skip off-page features"() {
    const h = harness();
    h.feature("global");
    h.feature("dash", ["dashboard"]);
    h.feature("grades", ["grades"]);
    h.applyAll("dashboard");   // first pass
    h.reset();
    h.applyAll("dashboard");
    h.applyAll("dashboard");
    assert.deepEqual(h.calls, ["global@dashboard", "dash@dashboard", "global@dashboard", "dash@dashboard"],
      "grades must not be called while off its page");
  },

  "navigating away gives the departing feature exactly one cleanup call"() {
    const h = harness();
    h.feature("dash", ["dashboard"]);
    h.applyAll("dashboard");
    h.reset();
    h.applyAll("grades");      // navigation
    assert.deepEqual(h.calls, ["dash@grades"], "the cleanup call must happen");
    h.reset();
    h.applyAll("grades");      // steady state on the new page
    h.applyAll("grades");
    assert.deepEqual(h.calls, [], "and must not repeat");
  },

  "navigating back re-applies the feature"() {
    const h = harness();
    h.feature("dash", ["dashboard"]);
    h.applyAll("dashboard");
    h.applyAll("grades");
    h.reset();
    h.applyAll("dashboard");
    assert.deepEqual(h.calls, ["dash@dashboard"]);
  },

  "a multi-page feature runs on each of its pages without a cleanup gap"() {
    const h = harness();
    h.feature("grades", ["grades", "assignment"]);
    h.applyAll("grades");
    h.reset();
    h.applyAll("assignment");
    assert.deepEqual(h.calls, ["grades@assignment"]);
    h.reset();
    h.applyAll("assignment");
    assert.deepEqual(h.calls, ["grades@assignment"], "still on one of its pages, so it keeps running");
  },

  "global features run on every page and on every tick"() {
    const h = harness();
    h.feature("theming");
    for (const p of ["dashboard", "grades", "course", "other", "inbox"]) h.applyAll(p);
    h.reset();
    h.applyAll("inbox");
    h.applyAll("inbox");
    assert.deepEqual(h.calls, ["theming@inbox", "theming@inbox"]);
  },

  "the real feature set skips most features on a course page"() {
    // The point of the change: on a course page the dashboard-only features
    // should not be entered at all.
    const h = harness();
    const scoped = {
      dashboard: ["dashboard"], files: ["dashboard"], announcements: ["dashboard"],
      calendar: ["dashboard"], semester: ["dashboard"], onboarding: ["dashboard"],
      modules: ["modules"], discussions: ["discussions"], syllabus: ["assignments"],
      grades: ["grades", "assignment"], instructor: ["course", "assignments"],
      quizsaver: ["course"],
    };
    const globals = ["theming", "cosmetics", "navigation", "todo", "productivity",
                     "accessibility", "previews", "notifications", "insights", "rotation"];
    for (const g of globals) h.feature(g);
    for (const [id, pages] of Object.entries(scoped)) h.feature(id, pages);

    h.applyAll("course");   // first pass applies everything
    h.reset();
    h.applyAll("course");   // steady state

    const ran = new Set(h.calls.map((c) => c.split("@")[0]));
    for (const g of globals) assert.ok(ran.has(g), `global feature ${g} should still run`);
    assert.ok(ran.has("instructor"), "instructor is scoped to course");
    assert.ok(ran.has("quizsaver"), "quizsaver is scoped to course");
    for (const off of ["dashboard", "files", "announcements", "calendar", "semester",
                       "onboarding", "modules", "discussions", "syllabus", "grades"]) {
      assert.notOk(ran.has(off), `${off} should be skipped on a course page`);
    }
    assert.equal(ran.size, globals.length + 2);
  },

  "a page-scoped feature is never entered on a page it does not claim, after cleanup"() {
    const h = harness();
    h.feature("modules", ["modules"]);
    h.applyAll("modules");
    h.applyAll("dashboard");   // cleanup call
    h.reset();
    for (let i = 0; i < 20; i++) h.applyAll("dashboard");
    assert.deepEqual(h.calls, []);
  },

  "features registered later are still scoped correctly"() {
    const h = harness();
    h.applyAll("grades");
    h.feature("late", ["dashboard"]);
    h.reset();
    h.applyAll("grades");
    assert.deepEqual(h.calls, [], "a feature registered mid-session must respect its scope");
  },
};
