/*
 * Better Canvas — semester progress widget.
 * "Week 9 of 15 · 43 days left" bar on the dashboard, computed from the
 * enrollment term dates of the user's active courses.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const DAY = 864e5;

  const CSS = `
    .bc-semester {
      display: flex; align-items: center; gap: var(--bc-space-5, 12px);
      margin: var(--bc-space-2, 6px) 0 var(--bc-space-5, 12px);
      padding: var(--bc-space-4, 10px) var(--bc-space-6, 14px);
      border-radius: var(--bc-radius-lg, 10px); background: var(--bc-surface-2, #f3f4f6);
      border: 1px solid var(--bc-border, #e5e7eb); font-size: var(--bc-text-sm, 13px);
    }
    .bc-semester-label { font-weight: 600; white-space: nowrap; }
    .bc-semester-track { flex: 1; height: 6px; border-radius: 999px; background: var(--bc-surface-3, #e5e7eb); overflow: hidden; }
    .bc-semester-fill { height: 100%; background: var(--bc-accent, #0374b5); border-radius: 999px; transition: width .4s ease; }
    .bc-semester-days { color: var(--bc-muted, #6b7280); white-space: nowrap; }
  `;

  function currentTerm(courses) {
    const now = Date.now();
    const counts = new Map();
    for (const c of courses) {
      const t = c.term;
      if (!t || !t.start_at || !t.end_at) continue;
      const s = new Date(t.start_at).getTime();
      const e = new Date(t.end_at).getTime();
      if (!(s <= now && now <= e)) continue;
      const cur = counts.get(t.id) || { term: t, n: 0 };
      cur.n++;
      counts.set(t.id, cur);
    }
    let best = null;
    for (const v of counts.values()) if (!best || v.n > best.n) best = v;
    return best && best.term;
  }

  function render() {
    // Term dates come from any enrollment, so this must not filter to student
    // ones or an instructor never sees the term progress bar.
    BC.api.activeCourses().then((courses) => {
      const term = currentTerm(courses);
      if (!term) { BC.injector.removeNode("bc-semester"); return; }
      const now = Date.now();
      const s = new Date(term.start_at).getTime();
      const e = new Date(term.end_at).getTime();
      const pct = Math.min(100, Math.max(0, Math.round(((now - s) / (e - s)) * 100)));
      const week = Math.max(1, Math.floor((now - s) / (7 * DAY)) + 1);
      const weeks = Math.max(week, Math.round((e - s) / (7 * DAY)));
      const daysLeft = Math.max(0, Math.ceil((e - now) / DAY));

      const host = document.querySelector("#dashboard_header_container, #content") || document.body;
      const node = BC.injector.ensureNode("bc-semester", host, () => {
        const div = document.createElement("div");
        div.className = "bc-semester";
        div.innerHTML =
          '<span class="bc-semester-label"></span>' +
          '<div class="bc-semester-track"><div class="bc-semester-fill"></div></div>' +
          '<span class="bc-semester-days"></span>';
        const cards = document.getElementById("DashboardCard_Container");
        if (cards && cards.parentNode) cards.parentNode.insertBefore(div, cards);
        else host.appendChild(div);
        return div;
      });
      // render() runs on every apply tick; rewriting identical text still swaps
      // the child text node, which the observer reads as a change and schedules
      // yet another applyAll.
      const set = (sel, text) => {
        const el = node.querySelector(sel);
        if (el && el.textContent !== text) el.textContent = text;
      };
      set(".bc-semester-label", (term.name || "This term") + " · Week " + week + " of " + weeks);
      set(".bc-semester-days", daysLeft + " day" + (daysLeft === 1 ? "" : "s") + " left · " + pct + "%");
      const fill = node.querySelector(".bc-semester-fill");
      const w = pct + "%";
      if (fill && fill.style.width !== w) fill.style.width = w;
    }).catch((e) => BC.diag.push("semester", e));
  }

  function apply(settings, ctx) {
    const on = settings.dashboard && settings.dashboard.semesterProgress && ctx.page === "dashboard";
    if (!on) {
      BC.injector.removeNode("bc-semester");
      BC.injector.setStyle("bc-semester-css", "");
      return;
    }
    BC.injector.setStyle("bc-semester-css", CSS);
    render();
  }

  BC.registry.register({ id: "semester", pages: ["dashboard"], styles: ["bc-semester-css"], nodes: ["bc-semester"], apply });
})();
