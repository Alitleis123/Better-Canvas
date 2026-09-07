"use strict";
const { createSandbox, loadCore, load } = require("./harness");

function setup(initial) {
  const sb = createSandbox();
  loadCore(sb);
  load(sb, "src/shared/settings/state.js");
  const saved = [];
  let sub = null;
  const adapter = {
    getState: () => initial || sb.BC.cloneDefaults(),
    save: (s) => { saved.push(s); return Promise.resolve(); },
    subscribe: (cb) => { sub = cb; return () => { sub = null; }; },
  };
  const store = sb.BC.SettingsState.create(adapter);
  return { BC: sb.BC, store, saved, push: (s) => sub && sub(s), hasSub: () => !!sub };
}

const settle = () => new Promise((r) => setTimeout(r, 350));

module.exports = {
  "the store does not alias the object the adapter handed back"() {
    // The drawer's adapter returns BC.storage.current itself, and the store
    // mutates in place; aliasing would corrupt applyAll's view mid-edit.
    const sb = createSandbox();
    loadCore(sb);
    load(sb, "src/shared/settings/state.js");
    const original = sb.BC.cloneDefaults();
    const store = sb.BC.SettingsState.create({ getState: () => original, save: () => Promise.resolve() });
    store.set((d) => { d.theming.darkMode = "on"; });
    assert.equal(original.theming.darkMode, "off", "the source object must not be mutated");
    assert.equal(store.get().theming.darkMode, "on");
  },

  "the state object identity is stable across every operation"() {
    // Tab renderers capture sub-objects and close over them; swapping the root
    // would leave every mounted control reading a stale snapshot.
    const { store } = setup();
    const root = store.get();
    const theming = root.theming;
    store.set((d) => { d.theming.darkMode = "on"; });
    store.reset();
    store.undo();
    store.redo();
    assert.equal(store.get(), root, "root identity changed");
    assert.equal(store.get().theming, theming, "sub-object identity changed");
  },

  "a no-op set does not record history or notify"() {
    const { store } = setup();
    let notified = 0;
    store.subscribe(() => notified++);
    store.set((d) => { d.theming.darkMode = d.theming.darkMode; });
    assert.notOk(store.canUndo());
    assert.equal(notified, 0);
  },

  "undo and redo walk the history"() {
    const { store } = setup();
    store.set((d) => { d.theming.darkMode = "on"; });
    store.set((d) => { d.theming.radius = 20; });
    assert.equal(store.get().theming.radius, 20);
    store.undo();
    assert.equal(store.get().theming.radius, 8);
    assert.equal(store.get().theming.darkMode, "on");
    store.undo();
    assert.equal(store.get().theming.darkMode, "off");
    store.redo();
    assert.equal(store.get().theming.darkMode, "on");
  },

  "undo and redo report availability honestly"() {
    const { store } = setup();
    assert.notOk(store.canUndo());
    assert.notOk(store.canRedo());
    store.set((d) => { d.theming.darkMode = "on"; });
    assert.ok(store.canUndo());
    assert.notOk(store.canRedo());
    store.undo();
    assert.ok(store.canRedo());
    assert.equal(store.undo(), false, "undo past the start must report failure");
  },

  "a new edit clears the redo stack"() {
    const { store } = setup();
    store.set((d) => { d.theming.darkMode = "on"; });
    store.undo();
    assert.ok(store.canRedo());
    store.set((d) => { d.theming.radius = 4; });
    assert.notOk(store.canRedo(), "branching must discard the abandoned future");
  },

  "history is bounded"() {
    const { store } = setup();
    for (let i = 0; i < 100; i++) store.set((d) => { d.theming.radius = i; });
    let undos = 0;
    while (store.undo()) undos++;
    assert.ok(undos <= 30, `history grew to ${undos}, expected a cap of 30`);
  },

  "overwrite removes keys the incoming object does not have"() {
    const { store, BC } = setup();
    store.set((d) => { d.dashboard.courses.extra = { hidden: true }; });
    store.reset();
    assert.equal(store.get().dashboard.courses.extra, undefined,
      "reset must not leave orphaned keys behind");
  },

  "reset restores defaults and is undoable"() {
    const { store, BC } = setup();
    store.set((d) => { d.theming.darkMode = "on"; d.theming.radius = 20; });
    store.reset();
    assert.deepEqual(store.get(), BC.cloneDefaults());
    store.undo();
    assert.equal(store.get().theming.darkMode, "on");
  },

  "importJSON accepts a valid payload and migrates it"() {
    const { store, BC } = setup();
    assert.ok(store.importJSON(JSON.stringify({ version: 3, grades: { whatIfEnabled: false } })));
    assert.equal(store.get().grades.panelEnabled, false, "import must run migrations");
    assert.equal(store.get().version, BC.SETTINGS_VERSION);
  },

  "importJSON rejects malformed input without changing state"() {
    const { store } = setup();
    store.set((d) => { d.theming.darkMode = "on"; });
    assert.notOk(store.importJSON("{not json"));
    assert.notOk(store.importJSON("null"));
    assert.notOk(store.importJSON('"a string"'));
    assert.equal(store.get().theming.darkMode, "on", "a rejected import must not mutate state");
  },

  "exportJSON round-trips through importJSON"() {
    const { store } = setup();
    store.set((d) => { d.theming.darkMode = "on"; d.theming.accentColor = "#ff0000"; });
    const json = store.exportJSON();
    store.reset();
    assert.ok(store.importJSON(json));
    assert.equal(store.get().theming.darkMode, "on");
    assert.equal(store.get().theming.accentColor, "#ff0000");
  },

  "applyPreset merges a theme over current settings"() {
    const { store, BC } = setup();
    store.set((d) => { d.dashboard.cardSize = "l"; });
    store.applyPreset(BC.PRESET_THEMES.find((t) => t.id === "nord"));
    assert.equal(store.get().theming.darkTone, "nord");
    assert.equal(store.get().dashboard.cardSize, "l", "a theme must not clobber unrelated settings");
  },

  "applyPreset replaces arrays rather than merging them"() {
    const { store } = setup();
    store.set((d) => { d.notifications.leadMinutes = [1, 2, 3]; });
    store.applyPreset({ settings: { notifications: { leadMinutes: [9] } } });
    assert.deepEqual(store.get().notifications.leadMinutes, [9]);
  },

  async "an external change is adopted without entering the undo stack"() {
    // Our own write echoes back through subscribe; recording it would make Undo
    // appear to do nothing.
    const { store, BC, push } = setup();
    const incoming = BC.cloneDefaults();
    incoming.theming.darkMode = "on";
    push(incoming);
    assert.equal(store.get().theming.darkMode, "on");
    assert.notOk(store.canUndo(), "an external change must not become an undo step");
  },

  async "an echo of our own state is ignored"() {
    const { store, push } = setup();
    store.set((d) => { d.theming.darkMode = "on"; });
    let notified = 0;
    store.subscribe(() => notified++);
    push(JSON.parse(JSON.stringify(store.get())));
    assert.equal(notified, 0, "an identical echo must not trigger a rebuild");
  },

  async "edits reach the adapter"() {
    const { store, saved } = setup();
    store.set((d) => { d.theming.darkMode = "on"; });
    await settle();
    assert.ok(saved.length >= 1);
    assert.equal(saved[saved.length - 1].theming.darkMode, "on");
  },

  async "rapid edits still persist the final value"() {
    // Throttled rather than debounced: holding a control must not starve the
    // write, and the trailing call must carry the last value.
    const { store, saved } = setup();
    for (let i = 0; i < 30; i++) store.set((d) => { d.theming.radius = i; });
    await settle();
    assert.ok(saved.length >= 1);
    assert.equal(saved[saved.length - 1].theming.radius, 29, "the final value must reach storage");
    assert.ok(saved.length < 30, "writes must be throttled, not one per keystroke");
  },

  async "the saved snapshot is decoupled from later mutations"() {
    const { store, saved } = setup();
    store.set((d) => { d.theming.radius = 1; });
    await settle();
    const snapshot = saved[saved.length - 1];
    store.set((d) => { d.theming.radius = 99; });
    assert.equal(snapshot.theming.radius, 1, "a persisted snapshot must not alias live state");
  },

  "destroy unsubscribes from the adapter"() {
    const { store, hasSub } = setup();
    assert.ok(hasSub());
    store.destroy();
    assert.notOk(hasSub(), "a re-mounted drawer must be able to dispose the old store");
  },

  "preview is invoked so the page can update in the same frame"() {
    const sb = createSandbox();
    loadCore(sb);
    load(sb, "src/shared/settings/state.js");
    let previews = 0;
    const store = sb.BC.SettingsState.create({
      getState: () => sb.BC.cloneDefaults(),
      save: () => Promise.resolve(),
      preview: () => previews++,
    });
    store.set((d) => { d.theming.darkMode = "on"; });
    assert.equal(previews, 1);
  },
};
