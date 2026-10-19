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
