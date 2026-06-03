/*
 * Better Canvas — content entry point.
 * Confirms this is Canvas, applies every feature, keeps them applied across
 * re-renders, reacts live to settings changes, and answers messages from the
 * popup/options pages (course lists, GPA data) using the same-origin session.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const FEATURE_ORDER = ["theming", "cosmetics", "navigation", "dashboard", "todo", "grades"];
  const STYLE_KEYS = [
    "bc-dark", "bc-theming", "bc-bg", "bc-custom-css", "bc-navigation",
    "bc-dashboard-widgets", "bc-dashboard-ui", "bc-grade-tools",
    "bc-todo-clean", "bc-todo-widget-css", "bc-todo-hide",
  ];

  BC.applyAll = function (settings) {
    if (!settings) return;
    const ctx = BC.detect.context();
    // The settings surface stays available even when Better Canvas is disabled,
    // so the user always has an in-page way to turn things back on.
    if (BC.features.settingsPanel)
      BC.util.guard(() => BC.features.settingsPanel.apply(settings, ctx), "settingsPanel");
    if (!settings.enabled) return teardown();
    for (const key of FEATURE_ORDER) {
      const f = BC.features[key];
      if (f) BC.util.guard(() => f.apply(settings, ctx), key);
    }
  };

  function teardown() {
    for (const k of STYLE_KEYS) BC.injector.removeStyle(k);
    for (const n of ["bc-bg", "bc-card-editor", "bc-grade-tools", "bc-todo-widget"])
      BC.injector.removeNode(n);
    document.documentElement.classList.remove("bc-dark");
  }

  const requestApply = BC.util.debounce(
    () => BC.applyAll(BC.storage.current),
    120
  );
  BC.requestApply = requestApply;

  // Messages from popup/options. These run on the Canvas origin so the API
  // calls carry the user's session; results stay in the extension.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "bc:ping") {
      sendResponse({ canvas: BC.detect.isCanvas(), context: BC.detect.context() });
      return; // sync
    }
    if (msg.type === "bc:openSettings") {
      BC.util.guard(
        () => BC.features.settingsPanel && BC.features.settingsPanel.open(),
        "openSettings"
      );
      sendResponse({ ok: true });
      return; // sync
    }
    if (msg.type === "bc:getCourses") {
      BC.api
        .dashboardCards()
        .then((cards) =>
          sendResponse({
            ok: true,
            courses: cards.map((c) => ({
              id: String(c.id),
              name: c.shortName || c.originalName || c.courseCode || ("Course " + c.id),
              code: c.courseCode || "",
              color: c.color || "",
            })),
          })
        )
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true; // async
    }
    if (msg.type === "bc:gpaData") {
      BC.api
        .coursesWithScores()
        .then((courses) =>
          sendResponse({
            ok: true,
            courses: courses.map((c) => {
              const enr = (c.enrollments || [])[0] || {};
              const score =
                enr.computed_current_score != null
                  ? enr.computed_current_score
                  : enr.computed_final_score;
              return {
                id: String(c.id),
                name: c.name || c.course_code || ("Course " + c.id),
                score: score == null ? null : Number(score),
                concluded:
                  c.concluded === true ||
                  enr.enrollment_state === "completed",
              };
            }),
          })
        )
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true; // async
    }
  });

  function start(settings) {
    BC.applyAll(settings);
    BC.observer.start(requestApply);
    BC.storage.subscribe(() => requestApply());
    // Re-evaluate scheduled dark mode each minute.
    setInterval(() => {
      if (BC.storage.current && BC.storage.current.theming.darkMode === "scheduled")
        requestApply();
    }, 60 * 1000);
  }

  function boot() {
    BC.storage.load().then((settings) => {
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
