/* Better Canvas — global + course navigation editing, breadcrumbs, quick-search, course tabs. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  // Rebuilding a list of DOM nodes several times a second is pure waste, and it
  // fights the user: any focus or text selection inside a custom link was
  // destroyed on the next tick. Keyed on the links' content so the rebuild only
  // happens when the links actually change.
  function syncCustomLinks(nodeId, anchorList, links, style) {
    const sig = JSON.stringify(links || []);
    let list = document.getElementById(nodeId);
    if (list && list.dataset.bcSig === sig) return;
    if (list) list.remove();
    if (!(links || []).length) return;
    list = document.createElement("ul");
    list.id = nodeId;
    list.setAttribute("data-bc-node", nodeId);
    list.dataset.bcSig = sig;
    list.style.listStyle = "none"; list.style.padding = "0"; list.style.margin = "8px 0 0";
    for (const l of links) {
      if (!BC.util.isSafeHttpUrl(l.url)) continue;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = l.url; a.textContent = l.label || l.url;
      if (l.newTab) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      a.style.cssText = style;
      li.appendChild(a);
      list.appendChild(li);
    }
    anchorList.parentNode.insertBefore(list, anchorList.nextSibling);
  }

  function applyGlobalNav(nav) {
    const list = document.querySelector("#menu");
    if (!list) return;
    const hidden = new Set(nav.hidden || []);
    let css = "";
    for (const k of hidden) css += `#${BC.util.cssSafe(k)} { display: none !important; }\n`;
    BC.injector.setStyle("bc-nav-global-hidden", css);

    // Reorder using flexbox order
    const orderMap = new Map();
    (nav.order || []).forEach((k, i) => orderMap.set(k, i));
    const items = list.querySelectorAll(":scope > li");
    for (const li of items) {
      const a = li.querySelector("a");
      const id = a && a.id;
      if (id && orderMap.has(id)) { li.style.order = String(orderMap.get(id)); li.style.display = ""; }
    }
    list.style.display = "flex"; list.style.flexDirection = "column";

    syncCustomLinks("bc-nav-custom", list, nav.customLinks,
      "display:flex; align-items:center; gap:var(--bc-space-3, 8px); padding:var(--bc-space-3, 8px) var(--bc-space-4, 10px); color:inherit; text-decoration:none;");
  }

  function applyCourseNav(nav) {
    const list = document.querySelector("#section-tabs");
    if (!list) return;
    const hiddenSet = new Set((nav.hidden || []).map((s) => s.toLowerCase()));
    const orderIdx = new Map(); (nav.order || []).forEach((s, i) => orderIdx.set(String(s).toLowerCase(), i));
    const lis = list.querySelectorAll(":scope > li");
    for (const li of lis) {
      const label = (li.textContent || "").trim().toLowerCase();
      li.style.display = hiddenSet.has(label) ? "none" : "";
      if (orderIdx.has(label)) { li.style.order = String(orderIdx.get(label)); }
    }
    list.style.display = "flex"; list.style.flexDirection = "column";

    syncCustomLinks("bc-course-custom", list, nav.customLinks,
      "display:block; padding:var(--bc-space-2, 6px) var(--bc-space-4, 10px); color:inherit; text-decoration:none; border-radius:var(--bc-radius-md, 6px);");
  }

  function applyBreadcrumbs(mode) {
    let css = "";
    if (mode === "hidden") css = ".ic-app-crumbs { display: none !important; }";
    else if (mode === "compact") css = ".ic-app-crumbs { font-size: var(--bc-text-xs, 12px) !important; padding: var(--bc-space-1, 4px) var(--bc-space-3, 8px) !important; }";
    BC.injector.setStyle("bc-breadcrumbs", css);
  }

  // Hoisted: this multi-line template was rebuilt on every apply() only for
  // setStyle to compare it against an identical string and discard it.
  const COURSE_TABS_CSS = `
      .bc-course-tabs {
        display: flex; gap: var(--bc-space-2, 6px); overflow-x: auto;
        padding: var(--bc-space-2, 6px) var(--bc-space-4, 10px); background: transparent;
        border-bottom: 1px solid var(--bc-border, #e5e7eb);
      }
      .bc-ct-tab {
        display:inline-block; padding: 4px var(--bc-space-4, 10px);
        border-radius: var(--bc-radius-pill, 999px);
        background: var(--bc-surface-4, rgba(0,0,0,.05)); color: inherit; text-decoration:none;
        border-left: 4px solid var(--tint, #0374b5);
        font-size: var(--bc-text-xs, 12px); white-space: nowrap;
      }
      .bc-ct-tab.active { background: var(--tint); color: var(--tint-fg, var(--bc-accent-contrast, #fff)); }
      .bc-ct-tab:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 2px; }
    `;

  function applyCourseTabs(settings) {
    const enabled = settings.navigation && settings.navigation.courseTabs;
    if (!enabled) {
      BC.injector.setStyle("bc-course-tabs", "");
      BC.injector.removeNode("bc-course-tabs");
      return;
    }
    // Render pinned quick-switch bar at the top of the content area on course pages.
    const cards = (BC.cache && BC.cache.peek("GET " + location.origin + "/api/v1/dashboard/dashboard_cards")) || null;
    if (!cards) return; // will populate after dashboard cards load
    const target = document.querySelector("#main");
    if (!target) return;
    BC.injector.setStyle("bc-course-tabs", COURSE_TABS_CSS);
    const bar = BC.injector.ensureNode("bc-course-tabs", target, () => {
      const el = document.createElement("div");
      el.className = "bc-course-tabs";
      target.prepend(el);
      return el;
    });
    const pinned = new Set((settings.dashboard.pinned || []).map(String));
    const items = cards.filter((c) => pinned.has(String(c.id)) || pinned.size === 0).slice(0, 12);
    const cur = BC.util.courseIdFromHref(location.pathname);
    // Guarded: this tore down and rebuilt every tab several times a second, which
    // also cancelled any in-flight hover or focus on a tab.
    const sig = cur + "|" + items.map((c) => c.id + ":" + (c.color || "") + ":" + (c.shortName || c.originalName || "")).join(",");
    if (bar.dataset.bcSig === sig) return;
    bar.dataset.bcSig = sig;
    bar.innerHTML = "";
    for (const c of items) {
      const a = document.createElement("a");
      a.className = "bc-ct-tab" + (String(c.id) === cur ? " active" : "");
      a.href = "/courses/" + c.id;
      a.title = c.shortName || c.originalName;
      a.textContent = c.shortName || c.originalName || ("Course " + c.id);
      const tint = c.color || "#0374b5";
      a.style.setProperty("--tint", tint);
      // Course colours are arbitrary and user-chosen, so the label colour has to be
      // computed per course. Forcing white made light course colours unreadable.
      a.style.setProperty("--tint-fg", BC.color.contrastText(tint));
      bar.appendChild(a);
    }
  }

  function apply(settings) {
    const nav = settings.navigation || {};
    if (nav.global) applyGlobalNav(nav.global);
    if (nav.course) applyCourseNav(nav.course);
    applyBreadcrumbs(nav.breadcrumbs || "default");
    applyCourseTabs(settings);
  }

  BC.registry.register({ id: "navigation", styles: ["bc-nav-global-hidden", "bc-breadcrumbs", "bc-course-tabs"], nodes: ["bc-course-tabs", "bc-nav-custom", "bc-course-custom"], apply });
})();
