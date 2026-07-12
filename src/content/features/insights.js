/*
 * Better Canvas — study-time tracker for the Insights tab.
 * While a Canvas tab is visible, counts one minute per minute against the
 * current course (or "other"). Data never leaves this device; the Insights
 * settings tab renders it.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const MAX_DAYS = 60;

  function tick() {
    if (document.visibilityState !== "visible") return;
    const s = BC.storage.current;
    if (!s || !s.enabled || !s.insights || !s.insights.enabled) return;
    const ctx = BC.detect.context();
    const key = ctx.courseId || "other";
    const ymd = BC.dt.ymd(new Date());
    BC.storage.updateLocal((d) => {
      const st = (d.studyTime = d.studyTime || {});
      const day = (st[ymd] = st[ymd] || {});
      day[key] = (day[key] || 0) + 1;
      const days = Object.keys(st).sort();
      while (days.length > MAX_DAYS) delete st[days.shift()];
    });
  }

  function apply(settings) {
    if (!settings.insights || !settings.insights.enabled) return;
    BC.lifecycle.bag("insights").once("tick", () => {
      BC.lifecycle.bag("insights").interval(tick, 60000);
    });
  }

  BC.registry.register({ id: "insights", styles: [], nodes: [], apply });
})();
