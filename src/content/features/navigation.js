/*
 * Better Canvas — navigation feature.
 * Global left nav and per-course nav: hide, reorder, and add custom links.
 * Hiding uses CSS (:has) so it survives re-renders with zero DOM churn;
 * reordering and custom links touch the DOM but only when the result differs.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};
  const U = BC.util;

  // Place known nodes (in the given key order) first, keep the rest after.
  function reorder(container, keyOf, order) {
    if (!container || !order || !order.length) return;
    const items = Array.from(container.children).filter(
      (n) => n.tagName === "LI"
    );
    const byKey = new Map();
    for (const li of items) {
      const k = keyOf(li);
      if (k) byKey.set(k, li);
    }
    const ordered = [];
    for (const k of order) if (byKey.has(k)) ordered.push(byKey.get(k));
    const rest = items.filter((li) => !ordered.includes(li));
    const desired = ordered.concat(rest);
    // Skip if DOM already matches to avoid feedback loops.
    const same =
      desired.length === items.length &&
      desired.every((n, i) => n === items[i]);
    if (same) return;
    for (const li of desired) container.appendChild(li);
  }

  function ensureCustomLinks(container, scope, links) {
    if (!container) return;
    // Remove stale custom links no longer in settings.
    container
      .querySelectorAll(`li[data-bc-link="${scope}"]`)
      .forEach((li) => {
        const idx = Number(li.getAttribute("data-bc-link-idx"));
        if (!links[idx]) li.remove();
      });
    links.forEach((link, idx) => {
      if (!link || !link.url || !U.isSafeUrl(link.url)) return;
      let li = container.querySelector(
        `li[data-bc-link="${scope}"][data-bc-link-idx="${idx}"]`
      );
      if (li) {
        const a = li.querySelector("a");
        if (a) {
          a.href = link.url;
          a.textContent = link.label || link.url;
          a.target = link.newTab ? "_blank" : "_self";
        }
        return;
      }
      const anchor = U.el("a", {
        href: link.url,
        target: link.newTab ? "_blank" : "_self",
        rel: "noopener",
        class: scope === "global" ? "ic-app-header__menu-list-link" : "",
        text: link.label || link.url,
      });
      li = U.el(
        "li",
        {
          class:
            scope === "global"
              ? "menu-item ic-app-header__menu-list-item"
              : "section",
          dataset: { bcLink: scope, bcLinkIdx: String(idx) },
        },
        [anchor]
      );
      container.appendChild(li);
    });
  }

  BC.features.navigation = {
    id: "navigation",

    apply(settings) {
      const nav = settings.navigation;

      // ---- Global (left) nav ------------------------------------------
      const hideCss = (nav.global.hidden || [])
        .map((id) => `li:has(> a#${U.cssSafe(id)}), a#${U.cssSafe(id)}`)
        .filter(Boolean);
      let css = hideCss.length ? `${hideCss.join(", ")} { display:none !important; }\n` : "";

      const globalList = document.querySelector(
        "#menu, .ic-app-header__menu-list"
      );
      if (globalList) {
        reorder(
          globalList,
          (li) => {
            const a = li.querySelector("a[id^='global_nav_']");
            return a ? a.id : null;
          },
          nav.global.order
        );
        ensureCustomLinks(globalList, "global", nav.global.customLinks || []);
      }

      // ---- Per-course nav ---------------------------------------------
      const courseList = document.getElementById("section-tabs");
      if (courseList) {
        const labelOf = (li) =>
          (li.querySelector("a")?.textContent || "").trim().toLowerCase();
        // Hide by label.
        const hidden = new Set(
          (nav.course.hidden || []).map((s) => String(s).toLowerCase())
        );
        Array.from(courseList.querySelectorAll("li.section")).forEach((li) => {
          if (li.hasAttribute("data-bc-link")) return;
          li.style.display = hidden.has(labelOf(li)) ? "none" : "";
        });
        reorder(courseList, labelOf, (nav.course.order || []).map((s) => s.toLowerCase()));
        ensureCustomLinks(courseList, "course", nav.course.customLinks || []);
      }

      BC.injector.setStyle("bc-navigation", css);
    },
  };
})();
