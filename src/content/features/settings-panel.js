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
  let store = null;
  let isOpen = false;
  let trap = null;

  function makeAdapter() {
    return {
      getState() { return BC.storage.current || BC.cloneDefaults(); },
      save(s) { return BC.storage.save(s); },
      // Same JS realm as applyAll, so a change can be reflected on the page in the
      // same frame rather than after the save debounce plus a storage round-trip.
      preview(s) { BC.storage.adopt(s); if (BC.applyNow) BC.applyNow(); },
      subscribe(cb) { return BC.storage.subscribe(cb); },
      // Export/import must round-trip bcLocal too, since planner metadata lives
      // there now rather than inside settings.
      getLocal() { return BC.storage.loadLocal().then(() => BC.storage.local); },
      saveLocal(obj) { return BC.storage.saveLocal(obj); },
      getCourses: () => BC.api.dashboardCards().then((cards) => cards.map((c) => ({ id: String(c.id), name: c.shortName || c.originalName || c.courseCode || ("Course " + c.id), code: c.courseCode || "", color: c.color || "" }))),
      getGpaData: () => BC.api.coursesWithScores().then((courses) => courses.map((c) => {
        const enr = (c.enrollments || [])[0] || {};
        const score = enr.computed_current_score != null ? enr.computed_current_score : enr.computed_final_score;
        return { id: String(c.id), name: c.name || c.course_code || ("Course " + c.id), score: score == null ? null : Number(score), concluded: c.concluded === true || enr.enrollment_state === "completed" };
      })),
    };
  }

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
    a.setAttribute("aria-expanded", "false");
    // <a role="button"> activates on Enter but not Space. Adding the handler keeps
    // Canvas's nav styling (which targets the class, not the tag) exactly as-is
    // while giving the trigger full button semantics.
    a.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); open(); }
    });
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
    // visibility:hidden while closed is load-bearing: previously close() only reset
    // the transform, so the host stayed pointer-events-active across the right edge
    // of every Canvas page and silently swallowed clicks there.
    drawerHost.style.cssText =
      "position:fixed; top:0; right:0; bottom:0; width:min(720px, 96vw);" +
      "z-index:var(--bc-z-drawer, 2147482000); transform: translateX(100%); visibility: hidden;" +
      "box-shadow: var(--bc-shadow-4, -20px 0 60px rgba(0,0,0,.18));";
    document.body.appendChild(drawerHost);
    shadow = drawerHost.attachShadow({ mode: "open" });

    // No hardcoded surface and no prefers-color-scheme block: `all: initial` does
    // not block custom-property inheritance, so the shadow tree already sees every
    // --bc-* from :root and tracks the user's theme for free.
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .root { height: 100%; overflow: auto; background: var(--bc-surface-1, #f6f7fb); }
      .bc-drawer-close {
        position: absolute; top: 10px; right: 12px; z-index: 2;
        width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
        border: 1px solid var(--bc-border, #e5e7eb); border-radius: var(--bc-radius-md, 8px);
        background: var(--bc-surface-2, #fff); color: var(--bc-text, #1b2430);
        font: 15px/1 var(--bc-font-sans, sans-serif); cursor: pointer;
      }
      .bc-drawer-close:hover { background: var(--bc-surface-3, #f1f3f7); }
      .bc-drawer-close:focus-visible {
        outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 2px;
      }
    `;
    const root = document.createElement("div");
    root.className = "root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Better Canvas settings");
    shadow.appendChild(style);
    shadow.appendChild(root);

    // Sibling of .root, not a child: SettingsUI.render() clears .root, which would
    // wipe a close button placed inside it. There was no close affordance at all
    // before — Escape and click-outside are undiscoverable.
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "bc-drawer-close";
    closeBtn.setAttribute("aria-label", "Close settings");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", close);
    shadow.appendChild(closeBtn);

    // Mount unconditionally. This used to sit behind a module-level `mounted` flag
    // that was never reset, so once the host had been disconnected a fresh shadow
    // root was built but render() was skipped — leaving a permanently blank white
    // drawer with no recovery short of a page reload.
    if (store && store.destroy) BC.util.guard(() => store.destroy(), "drawer store");
    store = BC.SettingsUI.render(root, makeAdapter());

    // Registered under an id that is NOT in the registry, so teardown's
    // lifecycle.clear(feature.id) loop can't strip the handlers that close the
    // drawer — the drawer deliberately survives extension-disable. Previously
    // these were raw document listeners re-added on every host rebuild and never
    // removed, stacking up handlers pointed at dead hosts.
    const bag = BC.lifecycle.bag("settingsPanel-persist");
    bag.once("global", () => {
      bag.listen(document, "mousedown", (e) => {
        if (!isOpen || !drawerHost) return;
        if (e.target === drawerHost || drawerHost.contains(e.target)) return;
        close();
      });
      bag.listen(document, "keydown", (e) => { if (e.key === "Escape" && isOpen) close(); });
    });
    return drawerHost;
  }

  // A scrim gives the drawer depth and signals that the page behind is inert.
  // Sliding in over an unchanged page was the single biggest thing making this feel
  // unfinished.
  function ensureScrim() {
    let s = document.querySelector('[data-bc-node="bc-drawer-scrim"]');
    if (!s) {
      s = document.createElement("div");
      s.setAttribute("data-bc-node", "bc-drawer-scrim");
      s.style.cssText =
        "position:fixed; inset:0; z-index:calc(var(--bc-z-drawer, 2147482000) - 1);" +
        "background: var(--bc-overlay, rgba(15,20,28,.44)); opacity:0; pointer-events:none;" +
        "transition: opacity var(--bc-dur-3, 220ms) var(--bc-ease-out, ease);";
      s.addEventListener("mousedown", close);
      document.body.appendChild(s);
    }
    return s;
  }

  function setExpanded(v) {
    const trigger = document.getElementById("bc-open-settings");
    if (trigger) trigger.setAttribute("aria-expanded", v ? "true" : "false");
  }

  function open() {
    ensureDrawer();
    if (isOpen) return;
    isOpen = true;
    const scrim = ensureScrim();
    // Asymmetric on purpose: slow-in reads as considered, quick-out as responsive.
    drawerHost.style.transition = "transform var(--bc-dur-4, 300ms) var(--bc-ease-spring, ease), visibility 0s";
    drawerHost.style.visibility = "visible";
    scrim.style.pointerEvents = "auto";
    requestAnimationFrame(() => {
      if (!drawerHost) return;
      drawerHost.style.transform = "translateX(0)";
      scrim.style.opacity = "1";
    });
    setExpanded(true);
    if (BC.ui && BC.ui.focusTrap) trap = BC.ui.focusTrap(shadow, { returnTo: document.getElementById("bc-open-settings") });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (trap) { BC.util.guard(() => trap.release(), "drawer focus"); trap = null; }
    const scrim = document.querySelector('[data-bc-node="bc-drawer-scrim"]');
    if (scrim) { scrim.style.opacity = "0"; scrim.style.pointerEvents = "none"; }
    if (drawerHost) {
      // Delay visibility until the slide-out finishes, so the panel doesn't vanish
      // mid-transition but also can't keep eating clicks once it's gone.
      drawerHost.style.transition =
        "transform var(--bc-dur-3, 220ms) var(--bc-ease-in, ease), visibility 0s linear var(--bc-dur-3, 220ms)";
      drawerHost.style.transform = "translateX(100%)";
      drawerHost.style.visibility = "hidden";
    }
    setExpanded(false);
  }
  // An explicit flag, not a string match on style.transform: open() sets the
  // transform inside requestAnimationFrame, so a toggle() immediately after an
  // open() read the stale value and re-opened instead of closing.
  function toggle() {
    ensureDrawer();
    isOpen ? close() : open();
  }

  function apply(settings, ctx) {
    installNavItem();
    // Always accessible so the user can re-enable if disabled.
  }

  // Empty styles/nodes: the drawer must survive extension-disable teardown
  // so the user can always reach the toggle.
  BC.registry.register({ id: "settingsPanel", styles: [], nodes: [], apply, open, close, toggle });
})();
