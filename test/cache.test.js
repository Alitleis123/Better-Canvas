"use strict";
const { createSandbox, loadCore, load } = require("./harness");

function setup() {
  const sb = createSandbox();
  loadCore(sb);
  load(sb, "src/content/core/cache.js");
  return sb.BC.cache;
}

const tick = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  async "wrap returns the fetched value and caches it"() {
    const cache = setup();
    let calls = 0;
    const get = () => cache.wrap("k", 1000, () => { calls++; return "v"; });
    assert.equal(await get(), "v");
    assert.equal(await get(), "v");
    assert.equal(calls, 1, "second call within TTL must hit the cache");
  },

  async "wrap refetches after the TTL expires"() {
    const cache = setup();
    let calls = 0;
    const get = () => cache.wrap("k", 20, () => { calls++; return calls; });
    await get();
    await tick(40);
    await get();
    assert.equal(calls, 2);
  },

  async "concurrent calls share one in-flight request"() {
    const cache = setup();
    let calls = 0;
    const fetcher = () => { calls++; return new Promise((r) => setTimeout(() => r("v"), 20)); };
    const [a, b, c] = await Promise.all([
      cache.wrap("k", 1000, fetcher),
      cache.wrap("k", 1000, fetcher),
      cache.wrap("k", 1000, fetcher),
    ]);
    assert.equal(calls, 1, "de-duplication must collapse concurrent calls");
    assert.deepEqual([a, b, c], ["v", "v", "v"]);
  },

  async "a rejected fetch is not cached and can be retried"() {
    const cache = setup();
    let calls = 0;
    const fetcher = () => { calls++; return calls === 1 ? Promise.reject(new Error("nope")) : Promise.resolve("ok"); };
    let threw = false;
    try { await cache.wrap("k", 1000, fetcher); } catch (_) { threw = true; }
    assert.ok(threw, "the rejection must propagate to the caller");
    assert.equal(await cache.wrap("k", 1000, fetcher), "ok", "a failure must not poison the key");
    assert.equal(calls, 2);
  },

  async "a rejected in-flight request rejects every waiter but clears the slot"() {
    const cache = setup();
    let calls = 0;
    const failing = () => { calls++; return new Promise((_, rej) => setTimeout(() => rej(new Error("x")), 10)); };
    const results = await Promise.allSettled([
      cache.wrap("k", 1000, failing),
      cache.wrap("k", 1000, failing),
    ]);
    assert.equal(calls, 1);
    assert.ok(results.every((r) => r.status === "rejected"));
    assert.equal(await cache.wrap("k", 1000, () => "recovered"), "recovered");
  },

  async "the cached TTL is measured from when the value lands, not when it was requested"() {
    // Anchoring the expiry on the pre-fetch timestamp shortens every entry's
    // lifetime by however long the request took, which on a slow Canvas turns a
    // 60s cache into an almost-no-op.
    const cache = setup();
    let calls = 0;
    const slow = () => { calls++; return new Promise((r) => setTimeout(() => r(calls), 60)); };
    await cache.wrap("k", 80, slow);
    await tick(40);
    await cache.wrap("k", 80, slow);
    assert.equal(calls, 1, "entry expired early: TTL was consumed by the request itself");
  },

  async "invalidate with a prefix drops only the matching keys"() {
    const cache = setup();
    await cache.wrap("GET /a/1", 1000, () => "a1");
    await cache.wrap("GET /a/2", 1000, () => "a2");
    await cache.wrap("GET /b/1", 1000, () => "b1");
    cache.invalidate("GET /a/");
    assert.equal(cache.peek("GET /a/1"), null);
    assert.equal(cache.peek("GET /a/2"), null);
    assert.equal(cache.peek("GET /b/1"), "b1");
  },

  async "invalidate with no prefix clears everything"() {
    const cache = setup();
    await cache.wrap("x", 1000, () => 1);
    cache.invalidate();
    assert.equal(cache.peek("x"), null);
  },

  async "peek returns null for an expired entry without refetching"() {
    const cache = setup();
    await cache.wrap("k", 10, () => "v");
    assert.equal(cache.peek("k"), "v");
    await tick(30);
    assert.equal(cache.peek("k"), null);
  },

  async "peek returns null for an unknown key"() {
    assert.equal(setup().peek("nope"), null);
  },

  async "a falsy cached value is still served from cache"() {
    const cache = setup();
    let calls = 0;
    const get = () => cache.wrap("k", 1000, () => { calls++; return 0; });
    assert.equal(await get(), 0);
    assert.equal(await get(), 0);
    assert.equal(calls, 1);
  },
};
