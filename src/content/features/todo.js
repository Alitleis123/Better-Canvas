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
      font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .bc-todo-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .bc-todo-title { font-weight: 700; font-size: 15px; margin: 0; flex: 1; }
    .bc-todo-ring { width: 46px; height: 46px; flex: 0 0 46px; }
    .bc-todo-week { display: flex; align-items: center; gap: 6px; }
    .bc-todo-week button { background: transparent; border: 1px solid var(--bc-border, #e5e7eb); border-radius: 999px; padding: 2px 8px; cursor: pointer; color: inherit; }
    .bc-todo-week button:hover { background: rgba(0,0,0,.05); }
    .bc-todo-controls { display: flex; gap: 6px; margin-bottom: 10px; }
    .bc-todo-controls select { padding: 4px 6px; border-radius: 6px; border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit; }
    .bc-todo-day-header { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--bc-muted, #6b7280); margin: 10px 0 6px; }
    .bc-todo-item {
      display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center;
      padding: 8px 10px; border-radius: 10px; background: var(--bc-surface-3, #f7fafc); margin-bottom: 6px;
    }
    .bc-todo-item.done .bc-todo-name { opacity: .55; text-decoration: line-through; }
    .bc-todo-check {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid var(--bc-todo-accent, var(--bc-accent, #0374b5));
      background: transparent; cursor: pointer;
    }
    .bc-todo-check.done { background: var(--bc-todo-accent, var(--bc-accent, #0374b5)); }
    .bc-todo-check.done::after { content: "✓"; color: #fff; font-size: 14px; line-height: 20px; display: block; text-align: center; }
    .bc-todo-name { color: inherit; text-decoration: none; }
    .bc-todo-name:hover { text-decoration: underline; }
    .bc-todo-course { font-size: 11px; color: var(--bc-muted, #6b7280); }
    .bc-todo-due { font-size: 11px; color: var(--bc-muted, #6b7280); }
    .bc-todo-actions { display: flex; gap: 4px; }
    .bc-todo-btn { background: transparent; border: 1px solid var(--bc-border, #e5e7eb); border-radius: 6px; padding: 2px 6px; font-size: 11px; cursor: pointer; color: inherit; }
    .bc-todo-btn:hover { background: rgba(0,0,0,.05); }
    .bc-todo-new { display: flex; gap: 6px; margin-top: 8px; }
    .bc-todo-new input { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit; }
    .bc-todo-new button { padding: 6px 10px; border-radius: 6px; background: var(--bc-accent, #0374b5); color: #fff; border: 0; cursor: pointer; }
    .bc-todo-empty { color: var(--bc-muted, #6b7280); font-size: 13px; padding: 6px 0; }
    .bc-todo-tools { display: flex; align-items: center; gap: 8px; padding: 6px 0 0; border-top: 1px dashed var(--bc-border, #e5e7eb); margin-top: 10px; font-size: 12px; }
    .bc-todo-tools button { background: transparent; border: 0; cursor: pointer; color: var(--bc-accent, #0374b5); }
    .bc-todo-streak { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
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
      border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.18); font-size: 12px;
    }
    .bc-todo-pop h5 { margin: 0 0 8px; font-size: 12px; }
    .bc-todo-pop label { display: block; margin: 6px 0 2px; color: var(--bc-muted, #6b7280); }
    .bc-todo-pop input, .bc-todo-pop select, .bc-todo-pop textarea {
      width: 100%; box-sizing: border-box; padding: 4px 6px; border-radius: 6px;
      border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit; font-size: 12px;
    }
    .bc-todo-pop .bc-sub { display: flex; gap: 6px; align-items: center; margin: 3px 0; }
    .bc-todo-pop .bc-sub input[type="checkbox"] { width: auto; }
    .bc-todo-pop .bc-sub span.done { text-decoration: line-through; opacity: .55; }
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
      background: var(--bc-todo-accent, var(--bc-accent, #0374b5)); color: #fff; font-size: 11px;
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis; cursor: grab;
    }
    .bc-tb-block button { float: right; border: 0; background: transparent; color: #fff; cursor: pointer; padding: 0 2px; }
    .bc-tb-tray { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .bc-tb-tray .bc-tb-chip {
      border: 1px dashed var(--bc-border, #e5e7eb); border-radius: 999px; padding: 2px 10px;
      font-size: 11px; cursor: grab; background: var(--bc-surface-3, #f7fafc);
    }
  `;

  const POM_CSS = `
    .bc-pom-dock {
      position: fixed; right: 18px; bottom: 18px; z-index: 9999;
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #111);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: 999px;
      box-shadow: 0 8px 24px rgba(0,0,0,.22);
      font: 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .bc-pom-dock b { font-variant-numeric: tabular-nums; }
    .bc-pom-dock.bc-break b { color: #059669; }
    .bc-pom-dock button { border: 0; background: transparent; cursor: pointer; font-size: 13px; color: inherit; padding: 0 2px; }
    .bc-pom-task { max-width: 140px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--bc-muted, #6b7280); }
    .bc-pom-stats {
      position: fixed; right: 18px; bottom: 64px; z-index: 9999; width: 200px; padding: 10px;
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #111);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.22); font-size: 12px;
    }
  `;

  const HIDE_NATIVE_CSS = `.Sidebar__TodoListContainer, .ToDoSidebar { display: none !important; }`;

  const state = {
    windowStart: null,
    filterCourse: "all",
    items: [],
    lastFetchKey: "",
  };

  function keyForItem(it) {
    if (it.bcVirtual) return "rec:" + it.bcRuleId + ":" + it.bcYmd;
    return (it.plannable_type || "note") + ":" + (it.plannable && it.plannable.id ? it.plannable.id : it.plannable_id || Math.random());
  }

  // RRULE-lite: expand settings.todo.recurring rules into virtual planner items
  // inside [start, end). rule: daily | weekly (days = weekday mask) | monthly (day of month).
  function expandRecurring(settings, start, end) {
    const rules = settings.todo.recurring || [];
    if (!rules.length) return [];
    const doneMap = (settings.todo.local && settings.todo.local.recurringDone) || {};
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

  function courseColorMap() {
    const map = new Map();
    document.querySelectorAll(".ic-DashboardCard").forEach((card) => {
      const link = card.querySelector("a.ic-DashboardCard__link");
      const cid = link && BC.util.courseIdFromHref(link.getAttribute("href"));
      const bg = link ? (getComputedStyle(link).background || "").match(/rgb\([^)]+\)/) : null;
      if (cid && bg) map.set(cid, bg[0]);
    });
    return map;
  }

  function ringSVG(pct, accent) {
    const R = 20, C = 2 * Math.PI * R;
    const off = C - Math.round((pct / 100) * C);
    return `<svg class="bc-todo-ring" viewBox="0 0 46 46" aria-label="${pct}% complete">
      <circle cx="23" cy="23" r="${R}" fill="none" stroke="rgba(0,0,0,.1)" stroke-width="4"/>
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
    if (state.lastFetchKey === key) return state.items;
    state.lastFetchKey = key;
    try {
      const items = await BC.api.plannerItems(start.toISOString(), end.toISOString());
      const merged = (items || []).concat(expandRecurring(settings, start, end));
      merged.sort((a, b) => new Date(a.plannable_date || 0) - new Date(b.plannable_date || 0));
      state.items = merged;
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
      return BC.storage.update((d) => {
        const rd = (d.todo.local.recurringDone = d.todo.local.recurringDone || {});
        const m = (rd[it.bcRuleId] = rd[it.bcRuleId] || {});
        if (complete) m[it.bcYmd] = true; else delete m[it.bcYmd];
      }).then(() => render(settings, container, true));
    }
    const override = it.planner_override && it.planner_override.id;
    return BC.api.setPlannerComplete(it.plannable_type, (it.plannable && it.plannable.id) || it.plannable_id, complete, override)
      .then(() => {
        it.planner_override = it.planner_override || {};
        it.planner_override.marked_complete = complete;
        render(settings, container, true);
      })
      .catch((e) => BC.toast.error("Couldn't update: " + e.message));
  }

  function todayStreak(items) {
    // Simple: count consecutive prior days with at least one completed item.
    const doneByDay = new Map();
    for (const it of items) {
      if (!isComplete(it)) continue;
      const d = new Date(it.plannable_date || it.plannable && it.plannable.due_at || it.created_at || Date.now());
      const k = BC.dt.ymd(d);
      doneByDay.set(k, (doneByDay.get(k) || 0) + 1);
    }
    let streak = 0;
    const cursor = new Date(); cursor.setHours(0,0,0,0);
    for (let i = 0; i < 90; i++) {
      const k = BC.dt.ymd(cursor);
      if (doneByDay.has(k)) streak++; else if (i > 0) break;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

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
        ${t.streaks && t.streaks.enabled ? `<span class="bc-todo-streak" title="Daily task streak">🔥 <span data-streak>0</span> day streak</span>` : ""}
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
      Array.from(courses.entries()).map(([id, n]) => `<option value="${id}">${BC.util.escapeHtml(n)}</option>`).join("");
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
    if (streakEl) streakEl.textContent = String(todayStreak(state.items));

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

    if (!items.length) { list.innerHTML = `<div class="bc-todo-empty">Nothing due in this window 🎉</div>`; return; }

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
        const p = (settings.todo.local && settings.todo.local.priorities && settings.todo.local.priorities[keyForItem(it)]) || 3;
        key = "P" + p;
      } else if (groupBy === "tag") {
        const tags = ((settings.todo.local && settings.todo.local.tagsByItem) || {})[keyForItem(it)] || [];
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
    list.innerHTML = html;

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
        BC.storage.update((d) => { d.todo.local.stars[k] = !d.todo.local.stars[k]; }).then(() => renderList(settings, container));
      });
    });

    list.querySelectorAll(".bc-todo-snooze").forEach((el) => {
      el.addEventListener("click", () => {
        const k = el.getAttribute("data-key");
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        BC.storage.update((d) => { d.todo.local.snoozed[k] = tomorrow.toISOString(); });
        BC.toast.info("Snoozed until tomorrow");
      });
    });
  }

  function renderKanban(list, items, settings, container) {
    const status = (settings.todo.local && settings.todo.local.status) || {};
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
        BC.storage.update((d) => {
          const st = (d.todo.local.status = d.todo.local.status || {});
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

  const TB_START = 7, TB_END = 22, TB_ROW = 34; // 7am–10pm grid, px per hour

  function renderTimeBlock(list, items, settings, container) {
    const winStart = new Date(state.windowStart || Date.now());
    const today = new Date();
    const day = state.windowStart && BC.dt.startOfDay(winStart) > BC.dt.startOfDay(today) ? winStart : today;
    const ymd = BC.dt.ymd(day);
    const sched = (settings.todo.local && settings.todo.local.scheduled) || {};
    const estimates = (settings.todo.local && settings.todo.local.estimates) || {};

    const unscheduled = items.filter((it) => !isComplete(it) && !(sched[keyForItem(it)] && sched[keyForItem(it)].ymd === ymd));
    let hours = "";
    for (let h = TB_START; h < TB_END; h++) {
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
      blocks += `<div class="bc-tb-block" draggable="true" data-key="${key}" data-i="${state.items.indexOf(it)}"
        style="top:${top}px;height:${height}px" title="${BC.util.escapeHtml(title)} · ${s.start}">
        <button data-unsched="${key}" title="Unschedule">×</button>${BC.util.escapeHtml(title)}</div>`;
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
      BC.storage.update((d) => {
        const sc = (d.todo.local.scheduled = d.todo.local.scheduled || {});
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
        BC.storage.update((d) => { delete (d.todo.local.scheduled || {})[btn.dataset.unsched]; })
          .then(() => render(settings, container, true));
      });
    });
  }

  // Item detail popover: priority, tags, subtasks, note, time estimate.
  function openDetail(anchor, key, settings, container) {
    container.querySelectorAll(".bc-todo-pop").forEach((p) => p.remove());
    const local = settings.todo.local || {};
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
      <input data-est type="number" min="5" step="5" value="${(local.estimates || {})[key] || ""}" placeholder="60">
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
      BC.storage.update((d) => {
        const m = (d.todo.local.subtasks = d.todo.local.subtasks || {});
        m[key] = subs;
      });
    }
    drawSubs();

    const pri = pop.querySelector("[data-pri]");
    pri.value = String((local.priorities || {})[key] || 3);
    pri.addEventListener("change", () => BC.storage.update((d) => {
      (d.todo.local.priorities = d.todo.local.priorities || {})[key] = parseInt(pri.value, 10);
    }));
    pop.querySelector("[data-tags]").addEventListener("change", (e) => {
      const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
      BC.storage.update((d) => { (d.todo.local.tagsByItem = d.todo.local.tagsByItem || {})[key] = arr; });
    });
    pop.querySelector("[data-est]").addEventListener("change", (e) => {
      const v = parseInt(e.target.value, 10);
      BC.storage.update((d) => {
        const m = (d.todo.local.estimates = d.todo.local.estimates || {});
        if (v > 0) m[key] = v; else delete m[key];
      });
    });
    pop.querySelector("[data-note]").addEventListener("change", (e) => {
      BC.storage.update((d) => { (d.todo.local.notes = d.todo.local.notes || {})[key] = e.target.value; });
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
    const local = settings.todo.local || {};
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
      <div class="bc-todo-item ${complete ? "done" : ""}" data-key="${key}" data-i="${idx}">
        <button class="bc-todo-check ${complete ? "done" : ""}" data-i="${idx}" aria-label="Toggle complete"></button>
        <div>
          <a class="bc-todo-name" href="${BC.util.escapeHtml(url)}">${BC.util.escapeHtml(p)}</a>
          <div class="bc-todo-course">${BC.util.escapeHtml(course)}${due ? " · " + BC.util.escapeHtml(BC.dt.dueLabel(due)) : ""}</div>
          ${meta.length ? `<div class="bc-todo-tags">${meta.join(" · ")}</div>` : ""}
        </div>
        ${compact ? "" : `<div class="bc-todo-actions">
          <button class="bc-todo-btn bc-todo-star" data-key="${key}" title="Star">${starred ? "★" : "☆"}</button>
          <button class="bc-todo-btn bc-todo-snooze" data-key="${key}" title="Snooze until tomorrow">💤</button>
          <button class="bc-todo-btn bc-todo-more" data-key="${key}" title="Details">⋯</button>
        </div>`}
      </div>
    `;
  }

  // ------- Pomodoro ---------
  // Timestamp-based state machine persisted in bcLocal.pomodoro, so a running
  // session survives reloads and navigation. Phases: work → short/long break.
  const PHASE_LABEL = { work: "Work", short: "Short break", long: "Long break" };

  function pomBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.08;
      o.start(); o.stop(ctx.currentTime + 0.3);
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

  function ensurePomodoroDock(settings) {
    const p = (BC.storage.local || {}).pomodoro;
    if (!p || !p.phase || !settings || !settings.todo.pomodoro || settings.todo.pomodoro.enabled === false) {
      BC.injector.removeNode("bc-pom-dock");
      return;
    }
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

    BC.lifecycle.bag("todo").once("pom-tick", () => {
      BC.lifecycle.bag("todo").interval(() => {
        const cur = (BC.storage.local || {}).pomodoro;
        const el = document.querySelector('[data-bc-node="bc-pom-dock"]');
        if (!cur || !cur.phase) { BC.injector.removeNode("bc-pom-dock"); return; }
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
    });
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
  });
})();
