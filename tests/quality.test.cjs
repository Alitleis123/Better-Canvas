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
