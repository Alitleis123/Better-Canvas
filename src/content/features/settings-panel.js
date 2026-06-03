/*
 * Better Canvas — in-page settings surface.
 * Adds a native-looking "Better Canvas" item to Canvas's global left nav and
 * opens a Shadow-DOM right-slide drawer that hosts the shared settings UI.
 * Shadow DOM isolates the drawer from Canvas's CSS (and vice-versa), so nothing
 * clashes or overlaps. The nav item is re-added by the observer if Canvas drops
 * it; the drawer host persists across re-renders so open state is never lost.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};
  const U = BC.util;

  const NAV_ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
    '<rect x="3" y="3" width="8" height="8" rx="2"/>' +
    '<rect x="13" y="3" width="8" height="8" rx="2"/>' +
    '<rect x="3" y="13" width="8" height="8" rx="2"/>' +
    '<rect x="13" y="13" width="8" height="8" rx="2"/></svg>';

  const DRAWER_CSS = `
:host { all: initial; }
.bc-scrim {
  position: fixed; inset: 0; z-index: 2147483646;
  background: rgba(15, 16, 28, 0); backdrop-filter: blur(0px);
  opacity: 0; pointer-events: none;
  transition: opacity 0.28s ease, backdrop-filter 0.28s ease;
}
.bc-scrim.bc-open { background: rgba(15, 16, 28, 0.42); backdrop-filter: blur(2px);
  opacity: 1; pointer-events: auto; }
.bc-drawer {
  position: fixed; top: 0; right: 0; z-index: 2147483647;
  width: 460px; max-width: 94vw; height: 100vh;
  background: #f6f6fb;
  box-shadow: -18px 0 50px -18px rgba(15, 16, 28, 0.5);
  transform: translateX(102%);
  transition: transform 0.30s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex; flex-direction: column;
  will-change: transform;
}
.bc-drawer.bc-open { transform: translateX(0); }
.bc-drawer-mount { flex: 1 1 auto; min-height: 0; display: flex; }
.bc-drawer-mount > .bc-ui { flex: 1 1 auto; }
/* Reserve space at the top-right of the shared top bar so the close button
   never overlaps the Enabled toggle. Drawer-only — the options page has no X. */
.bc-drawer .bc-topbar-main { padding-right: 40px; }
.bc-close {
  position: absolute; top: 16px; right: 14px; z-index: 5;
  width: 30px; height: 30px; border: none; border-radius: 8px; cursor: pointer;
  background: rgba(125, 125, 150, 0.16); color: #6b6b82;
  font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center;
  transition: background 0.14s, color 0.14s;
}
.bc-close:hover { background: rgba(125, 125, 150, 0.28); color: #3a3a4c; }
`;

  let host = null; // shadow host on document.body
  let scrim = null;
  let drawer = null;
  let ui = null; // { refresh } from BC.SettingsUI
  let isOpen = false;
  let mounted = false;

  // ---- adapter backed by live storage + same-origin Canvas API -----------
  const contentAdapter = {
    getState() { return BC.storage.current || BC.cloneDefaults(); },
    save(s) { return BC.storage.save(s); },
    subscribe(cb) { return BC.storage.subscribe(cb); },
    getCourses() {
      return BC.api.dashboardCards().then((cards) =>
        cards.map((c) => ({
          id: String(c.id),
          name: c.shortName || c.originalName || c.courseCode || ("Course " + c.id),
          code: c.courseCode || "",
          color: c.color || "",
        }))
      );
    },
    getGpaData() {
      return BC.api.coursesWithScores().then((courses) =>
        courses.map((c) => {
          const enr = (c.enrollments || [])[0] || {};
          const score = enr.computed_current_score != null ? enr.computed_current_score : enr.computed_final_score;
          return {
            id: String(c.id),
            name: c.name || c.course_code || ("Course " + c.id),
            score: score == null ? null : Number(score),
            concluded: c.concluded === true || enr.enrollment_state === "completed",
          };
        })
      );
    },
  };

  function onKeydown(e) {
    if (e.key === "Escape" && isOpen) { e.stopPropagation(); close(); }
  }

  function ensureDrawer() {
    if (mounted && host && host.isConnected) return;
    host = document.createElement("div");
    host.setAttribute("data-bc-node", "bc-settings-drawer");
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = DRAWER_CSS;

    scrim = document.createElement("div");
    scrim.className = "bc-scrim";
    scrim.addEventListener("click", close);

    const mount = document.createElement("div");
    mount.className = "bc-drawer-mount";

    const closeBtn = document.createElement("button");
    closeBtn.className = "bc-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close settings");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", close);

    drawer = document.createElement("div");
    drawer.className = "bc-drawer";
    drawer.append(closeBtn, mount);

    shadow.append(style, scrim, drawer);
    document.body.appendChild(host);

    ui = BC.SettingsUI.render(mount, contentAdapter);
    mounted = true;
  }

  function open() {
    ensureDrawer();
    if (ui && ui.refresh) U.guard(ui.refresh, "drawer refresh");
    // Force a reflow so the transform transition runs from the closed state.
    void drawer.offsetWidth;
    scrim.classList.add("bc-open");
    drawer.classList.add("bc-open");
    isOpen = true;
    document.addEventListener("keydown", onKeydown, true);
  }

  function close() {
    if (!mounted) return;
    scrim.classList.remove("bc-open");
    drawer.classList.remove("bc-open");
    isOpen = false;
    document.removeEventListener("keydown", onKeydown, true);
  }

  function toggle() { (isOpen ? close : open)(); }

  // ---- native-looking left-nav trigger -----------------------------------
  function ensureNavTrigger() {
    const list = document.querySelector("#menu, .ic-app-header__menu-list");
    if (!list) return;
    if (list.querySelector(":scope > li[data-bc-nav-trigger]")) return;

    const icon = U.el("div", { class: "menu-item-icon-container", "aria-hidden": "true" });
    icon.innerHTML = NAV_ICON;
    const link = U.el(
      "a",
      { class: "ic-app-header__menu-list-link", role: "button", href: "#", tabindex: "0" },
      [icon, U.el("div", { class: "menu-item__text", text: "Better Canvas" })]
    );
    link.addEventListener("click", (e) => { e.preventDefault(); toggle(); });

    const li = U.el(
      "li",
      { class: "menu-item ic-app-header__menu-list-item", dataset: { bcNavTrigger: "1" } },
      [link]
    );
    list.appendChild(li);
  }

  BC.features.settingsPanel = {
    id: "settingsPanel",
    open,
    close,
    toggle,
    apply() { U.guard(ensureNavTrigger, "nav trigger"); },
  };
})();
