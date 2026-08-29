"use strict";
const { createSandbox, loadCore, load } = require("./harness");

function fresh() {
  const sb = createSandbox();
  loadCore(sb);
  return sb.BC;
}

module.exports = {
  "cloneDefaults is a deep copy"() {
    const BC = fresh();
    const a = BC.cloneDefaults(), b = BC.cloneDefaults();
    a.theming.darkMode = "on";
    a.dashboard.widgets.todo = false;
    assert.equal(b.theming.darkMode, "off");
    assert.equal(b.dashboard.widgets.todo, true);
  },

  "mergeDefaults fills missing keys and keeps stored ones"() {
    const BC = fresh();
    const out = BC.mergeDefaults({ version: 4, theming: { darkMode: "on" } });
    assert.equal(out.theming.darkMode, "on");
    assert.equal(out.theming.darkTone, "neutral");
    assert.equal(out.dashboard.enabled, true);
  },

  "mergeDefaults replaces arrays wholesale rather than merging them"() {
    const BC = fresh();
    const out = BC.mergeDefaults({ version: 4, notifications: { leadMinutes: [5] } });
    assert.deepEqual(out.notifications.leadMinutes, [5]);
  },

  "mergeDefaults tolerates junk input"() {
    const BC = fresh();
    assert.equal(BC.mergeDefaults(null).theming.darkMode, "off");
    assert.equal(BC.mergeDefaults("nope").theming.darkMode, "off");
    assert.equal(BC.mergeDefaults(42).theming.darkMode, "off");
  },

  "every default settings value round-trips through JSON"() {
    const BC = fresh();
    const d = BC.defaults;
    assert.deepEqual(JSON.parse(JSON.stringify(d)), d);
  },

  "settings version matches the highest migration"() {
    const BC = fresh();
    const highest = Math.max(...Object.keys(BC.MIGRATIONS).map(Number));
    assert.equal(BC.SETTINGS_VERSION, highest,
      "SETTINGS_VERSION must equal the highest migration key or that migration never runs");
    assert.equal(BC.defaults.version, BC.SETTINGS_VERSION);
  },

  "migration 3 carries gradeHistory out of settings"() {
    const BC = fresh();
    const carry = {};
    BC.mergeDefaults({ version: 2, grades: { gradeHistory: { "1": [{ date: "2026-01-01", score: 90 }] } } }, carry);
    assert.ok(carry.gradeHistory, "gradeHistory should be carried to bcLocal");
    assert.deepEqual(carry.gradeHistory["1"], [{ date: "2026-01-01", score: 90 }]);
  },

  "migration 3 removes gradeHistory from settings"() {
    const BC = fresh();
    const out = BC.mergeDefaults({ version: 2, grades: { gradeHistory: { "1": [] } } }, {});
    assert.equal(out.grades.gradeHistory, undefined);
  },

  "migration 4 renames whatIfEnabled and preserves a disabled panel"() {
    const BC = fresh();
    const off = BC.mergeDefaults({ version: 3, grades: { whatIfEnabled: false } }, {});
    assert.equal(off.grades.panelEnabled, false, "turning the panel off must survive the rename");
    assert.equal(off.grades.whatIfEnabled, undefined);
    const on = BC.mergeDefaults({ version: 3, grades: { whatIfEnabled: true } }, {});
    assert.equal(on.grades.panelEnabled, true);
  },

  "migration 4 carries planner metadata and notification history to bcLocal"() {
    const BC = fresh();
    const carry = {};
    BC.mergeDefaults({
      version: 3,
      todo: { local: { stars: { a: true } } },
      notifications: { history: [{ title: "x" }] },
    }, carry);
    assert.deepEqual(carry.local.todo, { stars: { a: true } });
    assert.deepEqual(carry.local.notifHistory, [{ title: "x" }]);
  },

  "migration 4 deletes settings that were wired to nothing"() {
    const BC = fresh();
    const out = BC.mergeDefaults({
      version: 3,
      dashboard: { groupBy: "x", hoverPreview: true, widgets: { streak: true, weekly: true } },
      theming: { perCourseAccent: true },
      shortcuts: { vimMode: true },
    }, {});
    assert.equal(out.dashboard.groupBy, undefined);
    assert.equal(out.dashboard.hoverPreview, undefined);
    assert.equal(out.dashboard.widgets.streak, undefined);
    assert.equal(out.dashboard.widgets.weekly, undefined);
    assert.equal(out.theming.perCourseAccent, undefined);
    assert.equal(out.shortcuts.vimMode, undefined);
  },

  "migration 4 sanitizes a todo view that no longer exists"() {
    const BC = fresh();
    assert.equal(BC.mergeDefaults({ version: 3, todo: { view: "day" } }, {}).todo.view, "list");
    assert.equal(BC.mergeDefaults({ version: 3, todo: { view: "kanban" } }, {}).todo.view, "kanban");
  },

  "migrating is idempotent"() {
    const BC = fresh();
    const once = BC.mergeDefaults({ version: 2, grades: { whatIfEnabled: false } }, {});
    const twice = BC.mergeDefaults(JSON.parse(JSON.stringify(once)), {});
    assert.deepEqual(twice, once);
  },

  "a v1 settings blob migrates all the way forward"() {
    const BC = fresh();
    const out = BC.mergeDefaults({ version: 1, theming: { darkMode: "on" } }, {});
    assert.equal(out.version, BC.SETTINGS_VERSION);
    assert.equal(out.theming.darkMode, "on");
  },

  "a settings blob with no version migrates all the way forward"() {
    const BC = fresh();
    const out = BC.mergeDefaults({ theming: { darkMode: "on" } }, {});
    assert.equal(out.version, BC.SETTINGS_VERSION);
  },

  "isDarkActive honours each mode"() {
    const BC = fresh();
    assert.equal(BC.isDarkActive({ theming: { darkMode: "on" } }), true);
    assert.equal(BC.isDarkActive({ theming: { darkMode: "off" } }), false);
    assert.equal(BC.isDarkActive(null), false);
    assert.equal(BC.isDarkActive({}), false);
  },

  "isDarkActive follows the schedule window"() {
    const BC = fresh();
    const s = { theming: { darkMode: "scheduled", darkSchedule: { start: "20:00", end: "07:00" } } };
    // withinSchedule reads the real clock, so just assert it returns a boolean
    // and that a degenerate window is false.
    assert.equal(typeof BC.isDarkActive(s), "boolean");
    const degenerate = { theming: { darkMode: "scheduled", darkSchedule: { start: "08:00", end: "08:00" } } };
    assert.equal(BC.isDarkActive(degenerate), false);
  },

  "every GPA scale ends with a zero floor so no score is unclassified"() {
    const BC = fresh();
    for (const [key, scale] of Object.entries(BC.GPA_SCALES)) {
      const last = scale.bands[scale.bands.length - 1];
      assert.equal(last.min, 0, `${key} must have a min:0 band or gradePoints returns undefined`);
      const mins = scale.bands.map((b) => b.min);
      const sorted = mins.slice().sort((a, b) => b - a);
      assert.deepEqual(mins, sorted, `${key} bands must be sorted high to low`);
    }
  },

  "every preset theme references real tones and presets"() {
    const BC = fresh();
    for (const t of BC.PRESET_THEMES) {
      const th = t.settings.theming || {};
      if (th.darkTone) assert.ok(BC.DARK_TONES[th.darkTone], `${t.id} unknown darkTone ${th.darkTone}`);
      if (th.lightPreset) assert.ok(BC.LIGHT_PRESETS[th.lightPreset], `${t.id} unknown lightPreset ${th.lightPreset}`);
      if (th.accentColor) assert.ok(BC.color.isHex(th.accentColor), `${t.id} bad accent ${th.accentColor}`);
    }
  },

  "preset theme ids are unique"() {
    const BC = fresh();
    const ids = BC.PRESET_THEMES.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
  },

  "shortcut binding ids match the labels the settings UI renders"() {
    const BC = fresh();
    const bindings = Object.keys(BC.defaults.shortcuts.bindings).sort();
    const labelled = ["commandPalette", "settings", "toggleDark", "quickTask", "quickNote",
                      "gotoDashboard", "gotoGrades", "gotoInbox", "gotoCalendar", "focusMode"].sort();
    assert.deepEqual(bindings, labelled,
      "a binding with no label is unreachable from the UI, and vice versa");
  },
};
