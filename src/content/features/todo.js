/*
 * Better Canvas — To Do feature.
 *
 * Three modes (settings.todo.mode):
 *   "default" — leave Canvas's native To Do list alone.
 *   "clean"   — a CSS-only circular restyle of the native list.
 *   "custom"  — hide the native list and render Better Canvas's own planner
 *               widget: a completion ring, week navigation, course filter, a
 *               grouped/checkable task list, and a "New Task" composer.
 *
 * The custom widget reads the user's planner (api.plannerItems) and writes back
 * only the user's own planner overrides / notes (mark complete, add a task).
 * It is mounted just before the native To Do container and re-inserted by the
 * observer if Canvas re-renders the sidebar, so it survives SPA navigation.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};
  const U = BC.util;
  const el = U.el;
  const api = BC.api;

  // ---- circular-checklist restyle of the NATIVE list (mode "clean") --------
  const TODO_CLEAN_CSS = `
.todo-list { list-style:none !important; margin:0 !important; padding:0 !important; }
.todo-list > li.todo, .ToDoSidebarItem {
  position:relative !important; display:flex !important; align-items:flex-start !important;
  gap:10px !important; margin:7px 0 !important; padding:11px 12px 11px 38px !important;
  list-style:none !important; border-radius:12px !important;
  background:var(--bc-d-surface, #ffffff) !important;
  border:1px solid var(--bc-d-border, #e7e7ef) !important;
  box-shadow:0 1px 2px rgba(16,16,31,0.05) !important; transition:border-color .14s; }
.todo-list > li.todo:hover, .ToDoSidebarItem:hover {
  border-color:var(--ic-brand-primary, #5b4ee6) !important; }
.todo-list > li.todo::before, .ToDoSidebarItem::before {
  content:"" !important; position:absolute !important; left:12px !important; top:14px !important;
  width:16px !important; height:16px !important; border-radius:50% !important;
  border:2px solid var(--ic-brand-primary, #5b4ee6) !important; box-sizing:border-box !important;
  transition:background .14s; }
.todo-list > li.todo:hover::before, .ToDoSidebarItem:hover::before {
  background:var(--ic-brand-primary, #5b4ee6) !important;
  box-shadow:inset 0 0 0 2px var(--bc-d-surface,#fff) !important; }
.todo-list .todo-details, .ToDoSidebarItem__Info { padding:0 !important; min-width:0 !important; }
.todo-list .todo-details__title, .ToDoSidebarItem__Title { font-weight:600 !important; line-height:1.3 !important; }
.todo-list-header { margin-bottom:4px !important; }
`;

  // ---- hide the native To Do when the custom widget is active --------------
  const NATIVE_TODO_SEL =
    ".Sidebar__TodoListContainer, .todo-list-header, .todo-list, " +
    "#planner-todosidebar, [data-testid=\"todo-sidebar\"], .planner-todo";
  const HIDE_NATIVE_CSS = NATIVE_TODO_SEL + "{ display:none !important; }\n";

  // ---- styling for the custom widget (light + bc-dark via --bc-d-* vars) ---
  const WIDGET_CSS = `
.bc-todo {
  --bc-todo-accent: var(--ic-brand-primary, #5b4ee6);
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: var(--bc-d-text, #2d3b45);
  background: var(--bc-d-surface, #ffffff);
  border: 1px solid var(--bc-d-border, #e7e7ef);
  border-radius: 14px; padding: 14px 14px 8px; margin: 0 0 14px;
  box-shadow: 0 1px 3px rgba(16,16,31,0.06); box-sizing: border-box;
}
.bc-todo * { box-sizing: border-box; }
.bc-todo-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }
.bc-todo-title { font-size:16px; font-weight:800; letter-spacing:-0.01em; margin:0; }
.bc-todo-week { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:var(--bc-d-faint,#6b7780); }
.bc-todo-nav { border:none; background:none; cursor:pointer; color:inherit; font-size:15px; line-height:1;
  padding:3px 5px; border-radius:6px; }
.bc-todo-nav:hover { background:var(--bc-d-alt, rgba(0,0,0,0.06)); color:var(--bc-todo-accent); }
.bc-todo-range { min-width:96px; text-align:center; }
.bc-todo-filter { width:100%; margin-bottom:12px; }
.bc-todo-select { width:100%; font:inherit; color:inherit; cursor:pointer;
  background:var(--bc-d-input, #f5f5f8); border:1px solid var(--bc-d-border,#dcdce4);
  border-radius:9px; padding:7px 10px; -webkit-appearance:none; appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 11px center; }
.bc-todo-ringwrap { display:flex; justify-content:center; padding:6px 0 14px; }
.bc-todo-ring { position:relative; width:128px; height:128px; }
.bc-todo-ring svg { transform:rotate(-90deg); display:block; }
.bc-todo-ring-track { stroke:var(--bc-d-alt, #ececf2); }
.bc-todo-ring-fill { stroke:var(--bc-todo-accent); stroke-linecap:round; transition:stroke-dashoffset .5s cubic-bezier(.22,1,.36,1); }
.bc-todo-ring-mid { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.bc-todo-ring-pct { font-size:26px; font-weight:800; letter-spacing:-0.02em; }
.bc-todo-ring-sub { font-size:11px; font-weight:700; color:var(--bc-d-faint,#8a8a92); text-transform:uppercase; letter-spacing:.06em; }
.bc-todo-group-label { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.07em;
  color:var(--bc-d-faint,#8a8a92); margin:12px 0 6px; }
.bc-todo-group-label.bc-overdue { color:#e0524c; }
.bc-todo-item { position:relative; display:flex; align-items:flex-start; gap:10px; padding:9px 4px; }
.bc-todo-item + .bc-todo-item { border-top:1px solid var(--bc-d-border,#f0f0f5); }
.bc-todo-check { flex:0 0 auto; width:20px; height:20px; margin-top:1px; border-radius:50%; cursor:pointer;
  border:2px solid var(--bc-todo-accent); background:transparent; padding:0; position:relative; transition:background .14s; }
.bc-todo-check:hover { background:color-mix(in srgb, var(--bc-todo-accent) 18%, transparent); }
.bc-todo-check.bc-done { background:var(--bc-todo-accent); }
.bc-todo-check.bc-done::after { content:""; position:absolute; left:5px; top:2px; width:5px; height:9px;
  border:solid #fff; border-width:0 2px 2px 0; transform:rotate(45deg); }
.bc-todo-body { min-width:0; flex:1 1 auto; }
.bc-todo-link { font-weight:600; color:inherit; text-decoration:none; display:block; line-height:1.3;
  overflow:hidden; text-overflow:ellipsis; }
.bc-todo-link:hover { color:var(--bc-todo-accent); text-decoration:underline; }
.bc-todo-item.bc-done .bc-todo-link { text-decoration:line-through; color:var(--bc-d-faint,#9a9aa6); }
.bc-todo-meta { font-size:12px; color:var(--bc-d-faint,#8a8a92); margin-top:2px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bc-todo-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; vertical-align:middle; }
.bc-todo-empty { text-align:center; color:var(--bc-d-faint,#8a8a92); padding:18px 8px; font-size:13px; }
.bc-todo-new { width:100%; display:flex; align-items:center; justify-content:center; gap:7px; margin:10px 0 4px;
  padding:9px; border:1px dashed var(--bc-d-border,#cfcfda); border-radius:10px; cursor:pointer;
  background:transparent; color:var(--bc-d-faint,#7b7b8c); font:inherit; font-weight:700; }
.bc-todo-new:hover { border-color:var(--bc-todo-accent); color:var(--bc-todo-accent); }
.bc-todo-composer { margin:10px 0 4px; padding:10px; border:1px solid var(--bc-d-border,#e0e0e8);
  border-radius:10px; background:var(--bc-d-alt, #f7f7fb); display:flex; flex-direction:column; gap:7px; }
.bc-todo-composer input, .bc-todo-composer select { font:inherit; color:inherit; padding:7px 9px;
  border:1px solid var(--bc-d-border,#dcdce4); border-radius:8px; background:var(--bc-d-input,#fff); width:100%; }
.bc-todo-composer-row { display:flex; gap:7px; }
.bc-todo-composer-row > * { flex:1 1 auto; min-width:0; }
.bc-todo-composer-actions { display:flex; justify-content:flex-end; gap:7px; }
.bc-todo-btn { font:inherit; font-weight:700; font-size:13px; cursor:pointer; padding:6px 13px; border-radius:8px;
  border:1px solid var(--bc-d-border,#dcdce4); background:var(--bc-d-input,#fff); color:inherit; }
.bc-todo-btn--primary { background:var(--bc-todo-accent); color:#fff; border-color:transparent; }
.bc-todo-btn--primary:hover { filter:brightness(1.07); }
`;

  // ---- date helpers --------------------------------------------------------
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function ymd(d) {
    const x = new Date(d);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }
  function fmtRange(start, end) {
    const o = { month: "short", day: "numeric" };
    return start.toLocaleDateString(undefined, o) + " – " + addDays(end, -1).toLocaleDateString(undefined, o);
  }
  function dayLabel(d) {
    const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return new Date(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }
  function fmtTime(d) {
    return new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  // ---- planner item normalization -----------------------------------------
  function normalize(raw) {
    return (raw || []).map((it) => {
      const p = it.plannable || {};
      const ov = it.planner_override || null;
      const submitted = !!(it.submissions && it.submissions.submitted);
      const url = it.html_url
        ? (it.html_url.startsWith("http") ? it.html_url : location.origin + it.html_url)
        : null;
      return {
        type: it.plannable_type,
        plannableId: String(it.plannable_id || p.id || ""),
        title: p.title || p.name || "(untitled)",
        courseId: it.course_id != null ? String(it.course_id) : "",
        courseName: it.context_name || "",
        date: it.plannable_date || p.due_at || p.todo_date || null,
        points: p.points_possible != null ? p.points_possible : null,
        url,
        overrideId: ov ? ov.id : null,
        complete: !!(ov && ov.marked_complete) || submitted,
      };
    }).filter((x) => x.date);
  }

  // ---- module state --------------------------------------------------------
  const ctx = {
    host: null,
    settings: null,
    weekOffset: 0,
    courseFilter: "all",
    items: [],
    loading: false,
    error: false,
    composerOpen: false,
    todoKey: "",
    range: 7,
  };

  function accentColor() {
    const a = ctx.settings && ctx.settings.todo.accent;
    return /^#[0-9a-f]{6}$/i.test(a || "") ? a : null;
  }
  function windowStart() { return addDays(startOfDay(new Date()), ctx.weekOffset * ctx.range); }

  function nativeTodoSlot() {
    return document.querySelector(".Sidebar__TodoListContainer")
      || document.querySelector("#planner-todosidebar")
      || null;
  }

  // ---- data ----------------------------------------------------------------
  async function loadAndRender() {
    if (ctx.loading) return;
    ctx.loading = true;
    ctx.error = false;
    render();
    const winStart = windowStart();
    const winEnd = addDays(winStart, ctx.range);
    const fetchStart = ctx.weekOffset === 0 ? addDays(winStart, -21) : winStart;
    try {
      ctx.items = normalize(await api.plannerItems(fetchStart.toISOString(), winEnd.toISOString()));
    } catch (e) {
      ctx.error = true;
      U.warn("planner fetch failed", e);
    }
    ctx.loading = false;
    render();
  }

  async function toggleComplete(item, checkEl) {
    const next = !item.complete;
    item.complete = next;
    checkEl.classList.toggle("bc-done", next);
    try {
      const res = await api.setPlannerComplete(item.type, item.plannableId, next, item.overrideId);
      if (res && res.id) item.overrideId = res.id;
    } catch (e) {
      item.complete = !next;
      U.warn("mark complete failed", e);
    }
    render();
  }

  async function submitNote(title, dateStr, courseId) {
    const t = (title || "").trim();
    if (!t) return;
    try {
      await api.createPlannerNote({
        title: t,
        todoDate: new Date(dateStr || Date.now()).toISOString(),
        courseId: courseId || null,
      });
      ctx.composerOpen = false;
      loadAndRender();
    } catch (e) {
      U.warn("create task failed", e);
      window.alert("Couldn't add the task. Open Canvas and make sure you're signed in.");
    }
  }

  // ---- rendering -----------------------------------------------------------
  function courseColor(id) {
    const c = (BC.storage.current && BC.storage.current.dashboard.courses[id]) || {};
    return /^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : "var(--bc-todo-accent)";
  }

  function render() {
    if (!ctx.host) return;
    const acc = accentColor();
    ctx.host.style.setProperty("--bc-todo-accent", acc || "var(--ic-brand-primary, #5b4ee6)");

    const winStart = windowStart();
    const winEnd = addDays(winStart, ctx.range);
    const today = startOfDay(new Date());
    const offset0 = ctx.weekOffset === 0;

    // Header + week navigation.
    const prev = el("button", { class: "bc-todo-nav", type: "button", title: "Previous", text: "‹" });
    const next = el("button", { class: "bc-todo-nav", type: "button", title: "Next", text: "›" });
    prev.addEventListener("click", () => { ctx.weekOffset--; loadAndRender(); });
    next.addEventListener("click", () => { ctx.weekOffset++; loadAndRender(); });
    const head = el("div", { class: "bc-todo-head" }, [
      el("h2", { class: "bc-todo-title", text: "Tasks" }),
      el("div", { class: "bc-todo-week" }, [prev, el("span", { class: "bc-todo-range", text: fmtRange(winStart, winEnd) }), next]),
    ]);

    // Course filter.
    const courseIds = [...new Set(ctx.items.map((i) => i.courseId).filter(Boolean))];
    const nameById = {};
    for (const i of ctx.items) if (i.courseId && !nameById[i.courseId]) nameById[i.courseId] = i.courseName || ("Course " + i.courseId);
    const sel = el("select", { class: "bc-todo-select" });
    sel.appendChild(el("option", { value: "all", text: "All courses" }));
    for (const id of courseIds) sel.appendChild(el("option", { value: id, text: nameById[id] }));
    sel.value = ctx.courseFilter;
    sel.addEventListener("change", () => { ctx.courseFilter = sel.value; render(); });
    const filter = el("div", { class: "bc-todo-filter" }, [sel]);

    // Filter helpers.
    const inCourse = (i) => ctx.courseFilter === "all" || i.courseId === ctx.courseFilter;
    const ringItems = ctx.items.filter((i) => inCourse(i) && new Date(i.date) >= (offset0 ? today : winStart) && new Date(i.date) < winEnd);
    const done = ringItems.filter((i) => i.complete).length;
    const pct = ringItems.length ? Math.round((done / ringItems.length) * 100) : 0;

    // Completion ring.
    const R = 56, C = 2 * Math.PI * R;
    const ring = el("div", { class: "bc-todo-ringwrap" }, [
      el("div", { class: "bc-todo-ring" }, [
        ringSvg(R, C, pct),
        el("div", { class: "bc-todo-ring-mid" }, [
          el("div", { class: "bc-todo-ring-pct", text: pct + "%" }),
          el("div", { class: "bc-todo-ring-sub", text: done + "/" + ringItems.length + " done" }),
        ]),
      ]),
    ]);

    // Task groups.
    const showCompleted = ctx.settings.todo.showCompleted;
    let display = ctx.items.filter((i) => inCourse(i) && (showCompleted || !i.complete));
    display.sort((a, b) => new Date(a.date) - new Date(b.date));
    const overdue = offset0 ? display.filter((i) => new Date(i.date) < today && !i.complete) : [];
    const upcoming = display.filter((i) => new Date(i.date) >= (offset0 ? today : winStart) && new Date(i.date) < winEnd);

    const groups = el("div", { class: "bc-todo-groups" });
    if (ctx.loading) {
      groups.appendChild(el("div", { class: "bc-todo-empty", text: "Loading…" }));
    } else if (ctx.error) {
      groups.appendChild(el("div", { class: "bc-todo-empty", text: "Couldn't load tasks. Sign in to Canvas and try again." }));
    } else if (!overdue.length && !upcoming.length) {
      groups.appendChild(el("div", { class: "bc-todo-empty", text: "Nothing due. You're all caught up." }));
    } else {
      if (overdue.length) {
        groups.appendChild(el("div", { class: "bc-todo-group-label bc-overdue", text: "Overdue" }));
        for (const it of overdue) groups.appendChild(taskRow(it));
      }
      let lastLabel = null;
      for (const it of upcoming) {
        const label = dayLabel(it.date);
        if (label !== lastLabel) {
          groups.appendChild(el("div", { class: "bc-todo-group-label", text: label }));
          lastLabel = label;
        }
        groups.appendChild(taskRow(it));
      }
    }

    // New Task composer.
    const newTaskEl = ctx.settings.todo.allowNewTask ? composer(nameById, courseIds) : null;

    ctx.host.replaceChildren(head, filter, ring, groups);
    if (newTaskEl) ctx.host.appendChild(newTaskEl);
  }

  function ringSvg(R, C, pct) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "128"); svg.setAttribute("height", "128"); svg.setAttribute("viewBox", "0 0 128 128");
    const track = document.createElementNS(svgNS, "circle");
    const fill = document.createElementNS(svgNS, "circle");
    for (const c of [track, fill]) {
      c.setAttribute("cx", "64"); c.setAttribute("cy", "64"); c.setAttribute("r", String(R));
      c.setAttribute("fill", "none"); c.setAttribute("stroke-width", "11");
    }
    track.setAttribute("class", "bc-todo-ring-track");
    fill.setAttribute("class", "bc-todo-ring-fill");
    fill.setAttribute("stroke-dasharray", String(C));
    fill.setAttribute("stroke-dashoffset", String(C * (1 - pct / 100)));
    svg.append(track, fill);
    return svg;
  }

  function taskRow(it) {
    const check = el("button", { class: "bc-todo-check" + (it.complete ? " bc-done" : ""), type: "button", "aria-label": "Toggle complete" });
    check.addEventListener("click", (e) => { e.preventDefault(); toggleComplete(it, check); });
    const title = it.url
      ? el("a", { class: "bc-todo-link", href: it.url, title: it.title, text: it.title })
      : el("span", { class: "bc-todo-link", title: it.title, text: it.title });
    const metaParts = [];
    if (it.courseName) metaParts.push(it.courseName);
    if (it.date) metaParts.push(fmtTime(it.date));
    if (it.points != null) metaParts.push(it.points + " pts");
    const dot = el("span", { class: "bc-todo-dot" });
    dot.style.background = it.courseId ? courseColor(it.courseId) : "var(--bc-todo-accent)";
    const meta = el("div", { class: "bc-todo-meta" }, [dot, document.createTextNode(metaParts.join("  •  "))]);
    return el("div", { class: "bc-todo-item" + (it.complete ? " bc-done" : "") }, [check, el("div", { class: "bc-todo-body" }, [title, meta])]);
  }

  function composer(nameById, courseIds) {
    if (!ctx.composerOpen) {
      const btn = el("button", { class: "bc-todo-new", type: "button" }, [
        el("span", { text: "+" }), el("span", { text: "New Task" }),
      ]);
      btn.addEventListener("click", () => { ctx.composerOpen = true; render(); });
      return btn;
    }
    const titleIn = el("input", { type: "text", placeholder: "Task title" });
    const dateIn = el("input", { type: "date" });
    dateIn.value = ymd(new Date());
    const courseSel = el("select", {});
    courseSel.appendChild(el("option", { value: "", text: "No course" }));
    for (const id of courseIds) courseSel.appendChild(el("option", { value: id, text: nameById[id] }));
    const cancel = el("button", { class: "bc-todo-btn", type: "button", text: "Cancel" });
    const add = el("button", { class: "bc-todo-btn bc-todo-btn--primary", type: "button", text: "Add task" });
    cancel.addEventListener("click", () => { ctx.composerOpen = false; render(); });
    add.addEventListener("click", () => submitNote(titleIn.value, dateIn.value, courseSel.value));
    titleIn.addEventListener("keydown", (e) => { if (e.key === "Enter") submitNote(titleIn.value, dateIn.value, courseSel.value); });
    const box = el("div", { class: "bc-todo-composer" }, [
      titleIn,
      el("div", { class: "bc-todo-composer-row" }, [dateIn, courseSel]),
      el("div", { class: "bc-todo-composer-actions" }, [cancel, add]),
    ]);
    setTimeout(() => titleIn.focus(), 0);
    return box;
  }

  // ---- mount / lifecycle ---------------------------------------------------
  function ensureMounted() {
    const slot = nativeTodoSlot();
    if (!slot) return false;
    if (!ctx.host) {
      ctx.host = el("div", { class: "bc-todo" });
      ctx.host.setAttribute("data-bc-node", "bc-todo-widget");
    }
    if (!ctx.host.isConnected) slot.parentElement.insertBefore(ctx.host, slot);
    return true;
  }

  function teardownWidget() {
    BC.injector.removeNode("bc-todo-widget");
    BC.injector.setStyle("bc-todo-hide", "");
    BC.injector.setStyle("bc-todo-widget-css", "");
    ctx.host = null;
  }

  BC.features.todo = {
    id: "todo",
    apply(settings) {
      const mode = settings.todo.mode;
      BC.injector.setStyle("bc-todo-clean", mode === "clean" ? TODO_CLEAN_CSS : "");

      const active =
        mode === "custom" &&
        settings.dashboard.widgets.todo !== false &&
        !settings.dashboard.hideSidebar;
      if (!active) return teardownWidget();

      BC.injector.setStyle("bc-todo-widget-css", WIDGET_CSS);
      BC.injector.setStyle("bc-todo-hide", HIDE_NATIVE_CSS);

      const firstRun = !ctx.host;
      ctx.settings = settings;
      ctx.range = Math.max(1, settings.todo.rangeDays || 7);
      const key = JSON.stringify(settings.todo);

      if (!ensureMounted()) return; // sidebar not present yet; retry next tick
      if (firstRun) {
        render();
        loadAndRender();
      } else if (key !== ctx.todoKey) {
        // rangeDays change needs a refetch; other tweaks just re-render.
        if (JSON.parse(key).rangeDays !== (ctx.todoKey ? JSON.parse(ctx.todoKey).rangeDays : null)) loadAndRender();
        else render();
      }
      ctx.todoKey = key;
    },
  };
})();
