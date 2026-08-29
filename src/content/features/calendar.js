/* Better Canvas — calendar (.ics export + mini month view on dashboard). */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  function icsEscape(s) {
    return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }
  function icsDate(d) {
    const x = new Date(d);
    const pad = (n) => String(n).padStart(2, "0");
    return x.getUTCFullYear() + pad(x.getUTCMonth() + 1) + pad(x.getUTCDate()) + "T" +
           pad(x.getUTCHours()) + pad(x.getUTCMinutes()) + "00Z";
  }

  async function exportIcs() {
    try {
      const start = new Date(); start.setDate(start.getDate() - 14);
      const end = new Date(); end.setDate(end.getDate() + 90);
      const items = await BC.api.plannerItems(start.toISOString(), end.toISOString());
      // Personal events were advertised but nothing ever wrote them and there was no
      // UI, so the setting is gone. bcLocal.calendarEvents is left as the read path
      // in case the feature is built later; today it's simply empty.
      const local = (BC.storage.local && BC.storage.local.calendarEvents) || [];
      const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Better Canvas//EN","CALSCALE:GREGORIAN"];
      for (const it of items) {
        const due = it.plannable_date || (it.plannable && it.plannable.due_at); if (!due) continue;
        const uid = "bc-" + (it.plannable_id || (it.plannable && it.plannable.id) || Math.random()) + "@better-canvas";
        lines.push("BEGIN:VEVENT",
          "UID:" + uid,
          "DTSTAMP:" + icsDate(new Date()),
          "DTSTART:" + icsDate(due),
          "DTEND:" + icsDate(new Date(new Date(due).getTime() + 30 * 60 * 1000)),
          "SUMMARY:" + icsEscape((it.plannable && it.plannable.title) || "Assignment"),
          "DESCRIPTION:" + icsEscape(it.context_name || ""),
          "END:VEVENT");
      }
      for (const ev of local) {
        lines.push("BEGIN:VEVENT",
          "UID:bc-local-" + (ev.id || Math.random()) + "@better-canvas",
          "DTSTAMP:" + icsDate(new Date()),
          "DTSTART:" + icsDate(ev.start),
          "DTEND:" + icsDate(ev.end || ev.start),
          "SUMMARY:" + icsEscape(ev.title),
          "DESCRIPTION:" + icsEscape(ev.description || ""),
          "END:VEVENT");
      }
      lines.push("END:VCALENDAR");
      const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "better-canvas.ics"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      BC.toast.success("Exported " + items.length + " events");
    } catch (e) { BC.toast.error("Export failed: " + e.message); }
  }

  BC.calendar = { exportIcs };

  const CSS = `
    .bc-mini-cal {
      background: var(--bc-surface-2, #fff); border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: 10px; padding: 12px; margin-bottom: 12px;
    }
    .bc-mini-cal h4 { margin: 0 0 8px; font-size: 14px; }
    .bc-mini-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
    .bc-mini-cell {
      aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center;
      font-size: 12px; border-radius: 4px; background: var(--bc-surface-3, #f7fafc); color: var(--bc-text, inherit);
      position: relative;
    }
    .bc-mini-cell.today { background: var(--bc-accent, #0374b5); color: var(--bc-accent-contrast, #fff); }
    .bc-mini-cell.has::after { content:""; position: absolute; right: 4px; top: 4px; width: 5px; height: 5px; background: var(--bc-accent, #0374b5); border-radius: 50%; }
    .bc-mini-cell.today.has::after { background: var(--bc-accent-contrast, #fff); }
  `;

  async function renderMini(mount) {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    // End of the last day, not its midnight. Passing 00:00 excluded everything
    // due on the final day of the month, so that cell never got its due dot.
    const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    let items = [];
    try {
      items = await BC.api.plannerItems(first.toISOString(), last.toISOString());
    } catch (e) {
      // A swallowed failure rendered an empty month grid, which is indistinguishable
      // from "nothing is due" — the most misleading failure mode in the extension.
      BC.diag.push("calendar:mini", e);
      if (BC.ui) {
        mount.replaceChildren(BC.ui.errorState("Couldn't load this month.", () => renderMini(mount)));
        return;
      }
    }
    const dueByDay = new Set();
    for (const it of items) {
      const d = it.plannable_date || (it.plannable && it.plannable.due_at);
      if (d) dueByDay.add(new Date(d).getDate());
    }
    let html = `<h4>${BC.dt.MONTHS[today.getMonth()]} ${today.getFullYear()}</h4><div class="bc-mini-grid">`;
    const startDow = first.getDay();
    for (let i = 0; i < startDow; i++) html += `<div></div>`;
    for (let d = 1; d <= last.getDate(); d++) {
      const cls = ["bc-mini-cell"];
      if (d === today.getDate()) cls.push("today");
      if (dueByDay.has(d)) cls.push("has");
      html += `<div class="${cls.join(" ")}">${d}</div>`;
    }
    html += `</div>`;
    mount.innerHTML = html;
  }

  function apply(settings, ctx) {
    const c = settings.calendar || {};
    if (!c.miniOnDashboard || ctx.page !== "dashboard") {
      BC.injector.removeNode("bc-mini-cal");
      BC.injector.setStyle("bc-mini-cal-css", "");
      return;
    }
    BC.injector.setStyle("bc-mini-cal-css", CSS);
    const target = document.querySelector("#right-side, #dashboard, #DashboardCard_Container");
    if (!target) return;
    const panel = BC.injector.ensureNode("bc-mini-cal", target.parentNode || target, () => {
      const d = document.createElement("div");
      d.className = "bc-mini-cal";
      (target.parentNode || target).insertBefore(d, target);
      return d;
    });
    if (panel._loaded) return;
    panel._loaded = true;
    renderMini(panel);
  }

  BC.registry.register({ id: "calendar", styles: ["bc-mini-cal-css"], nodes: ["bc-mini-cal"], apply });
})();
