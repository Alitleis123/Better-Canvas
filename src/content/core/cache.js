/* Better Canvas — in-memory API cache with TTL and request dedupe. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const store = new Map();   // key -> {value, expires}
  const inflight = new Map(); // key -> promise

  BC.cache = {
    async wrap(key, ttlMs, fetcher) {
      const hit = store.get(key);
      if (hit && hit.expires > Date.now()) return hit.value;
      if (inflight.has(key)) return inflight.get(key);
      const p = Promise.resolve().then(fetcher).then((val) => {
        // Expiry runs from when the value LANDED, not from when it was requested.
        // Anchoring on a pre-fetch timestamp charged the request's own latency
        // against the entry's lifetime, so on a slow Canvas a 60s cache could
        // expire almost immediately and every consumer refetched on the next tick.
        store.set(key, { value: val, expires: Date.now() + ttlMs });
        inflight.delete(key);
        return val;
      }).catch((e) => {
        inflight.delete(key);
        throw e;
      });
      inflight.set(key, p);
      return p;
    },

    invalidate(prefix) {
      if (!prefix) { store.clear(); return; }
      for (const k of Array.from(store.keys())) if (k.indexOf(prefix) === 0) store.delete(k);
    },

    peek(key) {
      const hit = store.get(key);
      return hit && hit.expires > Date.now() ? hit.value : null;
    },
  };
})();
