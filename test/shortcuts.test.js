"use strict";
const { createSandbox, loadCore, load } = require("./harness");

function setup(settings) {
  const sb = createSandbox();
  loadCore(sb);
  const handlers = [];
  sb.document.addEventListener = (type, fn) => { if (type === "keydown") handlers.push(fn); };
  sb.BC.storage = { current: settings };
  load(sb, "src/content/core/shortcuts.js");
  const fire = (ev) => {
    const e = Object.assign({
      key: "", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
      target: { tagName: "DIV", isContentEditable: false, closest: () => null },
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
      defaultPrevented: false,
    }, ev);
    for (const h of handlers) h(e);
    return e;
  };
  return { BC: sb.BC, fire };
}

const enabled = () => ({ enabled: true, shortcuts: { enabled: true, bindings: {} } });

module.exports = {
  "a modifier combo fires its handler"() {
    const { BC, fire } = setup(enabled());
    let hits = 0;
    BC.shortcuts.register("commandPalette", "Mod+K", () => hits++);
    fire({ key: "k", metaKey: true });
    assert.equal(hits, 1);
  },

  "a combo does not fire without its modifier"() {
    const { BC, fire } = setup(enabled());
    let hits = 0;
    BC.shortcuts.register("commandPalette", "Mod+K", () => hits++);
    fire({ key: "k" });
    assert.equal(hits, 0);
  },

  "a combo does not fire with an extra modifier"() {
    const { BC, fire } = setup(enabled());
    let hits = 0;
    BC.shortcuts.register("commandPalette", "Mod+K", () => hits++);
    fire({ key: "k", metaKey: true, shiftKey: true });
    assert.equal(hits, 0, "Mod+Shift+K must not trigger a Mod+K binding");
  },

  "shift combos match regardless of the reported key case"() {
    const { BC, fire } = setup(enabled());
    let hits = 0;
    BC.shortcuts.register("toggleDark", "Mod+Shift+D", () => hits++);
    fire({ key: "D", metaKey: true, shiftKey: true });
    fire({ key: "d", ctrlKey: true, shiftKey: true });
    assert.equal(hits, 2);
  },

  "a two-key chord fires only on the full sequence"() {
    const { BC, fire } = setup(enabled());
    let hits = 0;
    BC.shortcuts.register("gotoDashboard", "g d", () => hits++);
    fire({ key: "g" });
    assert.equal(hits, 0, "the first key alone must not fire");
    fire({ key: "d" });
    assert.equal(hits, 1);
  },

  "starting a chord does not swallow the keystroke"() {
    // Deliberately not preventDefault: a bare "g" in a widget isTypingTarget
    // misses would otherwise lose the letter.
    const { BC, fire } = setup(enabled());
    BC.shortcuts.register("gotoDashboard", "g d", () => {});
    const e = fire({ key: "g" });
    assert.notOk(e.defaultPrevented);
  },

  "an unmatched chord tail falls through to a single-key binding"() {
    const { BC, fire } = setup(enabled());
    let dash = 0, other = 0;
    BC.shortcuts.register("gotoDashboard", "g d", () => dash++);
    BC.shortcuts.register("focusMode", "x", () => other++);
    fire({ key: "g" });
    fire({ key: "x" });
    assert.equal(dash, 0);
    assert.equal(other, 1, "the second key must still reach its own binding");
  },

  "nothing fires while typing in a form control"() {
    const { BC, fire } = setup(enabled());
    let hits = 0;
    BC.shortcuts.register("commandPalette", "Mod+K", () => hits++);
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      fire({ key: "k", metaKey: true, target: { tagName, closest: () => null } });
    }
    assert.equal(hits, 0);
  },

  "nothing fires inside a rich text editor or ARIA text widget"() {
    const { BC, fire } = setup(enabled());
    let hits = 0;
    BC.shortcuts.register("commandPalette", "Mod+K", () => hits++);
    fire({ key: "k", metaKey: true, target: { tagName: "DIV", isContentEditable: true, closest: () => null } });
    fire({ key: "k", metaKey: true, target: { tagName: "DIV", closest: () => ({}) } });
    assert.equal(hits, 0);
  },

  "nothing fires when shortcuts are switched off"() {
    const { BC, fire } = setup({ enabled: true, shortcuts: { enabled: false, bindings: {} } });
    let hits = 0;
    BC.shortcuts.register("commandPalette", "Mod+K", () => hits++);
    fire({ key: "k", metaKey: true });
    assert.equal(hits, 0);
  },

  "nothing fires when the extension itself is disabled"() {
    // The keydown listener is installed once and never removed, so the master
    // switch has to gate here or every binding stays live while "off".
    const { BC, fire } = setup({ enabled: false, shortcuts: { enabled: true, bindings: {} } });
    let hits = 0;
    BC.shortcuts.register("toggleDark", "Mod+Shift+D", () => hits++);
    fire({ key: "d", metaKey: true, shiftKey: true });
    assert.equal(hits, 0, "shortcuts must not fire while the extension is disabled");
  },

  "reloadFromSettings rebinds an existing handler"() {
    // This is the regression that made rebinding silently do nothing: the ids
    // registered ("bc-palette") never matched the settings keys ("commandPalette").
    const { BC, fire } = setup(enabled());
    let hits = 0;
    BC.shortcuts.register("commandPalette", "Mod+K", () => hits++);
    BC.shortcuts.reloadFromSettings({ shortcuts: { bindings: { commandPalette: "Mod+J" } } });
    assert.equal(BC.shortcuts.comboFor("commandPalette"), "Mod+J");
    fire({ key: "k", metaKey: true });
    assert.equal(hits, 0, "the old combo must stop working after a rebind");
    fire({ key: "j", metaKey: true });
    assert.equal(hits, 1, "the new combo must work after a rebind");
  },

  "every default binding is registered under its settings key"() {
    const { BC } = setup(enabled());
    for (const key of Object.keys(BC.defaults.shortcuts.bindings)) {
      BC.shortcuts.register(key, BC.defaults.shortcuts.bindings[key], () => {});
      assert.ok(BC.shortcuts.has(key));
    }
    BC.shortcuts.reloadFromSettings(BC.defaults);
    for (const [key, combo] of Object.entries(BC.defaults.shortcuts.bindings)) {
      assert.equal(BC.shortcuts.comboFor(key), combo, `${key} did not reload`);
    }
  },

  "unregister removes a binding"() {
    const { BC, fire } = setup(enabled());
    let hits = 0;
    BC.shortcuts.register("commandPalette", "Mod+K", () => hits++);
    BC.shortcuts.unregister("commandPalette");
    fire({ key: "k", metaKey: true });
    assert.equal(hits, 0);
  },

  "prettify renders a readable combo"() {
    const { BC } = setup(enabled());
    const out = BC.shortcuts.prettify("Mod+Shift+D");
    assert.match(out, /⇧/);
    assert.noMatch(out, /Mod/);
    assert.equal(BC.shortcuts.prettify(""), "");
  },

  "content.js registers shortcuts under settings keys"() {
    const fs = require("fs");
    const path = require("path");
    const { ROOT } = require("./harness");
    const src = fs.readFileSync(path.join(ROOT, "src/content/content.js"), "utf8");
    assert.noMatch(src, /shortcuts\.register\(\s*"bc-/,
      "handler ids must be settings binding keys, not bc-* ids, or rebinding breaks");
  },
};
