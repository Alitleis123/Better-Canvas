"use strict";
const { createSandbox, loadCore, load } = require("./harness");

// grades.js registers a feature and touches BC.injector/BC.ui at module scope,
// so stub just enough for it to load; the maths under test is pure.
function loadGrades() {
  const sb = createSandbox();
  loadCore(sb);
  sb.BC.registry = { register() {} };
  sb.BC.injector = { setStyle() {}, removeNode() {}, ensureNode() {} };
  sb.BC.ui = { skeleton() {}, errorState() {} };
  sb.BC.api = {};
  sb.BC.lifecycle = { pageBag: () => ({ once() {}, interval() {} }) };
  sb.BC.cache = { invalidate() {} };
  sb.BC.storage = { local: {}, updateLocal: () => Promise.resolve() };
  load(sb, "src/content/features/grades.js");
  return sb.BC;
}

const BC = loadGrades();
const G = BC.grades;

const group = (weight, assignments) => ({ name: "g" + weight, group_weight: weight, assignments });
const asn = (score, possible, extra) => Object.assign({ points_possible: possible, submission: score == null ? null : { score } }, extra || {});

module.exports = {
  "gradePoints maps scores onto the right band"() {
    assert.equal(G.gradePoints(95, "standard-4").letter, "A");
    assert.equal(G.gradePoints(93, "standard-4").letter, "A");
    assert.equal(G.gradePoints(92.9, "standard-4").letter, "A-");
    assert.equal(G.gradePoints(0, "standard-4").letter, "F");
    assert.equal(G.gradePoints(59, "standard-4").points, 0);
  },

  "gradePoints falls back to the standard scale for an unknown key"() {
    assert.deepEqual(G.gradePoints(95, "no-such-scale"), G.gradePoints(95, "standard-4"));
  },

  "gradePoints never returns undefined for any score in range"() {
    for (const key of Object.keys(BC.GPA_SCALES)) {
      for (let s = 0; s <= 100; s += 0.5) {
        const r = G.gradePoints(s, key);
        assert.ok(r && typeof r.points === "number" && r.letter, `${key} @ ${s}`);
      }
    }
  },

  "computeTotal uses points when no group carries a weight"() {
    const total = G.computeTotal([group(0, [asn(8, 10), asn(9, 10)])]);
    assert.close(total, 85);
  },

  "computeTotal ignores unsubmitted work in points mode"() {
    const total = G.computeTotal([group(0, [asn(8, 10), asn(null, 10)])]);
    assert.close(total, 80, 0.001, "an ungraded assignment must not count against the total");
  },

  "computeTotal honours omit_from_final_grade"() {
    const total = G.computeTotal([group(0, [asn(8, 10), asn(0, 100, { omit_from_final_grade: true })])]);
    assert.close(total, 80);
  },

  "computeTotal weights groups by group_weight"() {
    // 100% on a 30-weight group, 50% on a 70-weight group.
    const total = G.computeTotal([
      group(30, [asn(10, 10)]),
      group(70, [asn(5, 10)]),
    ]);
    assert.close(total, 30 * 1 + 70 * 0.5, 0.001);
  },

  "computeTotal renormalises when a weighted group has no graded work yet"() {
    // Only the 30-weight group is graded, so the total is that group's score,
    // not a score dragged toward zero by an ungraded 70-weight group.
    const total = G.computeTotal([
      group(30, [asn(9, 10)]),
      group(70, [asn(null, 10)]),
    ]);
    assert.close(total, 90, 0.001);
  },

  "computeTotal returns null when nothing is graded"() {
    assert.equal(G.computeTotal([group(50, [asn(null, 10)])]), null);
    assert.equal(G.computeTotal([group(0, [asn(null, 10)])]), null);
    assert.equal(G.computeTotal([]), null);
  },

  "computeTotal tolerates groups with no assignments"() {
    assert.equal(G.computeTotal([{ name: "empty", group_weight: 50 }]), null);
  },

  "computeTotal handles extra credit above 100 percent"() {
    const total = G.computeTotal([group(0, [asn(12, 10)])]);
    assert.close(total, 120);
  },

  // ---- donut geometry ----------------------------------------------------

  "donutSegments covers the circle exactly once with no overlap"() {
    const cases = [
      [50, 30, 20],
      [40, 60],
      [33, 33, 34],
      [10, 10, 10, 70],
      [100],
      [5, 95],
    ];
    const C = 2 * Math.PI * 26;
    for (const weights of cases) {
      const segs = BC.grades.donutSegments(weights.map((w) => group(w, [])));
      let cursor = 0;
      for (const s of segs) {
        // A segment renders starting at arc length (C - offset).
        const start = C - s.offset;
        assert.close(start, cursor, 1e-6,
          `segment start ${start.toFixed(3)} should follow the previous at ${cursor.toFixed(3)} for weights ${weights}`);
        cursor += s.dash;
      }
      assert.close(cursor, C, 1e-6, `segments for ${weights} must fill the circle exactly`);
    }
  },

  "donutSegments dash and gap always sum to the circumference"() {
    const C = 2 * Math.PI * 26;
    const segs = BC.grades.donutSegments([group(25, []), group(75, [])]);
    for (const s of segs) assert.close(s.dash + s.gap, C, 1e-6);
  },

  "donutSegments reports percentages that reflect the weights"() {
    const segs = BC.grades.donutSegments([group(30, []), group(70, [])]);
    assert.equal(segs[0].percent, 30);
    assert.equal(segs[1].percent, 70);
  },

  "donutSegments normalises weights that do not sum to 100"() {
    const segs = BC.grades.donutSegments([group(1, []), group(1, [])]);
    assert.equal(segs[0].percent, 50);
    assert.equal(segs[1].percent, 50);
  },

  "donutSegments returns nothing when there is no weight to show"() {
    assert.deepEqual(BC.grades.donutSegments([]), []);
    assert.deepEqual(BC.grades.donutSegments([group(0, [])]), []);
    assert.deepEqual(BC.grades.donutSegments(null), []);
  },
};
