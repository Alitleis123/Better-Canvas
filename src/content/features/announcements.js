/* Better Canvas — announcements aggregator on the dashboard. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-ann-panel {
      background: var(--bc-d-bg2, #fff); border: 1px solid var(--bc-d-border, #e5e7eb);
      border-radius: 10px; padding: 12px; margin-bottom: 12px;
    }
    .bc-ann-item { padding: 8px 10px; border-radius: 8px; background: var(--bc-d-bg3, #f7fafc); margin-bottom: 6px; }
    .bc-ann-item .bc-ann-title { font-weight: 600; }
    .bc-ann-item .bc-ann-meta  { font-size: 12px; color: var(--bc-d-muted, #6b7280); }
    .bc-ann-empty { color: var(--bc-d-muted, #6b7280); padding: 6px 0; }
  `;

  async function loadAll() {
    try {
      const courses = await BC.api.coursesWithScores();
      const active = courses.filter((c) => !c.concluded).slice(0, 15);
      const all = [];
      await Promise.all(active.map(async (c) => {
        try {
          const anns = await BC.api.courseAnnouncements(c.id, 3);
          for (const a of anns) all.push({ ...a, courseName: c.name, courseId: c.id });
        } catch (_) {}
      }));
      all.sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0));
      return all;
    } catch (e) { BC.util.warn("announcements", e); return []; }
  }

  function apply(settings, ctx) {
    const a = settings.announcements || {};
    if (!a.aggregator || ctx.page !== "dashboard") {
      BC.injector.removeNode("bc-ann-panel");
      BC.injector.setStyle("bc-ann-css", "");
      return;
    }
    BC.injector.setStyle("bc-ann-css", CSS);
    const target = document.querySelector("#dashboard, #DashboardCard_Container");
    if (!target) return;
    const panel = BC.injector.ensureNode("bc-ann-panel", target.parentNode || target, () => {
      const d = document.createElement("div");
      d.className = "bc-ann-panel";
      d.innerHTML = "<strong>Announcements</strong><div class='bc-ann-list'>Loading…</div>";
      target.parentNode.insertBefore(d, target);
      return d;
    });
    if (panel._loaded) return;
    panel._loaded = true;
    loadAll().then((items) => {
      const list = panel.querySelector(".bc-ann-list");
      if (!items.length) { list.innerHTML = `<div class="bc-ann-empty">No recent announcements</div>`; return; }
      list.innerHTML = items.slice(0, 10).map((a) => `
        <div class="bc-ann-item">
          <div class="bc-ann-title"><a href="${BC.util.escapeHtml(a.html_url || "#")}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${BC.util.escapeHtml(a.title || "Announcement")}</a></div>
          <div class="bc-ann-meta">${BC.util.escapeHtml(a.courseName)} · ${a.posted_at ? BC.dt.relative(a.posted_at) : ""}</div>
        </div>
      `).join("");
    });
  }

  BC.registry.register({ id: "announcements", styles: ["bc-ann-css"], nodes: ["bc-ann-panel"], apply });
})();
