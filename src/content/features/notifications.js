/*
 * Better Canvas — notifications.
 * In-page toasts (always) and browser notifications (opt-in) for due-soon
 * assignments, new grades, new announcements, goal breaches, streaks at risk.
 * Uses chrome.alarms via background where possible; falls back to setInterval.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const seen = new Set();      // dedupe key -> already notified today
  let started = false;

  function isQuietNow(n) {
    if (!n.quietHours || !n.quietHours.enabled) return false;
    return BC.dt.withinSchedule(n.quietHours.start, n.quietHours.end);
  }

  function shouldNotify(n, type) {
    if (!n.enabled && !n.inPage) return false;
    if (!n.types || !n.types[type]) return false;
    if (isQuietNow(n)) return false;
    return true;
  }

  function fire(n, opts) {
    // opts: { title, message, url, key, type }
    if (opts.key && seen.has(opts.key)) return;
    if (opts.key) seen.add(opts.key);
    if (n.inPage) BC.toast.info(opts.message, { title: opts.title, actions: opts.url ? [{ label: "Open", onClick: () => window.open(opts.url, "_blank") }] : [] });
    if (n.enabled) {
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          const notif = new Notification(opts.title, { body: opts.message });
          if (opts.url) notif.onclick = () => window.open(opts.url, "_blank");
        }
      } catch (_) {}
    }
    // Add to history
    BC.storage.update((d) => {
      d.notifications.history.unshift({ iso: new Date().toISOString(), type: opts.type || "info", title: opts.title, url: opts.url || "" });
      d.notifications.history = d.notifications.history.slice(0, 100);
    });
  }

  async function scanDueSoon(settings) {
    if (!shouldNotify(settings.notifications, "dueSoon")) return;
    try {
      const start = new Date();
      const end = new Date(); end.setDate(end.getDate() + 3);
      const items = await BC.api.plannerItems(start.toISOString(), end.toISOString());
      const leadMinutes = settings.notifications.leadMinutes || [60, 240, 1440];
      const now = Date.now();
      for (const it of items) {
        const dueISO = it.plannable_date || (it.plannable && it.plannable.due_at);
        if (!dueISO) continue;
        if (it.planner_override && it.planner_override.marked_complete) continue;
        const diff = new Date(dueISO).getTime() - now;
        if (diff <= 0) continue;
        const min = Math.floor(diff / 60000);
        for (const lead of leadMinutes) {
          if (Math.abs(min - lead) < 6) {
            const title = (it.plannable && it.plannable.title) || "Assignment";
            const url = it.html_url || (it.plannable && it.plannable.html_url) || "";
            const key = "due:" + (it.plannable_id || (it.plannable && it.plannable.id)) + ":" + lead;
            fire(settings.notifications, {
              title: "Due " + BC.dt.relative(dueISO),
              message: title + (it.context_name ? " · " + it.context_name : ""),
              url,
              key,
              type: "dueSoon",
            });
          }
        }
      }
    } catch (_) {}
  }

  async function scanGoals(settings) {
    if (!shouldNotify(settings.notifications, "goalBreach")) return;
    try {
      const list = await BC.api.coursesWithScores();
      for (const c of list) {
        const goal = ((settings.grades.goals || {})[String(c.id)] || {}).target;
        if (goal == null) continue;
        const enr = (c.enrollments || [])[0] || {};
        const s = enr.computed_current_score;
        if (s == null) continue;
        if (s < goal) {
          const key = "goal:" + c.id + ":" + new Date().toISOString().slice(0, 10);
          fire(settings.notifications, {
            title: "Grade below goal",
            message: `${c.name}: ${s.toFixed(1)}% (target ${goal}%)`,
            url: "/courses/" + c.id + "/grades",
            key,
            type: "goalBreach",
          });
        }
      }
    } catch (_) {}
  }

  function apply(settings) {
    if (!settings.notifications || (!settings.notifications.enabled && !settings.notifications.inPage)) return;
    if (started) return;
    started = true;
    if (settings.notifications.enabled && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    // Kick off scans and repeat
    scanDueSoon(settings); scanGoals(settings);
    BC.alarms.every("bc-notif-due", 5 * 60 * 1000, () => scanDueSoon(BC.storage.current));
    BC.alarms.every("bc-notif-goals", 10 * 60 * 1000, () => scanGoals(BC.storage.current));
  }

  BC.registry.register({ id: "notifications", styles: [], nodes: [], apply });
})();
