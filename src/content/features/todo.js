/*
 * Better Canvas — To Do list features.
 * Three modes:
 *  - "default": leave Canvas native list alone.
 *  - "clean":   restyle the native list into rounded cards + circle checks.
 *  - "custom":  replace with the Better Canvas planner widget (ring, week nav,
 *               course filter, groupings, streaks, pomodoro, personal tasks).
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  // Item keys, estimates and schedule times reach HTML attributes below. They
  // come from Canvas payloads and from bcLocal, which the settings Import button
  // lets an arbitrary JSON file populate, so none of it is trusted.
  const esc = (v) => BC.util.escapeHtml(v);

  const CLEAN_CSS = `
    .Sidebar__TodoListContainer, .ToDoSidebar {
      background: var(--bc-surface-2, #fff) !important;
      border-radius: 12px; padding: 12px;
      border: 1px solid var(--bc-border, #e5e7eb) !important;
    }
    .todo-list-header-container h2 { font-size: 14px !important; margin-bottom: 8px !important; }
    .to-do-list li { background: var(--bc-surface-3, #f7fafc) !important;
      border-radius: 10px !important; padding: 8px 10px !important; margin-bottom: 6px !important; border: 0 !important; }
    .to-do-list li a[title="Ignore"] {
      width: 22px !important; height: 22px !important; border: 2px solid var(--bc-accent, #0374b5) !important;
      border-radius: 50% !important; background: transparent !important; text-indent: -9999px; overflow: hidden;
    }
  `;

  const WIDGET_CSS = `
    .bc-todo {
      background: var(--bc-surface-2, #fff);
      border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: 12px; padding: 14px;
      color: var(--bc-text, inherit);
      font: var(--bc-text-md, 14px)/var(--bc-leading-body, 1.4) var(--bc-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    }
    .bc-todo-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .bc-todo-title { font-weight: 700; font-size: 15px; margin: 0; flex: 1; }
    .bc-todo-ring { width: 46px; height: 46px; flex: 0 0 46px; }
    .bc-todo-week { display: flex; align-items: center; gap: 6px; }
    .bc-todo-week button { background: transparent; border: 1px solid var(--bc-border, #e5e7eb); border-radius: 999px; padding: 2px 8px; cursor: pointer; color: inherit; }
    .bc-todo-week button:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); }
    .bc-todo-controls { display: flex; gap: 6px; margin-bottom: 10px; }
    .bc-todo-controls select { padding: 4px 6px; border-radius: 6px; border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit; }
    .bc-todo-day-header { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--bc-muted, #6b7280); margin: 10px 0 6px; }
    .bc-todo-item {
      display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center;
      padding: 8px 10px; border-radius: 10px; background: var(--bc-surface-3, #f7fafc); margin-bottom: 6px;
    }
    /* Tokens rather than opacity: fading already-AA text pushes it below AA. */
    .bc-todo-item.done .bc-todo-name { color: var(--bc-text-subtle, var(--bc-muted, #6b7280)); text-decoration: line-through; }
    .bc-todo-check {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid var(--bc-todo-accent, var(--bc-accent, #0374b5));
      background: transparent; cursor: pointer;
    }
    .bc-todo-check.done { background: var(--bc-todo-accent, var(--bc-accent, #0374b5)); }
    .bc-todo-check.done::after { content: "✓"; color: var(--bc-accent-contrast, #fff); font-size: var(--bc-text-md, 14px); line-height: 20px; display: block; text-align: center; }
    .bc-todo-name { color: inherit; text-decoration: none; }
    .bc-todo-name:hover { text-decoration: underline; }
    .bc-todo-course { font-size: 11px; color: var(--bc-muted, #6b7280); }
    .bc-todo-due { font-size: 11px; color: var(--bc-muted, #6b7280); }
    .bc-todo-actions { display: flex; gap: 4px; }
    .bc-todo-btn { background: transparent; border: 1px solid var(--bc-border, #e5e7eb); border-radius: 6px; padding: 2px 6px; font-size: 11px; cursor: pointer; color: inherit; }
    .bc-todo-btn:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); }
    .bc-todo-new { display: flex; gap: 6px; margin-top: 8px; }
    .bc-todo-new input { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit; }
    .bc-todo-new button { padding: 6px 10px; border-radius: var(--bc-radius-md, 6px); background: var(--bc-accent, #0374b5); color: var(--bc-accent-contrast, #fff); border: 0; cursor: pointer; font: inherit; }
    .bc-todo-empty { color: var(--bc-muted, #6b7280); font-size: 13px; padding: 6px 0; }
    .bc-todo-snoozed { margin-top: var(--bc-space-4, 10px); border-top: 1px solid var(--bc-border, #e5e7eb); padding-top: var(--bc-space-2, 6px); }
    .bc-todo-snoozed > summary { cursor: pointer; font-size: var(--bc-text-xs, 12px); color: var(--bc-muted, #6b7280); }
    .bc-todo-snoozed > summary:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 2px; }
    .bc-todo-snoozed-row { display: flex; align-items: center; gap: var(--bc-space-3, 8px); padding: var(--bc-space-1, 4px) 0; font-size: var(--bc-text-sm, 13px); }
    .bc-todo-snoozed-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bc-todo-snoozed-when { color: var(--bc-text-subtle, var(--bc-muted, #6b7280)); font-size: var(--bc-text-xs, 12px); }
    .bc-todo-wake {
      border: 1px solid var(--bc-border, #e5e7eb); background: var(--bc-surface-3, #f7fafc);
      color: var(--bc-text, #1b2430); border-radius: var(--bc-radius-md, 6px);
      font: inherit; font-size: var(--bc-text-xs, 12px); padding: 1px var(--bc-space-2, 6px); cursor: pointer;
    }
    .bc-todo-wake:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); }
    .bc-todo-tools { display: flex; align-items: center; gap: 8px; padding: 6px 0 0; border-top: 1px dashed var(--bc-border, #e5e7eb); margin-top: 10px; font-size: 12px; }
    .bc-todo-tools button { background: transparent; border: 0; cursor: pointer; color: var(--bc-accent, #0374b5); }
    /* A real button now: it exposes grace/repair state and can repair a broken day. */
    .bc-todo-streak {
      display: inline-flex; align-items: center; gap: 4px; font-weight: 600;
      border: 0; background: transparent; color: inherit; font: inherit;
      cursor: pointer; padding: 2px 4px; border-radius: var(--bc-radius-md, 6px);
    }
    .bc-todo-streak:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); }
    .bc-todo-streak:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 1px; }
    .bc-todo-pom { margin-left: auto; }
    .bc-todo-kanban { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .bc-kan-col { background: var(--bc-surface-3, #f7fafc); border-radius: 8px; padding: 8px; min-height: 120px; }
    .bc-kan-col h4 { margin: 0 0 6px; font-size: 12px; }
    .bc-kan-col.bc-drop { outline: 2px dashed var(--bc-accent, #0374b5); outline-offset: -2px; }
    .bc-todo-kanban .bc-todo-item { cursor: grab; grid-template-columns: 1fr; }
    .bc-todo-kanban .bc-todo-item.bc-dragging { opacity: .4; }
    .bc-todo-pop {
      position: absolute; z-index: 30; width: 260px; padding: 10px;
      background: var(--bc-surface-2, #fff); border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-lg, 10px); box-shadow: var(--bc-shadow-3, 0 8px 24px rgba(0,0,0,.18)); font-size: var(--bc-text-xs, 12px);
    }
    .bc-todo-pop h5 { margin: 0 0 8px; font-size: 12px; }
    .bc-todo-pop label { display: block; margin: 6px 0 2px; color: var(--bc-muted, #6b7280); }
    .bc-todo-pop input, .bc-todo-pop select, .bc-todo-pop textarea {
      width: 100%; box-sizing: border-box; padding: 4px 6px; border-radius: 6px;
      border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit; font-size: 12px;
    }
    .bc-todo-pop .bc-sub { display: flex; gap: 6px; align-items: center; margin: 3px 0; }
    .bc-todo-pop .bc-sub input[type="checkbox"] { width: auto; }
    .bc-todo-pop .bc-sub span.done { text-decoration: line-through; color: var(--bc-text-subtle, var(--bc-muted, #6b7280)); }
    .bc-todo-pop .bc-pop-close { position: absolute; top: 6px; right: 8px; border: 0; background: transparent; cursor: pointer; color: inherit; }
    .bc-todo-tags { font-size: 10px; color: var(--bc-muted, #6b7280); }
    .bc-todo-tags b { font-weight: 600; background: var(--bc-surface-3, #eef2f7); border-radius: 4px; padding: 0 4px; margin-right: 3px; }
    .bc-tb-grid { position: relative; border: 1px solid var(--bc-border, #e5e7eb); border-radius: 8px; overflow: hidden; }
    .bc-tb-hour { display: flex; height: 34px; border-top: 1px solid var(--bc-border, #e5e7eb); }
    .bc-tb-hour:first-child { border-top: 0; }
    .bc-tb-hour em { flex: 0 0 46px; font-style: normal; font-size: 10px; color: var(--bc-muted, #6b7280); padding: 2px 4px; border-right: 1px solid var(--bc-border, #e5e7eb); }
    .bc-tb-hour.bc-drop { background: rgba(3,116,181,.12); }
    .bc-tb-block {
      position: absolute; left: 50px; right: 4px; border-radius: 6px; padding: 2px 6px;
      background: var(--bc-todo-accent, var(--bc-accent, #0374b5)); color: var(--bc-accent-contrast, #fff); font-size: var(--bc-text-2xs, 11px);
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis; cursor: grab;
    }
    .bc-tb-block button { float: right; border: 0; background: transparent; color: inherit; cursor: pointer; padding: 0 2px; }
    .bc-tb-tray { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .bc-tb-tray .bc-tb-chip {
      border: 1px dashed var(--bc-border, #e5e7eb); border-radius: 999px; padding: 2px 10px;
      font-size: 11px; cursor: grab; background: var(--bc-surface-3, #f7fafc);
    }
  `;

  const POM_CSS = `
    .bc-pom-dock {
      position: fixed; right: 18px; bottom: 18px; z-index: var(--bc-z-dock, 2147480000);
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #111);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: 999px;
      box-shadow: var(--bc-shadow-3, 0 8px 24px rgba(0,0,0,.22));
      font: var(--bc-text-sm, 13px)/1.2 var(--bc-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    }
    .bc-pom-dock b { font-variant-numeric: tabular-nums; }
    .bc-pom-dock.bc-break b { color: var(--bc-success, #047857); }
    .bc-pom-dock button { border: 0; background: transparent; cursor: pointer; font-size: 13px; color: inherit; padding: 0 2px; }
    .bc-pom-task { max-width: 140px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--bc-muted, #6b7280); }
    .bc-pom-stats {
      position: fixed; right: 18px; bottom: 64px; z-index: var(--bc-z-popover, 2147481500); width: 200px; padding: 10px;
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #111);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: 10px;
      box-shadow: var(--bc-shadow-3, 0 8px 24px rgba(0,0,0,.22)); font-size: 12px;
    }
  `;

  const HIDE_NATIVE_CSS = `.Sidebar__TodoListContainer, .ToDoSidebar { display: none !important; }`;

  const state = {
    windowStart: null,
    filterCourse: "all",
    items: [],
    lastFetchKey: "",
    fetchedAt: 0,
  };

  // Per-task augmentation moved from settings.todo.local to bcLocal.todo. Every one
  // of these is written on a micro-interaction (star, snooze, drag, subtask tick),
  // and content.js only subscribes to bcSettings — so a settings write there
  // re-applied all ~24 features AND wiped the open settings drawer's DOM mid-typing.
  // bcLocal writes don't trigger applyAll, so each call site re-renders just the
  // widget instead.
  function tlocal() { return (BC.storage.local && BC.storage.local.todo) || {}; }
  function writeTodoLocal(mutator) {
    return BC.storage.updateLocal((d) => { mutator((d.todo = d.todo || {})); });
  }

  function keyForItem(it) {
    if (it.bcVirtual) return "rec:" + it.bcRuleId + ":" + it.bcYmd;
    return (it.plannable_type || "note") + ":" + (it.plannable && it.plannable.id ? it.plannable.id : it.plannable_id || Math.random());
  }

  // RRULE-lite: expand settings.todo.recurring rules into virtual planner items
  // inside [start, end). rule: daily | weekly (days = weekday mask) | monthly (day of month).
  function expandRecurring(settings, start, end) {
    const rules = settings.todo.recurring || [];
    if (!rules.length) return [];
    const doneMap = tlocal().recurringDone || {};
    const out = [];
    for (const r of rules) {
      if (!r || !r.id || !r.title) continue;
      const until = r.until ? new Date(r.until) : null;
      const hm = BC.dt.parseHM(r.at) || { h: 23, m: 59 };
      const cursor = new Date(start);
      for (let i = 0; i < 62 && cursor < end; i++, cursor.setDate(cursor.getDate() + 1)) {
        if (until && cursor > until) break;
        const kind = r.rule || "daily";
        if (kind === "weekly" && Array.isArray(r.days) && r.days.length && !r.days.includes(cursor.getDay())) continue;
        if (kind === "monthly" && cursor.getDate() !== (parseInt(r.day, 10) || 1)) continue;
        const due = new Date(cursor); due.setHours(hm.h, hm.m, 0, 0);
        const ymd = BC.dt.ymd(cursor);
        out.push({
          bcVirtual: true, bcRuleId: r.id, bcYmd: ymd,
          bcDone: !!(doneMap[r.id] && doneMap[r.id][ymd]),
          plannable_type: "bc_recurring",
          plannable: { title: r.title },
          plannable_date: due.toISOString(),
          course_id: r.courseId || null,
          context_name: "Recurring",
          html_url: "",
        });
      }
    }
    return out;
  }

  function ringSVG(pct, accent) {
    const R = 20, C = 2 * Math.PI * R;
    const off = C - Math.round((pct / 100) * C);
    return `<svg class="bc-todo-ring" viewBox="0 0 46 46" aria-label="${pct}% complete">
      <circle cx="23" cy="23" r="${R}" fill="none" stroke="var(--bc-surface-4, rgba(0,0,0,.1))" stroke-width="4"/>
      <circle cx="23" cy="23" r="${R}" fill="none" stroke="${accent}" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"
              transform="rotate(-90 23 23)"/>
      <text x="23" y="27" text-anchor="middle" font-size="12" fill="currentColor" font-weight="700">${pct}%</text>
    </svg>`;
  }

  async function fetchWindow(settings) {
    const days = parseInt(settings.todo.rangeDays, 10) || 7;
    const start = new Date(state.windowStart || Date.now());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + days);
    const key = start.toISOString() + "/" + end.toISOString();
    // TTL, not "fetched once ever". Without it, completing something in Canvas's own
    // To Do list never showed up in the widget for the rest of the session. The
    // underlying BC.api call is cached and de-duplicated, so an expired check is
    // usually a cache hit rather than a request.
    const ttl = (BC.api.TTL && BC.api.TTL.planner) || 30000;
    if (state.lastFetchKey === key && Date.now() - state.fetchedAt < ttl) return state.items;
    state.lastFetchKey = key;
    try {
      const items = await BC.api.plannerItems(start.toISOString(), end.toISOString());
      const merged = (items || []).concat(expandRecurring(settings, start, end));
      merged.sort((a, b) => new Date(a.plannable_date || 0) - new Date(b.plannable_date || 0));
      state.items = merged;
      state.fetchedAt = Date.now();
      return state.items;
    } catch (e) {
      state.lastFetchKey = ""; // allow retry
      throw e;
    }
  }

  function loadAndRender(settings, mount, force) {
    if (!mount.childElementCount && BC.ui) mount.replaceChildren(BC.ui.skeleton(4));
    fetchWindow(settings).then(() => render(settings, mount, force)).catch((e) => {
      BC.util.warn("planner", e);
      if (state.items.length) { render(settings, mount, force); return; }
      mount.dataset.bcSig = "";
      mount.replaceChildren(BC.ui.errorState("Couldn't load your planner.", () => loadAndRender(settings, mount, true)));
    });
  }

  function isComplete(it) {
    if (it.bcVirtual) return !!it.bcDone;
    if (it.planner_override && it.planner_override.marked_complete) return true;
    const s = it.submissions;
    if (s && (s.submitted || s.graded)) return true;
    return false;
  }

  // Complete/uncomplete an item regardless of kind (real planner vs. virtual recurring).
  function setComplete(it, complete, settings, container) {
    if (it.bcVirtual) {
      it.bcDone = complete;
      return writeTodoLocal((L) => {
        const rd = (L.recurringDone = L.recurringDone || {});
        const m = (rd[it.bcRuleId] = rd[it.bcRuleId] || {});
        if (complete) m[it.bcYmd] = true; else delete m[it.bcYmd];
      })
        .then(() => (complete ? recordStreakDay() : null))
        .then(() => render(settings, container, true));
    }
    const override = it.planner_override && it.planner_override.id;
    return BC.api.setPlannerComplete(it.plannable_type, (it.plannable && it.plannable.id) || it.plannable_id, complete, override)
      // Record only on success, so a failed write can't inflate the streak.
      .then(() => (complete ? recordStreakDay() : null))
      .then(() => {
        it.planner_override = it.planner_override || {};
        it.planner_override.marked_complete = complete;
        render(settings, container, true);
      })
      .catch((e) => BC.toast.error("Couldn't update: " + e.message));
  }

  // ---- streaks -------------------------------------------------------------
  // The previous todayStreak() derived the streak from state.items — a 7-day fetch
  // window — while walking back 90 days, so it could never report a real streak, and
  // the advertised grace-days / monthly-repairs settings were read by nothing.
  // Activity has to be RECORDED.
  function recordStreakDay() {
    return BC.storage.updateLocal((d) => {
      const s = (d.streak = d.streak || { days: {}, repairs: {}, repaired: {}, best: 0 });
      const k = BC.dt.ymd(new Date());
      s.days = s.days || {};
      s.days[k] = (s.days[k] || 0) + 1;
      // Bounded: 120 days is more than the walk below ever looks at.
      const keys = Object.keys(s.days).sort();
      while (keys.length > 120) delete s.days[keys.shift()];
    });
  }

  // Grace is DERIVED during the walk rather than persisted — persisting a running
  // "grace used" counter invites drift. Only repairs (a genuine consumable) and the
  // best-ever streak are stored.
  function streakState(settings) {
    const st = (BC.storage.local && BC.storage.local.streak) || {};
    const days = st.days || {};
    const repaired = st.repaired || {};
    const cfg = (settings && settings.todo && settings.todo.streaks) || {};
    const graceAllowed = Math.max(0, cfg.graceDays | 0);
    const repairsAllowed = Math.max(0, cfg.repairsAvailable | 0);
    const month = BC.dt.ymd(new Date()).slice(0, 7);
    const repairsUsed = ((st.repairs || {})[month]) | 0;
    const todayKey = BC.dt.ymd(new Date());

    // Where recorded history begins. Past that point there is no data — which is
    // NOT the same as a missed day. Without this the walk runs off the end into the
    // days before the user ever installed the extension, silently burning grace and
    // inventing a broken streak (so the chip would offer to "repair" a day that
    // predates the install). ymd is YYYY-MM-DD, so string order is date order.
    const known = Object.keys(days).concat(Object.keys(repaired)).sort();
    const earliest = known.length ? known[0] : todayKey;

    let current = 0, graceUsed = 0, brokenGap = null;
    const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < 120; i++) {
      const k = BC.dt.ymd(cursor);
      if (days[k] > 0 || repaired[k]) current++;
      else if (k === todayKey) { /* today isn't a miss until midnight */ }
      else if (k < earliest) break;      // no history here, so not a miss
      else if (graceUsed < graceAllowed) graceUsed++;
      else { brokenGap = k; break; }
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      current,
      best: Math.max(st.best | 0, current),
      graceLeft: Math.max(0, graceAllowed - graceUsed),
      repairsLeft: Math.max(0, repairsAllowed - repairsUsed),
      brokenGap,
      todayActive: days[todayKey] > 0 || !!repaired[todayKey],
    };
  }

  function repairStreak(ymd) {
    const month = BC.dt.ymd(new Date()).slice(0, 7);
    return BC.storage.updateLocal((d) => {
      const s = (d.streak = d.streak || { days: {}, repairs: {}, repaired: {}, best: 0 });
      (s.repaired = s.repaired || {})[ymd] = true;
      s.repairs = s.repairs || {};
      s.repairs[month] = (s.repairs[month] | 0) + 1;
    });
  }

  // Exported so the streak-at-risk notification can reuse the same computation.
  BC.todo = Object.assign(BC.todo || {}, { streakState });

  function ensureMount() {
    const target = document.querySelector(".Sidebar__TodoListContainer, .ToDoSidebar")
      || document.querySelector("#right-side .events_list");
    if (!target) return null;
    return BC.injector.ensureNode("bc-todo-widget", target.parentNode, () => {
      const d = document.createElement("div");
      d.className = "bc-todo";
      target.parentNode.insertBefore(d, target);
      return d;
    });
  }

  function render(settings, container, force) {
    const t = settings.todo;
    const accent = (t.accent && BC.color.isHex(t.accent)) ? t.accent : "";
    if (accent) container.style.setProperty("--bc-todo-accent", accent);
    else container.style.removeProperty("--bc-todo-accent");

    const total = state.items.length;
    const done = state.items.filter(isComplete).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    // Skip observer-tick rebuilds when nothing changed or the user is typing.
    const sig = [state.lastFetchKey, total, done, state.filterCourse, t.rangeDays, t.groupBy,
                 t.view || "", t.showCompleted ? 1 : 0, accent].join("|");
    const ae = document.activeElement;
    const typing = ae && container.contains(ae) && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA");
    const popoverOpen = !!container.querySelector(".bc-todo-pop");
    if (!force && (container.dataset.bcSig === sig || typing || popoverOpen)) return;
    container.dataset.bcSig = sig;

    const start = new Date(state.windowStart || Date.now()); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate() + parseInt(t.rangeDays, 10) - 1);

    container.innerHTML = `
      <div class="bc-todo-head">
        ${t.ring ? ringSVG(pct, accent || "var(--bc-accent, #0374b5)") : ""}
        <h3 class="bc-todo-title">To Do — ${BC.util.escapeHtml(BC.dt.fmtRange(start, end))}</h3>
        <div class="bc-todo-week">
          <button data-nav="prev" title="Previous">‹</button>
          <button data-nav="today" title="Today">Today</button>
          <button data-nav="next" title="Next">›</button>
        </div>
      </div>
      <div class="bc-todo-controls">
        <select class="bc-todo-filter" aria-label="Course filter"></select>
        <select class="bc-todo-range" aria-label="Range">
          <option value="3">3 days</option><option value="7">1 week</option>
          <option value="14">2 weeks</option><option value="30">1 month</option>
        </select>
        <select class="bc-todo-group" aria-label="Group by">
          <option value="day">Group by day</option>
          <option value="course">Group by course</option>
          <option value="priority">Group by priority</option>
          <option value="tag">Group by tag</option>
          <option value="none">No grouping</option>
        </select>
        <select class="bc-todo-view" aria-label="View">
          <option value="list">List</option>
          <option value="kanban">Kanban</option>
          <option value="timeblock">Time-block</option>
        </select>
      </div>
      <div class="bc-todo-list"></div>
      ${t.allowNewTask ? `<div class="bc-todo-new">
        <input placeholder="Add a personal task…" aria-label="New task"/>
        <button>Add</button>
      </div>` : ""}
      <div class="bc-todo-tools">
        ${t.streaks && t.streaks.enabled ? `<button type="button" class="bc-todo-streak" title="Daily task streak">🔥 <span data-streak>0</span> day streak</button>` : ""}
        ${t.pomodoro && t.pomodoro.enabled ? `<button class="bc-todo-pom" data-pom>▶ Pomodoro</button>` : ""}
      </div>
    `;

    // Populate controls
    const filter = container.querySelector(".bc-todo-filter");
    const courses = new Map();
    for (const it of state.items) {
      const cid = it.course_id ? String(it.course_id) : (it.context_type === "Course" ? String(it.context_id) : null);
      const name = it.context_name || (it.plannable && it.plannable.context_name) || (cid ? "Course " + cid : "Personal");
      if (cid && !courses.has(cid)) courses.set(cid, name);
    }
    filter.innerHTML = `<option value="all">All courses</option>` +
      Array.from(courses.entries()).map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("");
    filter.value = state.filterCourse;
    filter.addEventListener("change", () => { state.filterCourse = filter.value; renderList(settings, container); });

    const range = container.querySelector(".bc-todo-range");
    range.value = String(t.rangeDays);
    range.addEventListener("change", () => {
      const v = parseInt(range.value, 10);
      BC.storage.update((d) => { d.todo.rangeDays = v; });
    });

    const group = container.querySelector(".bc-todo-group");
    group.value = t.groupBy || "day";
    group.addEventListener("change", () => BC.storage.update((d) => { d.todo.groupBy = group.value; }));

    const view = container.querySelector(".bc-todo-view");
    view.value = ["list", "kanban", "timeblock"].includes(t.view) ? t.view : "list";
    view.addEventListener("change", () => BC.storage.update((d) => { d.todo.view = view.value; }));

    // Week nav
    container.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const days = parseInt(t.rangeDays, 10) || 7;
        const cur = new Date(state.windowStart || Date.now()); cur.setHours(0,0,0,0);
        if (btn.dataset.nav === "prev") cur.setDate(cur.getDate() - days);
        if (btn.dataset.nav === "next") cur.setDate(cur.getDate() + days);
        if (btn.dataset.nav === "today") { state.windowStart = null; }
        else { state.windowStart = cur.toISOString(); }
        state.lastFetchKey = "";
        loadAndRender(settings, container, true);
      });
    });

    // Streak
    const streakEl = container.querySelector("[data-streak]");
    const streakChip = container.querySelector(".bc-todo-streak");
    if (streakEl) {
      const ss = streakState(settings);
      streakEl.textContent = String(ss.current);
      if (streakChip) {
        streakChip.title = ss.current + "-day streak · best " + ss.best +
          " · " + ss.graceLeft + " grace day" + (ss.graceLeft === 1 ? "" : "s") + " left" +
          " · " + ss.repairsLeft + " repair" + (ss.repairsLeft === 1 ? "" : "s") + " left this month";
        streakChip.onclick = () => {
          if (ss.brokenGap && ss.repairsLeft > 0) {
            if (confirm("Repair your streak for " + ss.brokenGap + "? " + ss.repairsLeft + " repair(s) left this month.")) {
              repairStreak(ss.brokenGap).then(() => render(settings, container, true));
            }
          } else if (ss.brokenGap) {
            BC.toast.info("No streak repairs left this month");
          } else {
            BC.toast.info(streakChip.title);
          }
        };
      }
      // Persist a new personal best, but only when it actually increases.
      const storedBest = ((BC.storage.local && BC.storage.local.streak && BC.storage.local.streak.best) | 0);
      if (ss.current > storedBest) {
        BC.storage.updateLocal((d) => { (d.streak = d.streak || {}).best = ss.current; });
      }
    }

    // Pomodoro launcher
    const pom = container.querySelector("[data-pom]");
    if (pom) pom.addEventListener("click", () => startPomodoro(settings));

    // New task
    const newInp = container.querySelector(".bc-todo-new input");
    const newBtn = container.querySelector(".bc-todo-new button");
    if (newInp && newBtn) {
      const commit = () => {
        const title = newInp.value.trim(); if (!title) return;
        BC.api.createPlannerNote({ title, todoDate: new Date().toISOString() })
          .then(() => { newInp.value = ""; state.lastFetchKey = ""; loadAndRender(settings, container, true); BC.toast.success("Task added"); })
          .catch((e) => BC.toast.error("Couldn't add task: " + e.message));
      };
      newBtn.addEventListener("click", commit);
      newInp.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });
    }

    renderList(settings, container);
  }

  function renderList(settings, container) {
    const t = settings.todo;
    const list = container.querySelector(".bc-todo-list");
    let items = state.items.slice();
    if (state.filterCourse !== "all") {
      items = items.filter((it) => {
        const cid = it.course_id ? String(it.course_id) : (it.context_type === "Course" ? String(it.context_id) : null);
        return cid === state.filterCourse;
      });
    }
    if (!t.showCompleted) items = items.filter((it) => !isComplete(it));

    // Snooze finally does something. The button wrote todo.local.snoozed and
    // toasted "Snoozed until tomorrow", but nothing ever read the map — the item
    // just stayed put.
    const snz = tlocal().snoozed || {};
    const now = Date.now();
    const sleeping = [];
    const expired = [];
    items = items.filter((it) => {
      const at = snz[keyForItem(it)];
      if (!at) return true;
      if (new Date(at).getTime() > now) { sleeping.push(it); return false; }
      expired.push(keyForItem(it));   // woken naturally; drop the key below
      return true;
    });
    // Self-healing: clear expired entries in one batched write so the map can't grow
    // without bound.
    if (expired.length) {
      writeTodoLocal((L) => { for (const k of expired) delete (L.snoozed || {})[k]; });
    }

    if (!items.length && !sleeping.length) { list.innerHTML = `<div class="bc-todo-empty">Nothing due in this window 🎉</div>`; return; }

    if (t.view === "kanban") { renderKanban(list, items, settings, container); return; }
    if (t.view === "timeblock") { renderTimeBlock(list, items, settings, container); return; }

    // Groupings
    const groupBy = t.groupBy || "day";
    const groups = new Map();
    for (const it of items) {
      let key = "Everything else";
      if (groupBy === "day") {
        const d = new Date(it.plannable_date || (it.plannable && it.plannable.due_at) || Date.now());
        key = BC.dt.fmtDay(d);
      } else if (groupBy === "course") key = it.context_name || (it.plannable && it.plannable.context_name) || "Personal";
      else if (groupBy === "priority") {
        const p = (tlocal().priorities || {})[keyForItem(it)] || 3;
        key = "P" + p;
      } else if (groupBy === "tag") {
        const tags = (tlocal().tagsByItem || {})[keyForItem(it)] || [];
        key = tags.length ? tags[0] : "Untagged";
      } else if (groupBy === "none") key = "Tasks";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    }

    let html = "";
    for (const [k, group] of groups) {
      html += `<div class="bc-todo-day-header">${BC.util.escapeHtml(k)}</div>`;
      for (const it of group) html += itemHtml(it, settings);
    }
    // Snoozed items stay reachable via a collapsed <details> — zero JS state, and it
    // makes the snooze reversible instead of a black hole.
    if (sleeping.length) {
      html += `<details class="bc-todo-snoozed"><summary>💤 Snoozed (${sleeping.length})</summary>`;
      for (const it of sleeping) {
        const k = keyForItem(it);
        const title = (it.plannable && it.plannable.title) || it.plannable_type || "Task";
        const until = snz[k] ? BC.dt.fmtDay(new Date(snz[k])) : "";
        html += `<div class="bc-todo-snoozed-row">
          <span class="bc-todo-snoozed-name">${BC.util.escapeHtml(title)}</span>
          <span class="bc-todo-snoozed-when">${BC.util.escapeHtml(until)}</span>
          <button type="button" class="bc-todo-wake" data-wake="${BC.util.escapeHtml(k)}">Wake</button>
        </div>`;
      }
      html += `</details>`;
    }
    list.innerHTML = html;

    list.querySelectorAll(".bc-todo-wake").forEach((el) => {
      el.addEventListener("click", () => {
        const k = el.getAttribute("data-wake");
        writeTodoLocal((L) => { delete (L.snoozed || {})[k]; }).then(() => renderList(settings, container));
      });
    });

    list.querySelectorAll(".bc-todo-check").forEach((el) => {
      el.addEventListener("click", () => {
        const it = state.items[parseInt(el.getAttribute("data-i"), 10)];
        if (it) setComplete(it, !isComplete(it), settings, container);
      });
    });

    list.querySelectorAll(".bc-todo-more").forEach((el) => {
      el.addEventListener("click", () => openDetail(el, el.getAttribute("data-key"), settings, container));
    });

    list.querySelectorAll(".bc-todo-star").forEach((el) => {
      el.addEventListener("click", () => {
        const k = el.getAttribute("data-key");
        writeTodoLocal((L) => { const st = (L.stars = L.stars || {}); st[k] = !st[k]; }).then(() => renderList(settings, container));
      });
    });

    list.querySelectorAll(".bc-todo-snooze").forEach((el) => {
      el.addEventListener("click", () => {
        const k = el.getAttribute("data-key");
        // Tomorrow 08:00 local rather than now+24h: predictable, and snoozing late
        // at night doesn't push the item into the following evening.
        const wake = new Date(); wake.setDate(wake.getDate() + 1); wake.setHours(8, 0, 0, 0);
        writeTodoLocal((L) => { (L.snoozed = L.snoozed || {})[k] = wake.toISOString(); })
          .then(() => renderList(settings, container));
        BC.toast.info("Snoozed until tomorrow");
      });
    });
  }

  function renderKanban(list, items, settings, container) {
    const status = tlocal().status || {};
    const cols = { todo: [], doing: [], done: [] };
    for (const it of items) {
      if (isComplete(it)) cols.done.push(it);
      else if (status[keyForItem(it)] === "doing") cols.doing.push(it);
      else cols.todo.push(it);
    }
    const col = (id, title, arr) =>
      `<div class="bc-kan-col" data-col="${id}"><h4>${title} (${arr.length})</h4>` +
      arr.slice(0, 25).map((it) => itemHtml(it, settings, true)).join("") + `</div>`;
    list.innerHTML = `<div class="bc-todo-kanban">
      ${col("todo", "To do", cols.todo)}
      ${col("doing", "In progress", cols.doing)}
      ${col("done", "Done", cols.done)}
    </div>`;

    // Drag & drop between columns
    list.querySelectorAll(".bc-todo-item").forEach((card) => {
      card.setAttribute("draggable", "true");
      card.addEventListener("dragstart", (e) => {
        card.classList.add("bc-dragging");
        e.dataTransfer.setData("text/plain", card.dataset.i);
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => card.classList.remove("bc-dragging"));
    });
    list.querySelectorAll(".bc-kan-col").forEach((colEl) => {
      colEl.addEventListener("dragover", (e) => { e.preventDefault(); colEl.classList.add("bc-drop"); });
      colEl.addEventListener("dragleave", () => colEl.classList.remove("bc-drop"));
      colEl.addEventListener("drop", (e) => {
        e.preventDefault();
        colEl.classList.remove("bc-drop");
        const it = state.items[parseInt(e.dataTransfer.getData("text/plain"), 10)];
        if (!it) return;
        const target = colEl.dataset.col;
        const key = keyForItem(it);
        writeTodoLocal((L) => {
          const st = (L.status = L.status || {});
          if (target === "doing") st[key] = "doing"; else delete st[key];
        }).then(() => {
          const complete = isComplete(it);
          if (target === "done" && !complete) return setComplete(it, true, settings, container);
          if (target !== "done" && complete) return setComplete(it, false, settings, container);
          render(settings, container, true);
        });
      });
    });

    list.querySelectorAll(".bc-todo-check").forEach((el) => {
      el.addEventListener("click", () => {
        const it = state.items[parseInt(el.getAttribute("data-i"), 10)];
        if (it) setComplete(it, !isComplete(it), settings, container);
      });
    });
  }

  // TB_END is INCLUSIVE: the loop below is `h <= TB_END`, so the 10pm row the
  // grid advertises actually renders. It was exclusive, silently dropping it.
  const TB_START = 7, TB_END = 22, TB_ROW = 34; // 7am to 10pm grid, px per hour

  function renderTimeBlock(list, items, settings, container) {
    const winStart = new Date(state.windowStart || Date.now());
    const today = new Date();
    const day = state.windowStart && BC.dt.startOfDay(winStart) > BC.dt.startOfDay(today) ? winStart : today;
    const ymd = BC.dt.ymd(day);
    const sched = tlocal().scheduled || {};
    const estimates = tlocal().estimates || {};

    const unscheduled = items.filter((it) => !isComplete(it) && !(sched[keyForItem(it)] && sched[keyForItem(it)].ymd === ymd));
    let hours = "";
    for (let h = TB_START; h <= TB_END; h++) {
      const label = (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? "a" : "p");
      hours += `<div class="bc-tb-hour" data-h="${h}"><em>${label}</em></div>`;
    }
    let blocks = "";
    for (const it of items) {
      const key = keyForItem(it);
      const s = sched[key];
      if (!s || s.ymd !== ymd) continue;
      const hm = BC.dt.parseHM(s.start); if (!hm) continue;
      const top = ((hm.h * 60 + hm.m) - TB_START * 60) / 60 * TB_ROW;
      const height = Math.max(((s.dur || 60) / 60) * TB_ROW - 2, 16);
      const title = (it.plannable && it.plannable.title) || it.plannable_title || "Task";
      blocks += `<div class="bc-tb-block" draggable="true" data-key="${esc(key)}" data-i="${state.items.indexOf(it)}"
        style="top:${top}px;height:${height}px" title="${esc(title)} · ${esc(s.start)}">
        <button data-unsched="${esc(key)}" title="Unschedule">×</button>${esc(title)}</div>`;
    }

    list.innerHTML = `
      <div class="bc-todo-day-header">${BC.util.escapeHtml(BC.dt.fmtDay(day))} — drag tasks onto the grid</div>
      <div class="bc-tb-tray">${unscheduled.slice(0, 15).map((it) =>
        `<span class="bc-tb-chip" draggable="true" data-i="${state.items.indexOf(it)}">${BC.util.escapeHtml((it.plannable && it.plannable.title) || it.plannable_title || "Task")}</span>`
      ).join("") || `<span class="bc-todo-empty">Everything is scheduled 🎉</span>`}</div>
      <div class="bc-tb-grid">${hours}${blocks}</div>
    `;

    const saveSlot = (it, h) => {
      const key = keyForItem(it);
      writeTodoLocal((L) => {
        const sc = (L.scheduled = L.scheduled || {});
        sc[key] = { ymd, start: String(h).padStart(2, "0") + ":00", dur: estimates[key] || 60 };
      }).then(() => render(settings, container, true));
    };

    list.querySelectorAll(".bc-tb-chip, .bc-tb-block").forEach((el) => {
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", el.dataset.i);
        e.dataTransfer.effectAllowed = "move";
      });
    });
    list.querySelectorAll(".bc-tb-hour").forEach((row) => {
      row.addEventListener("dragover", (e) => { e.preventDefault(); row.classList.add("bc-drop"); });
      row.addEventListener("dragleave", () => row.classList.remove("bc-drop"));
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("bc-drop");
        const it = state.items[parseInt(e.dataTransfer.getData("text/plain"), 10)];
        if (it) saveSlot(it, parseInt(row.dataset.h, 10));
      });
    });
    list.querySelectorAll("[data-unsched]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeTodoLocal((L) => { delete (L.scheduled || {})[btn.dataset.unsched]; })
          .then(() => render(settings, container, true));
      });
    });
  }

  // Item detail popover: priority, tags, subtasks, note, time estimate.
  function openDetail(anchor, key, settings, container) {
    container.querySelectorAll(".bc-todo-pop").forEach((p) => p.remove());
    const local = tlocal();
    const tags = (local.tagsByItem || {})[key] || [];
    const subs = ((local.subtasks || {})[key] || []).slice();
    const pop = document.createElement("div");
    pop.className = "bc-todo-pop";
    pop.innerHTML = `
      <button class="bc-pop-close" aria-label="Close">✕</button>
      <h5>Task details</h5>
      <label>Priority</label>
      <select data-pri><option value="1">P1 — urgent</option><option value="2">P2</option><option value="3">P3 — normal</option></select>
      <label>Tags (comma-separated)</label>
      <input data-tags value="${BC.util.escapeHtml(tags.join(", "))}" placeholder="reading, exam…">
      <label>Time estimate (minutes)</label>
      <input data-est type="number" min="5" step="5" value="${esc((local.estimates || {})[key] || "")}" placeholder="60">
      <label>Subtasks</label>
      <div data-subs></div>
      <input data-newsub placeholder="Add subtask, press Enter">
      <label>Note</label>
      <textarea data-note rows="2">${BC.util.escapeHtml((local.notes || {})[key] || "")}</textarea>
      <button class="bc-todo-btn" data-pom-task-start style="margin-top:8px">🍅 Start pomodoro on this task</button>
    `;
    container.style.position = "relative";
    container.appendChild(pop);
    const r = anchor.getBoundingClientRect(), cr = container.getBoundingClientRect();
    pop.style.top = (r.bottom - cr.top + 4) + "px";
    pop.style.right = "8px";

    const subsEl = pop.querySelector("[data-subs]");
    function drawSubs() {
      subsEl.innerHTML = subs.map((s, i) =>
        `<div class="bc-sub"><input type="checkbox" data-si="${i}" ${s.done ? "checked" : ""}>
         <span class="${s.done ? "done" : ""}">${BC.util.escapeHtml(s.text)}</span></div>`).join("");
      subsEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
        cb.addEventListener("change", () => {
          subs[parseInt(cb.dataset.si, 10)].done = cb.checked;
          saveSubs(); drawSubs();
        });
      });
    }
    function saveSubs() {
      writeTodoLocal((L) => {
        const m = (L.subtasks = L.subtasks || {});
        m[key] = subs;
      });
    }
    drawSubs();

    const pri = pop.querySelector("[data-pri]");
    pri.value = String((local.priorities || {})[key] || 3);
    pri.addEventListener("change", () => writeTodoLocal((L) => {
      (L.priorities = L.priorities || {})[key] = parseInt(pri.value, 10);
    }));
    pop.querySelector("[data-tags]").addEventListener("change", (e) => {
      const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
      writeTodoLocal((L) => { (L.tagsByItem = L.tagsByItem || {})[key] = arr; });
    });
    pop.querySelector("[data-est]").addEventListener("change", (e) => {
      const v = parseInt(e.target.value, 10);
      writeTodoLocal((L) => {
        const m = (L.estimates = L.estimates || {});
        if (v > 0) m[key] = v; else delete m[key];
      });
    });
    pop.querySelector("[data-note]").addEventListener("change", (e) => {
      writeTodoLocal((L) => { (L.notes = L.notes || {})[key] = e.target.value; });
    });
    pop.querySelector("[data-newsub]").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const text = e.target.value.trim(); if (!text) return;
      subs.push({ text, done: false });
      e.target.value = "";
      saveSubs(); drawSubs();
    });
    pop.querySelector("[data-pom-task-start]").addEventListener("click", () => {
      const it = state.items.find((x) => keyForItem(x) === key);
      const title = it ? ((it.plannable && it.plannable.title) || it.plannable_title || "") : "";
      startPomodoro(settings, title);
      close();
    });
    const close = () => { pop.remove(); render(settings, container, true); };
    pop.querySelector(".bc-pop-close").addEventListener("click", close);
    pop.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  function itemHtml(it, settings, compact) {
    const idx = state.items.indexOf(it);
    const key = keyForItem(it);
    const complete = isComplete(it);
    const local = tlocal();
    const p = (it.plannable && it.plannable.title) || it.plannable_title || "Untitled";
    const url = (it.html_url || (it.plannable && it.plannable.html_url) || "").toString();
    const due = it.plannable_date || (it.plannable && it.plannable.due_at) || null;
    const course = it.context_name || (it.plannable && it.plannable.context_name) || "";
    const starred = (local.stars || {})[key];
    const tags = (local.tagsByItem || {})[key] || [];
    const subs = (local.subtasks || {})[key] || [];
    const subDone = subs.filter((s) => s.done).length;
    const meta = [];
    if (tags.length) meta.push(tags.map((tg) => "<b>" + BC.util.escapeHtml(tg) + "</b>").join(""));
    if (subs.length) meta.push(`☑ ${subDone}/${subs.length}`);
    return `
      <div class="bc-todo-item ${complete ? "done" : ""}" data-key="${esc(key)}" data-i="${idx}">
        <button class="bc-todo-check ${complete ? "done" : ""}" data-i="${idx}" aria-label="Toggle complete"></button>
        <div>
          <a class="bc-todo-name" href="${BC.util.escapeHtml(url)}">${BC.util.escapeHtml(p)}</a>
          <div class="bc-todo-course">${BC.util.escapeHtml(course)}${due ? " · " + BC.util.escapeHtml(BC.dt.dueLabel(due)) : ""}</div>
          ${meta.length ? `<div class="bc-todo-tags">${meta.join(" · ")}</div>` : ""}
        </div>
        ${compact ? "" : `<div class="bc-todo-actions">
          <button class="bc-todo-btn bc-todo-star" data-key="${esc(key)}" title="Star">${starred ? "★" : "☆"}</button>
          <button class="bc-todo-btn bc-todo-snooze" data-key="${esc(key)}" title="Snooze until tomorrow">💤</button>
          <button class="bc-todo-btn bc-todo-more" data-key="${esc(key)}" title="Details">⋯</button>
        </div>`}
      </div>
    `;
  }

  // ------- Pomodoro ---------
  // Timestamp-based state machine persisted in bcLocal.pomodoro, so a running
  // session survives reloads and navigation. Phases: work → short/long break.
  const PHASE_LABEL = { work: "Work", short: "Short break", long: "Long break" };

  // One shared AudioContext, reused. Constructing a new one per beep leaked them:
  // browsers cap a document at roughly six, so after six phase transitions the
  // constructor threw and the timer went permanently silent for the rest of the
  // session with no error surfaced anywhere.
  let audioCtx = null;
  function pomBeep() {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      if (!audioCtx) audioCtx = new Ctor();
      // A context created before any user gesture starts suspended.
      if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = 880;
      // Ramp out instead of cutting the oscillator dead, which clicks.
      g.gain.setValueAtTime(0.08, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      o.start();
      o.stop(audioCtx.currentTime + 0.3);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (_) {} };
    } catch (_) {}
  }

  function phaseMinutes(cfg, phase) {
    if (phase === "short") return cfg.shortBreakMin || 5;
    if (phase === "long") return cfg.longBreakMin || 15;
    return cfg.workMin || 25;
  }

  function startPomodoro(settings, taskTitle) {
    const p = (BC.storage.local || {}).pomodoro;
    if (p && p.phase) { stopPomodoro(); return; }
    const cfg = settings.todo.pomodoro || {};
    const min = phaseMinutes(cfg, "work");
    BC.storage.updateLocal((d) => {
      const prev = d.pomodoro || {};
      d.pomodoro = {
        phase: "work", cycle: prev.cycle || 0,
        startedAt: Date.now(), endsAt: Date.now() + min * 60000,
        taskTitle: taskTitle || "", sessions: prev.sessions || [],
      };
    }).then(() => { BC.toast.success(`Pomodoro started · ${min}m`); ensurePomodoroDock(BC.storage.current); });
  }

  function stopPomodoro() {
    stopPomTick();
    BC.storage.updateLocal((d) => {
      if (d.pomodoro) { d.pomodoro.phase = null; d.pomodoro.taskTitle = ""; }
    }).then(() => { BC.injector.removeNode("bc-pom-dock"); BC.toast.info("Pomodoro stopped"); });
  }

  function advancePomodoro(settings) {
    const cfg = (settings.todo && settings.todo.pomodoro) || {};
    BC.storage.updateLocal((d) => {
      const p = d.pomodoro;
      if (!p || !p.phase) return;
      if (p.phase === "work") {
        p.cycle = (p.cycle || 0) + 1;
        (p.sessions = p.sessions || []).push({
          start: p.startedAt, end: Date.now(),
          min: phaseMinutes(cfg, "work"), task: p.taskTitle || "",
        });
        if (p.sessions.length > 200) p.sessions = p.sessions.slice(-200);
        p.phase = p.cycle % (cfg.longEvery || 4) === 0 ? "long" : "short";
      } else {
        p.phase = "work";
      }
      p.startedAt = Date.now();
      p.endsAt = Date.now() + phaseMinutes(cfg, p.phase) * 60000;
    }).then(() => {
      const p = (BC.storage.local || {}).pomodoro;
      if (!p || !p.phase) return;
      if (cfg.sound !== false) pomBeep();
      BC.toast.success(p.phase === "work" ? "Break over — back to work 🍅" : `Pomodoro done! ${PHASE_LABEL[p.phase]} time.`);
    });
  }

  function pomStatsHtml(p) {
    const today = BC.dt.ymd(new Date());
    const sessions = (p.sessions || []).filter((s) => BC.dt.ymd(new Date(s.start)) === today);
    const mins = sessions.reduce((sum, s) => sum + (s.min || 0), 0);
    return `<b>Today</b><br>${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${mins} min focused` +
      (p.taskTitle ? `<br>On: ${BC.util.escapeHtml(p.taskTitle)}` : "");
  }

  let pomTimer = null;
  function stopPomTick() {
    if (pomTimer) { clearInterval(pomTimer); pomTimer = null; }
  }

  // The dock and the toast stack both anchor bottom-right. Publishing the dock's
  // footprint lets the toast host start above it instead of landing on top of it.
  const POM_DOCK_CLEARANCE = "52px";
  function setDockClearance(on) {
    const root = document.documentElement;
    if (on) {
      if (root.style.getPropertyValue("--bc-dock-bottom") !== POM_DOCK_CLEARANCE) {
        root.style.setProperty("--bc-dock-bottom", POM_DOCK_CLEARANCE);
      }
    } else if (root.style.getPropertyValue("--bc-dock-bottom")) {
      root.style.removeProperty("--bc-dock-bottom");
    }
  }

  function ensurePomodoroDock(settings) {
    const p = (BC.storage.local || {}).pomodoro;
    if (!p || !p.phase || !settings || !settings.todo.pomodoro || settings.todo.pomodoro.enabled === false) {
      BC.injector.removeNode("bc-pom-dock");
      setDockClearance(false);
      stopPomTick();
      return;
    }
    setDockClearance(true);
    BC.injector.setStyle("bc-pom-css", POM_CSS);
    const dock = BC.injector.ensureNode("bc-pom-dock", document.body, () => {
      const d = document.createElement("div");
      d.className = "bc-pom-dock";
      d.innerHTML = `<button data-pom-stats title="Stats">🍅</button><b data-pom-time>--:--</b>
        <span data-pom-phase></span><span class="bc-pom-task" data-pom-task></span>
        <button data-pom-skip title="Skip phase">⏭</button><button data-pom-stop title="Stop">✕</button>`;
      document.body.appendChild(d);
      d.querySelector("[data-pom-stop]").addEventListener("click", stopPomodoro);
      d.querySelector("[data-pom-skip]").addEventListener("click", () => advancePomodoro(BC.storage.current));
      d.querySelector("[data-pom-stats]").addEventListener("click", () => {
        const old = document.querySelector(".bc-pom-stats");
        if (old) { old.remove(); return; }
        const cur = (BC.storage.local || {}).pomodoro || {};
        const s = document.createElement("div");
        s.className = "bc-pom-stats";
        s.innerHTML = pomStatsHtml(cur);
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 6000);
      });
      return d;
    });

    // Held by handle rather than marked with once(): the mark was never cleared, so
    // the 1s tick kept running (and querySelector-ing) for the life of the tab long
    // after the timer was stopped.
    if (!pomTimer) {
      pomTimer = BC.lifecycle.bag("todo").interval(() => {
        const cur = (BC.storage.local || {}).pomodoro;
        const el = document.querySelector('[data-bc-node="bc-pom-dock"]');
        if (!cur || !cur.phase) { BC.injector.removeNode("bc-pom-dock"); stopPomTick(); return; }
        if (!el) return;
        const remaining = cur.endsAt - Date.now();
        if (remaining <= 0) { advancePomodoro(BC.storage.current); return; }
        const m = Math.floor(remaining / 60000), s = Math.floor((remaining % 60000) / 1000);
        const timeEl = el.querySelector("[data-pom-time]");
        if (timeEl) timeEl.textContent = m + ":" + String(s).padStart(2, "0");
        const phEl = el.querySelector("[data-pom-phase]");
        if (phEl) phEl.textContent = PHASE_LABEL[cur.phase] || "";
        const taskEl = el.querySelector("[data-pom-task]");
        if (taskEl) taskEl.textContent = cur.taskTitle || "";
        el.classList.toggle("bc-break", cur.phase !== "work");
      }, 1000);
    }
  }

  function apply(settings, ctx) {
    // The pomodoro dock follows the user across every Canvas page.
    ensurePomodoroDock(settings);
    if (ctx.page !== "dashboard") {
      BC.injector.setStyle("bc-todo-clean", "");
      BC.injector.setStyle("bc-todo-widget-css", "");
      BC.injector.setStyle("bc-todo-hide", "");
      BC.injector.removeNode("bc-todo-widget");
      return;
    }
    const t = settings.todo || {};
    if (t.mode === "clean") {
      BC.injector.setStyle("bc-todo-clean", CLEAN_CSS);
      BC.injector.setStyle("bc-todo-widget-css", "");
      BC.injector.setStyle("bc-todo-hide", "");
      BC.injector.removeNode("bc-todo-widget");
    } else if (t.mode === "custom") {
      BC.injector.setStyle("bc-todo-clean", "");
      BC.injector.setStyle("bc-todo-widget-css", WIDGET_CSS);
      BC.injector.setStyle("bc-todo-hide", HIDE_NATIVE_CSS);
      const mount = ensureMount();
      if (mount) loadAndRender(settings, mount);
    } else {
      BC.injector.setStyle("bc-todo-clean", "");
      BC.injector.setStyle("bc-todo-widget-css", "");
      BC.injector.setStyle("bc-todo-hide", "");
      BC.injector.removeNode("bc-todo-widget");
    }
  }

  BC.registry.register({
    id: "todo",
    styles: ["bc-todo-clean", "bc-todo-widget-css", "bc-todo-hide", "bc-pom-css"],
    nodes: ["bc-todo-widget", "bc-pom-dock"],
    apply,
    unmount() {
      // The bag clear already killed the interval; null the handle so a re-enable
      // starts a fresh one instead of assuming one is still live.
      pomTimer = null;
      setDockClearance(false);
      state.lastFetchKey = "";
      state.fetchedAt = 0;
      state.items = [];
    },
  });
})();
