/*
 * Better Canvas — in-page settings panel.
 * Adds a "Better Canvas" item to the left global nav that opens a panel docked on
 * the right, hosting the shared settings UI inside a Shadow DOM so Canvas styles
 * never leak in. The panel is deliberately NOT modal: no dimming scrim, clicking
 * the page doesn't close it, and on wide windows Canvas is scaled down beside it so
 * the whole page stays visible — the page IS the live preview of every change.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const DRAWER_ID = "bc-drawer";
  const DEFAULT_W = 720, MIN_W = 520, MAX_W = 1040;
  const SCALE_MIN_VIEWPORT = 1100;  // below this, overlay instead of scaling Canvas
  const MAX_SHARE = 0.42;           // the panel never takes more than this of the window

  // Motion. Opening decelerates hard (ease-out-quint): quick off the mark, long soft
  // landing. A short blur rides the fast part of the slide and clears before it
  // settles, which reads as motion blur rather than as a blur.
  const OPEN_MS = 480, CLOSE_MS = 280, PAGE_CLOSE_MS = 420;
  const EASE_OUT = "cubic-bezier(.22, 1, .36, 1)";
  const EASE_IN = "cubic-bezier(.5, 0, .75, 0)";

  let drawerHost = null;
  let shadow = null;
  let store = null;
  let isOpen = false;
  let returnFocus = null;

  function makeAdapter() {
    return {
      getState() { return BC.storage.current || BC.cloneDefaults(); },
      save(s) { return BC.storage.save(s); },
      // Same JS realm as applyAll, so a change can be reflected on the page in the
      // same frame rather than after the save debounce plus a storage round-trip.
      preview(s) { BC.storage.adopt(s); if (BC.applyNow) BC.applyNow(); },
      subscribe(cb) { return BC.storage.subscribe(cb); },
      // Export/import must round-trip bcLocal too, since planner metadata lives
      // there rather than inside settings.
      getLocal() { return BC.storage.loadLocal().then(() => BC.storage.local); },
      saveLocal(obj) { return BC.storage.saveLocal(obj); },
      openOptions() { try { chrome.runtime.sendMessage({ type: "bc:openOptions" }, () => void chrome.runtime.lastError); } catch (_) {} },
      getCourses: () => BC.api.dashboardCards().then((cards) => cards.map((c) => ({ id: String(c.id), name: c.shortName || c.originalName || c.courseCode || ("Course " + c.id), code: c.courseCode || "", color: c.color || "" }))),
      getGpaData: () => BC.api.coursesWithScores().then((courses) => courses.map((c) => {
        const enr = (c.enrollments || [])[0] || {};
        const score = enr.computed_current_score != null ? enr.computed_current_score : enr.computed_final_score;
        return { id: String(c.id), name: c.name || c.course_code || ("Course " + c.id), score: score == null ? null : Number(score), concluded: c.concluded === true || enr.enrollment_state === "completed" };
      })),
    };
  }

  function savedWidth() {
    const ui = (BC.storage.local && BC.storage.local.ui) || {};
    return Number(ui.drawerWidth) || DEFAULT_W;
  }
  function clampWidth(w) {
    // Always leave a usable strip of Canvas visible.
    const max = Math.max(MIN_W, Math.min(MAX_W, window.innerWidth - 320, window.innerWidth * MAX_SHARE));
    return Math.round(Math.max(MIN_W, Math.min(max, w)));
  }
  const reduced = () => !!(BC.ui && BC.ui.motion && BC.ui.motion.reduced());

  // ---- Canvas, scaled beside the panel ------------------------------------------
  // The panel used to push Canvas narrower (html margin-right), so the page
  // re-flowed — five card columns became two — and the push animated as a full
  // re-layout on every frame, which is what made opening feel stiff. Now Canvas
  // keeps its own full-width layout and is scaled to fit: `zoom` on <body>, with the
  // body pinned to the width it had. Our floating UI hangs off <html>, outside the
  // scaled tree. Zoom costs one layout (~50ms on a busy dashboard), so it is applied
  // once and the motion is a FLIP: transforms that start from the old geometry and
  // settle on the new, which the compositor animates without touching layout.
  let scaled = null;   // { S, W, w } while Canvas is scaled

  function pageParts() {
    const app = document.getElementById("application");
    const kids = [...(app || document.body).children];
    return kids.filter((n) => !n.hasAttribute("data-bc-node") && n.getClientRects().length);
  }
  const rectsOf = (parts) => parts.map((n) => n.getBoundingClientRect());

  // Origins (and the drag preview) go in a stylesheet, never on Canvas's elements:
  // a style-attribute write is a DOM mutation, and the dark mode engine re-scans
  // whatever changed — the whole page, mid-animation. Origins can't go in the
  // keyframes either: animating transform-origin pins the animation to the main
  // thread, and a page this size can't repaint every frame.
  const PARTS = "#application > :not([data-bc-node])";
  let flips = 0;
  function flipStyle(extra) {
    BC.injector.setStyle("bc-drawer-flip", flips || extra ? PARTS + " { transform-origin: 0 0; will-change: transform; }" + (extra || "") : "");
  }

  // `unit` is the zoom the elements end up under: their transform lengths are in
  // their own (zoomed) CSS pixels, while the rects are in screen pixels.
  function flip(parts, first, unit, duration, easing) {
    const last = rectsOf(parts);
    parts.forEach((n, i) => {
      const a = first[i], b = last[i];
      if (!b.width || !b.height) return;
      const s = a.width / b.width;
      const dx = (a.left - b.left) / unit, dy = (a.top - b.top) / unit;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(s - 1) < 0.002) return;
      flips++;
      flipStyle();
      const anim = n.animate([
        { transform: "translate(" + dx + "px, " + dy + "px) scale(" + s + ")" },
        { transform: "none" },
      ], { duration, easing });
      const tidy = () => { flips = Math.max(0, flips - 1); flipStyle(); };
      anim.onfinish = tidy;
      anim.oncancel = tidy;
    });
  }

  function scaleCss(S, W, w) {
    return `html { overflow-x: hidden !important; scrollbar-width: none !important; }
      html::-webkit-scrollbar { display: none !important; }
      body { zoom: ${S} !important; width: ${W}px !important; min-width: 0 !important; max-width: none !important; }
      .bc-toast-host, [data-bc-node="bc-quick"] { right: ${w + 16}px !important; }
      [data-bc-node="bc-pom-dock"] { right: ${w + 16}px !important; }`;
  }

  // Fit Canvas's normal layout width into what the panel leaves free.
  function fitFor(w) {
    const W = scaled ? scaled.W : document.documentElement.clientWidth;
    return { W, S: Math.max(0.35, (window.innerWidth - w) / W) };
  }

  function scaleIn(w, animate) {
    if (window.innerWidth < SCALE_MIN_VIEWPORT) { BC.injector.setStyle("bc-drawer-push", ""); return; }
    const { W, S } = fitFor(w);
    const parts = animate ? pageParts() : [];
    const first = rectsOf(parts);
    const y = window.scrollY, was = scaled ? scaled.S : 1;
    scaled = { S, W, w };
    BC.injector.setStyle("bc-drawer-push", scaleCss(S, W, w));
    // Keep whatever was at the top of the window at the top.
    window.scrollTo(window.scrollX, y * (S / was));
    if (animate && !reduced()) flip(parts, first, S, OPEN_MS, EASE_OUT);
  }

  function scaleOut(animate) {
    if (!scaled) { BC.injector.setStyle("bc-drawer-push", ""); return; }
    const S = scaled.S;
    const parts = animate ? pageParts() : [];
    const first = rectsOf(parts);
    const y = window.scrollY;
    scaled = null;
    BC.injector.setStyle("bc-drawer-push", "");
    window.scrollTo(window.scrollX, y / S);
    if (animate && !reduced()) flip(parts, first, 1, PAGE_CLOSE_MS, EASE_OUT);
  }

  // While dragging the resize handle, re-zooming on every pointer move would be a
  // full layout per event; preview with a transform and commit the zoom on release.
  function previewScale(w) {
    if (!scaled) return;
    const k = fitFor(w).S / scaled.S;
    flipStyle(Math.abs(k - 1) < 0.002 ? "" : PARTS + " { transform: scale(" + k + ") !important; }");
  }
  function clearPreview() { flipStyle(""); }

  function installNavItem() {
    const menu = document.querySelector("#menu");
    if (!menu) return;
    if (document.getElementById("bc-open-settings")) return;
    const li = document.createElement("li");
    li.className = "ic-app-header__menu-list-item";
    li.setAttribute("data-bc-node", "bc-nav-open");
    const a = document.createElement("a");
    a.id = "bc-open-settings";
    a.href = "#";
    a.className = "ic-app-header__menu-list-link";
    a.setAttribute("role", "button");
    a.setAttribute("aria-expanded", "false");
    a.setAttribute("aria-controls", DRAWER_ID);
    // <a role="button"> activates on Enter but not Space.
    a.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); toggle(); }
    });
    a.innerHTML = `<div class="menu-item-icon-container" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="3" y="3" width="20" height="20" rx="6" stroke="currentColor" stroke-width="1.75"/>
        <path d="M9 9.5h4.2a2.1 2.1 0 0 1 0 4.2H9zm0 4.2h4.8a2.2 2.2 0 0 1 0 4.3H9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      </svg></div>
      <div class="menu-item__text">Better Canvas</div>`;
    a.addEventListener("click", (e) => { e.preventDefault(); toggle(); });
    // Building the panel on hover means the click only has to animate it.
    const warm = () => { if (!drawerHost || !drawerHost.isConnected) BC.util.guard(ensureDrawer, "drawer warm-up"); };
    a.addEventListener("pointerenter", warm, { once: true });
    a.addEventListener("focus", warm, { once: true });
    li.appendChild(a);
    menu.appendChild(li);
  }

  function applyWidth(w) {
    if (!drawerHost) return;
    drawerHost.style.width = w + "px";
  }

  function ensureDrawer() {
    if (drawerHost && drawerHost.isConnected) return drawerHost;
    drawerHost = document.createElement("div");
    drawerHost.id = DRAWER_ID;
    drawerHost.setAttribute("data-bc-node", DRAWER_ID);
    // visibility:hidden while closed is load-bearing: otherwise the host stays
    // pointer-events-active across the right edge of every page.
    drawerHost.style.cssText =
      "position:fixed; top:0; right:0; bottom:0; width:" + clampWidth(savedWidth()) + "px;" +
      "z-index:var(--bc-z-drawer, 2147482000); transform: translateX(100%); visibility: hidden;";
    // On <html>, not <body>: the body is what gets scaled while the panel is open.
    document.documentElement.appendChild(drawerHost);
    shadow = drawerHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .frame {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        border-left: 1px solid var(--bc-border, #e4e4e7);
        box-shadow: var(--bc-shadow-4, -12px 0 40px rgba(0,0,0,.1));
        background: var(--bc-surface-1, #fafafa);
      }
      .root { flex: 1; min-height: 0; }
      .resize {
        position: absolute; top: 0; bottom: 0; left: -4px; width: 8px; z-index: 3; cursor: col-resize;
        touch-action: none;
      }
      .resize::after {
        content: ""; position: absolute; top: 50%; left: 3px; width: 2px; height: 40px; margin-top: -20px;
        border-radius: 2px; background: var(--bc-border-strong, #d4d4d8); opacity: 0;
        transition: opacity var(--bc-dur-2, 150ms) ease;
      }
      .resize:hover::after, .resize.dragging::after { opacity: 1; }
    `;
    const frame = document.createElement("div");
    frame.className = "frame";
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-modal", "false");
    frame.setAttribute("aria-label", "Better Canvas settings");
    const root = document.createElement("div");
    root.className = "root";
    const handle = document.createElement("div");
    handle.className = "resize";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", "Resize settings panel");
    handle.title = "Drag to resize";
    frame.append(root, handle);
    shadow.append(style, frame);

    // Drag to resize; the width is remembered (bcLocal, not settings: it's not a
    // preference anyone exports, and a settings write re-applies every feature).
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add("dragging");
      const move = (ev) => {
        const w = clampWidth(window.innerWidth - ev.clientX);
        applyWidth(w);
        previewScale(w);
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.classList.remove("dragging");
        const w = parseInt(drawerHost.style.width, 10) || DEFAULT_W;
        clearPreview();
        if (isOpen) scaleIn(w, false);
        BC.storage.updateLocal((d) => { (d.ui = d.ui || {}).drawerWidth = w; });
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });

    // Mount unconditionally (a re-created host must re-render, or it stays blank).
    if (store && store.destroy) BC.util.guard(() => store.destroy(), "drawer store");
    store = BC.SettingsUI.render(root, makeAdapter(), { onClose: close, variant: "drawer" });

    // Under an id that is NOT in the registry, so teardown can't strip the
    // handler that closes the panel — the panel survives extension-disable.
    const bag = BC.lifecycle.bag("settingsPanel-persist");
    bag.once("global", () => {
      bag.listen(document, "keydown", (e) => { if (e.key === "Escape" && isOpen) close(); });
      bag.listen(window, "resize", BC.util.debounce(() => {
        if (!isOpen) return;
        const w = clampWidth(savedWidth());
        applyWidth(w);
        // The layout width to keep is the new window's, so start from unscaled.
        if (scaled) { BC.injector.setStyle("bc-drawer-push", ""); scaled = null; }
        scaleIn(w, false);
      }, 160));

    });
    return drawerHost;
  }

  function setExpanded(v) {
    const trigger = document.getElementById("bc-open-settings");
    if (trigger) trigger.setAttribute("aria-expanded", v ? "true" : "false");
  }

  let closing = null;   // the running close animation, if any

  // `tab` jumps straight to a section, e.g. the planner's "More To Do settings".
  function open(tab) {
    ensureDrawer();
    if (typeof tab === "string" && BC.SettingsUI.goto) BC.SettingsUI.goto(tab);
    if (isOpen) return;
    isOpen = true;
    returnFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    if (closing) { closing.cancel(); closing = null; }
    const w = clampWidth(savedWidth());
    applyWidth(w);
    drawerHost.style.visibility = "visible";
    drawerHost.style.transform = "none";
    if (reduced()) scaleIn(w, false);
    else {
      drawerHost.animate([{ transform: "translateX(100%)" }, { transform: "none" }], { duration: OPEN_MS, easing: EASE_OUT });
      drawerHost.animate([{ filter: "blur(8px)" }, { filter: "blur(0px)" }], { duration: Math.round(OPEN_MS * 0.6), easing: "cubic-bezier(.3, 0, .2, 1)" });
      // The page's re-layout at the new zoom is the one expensive step. Doing it a
      // frame later means the panel's slide is already running on the compositor,
      // which keeps it moving while the main thread is busy; the page follows.
      requestAnimationFrame(() => { if (isOpen) scaleIn(w, true); });
    }
    setExpanded(true);
    // Not a focus trap — the page stays usable — but focus moves into the panel.
    const current = shadow.querySelector('.bcs-nav__item[aria-current="page"]') || shadow.querySelector(".bcs-nav__item");
    if (current) setTimeout(() => current.focus({ preventScroll: true }), 50);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (BC.ui && BC.ui.closePopovers) BC.ui.closePopovers();
    if (reduced()) scaleOut(false);
    else requestAnimationFrame(() => { if (!isOpen) scaleOut(true); });
    if (drawerHost) {
      const host = drawerHost;
      const done = () => {
        closing = null;
        if (isOpen) return;
        host.style.transform = "translateX(100%)";
        // Hidden once gone, so the parked panel can't keep eating clicks.
        host.style.visibility = "hidden";
      };
      if (reduced()) done();
      else {
        closing = host.animate([{ transform: "none", filter: "blur(0px)" }, { transform: "translateX(100%)", filter: "blur(6px)" }],
          { duration: CLOSE_MS, easing: EASE_IN, fill: "forwards" });
        closing.onfinish = () => { const a = closing; done(); if (a) a.cancel(); };
      }
    }
    setExpanded(false);
    const back = returnFocus && returnFocus.isConnected ? returnFocus : document.getElementById("bc-open-settings");
    if (back) BC.util.guard(() => back.focus({ preventScroll: true }), "drawer focus");
    returnFocus = null;
  }

  // An explicit flag rather than reading the panel's transform, which is mid-animation
  // half the time.
  function toggle() {
    ensureDrawer();
    isOpen ? close() : open();
  }

  function apply() {
    installNavItem();
    // Always accessible so the user can re-enable if disabled.
  }

  // Empty styles/nodes: the panel must survive extension-disable teardown so the
  // user can always reach the toggle.
  BC.registry.register({ id: "settingsPanel", styles: [], nodes: [], apply, open, close, toggle, isOpen: () => isOpen });
})();
