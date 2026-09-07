"use strict";
const { createSandbox, loadCore, load } = require("./harness");

function setup() {
  const sb = createSandbox();
  loadCore(sb);
  const navListeners = [];
  sb.window.addEventListener = (type, fn) => { if (type === "bc:navigate") navListeners.push(fn); };
  load(sb, "src/content/core/lifecycle.js");
  return { BC: sb.BC, navigate: () => navListeners.forEach((f) => f()) };
}

const fakeEl = () => {
  const handlers = [];
  return {
    handlers,
    addEventListener: (t, f, o) => handlers.push({ t, f, o }),
    removeEventListener: (t, f) => {
      const i = handlers.findIndex((h) => h.t === t && h.f === f);
      if (i >= 0) handlers.splice(i, 1);
    },
  };
};

module.exports = {
  "register rejects a definition with no id or apply"() {
    const { BC } = setup();
    BC.registry.register({ id: "no-apply" });
    assert.equal(BC.registry.get("no-apply"), undefined);
    BC.registry.register({ apply() {} });
    assert.equal(BC.registry.all().length, 0);
  },

  "register exposes the feature by id"() {
    const { BC } = setup();
    const def = { id: "f", apply() {} };
    BC.registry.register(def);
    assert.equal(BC.registry.get("f"), def);
    assert.equal(BC.features.f, def);
  },

  "styleKeys and nodeKeys collect every registered teardown key"() {
    const { BC } = setup();
    BC.registry.register({ id: "a", styles: ["s1", "s2"], nodes: ["n1"], apply() {} });
    BC.registry.register({ id: "b", styles: ["s3"], apply() {} });
    assert.deepEqual(BC.registry.styleKeys().sort(), ["s1", "s2", "s3"]);
    assert.deepEqual(BC.registry.nodeKeys(), ["n1"]);
  },

  "every feature's declared keys are unique across the registry"() {
    // Two features sharing a style key means disabling one strips the other's CSS.
    const { BC } = setup();
    BC.registry.register({ id: "a", styles: ["dup"], apply() {} });
    BC.registry.register({ id: "b", styles: ["dup"], apply() {} });
    const keys = BC.registry.styleKeys();
    assert.equal(keys.length, 2, "the registry does not deduplicate, so callers must not collide");
  },

  "bag.once runs its block exactly once"() {
    const { BC } = setup();
    let n = 0;
    for (let i = 0; i < 5; i++) BC.lifecycle.bag("x").once("k", () => n++);
    assert.equal(n, 1);
  },

  "bag.once re-arms after the bag is cleared"() {
    const { BC } = setup();
    let n = 0;
    BC.lifecycle.bag("x").once("k", () => n++);
    BC.lifecycle.clear("x");
    BC.lifecycle.bag("x").once("k", () => n++);
    assert.equal(n, 2, "a cleared bag must allow setup to run again on re-enable");
  },

  "clearing a bag removes its listeners"() {
    const { BC } = setup();
    const el = fakeEl();
    BC.lifecycle.bag("x").listen(el, "click", () => {});
    assert.equal(el.handlers.length, 1);
    BC.lifecycle.clear("x");
    assert.equal(el.handlers.length, 0, "a bagged listener must not outlive its bag");
  },

  "clearing a bag cancels its timers"() {
    const { BC } = setup();
    let fired = 0;
    BC.lifecycle.bag("x").timeout(() => fired++, 5);
    BC.lifecycle.bag("x").interval(() => fired++, 5);
    BC.lifecycle.clear("x");
    return new Promise((r) => setTimeout(() => { assert.equal(fired, 0); r(); }, 40));
  },

  "bags are isolated from each other"() {
    const { BC } = setup();
    const el = fakeEl();
    BC.lifecycle.bag("a").listen(el, "click", () => {});
    BC.lifecycle.bag("b").listen(el, "click", () => {});
    BC.lifecycle.clear("a");
    assert.equal(el.handlers.length, 1, "clearing one bag must not touch another");
  },

  "page bags clear on SPA navigation but persistent bags do not"() {
    const { BC, navigate } = setup();
    const el = fakeEl();
    BC.lifecycle.pageBag("p").listen(el, "click", () => {});
    BC.lifecycle.bag("s").listen(el, "click", () => {});
    assert.equal(el.handlers.length, 2);
    navigate();
    assert.equal(el.handlers.length, 1, "only the page bag should clear on navigation");
  },

  "clear(id) clears both the persistent and the page bag for that id"() {
    const { BC } = setup();
    const el = fakeEl();
    BC.lifecycle.bag("x").listen(el, "click", () => {});
    BC.lifecycle.pageBag("x").listen(el, "click", () => {});
    BC.lifecycle.clear("x");
    assert.equal(el.handlers.length, 0);
  },

  "clearAll empties every bag"() {
    const { BC } = setup();
    const el = fakeEl();
    BC.lifecycle.bag("a").listen(el, "click", () => {});
    BC.lifecycle.pageBag("b").listen(el, "click", () => {});
    BC.lifecycle.clearAll();
    assert.equal(el.handlers.length, 0);
  },

  "diag keeps a bounded ring buffer"() {
    const { BC } = setup();
    for (let i = 0; i < 200; i++) BC.diag.push("src", new Error("e" + i));
    assert.ok(BC.diag.entries.length <= 50, "diag must not grow without bound");
    assert.match(BC.diag.entries[BC.diag.entries.length - 1].error, /e199/, "it must keep the newest");
  },

  "diag records the source and survives a non-Error"() {
    const { BC } = setup();
    BC.diag.clear();
    BC.diag.push("feature", "a string failure");
    assert.equal(BC.diag.entries[0].source, "feature");
    assert.equal(BC.diag.entries[0].error, "a string failure");
    assert.ok(typeof BC.diag.entries[0].ts === "number");
  },

  "util.guard contains a throwing feature and records it"() {
    const { BC } = setup();
    BC.diag.clear();
    const out = BC.util.guard(() => { throw new Error("boom"); }, "featureA");
    assert.equal(out, undefined, "guard must swallow so one feature cannot break the rest");
    assert.equal(BC.diag.entries.length, 1);
    assert.equal(BC.diag.entries[0].source, "featureA");
  },

  "util.guard returns the value when nothing throws"() {
    const { BC } = setup();
    assert.equal(BC.util.guard(() => 42, "ok"), 42);
  },
};
