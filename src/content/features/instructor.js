/*
 * Better Canvas — instructor helpers.
 * Roster CSV export, local attendance quick-mark with CSV export, and a
 * read-only "needs grading" badge on the assignments index. No grade writes.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-instr-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
    .bc-att { display: inline-flex; gap: 2px; margin-left: 8px; vertical-align: middle; }
    .bc-att button {
      border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit;
      border-radius: 6px; padding: 1px 7px; font-size: 11px; cursor: pointer;
    }
    /* P/A stays letter-and-colour, not colour alone, so it survives a colour-blind mode. */
    .bc-att button.on-p { background: var(--bc-success, #047857); color: var(--bc-success-fg, #fff); border-color: var(--bc-success, #047857); }
    .bc-att button.on-a { background: var(--bc-danger, #b91c1c); color: var(--bc-danger-fg, #fff); border-color: var(--bc-danger, #b91c1c); }
    .bc-ungraded-pill {
      display: inline-block; margin: 8px 0; padding: 4px 12px; border-radius: 999px;
      background: var(--bc-surface-3, #fef3c7); color: inherit; font-size: 13px; font-weight: 600;
      border: 1px solid var(--bc-border, #e5e7eb);
    }
    .bc-ungraded-badge {
      display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px;
      background: var(--bc-danger, #b91c1c); color: var(--bc-danger-fg, #fff); font-size: var(--bc-text-2xs, 11px); font-weight: 700; vertical-align: middle;
    }
  `;

  function downloadCsv(rows, filename) {
    const csv = rows.map((r) => r.map((v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function exportRoster(courseId) {
    try {
      const users = await BC.api.coursePeople(courseId, ["student"]);
      const rows = [["ID", "Name", "Email", "SIS ID"]];
      for (const u of users) rows.push([u.id, u.name || "", u.email || "", u.sis_user_id || ""]);
      downloadCsv(rows, `roster-${courseId}.csv`);
      BC.toast.success("Roster exported");
    } catch (e) { BC.toast.error("Export failed"); }
  }

  function exportAttendance(courseId) {
    const att = (((BC.storage.local || {}).attendance) || {})[courseId] || {};
    const days = Object.keys(att).sort();
    if (!days.length) { BC.toast.info("No attendance recorded yet"); return; }
    const userIds = new Set();
    for (const d of days) for (const uid of Object.keys(att[d])) userIds.add(uid);
    const names = {};
    document.querySelectorAll("tr[id^='user_']").forEach((tr) => {
      const uid = tr.id.replace("user_", "");
      const nameEl = tr.querySelector(".roster_user_name, a");
      if (nameEl) names[uid] = nameEl.textContent.trim();
    });
    const rows = [["User ID", "Name"].concat(days)];
    for (const uid of userIds) {
      rows.push([uid, names[uid] || ""].concat(days.map((d) => {
        const v = att[d][uid];
        return v === "p" ? "Present" : v === "a" ? "Absent" : "";
      })));
    }
    downloadCsv(rows, `attendance-${courseId}.csv`);
    BC.toast.success("Attendance exported");
  }

  function markAttendance(courseId, userId, value) {
    const ymd = BC.dt.ymd(new Date());
    BC.storage.updateLocal((d) => {
      const att = (d.attendance = d.attendance || {});
      const course = (att[courseId] = att[courseId] || {});
      const day = (course[ymd] = course[ymd] || {});
      if (day[userId] === value) delete day[userId]; else day[userId] = value;
    });
  }

  function installPeopleTools(ctx, settings) {
    const onPeople = ctx.page === "course" && ctx.courseId && /\/users\/?$/.test(location.pathname);
    if (!onPeople) { BC.injector.removeNode("bc-roster-btn"); return; }

    const rows = document.querySelectorAll("tr[id^='user_']");
    if (!settings.instructor.rosterExport && !settings.instructor.attendanceQuick) {
      BC.injector.removeNode("bc-roster-btn");
    } else {
      BC.injector.ensureNode("bc-roster-btn", document.querySelector("#content, #main") || document.body, () => {
        const bar = document.createElement("div");
        bar.className = "bc-instr-bar";
        if (settings.instructor.rosterExport) {
          const btn = document.createElement("button");
          btn.className = "bc-btn";
          btn.textContent = "Export roster (CSV)";
          btn.addEventListener("click", () => exportRoster(ctx.courseId));
          bar.appendChild(btn);
        }
        if (settings.instructor.attendanceQuick) {
          const btn2 = document.createElement("button");
          btn2.className = "bc-btn";
          btn2.textContent = "Export attendance (CSV)";
          btn2.addEventListener("click", () => exportAttendance(ctx.courseId));
          bar.appendChild(btn2);
          const hint = document.createElement("span");
          hint.style.cssText = "font-size:12px;color:var(--bc-muted,#6b7280)";
          hint.textContent = "P/A buttons mark today's attendance (stored locally).";
          bar.appendChild(hint);
        }
        const host = document.querySelector("#content, #main") || document.body;
        host.prepend(bar);
        return bar;
      });
    }

    if (!settings.instructor.attendanceQuick) {
      document.querySelectorAll(".bc-att").forEach((n) => n.remove());
    } else if (rows.length) {
      const ymd = BC.dt.ymd(new Date());
      const att = ((((BC.storage.local || {}).attendance) || {})[ctx.courseId] || {})[ymd] || {};
      rows.forEach((tr) => {
        if (tr.querySelector(".bc-att")) return;
        const uid = tr.id.replace("user_", "");
        const cell = tr.querySelector("td");
        if (!cell) return;
        const wrap = document.createElement("span");
        wrap.className = "bc-att";
        const pBtn = document.createElement("button");
        pBtn.textContent = "P"; pBtn.title = "Mark present (today)";
        const aBtn = document.createElement("button");
        aBtn.textContent = "A"; aBtn.title = "Mark absent (today)";
        const paint = (v) => {
          pBtn.classList.toggle("on-p", v === "p");
          aBtn.classList.toggle("on-a", v === "a");
        };
        paint(att[uid]);
        pBtn.addEventListener("click", () => {
          const cur = pBtn.classList.contains("on-p") ? null : "p";
          markAttendance(ctx.courseId, uid, "p"); paint(cur);
        });
        aBtn.addEventListener("click", () => {
          const cur = aBtn.classList.contains("on-a") ? null : "a";
          markAttendance(ctx.courseId, uid, "a"); paint(cur);
        });
        wrap.appendChild(pBtn); wrap.appendChild(aBtn);
        cell.appendChild(wrap);
      });
    }
  }

  function installUngradedBadge(ctx, settings) {
    if (ctx.page !== "assignments" || !ctx.courseId) { BC.injector.removeNode("bc-ungraded"); return; }
    BC.api.courseAssignments(ctx.courseId).then((assignments) => {
      let total = 0;
      for (const a of assignments) {
        const n = a.needs_grading_count | 0;
        if (!n) continue;
        total += n;
        const link = document.querySelector(`#content a[href$="/assignments/${a.id}"]`);
        if (link && !link.querySelector(".bc-ungraded-badge")) {
          const b = document.createElement("span");
          b.className = "bc-ungraded-badge";
          b.setAttribute("data-bc-node", "bc-ungraded-badge");
          const label = n + " submission" + (n === 1 ? "" : "s") + " need grading";
          b.title = label;
          b.setAttribute("aria-label", label);   // the bare number alone conveys nothing
          b.textContent = String(n);
          link.appendChild(b);
        }
      }
      if (!total) { BC.injector.removeNode("bc-ungraded"); return; }
      BC.injector.ensureNode("bc-ungraded", document.querySelector("#content") || document.body, () => {
        const pill = document.createElement("div");
        pill.className = "bc-ungraded-pill";
        (document.querySelector("#content") || document.body).prepend(pill);
        return pill;
      }).textContent = `⚑ ${total} submission${total === 1 ? "" : "s"} waiting to be graded`;
    }).catch((e) => BC.diag.push("instructor:ungraded", e));
  }

  function removeBadges() {
    BC.injector.removeNode("bc-ungraded");
    document.querySelectorAll(".bc-ungraded-badge").forEach((b) => b.remove());
  }

  function apply(settings, ctx) {
    const i = settings.instructor || {};
    if (!i.rosterExport && !i.attendanceQuick && !i.bulkGradeHelpers) {
      BC.injector.removeNode("bc-roster-btn");
      removeBadges();
      BC.injector.setStyle("bc-instr-css", "");
      return;
    }
    BC.injector.setStyle("bc-instr-css", CSS);
    installPeopleTools(ctx, settings);
    if (i.bulkGradeHelpers) installUngradedBadge(ctx, settings);
    else removeBadges();
  }

  // bc-ungraded-badge is injected per assignment link but was never declared, so
  // teardown left the badges stuck on Canvas's assignments index.
  BC.registry.register({
    id: "instructor", styles: ["bc-instr-css"], pages: ["course", "assignments"],
    nodes: ["bc-roster-btn", "bc-ungraded", "bc-ungraded-badge"], apply,
  });
})();
