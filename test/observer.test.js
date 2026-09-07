"use strict";
const { createSandbox, loadCore, load } = require("./harness");

// Capture the MutationObserver callback so mutation records can be fed in.
function setup() {
  const sb = createSandbox();
  loadCore(sb);
  let cb = null;
  sb.MutationObserver = class { constructor(fn) { cb = fn; } observe() {} disconnect() {} };
  const navHandlers = [];
  sb.window.addEventListener = (t, fn) => { if (t === "popstate" || t === "hashchange") navHandlers.push(fn); };
  load(sb, "src/content/core/observer.js");
  let triggers = 0;
  sb.BC.observer.start(() => triggers++);
  return {
    doc: sb.document,
    sb,
    fire: (records) => cb(records),
    count: () => triggers,
  };
}

const el = (doc, tag, attrs) => {
  const n = doc.createElement(tag || "div");
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  return n;
};

module.exports = {
  "a foreign node being added triggers a re-apply"() {
    const { doc, fire, count } = setup();
    const canvasNode = el(doc, "div");
    doc.body.appendChild(canvasNode);
    fire([{ type: "childList", target: doc.body, addedNodes: [canvasNode], removedNodes: [] }]);
    assert.equal(count(), 1);
  },

  "our own node being added does not trigger a re-apply"() {
    // Otherwise every render we do schedules another render, forever.
    const { doc, fire, count } = setup();
    const ours = el(doc, "div", { "data-bc-node": "bc-thing" });
    doc.body.appendChild(ours);
    fire([{ type: "childList", target: doc.body, addedNodes: [ours], removedNodes: [] }]);
    assert.equal(count(), 0);
  },

  "a bc- classed node is recognised as ours"() {
    const { doc, fire, count } = setup();
    const ours = el(doc, "div", { class: "bc-todo" });
    doc.body.appendChild(ours);
    fire([{ type: "childList", target: doc.body, addedNodes: [ours], removedNodes: [] }]);
    assert.equal(count(), 0);
  },

  "churn INSIDE one of our own subtrees is ignored"() {
    // Features write unclassed children and bare text nodes into their own
    // panels; judging those by the node alone reports them as foreign.
    const { doc, fire, count } = setup();
    const panel = el(doc, "div", { "data-bc-node": "bc-panel" });
    doc.body.appendChild(panel);
    const child = el(doc, "h3");            // no bc- marker of its own
    panel.appendChild(child);
    fire([{ type: "childList", target: panel, addedNodes: [child], removedNodes: [] }]);
    assert.equal(count(), 0, "ownership is an ancestor property, not a node property");
  },

  "a text node inside our subtree is ignored"() {
    const { doc, fire, count } = setup();
    const panel = el(doc, "div", { "data-bc-node": "bc-panel" });
    doc.body.appendChild(panel);
    const text = doc.createTextNode("hello");
    text.parentElement = panel;
    fire([{ type: "childList", target: panel, addedNodes: [text], removedNodes: [] }]);
    assert.equal(count(), 0);
  },

  "dark mode on the root element does not make every node look like ours"() {
    // bc-dark lives on documentElement; walking all the way to the root would
    // report EVERY node as ours and switch the observer off entirely.
    const { doc, fire, count } = setup();
    doc.documentElement.classList.add("bc-dark");
    const canvasNode = el(doc, "div");
    doc.body.appendChild(canvasNode);
    fire([{ type: "childList", target: doc.body, addedNodes: [canvasNode], removedNodes: [] }]);
    assert.equal(count(), 1, "the ancestor walk must stop before <body>/<html>");
  },

  "a mix of our nodes and foreign nodes still triggers"() {
    const { doc, fire, count } = setup();
    const ours = el(doc, "div", { "data-bc-node": "x" });
    const theirs = el(doc, "div");
    doc.body.appendChild(ours); doc.body.appendChild(theirs);
    fire([{ type: "childList", target: doc.body, addedNodes: [ours, theirs], removedNodes: [] }]);
    assert.equal(count(), 1);
  },

  "a foreign node being REMOVED triggers a re-apply"() {
    // Canvas tearing out a container we decorated is exactly when we need to run.
    const { doc, fire, count } = setup();
    const theirs = el(doc, "div");
    doc.body.appendChild(theirs);
    fire([{ type: "childList", target: doc.body, addedNodes: [], removedNodes: [theirs] }]);
    assert.equal(count(), 1);
  },

  "removing only our own nodes does not trigger"() {
    const { doc, fire, count } = setup();
    const ours = el(doc, "div", { "data-bc-node": "x" });
    doc.body.appendChild(ours);
    fire([{ type: "childList", target: doc.body, addedNodes: [], removedNodes: [ours] }]);
    assert.equal(count(), 0);
  },

  "an attribute change on a foreign element triggers"() {
    const { doc, fire, count } = setup();
    const theirs = el(doc, "div");
    doc.body.appendChild(theirs);
    fire([{ type: "attributes", target: theirs }]);
    assert.equal(count(), 1);
  },

  "an attribute change on our own element does not trigger"() {
    const { doc, fire, count } = setup();
    const ours = el(doc, "div", { "data-bc-node": "x" });
    doc.body.appendChild(ours);
    fire([{ type: "attributes", target: ours }]);
    assert.equal(count(), 0);
  },

  "one batch of mutations triggers at most one re-apply"() {
    const { doc, fire, count } = setup();
    const nodes = [];
    for (let i = 0; i < 5; i++) { const n = el(doc, "div"); doc.body.appendChild(n); nodes.push(n); }
    fire(nodes.map((n) => ({ type: "childList", target: doc.body, addedNodes: [n], removedNodes: [] })));
    assert.equal(count(), 1, "the callback must return after the first foreign mutation");
  },

  "start is idempotent"() {
    const { sb } = setup();
    let extra = 0;
    sb.BC.observer.start(() => extra++);
    assert.ok(sb.BC.observer._started);
  },

  "a pushState to a new path announces a navigation"() {
    const sb = createSandbox();
    loadCore(sb);
    sb.MutationObserver = class { observe() {} disconnect() {} };
    let navs = 0;
    sb.window.addEventListener = () => {};
    sb.window.dispatchEvent = (e) => { if (e && e.type === "bc:navigate") navs++; };
    sb.Event = class { constructor(type) { this.type = type; } };
    load(sb, "src/content/core/observer.js");
    sb.BC.observer.start(() => {});
    sb.location.pathname = "/courses/1/grades";
    sb.history.pushState({}, "", "/courses/1/grades");
    assert.equal(navs, 1, "a real path change must fire bc:navigate so page bags clear");
  },

  "a replaceState that only changes query params does not announce a navigation"() {
    // Canvas replaceState()s query params constantly; treating those as
    // navigations would clear every page bag several times a second.
    const sb = createSandbox();
    loadCore(sb);
    sb.MutationObserver = class { observe() {} disconnect() {} };
    let navs = 0;
    sb.window.addEventListener = () => {};
    sb.window.dispatchEvent = (e) => { if (e && e.type === "bc:navigate") navs++; };
    sb.Event = class { constructor(type) { this.type = type; } };
    load(sb, "src/content/core/observer.js");
    sb.BC.observer.start(() => {});
    sb.history.replaceState({}, "", "/?foo=1");
    sb.history.replaceState({}, "", "/?foo=2");
    assert.equal(navs, 0);
  },

  "the patched history methods still return the original result"() {
    const sb = createSandbox();
    loadCore(sb);
    sb.MutationObserver = class { observe() {} disconnect() {} };
    sb.window.addEventListener = () => {};
    sb.window.dispatchEvent = () => {};
    sb.Event = class { constructor(type) { this.type = type; } };
    sb.history.pushState = () => "sentinel";
    load(sb, "src/content/core/observer.js");
    sb.BC.observer.start(() => {});
    assert.equal(sb.history.pushState({}, "", "/x"), "sentinel",
      "patching history must be transparent to Canvas's own code");
  },
};
