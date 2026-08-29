"use strict";
const { createSandbox, loadCore, load } = require("./harness");

function setup() {
  const sb = createSandbox();
  loadCore(sb);
  load(sb, "src/content/core/injector.js");
  return { BC: sb.BC, doc: sb.document };
}

const sheets = (doc) => doc.querySelectorAll("style[data-better-canvas]");

module.exports = {
  "setStyle creates one keyed sheet"() {
    const { BC, doc } = setup();
    BC.injector.setStyle("a", ".x{color:red}");
    const tags = sheets(doc);
    assert.equal(tags.length, 1);
    assert.equal(tags[0].getAttribute("data-better-canvas"), "a");
    assert.equal(tags[0].textContent, ".x{color:red}");
  },

  "re-applying the same key swaps content instead of duplicating"() {
    const { BC, doc } = setup();
    BC.injector.setStyle("a", ".x{color:red}");
    BC.injector.setStyle("a", ".x{color:blue}");
    assert.equal(sheets(doc).length, 1, "a second setStyle must not add a second sheet");
    assert.equal(sheets(doc)[0].textContent, ".x{color:blue}");
  },

  "re-applying identical CSS does not touch the DOM"() {
    // Reassigning textContent replaces the child node even when equal, which the
    // observer reads as a page change and turns into another applyAll.
    const { BC, doc } = setup();
    BC.injector.setStyle("a", ".x{}");
    const before = sheets(doc)[0].textContent;
    let writes = 0;
    const tag = sheets(doc)[0];
    Object.defineProperty(tag, "textContent", {
      get: () => before, set: () => { writes++; }, configurable: true,
    });
    BC.injector.setStyle("a", ".x{}");
    assert.equal(writes, 0, "identical CSS must not be rewritten");
  },

  "distinct keys get distinct sheets"() {
    const { BC, doc } = setup();
    BC.injector.setStyle("a", ".a{}");
    BC.injector.setStyle("b", ".b{}");
    assert.equal(sheets(doc).length, 2);
  },

  "empty CSS removes the sheet"() {
    const { BC, doc } = setup();
    BC.injector.setStyle("a", ".a{}");
    BC.injector.setStyle("a", "");
    assert.equal(sheets(doc).length, 0);
  },

  "removeStyle is idempotent"() {
    const { BC, doc } = setup();
    BC.injector.setStyle("a", ".a{}");
    BC.injector.removeStyle("a");
    BC.injector.removeStyle("a");
    assert.equal(sheets(doc).length, 0);
  },

  "a removed key can be re-injected"() {
    // This is the disable-then-re-enable path.
    const { BC, doc } = setup();
    BC.injector.setStyle("a", ".a{}");
    BC.injector.removeStyle("a");
    BC.injector.setStyle("a", ".a{}");
    assert.equal(sheets(doc).length, 1);
  },

  "ensureNode builds the node once and returns the same one"() {
    const { BC, doc } = setup();
    let built = 0;
    const factory = () => { built++; return doc.createElement("div"); };
    const a = BC.injector.ensureNode("n", doc.body, factory);
    const b = BC.injector.ensureNode("n", doc.body, factory);
    assert.equal(built, 1, "ensureNode must not rebuild an existing node");
    assert.equal(a, b);
    assert.equal(a.getAttribute("data-bc-node"), "n");
  },

  "ensureNode rebuilds after the node is removed"() {
    const { BC, doc } = setup();
    let built = 0;
    const factory = () => { built++; return doc.createElement("div"); };
    BC.injector.ensureNode("n", doc.body, factory);
    BC.injector.removeNode("n");
    BC.injector.ensureNode("n", doc.body, factory);
    assert.equal(built, 2);
    assert.equal(doc.querySelectorAll('[data-bc-node="n"]').length, 1);
  },

  "ensureNode respects a factory that attaches the node itself"() {
    // Several features prepend rather than append; double-attaching would move it.
    const { BC, doc } = setup();
    const host = doc.createElement("section");
    doc.body.appendChild(host);
    const node = BC.injector.ensureNode("n", doc.body, () => {
      const d = doc.createElement("div");
      host.appendChild(d);
      return d;
    });
    assert.equal(node.parentNode, host, "an already-attached node must not be re-parented");
  },

  "removeNode removes every copy of a shared node id"() {
    // Per-item nodes (badges, progress bars) share one id by design.
    const { BC, doc } = setup();
    for (let i = 0; i < 3; i++) {
      const d = doc.createElement("div");
      d.setAttribute("data-bc-node", "badge");
      doc.body.appendChild(d);
    }
    assert.equal(doc.querySelectorAll('[data-bc-node="badge"]').length, 3);
    BC.injector.removeNode("badge");
    assert.equal(doc.querySelectorAll('[data-bc-node="badge"]').length, 0);
  },

  "removeNode on an absent id is a no-op"() {
    const { BC } = setup();
    BC.injector.removeNode("nope");
  },

  "our sheets stay last so our rules win the cascade"() {
    const { BC, doc } = setup();
    BC.injector.setStyle("a", ".a{}");
    // Canvas appends its own stylesheet afterwards.
    const canvasSheet = doc.createElement("style");
    doc.head.appendChild(canvasSheet);
    BC.injector.setStyle("a", ".a{}");
    const kids = doc.head.children;
    assert.equal(kids[kids.length - 1].getAttribute("data-better-canvas"), "a",
      "our sheet must be re-appended after a foreign sheet lands on top of it");
  },

  "already-last sheets are not needlessly re-appended"() {
    // An unconditional appendChild is a remove+insert per spec, which invalidates
    // the CSSOM and forces a full-document style recalc on every tick.
    const { BC, doc } = setup();
    BC.injector.setStyle("a", ".a{}");
    BC.injector.setStyle("b", ".b{}");
    const order = doc.head.children.slice();
    BC.injector.setStyle("a", ".a{}");
    BC.injector.setStyle("b", ".b{}");
    const after = doc.head.children;
    assert.equal(after.length, order.length, "sheet count changed");
    for (let i = 0; i < order.length; i++) {
      assert.equal(after[i], order[i], `sheet at index ${i} moved; an unconditional appendChild forces a style recalc`);
    }
  },
};
