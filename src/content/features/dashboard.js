/*
 * Better Canvas — dashboard feature (the headline).
 * Per-card: hide, reorder, custom nickname, color, and background image.
 * Plus auto-hide concluded courses and independent To Do / Coming Up /
 * Recent Feedback sidebar toggles.
 *
 * Reordering/visuals re-apply on every observer tick and are idempotent, so
 * they survive Canvas's React re-renders. An inline gear editor on each card
 * lets the user customize directly on the dashboard.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};
  const U = BC.util;

  let concludedIds = null; // Set<string> once fetched
  let concludedFetching = false;

  // Locate all cards and, for each, the container child that holds it (the
  // unit we reorder/hide), plus its course id.
  function getCardData() {
    const cards = Array.from(document.querySelectorAll(".ic-DashboardCard"));
    if (!cards.length) return { container: null, items: [] };
    let container = cards[0].parentElement;
    while (container && cards.some((c) => !container.contains(c)))
      container = container.parentElement;
    if (!container) return { container: null, items: [] };
    const items = cards
      .map((card) => {
        let root = card;
        while (root.parentElement && root.parentElement !== container)
          root = root.parentElement;
        const link = card.querySelector('a[href*="/courses/"]');
        const id = U.courseIdFromHref(link && link.getAttribute("href"));
        return { card, root, id };
      })
      .filter((x) => x.id);
    return { container, items };
  }

  function applyOrder(container, items, order) {
    if (!order || !order.length) return;
    const byId = new Map(items.map((it) => [it.id, it]));
    const ordered = [];
    for (const id of order) if (byId.has(id)) ordered.push(byId.get(id));
    const rest = items.filter((it) => !ordered.includes(it));
    const desired = ordered.concat(rest);
    const currentRoots = items.map((it) => it.root);
    const same =
      desired.length === currentRoots.length &&
      desired.every((it, i) => it.root === currentRoots[i]);
    if (same) return;
    for (const it of desired) container.appendChild(it.root);
  }

  function applyVisuals(card, cfg) {
    // Nickname
    const titleEl = card.querySelector(".ic-DashboardCard__header-title");
    if (titleEl) {
      if (card.dataset.bcOrigTitle == null)
        card.dataset.bcOrigTitle = titleEl.textContent.trim();
      const want = cfg.nickname ? cfg.nickname : card.dataset.bcOrigTitle;
      if (titleEl.textContent !== want) titleEl.textContent = want;
    }
    // Color + background image live on the colored hero band.
    const hero = card.querySelector(".ic-DashboardCard__header_hero");
    if (hero) {
      if (card.dataset.bcOrigColor == null)
        card.dataset.bcOrigColor =
          hero.style.backgroundColor ||
          getComputedStyle(hero).backgroundColor ||
          "";
      const color = cfg.color && U.hexToRgb(cfg.color) ? cfg.color : card.dataset.bcOrigColor;
      hero.style.setProperty("background-color", color, "important");
      if (cfg.bgImage && U.isSafeUrl(cfg.bgImage)) {
        hero.style.setProperty(
          "background-image",
          `url("${U.cssSafe(cfg.bgImage)}")`,
          "important"
        );
        hero.style.backgroundSize = "cover";
        hero.style.backgroundPosition = "center";
      } else {
        hero.style.removeProperty("background-image");
      }
    }
  }

  // Hover-only "Edit" pill in the top-left corner of the card — away from
  // Canvas's own top-right kebab and the bottom action-icon row, so nothing
  // overlaps. Stops propagation so it never triggers the card's course link.
  function ensureEditPill(card, id) {
    if (card.querySelector(":scope > .bc-card-pill")) return;
    const btn = U.el(
      "button",
      {
        class: "bc-card-pill",
        type: "button",
        title: "Better Canvas: edit this card",
        "aria-label": "Edit card",
        dataset: { bcCourse: id },
      },
      [
        U.el("span", { class: "bc-card-pill-ico", text: "✎" }),
        U.el("span", { class: "bc-card-pill-txt", text: "Edit" }),
      ]
    );
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditor(id, btn);
    });
    const style = getComputedStyle(card);
    if (style.position === "static") card.style.position = "relative";
    card.appendChild(btn);
  }

  // ---- Singleton inline editor -------------------------------------------
  let editorEl = null;
  let fields = null;

  function buildEditor() {
    const nickname = U.el("input", { type: "text", class: "bc-ed-input", placeholder: "Custom name" });
    const color = U.el("input", { type: "color", class: "bc-ed-color" });
    const bg = U.el("input", { type: "text", class: "bc-ed-input", placeholder: "Background image URL (optional)" });
    const hide = U.el("input", { type: "checkbox" });
    const hideLabel = U.el("label", { class: "bc-ed-row" }, [hide, " Hide this card"]);
    const reset = U.el("button", { type: "button", class: "bc-ed-btn", text: "Reset" });
    const close = U.el("button", { type: "button", class: "bc-ed-btn bc-ed-btn--primary", text: "Done" });

    fields = { nickname, color, bg, hide };

    const persist = () =>
      BC.storage.update((s) => {
        const map = s.dashboard.courses;
        const id = editorEl.dataset.courseId;
        const cur = map[id] || {};
        cur.nickname = nickname.value.trim();
        cur.color = color.value;
        cur.bgImage = bg.value.trim();
        cur.hidden = hide.checked;
        map[id] = cur;
      });

    [nickname, bg].forEach((el) => el.addEventListener("change", persist));
    color.addEventListener("input", persist);
    hide.addEventListener("change", persist);
    reset.addEventListener("click", () => {
      nickname.value = "";
      bg.value = "";
      hide.checked = false;
      BC.storage.update((s) => {
        delete s.dashboard.courses[editorEl.dataset.courseId];
      });
    });
    close.addEventListener("click", () => (editorEl.style.display = "none"));

    const panel = U.el("div", { class: "bc-card-editor" }, [
      U.el("div", { class: "bc-ed-title", text: "Card settings" }),
      U.el("div", { class: "bc-ed-row" }, [U.el("span", { text: "Name" }), nickname]),
      U.el("div", { class: "bc-ed-row" }, [U.el("span", { text: "Color" }), color]),
      U.el("div", { class: "bc-ed-row" }, [U.el("span", { text: "Image" }), bg]),
      hideLabel,
      U.el("div", { class: "bc-ed-actions" }, [reset, close]),
    ]);
    panel.style.display = "none";
    return panel;
  }

  function openEditor(id, anchorBtn) {
    editorEl = BC.injector.ensureNode("bc-card-editor", document.body, buildEditor);
    if (!fields) return;
    const cfg = (BC.storage.current?.dashboard.courses || {})[id] || {};
    fields.nickname.value = cfg.nickname || "";
    fields.color.value = /^#[0-9a-f]{6}$/i.test(cfg.color || "") ? cfg.color : "#394b58";
    fields.bg.value = cfg.bgImage || "";
    fields.hide.checked = !!cfg.hidden;
    editorEl.dataset.courseId = id;
    const r = anchorBtn.getBoundingClientRect();
    editorEl.style.display = "block";
    editorEl.style.top = window.scrollY + r.bottom + 6 + "px";
    editorEl.style.left =
      Math.max(8, window.scrollX + r.right - 260) + "px";
  }

  function maybeFetchConcluded(settings) {
    if (!settings.dashboard.autoHideConcluded) return;
    if (concludedIds || concludedFetching) return;
    concludedFetching = true;
    BC.api
      .coursesWithScores()
      .then((courses) => {
        concludedIds = new Set(
          courses
            .filter(
              (c) =>
                c.concluded === true ||
                (c.enrollments || []).every(
                  (e) => e.enrollment_state === "completed"
                )
            )
            .map((c) => String(c.id))
        );
        BC.applyAll && BC.applyAll(BC.storage.current);
      })
      .catch(() => {})
      .finally(() => (concludedFetching = false));
  }

  const PILL_CSS = `
.bc-card-pill { position:absolute; top:8px; left:8px; z-index:5; display:inline-flex;
  align-items:center; gap:5px; padding:4px 10px 4px 8px; border:none; border-radius:999px;
  cursor:pointer; font:600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:rgba(15,18,25,0.55); color:#fff; opacity:0; transform:translateY(-3px);
  transition:opacity .14s, transform .14s, background .14s; backdrop-filter:blur(4px); }
.ic-DashboardCard:hover .bc-card-pill, .bc-card-pill:focus-visible { opacity:1; transform:none; }
.bc-card-pill:hover { background:rgba(15,18,25,0.78); }
.bc-card-pill-ico { font-size:12px; }
.bc-card-editor { position:absolute; z-index:99999; width:252px; padding:12px;
  background:#fff; color:#2d3b45; border:1px solid #c7cdd1; border-radius:8px;
  box-shadow:0 8px 24px rgba(0,0,0,0.25); font-size:13px; }
html.bc-dark .bc-card-editor { background:#161b22; color:#dfe3e8; border-color:#2b313a; }
.bc-card-editor .bc-ed-title { font-weight:700; margin-bottom:8px; }
.bc-card-editor .bc-ed-row { display:flex; align-items:center; gap:8px; margin:6px 0; }
.bc-card-editor .bc-ed-row > span { width:46px; flex:0 0 auto; }
.bc-card-editor .bc-ed-input { flex:1 1 auto; min-width:0; padding:4px 6px;
  border:1px solid #c7cdd1; border-radius:4px; background:inherit; color:inherit; }
.bc-card-editor .bc-ed-color { width:46px; height:28px; padding:0; border:1px solid #c7cdd1; }
.bc-card-editor .bc-ed-actions { display:flex; justify-content:space-between; margin-top:10px; }
.bc-card-editor .bc-ed-btn { padding:5px 12px; border:1px solid #c7cdd1; border-radius:4px;
  background:#f5f5f5; color:#2d3b45; cursor:pointer; }
.bc-card-editor .bc-ed-btn--primary { background:var(--ic-brand-primary,#0374b5); color:#fff; border:none; }
`;

  const WIDGET_SELECTORS = {
    todo:
      ".Sidebar__TodoListContainer, .todo-list-header, .todo-list, " +
      '[data-testid="todo-sidebar"], .planner-todo',
    comingUp:
      ".coming_up, .events_list.coming_up, .ic-EventList, " +
      '[data-testid="coming-up"]',
    recentFeedback:
      ".recent_feedback, .events_list.recent_feedback, " +
      '[data-testid="recent-feedback"]',
  };

  BC.features.dashboard = {
    id: "dashboard",

    apply(settings) {
      const d = settings.dashboard;

      // Sidebar widget toggles (CSS only; harmless off-dashboard).
      let widgetCss = "";
      if (d.hideSidebar) {
        // Drop the entire right column and let the main content reclaim the width.
        widgetCss +=
          "#right-side-wrapper, .ic-app-main-content__secondary { display:none !important; }\n" +
          "#not_right_side, .ic-Dashboard-header__layout ~ .ic-app-main-content__primary { width:100% !important; max-width:100% !important; }\n";
      } else {
        if (!d.widgets.todo) widgetCss += `${WIDGET_SELECTORS.todo}{display:none !important;}\n`;
        if (!d.widgets.comingUp) widgetCss += `${WIDGET_SELECTORS.comingUp}{display:none !important;}\n`;
        if (!d.widgets.recentFeedback)
          widgetCss += `${WIDGET_SELECTORS.recentFeedback}{display:none !important;}\n`;
      }
      BC.injector.setStyle("bc-dashboard-widgets", widgetCss);

      if (!d.enabled) {
        BC.injector.removeNode("bc-card-editor");
        BC.injector.setStyle("bc-dashboard-ui", "");
        return;
      }
      BC.injector.setStyle("bc-dashboard-ui", PILL_CSS);

      const { container, items } = getCardData();
      if (!container || !items.length) return;

      maybeFetchConcluded(settings);

      const courses = d.courses || {};
      for (const { card, root, id } of items) {
        const cfg = courses[id] || {};
        const concluded =
          d.autoHideConcluded && concludedIds && concludedIds.has(id);
        const hidden = !!cfg.hidden || concluded;
        if (root.style.display !== (hidden ? "none" : ""))
          root.style.display = hidden ? "none" : "";
        if (!hidden) {
          U.guard(() => applyVisuals(card, cfg), "card visuals");
          U.guard(() => ensureEditPill(card, id), "card edit pill");
        }
      }

      applyOrder(container, items.filter((i) => {
        const cfg = courses[i.id] || {};
        const concluded = d.autoHideConcluded && concludedIds && concludedIds.has(i.id);
        return !cfg.hidden && !concluded;
      }), d.courseOrder);
    },
  };
})();
