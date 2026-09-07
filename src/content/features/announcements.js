/* Better Canvas — announcements aggregator on the dashboard. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-ann-panel {
      background: var(--bc-surface-2, #fff); border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-lg, 10px);
      padding: var(--bc-space-5, 12px); margin-bottom: var(--bc-space-5, 12px);
    }
    .bc-ann-item {
      padding: var(--bc-space-3, 8px) var(--bc-space-4, 10px);
      border-radius: var(--bc-radius-md, 8px);
      background: var(--bc-surface-3, #f7fafc); margin-bottom: var(--bc-space-2, 6px);
    }
    .bc-ann-item .bc-ann-title { font-weight: 600; }
    .bc-ann-item .bc-ann-meta  { font-size: 12px; color: var(--bc-muted, #6b7280); }
    .bc-ann-empty { color: var(--bc-muted, #6b7280); padding: 6px 0; }
  `;

  // Concurrency-limited like every other cross-course fan-out in the codebase.
  // Promise.all over 15 courses fired 15 simultaneous requests from the
  // dashboard, on top of whatever else was loading, which is what trips Canvas's
  // rate limiter and takes unrelated features down with it.
  //
  // Errors are NOT swallowed into an empty list: "no recent announcements" and
  // "we could not reach Canvas" look identical to the user, and the empty state
  // is the more reassuring of the two, so a failure silently reads as good news.
  async function loadAll() {
    // Every active enrollment: an instructor has no student enrollment, so the
    // aggregator showed them nothing at all.
    const courses = await BC.api.activeCourses();
    const active = courses.filter((c) => !c.concluded).slice(0, 15);
    const all = [];
    let failed = 0;
    await BC.util.mapLimit(active, 4, async (c) => {
      try {
        const anns = await BC.api.courseAnnouncements(c.id, 3);
        for (const a of anns) all.push({ ...a, courseName: c.name, courseId: c.id });
      } catch (e) { failed++; BC.diag.push("announcements:" + c.id, e); }
    });
    all.sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0));
    if (!all.length && failed) throw new Error("all " + failed + " course requests failed");
    return all;
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
    load(panel);
  }

  function load(panel) {
    panel._loaded = true;
    const list = panel.querySelector(".bc-ann-list");
    list.replaceChildren(BC.ui.skeleton(3));
    loadAll().then((items) => {
      if (!items.length) {
        list.replaceChildren(BC.ui.empty("No recent announcements.",
          "Announcements from your active courses show up here."));
        return;
      }
      list.innerHTML = items.slice(0, 10).map((a) => `
        <div class="bc-ann-item">
          <div class="bc-ann-title"><a href="${BC.util.escapeHtml(a.html_url || "#")}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${BC.util.escapeHtml(a.title || "Announcement")}</a></div>
          <div class="bc-ann-meta">${BC.util.escapeHtml(a.courseName || "")} · ${a.posted_at ? BC.dt.relative(a.posted_at) : ""}</div>
        </div>
      `).join("");
    }).catch((e) => {
      BC.diag.push("announcements", e);
      // Clearing _loaded is what makes Retry able to do anything at all.
      panel._loaded = false;
      list.replaceChildren(BC.ui.errorState("Couldn't load announcements.", () => load(panel)));
    });
  }

  BC.registry.register({ id: "announcements", pages: ["dashboard"], styles: ["bc-ann-css"], nodes: ["bc-ann-panel"], apply });
})();
