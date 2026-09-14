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
      // 600px minus a 210px tab rail left ~330px of body, which is less than the
    // widest control row needs and is what forced labels to wrap five lines deep.
    "position:fixed; top:0; right:0; bottom:0; width:min(720px, 54vw);" +
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

  // ---- Live preview ----
  // The drawer is a shadow root, so a clone mounted inside it would lose every
  // Canvas rule and render as unstyled markup. In the light DOM it inherits the
  // page's own stylesheets, and because our theming is global CSS on :root it
  // also inherits every token change for free: a colour or radius edit repaints
  // the preview with no wiring at all. Only structural features (a To Do mode
  // that rebuilds the list) need the rebuild below.
  const PREVIEW_NODE = "bc-drawer-preview";
  // The stage's padding, in one place, because buildPreview does arithmetic
  // against it rather than measuring it.
  const PREVIEW_PAD = 24;
  let previewHost = null;
  let previewUnsub = null;
  let previewTimer = 0;
  // A multiplier on top of the fit scale, so "100%" means "fills the stage" and
  // the control is about seeing detail rather than about absolute pixels.
  let previewZoom = 1;

  function ensurePreview() {
    if (previewHost && previewHost.isConnected) return previewHost;
    previewHost = document.createElement("div");
    previewHost.setAttribute("data-bc-node", PREVIEW_NODE);
    // Inert and unreadable: it is a picture of the page, not a second copy of it.
    previewHost.setAttribute("aria-hidden", "true");
    previewHost.style.cssText =
      "position:fixed; top:0; bottom:0; left:0; right:min(600px, 48vw);" +
      "z-index:calc(var(--bc-z-drawer, 2147482000) - 1);" +
      "display:flex; flex-direction:column; align-items:center; justify-content:center;" +
      // Deliberately NOT on the spacing scale: buildPreview subtracts this
      // padding numerically to size the stage, so a density multiplier here
      // would leave the preview overflowing its own frame.
      "gap:14px; padding:" + PREVIEW_PAD + "px; background: var(--bc-surface-1, #f6f7fb);" +
      "overflow:hidden;" +
      "pointer-events:auto; opacity:0;" +
      "transition:opacity var(--bc-dur-3, 220ms) var(--bc-ease-out, ease);";
    document.body.appendChild(previewHost);
    return previewHost;
  }

  // The source is the app shell rather than just the content column, so the left
  // nav is in frame and the nav hide/reorder settings are previewable too.
  function previewSource() {
    return document.querySelector("#application") ||
           document.querySelector("#wrapper") ||
           document.querySelector("#content");
  }

  function buildPreview() {
    const host = ensurePreview();
    const src = previewSource();
    if (!src) return;
    const vw = Math.max(320, window.innerWidth);
    const vh = Math.max(240, window.innerHeight);
    const paneW = host.clientWidth - PREVIEW_PAD * 2;
    const paneH = host.clientHeight - PREVIEW_PAD * 2;
    if (paneW <= 0 || paneH <= 0) return;
    // Reserve the toolbar's own height so zooming to fit does not push it off.
    const fit = Math.min(paneW / vw, (paneH - 44) / vh);
    const k = Math.max(0.1, fit * previewZoom);

    const clone = src.cloneNode(true);
    // Our install guards all ask document for an existing [data-bc-node]. A clone
    // carrying those markers would answer for a component that is no longer on
    // the real page, so a feature could skip reinstalling itself. Classes stay,
    // which is what our own styling actually targets.
    clone.querySelectorAll("[data-bc-node]").forEach((n) => n.removeAttribute("data-bc-node"));
    clone.querySelectorAll("script,iframe,object,embed").forEach((n) => n.remove());
    // Every id in a clone is a duplicate id, and document.querySelectorAll("#x ...")
    // then reports the page twice for as long as the drawer is open. The nav is the
    // one place we cannot strip: hiding a nav item is a rule on that item's id, so
    // the menu keeps its ids and the rest of the shell loses them.
    const navScope = clone.querySelector("#menu");
    if (clone.id) clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((n) => {
      if (navScope && (n === navScope || navScope.contains(n))) return;
      n.removeAttribute("id");
    });

    const frame = document.createElement("div");
    frame.style.cssText =
      "width:" + vw + "px; height:" + vh + "px; transform:scale(" + k + ");" +
      "transform-origin: top left; pointer-events:none; user-select:none;";
    frame.appendChild(clone);

    const box = document.createElement("div");
    box.style.cssText =
      "width:" + Math.round(Math.min(vw * k, paneW)) + "px;" +
      "height:" + Math.round(Math.min(vh * k, paneH - 44)) + "px;" +
      "overflow:hidden; border-radius: var(--bc-radius-xl, 12px);" +
      "border:1px solid var(--bc-border-strong, var(--bc-border, #e5e7eb));" +
      "box-shadow: var(--bc-shadow-4, 0 24px 64px rgba(0,0,0,.3));" +
      "background: var(--bc-surface-1, #f6f7fb);";
    box.appendChild(frame);

    host.textContent = "";
    host.appendChild(buildToolbar(fit));
    host.appendChild(box);
  }

  // The stage swallows pointer events so the preview can never be mistaken for
  // the real page; the toolbar is the one part that takes them back.
  function buildToolbar(fit) {
    const bar = document.createElement("div");
    bar.style.cssText =
      "display:inline-flex; align-items:center; gap:2px; pointer-events:auto;" +
      "padding:4px; border-radius: var(--bc-radius-pill, 999px);" +
      "background: var(--bc-surface-2, #fff);" +
      "border:1px solid var(--bc-border-strong, var(--bc-border, #e5e7eb));" +
      "box-shadow: var(--bc-shadow-1, 0 1px 3px rgba(0,0,0,.12));" +
      "font: 12px/1 var(--bc-font-sans, system-ui); color: var(--bc-text, #1b2430);";

    // The two steppers were a MINUS SIGN and an ASCII plus: different widths,
    // different optical weights, and the minus written as an escape so it read
    // as ASCII in the source while rendering as a glyph on screen.
    const step = (icon, aria, delta) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", aria);
      b.title = aria;
      b.innerHTML = BC.icons.svg(icon, { size: 14 });
      b.style.cssText =
        "width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center;" +
        "border:0; border-radius:50%; background:transparent; color:inherit; cursor:pointer;" +
        "font:inherit; line-height:0;";
      b.addEventListener("mouseenter", () => { b.style.background = "var(--bc-surface-4, rgba(0,0,0,.05))"; });
      b.addEventListener("mouseleave", () => { b.style.background = "transparent"; });
      b.addEventListener("click", () => {
        previewZoom = Math.min(3, Math.max(0.4, Math.round((previewZoom + delta) * 20) / 20));
        BC.util.guard(buildPreview, "drawer preview");
      });
      return b;
    };

    const pct = document.createElement("button");
    pct.type = "button";
    pct.setAttribute("aria-label", "Reset preview zoom to fit");
    pct.textContent = Math.round(previewZoom * 100) + "%";
    pct.style.cssText =
      "min-width:52px; height:26px; padding:0 var(--bc-space-3, 8px); border:0; border-radius: var(--bc-radius-pill, 999px);" +
      "background:transparent; color:inherit; cursor:pointer; font:inherit; font-variant-numeric: tabular-nums;";
    pct.addEventListener("click", () => { previewZoom = 1; BC.util.guard(buildPreview, "drawer preview"); });

    bar.addEventListener("mousedown", (e) => e.stopPropagation());
    bar.appendChild(step("minus", "Zoom out", -0.1));
    bar.appendChild(pct);
    bar.appendChild(step("plus", "Zoom in", 0.1));
    return bar;
  }

  function refreshPreview() {
    clearTimeout(previewTimer);
    // Settings can land in bursts while a slider moves; rebuilding the shell on
    // every one of those would be the most expensive thing on the page.
    previewTimer = setTimeout(() => { BC.util.guard(buildPreview, "drawer preview"); }, 200);
  }

  // Off the opening frame entirely: the drawer is what the click asked for, the
  // preview is what it can afford a moment later.
  function schedulePreview() {
    const go = () => { if (isOpen) showPreview(); };
    if (typeof requestIdleCallback === "function") requestIdleCallback(go, { timeout: 200 });
    else setTimeout(go, 0);
  }

  function showPreview() {
    BC.util.guard(buildPreview, "drawer preview");
    if (previewHost) requestAnimationFrame(() => { if (previewHost) previewHost.style.opacity = "1"; });
    if (!previewUnsub && BC.storage && BC.storage.subscribe) {
      previewUnsub = BC.storage.subscribe(refreshPreview);
    }
  }

  function hidePreview() {
    clearTimeout(previewTimer);
    if (previewUnsub) { BC.util.guard(() => previewUnsub(), "drawer preview"); previewUnsub = null; }
    if (previewHost) {
      previewHost.style.opacity = "0";
      // Drop the clone rather than leave a stale copy of the page in the DOM.
      const h = previewHost;
      setTimeout(() => { if (h && !isOpen) h.textContent = ""; }, 240);
    }
  }

  // A fixed overlay does not stop a wheel event: it keeps scrolling the document
  // underneath, so the page drifted behind a preview that could not follow it.
  // Locking the document is the only thing that actually holds it still. The
  // padding compensates for the scrollbar the lock removes, which would
  // otherwise shift the whole page sideways as the drawer opens.
  let scrollLock = null;
  function lockPageScroll() {
    if (scrollLock) return;
    const el = document.documentElement;
    const bd = document.body;
    const bar = window.innerWidth - el.clientWidth;
    // Both, because which element actually scrolls depends on the page: locking
    // only the one Canvas is not using leaves the page free to move.
    scrollLock = { htmlOv: el.style.overflow, bodyOv: bd ? bd.style.overflow : "", padRight: el.style.paddingRight };
    el.style.overflow = "hidden";
    if (bd) bd.style.overflow = "hidden";
    if (bar > 0) el.style.paddingRight = bar + "px";
  }
  function unlockPageScroll() {
    if (!scrollLock) return;
    const el = document.documentElement;
    const bd = document.body;
    el.style.overflow = scrollLock.htmlOv;
    if (bd) bd.style.overflow = scrollLock.bodyOv;
    el.style.paddingRight = scrollLock.padRight;
    scrollLock = null;
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
    lockPageScroll();
    schedulePreview();
    if (BC.ui && BC.ui.focusTrap) trap = BC.ui.focusTrap(shadow, { returnTo: document.getElementById("bc-open-settings") });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (trap) { BC.util.guard(() => trap.release(), "drawer focus"); trap = null; }
    hidePreview();
    unlockPageScroll();
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
