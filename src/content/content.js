/*
 * Better Canvas — content entry point.
 * Confirms Canvas, applies every feature (idempotent apply(settings, ctx)),
 * survives Canvas SPA re-renders via the observer, registers shortcuts
 * and command-palette entries, and responds to popup/options messages.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  let shortcutSig = null;
  // Drives the "apply once more on the way out" rule for page-scoped features.
  let lastPage = null;

  BC.applyAll = function (settings) {
    if (!settings) return;
    const ctx = BC.detect.context();

    // Settings panel always applies, even when the extension is "off",
    // so the user can reach the toggle. It registers last (load order),
    // so run it explicitly and skip it in the main loop.
    const sp = BC.features.settingsPanel;
    if (sp) BC.util.guard(() => sp.apply(settings, ctx), "settingsPanel");
    if (!settings.enabled) return teardown();
    if (tornDown) remount();

    // Page-scoped features are skipped entirely while off their page. applyAll
    // runs several times a second, so calling all ~24 features on every tick
    // meant most of them were doing a selector query only to early-return.
    // They still get one call on the tick the page changes, which is where their
    // own cleanup branch lives.
    const pageChanged = ctx.page !== lastPage;
    lastPage = ctx.page;

    for (const f of BC.registry.all()) {
      if (f === sp) continue;
      if (!BC.registry.shouldApply(f, ctx.page, pageChanged)) continue;
      BC.util.guard(() => f.apply(settings, ctx), f.id);
    }

    // Shortcuts + palette registration. Signature-guarded: this re-registered all
    // ten handlers on every applyAll, i.e. several times a second forever.
    //
    // Handler ids ARE the settings.shortcuts.bindings keys, so a rebinding lines
    // up with the entry it should update and BC.shortcuts.reloadFromSettings
    // actually finds it.
    const sBindings = (settings.shortcuts && settings.shortcuts.bindings) || {};
    const quickSearch = !(settings.navigation && settings.navigation.quickSearch === false);
    const sSig = Object.keys(sBindings).sort().map((k) => k + "=" + sBindings[k]).join("|") + "|qs=" + quickSearch;
    if (BC.shortcuts && settings.shortcuts && settings.shortcuts.enabled && sSig !== shortcutSig) {
      shortcutSig = sSig;
      const b = sBindings;
      const bind = (key, fn) => BC.shortcuts.register(key, b[key], fn);
      // navigation.quickSearch was a live switch that nothing read — the palette
      // shortcut registered unconditionally.
      if (quickSearch) bind("commandPalette", () => BC.palette && BC.palette.open());
      else BC.shortcuts.unregister("commandPalette");
      bind("settings",      () => BC.features.settingsPanel && BC.features.settingsPanel.open());
      bind("toggleDark",    () => BC.storage.update((d) => { d.theming.darkMode = BC.isDarkActive(d) ? "off" : "on"; }));
      bind("quickTask",     () => quickTaskFlow());
      bind("quickNote",     () => BC.quickNote && BC.quickNote());
      bind("gotoDashboard", () => location.assign("/"));
      bind("gotoGrades",    () => { const cid = BC.util.courseIdFromHref(location.pathname); if (cid) location.assign("/courses/" + cid + "/grades"); else BC.toast.info("Open a course first"); });
      bind("gotoInbox",     () => location.assign("/conversations"));
      bind("gotoCalendar",  () => location.assign("/calendar"));
      bind("focusMode",     () => BC.storage.update((d) => { d.productivity.focusMode = !d.productivity.focusMode; }));
      BC.shortcuts.reloadFromSettings(settings);
    }

    // Register once, not on every applyAll. This used to re-register ~10 static
    // commands plus up to 40 course entries per tick, and re-issued
    // BC.api.dashboardCards() every time.
    if (BC.palette) {
      const pbag = BC.lifecycle.bag("palette");
      pbag.once("commands", () => registerPaletteCommands(settings));
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

  function quickTaskFlow(defaultTitle, details) {
    const title = prompt("New task title:", defaultTitle || "");
    if (!title) return;
    const ctx = BC.detect.context();
    BC.api.createPlannerNote({
      title, details,
      todoDate: new Date().toISOString(),
      courseId: ctx.courseId || undefined,
    })
      .then(() => BC.toast.success("Task added"))
      .catch((e) => BC.toast.error("Failed: " + e.message));
  }

  let tornDown = false;

  const ROOT_ATTRS = [
    "data-bc-accent", "data-bc-density", "data-bc-radius", "data-bc-focus",
    "data-bc-cursor", "data-bc-hc", "data-bc-motion", "data-bc-rounded",
  ];

  function teardown() {
    // applyAll keeps running ~5x/sec while disabled, so this has to be a no-op
    // after the first pass rather than re-tearing-down forever.
    if (tornDown) return;
    tornDown = true;

    for (const k of BC.registry.styleKeys()) BC.injector.removeStyle(k);
    for (const n of BC.registry.nodeKeys()) BC.injector.removeNode(n);
    for (const f of BC.registry.all()) {
      // The drawer deliberately survives teardown so the user can always reach the
      // toggle to switch the extension back on.
      if (f.id === "settingsPanel") continue;
      if (f.unmount) BC.util.guard(() => f.unmount(), f.id + ":unmount");
      BC.lifecycle.clear(f.id);
    }

    // Alarms outlived teardown, so notification scans kept hitting the Canvas API
    // while the extension was "off".
    BC.alarms.clearAll();
    if (BC.notifications) BC.util.guard(() => BC.notifications.sendBadge(0), "badge clear");

    // Core surfaces are not registry features, so styleKeys()/nodeKeys() above
    // don't reach them and their stylesheets outlived a disable.
    if (BC.palette) BC.util.guard(() => BC.palette.close(), "palette close");
    for (const n of ["bc-toast-host", "bc-toast-host-alert", "bc-live-polite", "bc-live-assertive", "bc-cp"]) {
      BC.injector.removeNode(n);
    }
    for (const k of ["bc-toast-css", "bc-cp-css"]) BC.injector.removeStyle(k);

    const doc = document.documentElement;
    doc.classList.remove("bc-dark");
    doc.classList.remove("bc-focus");
    // Inline state no stylesheet removal can undo: leaving the colour-blind filter
    // in place meant disabling the extension left the ENTIRE page tinted until a
    // reload.
    doc.style.filter = "";
    doc.style.removeProperty("--bc-anim-speed");
    doc.style.removeProperty("--bc-sidebar-w");
    for (const a of ROOT_ATTRS) doc.removeAttribute(a);
  }

  function startAlarms() {
    BC.alarms.every("bc-dark-eval", 60 * 1000, () => {
      if (BC.storage.current && BC.storage.current.theming.darkMode === "scheduled") requestApply();
    });
  }

  // Re-enabling used to require a page reload: module-level install flags were
  // never reset and no feature implemented unmount(), so features that had latched
  // simply never came back.
  function remount() {
    tornDown = false;
    lastPage = null;   // force one full pass so page-scoped features re-mount
    startAlarms();
  }

  const requestApply = BC.util.debounce(() => BC.applyAll(BC.storage.current), 120);
  BC.requestApply = requestApply;

  // Zero-latency path for the settings drawer. Coalesced by requestAnimationFrame
  // so it runs at most once per frame and lands before the next paint, instead of
  // waiting out the 220ms save debounce plus a chrome.storage round-trip (~345ms
  // from click to the page changing).
  let rafPending = false;
  BC.applyNow = function () {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; BC.applyAll(BC.storage.current); });
  };

  // Messages from the toolbar button, the options page and the context menu
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "bc:ping") {
      sendResponse({ canvas: BC.detect.isCanvas(), context: BC.detect.context(), version: BC.VERSION });
      return;
    }
    if (msg.type === "bc:openSettings") {
      // ok is the toolbar click's fallback signal, so it has to be honest: the
      // content script also runs on instructure.com pages that are not Canvas,
      // where there is no nav to hang a drawer off. Saying ok there would leave
      // the click doing nothing at all.
      const panel = BC.detect.isCanvas() && BC.features.settingsPanel;
      if (panel) BC.util.guard(() => panel.open(), "openSettings");
      sendResponse({ ok: !!panel }); return;
    }
    if (msg.type === "bc:openPalette") {
      BC.util.guard(() => BC.palette && BC.palette.open(), "openPalette");
      sendResponse({ ok: true }); return;
    }
    // The service worker has always SENT this from its context menu, but there was
    // no listener — so "Better Canvas: add this as a task" was a silent no-op.
    if (msg.type === "bc:addTaskFromContext") {
      const i = msg.info || {};
      const title = String(i.selectionText || "").trim().slice(0, 120) || document.title;
      BC.util.guard(() => quickTaskFlow(title, i.linkUrl || i.pageUrl || location.href), "ctxTask");
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
    startAlarms();
  }

  function boot() {
    Promise.all([BC.storage.load(), BC.storage.loadLocal()]).catch((e) => {
      // Without this the whole extension just never starts, with nothing in the
      // console to say why. Fall back to defaults so the settings drawer is
      // still reachable.
      BC.util.err("settings load failed, starting from defaults", e);
      return [BC.cloneDefaults()];
    }).then(([settings]) => {
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
