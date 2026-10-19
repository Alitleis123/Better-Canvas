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

async function plannerContext() {
  const { database } = require("./storage-harness.cjs");
  const { domContext, load: loadDom } = require("./audit-helpers.cjs");
  const db = database({ bcLocal: {} }), client = db.client(), page = domContext("", { chrome: client.chrome });
  loadDom(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/datetime.js", "src/content/core/color.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/lifecycle.js", "src/content/core/storage.js");
  const BC = page.context.BC;
  await BC.storage.load(); await BC.storage.loadLocal();
  vm.runInContext(fs.readFileSync(path.join(root, "src/content/features/todo.js"), "utf8")
    .replace("  BC.registry.register({", "  BC.test = { expandRecurring, focusTarget, restoreFocus };\n  BC.registry.register({"), page.context);
  return { BC, page };
}

test("recurring tasks clamp to short months and start on the day they were made", async () => {
  const { BC, page } = await plannerContext();
  try {
    const s = BC.cloneDefaults();
    s.todo.recurring = [{ id: "m", title: "Rent", rule: "monthly", day: 31 }, { id: "d", title: "Read", rule: "daily", from: "2027-02-03" }];
    const days = (id) => BC.test.expandRecurring(s, new Date(2027, 1, 1), new Date(2027, 2, 1)).filter((x) => x.bcRuleId === id).map((x) => x.bcYmd);
    assert.deepEqual(copy(days("m")), ["2027-02-28"]);
    assert.equal(days("d")[0], "2027-02-03");
    assert.equal(days("d").length, 26);
  } finally { page.dom.window.close(); }
});

test("a planner rebuild puts focus back on the same control or the next row", async () => {
  const { BC, page } = await plannerContext();
  try {
    const doc = page.dom.window.document;
    const build = (keys) => { const box = doc.createElement("div"); box.innerHTML = keys.map((k) => `<li data-key="${k}"><input type="checkbox" aria-label="Done ${k}"><button aria-label="Star ${k}">*</button></li>`).join(""); return box; };
    const container = doc.createElement("div"); doc.body.append(container);
    container.append(build(["a", "b", "c"]));
    container.querySelector('[aria-label="Star b"]').focus();
    let had = BC.test.focusTarget(container, doc.activeElement);
    container.replaceChildren(build(["a", "b", "c"]));
    BC.test.restoreFocus(container, had);
    assert.equal(doc.activeElement.getAttribute("aria-label"), "Star b");
    container.querySelector('[aria-label="Done b"]').focus();
    had = BC.test.focusTarget(container, doc.activeElement);
    container.replaceChildren(build(["a", "c"]));
    BC.test.restoreFocus(container, had);
    assert.equal(doc.activeElement.getAttribute("aria-label"), "Done c");
  } finally { page.dom.window.close(); }
});

test("calendar export keeps event spans, skips announcements and gives each type its own UID", async () => {
  const { domContext, load: loadDom } = require("./audit-helpers.cjs");
  const { dom, context } = domContext("");
  try {
    loadDom(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/datetime.js");
    const BC = context.BC;
    BC.registry = { register() {} }; BC.storage = { local: {} };
    BC.toast = { success() {}, error(m) { throw Error(m); } };
    BC.api = { plannerItems: async () => [
      { plannable_type: "assignment", plannable_id: 5, plannable_date: "2027-03-01T15:00:00Z", plannable: { title: "Essay" }, html_url: "/courses/1/assignments/5" },
      { plannable_type: "discussion_topic", plannable_id: 5, plannable_date: "2027-03-02T15:00:00Z", plannable: { title: "Forum" } },
      { plannable_type: "announcement", plannable_id: 9, plannable_date: "2027-03-01T12:00:00Z", plannable: { title: "News" } },
      { plannable_type: "calendar_event", plannable_id: 7, plannable_date: "2027-03-03T14:00:00Z", plannable: { title: "Lab", start_at: "2027-03-03T14:00:00Z", end_at: "2027-03-03T16:00:00Z" } },
    ] };
    let blob;
    dom.window.URL.createObjectURL = (b) => { blob = b; return "blob:test"; };
    dom.window.URL.revokeObjectURL = () => {};
    dom.window.HTMLAnchorElement.prototype.click = () => {};
    loadDom(context, "src/content/features/calendar.js");
    await BC.calendar.exportIcs();
    const ics = await blob.text();
    assert.equal(ics.includes("News"), false);
    assert.match(ics, /UID:bc-assignment-5@bc-test\.instructure\.com/);
    assert.match(ics, /UID:bc-discussion_topic-5@bc-test\.instructure\.com/);
    assert.match(ics, /DTSTART:20270303T140000Z\r\nDTEND:20270303T160000Z/);
    assert.match(ics, /URL:http:\/\/bc-test\.instructure\.com\/courses\/1\/assignments\/5/);
  } finally { dom.window.close(); }
});

test("syllabus scan ignores words that start like months, fractions, and keeps table rows whole", () => {
  const { domContext, load: loadDom } = require("./audit-helpers.cjs");
  const { dom, context } = domContext('<div id="course_syllabus">' +
    "<p>Decide 3 topics for the project</p><p>Marks 10 points</p><p>The final is worth 1/2 of the grade</p>" +
    "<p>Quiz 1 on Sept. 14<br>Quiz 2 on October 5</p>" +
    "<table><tr><td>Mar 3</td><td>Reading: chapter 4</td></tr></table></div>");
  try {
    loadDom(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/datetime.js");
    context.BC.registry = { register() {} };
    vm.runInContext(fs.readFileSync(path.join(root, "src/content/features/syllabus.js"), "utf8")
      .replace("  BC.registry.register(", "  BC.testCandidates = candidates;\n  BC.registry.register("), context);
    const found = context.BC.testCandidates().map((f) => [f.title, f.date.getMonth(), f.date.getDate()]);
    assert.deepEqual(copy(found), [
      ["Quiz 1 on Sept. 14", 8, 14], ["Quiz 2 on October 5", 9, 5], ["Mar 3 · Reading: chapter 4", 2, 3],
    ]);
  } finally { dom.window.close(); }
});

test("grade tools show Canvas's current score and keep the final-exam inputs through a rebuild", async () => {
  const { domContext, load: loadDom, settle } = require("./audit-helpers.cjs");
  const { dom, context } = domContext('<div id="main"><div id="grades_summary"></div></div>');
  try {
    loadDom(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/datetime.js", "src/content/core/ui.js", "src/content/core/lifecycle.js");
    const BC = context.BC, nodes = new Map();
    BC.injector = { setStyle() {}, removeNode() {}, ensureNode(id, host, factory) { if (!nodes.has(id)) nodes.set(id, factory()); return nodes.get(id); } };
    BC.registry = { register(feature) { BC.feature = feature; } };
    // Our own estimate would be 50%. Canvas says 88.
    BC.api = { assignmentGroups: async () => [{ assignments: [{ id: 1, points_possible: 10, submission: { score: 5 } }] }],
      coursesWithScores: async () => [{ id: 7, enrollments: [{ computed_current_score: 88 }] }] };
    BC.storage = { local: {}, updateLocal: async () => {}, update: async () => {} };
    loadDom(context, "src/content/features/grades.js");
    const settings = BC.cloneDefaults(); settings.grades.autoRefresh = false;
    const ctx = { page: "grades", courseId: "7", path: "/courses/7/grades" };
    BC.feature.apply(settings, ctx); await settle(); await settle();
    const doc = dom.window.document;
    assert.equal(doc.querySelector(".bc-gt-total").textContent, "88.00%");
    doc.querySelector("[data-target]").value = "99"; doc.querySelector("[data-weight]").value = "10";
    doc.querySelector("[data-target]").dispatchEvent(new dom.window.Event("input"));
    assert.match(doc.querySelector("[data-final-needed]").textContent, /more than a perfect score/);
    settings.grades.showTrendChart = !settings.grades.showTrendChart;   // forces a rebuild
    BC.feature.apply(settings, ctx); await settle(); await settle();
    assert.equal(doc.querySelector("[data-target]").value, "99");
    assert.equal(doc.querySelector("[data-weight]").value, "10");
  } finally { dom.window.close(); }
});

test("scene themes store short references, resolve when painted and compact old data URIs", () => {
  const ctx = vm.createContext({ URL, console, setTimeout, clearTimeout, structuredClone, navigator: { platform: "Win32" }, chrome: { runtime: { getURL: (s) => "chrome-extension://x/" + s } } });
  for (const file of ["src/shared/defaults.js", "src/content/core/util.js", "src/shared/themes.js", "src/shared/theme-library.js", "src/shared/theme-scenes.js", "src/shared/theme-artwork.js", "src/shared/theme-media.js"]) load(ctx, file);
  const { BC } = ctx;
  const s = BC.cloneDefaults();
  BC.applyTheme(s, BC.PRESET_THEMES.find((p) => p.id === "scene-woodland"));
  assert.ok(JSON.stringify(s).length < 20000, "settings stay small: " + JSON.stringify(s).length);
  assert.equal(s.dashboard.themeImages[3].url, "bc-scene:woodland#3");
  assert.equal(s.cosmetics.background.image, "bc-scene:woodland#731:wall");
  assert.ok(BC.util.isSafeUrl(s.dashboard.themeImages[3].url));
  assert.match(BC.util.cssUrl(s.dashboard.themeImages[3].url), /^data:image\/svg\+xml,/);
  assert.equal(BC.themeMedia.style("bc-scene:woodland#3").includes("background-size:cover"), true);
  // What 3.3.1 stored: the drawing itself.
  const old = BC.cloneDefaults();
  old.theming.experience = "woodland";
  old.dashboard.themeImages = [BC.sceneArtData("woodland", 3), { url: "https://example.com/a.jpg", title: "Photo · composition 2" }];
  old.cosmetics.background = { mode: "image", image: BC.sceneArtData("woodland", 731, true).url };
  const merged = BC.mergeDefaults(JSON.parse(JSON.stringify(old)));
  assert.equal(merged.dashboard.themeImages[0].url, "bc-scene:woodland#3");
  assert.equal(merged.dashboard.themeImages[1].url, "https://example.com/a.jpg");
  assert.equal(merged.cosmetics.background.image, "bc-scene:woodland#731:wall");
  assert.equal(BC.themeMedia.parse("bc-scene:nowhere#1"), null);
});

test("number fields ignore out-of-range typing and clamp on change; lists reorder with arrow keys", () => {
  const { domContext, load: loadDom } = require("./audit-helpers.cjs");
  const { dom, context } = domContext('<div id="root"></div>');
  try {
    loadDom(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/shared/settings/components.js");
    const C = context.BC.SettingsComponents, doc = dom.window.document, ev = (n, t) => n.dispatchEvent(new dom.window.Event(t, { bubbles: true }));
    let width = 200;
    const num = C.number({ get: () => width, set: (v) => { width = v; }, min: 150, max: 400 });
    doc.getElementById("root").append(num);
    const inp = num.querySelector("input");
    for (const v of ["2", "25", "250"]) { inp.value = v; ev(inp, "input"); }
    assert.equal(width, 250);
    inp.value = "4000"; ev(inp, "input");
    assert.equal(width, 250);
    ev(inp, "change");
    assert.equal(width, 400);
    let order = null;
    const list = C.sortable({ items: [{ id: "a" }, { id: "b" }, { id: "c" }], render: (it) => doc.createTextNode(it.id), onChange: (ids) => { order = [...ids]; } });
    doc.getElementById("root").append(list);
    const grip = list.querySelectorAll(".bcs-sortable__grip")[2];
    grip.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    assert.deepEqual(order, ["a", "c", "b"]);
    assert.equal(doc.activeElement, grip);
  } finally { dom.window.close(); }
});

test("study time counts active focused seconds and the background adds them", async () => {
  const { database } = require("./storage-harness.cjs");
  const { domContext, load: loadDom, settle } = require("./audit-helpers.cjs");
  const db = database({ bcLocal: { studyTime: {} } });
  const client = db.client();
  const sent = [];
  const send = client.chrome.runtime.sendMessage;
  client.chrome.runtime.sendMessage = (msg, cb) => { if (msg.type === "bc:studyTime") sent.push(msg); return send(msg, cb || (() => {})); };
  const { dom, context } = domContext("", { chrome: client.chrome });
  try {
    let now = 1_800_000_000_000;
    dom.window.Date.now = () => now;
    dom.window.document.hasFocus = () => true;
    loadDom(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/datetime.js", "src/content/core/lifecycle.js");
    const BC = context.BC;
    const s = BC.cloneDefaults();
    BC.storage = { current: s };
    BC.detect = { context: () => ({ courseId: "42" }) };
    BC.registry = { register(f) { BC.feature = f; } };
    loadDom(context, "src/content/features/insights.js");
    BC.feature.apply(s);
    now += 15000;
    dom.window.dispatchEvent(new dom.window.Event("pagehide"));
    await settle(); await settle(); await settle();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].key, "42");
    assert.equal(sent[0].minutes, 0.25);
    const ymd = sent[0].ymd;
    assert.equal(db.data.bcLocal.studyTime[ymd]["42"], 0.25);
    // Ten idle minutes later nothing more is counted.
    now += 10 * 60000;
    dom.window.dispatchEvent(new dom.window.Event("pagehide"));
    await settle();
    assert.equal(sent.length, 1);
  } finally { dom.window.close(); }
});
