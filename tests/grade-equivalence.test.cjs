const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { performance } = require("node:perf_hooks");
const { load } = require("./audit-helpers.cjs");
function solver() {
  const context = vm.createContext({ BC: { registry: { register() {} } } });
  load(context, "src/content/features/grades.js");
  return context.BC.grades.computeTotal;
}
const assignment = (id, score, possible) => ({ id, points_possible: possible, submission: { score } });
const ratio = (items) => {
  const possible = items.reduce((sum, a) => sum + Math.max(0, a.points_possible), 0);
  return possible ? items.reduce((sum, a) => sum + a.submission.score, 0) / possible * 100 : null;
};
function subsets(items, count) {
  const result = [];
  function visit(start, chosen) {
    if (chosen.length === count) { result.push(chosen); return; }
    for (let i = start; i < items.length; i++) visit(i + 1, chosen.concat(items[i]));
  }
  visit(0, []); return result;
}
// Independent exhaustive reference from the round-one review. It enumerates
// every retained subset instead of using the production fractional solver.
function reference(group) {
  const graded = group.assignments.filter((a) => !a.omit_from_final_grade && a.workflow_state !== "unpublished" &&
    !(a.submission_types || []).includes("not_graded") && a.submission && !a.submission.excused &&
    a.submission.workflow_state !== "pending_review" && a.submission.score != null && a.submission.score !== "" && Number.isFinite(Number(a.submission.score)));
  const rules = group.rules || {}, never = new Set((rules.never_drop || []).map(String));
  const fixed = graded.filter((a) => never.has(String(a.id)));
  let eligible = graded.filter((a) => !never.has(String(a.id)));
  if (!eligible.length) return ratio(fixed);
  const low = Math.min(rules.drop_lowest || 0, eligible.length - 1);
  const high = low + (rules.drop_highest || 0) >= eligible.length ? 0 : rules.drop_highest || 0;
  for (const [drop, maximize] of [[low, true], [high, false]]) if (drop) {
    const choices = subsets(eligible, eligible.length - drop).filter((items) => fixed.concat(items).some((a) => a.points_possible > 0));
    if (choices.length) eligible = choices.sort((a, b) => (maximize ? -1 : 1) * (ratio(fixed.concat(a)) - ratio(fixed.concat(b))))[0];
  }
  return ratio(fixed.concat(eligible));
}
test("drop solver matches 2000 fixed-seed exhaustive subset comparisons plus eligibility cases", () => {
  const total = solver(); let seed = 77;
  const rand = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let trial = 0; trial < 2000; trial++) {
    const group = { assignments: Array.from({ length: 3 + rand(5) }, (_, i) => assignment(i, rand(41) - 5, [0, 1, 10, 20, 100][rand(5)])),
      rules: { drop_lowest: rand(8), drop_highest: rand(8), never_drop: rand(3) ? [] : [String(rand(7))] } };
    const got = total([group]), want = reference(group);
    assert.ok(got === want || got != null && want != null && Math.abs(got - want) < 1e-7, JSON.stringify({ trial, group, got, want }));
  }
  for (let trial = 0; trial < 500; trial++) {
    const group = { rules: { drop_lowest: rand(3), drop_highest: rand(3), never_drop: [trial % 2 ? "0" : 0] }, assignments: [
      assignment(0, 3, 10), assignment(1, 20, 30), assignment(2, 0, 0), assignment(3, null, 100),
      { ...assignment(4, 0, 100), submission: { score: 0, excused: true } },
      { ...assignment(5, 0, 100), workflow_state: "unpublished" },
      { ...assignment(6, 0, 100), submission: { score: 0, workflow_state: "pending_review" } },
      { ...assignment(7, 0, 100), omit_from_final_grade: true },
      { ...assignment(8, 0, 100), submission_types: ["not_graded"] },
    ] };
    assert.equal(total([group]), reference(group));
  }
});

test("four groups of 100 assignments stay below 50 ms and cached results notice mutations", (t) => {
  const total = solver();
  const groups = Array.from({ length: 4 }, (_, g) => ({ group_weight: 25, rules: { drop_lowest: 2, drop_highest: 1 },
    assignments: Array.from({ length: 100 }, (_, i) => assignment(g * 1000 + i, i % 11, 10 + i % 5)) }));
  // Fresh group identities exercise uncached solving on each measured call.
  const timings = [];
  for (let i = 0; i < 5; i++) {
    const fresh = structuredClone(groups), start = performance.now(); total(fresh); timings.push(performance.now() - start);
  }
  const start = performance.now(); const before = total(groups); const cold = performance.now() - start;
  const warmStart = performance.now(); assert.equal(total(groups), before); const warm = performance.now() - warmStart;
  groups[0].assignments[1].submission.score = 900;
  groups[0].rules.drop_highest = 0;
  assert.notEqual(total(groups), before);
  assert.ok(Math.max(...timings) < 50, JSON.stringify(timings));
  t.diagnostic(JSON.stringify({ uncachedMs: timings, coldMs: cold, cachedMs: warm }));
});

