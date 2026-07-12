/*
 * Better Canvas — dashboard.
 * Card reorder / rename / recolor / hide / bg-image, layout modes, card sizes,
 * inline grade badge, progress bar, unread badges, hover-preview, auto-hide
 * concluded courses, sidebar widget toggles.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const originalTitles = new WeakMap();
  const originalColors = new WeakMap();
  let concludedIds = null;
  let concludedFetching = false;

  function maybeFetchConcluded(auto) {
    if (!auto || concludedIds || concludedFetching || !BC.api) return;
    concludedFetching = true;
    BC.api.coursesWithScores().then((list) => {
      concludedIds = new Set(list.filter((c) => c.concluded || (c.enrollments || []).some((e) => e.enrollment_state === "completed")).map((c) => String(c.id)));
    }).catch(() => {}).finally(() => { concludedFetching = false; });
  }

  function widgetsCss(w) {
    const rules = [];
    if (!w.todo)           rules.push(`.Sidebar__TodoListContainer, .ToDoSidebar { display: none !important; }`);
    if (!w.comingUp)       rules.push(`.events_list, .coming_up { display: none !important; }`);
    if (!w.recentFeedback) rules.push(`.recent_feedback { display: none !important; }`);
    return rules.join("\n");
  }

  function layoutCss(d) {
    const size = { s: 200, m: 250, l: 320 }[d.cardSize || "m"] || 250;
    const rad = (d.cardRadius|0) + "px";
    let css = `
      .ic-DashboardCard { border-radius: ${rad} !important; overflow: hidden; }
      .ic-DashboardCard__link, .ic-DashboardCard__box { border-radius: ${rad} !important; }
      ${d.hoverLift ? `.ic-DashboardCard { transition: transform .18s ease, box-shadow .18s ease; }
      .ic-DashboardCard:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,.12); }` : ""}
    `;
    if (d.layout === "grid") css += `.ic-DashboardCard__box { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(${size}px, 1fr)) !important; gap: 16px !important; }`;
    if (d.layout === "list") css += `.ic-DashboardCard__box { display: flex !important; flex-direction: column !important; gap: 8px !important; }
      .ic-DashboardCard { display: flex !important; flex-direction: row !important; height: 90px !important; }
      .ic-DashboardCard__header { flex: 0 0 120px !important; }
      .ic-DashboardCard__action-container { display: none !important; }`;
    if (d.layout === "compact") css += `.ic-DashboardCard { max-height: 120px !important; }
      .ic-DashboardCard__header_image { height: 40px !important; }`;
    if (d.layout === "masonry") css += `.ic-DashboardCard__box { columns: ${Math.max(2, Math.floor(1200/size))} auto !important; column-gap: 14px !important; }
      .ic-DashboardCard { break-inside: avoid !important; margin-bottom: 14px !important; }`;
    return css;
  }

  function overlayCard(card, spec) {
    // spec: { nickname, color, bgImage, hidden }
    const title = card.querySelector(".ic-DashboardCard__link, .ic-DashboardCard__header-title, .ic-DashboardCard__header_hero");
    const link = card.querySelector(".ic-DashboardCard__link");
    if (title) {
      if (!originalTitles.has(card)) originalTitles.set(card, title.textContent);
      if (spec.nickname && spec.nickname.trim()) title.textContent = spec.nickname;
      else if (originalTitles.has(card)) title.textContent = originalTitles.get(card);
    }
    if (link) {
      if (!originalColors.has(card)) originalColors.set(card, link.style.background || link.style.backgroundColor || "");
      if (spec.color && BC.color.isHex(spec.color)) link.style.background = spec.color;
      else if (originalColors.has(card) && originalColors.get(card)) link.style.background = originalColors.get(card);
    }
    if (spec.bgImage && BC.util.isSafeUrl(spec.bgImage)) {
      const header = card.querySelector(".ic-DashboardCard__header_image, .ic-DashboardCard__header");
      if (header) { header.style.backgroundImage = `url("${BC.util.cssSafe(spec.bgImage)}")`; header.style.backgroundSize = "cover"; header.style.backgroundPosition = "center"; }
    }
    card.style.display = spec.hidden ? "none" : "";
  }

  function overlayInlineGrade(card, courseId, scoresMap) {
    const s = scoresMap.get(String(courseId));
    if (s == null) return;
    let badge = card.querySelector(".bc-inline-grade");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "bc-inline-grade";
      const link = card.querySelector(".ic-DashboardCard__link");
      if (link) link.appendChild(badge);
      else card.appendChild(badge);
    }
    badge.textContent = s.toFixed(1) + "%";
    let band = "#059669";
    if (s < 90) band = "#65a30d";
    if (s < 80) band = "#ca8a04";
    if (s < 70) band = "#dc2626";
    badge.style.background = band;
  }

  function overlayProgress(card, plannerCountByCourse) {
    const cid = BC.util.courseIdFromHref(card.querySelector("a") && card.querySelector("a").getAttribute("href"));
    if (!cid) return;
    const info = plannerCountByCourse.get(cid);
    if (!info) return;
    const pct = info.total ? Math.round((info.done / info.total) * 100) : 0;
    let bar = card.querySelector(".bc-progress");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "bc-progress";
      bar.innerHTML = `<div class="bc-progress-fill"></div>`;
      card.appendChild(bar);
    }
    bar.querySelector(".bc-progress-fill").style.width = pct + "%";
  }

  function overlayBadges(card, badges) {
    const cid = BC.util.courseIdFromHref(card.querySelector("a") && card.querySelector("a").getAttribute("href"));
    if (!cid) return;
    const b = badges.get(cid);
    if (!b || (!b.unread && !b.due && !b.ungraded)) return;
    let strip = card.querySelector(".bc-badges");
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "bc-badges";
      card.appendChild(strip);
    }
    strip.innerHTML = "";
    if (b.unread) strip.appendChild(Object.assign(document.createElement("span"), { className: "bc-badge unread", textContent: "🔔 " + b.unread }));
    if (b.due) strip.appendChild(Object.assign(document.createElement("span"), { className: "bc-badge due", textContent: "⏰ " + b.due }));
    if (b.ungraded) strip.appendChild(Object.assign(document.createElement("span"), { className: "bc-badge ungraded", textContent: "✎ " + b.ungraded }));
  }

  let scoresMap = new Map();
  let plannerCountByCourse = new Map();
  let badges = new Map();

  async function loadInlineGrades() {
    try {
      const list = await BC.api.coursesWithScores();
      scoresMap.clear();
      for (const c of list) {
        const enr = (c.enrollments || [])[0] || {};
        const s = enr.computed_current_score != null ? enr.computed_current_score : enr.computed_final_score;
        if (s != null) scoresMap.set(String(c.id), Number(s));
      }
    } catch (_) {}
  }

  async function loadPlannerCounts() {
    try {
      const start = new Date(); start.setDate(start.getDate() - 30);
      const end = new Date(); end.setDate(end.getDate() + 14);
      const items = await BC.api.plannerItems(start.toISOString(), end.toISOString());
      plannerCountByCourse.clear();
      for (const it of items) {
        const cid = it.course_id ? String(it.course_id) : (it.context_type === "Course" ? String(it.context_id) : null);
        if (!cid) continue;
        const entry = plannerCountByCourse.get(cid) || { total: 0, done: 0 };
        entry.total++;
        if (it.planner_override && it.planner_override.marked_complete) entry.done++;
        else if (it.submissions && it.submissions.submitted) entry.done++;
        plannerCountByCourse.set(cid, entry);
      }
    } catch (_) {}
  }

  function apply(settings, ctx) {
    if (ctx.page !== "dashboard") {
      BC.injector.setStyle("bc-dashboard-ui", "");
      BC.injector.setStyle("bc-dashboard-widgets", "");
      return;
    }
    const d = settings.dashboard || {};
    if (!d.enabled) return;

    // widget CSS
    const widgetCss = widgetsCss(d.widgets || {}) + (d.hideSidebar ? "\n#right-side, #right-side-wrapper { display: none !important; }\n#main { margin-right: 0 !important; }" : "");
    BC.injector.setStyle("bc-dashboard-widgets", widgetCss);

    // layout CSS
    BC.injector.setStyle("bc-dashboard-ui", layoutCss(d) + `
      .bc-inline-grade {
        position: absolute; top: 8px; right: 8px; z-index: 2;
        padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
        color: #fff; background: #059669; box-shadow: 0 1px 4px rgba(0,0,0,.2);
      }
      .bc-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(0,0,0,.1); }
      .bc-progress-fill { height: 100%; background: var(--bc-accent, #0374b5); width: 0%; transition: width .4s ease; }
      .bc-badges { position: absolute; left: 6px; bottom: 6px; display: flex; gap: 4px; }
      .bc-badge { font-size: 10px; background: rgba(0,0,0,.65); color: #fff; padding: 2px 6px; border-radius: 999px; }
      .bc-badge.due { background: rgba(202,138,4,.9); }
      .bc-badge.unread { background: rgba(37,99,235,.9); }
      .bc-badge.ungraded { background: rgba(147,51,234,.9); }
      .ic-DashboardCard { position: relative; }
    `);

    // course cards
    if (d.autoHideConcluded) maybeFetchConcluded(true);
    const cards = document.querySelectorAll(".ic-DashboardCard");
    if (!cards.length) return;

    // Build id order + reordering
    const cardsById = new Map();
    for (const card of cards) {
      const a = card.querySelector("a.ic-DashboardCard__link");
      const cid = a && BC.util.courseIdFromHref(a.getAttribute("href"));
      if (cid) cardsById.set(cid, card);
    }

    const order = d.courseOrder || [];
    let idx = 0;
    for (const id of order) {
      const c = cardsById.get(id);
      if (c) c.style.order = String(idx++);
    }
    for (const [id, card] of cardsById) if (!order.includes(id)) card.style.order = String(idx++);

    // Apply per-card overrides
    for (const [id, card] of cardsById) {
      const spec = (d.courses && d.courses[id]) || {};
      const effHidden = spec.hidden === true || (d.autoHideConcluded && concludedIds && concludedIds.has(id));
      overlayCard(card, { ...spec, hidden: effHidden });
      if (d.showInlineGrade)   overlayInlineGrade(card, id, scoresMap);
      if (d.showProgressBar)   overlayProgress(card, plannerCountByCourse);
      if (d.showBadges)        overlayBadges(card, badges);
    }

    // Ensure grid uses order — apply flex/grid ordering
    const container = document.getElementById("DashboardCard_Container") || document.querySelector(".ic-DashboardCard__box");
    if (container) container.style.display = ""; // let CSS layoutCss govern

    if (d.showInlineGrade && !scoresMap.size) loadInlineGrades().then(() => BC.requestApply && BC.requestApply());
    if (d.showProgressBar && !plannerCountByCourse.size) loadPlannerCounts().then(() => BC.requestApply && BC.requestApply());
  }

  BC.registry.register({ id: "dashboard", styles: ["bc-dashboard-widgets", "bc-dashboard-ui"], nodes: [], apply });
})();
