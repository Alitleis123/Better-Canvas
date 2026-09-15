"use strict";
const { createSandbox, loadCore } = require("./harness");
const BC = loadCore(createSandbox());
const U = BC.util;

module.exports = {
  "deepEqual agrees with a JSON round trip on comparable values"() {
    const cases = [
      [1, 1, true], [1, 2, false], ["a", "a", true], [null, null, true],
      [null, undefined, false], [{}, {}, true], [{ a: 1 }, { a: 1 }, true],
      [{ a: 1 }, { a: 2 }, false], [{ a: 1 }, { a: 1, b: 2 }, false],
      [[1, 2], [1, 2], true], [[1, 2], [2, 1], false], [[1], [1, 2], false],
      [{ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }, true],
      [{ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] }, false],
      [[], {}, false], [{}, [], false],
    ];
    for (const [a, b, want] of cases) {
      assert.equal(U.deepEqual(a, b), want, `deepEqual(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
    }
  },

  "deepEqual distinguishes a missing key from an undefined one"() {
    assert.notOk(U.deepEqual({ a: 1 }, { a: 1, b: undefined }));
  },

  "escapeHtml neutralises every character that can break out of markup"() {
    assert.equal(U.escapeHtml('<script>"x"&\'y\''), "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;");
    assert.equal(U.escapeHtml(null), "");
    assert.equal(U.escapeHtml(undefined), "");
    assert.equal(U.escapeHtml(0), "0");
  },

  "isSafeUrl allows http(s) and data images only"() {
    assert.ok(U.isSafeUrl("https://x.com/a.png"));
    assert.ok(U.isSafeUrl("http://x.com/a.png"));
    assert.ok(U.isSafeUrl("data:image/png;base64,AAAA"));
    assert.notOk(U.isSafeUrl("javascript:alert(1)"));
    assert.notOk(U.isSafeUrl("data:text/html,<script>"));
    assert.notOk(U.isSafeUrl(""));
    assert.notOk(U.isSafeUrl(null));
  },

  "isSafeHttpUrl rejects non-http schemes"() {
    assert.ok(U.isSafeHttpUrl("https://x.com"));
    assert.notOk(U.isSafeHttpUrl("javascript:alert(1)"));
    assert.notOk(U.isSafeHttpUrl("not a url"));
    assert.notOk(U.isSafeHttpUrl("data:image/png;base64,AA"));
  },

  "courseIdFromHref pulls the id from any course path"() {
    assert.equal(U.courseIdFromHref("/courses/123"), "123");
    assert.equal(U.courseIdFromHref("/courses/123/grades"), "123");
    assert.equal(U.courseIdFromHref("https://x.instructure.com/courses/9/assignments/1"), "9");
    assert.equal(U.courseIdFromHref("/dashboard"), null);
    assert.equal(U.courseIdFromHref(null), null);
  },

  "clamp bounds both ends"() {
    assert.equal(U.clamp(5, 0, 10), 5);
    assert.equal(U.clamp(-1, 0, 10), 0);
    assert.equal(U.clamp(99, 0, 10), 10);
  },

  "mapLimit preserves input order regardless of completion order"() {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    return U.mapLimit(items, 3, (n) => new Promise((r) => setTimeout(() => r(n * 2), (10 - n) * 2)))
      .then((out) => assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14, 16]));
  },

  "mapLimit never exceeds its concurrency budget"() {
    let live = 0, peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    return U.mapLimit(items, 4, () => {
      live++; peak = Math.max(peak, live);
      return new Promise((r) => setTimeout(() => { live--; r(1); }, 5));
    }).then(() => assert.ok(peak <= 4, `peak concurrency ${peak} exceeded 4`));
  },

  "mapLimit handles an empty list"() {
    return U.mapLimit([], 4, () => 1).then((out) => assert.deepEqual(out, []));
  },

  "uuid produces distinct ids"() {
    const seen = new Set();
    for (let i = 0; i < 2000; i++) seen.add(U.uuid());
    assert.equal(seen.size, 2000);
  },

  "cssSafe strips angle brackets"() {
    assert.equal(U.cssSafe("a<b>c"), "abc");
    assert.equal(U.cssSafe(null), "");
  },
};
