"use strict";
const { createSandbox, loadCore, load } = require("./harness");

// Scripted fetch: each entry is { status, body, link } consumed in order, with
// a record of every request made.
function setup(responses) {
  const sb = createSandbox();
  const calls = [];
  let i = 0;
  sb.fetch = (url, opts) => {
    calls.push({ url, opts });
    const r = responses[Math.min(i++, responses.length - 1)];
    const headers = new Map();
    if (r.link) headers.set("link", r.link);
    return Promise.resolve({
      ok: r.status == null || (r.status >= 200 && r.status < 300),
      status: r.status || 200,
      headers: { get: (k) => headers.get(String(k).toLowerCase()) || null },
      text: () => Promise.resolve(typeof r.body === "string" ? r.body : JSON.stringify(r.body)),
    });
  };
  loadCore(sb);
  load(sb, "src/content/core/cache.js");
  load(sb, "src/content/core/api.js");
  return { api: sb.BC.api, calls, BC: sb.BC };
}

const page = (items, next) => ({
  body: items,
  link: next ? `<${next}>; rel="next", <https://school.instructure.com/last>; rel="last"` : null,
});

module.exports = {
  async "getJSON parses a plain JSON body"() {
    const { api } = setup([{ body: { id: 1 } }]);
    assert.deepEqual(await api.getJSON("/api/v1/x"), { id: 1 });
  },

  async "getJSON strips the anti-JSON-hijacking prefix Canvas sends"() {
    // Canvas prefixes API responses with while(1); -- leaving it in makes every
    // response a JSON parse error.
    const { api } = setup([{ body: 'while(1);{"id":2}' }]);
    assert.deepEqual(await api.getJSON("/api/v1/x"), { id: 2 });
  },

  async "getJSON sends session credentials"() {
    const { api, calls } = setup([{ body: {} }]);
    await api.getJSON("/api/v1/x");
    assert.equal(calls[0].opts.credentials, "include",
      "requests must ride the user's Canvas session");
  },

  async "getJSON requests string ids"() {
    // Canvas ids exceed Number.MAX_SAFE_INTEGER on large installs; without this
    // header they come back as numbers and silently lose precision.
    const { api, calls } = setup([{ body: {} }]);
    await api.getJSON("/api/v1/x");
    assert.match(calls[0].opts.headers.Accept, /json\+canvas-string-ids/);
  },

  async "a relative path is resolved against the Canvas origin"() {
    const { api, calls } = setup([{ body: {} }]);
    await api.getJSON("/api/v1/x");
    assert.equal(calls[0].url, "https://school.instructure.com/api/v1/x");
  },

  async "an absolute URL is used as given"() {
    const { api, calls } = setup([{ body: {} }]);
    await api.getJSON("https://other.test/api");
    assert.equal(calls[0].url, "https://other.test/api");
  },

  async "getList follows rel=next across pages"() {
    const { api, calls } = setup([
      page([1, 2], "https://school.instructure.com/api/v1/x?page=2"),
      page([3, 4], "https://school.instructure.com/api/v1/x?page=3"),
      page([5]),
    ]);
    assert.deepEqual(await api.getList("/api/v1/x"), [1, 2, 3, 4, 5]);
    assert.equal(calls.length, 3);
  },

  async "getList parses rel=next when the URL itself contains a comma"() {
    // Splitting the Link header on a bare comma truncates such URLs and silently
    // ends pagination early.
    const next = "https://school.instructure.com/api/v1/x?ids[]=1,2,3&page=2";
    const { api, calls } = setup([
      { body: [1], link: `<${next}>; rel="next"` },
      { body: [2] },
    ]);
    const out = await api.getList("/api/v1/x");
    assert.deepEqual(out, [1, 2]);
    assert.equal(calls[1].url, next, "the next URL was truncated at a comma inside it");
  },

  async "getList stops at maxPages"() {
    const { api, calls } = setup([page([1], "https://school.instructure.com/n")]);
    const out = await api.getList("/api/v1/x", { maxPages: 3 });
    assert.equal(calls.length, 3, "must not follow next forever");
    assert.equal(out.length, 3);
  },

  async "getList reports truncation when asked for metadata"() {
    const { api } = setup([page([1], "https://school.instructure.com/n")]);
    const meta = await api.getList("/api/v1/x", { maxPages: 2, withMeta: true });
    assert.equal(meta.truncated, true);
    assert.equal(meta.pages, 2);
    assert.deepEqual(meta.items, [1, 1]);
  },

  async "getList reports no truncation when it reached the end"() {
    const { api } = setup([page([1, 2])]);
    const meta = await api.getList("/api/v1/x", { maxPages: 5, withMeta: true });
    assert.equal(meta.truncated, false);
    assert.deepEqual(meta.items, [1, 2]);
  },

  async "getList tolerates a non-array page without corrupting the result"() {
    const { api } = setup([{ body: { error: "nope" } }]);
    assert.deepEqual(await api.getList("/api/v1/x"), []);
  },

  async "a 5xx is retried"() {
    const { api, calls } = setup([{ status: 500, body: {} }, { status: 500, body: {} }, { body: { ok: 1 } }]);
    assert.deepEqual(await api.getJSON("/api/v1/x"), { ok: 1 });
    assert.equal(calls.length, 3);
  },

  async "a 4xx is not retried"() {
    // Retrying a 401 or 404 just multiplies load against a request that cannot
    // succeed.
    const { api, calls } = setup([{ status: 404, body: {} }]);
    let err = null;
    try { await api.getJSON("/api/v1/x"); } catch (e) { err = e; }
    assert.ok(err, "a 4xx must reject");
    assert.equal(err.status, 404);
    assert.equal(calls.length, 1, "a 4xx must not be retried");
  },

  async "a persistent 5xx eventually rejects"() {
    const { api, calls } = setup([{ status: 503, body: {} }]);
    let err = null;
    try { await api.getJSON("/api/v1/x"); } catch (e) { err = e; }
    assert.ok(err);
    assert.equal(calls.length, 3, "retries must be bounded");
  },

  async "a TTL request is served from cache on the second call"() {
    const { api, calls } = setup([{ body: { v: 1 } }]);
    await api.getJSON("/api/v1/x", { ttl: 1000 });
    await api.getJSON("/api/v1/x", { ttl: 1000 });
    assert.equal(calls.length, 1);
  },

  async "requests without a TTL are never cached"() {
    const { api, calls } = setup([{ body: { v: 1 } }]);
    await api.getJSON("/api/v1/x");
    await api.getJSON("/api/v1/x");
    assert.equal(calls.length, 2);
  },

  async "list and item caches do not collide on the same URL"() {
    const { api, calls } = setup([{ body: [1] }, { body: [1] }]);
    await api.getList("/api/v1/x", { ttl: 1000 });
    await api.getJSON("/api/v1/x", { ttl: 1000 });
    assert.equal(calls.length, 2, "GET and LIST must use distinct cache keys");
  },

  async "every endpoint helper requests a documented TTL"() {
    const { BC } = setup([{ body: [] }]);
    for (const [name, ttl] of Object.entries(BC.api.TTL)) {
      assert.ok(typeof ttl === "number" && ttl > 0, `TTL.${name} must be a positive number`);
    }
  },

  async "planner writes invalidate the cached planner list"() {
    const { api, BC } = setup([{ body: [{ id: 1 }] }, { body: {} }, { body: [{ id: 2 }] }]);
    const key = "LIST https://school.instructure.com/api/v1/planner/items?per_page=100";
    await api.plannerItems();
    assert.ok(BC.cache.peek(key), "the planner list should be cached");
    await api.createPlannerNote({ title: "t", todoDate: new Date().toISOString() });
    assert.equal(BC.cache.peek(key), null,
      "creating a task must invalidate the planner list or the widget shows stale data");
  },

  async "mutations carry the CSRF token from the Canvas cookie"() {
    const sb = createSandbox();
    sb.document.cookie = "_csrf_token=abc%2Bdef; other=1";
    const calls = [];
    sb.fetch = (url, opts) => {
      calls.push({ url, opts });
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, text: () => Promise.resolve("{}") });
    };
    loadCore(sb);
    load(sb, "src/content/core/cache.js");
    load(sb, "src/content/core/api.js");
    await sb.BC.api.mutate("POST", "/api/v1/planner_notes", { title: "x" });
    assert.equal(calls[0].opts.method, "POST");
    assert.equal(calls[0].opts.headers["X-CSRF-Token"], "abc+def",
      "the token must be URL-decoded or Canvas rejects the write");
    assert.equal(calls[0].opts.headers["Content-Type"], "application/json");
  },

  async "mutate tolerates an empty response body"() {
    const { api } = setup([{ body: "" }]);
    assert.equal(await api.mutate("POST", "/api/v1/x", {}), null);
  },

  async "coursesWithScores asks only for student enrollments"() {
    // Scores only mean something for a student enrollment.
    const { api, calls } = setup([{ body: [] }]);
    await api.coursesWithScores();
    assert.match(calls[0].url, /enrollment_type=student/);
    assert.match(calls[0].url, /include\[\]=total_scores/);
  },

  async "activeCourses does not filter by enrollment type"() {
    // Features that merely enumerate courses must see teacher and TA
    // enrollments too, or those users get an empty panel that reads as
    // "nothing here" rather than as a wrong query.
    const { api, calls } = setup([{ body: [] }]);
    await api.activeCourses();
    assert.match(calls[0].url, /enrollment_state=active/);
    assert.noMatch(calls[0].url, /enrollment_type=/,
      "activeCourses must not restrict the role");
  },

  async "the two course queries use distinct cache entries"() {
    const { api, calls } = setup([{ body: [] }, { body: [] }]);
    await api.coursesWithScores();
    await api.activeCourses();
    assert.equal(calls.length, 2, "different queries must not collide in the cache");
  },

  "features that only enumerate courses use activeCourses"() {
    const fs = require("fs");
    const path = require("path");
    const { ROOT } = require("./harness");
    for (const f of ["files.js", "announcements.js", "semester.js"]) {
      const src = fs.readFileSync(path.join(ROOT, "src/content/features", f), "utf8");
      assert.noMatch(src, /BC\.api\.coursesWithScores\(\)/,
        `${f} enumerates courses, so it must use activeCourses to include instructors`);
      assert.match(src, /BC\.api\.activeCourses\(\)/, `${f} should call activeCourses`);
    }
  },

  "features that need scores still use coursesWithScores"() {
    const fs = require("fs");
    const path = require("path");
    const { ROOT } = require("./harness");
    for (const f of ["dashboard.js", "notifications.js"]) {
      const src = fs.readFileSync(path.join(ROOT, "src/content/features", f), "utf8");
      assert.match(src, /BC\.api\.coursesWithScores\(\)/,
        `${f} reads computed scores, so it must keep the student-scoped query`);
    }
  },
};
