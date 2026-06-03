/*
 * Better Canvas — Canvas detection & page context.
 * The content script may be injected on any domain the user enabled, so we
 * confirm this is really a Canvas instance via DOM markers before doing work.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  let cachedIsCanvas = null;

  const detect = (BC.detect = {
    // True when the current page is a Canvas instance. Cached once positive.
    isCanvas() {
      if (cachedIsCanvas) return true;
      const hit =
        !!document.querySelector('meta[name="csrf-param"]') ||
        !!document.querySelector('link[href*="brandable_css"]') ||
        !!document.querySelector('link[href*="instructure"]') ||
        (() => {
          const app = document.getElementById("application");
          return app && /\bic-app\b/.test(app.className);
        })() ||
        !!document.querySelector(
          "header.ic-app-header, #header.ic-app-header, .ic-app-header__main-navigation"
        );
      if (hit) cachedIsCanvas = true;
      return !!hit;
    },

    // Identify which kind of Canvas page we're on (used to scope features).
    context() {
      const path = location.pathname;
      const courseId = BC.util.courseIdFromHref(path);
      let page = "other";
      if (
        path === "/" ||
        path === "/dashboard" ||
        path.startsWith("/dashboard") ||
        (document.body && /\bdashboard\b/.test(document.body.className)) ||
        document.getElementById("DashboardCard_Container")
      ) {
        page = "dashboard";
      }
      if (courseId) {
        page = /\/courses\/\d+\/grades/.test(path) ? "grades" : "course";
      }
      return { page, courseId };
    },
  });
})();
