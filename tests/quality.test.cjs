const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const copy = (value) => JSON.parse(JSON.stringify(value));

function load(context, ...files) {
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
function settingsStore() {
  const context = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, structuredClone, navigator: { platform: "Win32" } });
  load(context, "src/shared/defaults.js", "src/content/core/util.js");
  context.BC.util.throttle = (fn) => fn;
  load(context, "src/shared/settings/state.js");
  return { BC: context.BC, store: context.BC.SettingsState.create({ getState: context.BC.cloneDefaults, save: async () => {} }) };
}

test("reset restores options but keeps what the user made", () => {
  const { store } = settingsStore();
  store.set((s) => {
    s.theming.darkMode = "on";
    s.dashboard.layout = "list";
    s.todo.recurring.push({ id: "r1", title: "Gym", rule: { freq: "daily" } });
    s.todo.tags.push("lab");
    s.grades.goals[7] = { target: 90, notify: true };
    s.grades.creditsByCourse[7] = 4;
    s.customThemes.push({ id: "t1", name: "Mine", settings: {} });
    s.navigation.global.customLinks.push({ id: "l1", label: "Mail", url: "https://mail.example.edu" });
    s.dashboard.courses[7] = { nickname: "Bio", hidden: true, color: "#ff0000", bgImage: "https://example.com/a.jpg" };
    s.onboarding.seen = true;
  });
  store.reset();
  const s = copy(store.get());
  assert.equal(s.theming.darkMode, "off");
  assert.equal(s.dashboard.layout, "grid");
  assert.equal(s.todo.recurring[0].title, "Gym");
  assert.deepEqual(s.todo.tags, ["lab"]);
  assert.equal(s.grades.goals[7].target, 90);
  assert.equal(s.grades.creditsByCourse[7], 4);
  assert.equal(s.customThemes[0].name, "Mine");
  assert.equal(s.navigation.global.customLinks[0].label, "Mail");
  assert.deepEqual(s.dashboard.courses[7], { nickname: "Bio", hidden: true });
  assert.equal(s.onboarding.seen, true);
  assert.equal(store.undo(), true);
  assert.equal(store.get().dashboard.courses[7].color, "#ff0000");
});

test("settings import recognizes backups and turns away locker and theme files", () => {
  const context = vm.createContext({ console, setTimeout, clearTimeout, structuredClone, navigator: { platform: "Win32" } });
  load(context, "src/shared/defaults.js", "src/content/core/util.js", "src/shared/settings/index.js");
  const kind = (j) => context.BC.SettingsUI.backupKind(j);
  assert.equal(kind({ kind: "better-canvas-backup", version: 5, settings: { theming: {} }, local: null }), "backup");
  assert.equal(kind({ settings: { theming: {} }, local: { notes: {} } }), "backup");
  assert.equal(kind({ version: 3, theming: { darkMode: "on" }, dashboard: {} }), "settings");
  assert.equal(kind({ format: "better-canvas-locker", version: 1, items: [] }), "locker");
  assert.equal(kind({ id: "x", name: "Mine", settings: { theming: {}, cosmetics: {} } }), "theme");
  assert.equal(kind({ hello: "world" }), null);
  assert.equal(kind([]), null);
});

test("shortcut recorder lets Tab move focus, clears on Backspace and ignores bare Enter", () => {
  const { domContext, load: loadDom } = require("./audit-helpers.cjs");
  const { dom, context } = domContext('<div id="root"></div>');
  try {
    loadDom(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/shortcuts.js", "src/shared/settings/components.js");
    let value = "Mod+K";
    const writes = [];
    const btn = context.BC.SettingsComponents.keybind({ get: () => value, set: (v) => { writes.push(v); value = v; } });
    dom.window.document.getElementById("root").append(btn);
    const press = (init) => {
      const e = new dom.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
      btn.dispatchEvent(e); return e;
    };
    btn.click();
    const tab = press({ key: "Tab", code: "Tab" });
    assert.equal(tab.defaultPrevented, false);
    assert.deepEqual(writes, []);
    assert.equal(btn.classList.contains("bcs-key--recording"), false);
    btn.click();
    assert.equal(press({ key: "Enter", code: "Enter" }).defaultPrevented, true);
    assert.deepEqual(writes, []);
    press({ key: "Backspace", code: "Backspace" });
    assert.deepEqual(writes, [""]);
    btn.click();
    press({ key: "j", code: "KeyJ", ctrlKey: true });
    assert.deepEqual(writes, ["", "Mod+J"]);
  } finally { dom.window.close(); }
});

test("typing in a settings field is one undo step but each switch click is its own", () => {
  const { store } = settingsStore();
  for (const css of ["a", "a{", "a{c", "a{co", "a{color:red}"]) store.set((s) => { s.cosmetics.customCss = css; });
  store.set((s) => { s.dashboard.hoverLift = false; });
  store.set((s) => { s.dashboard.hoverLift = true; });
  assert.equal(store.undo(), true);
  assert.equal(store.get().dashboard.hoverLift, false);
  assert.equal(store.undo(), true);
  assert.equal(store.get().dashboard.hoverLift, true);
  assert.equal(store.get().cosmetics.customCss, "a{color:red}");
  assert.equal(store.undo(), true);
  assert.equal(store.get().cosmetics.customCss, "");
  assert.equal(store.canUndo(), false);
});

test("pruning keeps every page's sticky notes, drops empty lists and expires week-old drafts", async () => {
  const { database } = require("./storage-harness.cjs");
  const notes = {};
  for (let i = 0; i < 150; i++) notes["https://school.instructure.com/p" + i] = [{ id: "n" + i, text: "note " + i }];
  notes["https://school.instructure.com/empty"] = [];
  const old = Date.now() - 8 * 864e5;
  const db = database({ bcLocal: { notes, drafts: { fresh: "keep", old: "drop", legacy: "keep for now" }, draftSavedAt: { fresh: Date.now(), old } } });
  const t = db.tab();
  await t.storage.loadLocal();
  await t.storage.prune();
  const local = db.data.bcLocal;
  assert.equal(Object.keys(local.notes).length, 150);
  assert.equal(local.notes["https://school.instructure.com/p0"][0].text, "note 0");
  assert.equal("https://school.instructure.com/empty" in local.notes, false);
  assert.deepEqual(Object.keys(local.drafts).sort(), ["fresh", "legacy"]);
  assert.equal(typeof local.draftSavedAt.legacy, "number");
  assert.equal("old" in local.draftSavedAt, false);
  // Nothing left to prune, so the next page load skips storage entirely.
  const reads = db.requests.length, events = db.events.length;
  await t.storage.prune();
  assert.equal(db.requests.length, reads);
  assert.equal(db.events.length, events);
});

test("two tabs finishing the same focus phase start the break once", async () => {
  const { database } = require("./storage-harness.cjs");
  const { domContext, load: loadDom, settle } = require("./audit-helpers.cjs");
  const endsAt = Date.now() - 1000;
  const db = database({ bcLocal: { pomodoro: { phase: "work", cycle: 0, startedAt: endsAt - 25 * 60000, endsAt, sessions: [] } } });
  async function view() {
    const client = db.client(), page = domContext("", { chrome: client.chrome });
    loadDom(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/datetime.js", "src/content/core/color.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/lifecycle.js", "src/content/core/storage.js");
    const BC = page.context.BC;
    await BC.storage.load(); await BC.storage.loadLocal();
    const toasts = [];
    BC.toast = { success: (m) => toasts.push(m), info: () => {}, error: () => {} };
    vm.runInContext(fs.readFileSync(path.join(root, "src/content/features/todo.js"), "utf8")
      .replace("  BC.registry.register({", "  BC.testAdvance = advancePomodoro;\n  BC.registry.register({"), page.context);
    return { BC, page, toasts };
  }
  const a = await view(), b = await view();
  try {
    const settings = a.BC.cloneDefaults();
    settings.todo.pomodoro = { ...(settings.todo.pomodoro || {}), sound: false };
    a.BC.testAdvance(settings, endsAt); b.BC.testAdvance(settings, endsAt);
    for (let i = 0; i < 6; i++) await settle();
    await a.BC.storage.updateLocal(() => {}); await b.BC.storage.updateLocal(() => {});
    for (let i = 0; i < 4; i++) await settle();
    const p = db.data.bcLocal.pomodoro;
    assert.equal(p.phase, "short");
    assert.equal(p.cycle, 1);
    assert.equal(p.sessions.length, 1);
    assert.equal(p.sessions[0].min, 25);
    assert.equal(a.toasts.length + b.toasts.length, 1);
  } finally { a.page.dom.window.close(); b.page.dom.window.close(); }
});
