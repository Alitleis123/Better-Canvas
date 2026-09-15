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
  // ONE definition of how much of the window the panel occupies. The drawer was
  // min(720px, 54vw) wide while the preview stage beside it reserved only
  // min(600px, 48vw), so the drawer covered the rightmost ~120px of the stage.
  // The preview box is centred in that stage and sized to fill it, so what got
  // covered was the right-hand edge of the page preview -- at 1440px, 96px of a
  // 792px picture, and the wider the window the more of it went under the panel.
  const DRAWER_W = "min(720px, 54vw)";
  let drawerHost = null;
  let shadow = null;
  let store = null;
  let isOpen = false;

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
        <rect x="4.75" y="4.75" width="16.5" height="16.5" rx="3.25" stroke="currentColor" stroke-width="1.5"/>
        <text x="13" y="17.5" text-anchor="middle" font-size="9.5" font-weight="700"
              font-family="system-ui, -apple-system, sans-serif" fill="currentColor">BC</text>
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
      // 600px minus a 210px tab rail left ~330px of body, which is less than the
    // widest control row needs and is what forced labels to wrap five lines deep.
    "position:fixed; top:0; right:0; bottom:0; width:" + DRAWER_W + ";" +
      "z-index:var(--bc-z-drawer, 2147482000); transform: translateX(100%); visibility: hidden;" +
      "box-shadow: var(--bc-shadow-4, -20px 0 60px rgba(0,0,0,.18));";
    document.body.appendChild(drawerHost);
    shadow = drawerHost.attachShadow({ mode: "open" });

    // No hardcoded surface and no prefers-color-scheme block: `all: initial` does
    // not block custom-property inheritance, so the shadow tree already sees every
    // --bc-* from :root and tracks the user's theme for free.
    const style = document.createElement("style");
    style.textContent = `
      /* Only the drawer floats a close button over its header, so only the drawer
         reserves that corner. The options page hosts the same UI with no close
         button and was leaving 46px of dead air with its overflow menu adrift
         from the cards below. */
      :host { all: initial; --bc-panel-gutter: 46px; }
      * { box-sizing: border-box; }
      .root { height: 100%; overflow: auto; background: var(--bc-surface-1, #f6f7fb); }
      /* Sits on the panel's own header, so it reads as the header's last button
         rather than as a chip floating over it: same 30px box, same muted ink,
         no border until hover. It was a bordered white square on a translucent
         bar, which was the only piece of chrome still in the old style. */
      .bc-drawer-close {
        position: absolute; top: 15px; right: 14px; z-index: 4;
        width: 30px; height: 30px; padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
        border: 1px solid transparent; border-radius: var(--bc-radius-md, 8px);
        background: transparent; color: var(--bc-muted, #6b6155);
        cursor: pointer;
        transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                    color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
      }
      .bc-drawer-close:hover {
        background: var(--bc-surface-3, #eee7dc);
        color: var(--bc-text, #1d1a16);
      }
      .bc-drawer-close:focus-visible {
        outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 2px;
      }
    `;
    const root = document.createElement("div");
    root.className = "root";
    // A dialog, but NOT aria-modal. The drawer docks beside the page instead of
    // covering it: the page stays scrollable, clickable and reachable by
    // keyboard, so claiming modality here would tell a screen reader the rest of
    // the document is inert when it is the very thing being previewed.
    root.setAttribute("role", "dialog");
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
    closeBtn.title = "Close settings";
    closeBtn.innerHTML = BC.icons.svg("close", { size: 16 });
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
      // NO click-outside-to-close. The page beside the drawer is the live
      // preview, so clicking it is the thing you are meant to do; closing the
      // panel every time somebody tried would make the dock useless.
      bag.listen(document, "keydown", (e) => { if (e.key === "Escape" && isOpen) close(); });
    });
    return drawerHost;
  }


  // ---- Live preview: the page itself ----
  //
  // This used to be a scaled, inert CLONE of the page rendered beside the
  // drawer, and it was wrong in three ways at once.
  //
  //  - It stripped [data-bc-node] from the clone, on the reasoning that "classes
  //    stay, which is what our own styling actually targets". That stopped being
  //    true the moment a feature scoped its sheet by node id, which dashgrid
  //    does for every rule it has -- so the preview rendered the real card
  //    markup with none of the card CSS, as a column of bare links.
  //  - It was pointer-events:none, so every control in it was dead. Reasonable
  //    for a photograph; baffling for something that looks like your page.
  //  - It was a photograph. A snapshot rebuilt on a 200ms timer can only ever
  //    approximate what the page would do, and anything driven by a real
  //    re-render -- the To Do list rebuilding its layout, for one -- did not
  //    show up in it at all without reloading the tab.
  //
  // So there is no preview any more. The drawer DOCKS, the real page shrinks to
  // the space beside it, and what you are looking at is the page: correctly
  // styled because it is the one the stylesheets are for, live because applyAll
  // runs on it, and clickable because it is not a picture. It also costs about
  // 120 lines less code than photographing it did.
  const DOCK_STYLE = "bc-drawer-dock";

  function dockPage(on) {
    const root = document.documentElement;
    if (!on) {
      root.removeAttribute("data-bc-dock");
      // The sheet stays: removing it would drop the transition mid-slide and the
      // page would snap back rather than follow the drawer out.
      return;
    }
    BC.injector.setStyle(DOCK_STYLE, `
      /* The transition lives outside the [data-bc-dock] guard so it applies on
         the way out as well as the way in. */
      body { transition: margin-right var(--bc-dur-4, 300ms) var(--bc-ease-spring, ease); }
      :root[data-bc-dock] body { margin-right: ${DRAWER_W}; }
      /* Canvas pins a few things to the right edge of the VIEWPORT rather than
         to the content column, and a viewport-fixed element does not know the
         page got narrower -- it would sit under the drawer. */
      :root[data-bc-dock] #right-side-wrapper,
      :root[data-bc-dock] .ic-app-course-nav-toggle { max-width: 100%; }
      @media (prefers-reduced-motion: reduce) { body { transition: none; } }
    `);
    root.setAttribute("data-bc-dock", "");
  }

  function setExpanded(v) {
    const trigger = document.getElementById("bc-open-settings");
    if (trigger) trigger.setAttribute("aria-expanded", v ? "true" : "false");
  }

  function open() {
    ensureDrawer();
    if (isOpen) return;
    isOpen = true;
    // Asymmetric on purpose: slow-in reads as considered, quick-out as responsive.
    drawerHost.style.transition = "transform var(--bc-dur-4, 300ms) var(--bc-ease-spring, ease), visibility 0s";
    drawerHost.style.visibility = "visible";
    requestAnimationFrame(() => {
      if (!drawerHost) return;
      drawerHost.style.transform = "translateX(0)";
    });
    setExpanded(true);
    dockPage(true);
    // Focus is AIMED, not trapped. A trap is correct for a modal and wrong for a
    // dock: it would make the page beside the drawer unreachable by keyboard,
    // which is the same mistake pointer-events:none made for the mouse.
    // The search field is both visible and the most useful place to land -- the
    // first tabbable in DOM order is the master switch's visually hidden
    // checkbox, a 1x1 box, so landing there puts the ring somewhere invisible.
    const first = shadow.querySelector(".bc-search");
    if (first) BC.util.guard(() => first.focus({ preventScroll: true }), "drawer focus");
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    dockPage(false);
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

  // The first click used to pay for the whole settings form being built. Build it
  // while the page is idle instead, so the panel is already there when asked for.
  function prewarm() {
    const go = () => { if (!drawerHost) BC.util.guard(ensureDrawer, "drawer prewarm"); };
    if (typeof requestIdleCallback === "function") requestIdleCallback(go, { timeout: 3000 });
    else setTimeout(go, 1200);
  }

  function apply(settings, ctx) {
    installNavItem();
    prewarm();
    // Always accessible so the user can re-enable if disabled.
  }

  // Empty styles/nodes: the drawer must survive extension-disable teardown
  // so the user can always reach the toggle.
  BC.registry.register({ id: "settingsPanel", styles: [], nodes: [], apply, open, close, toggle });
})();
