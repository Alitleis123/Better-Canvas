/* Better Canvas — global + course navigation editing, breadcrumbs, quick-search, course tabs. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

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

    // Custom links
    let customList = document.getElementById("bc-nav-custom");
    if (customList) customList.remove();
    if ((nav.customLinks || []).length) {
      customList = document.createElement("ul");
      customList.id = "bc-nav-custom";
      customList.setAttribute("data-bc-node", "bc-nav-custom");
      customList.style.listStyle = "none"; customList.style.padding = "0"; customList.style.margin = "8px 0 0";
      for (const l of nav.customLinks) {
        if (!BC.util.isSafeHttpUrl(l.url)) continue;
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = l.url; a.textContent = l.label || l.url;
        if (l.newTab) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
        a.style.cssText = "display:flex; align-items:center; gap:8px; padding:8px 10px; color:inherit; text-decoration:none;";
        li.appendChild(a);
        customList.appendChild(li);
      }
      list.parentNode.insertBefore(customList, list.nextSibling);
    }
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

    // Course custom links
    let existing = document.getElementById("bc-course-custom");
    if (existing) existing.remove();
    if ((nav.customLinks || []).length) {
      existing = document.createElement("ul");
      existing.id = "bc-course-custom";
      existing.setAttribute("data-bc-node", "bc-course-custom");
      existing.style.listStyle = "none"; existing.style.padding = "0"; existing.style.margin = "8px 0 0";
      for (const l of nav.customLinks) {
        if (!BC.util.isSafeHttpUrl(l.url)) continue;
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = l.url; a.textContent = l.label || l.url;
        if (l.newTab) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
        a.style.cssText = "display:block; padding:6px 10px; color:inherit; text-decoration:none; border-radius:6px;";
        li.appendChild(a);
        existing.appendChild(li);
      }
      list.parentNode.insertBefore(existing, list.nextSibling);
    }
  }

  function applyBreadcrumbs(mode) {
    let css = "";
    if (mode === "hidden") css = ".ic-app-crumbs { display: none !important; }";
    else if (mode === "compact") css = ".ic-app-crumbs { font-size: 12px !important; padding: 4px 8px !important; }";
    BC.injector.setStyle("bc-breadcrumbs", css);
  }

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
    const bar = BC.injector.ensureNode("bc-course-tabs", target, () => {
      const el = document.createElement("div");
      el.className = "bc-course-tabs";
      target.prepend(el);
      return el;
    });
    bar.innerHTML = "";
    const pinned = new Set((settings.dashboard.pinned || []).map(String));
    const items = cards.filter((c) => pinned.has(String(c.id)) || pinned.size === 0).slice(0, 12);
    const cur = BC.util.courseIdFromHref(location.pathname);
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
    BC.injector.setStyle("bc-course-tabs", `
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
    `);
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
