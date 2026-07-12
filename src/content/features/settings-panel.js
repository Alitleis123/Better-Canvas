/*
 * Better Canvas — in-page settings drawer.
 * Adds a "Better Canvas" item to the left global nav that opens a right-side
 * drawer hosting the shared settings UI, isolated in a Shadow DOM so Canvas
 * styles never leak in.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const DRAWER_ID = "bc-drawer";
  let drawerHost = null;
  let shadow = null;
  let mounted = false;

  function installNavItem() {
    const menu = document.querySelector("#menu");
    if (!menu) return;
    if (document.getElementById("bc-open-settings")) return;
    const li = document.createElement("li");
    li.setAttribute("data-bc-node", "bc-nav-open");
    const a = document.createElement("a");
    a.id = "bc-open-settings";
    a.href = "#";
    a.className = "ic-app-header__menu-list-link";
    a.setAttribute("role", "button");
    a.innerHTML = `<div class="menu-item-icon-container" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="4" y="4" width="18" height="18" rx="3" fill="currentColor" opacity="0.85"/>
        <text x="13" y="17" text-anchor="middle" font-size="10" fill="white" font-weight="800">BC</text>
      </svg></div>
      <div class="menu-item__text">Better Canvas</div>`;
    a.addEventListener("click", (e) => { e.preventDefault(); open(); });
    li.appendChild(a);
    menu.appendChild(li);
  }

  function ensureDrawer() {
    if (drawerHost && drawerHost.isConnected) return drawerHost;
    drawerHost = document.createElement("div");
    drawerHost.setAttribute("data-bc-node", DRAWER_ID);
    drawerHost.style.cssText = "position:fixed; top:0; right:0; bottom:0; width:min(720px, 96vw); z-index:2147482500; transform: translateX(100%); transition: transform .22s cubic-bezier(.22,.61,.36,1); box-shadow: -20px 0 60px rgba(0,0,0,.18);";
    document.body.appendChild(drawerHost);
    shadow = drawerHost.attachShadow({ mode: "open" });

    // In shadow: mount the shared settings UI.
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .root { height: 100%; overflow: auto; background: #f6f7fb; }
      @media (prefers-color-scheme: dark) { .root { background: #121319; } }
    `;
    const root = document.createElement("div");
    root.className = "root";
    shadow.appendChild(style);
    shadow.appendChild(root);

    if (!mounted) {
      const adapter = {
        getState() { return BC.storage.current || BC.cloneDefaults(); },
        save(s) { return BC.storage.save(s); },
        subscribe(cb) { return BC.storage.subscribe(cb); },
        getCourses: () => BC.api.dashboardCards().then((cards) => cards.map((c) => ({ id: String(c.id), name: c.shortName || c.originalName || c.courseCode || ("Course " + c.id), code: c.courseCode || "", color: c.color || "" }))),
        getGpaData: () => BC.api.coursesWithScores().then((courses) => courses.map((c) => {
          const enr = (c.enrollments || [])[0] || {};
          const score = enr.computed_current_score != null ? enr.computed_current_score : enr.computed_final_score;
          return { id: String(c.id), name: c.name || c.course_code || ("Course " + c.id), score: score == null ? null : Number(score), concluded: c.concluded === true || enr.enrollment_state === "completed" };
        })),
      };
      BC.SettingsUI.render(root, adapter);
      mounted = true;
    }

    // Click-outside close
    document.addEventListener("mousedown", (e) => {
      if (!drawerHost || drawerHost.style.transform === "translateX(100%)") return;
      if (drawerHost.contains(e.target)) return;
      close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawerHost && drawerHost.style.transform !== "translateX(100%)") close();
    });
    return drawerHost;
  }

  function open() {
    ensureDrawer();
    requestAnimationFrame(() => { drawerHost.style.transform = "translateX(0)"; });
  }
  function close() {
    if (drawerHost) drawerHost.style.transform = "translateX(100%)";
  }
  function toggle() {
    ensureDrawer();
    if (drawerHost.style.transform === "translateX(0px)" || drawerHost.style.transform === "translateX(0)") close();
    else open();
  }

  function apply(settings, ctx) {
    installNavItem();
    // Always accessible so the user can re-enable if disabled.
  }

  // Empty styles/nodes: the drawer must survive extension-disable teardown
  // so the user can always reach the toggle.
  BC.registry.register({ id: "settingsPanel", styles: [], nodes: [], apply, open, close, toggle });
})();
