/*
 * Better Canvas — content entry point.
 * Confirms Canvas, applies every feature (idempotent apply(settings, ctx)),
 * survives Canvas SPA re-renders via the observer, registers shortcuts
 * and command-palette entries, and responds to popup/options messages.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  BC.applyAll = function (settings) {
    if (!settings) return;
    const ctx = BC.detect.context();

    // Settings panel always applies, even when the extension is "off",
    // so the user can reach the toggle. It registers last (load order),
    // so run it explicitly and skip it in the main loop.
    const sp = BC.features.settingsPanel;
    if (sp) BC.util.guard(() => sp.apply(settings, ctx), "settingsPanel");
    if (!settings.enabled) return teardown();

    for (const f of BC.registry.all()) {
      if (f === sp) continue;
      BC.util.guard(() => f.apply(settings, ctx), f.id);
    }

    // Shortcuts + palette registration
    if (BC.shortcuts && settings.shortcuts && settings.shortcuts.enabled) {
      BC.shortcuts.reloadFromSettings(settings);
      const b = settings.shortcuts.bindings || {};
      BC.shortcuts.register("bc-palette", b.commandPalette,     () => BC.palette && BC.palette.open());
      BC.shortcuts.register("bc-settings", b.settings,          () => BC.features.settingsPanel && BC.features.settingsPanel.open());
      BC.shortcuts.register("bc-dark",     b.toggleDark,        () => BC.storage.update((d) => { d.theming.darkMode = BC.isDarkActive(d) ? "off" : "on"; }));
      BC.shortcuts.register("bc-task",     b.quickTask,         () => quickTaskFlow());
      BC.shortcuts.register("bc-note",     b.quickNote,         () => BC.quickNote && BC.quickNote());
      BC.shortcuts.register("bc-dash",     b.gotoDashboard,     () => location.assign("/"));
      BC.shortcuts.register("bc-grades",   b.gotoGrades,        () => { const cid = BC.util.courseIdFromHref(location.pathname); if (cid) location.assign("/courses/" + cid + "/grades"); else BC.toast.info("Open a course first"); });
      BC.shortcuts.register("bc-inbox",    b.gotoInbox,         () => location.assign("/conversations"));
      BC.shortcuts.register("bc-cal",      b.gotoCalendar,      () => location.assign("/calendar"));
      BC.shortcuts.register("bc-focus",    b.focusMode,         () => BC.storage.update((d) => { d.productivity.focusMode = !d.productivity.focusMode; }));
    }

    if (BC.palette) {
      registerPaletteCommands(settings);
    }
  };

  function registerPaletteCommands(settings) {
    BC.palette.register({ id: "open-settings", title: "Open settings",     hint: "drawer", group: "Better Canvas", run: () => BC.features.settingsPanel.open() });
    BC.palette.register({ id: "toggle-dark",   title: "Toggle dark mode",  hint: "",       group: "Better Canvas", run: () => BC.storage.update((d) => { d.theming.darkMode = BC.isDarkActive(d) ? "off" : "on"; }) });
    BC.palette.register({ id: "toggle-focus",  title: "Toggle focus mode", hint: "",       group: "Better Canvas", run: () => BC.storage.update((d) => { d.productivity.focusMode = !d.productivity.focusMode; }) });
    BC.palette.register({ id: "quick-note",    title: "New sticky note",   hint: "",       group: "Better Canvas", run: () => BC.quickNote && BC.quickNote() });
    BC.palette.register({ id: "export-ics",    title: "Export calendar (.ics)", hint: "",  group: "Better Canvas", run: () => BC.calendar && BC.calendar.exportIcs() });
    BC.palette.register({ id: "goto-dash",     title: "Go to dashboard",   hint: "",       group: "Navigate",       run: () => location.assign("/") });
    BC.palette.register({ id: "goto-inbox",    title: "Go to inbox",       hint: "",       group: "Navigate",       run: () => location.assign("/conversations") });
    BC.palette.register({ id: "goto-cal",      title: "Go to calendar",    hint: "",       group: "Navigate",       run: () => location.assign("/calendar") });
    BC.palette.register({ id: "goto-grades",   title: "Grades (this course)", hint: "",    group: "Navigate",       run: () => { const cid = BC.util.courseIdFromHref(location.pathname); if (cid) location.assign("/courses/" + cid + "/grades"); else BC.toast.info("Open a course first"); } });
    // Course jump commands
    if (BC.api) {
      BC.api.dashboardCards().then((cards) => {
        for (const c of cards.slice(0, 40)) {
          BC.palette.register({ id: "goto-course-" + c.id, title: "Go to: " + (c.shortName || c.originalName || c.courseCode || c.id), group: "Courses", run: () => location.assign("/courses/" + c.id) });
        }
      }).catch(() => {});
    }
  }

  function quickTaskFlow() {
    const title = prompt("New task title:");
    if (!title) return;
    BC.api.createPlannerNote({ title, todoDate: new Date().toISOString() })
      .then(() => BC.toast.success("Task added"))
      .catch((e) => BC.toast.error("Failed: " + e.message));
  }

  function teardown() {
    for (const k of BC.registry.styleKeys()) BC.injector.removeStyle(k);
    for (const n of BC.registry.nodeKeys()) BC.injector.removeNode(n);
    for (const f of BC.registry.all()) {
      if (f.unmount) BC.util.guard(() => f.unmount(), f.id + ":unmount");
      BC.lifecycle.clear(f.id);
    }
    document.documentElement.classList.remove("bc-dark");
    document.documentElement.classList.remove("bc-focus");
  }

  const requestApply = BC.util.debounce(() => BC.applyAll(BC.storage.current), 120);
  BC.requestApply = requestApply;

  // Messages from popup / options page
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "bc:ping") {
      sendResponse({ canvas: BC.detect.isCanvas(), context: BC.detect.context(), version: BC.VERSION });
      return;
    }
    if (msg.type === "bc:openSettings") {
      BC.util.guard(() => BC.features.settingsPanel && BC.features.settingsPanel.open(), "openSettings");
      sendResponse({ ok: true }); return;
    }
    if (msg.type === "bc:openPalette") {
      BC.util.guard(() => BC.palette && BC.palette.open(), "openPalette");
      sendResponse({ ok: true }); return;
    }
    if (msg.type === "bc:getCourses") {
      BC.api.dashboardCards().then((cards) => sendResponse({ ok: true, courses: cards.map((c) => ({
        id: String(c.id), name: c.shortName || c.originalName || c.courseCode || ("Course " + c.id),
        code: c.courseCode || "", color: c.color || "",
      })) })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
    if (msg.type === "bc:gpaData") {
      BC.api.coursesWithScores().then((courses) => sendResponse({ ok: true, courses: courses.map((c) => {
        const enr = (c.enrollments || [])[0] || {};
        const score = enr.computed_current_score != null ? enr.computed_current_score : enr.computed_final_score;
        return { id: String(c.id), name: c.name || c.course_code || ("Course " + c.id), score: score == null ? null : Number(score), concluded: c.concluded === true || enr.enrollment_state === "completed" };
      }) })).catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
  });

  function start(settings) {
    BC.applyAll(settings);
    BC.observer.start(requestApply);
    BC.storage.subscribe(() => requestApply());
    BC.storage.prune();
    BC.alarms.every("bc-dark-eval", 60 * 1000, () => {
      if (BC.storage.current && BC.storage.current.theming.darkMode === "scheduled") requestApply();
    });
  }

  function boot() {
    Promise.all([BC.storage.load(), BC.storage.loadLocal()]).then(([settings]) => {
      let tries = 0;
      const tryStart = () => {
        if (BC.detect.isCanvas()) return start(settings);
        if (tries++ < 24) setTimeout(tryStart, 250);
      };
      BC.util.whenBody(tryStart);
    });
  }

  boot();
})();
