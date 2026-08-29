/*
 * Better Canvas — settings UI.
 * BC.SettingsUI.render(rootEl, adapter) mounts the whole settings surface.
 * The adapter supplies: getState / save / subscribe / getCourses / getGpaData.
 * Used by both the in-page drawer (Shadow-DOM host) and the standalone options page.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const el = (t, a, c) => BC.util.el(t, a, c);
  const h  = (s, a, c) => BC.util.h(s, a, c);
  const esc = (x) => BC.util.escapeHtml(x);

  BC.SettingsUI = {
    render(root, adapter) {
      root.innerHTML = "";
      const store = BC.SettingsState.create(adapter);
      const S = BC.SettingsComponents;
      // Drop any bindings from a previous mount (the drawer can be re-mounted if
      // its host is ever disconnected). Stale entries would prune themselves via
      // isConnected anyway, but starting clean keeps the list bounded.
      S.bindings.reset();

      // -- shell ------------------------------------------------------------
      const app = h("div.bc-app", null);
      root.appendChild(app);
      app.appendChild(el("style", null, CSS));

      const undoBtn = S.button({ label: "Undo", onClick: () => store.undo() });
      const redoBtn = S.button({ label: "Redo", onClick: () => store.redo() });

      const header = h("header.bc-header", null, [
        h("div.bc-brand", null, [
          h("span.bc-logo", null, "BC"),
          h("div", null, [h("div.bc-brand-name", null, "Better Canvas"), h("div.bc-brand-sub", null, "v" + (BC.VERSION || ""))]),
        ]),
        h("div.bc-header-actions", null, [
          searchInput(store, (q) => applySearch(q)),
          undoBtn,
          redoBtn,
        ]),
      ]);
      app.appendChild(header);

      const masterInput = el("input", {
        type: "checkbox", checked: !!store.get().enabled,
        onchange: (e) => store.set((d) => { d.enabled = e.target.checked; }),
      });
      const bar = h("div.bc-topbar", null, [
        h("label.bc-master", null, [
          masterInput,
          h("span", null, "Enable Better Canvas"),
        ]),
        h("div.bc-topbar-right", null, [
          S.button({ label: "Import", onClick: () => importFlow(store) }),
          S.button({ label: "Export", onClick: () => exportFlow(store) }),
          S.button({ label: "Reset",  variant: "danger", onClick: () => { if (confirm("Reset all settings to defaults?")) store.reset(); } }),
        ]),
      ]);
      app.appendChild(bar);

      const shell = h("div.bc-shell", null);
      const nav   = h("nav.bc-nav", null);
      const body  = h("main.bc-body", null);
      shell.appendChild(nav); shell.appendChild(body);
      app.appendChild(shell);

      const TABS = [
        { id: "dashboard",     label: "Dashboard",      icon: "◧", render: renderDashboard },
        { id: "todo",          label: "To Do",          icon: "✓", render: renderTodo },
        { id: "theming",       label: "Appearance",     icon: "◐", render: renderTheming },
        { id: "themes",        label: "Themes",         icon: "❋", render: renderThemes },
        { id: "cosmetics",     label: "Background & CSS", icon: "▦", render: renderCosmetics },
        { id: "navigation",    label: "Navigation",     icon: "≡", render: renderNavigation },
        { id: "grades",        label: "Grades & GPA",   icon: "%", render: renderGrades },
        { id: "notifications", label: "Notifications",  icon: "☖", render: renderNotifications },
        { id: "files",         label: "Files",          icon: "▤", render: renderFiles },
        { id: "calendar",      label: "Calendar",       icon: "▩", render: renderCalendar },
        { id: "announcements", label: "Announcements",  icon: "☎", render: renderAnnouncements },
        { id: "productivity",  label: "Productivity",   icon: "⏱", render: renderProductivity },
        { id: "accessibility", label: "Accessibility",  icon: "♿", render: renderA11y },
        { id: "insights",      label: "Insights",       icon: "∿", render: renderInsights },
        { id: "shortcuts",     label: "Shortcuts",      icon: "⌘", render: renderShortcuts },
        { id: "instructor",    label: "Instructor",     icon: "⚑", render: renderInstructor },
        { id: "about",         label: "About",          icon: "ⓘ", render: renderAbout },
      ];

      let active = "dashboard";
      let searchQuery = "";

      // The nav is built ONCE, outside showTab, so neither a tab switch nor a
      // state change rebuilds it (which is what kept resetting the responsive
      // horizontal nav's scroll position).
      const tabBtns = new Map();
      for (const t of TABS) {
        const btn = h("button.bc-tab", { type: "button", onclick: () => showTab(t.id) },
          [h("span.bc-tab-ic", null, t.icon), t.label]);
        tabBtns.set(t.id, btn);
        nav.appendChild(btn);
      }

      function showTab(id) {
        active = id;
        for (const [tid, b] of tabBtns) b.classList.toggle("active", tid === active);
        const tab = TABS.find((t) => t.id === active) || TABS[0];
        // Controls in the outgoing tab detach here; C.bindings.sync prunes them
        // lazily on its next pass via isConnected, so there's nothing to unwire.
        body.replaceChildren(tab.render(store, adapter, { searchQuery }));
        applySearch(searchQuery);
      }

      // Filters rows in the CURRENT tab by visible text. Purely presentational, so
      // it needs no cooperation from any tab renderer.
      function applySearch(q) {
        searchQuery = q || "";
        const query = searchQuery.trim().toLowerCase();
        for (const row of body.querySelectorAll(".bc-row")) {
          row.classList.toggle("bc-hidden", !!query && !(row.textContent || "").toLowerCase().includes(query));
        }
        for (const sec of body.querySelectorAll(".bc-section")) {
          const anyVisible = !!sec.querySelector(".bc-row:not(.bc-hidden)");
          sec.classList.toggle("bc-hidden", !!query && !anyVisible);
        }
      }

      store.subscribe((state, kind) => {
        // Targeted: each mounted control re-reads the store and writes only what
        // differs, so the control the user is touching is never destroyed. This is
        // what lets the toggle animate, the caret survive, and a drag continue.
        S.bindings.sync(state);
        if (masterInput.checked !== !!state.enabled) masterInput.checked = !!state.enabled;
        undoBtn.disabled = !store.canUndo();
        redoBtn.disabled = !store.canRedo();
        // Wholesale replacement (reset / import / undo / redo / external change)
        // can alter anything including list lengths, so rebuild — but preserve
        // scroll, which the old unconditional rebuild always dropped to the top.
        if (kind === "structural") {
          const scroller = root.scrollHeight > root.clientHeight
            ? root : (document.scrollingElement || document.documentElement);
          const top = scroller.scrollTop;
          showTab(active);
          scroller.scrollTop = top;
        }
      });

      undoBtn.disabled = !store.canUndo();
      redoBtn.disabled = !store.canRedo();
      showTab(active);
      return store;
    },
  };

  // ============ TABS =====================================================

  function renderDashboard(store, adapter) {
    const S = BC.SettingsComponents;
    const s = store.get();
    const d = s.dashboard;

    const container = h("div.bc-tab-body", null);
    container.appendChild(S.section({
      title: "General",
      children: [
        S.row({ label: "Customize dashboard", control: S.switch({ get: () => d.enabled, set: (v) => store.set((x) => { x.dashboard.enabled = v; }) }) }),
        S.row({ label: "Hide concluded courses", hint: "Fetched from Canvas on demand.",
          control: S.switch({ get: () => d.autoHideConcluded, set: (v) => store.set((x) => { x.dashboard.autoHideConcluded = v; }) }) }),
        S.row({ label: "Layout",
          control: S.select({ get: () => d.layout, set: (v) => store.set((x) => { x.dashboard.layout = v; }),
            options: [{value:"grid",label:"Grid"},{value:"list",label:"List"},{value:"masonry",label:"Masonry"},{value:"compact",label:"Compact"}] }) }),
        S.row({ label: "Card size",
          control: S.select({ get: () => d.cardSize, set: (v) => store.set((x) => { x.dashboard.cardSize = v; }),
            options: [{value:"s",label:"Small"},{value:"m",label:"Medium"},{value:"l",label:"Large"}] }) }),
        S.row({ label: "Card corner radius",
          control: S.slider({ get: () => d.cardRadius, set: (v) => store.set((x) => { x.dashboard.cardRadius = v; }), min:0, max:24, format:(v)=>v+"px" }) }),
        S.row({ label: "Hover lift animation", control: S.switch({ get: () => d.hoverLift, set: (v) => store.set((x) => { x.dashboard.hoverLift = v; }) }) }),
        S.row({ label: "Show inline grade on card", hint:"Requires Canvas grade endpoint access.",
          control: S.switch({ get: () => d.showInlineGrade, set: (v) => store.set((x) => { x.dashboard.showInlineGrade = v; }) }) }),
        S.row({ label: "Show progress bar",  control: S.switch({ get: () => d.showProgressBar, set: (v) => store.set((x) => { x.dashboard.showProgressBar = v; }) }) }),
        S.row({ label: "Show due-count badge", hint: "Items due in the next 24 hours.",
          control: S.switch({ get: () => d.showBadges, set: (v) => store.set((x) => { x.dashboard.showBadges = v; }) }) }),
        S.row({ label: "Show grade sparkline", hint: "Needs a few days of locally recorded grade history.",
          control: S.switch({ get: () => d.showSparkline, set: (v) => store.set((x) => { x.dashboard.showSparkline = v; }) }) }),
        S.row({ label: "Show course search bar", control: S.switch({ get: () => d.courseSearch, set: (v) => store.set((x) => { x.dashboard.courseSearch = v; }) }) }),
        S.row({ label: "Semester progress bar", hint: "Week X of Y · days left, from your term dates.",
          control: S.switch({ get: () => d.semesterProgress, set: (v) => store.set((x) => { x.dashboard.semesterProgress = v; }) }) }),
      ],
    }));

    container.appendChild(S.section({
      title: "Widgets",
      children: [
        S.row({ label: "To Do widget",        control: S.switch({ get: () => d.widgets.todo,           set: (v) => store.set((x) => { x.dashboard.widgets.todo = v; }) }) }),
        S.row({ label: "Coming Up",           control: S.switch({ get: () => d.widgets.comingUp,       set: (v) => store.set((x) => { x.dashboard.widgets.comingUp = v; }) }) }),
        S.row({ label: "Recent Feedback",     control: S.switch({ get: () => d.widgets.recentFeedback, set: (v) => store.set((x) => { x.dashboard.widgets.recentFeedback = v; }) }) }),
        S.row({ label: "GPA card",            control: S.switch({ get: () => d.widgets.gpa,            set: (v) => store.set((x) => { x.dashboard.widgets.gpa = v; }) }) }),
        S.row({ label: "Hide entire right sidebar", control: S.switch({ get: () => d.hideSidebar, set: (v) => store.set((x) => { x.dashboard.hideSidebar = v; }) }) }),
      ],
    }));

    // Course list section — pulls from Canvas via adapter.
    const coursesSection = S.section({
      title: "Courses",
      description: "Reorder by dragging. Rename, recolor, or hide each card. Changes apply live.",
      children: [h("div.bc-course-list", { id: "bc-courses-mount" }, "Loading courses…")],
    });
    container.appendChild(coursesSection);

    // Async course load
    adapter.getCourses && adapter.getCourses().then((courses) => {
      const mount = coursesSection.querySelector("#bc-courses-mount");
      if (!mount || !mount.isConnected) return;   // tab switched away mid-fetch
      renderCourseEditor(mount, store, courses);
    }).catch(() => {
      const mount = coursesSection.querySelector("#bc-courses-mount");
      if (mount) mount.textContent = "Open a Canvas tab to edit courses.";
    });

    return container;
  }

  function renderCourseEditor(mount, store, courses) {
    const S = BC.SettingsComponents;
    mount.innerHTML = "";
    const search = el("input", { type: "search", class: "bc-text", placeholder: "Search courses…" });
    const results = h("div", null);
    function draw() {
      results.innerHTML = "";
      const q = search.value.toLowerCase();
      const filtered = courses.filter((c) => (c.name + " " + c.code).toLowerCase().includes(q));
      const s = store.get();
      const order = (s.dashboard.courseOrder || []).slice();
      // Ensure any new courses appear
      for (const c of filtered) if (!order.includes(c.id)) order.push(c.id);
      const ordered = order.filter((id) => filtered.find((c) => c.id === id)).map((id) => filtered.find((c) => c.id === id));

      const list = S.sortable({
        items: ordered,
        render: (c) => renderCourseRow(store, c),
        onChange: (ids) => store.set((x) => {
          const rest = (x.dashboard.courseOrder || []).filter((id) => !ids.includes(id));
          x.dashboard.courseOrder = ids.concat(rest);
        }),
      });
      results.appendChild(list);

      const bulk = h("div.bc-bulk", null, [
        S.button({ label: "Show all", onClick: () => store.set((x) => { for (const c of courses) { x.dashboard.courses[c.id] = { ...(x.dashboard.courses[c.id] || {}), hidden: false }; } }) }),
        S.button({ label: "Reset colors", onClick: () => store.set((x) => { for (const c of courses) { if (x.dashboard.courses[c.id]) delete x.dashboard.courses[c.id].color; } }) }),
        S.button({ label: "Reset nicknames", onClick: () => store.set((x) => { for (const c of courses) { if (x.dashboard.courses[c.id]) delete x.dashboard.courses[c.id].nickname; } }) }),
      ]);
      results.appendChild(bulk);
    }
    search.addEventListener("input", draw);
    mount.appendChild(search);
    mount.appendChild(results);
    draw();
  }

  function renderCourseRow(store, c) {
    const s = store.get();
    const cur = (s.dashboard.courses && s.dashboard.courses[c.id]) || {};
    const wrap = h("div.bc-course-row", null);
    const swatch = h("span.bc-course-swatch", { style: { background: cur.color || c.color || "#c7d2fe" } });
    const name = el("input", { type: "text", class: "bc-text bc-course-name", placeholder: c.name, value: cur.nickname || "" });
    name.addEventListener("input", () => store.set((x) => { x.dashboard.courses[c.id] = { ...(x.dashboard.courses[c.id] || {}), nickname: name.value }; }));
    const color = el("input", { type: "color", value: cur.color || c.color || "#0374b5" });
    color.addEventListener("input", () => { swatch.style.background = color.value; store.set((x) => { x.dashboard.courses[c.id] = { ...(x.dashboard.courses[c.id] || {}), color: color.value }; }); });
    const hide = el("input", { type: "checkbox", checked: !!cur.hidden });
    hide.addEventListener("change", () => store.set((x) => { x.dashboard.courses[c.id] = { ...(x.dashboard.courses[c.id] || {}), hidden: hide.checked }; }));
    const bg = el("input", { type: "text", class: "bc-text bc-course-bg", placeholder: "background image URL (optional)", value: cur.bgImage || "" });
    bg.addEventListener("input", () => store.set((x) => { x.dashboard.courses[c.id] = { ...(x.dashboard.courses[c.id] || {}), bgImage: bg.value.trim() }; }));

    wrap.appendChild(swatch);
    wrap.appendChild(name);
    wrap.appendChild(color);
    wrap.appendChild(h("label.bc-mini-check", null, [hide, "Hide"]));
    wrap.appendChild(bg);
    return wrap;
  }

  function renderTodo(store) {
    const S = BC.SettingsComponents;
    const t = store.get().todo;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Mode", children: [
      S.row({ label: "To Do list style", hint: "Canvas default, a clean restyle, or the Better Canvas planner.",
        control: S.select({ get: () => t.mode, set: (v) => store.set((x) => { x.todo.mode = v; }),
          options: [{value:"default",label:"Canvas default"},{value:"clean",label:"Clean circles"},{value:"custom",label:"Planner widget"}] }) }),
    ]}));

    c.appendChild(S.section({ title: "Planner widget", description: "Only applies when mode is Planner widget.", children: [
      S.row({ label: "View",
        control: S.select({ get: () => t.view, set: (v) => store.set((x) => { x.todo.view = v; }),
          // "Day" and "Week" were selectable but todo.js only ever rendered
          // list/kanban/timeblock, so picking them silently fell back to List.
          options: [{value:"list",label:"List"},{value:"kanban",label:"Kanban"},{value:"timeblock",label:"Time-block"}] }) }),
      S.row({ label: "Look-ahead window",
        control: S.select({ get: () => String(t.rangeDays), set: (v) => store.set((x) => { x.todo.rangeDays = parseInt(v, 10); }),
          options: [{value:"3",label:"3 days"},{value:"7",label:"1 week"},{value:"14",label:"2 weeks"},{value:"30",label:"1 month"}] }) }),
      S.row({ label: "Group tasks by",
        control: S.select({ get: () => t.groupBy, set: (v) => store.set((x) => { x.todo.groupBy = v; }),
          options: [{value:"day",label:"Day"},{value:"course",label:"Course"},{value:"priority",label:"Priority"},{value:"tag",label:"Tag"},{value:"none",label:"None"}] }) }),
      S.row({ label: "Show weekly progress ring", control: S.switch({ get: () => t.ring, set: (v) => store.set((x) => { x.todo.ring = v; }) }) }),
      S.row({ label: "Show completed", control: S.switch({ get: () => t.showCompleted, set: (v) => store.set((x) => { x.todo.showCompleted = v; }) }) }),
      S.row({ label: "Show New Task composer", control: S.switch({ get: () => t.allowNewTask, set: (v) => store.set((x) => { x.todo.allowNewTask = v; }) }) }),
      S.row({ label: "Ring accent color", control: S.color({ get: () => t.accent, set: (v) => store.set((x) => { x.todo.accent = v; }), allowEmpty: true }) }),
    ]}));

    c.appendChild(S.section({ title: "Streaks", children: [
      S.row({ label: "Track a daily streak", control: S.switch({ get: () => t.streaks.enabled, set: (v) => store.set((x) => { x.todo.streaks.enabled = v; }) }) }),
      S.row({ label: "Grace days", hint: "Missed days you can skip without breaking your streak.",
        control: S.number({ get: () => t.streaks.graceDays, set: (v) => store.set((x) => { x.todo.streaks.graceDays = Math.max(0, v|0); }), min:0, max:14 }) }),
      S.row({ label: "Repairs per month", control: S.number({ get: () => t.streaks.repairsAvailable, set: (v) => store.set((x) => { x.todo.streaks.repairsAvailable = Math.max(0, v|0); }), min:0, max:31 }) }),
    ]}));

    c.appendChild(S.section({ title: "Pomodoro", children: [
      S.row({ label: "Enable Pomodoro", control: S.switch({ get: () => t.pomodoro.enabled, set: (v) => store.set((x) => { x.todo.pomodoro.enabled = v; }) }) }),
      S.row({ label: "Work minutes",       control: S.number({ get: () => t.pomodoro.workMin, set: (v) => store.set((x) => { x.todo.pomodoro.workMin = Math.max(1, v|0); }), min:1, max:180 }) }),
      S.row({ label: "Short break",        control: S.number({ get: () => t.pomodoro.shortBreakMin, set: (v) => store.set((x) => { x.todo.pomodoro.shortBreakMin = Math.max(1, v|0); }), min:1, max:60 }) }),
      S.row({ label: "Long break",         control: S.number({ get: () => t.pomodoro.longBreakMin,  set: (v) => store.set((x) => { x.todo.pomodoro.longBreakMin  = Math.max(1, v|0); }), min:1, max:120 }) }),
      S.row({ label: "Long break every N pomodoros", control: S.number({ get: () => t.pomodoro.longEvery, set: (v) => store.set((x) => { x.todo.pomodoro.longEvery = Math.max(1, v|0); }), min:1, max:12 }) }),
      S.row({ label: "Sound on finish",    control: S.switch({ get: () => t.pomodoro.sound, set: (v) => store.set((x) => { x.todo.pomodoro.sound = v; }) }) }),
    ]}));

    c.appendChild(renderRecurringEditor(store));

    c.appendChild(S.section({ title: "Tags", children: [
      S.row({ label: "Task tags", hint: "Attached to individual tasks via the planner.",
        control: S.tags({ get: () => t.tags, set: (v) => store.set((x) => { x.todo.tags = v; }) }) }),
    ]}));

    return c;
  }

  function renderRecurringEditor(store) {
    const S = BC.SettingsComponents;
    const rules = store.get().todo.recurring || [];
    const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const describe = (r) => {
      let s = r.rule === "weekly"
        ? "Weekly" + ((r.days || []).length ? " · " + r.days.map((d) => WD[d]).join(" ") : "")
        : r.rule === "monthly" ? "Monthly · day " + (r.day || 1) : "Daily";
      if (r.at) s += " · " + r.at;
      if (r.until) s += " · until " + r.until;
      return s;
    };

    const children = rules.map((r) => h("div.bc-rec-row", null, [
      h("div", null, [h("div.bc-rec-title", null, r.title), h("div.bc-rec-meta", null, describe(r))]),
      S.button({ label: "Delete", variant: "danger",
        onClick: () => store.set((x) => { x.todo.recurring = (x.todo.recurring || []).filter((q) => q.id !== r.id); }) }),
    ]));
    if (!rules.length) children.push(h("p.bc-hint", null, "No recurring tasks yet. They show up in the Planner widget alongside Canvas items."));

    const title = el("input", { type: "text", class: "bc-text", placeholder: "Task title" });
    const freq = el("select", { class: "bc-select" }, [
      el("option", { value: "daily" }, "Daily"),
      el("option", { value: "weekly" }, "Weekly"),
      el("option", { value: "monthly" }, "Monthly"),
    ]);
    const dayChecks = WD.map((n, i) => {
      const cb = el("input", { type: "checkbox" });
      cb.dataset.day = String(i);
      return h("label.bc-mini-check", null, [cb, n]);
    });
    const daysWrap = h("div.bc-rec-days", null, dayChecks);
    const dom = el("input", { type: "number", class: "bc-number", min: 1, max: 31, value: 1 });
    const domWrap = h("span.bc-inline", null, [h("span.bc-hint", null, "Day of month"), dom]);
    const at = el("input", { type: "time", value: "17:00" });
    const until = el("input", { type: "date", title: "Repeat until (optional)" });
    const sync = () => {
      daysWrap.style.display = freq.value === "weekly" ? "" : "none";
      domWrap.style.display = freq.value === "monthly" ? "" : "none";
    };
    freq.addEventListener("change", sync); sync();

    const add = S.button({ label: "Add recurring task", onClick: () => {
      const t = title.value.trim();
      if (!t) { BC.toast && BC.toast.warn("Enter a task title first"); return; }
      const rule = { id: BC.util.uuid(), title: t, rule: freq.value, at: at.value || "", until: until.value || "" };
      if (freq.value === "weekly")
        rule.days = dayChecks.map((l) => l.querySelector("input")).filter((cb) => cb.checked).map((cb) => parseInt(cb.dataset.day, 10));
      if (freq.value === "monthly") rule.day = parseInt(dom.value, 10) || 1;
      store.set((x) => { x.todo.recurring = (x.todo.recurring || []).concat([rule]); });
    } });

    children.push(h("div.bc-rec-form", null, [
      h("div.bc-inline", null, [title, freq, h("span.bc-hint", null, "Due at"), at]),
      daysWrap,
      h("div.bc-inline", null, [domWrap, h("span.bc-hint", null, "Until"), until, add]),
    ]));

    return S.section({
      title: "Recurring tasks",
      description: "Repeat tasks daily, weekly, or monthly. Stored on this device; each day checks off independently.",
      children,
    });
  }

  // tokens.js falls the SETTINGS surfaces back to a safe neutral when the chosen
  // background can't carry legible text, and deliberately leaves Canvas pages
  // alone. That trade is only defensible if we say so; until now nothing did, so
  // the drawer silently stopped matching the theme with no explanation.
  function contrastNotice(store) {
    const box = h("div.bc-notice", null);
    const sync = () => {
      const g = BC.tokens.resolve(store.get().theming).guard;
      const msgs = [];
      if (g.surfaceFallback) {
        msgs.push("This background is too light for dark mode, so these settings panels " +
                  "use a neutral palette to stay readable. Canvas pages still use your colour.");
      }
      if (g.hierarchyCollapsed) {
        msgs.push("At this background lightness, body text and secondary text can't be told " +
                  "apart while staying readable. Pick a darker or lighter background to get " +
                  "the type hierarchy back.");
      }
      const text = msgs.join(" ");
      if (box.textContent !== text) box.textContent = text;
      box.classList.toggle("bc-hidden", !text);
    };
    sync();
    S_bind(box, sync);
    return box;
  }
  // Components owns the bind registry; this is the one place outside it that needs
  // to register a plain reactive node.
  function S_bind(node, fn) { return BC.SettingsComponents.bindings.add(node, fn); }

  function renderTheming(store) {
    const S = BC.SettingsComponents;
    const t = store.get().theming;
    const c = h("div.bc-tab-body", null);
    c.appendChild(contrastNotice(store));
    c.appendChild(S.section({ title: "Dark mode", children: [
      S.row({ label: "Dark mode",
        control: S.select({ get: () => t.darkMode, set: (v) => store.set((x) => { x.theming.darkMode = v; }),
          options: [{value:"off",label:"Off"},{value:"on",label:"On"},{value:"auto",label:"Auto (system)"},{value:"scheduled",label:"Scheduled"}] }) }),
      S.row({ label: "Schedule",
        control: h("div.bc-inline", null, [
          el("input", { type: "time", value: t.darkSchedule.start, onchange: (e) => store.set((x) => { x.theming.darkSchedule.start = e.target.value; }) }),
          h("span", null, " to "),
          el("input", { type: "time", value: t.darkSchedule.end, onchange: (e) => store.set((x) => { x.theming.darkSchedule.end = e.target.value; }) }),
        ]) }),
      S.row({ label: "Dark tone",
        control: S.select({ get: () => t.darkTone, set: (v) => store.set((x) => { x.theming.darkTone = v; }),
          options: Object.entries(BC.DARK_TONES).map(([k, v]) => ({ value: k, label: v.label })) }) }),
      S.row({ label: "Custom dark background", control: S.color({ get: () => t.darkBg, set: (v) => store.set((x) => { x.theming.darkBg = v; }), allowEmpty: true }) }),
    ]}));

    c.appendChild(S.section({ title: "Light theme", children: [
      S.row({ label: "Light palette",
        control: S.select({ get: () => t.lightPreset, set: (v) => store.set((x) => { x.theming.lightPreset = v; }),
          options: Object.entries(BC.LIGHT_PRESETS).map(([k, v]) => ({ value: k, label: v.label })) }) }),
    ]}));

    c.appendChild(S.section({ title: "Accent & type", children: [
      S.row({ label: "Accent color", hint:"Overrides Canvas's brand accent.",
        control: S.color({ get: () => t.accentColor, set: (v) => store.set((x) => { x.theming.accentColor = v; }), allowEmpty: true }) }),
      S.row({ label: "Font family", hint:"CSS font-family stack, or leave blank for default.",
        control: S.text({ get: () => t.font, set: (v) => store.set((x) => { x.theming.font = v; }), placeholder: "e.g. Inter, system-ui, sans-serif" }) }),
      S.row({ label: "Font size scale",
        control: S.select({ get: () => t.fontSizeScale, set: (v) => store.set((x) => { x.theming.fontSizeScale = v; }),
          options: [{value:"xs",label:"XS"},{value:"s",label:"S"},{value:"m",label:"M"},{value:"l",label:"L"},{value:"xl",label:"XL"}] }) }),
      S.row({ label: "Line height", control: S.slider({ get: () => t.lineHeight, set: (v) => store.set((x) => { x.theming.lineHeight = v; }), min:1.1, max:2.0, step:0.05, format:(v)=>v.toFixed(2) }) }),
      S.row({ label: "Letter spacing", control: S.slider({ get: () => t.letterSpacing, set: (v) => store.set((x) => { x.theming.letterSpacing = v; }), min:-1, max:3, step:0.1, format:(v)=>v.toFixed(1)+"px" }) }),
      S.row({ label: "Density",
        control: S.select({ get: () => t.density, set: (v) => store.set((x) => { x.theming.density = v; }),
          options: [{value:"compact",label:"Compact"},{value:"default",label:"Default"},{value:"spacious",label:"Spacious"},{value:"cozy",label:"Cozy"}] }) }),
      S.row({ label: "Global corner radius", control: S.slider({ get: () => t.radius, set: (v) => store.set((x) => { x.theming.radius = v; }), min:0, max:24, format:(v)=>v+"px" }) }),
      S.row({ label: "Rounded UI",  control: S.switch({ get: () => t.roundedUI, set: (v) => store.set((x) => { x.theming.roundedUI = v; }) }) }),
      S.row({ label: "Sidebar width (px)", hint:"0 = default", control: S.number({ get: () => t.sidebarWidth, set: (v) => store.set((x) => { x.theming.sidebarWidth = Math.max(0, v|0); }), min:0, max:400 }) }),
    ]}));

    c.appendChild(S.section({ title: "Advanced", children: [
      S.row({ label: "Cursor",
        control: S.select({ get: () => t.cursor, set: (v) => store.set((x) => { x.theming.cursor = v; }),
          options: [{value:"default",label:"Default"},{value:"large",label:"Large"},{value:"precise",label:"Precise crosshair"}] }) }),
      S.row({ label: "Focus ring",
        control: S.select({ get: () => t.focusRing, set: (v) => store.set((x) => { x.theming.focusRing = v; }),
          options: [{value:"default",label:"Default"},{value:"bold",label:"Bold"},{value:"high-contrast",label:"High contrast"}] }) }),
      S.row({ label: "Color-blind mode",
        control: S.select({ get: () => t.colorBlind, set: (v) => store.set((x) => { x.theming.colorBlind = v; }),
          options: [{value:"off",label:"Off"},{value:"protanopia",label:"Protanopia"},{value:"deuteranopia",label:"Deuteranopia"},{value:"tritanopia",label:"Tritanopia"}] }) }),
      S.row({ label: "High contrast",  control: S.switch({ get: () => t.highContrast, set: (v) => store.set((x) => { x.theming.highContrast = v; }) }) }),
      S.row({ label: "Force reduced motion", control: S.switch({ get: () => t.reducedMotion, set: (v) => store.set((x) => { x.theming.reducedMotion = v; }) }) }),
      S.row({ label: "Animation speed", control: S.slider({ get: () => t.animSpeed, set: (v) => store.set((x) => { x.theming.animSpeed = v; }), min:0.25, max:2, step:0.05, format:(v)=>v.toFixed(2)+"×" }) }),
    ]}));

    c.appendChild(S.section({ title: "Institution logo", children: [
      S.row({ label: "Logo",
        control: S.select({ get: () => t.logo.mode, set: (v) => store.set((x) => { x.theming.logo.mode = v; }),
          options: [{value:"default",label:"Default"},{value:"hide",label:"Hide"},{value:"replace",label:"Replace with image"},{value:"text",label:"Replace with text"}] }) }),
      S.row({ label: "Replacement image URL", control: S.text({ get: () => t.logo.url, set: (v) => store.set((x) => { x.theming.logo.url = v; }) }) }),
      S.row({ label: "Replacement text",      control: S.text({ get: () => t.logo.text, set: (v) => store.set((x) => { x.theming.logo.text = v; }) }) }),
    ]}));

    return c;
  }

  function themeSnapshot(store, name) {
    const cur = store.get();
    const theming = JSON.parse(JSON.stringify(cur.theming));
    delete theming.rotation; // rotation config isn't part of a theme's look
    return {
      id: BC.util.uuid(),
      name,
      settings: {
        theming,
        cosmetics: JSON.parse(JSON.stringify(cur.cosmetics)),
      },
    };
  }

  function downloadTheme(bundle) {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (bundle.name || "theme").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".bctheme.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function themeCard(store, p, custom) {
    const card = h("div.bc-theme-card", { tabindex: "0", role: "button", "aria-label": "Apply theme " + p.name });
    const t = (p.settings && p.settings.theming) || {};
    const swatchBg  = t.darkMode === "on"
      ? ((BC.DARK_TONES[t.darkTone] || {}).bg || "#1a1d24")
      : ((BC.LIGHT_PRESETS[t.lightPreset] || {}).bg || "#ffffff");
    const swatchAcc = t.accentColor || "#0374b5";
    card.appendChild(h("div.bc-theme-swatch", { style: { background: swatchBg, borderColor: swatchAcc } }, [h("span", { style: { background: swatchAcc } })]));
    card.appendChild(h("div.bc-theme-name", null, p.name));
    const applyIt = () => { store.applyPreset(p); BC.toast && BC.toast.success("Applied theme: " + p.name); };
    card.addEventListener("click", (e) => { if (e.target.closest && e.target.closest(".bc-theme-actions")) return; applyIt(); });
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); applyIt(); } });
    if (custom) {
      card.appendChild(h("div.bc-theme-actions", null, [
        el("button", { type: "button", class: "bc-btn", onclick: (e) => { e.stopPropagation(); downloadTheme(p); } }, "Export"),
        el("button", { type: "button", class: "bc-btn bc-btn-danger", onclick: (e) => {
          e.stopPropagation();
          store.set((x) => { x.customThemes = (x.customThemes || []).filter((q) => q.id !== p.id); });
        } }, "Delete"),
      ]));
    }
    return card;
  }

  function renderThemes(store) {
    const S = BC.SettingsComponents;
    const c = h("div.bc-tab-body", null);
    const custom = store.get().customThemes || [];

    const nameInput = el("input", { type: "text", class: "bc-text", placeholder: "Theme name" });
    c.appendChild(S.section({
      title: "My themes",
      description: "Tune colors, fonts, and backgrounds live in the Appearance and Background tabs, then snapshot the look here as a reusable theme.",
      children: [
        custom.length
          ? h("div.bc-theme-grid", null, custom.map((p) => themeCard(store, p, true)))
          : h("p.bc-hint", null, "No saved themes yet. Set up a look you like, name it, and save it."),
        h("div.bc-inline", { style: { marginTop: "10px" } }, [
          nameInput,
          S.button({ label: "Save current look", onClick: () => {
            const name = nameInput.value.trim() || "My theme";
            const bundle = themeSnapshot(store, name);
            store.set((x) => { x.customThemes = (x.customThemes || []).concat([bundle]); });
            BC.toast && BC.toast.success("Saved theme: " + name);
          } }),
        ]),
      ],
    }));

    c.appendChild(S.section({
      title: "Built-in themes",
      description: "One click loads the theme's colors, accent, density, and radius over your current settings.",
      children: [h("div.bc-theme-grid", null, BC.PRESET_THEMES.map((p) => themeCard(store, p, false)))],
    }));

    const rot = store.get().theming.rotation || { enabled: false, mode: "daily", themeIds: [] };
    const pool = custom.concat(BC.PRESET_THEMES || []);
    c.appendChild(S.section({
      title: "Theme rotation",
      description: "Automatically cycle through selected themes every day or week.",
      children: [
        S.row({ label: "Rotate themes", control: S.switch({ get: () => rot.enabled, set: (v) => store.set((x) => { x.theming.rotation.enabled = v; }) }) }),
        S.row({ label: "Rotate every",
          control: S.select({ get: () => rot.mode, set: (v) => store.set((x) => { x.theming.rotation.mode = v; }),
            options: [{ value: "daily", label: "Day" }, { value: "weekly", label: "Week" }] }) }),
        h("div.bc-rot-list", null, pool.map((t) => {
          const cb = el("input", { type: "checkbox", checked: (rot.themeIds || []).includes(t.id), onchange: (e) => store.set((x) => {
            const ids = new Set(x.theming.rotation.themeIds || []);
            if (e.target.checked) ids.add(t.id); else ids.delete(t.id);
            x.theming.rotation.themeIds = Array.from(ids);
          }) });
          return h("label.bc-mini-check", null, [cb, t.name]);
        })),
      ],
    }));

    c.appendChild(S.section({
      title: "Import / export theme",
      description: "Share themes as JSON files — no accounts, no cloud.",
      children: [
        h("div.bc-inline", null, [
          S.button({ label: "Export current theme", onClick: () => downloadTheme(themeSnapshot(store, "My theme")) }),
          S.button({ label: "Import theme", onClick: () => {
            const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json";
            inp.onchange = () => {
              const f = inp.files && inp.files[0]; if (!f) return;
              f.text().then((txt) => {
                try {
                  const j = JSON.parse(txt);
                  if (!j || typeof j !== "object" || !j.settings) throw new Error("bad");
                  const saved = { id: BC.util.uuid(), name: j.name || "Imported theme", settings: j.settings };
                  store.set((x) => { x.customThemes = (x.customThemes || []).concat([saved]); });
                  store.applyPreset(saved);
                  BC.toast && BC.toast.success("Imported theme: " + saved.name);
                } catch { BC.toast && BC.toast.error("Invalid theme file"); }
              });
            };
            inp.click();
          } }),
        ]),
      ],
    }));
    return c;
  }

  function renderCosmetics(store) {
    const S = BC.SettingsComponents;
    const b = store.get().cosmetics.background;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Full-page background", children: [
      S.row({ label: "Background",
        control: S.select({ get: () => b.mode, set: (v) => store.set((x) => { x.cosmetics.background.mode = v; }),
          options: [{value:"none",label:"None"},{value:"color",label:"Solid color"},{value:"gradient",label:"Gradient"},{value:"image",label:"Image"},{value:"pattern",label:"Pattern"}] }) }),
      S.row({ label: "Color", control: S.color({ get: () => b.color, set: (v) => store.set((x) => { x.cosmetics.background.color = v; }) }) }),
      S.row({ label: "Gradient from", control: S.color({ get: () => b.gradient.from, set: (v) => store.set((x) => { x.cosmetics.background.gradient.from = v; }) }) }),
      S.row({ label: "Gradient to",   control: S.color({ get: () => b.gradient.to,   set: (v) => store.set((x) => { x.cosmetics.background.gradient.to   = v; }) }) }),
      S.row({ label: "Gradient angle", control: S.slider({ get: () => b.gradient.angle, set: (v) => store.set((x) => { x.cosmetics.background.gradient.angle = v; }), min:0, max:360, format:(v)=>v+"°" }) }),
      S.row({ label: "Image URL",     control: S.text({ get: () => b.image, set: (v) => store.set((x) => { x.cosmetics.background.image = v; }), placeholder:"https://…" }) }),
      S.row({ label: "Pattern",
        control: S.select({ get: () => b.pattern, set: (v) => store.set((x) => { x.cosmetics.background.pattern = v; }),
          options: [{value:"none",label:"None"},{value:"dots",label:"Dots"},{value:"grid",label:"Grid"},{value:"diagonal",label:"Diagonal"},{value:"topography",label:"Topography"}] }) }),
      S.row({ label: "Blur (px)",     control: S.slider({ get: () => b.blur, set: (v) => store.set((x) => { x.cosmetics.background.blur = v; }), min:0, max:40, format:(v)=>v+"px" }) }),
      S.row({ label: "Opacity",       control: S.slider({ get: () => b.opacity, set: (v) => store.set((x) => { x.cosmetics.background.opacity = v; }), min:0, max:100, format:(v)=>v+"%" }) }),
    ]}));
    c.appendChild(S.section({ title: "Custom CSS", description: "Injected on every Canvas page. Escape hatch — use with care.", children: [
      h("div.bc-css-wrap", null, [
        BC.SettingsComponents.textarea({ get: () => store.get().cosmetics.customCss, set: (v) => store.set((x) => { x.cosmetics.customCss = v; }), placeholder: "/* your CSS */", rows: 10 }),
      ]),
    ]}));
    return c;
  }

  function renderNavigation(store) {
    const S = BC.SettingsComponents;
    const s = store.get();
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Global (left) navigation", description: "Drag to reorder. Toggle to hide.", children: [
      renderNavList(store, "global"),
    ]}));
    c.appendChild(S.section({ title: "Course navigation", description: "Hide / reorder tabs by label across all courses.", children: [
      h("div.bc-nav-course-note", null, "Enter labels you want hidden or a preferred order below."),
      S.row({ label: "Hidden labels (comma-separated)",
        control: S.text({ get: () => (s.navigation.course.hidden || []).join(", "), set: (v) => store.set((x) => { x.navigation.course.hidden = v.split(",").map(s => s.trim().toLowerCase()).filter(Boolean); }) }) }),
      S.row({ label: "Order (comma-separated)",
        control: S.text({ get: () => (s.navigation.course.order || []).join(", "), set: (v) => store.set((x) => { x.navigation.course.order = v.split(",").map(s => s.trim().toLowerCase()).filter(Boolean); }) }) }),
      S.row({ label: "Custom course links (appear on every course sidebar)",
        control: S.links({ get: () => s.navigation.course.customLinks, set: (v) => store.set((x) => { x.navigation.course.customLinks = v; }) }) }),
    ]}));
    c.appendChild(S.section({ title: "Global extras", children: [
      S.row({ label: "Custom global-nav links", control: S.links({ get: () => s.navigation.global.customLinks, set: (v) => store.set((x) => { x.navigation.global.customLinks = v; }) }) }),
      S.row({ label: "Breadcrumbs style",
        control: S.select({ get: () => s.navigation.breadcrumbs, set: (v) => store.set((x) => { x.navigation.breadcrumbs = v; }),
          options: [{value:"default",label:"Default"},{value:"compact",label:"Compact"},{value:"hidden",label:"Hidden"}] }) }),
      S.row({ label: "Course quick-switch tab bar", control: S.switch({ get: () => s.navigation.courseTabs, set: (v) => store.set((x) => { x.navigation.courseTabs = v; }) }) }),
      S.row({ label: "Enable ⌘K quick search",     control: S.switch({ get: () => s.navigation.quickSearch, set: (v) => store.set((x) => { x.navigation.quickSearch = v; }) }) }),
    ]}));
    return c;
  }

  function renderNavList(store, scope) {
    const S = BC.SettingsComponents;
    const s = store.get();
    const hiddenSet = new Set(s.navigation[scope].hidden || []);
    const known = BC.GLOBAL_NAV_ITEMS;
    const orderedKeys = (s.navigation[scope].order && s.navigation[scope].order.length) ? s.navigation[scope].order.slice() : known.map((k) => k.key);
    for (const it of known) if (!orderedKeys.includes(it.key)) orderedKeys.push(it.key);
    const items = orderedKeys.map((k) => known.find((n) => n.key === k) || { key: k, label: k });
    return S.sortable({
      items,
      render: (it) => {
        const row = h("div.bc-navitem", null);
        row.appendChild(h("span.bc-navitem-label", null, it.label));
        const cb = el("input", { type: "checkbox", checked: !hiddenSet.has(it.key) });
        cb.addEventListener("change", () => store.set((x) => {
          const h1 = new Set(x.navigation[scope].hidden || []);
          if (cb.checked) h1.delete(it.key); else h1.add(it.key);
          x.navigation[scope].hidden = Array.from(h1);
        }));
        row.appendChild(h("label.bc-mini-check", null, [cb, "Show"]));
        return row;
      },
      onChange: (ids) => store.set((x) => { x.navigation[scope].order = ids; }),
    });
  }

  function renderGrades(store, adapter) {
    const S = BC.SettingsComponents;
    const g = store.get().grades;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Grade tools", children: [
      S.row({ label: "Show Grade Tools panel", hint: "Adds the goal tracker, final-grade solver and what-if scores to the grades page.",
        control: S.switch({ get: () => g.panelEnabled, set: (v) => store.set((x) => { x.grades.panelEnabled = v; }) }) }),
      S.row({ label: "Auto-refresh grades page", control: S.switch({ get: () => g.autoRefresh, set: (v) => store.set((x) => { x.grades.autoRefresh = v; }) }) }),
      S.row({ label: "Auto-refresh interval (minutes)", enabledWhen: (st) => st.grades.autoRefresh,
        control: S.number({ get: () => g.autoRefreshMin, set: (v) => store.set((x) => { x.grades.autoRefreshMin = Math.max(1, v|0); }), min:1, max:60 }) }),
      S.row({ label: "Rubric-aware prediction", control: S.switch({ get: () => g.rubricPredictor, set: (v) => store.set((x) => { x.grades.rubricPredictor = v; }) }) }),
      S.row({ label: "Show grade trend chart", control: S.switch({ get: () => g.showTrendChart, set: (v) => store.set((x) => { x.grades.showTrendChart = v; }) }) }),
      S.row({ label: "Show weight donut",      control: S.switch({ get: () => g.showWeightDonut, set: (v) => store.set((x) => { x.grades.showWeightDonut = v; }) }) }),
      S.row({ label: "Warn on missing assignments", control: S.switch({ get: () => g.showMissingWarning, set: (v) => store.set((x) => { x.grades.showMissingWarning = v; }) }) }),
    ]}));

    c.appendChild(S.section({ title: "GPA calculator", children: [
      S.row({ label: "GPA scale",
        control: S.select({ get: () => g.gpaScale, set: (v) => store.set((x) => { x.grades.gpaScale = v; }),
          options: Object.entries(BC.GPA_SCALES).map(([k, v]) => ({ value: k, label: v.label })) }) }),
      h("div", { id: "bc-gpa-mount" }, "Loading courses…"),
    ]}));

    // Async GPA mount
    adapter.getGpaData && adapter.getGpaData().then((courses) => {
      const mount = c.querySelector("#bc-gpa-mount");
      if (!mount || !mount.isConnected) return;   // tab switched away mid-fetch
      renderGpaEditor(mount, store, courses);
    }).catch(() => {
      const mount = c.querySelector("#bc-gpa-mount");
      if (mount) mount.textContent = "Open a Canvas tab to load your courses.";
    });
    return c;
  }

  function renderGpaEditor(mount, store, courses) {
    const S = BC.SettingsComponents;
    mount.innerHTML = "";
    const s = store.get();
    const bands = (BC.GPA_SCALES[s.grades.gpaScale] || BC.GPA_SCALES["standard-4"]).bands;
    let total = 0, points = 0;
    const table = h("table.bc-gpa", null);
    const head = h("tr", null, [h("th", null, "Course"), h("th", null, "Score"), h("th", null, "Letter"), h("th", null, "Points"), h("th", null, "Credits")]);
    table.appendChild(head);
    for (const cr of courses) {
      const cred = s.grades.creditsByCourse[cr.id] != null ? s.grades.creditsByCourse[cr.id] : 3;
      let letter = "—", pts = 0;
      if (cr.score != null) { const band = bands.find(b => cr.score >= b.min); letter = band.letter; pts = band.points; }
      const row = h("tr" + (cr.concluded ? ".bc-concluded" : ""), null, [
        h("td", null, cr.name),
        h("td", null, cr.score == null ? "—" : (cr.score.toFixed(2) + "%")),
        h("td", null, letter),
        h("td", null, pts.toFixed(2)),
        h("td", null, el("input", { type: "number", min: 0, step: 0.5, value: cred, class: "bc-number bc-gpa-cred",
          oninput: (e) => store.set((x) => { x.grades.creditsByCourse[cr.id] = parseFloat(e.target.value) || 0; }) })),
      ]);
      table.appendChild(row);
      if (cr.score != null && cred > 0) { points += pts * cred; total += cred; }
    }
    mount.appendChild(table);
    const gpa = total > 0 ? (points / total).toFixed(3) : "—";
    mount.appendChild(h("div.bc-gpa-total", null, "GPA: " + gpa + "  ·  " + total + " credit hours"));
    mount.appendChild(h("p.bc-hint", null, "Set credit to 0 to exclude a course from the GPA."));
  }

  function renderNotifications(store) {
    const S = BC.SettingsComponents;
    const n = store.get().notifications;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Reminders", children: [
      S.row({ label: "Browser notifications", hint:"Requires permission; asked on first enable.",
        control: S.switch({ get: () => n.enabled, set: (v) => store.set((x) => { x.notifications.enabled = v; }) }) }),
      S.row({ label: "In-page toast reminders", control: S.switch({ get: () => n.inPage, set: (v) => store.set((x) => { x.notifications.inPage = v; }) }) }),
      S.row({ label: "Lead times (comma-separated minutes)",
        control: S.text({ get: () => (n.leadMinutes || []).join(", "), set: (v) => store.set((x) => { x.notifications.leadMinutes = v.split(",").map(s => parseInt(s.trim(), 10)).filter(n => n > 0); }) }) }),
    ]}));
    c.appendChild(S.section({ title: "Types", children: [
      S.row({ label: "Due soon",         control: S.switch({ get: () => n.types.dueSoon,         set: (v) => store.set((x) => { x.notifications.types.dueSoon = v; }) }) }),
      S.row({ label: "New grade posted", control: S.switch({ get: () => n.types.newGrade,        set: (v) => store.set((x) => { x.notifications.types.newGrade = v; }) }) }),
      S.row({ label: "New announcement", control: S.switch({ get: () => n.types.newAnnouncement, set: (v) => store.set((x) => { x.notifications.types.newAnnouncement = v; }) }) }),
      S.row({ label: "Grade goal breach",control: S.switch({ get: () => n.types.goalBreach,      set: (v) => store.set((x) => { x.notifications.types.goalBreach = v; }) }) }),
      S.row({ label: "Streak at risk",   control: S.switch({ get: () => n.types.streakAtRisk,    set: (v) => store.set((x) => { x.notifications.types.streakAtRisk = v; }) }) }),
    ]}));
    c.appendChild(S.section({ title: "Quiet hours", children: [
      S.row({ label: "Enable quiet hours", control: S.switch({ get: () => n.quietHours.enabled, set: (v) => store.set((x) => { x.notifications.quietHours.enabled = v; }) }) }),
      S.row({ label: "Start / end",
        control: h("div.bc-inline", null, [
          el("input", { type: "time", value: n.quietHours.start, onchange: (e) => store.set((x) => { x.notifications.quietHours.start = e.target.value; }) }),
          h("span", null, "–"),
          el("input", { type: "time", value: n.quietHours.end, onchange: (e) => store.set((x) => { x.notifications.quietHours.end = e.target.value; }) }),
        ]) }),
      S.row({ label: "Toolbar badge for unread items", control: S.switch({ get: () => n.badgeCount, set: (v) => store.set((x) => { x.notifications.badgeCount = v; }) }) }),
    ]}));
    return c;
  }

  function renderFiles(store) {
    const S = BC.SettingsComponents;
    const f = store.get().files;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Files library", description: "Aggregates files across every course into one filterable panel.", children: [
      S.row({ label: "Enable Files library", control: S.switch({ get: () => f.enabled, set: (v) => store.set((x) => { x.files.enabled = v; }) }) }),
    ]}));
    return c;
  }

  function renderCalendar(store) {
    const S = BC.SettingsComponents;
    const cal = store.get().calendar;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Calendar", children: [
      S.row({ label: "Mini month view on dashboard", control: S.switch({ get: () => cal.miniOnDashboard, set: (v) => store.set((x) => { x.calendar.miniOnDashboard = v; }) }) }),
      S.row({ label: "Syllabus date extraction", hint: "Finds dates in course syllabi and offers to add them to your planner.",
        control: S.switch({ get: () => cal.syllabusExtract, set: (v) => store.set((x) => { x.calendar.syllabusExtract = v; }) }) }),
      S.row({ label: ".ics export",
        control: h("div.bc-inline", null, [
          S.button({ label: "Export upcoming (.ics)", onClick: () => {
            if (!BC.calendar || !BC.calendar.exportIcs) { BC.toast.warn("Open a Canvas tab to export"); return; }
            BC.calendar.exportIcs();
          } }),
        ]) }),
    ]}));
    return c;
  }

  function renderAnnouncements(store) {
    const S = BC.SettingsComponents;
    const a = store.get().announcements;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Announcements", children: [
      S.row({ label: "Aggregator panel", hint:"Unified list across all courses.",
        control: S.switch({ get: () => a.aggregator, set: (v) => store.set((x) => { x.announcements.aggregator = v; }) }) }),
    ]}));
    return c;
  }

  function renderProductivity(store) {
    const S = BC.SettingsComponents;
    const p = store.get().productivity;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Productivity", children: [
      S.row({ label: "Focus mode on assignment pages", control: S.switch({ get: () => p.focusMode, set: (v) => store.set((x) => { x.productivity.focusMode = v; }) }) }),
      S.row({ label: "Reading ruler",       control: S.switch({ get: () => p.readingRuler, set: (v) => store.set((x) => { x.productivity.readingRuler = v; }) }) }),
      S.row({ label: "Sticky notes on any page", control: S.switch({ get: () => p.stickyNotes, set: (v) => store.set((x) => { x.productivity.stickyNotes = v; }) }) }),
      S.row({ label: "Auto-save text-editor drafts", control: S.switch({ get: () => p.autoSaveDrafts, set: (v) => store.set((x) => { x.productivity.autoSaveDrafts = v; }) }) }),
      S.row({ label: "Quiz draft saver", hint: "Snapshots quiz answers locally while you take a quiz, so a crash or reload can't wipe them.",
        control: S.switch({ get: () => p.quizDraftSaver, set: (v) => store.set((x) => { x.productivity.quizDraftSaver = v; }) }) }),
      S.row({ label: "Word/char count",     control: S.switch({ get: () => p.wordCount, set: (v) => store.set((x) => { x.productivity.wordCount = v; }) }) }),
      S.row({ label: "Print-friendly view", control: S.switch({ get: () => p.printFriendly, set: (v) => store.set((x) => { x.productivity.printFriendly = v; }) }) }),
      S.row({ label: "Copy-URL button on pages", control: S.switch({ get: () => p.copyUrlButton, set: (v) => store.set((x) => { x.productivity.copyUrlButton = v; }) }) }),
      S.row({ label: "Reading progress bar", control: S.switch({ get: () => p.readingProgress, set: (v) => store.set((x) => { x.productivity.readingProgress = v; }) }) }),
    ]}));

    const m = store.get().modules;
    c.appendChild(S.section({ title: "Modules", children: [
      S.row({ label: "Module progress bars", hint: "Completion bars per module plus a course-wide summary on the Modules page.",
        control: S.switch({ get: () => m.progressBars, set: (v) => store.set((x) => { x.modules.progressBars = v; }) }) }),
    ]}));

    const disc = store.get().discussions;
    c.appendChild(S.section({ title: "Discussions", children: [
      S.row({ label: "Collapse-replies button", control: S.switch({ get: () => disc.collapse, set: (v) => store.set((x) => { x.discussions.collapse = v; }) }) }),
      S.row({ label: "Jump to next unread", control: S.switch({ get: () => disc.jumpToUnread, set: (v) => store.set((x) => { x.discussions.jumpToUnread = v; }) }) }),
      S.row({ label: "Reply & word stats", control: S.switch({ get: () => disc.wordCount, set: (v) => store.set((x) => { x.discussions.wordCount = v; }) }) }),
      S.row({ label: "Highlight instructor posts", control: S.switch({ get: () => disc.instructorHighlight, set: (v) => store.set((x) => { x.discussions.instructorHighlight = v; }) }) }),
    ]}));
    return c;
  }

  function renderA11y(store) {
    const S = BC.SettingsComponents;
    const a = store.get().accessibility;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Accessibility", children: [
      S.row({ label: "Text-to-speech buttons", control: S.switch({ get: () => a.tts, set: (v) => store.set((x) => { x.accessibility.tts = v; }) }) }),
      S.row({ label: "Larger click targets", control: S.switch({ get: () => a.largeTargets, set: (v) => store.set((x) => { x.accessibility.largeTargets = v; }) }) }),
      S.row({ label: "Dyslexia-friendly font", control: S.switch({ get: () => a.dyslexiaFont, set: (v) => store.set((x) => { x.accessibility.dyslexiaFont = v; }) }) }),
    ]}));
    return c;
  }

  function renderShortcuts(store) {
    const S = BC.SettingsComponents;
    const sh = store.get().shortcuts;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Shortcuts", description: "Click a binding to record a new one. Use Escape to cancel.", children: [
      S.row({ label: "Enable shortcuts", control: S.switch({ get: () => sh.enabled, set: (v) => store.set((x) => { x.shortcuts.enabled = v; }) }) }),
    ]}));
    const labels = {
      commandPalette: "Command palette",
      settings: "Open settings",
      toggleDark: "Toggle dark mode",
      quickTask: "Quick task",
      quickNote: "Quick note",
      gotoDashboard: "Go to dashboard",
      gotoGrades: "Go to grades",
      gotoInbox: "Go to inbox",
      gotoCalendar: "Go to calendar",
      focusMode: "Toggle focus mode",
    };
    c.appendChild(S.section({ title: "Bindings", children:
      Object.keys(labels).map((id) => S.row({ label: labels[id],
        control: S.keybind({ get: () => sh.bindings[id], set: (v) => store.set((x) => { x.shortcuts.bindings[id] = v; }) }) })),
    }));
    return c;
  }

  function renderInsights(store, adapter) {
    const S = BC.SettingsComponents;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({
      title: "Tracking",
      description: "All analytics are computed and stored on this device only — nothing is ever uploaded.",
      children: [
        S.row({ label: "Track time on Canvas", hint: "Counts minutes per course while a Canvas tab is visible.",
          control: S.switch({ get: () => store.get().insights.enabled, set: (v) => store.set((x) => { x.insights.enabled = v; }) }) }),
      ],
    }));
    const mount = h("div.bc-tab-body", null, "Loading analytics…");
    c.appendChild(mount);

    const namesP = adapter && adapter.getCourses ? adapter.getCourses().catch(() => []) : Promise.resolve([]);
    namesP.then((courses) => {
      const names = {};
      for (const cr of courses || []) names[cr.id] = cr.name;
      try {
        chrome.storage.local.get([BC.LOCAL_KEY], (res) => {
          if (!mount.isConnected) return;   // tab switched away mid-fetch
          renderInsightsData(mount, (res && res[BC.LOCAL_KEY]) || {}, names);
        });
      } catch (_) {
        renderInsightsData(mount, {}, names);
      }
    });
    return c;
  }

  function renderInsightsData(mount, local, names) {
    const S = BC.SettingsComponents;
    mount.innerHTML = "";
    const courseName = (id) => names[id] || (id === "other" ? "Other pages" : "Course " + id);
    const fmtMin = (m) => m >= 60 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : m + "m";

    // -- time on Canvas (last 14 days) -------------------------------------
    const st = local.studyTime || {};
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(BC.dt.ymd(d));
    }
    const perDay = days.map((d) => Object.values(st[d] || {}).reduce((a, b) => a + b, 0));
    const total = perDay.reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...perDay);
    const byCourse = {};
    for (const d of days) for (const [k, v] of Object.entries(st[d] || {})) byCourse[k] = (byCourse[k] || 0) + v;
    const top = Object.entries(byCourse).sort((a, b) => b[1] - a[1]).slice(0, 6);

    mount.appendChild(S.section({
      title: "Time on Canvas — last 14 days",
      children: total ? [
        h("div.bc-ins-total", null, fmtMin(total) + " total · " + fmtMin(Math.round(total / 14)) + "/day average"),
        h("div.bc-ins-days", null, days.map((d, i) => h("div.bc-ins-day", { title: d + " · " + fmtMin(perDay[i]) }, [
          h("div.bc-ins-day-fill", { style: { height: Math.round((perDay[i] / max) * 100) + "%" } }),
        ]))),
        h("div", null, top.map(([k, v]) => h("div.bc-ins-row", null, [
          h("span", null, courseName(k)),
          h("span.bc-ins-val", null, fmtMin(v)),
        ]))),
      ] : [h("p.bc-hint", null, "No study time recorded yet. Keep a Canvas tab open while you work and check back.")],
    }));

    // -- pomodoro ----------------------------------------------------------
    const sessions = (local.pomodoro && local.pomodoro.sessions) || [];
    const weekAgo = Date.now() - 7 * 864e5;
    const recent = sessions.filter((s) => (s.end || 0) >= weekAgo);
    const focusMin = recent.reduce((a, s) => a + (s.min || 0), 0);
    mount.appendChild(S.section({
      title: "Pomodoro — last 7 days",
      children: recent.length ? [
        h("div.bc-ins-total", null, recent.length + " session" + (recent.length === 1 ? "" : "s") + " · " + fmtMin(focusMin) + " focused"),
        h("div", null, recent.slice(-8).reverse().map((s) => h("div.bc-ins-row", null, [
          h("span", null, (s.task || "Untitled focus") + " · " + new Date(s.end).toLocaleDateString()),
          h("span.bc-ins-val", null, fmtMin(s.min || 0)),
        ]))),
      ] : [h("p.bc-hint", null, "No pomodoro sessions yet. Start one from the planner widget's task details.")],
    }));

    // -- grade trends --------------------------------------------------------
    const gh = local.gradeHistory || {};
    const trendRows = Object.entries(gh)
      .filter(([, arr]) => Array.isArray(arr) && arr.length >= 2)
      .slice(0, 8)
      .map(([cid, arr]) => {
        const scores = arr.map((p) => p.score).filter((v) => v != null);
        if (scores.length < 2) return null;
        const min = Math.min(...scores), maxS = Math.max(...scores), span = Math.max(0.001, maxS - min);
        const pts = scores.map((v, i) =>
          Math.round((i / (scores.length - 1)) * 140) + "," + Math.round(30 - ((v - min) / span) * 26 + 2)
        ).join(" ");
        const delta = scores[scores.length - 1] - scores[0];
        const color = delta >= 0 ? "#059669" : "#dc2626";
        const spark = h("span.bc-ins-spark");
        spark.innerHTML = '<svg width="140" height="32" viewBox="0 0 140 32"><polyline fill="none" stroke="' +
          color + '" stroke-width="2" points="' + pts + '"/></svg>';
        return h("div.bc-ins-row", null, [
          h("span", null, courseName(cid)),
          spark,
          h("span.bc-ins-val", { style: { color } }, (delta >= 0 ? "+" : "") + delta.toFixed(1) + "%"),
        ]);
      })
      .filter(Boolean);
    mount.appendChild(S.section({
      title: "Grade trends",
      children: trendRows.length ? trendRows
        : [h("p.bc-hint", null, "Visit your course grade pages a few times to build up trend history.")],
    }));
  }

  function renderInstructor(store) {
    const S = BC.SettingsComponents;
    const i = store.get().instructor;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({
      title: "Instructor tools",
      description: "Helpers for teacher/TA roles. Everything stays local — nothing ever writes grades back to Canvas.",
      children: [
        S.row({ label: "Roster CSV export", hint: "Adds an export button on course People pages.",
          control: S.switch({ get: () => i.rosterExport, set: (v) => store.set((x) => { x.instructor.rosterExport = v; }) }) }),
        S.row({ label: "Attendance quick-mark", hint: "P/A buttons on the People list, with CSV export. Stored on this device only.",
          control: S.switch({ get: () => i.attendanceQuick, set: (v) => store.set((x) => { x.instructor.attendanceQuick = v; }) }) }),
        S.row({ label: "Needs-grading badges", hint: "Shows ungraded submission counts on the assignments index.",
          control: S.switch({ get: () => i.bulkGradeHelpers, set: (v) => store.set((x) => { x.instructor.bulkGradeHelpers = v; }) }) }),
      ],
    }));
    return c;
  }

  function renderAbout(store) {
    const S = BC.SettingsComponents;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({
      title: "Better Canvas " + (BC.VERSION || ""),
      description: "Privacy-first Canvas customizer. Every setting stays on this device — no telemetry, no accounts, no servers.",
      children: [
        h("p", null, "Better Canvas customizes the Instructure Canvas LMS with real dark mode, a redesigned dashboard, a planner-style To Do widget, grade tools, notifications, files browser, keyboard shortcuts, and a lot more — all configured from this panel."),
        h("p", null, "Grade and planner features use your existing Canvas login session; nothing is ever sent off-domain."),
        h("div.bc-inline", null, [
          S.button({ label: "Reset all settings", variant: "danger", onClick: () => { if (confirm("Reset ALL settings?")) store.reset(); } }),
        ]),
      ],
    }));
    c.appendChild(renderDiagnostics(store));
    return c;
  }

  // BC.diag was console-only, so a user hitting a problem had no way to report
  // anything useful. Nothing here is uploaded — it's a local ring buffer.
  function renderDiagnostics(store) {
    const S = BC.SettingsComponents;
    const entries = (BC.diag && BC.diag.entries) ? BC.diag.entries.slice().reverse().slice(0, 15) : null;
    const children = [];

    if (!entries) {
      // The options page is a different JS realm, so it has its own empty BC.diag.
      children.push(h("p.bc-hint", null, "Open the settings drawer on a Canvas page to see diagnostics."));
    } else if (!entries.length) {
      children.push(h("p.bc-hint", null, "No errors recorded. 🎉"));
    } else {
      for (const e of entries) {
        children.push(h("div.bc-ins-row", null, [
          h("span", null, e.source),
          h("span.bc-ins-val", null, new Date(e.ts).toLocaleTimeString() + " · " + e.error),
        ]));
      }
      children.push(h("div.bc-inline", null, [
        S.button({
          label: "Copy diagnostics",
          onClick: () => {
            const text = JSON.stringify(BC.diag.entries, null, 2);
            if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => BC.toast && BC.toast.success("Diagnostics copied"));
          },
        }),
        S.button({ label: "Clear", variant: "ghost", onClick: () => { BC.diag.clear(); BC.toast && BC.toast.info("Diagnostics cleared"); } }),
      ]));
    }

    return S.section({
      title: "Diagnostics",
      description: "Recent internal errors, kept locally so you can report a problem. Nothing here is uploaded.",
      children,
    });
  }

  // ---- import/export/search ---------------------------------------------

  function searchInput(store, onChange) {
    const inp = el("input", { type: "search", class: "bc-search", placeholder: "Search this tab…", "aria-label": "Search settings in this tab" });
    inp.addEventListener("input", () => onChange && onChange(inp.value));
    return inp;
  }

  // Planner metadata (stars, snoozes, subtasks, kanban status) used to live inside
  // settings and therefore inside exported JSON. It now lives in bcLocal, so export
  // has to carry both halves or every backup silently loses it.
  function download(text, name) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function exportFlow(store) {
    const adapter = store.adapter || {};
    Promise.resolve(adapter.getLocal ? adapter.getLocal() : null)
      .catch(() => null)
      .then((local) => {
        const payload = {
          kind: "better-canvas-backup",
          version: BC.SETTINGS_VERSION,
          exportedAt: new Date().toISOString(),
          settings: JSON.parse(store.exportJSON()),
          local: local || null,
        };
        download(JSON.stringify(payload, null, 2), "better-canvas-settings.json");
        BC.toast && BC.toast.success("Settings exported");
      });
  }

  function importFlow(store) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json";
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      f.text().then((txt) => {
        let parsed = null;
        try { parsed = JSON.parse(txt); } catch (_) { parsed = null; }
        if (!parsed || typeof parsed !== "object") { BC.toast && BC.toast.error("Invalid settings file"); return; }

        // Accept both shapes: the new {settings, local} envelope and a bare pre-3.1
        // settings object.
        const isEnvelope = parsed.kind === "better-canvas-backup" || (parsed.settings && typeof parsed.settings === "object");
        const settingsPart = isEnvelope ? parsed.settings : parsed;
        const localPart = isEnvelope ? parsed.local : null;

        if (!store.importJSON(JSON.stringify(settingsPart))) {
          BC.toast && BC.toast.error("Invalid settings file");
          return;
        }
        const adapter = store.adapter || {};
        if (localPart && adapter.saveLocal) {
          Promise.resolve(adapter.saveLocal(localPart))
            .then(() => BC.toast && BC.toast.success("Settings and planner data imported"))
            .catch(() => BC.toast && BC.toast.warn("Settings imported, but planner data could not be restored"));
        } else {
          BC.toast && BC.toast.success("Settings imported");
        }
      });
    };
    inp.click();
  }

  // ============ CSS ======================================================
  const CSS = `
  /* Alias layer onto the real design tokens. This is what makes the settings UI
     adopt your theme: previously it declared its own hardcoded --bg/--panel/--accent
     and so never saw the accent, the palette, the custom font, or the radius slider.
     ":host { all: initial }" does NOT block custom-property inheritance (the spec
     exempts them from 'all'), so the drawer's shadow root already inherits every
     --bc-* from :root and needs no plumbing at all. The fallbacks cover documents
     that haven't emitted tokens yet.
     Keeping the short alias names means the ~140 rules below didn't have to change
     in the same edit; they get swept to canonical names separately. */
  .bc-app {
    --bg:     var(--bc-surface-1, #f6f7fb);
    --panel:  var(--bc-surface-2, #ffffff);
    --fg:     var(--bc-text, #1f2937);
    --muted:  var(--bc-muted, #6b7280);
    --border: var(--bc-border, #e5e7eb);
    --accent: var(--bc-accent, #4f46e5);
    --danger: var(--bc-danger, #dc2626);
    --radius: var(--bc-radius-lg, 10px);
    font-family: var(--bc-font-sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
    font-size: var(--bc-text-md, 14px);
    line-height: var(--bc-leading-body, 1.5);
    letter-spacing: var(--bc-tracking, 0px);
    color: var(--fg); background: var(--bg);
    min-height: 100%; padding: 12px 12px 40px;
    box-sizing: border-box;
  }
  .bc-app * { box-sizing: border-box; }
  /* This file previously had ZERO focus-visible rules, and inside a shadow root
     with 'all: initial' the UA ring often doesn't render at all. */
  .bc-app :focus-visible {
    outline: 2px solid var(--bc-focus-ring, var(--accent));
    outline-offset: 2px;
    box-shadow: 0 0 0 4px var(--bc-focus-halo, var(--panel));
  }
  .bc-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px 12px; }
  .bc-brand { display: flex; align-items: center; gap: 10px; }
  .bc-logo {
    width: 34px; height: 34px; border-radius: 8px; background: var(--accent);
    color: #fff; display: inline-flex; align-items: center; justify-content: center; font-weight: 800;
  }
  .bc-brand-name { font-weight: 700; }
  .bc-brand-sub  { font-size: 11px; color: var(--muted); }
  .bc-header-actions { display: flex; gap: 8px; align-items: center; }
  .bc-search { padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); color: inherit; min-width: 200px; }

  .bc-topbar { display: flex; justify-content: space-between; align-items: center; margin: 4px 0 14px; padding: 10px 12px; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); }
  .bc-master { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .bc-master input { width: 18px; height: 18px; }
  .bc-topbar-right { display: flex; gap: 6px; }

  .bc-shell { display: grid; grid-template-columns: 210px 1fr; gap: 14px; }
  @media (max-width: 720px) { .bc-shell { grid-template-columns: 1fr; } .bc-nav { display: flex; overflow-x: auto; padding: 8px; } .bc-tab { flex: none; } }

  .bc-nav { display: flex; flex-direction: column; gap: 2px; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px; height: fit-content; position: sticky; top: 8px; }
  .bc-tab {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border: 0; background: transparent; color: inherit;
    text-align: left; cursor: pointer; border-radius: 8px; font: inherit;
  }
  /* One mode-aware wash replaces each light rule plus its html.bc-dark twin. */
  .bc-tab:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); }
  .bc-tab.active { background: var(--accent); color: var(--bc-accent-contrast, #fff); }
  .bc-tab.active:hover { background: var(--accent); }
  .bc-tab-ic { display: inline-block; width: 18px; text-align: center; opacity: .9; }

  .bc-body { min-width: 0; }
  .bc-tab-body { display: flex; flex-direction: column; gap: 14px; }
  .bc-section { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
  .bc-section-title { margin: 0 0 4px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .bc-section-desc { margin: 0 0 12px; color: var(--muted); font-size: 13px; }
  .bc-section-body { display: flex; flex-direction: column; gap: 10px; }

  .bc-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 6px 0; border-top: 1px solid var(--border); }
  .bc-section-body > .bc-row:first-child { border-top: 0; padding-top: 0; }
  .bc-hidden { display: none !important; }
  .bc-row-off { opacity: .5; }
  .bc-row-off .bc-row-control { pointer-events: none; }
  .bc-row-title { font-weight: 500; }
  .bc-row-hint  { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .bc-row-warn  { color: var(--danger); font-size: 12px; margin-top: 2px; }
  .bc-row-control { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

  .bc-switch { position: relative; width: 40px; height: 22px; display: inline-block; flex: none; border-radius: 999px; background: #cbd5e1; transition: background .15s ease; cursor: pointer; }
  .bc-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  /* pointer-events:none is load-bearing: the thumb is a later positioned sibling,
     so without it the knob paints above the input and swallows the click. */
  .bc-switch-thumb { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform .15s ease; box-shadow: 0 1px 2px rgba(0,0,0,.15); pointer-events: none; }
  .bc-switch input:checked + .bc-switch-thumb { transform: translateX(18px); }
  .bc-switch.bc-on, .bc-switch:has(input:checked) { background: var(--accent); }
  .bc-switch input:focus-visible + .bc-switch-thumb { box-shadow: 0 1px 2px rgba(0,0,0,.15), 0 0 0 3px color-mix(in srgb, var(--accent) 45%, transparent); }

  .bc-select, .bc-text, .bc-textarea, .bc-number, .bc-color-text, .bc-tags-inp {
    padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: inherit; font: inherit;
  }
  .bc-textarea { width: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .bc-number { width: 90px; }
  .bc-color { display: inline-flex; align-items: center; gap: 6px; }
  .bc-color input[type=color] { width: 32px; height: 32px; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: transparent; }
  .bc-color-text { width: 100px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .bc-slider { display: inline-flex; align-items: center; gap: 8px; }
  .bc-slider-val { min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }
  .bc-invalid input { border-color: var(--danger); }
  .bc-text-warn { color: var(--danger); font-size: 12px; }

  .bc-btn { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: inherit; cursor: pointer; font: inherit; }
  .bc-btn:hover { background: var(--bc-surface-4, rgba(0,0,0,.04)); }
  .bc-btn-danger { color: var(--danger); border-color: var(--bc-danger-border, rgba(185,28,28,.4)); }
  .bc-btn-ghost  { background: transparent; }

  .bc-sortable { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .bc-sortable-item {
    display: grid; grid-template-columns: 20px 1fr;
    align-items: center; gap: 10px; padding: 6px 8px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
  }
  .bc-drag { cursor: grab; color: var(--muted); user-select: none; text-align: center; }
  .bc-sortable-item.bc-dragging { opacity: .5; }

  .bc-course-row { display: grid; grid-template-columns: 20px 1fr 40px auto 1fr; gap: 8px; align-items: center; }
  .bc-course-swatch { width: 18px; height: 18px; border-radius: 50%; }
  .bc-course-name { min-width: 0; }
  .bc-course-bg { min-width: 0; }
  .bc-mini-check { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--muted); }
  .bc-bulk { display: flex; gap: 6px; margin-top: 10px; }

  .bc-inline { display: inline-flex; gap: 6px; align-items: center; }

  .bc-theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .bc-theme-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 10px; cursor: pointer; text-align: left; color: inherit; }
  .bc-theme-card:hover { border-color: var(--accent); }
  .bc-theme-swatch { height: 60px; border-radius: 8px; border: 2px solid; position: relative; overflow: hidden; }
  .bc-theme-swatch span { position: absolute; right: 8px; bottom: 8px; width: 20px; height: 20px; border-radius: 50%; }
  .bc-theme-name { margin-top: 8px; font-weight: 600; font-size: 13px; }
  .bc-theme-actions { display: flex; gap: 4px; margin-top: 8px; }
  .bc-theme-actions .bc-btn { padding: 3px 8px; font-size: 12px; }
  .bc-rot-list { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 6px 0; }

  .bc-navitem { display: flex; justify-content: space-between; align-items: center; width: 100%; }
  .bc-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .bc-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .bc-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: var(--bc-surface-4, rgba(0,0,0,.05)); border-radius: var(--bc-radius-pill, 999px); font-size: 12px; }
  .bc-chip-x { background: none; border: 0; cursor: pointer; color: var(--bc-text-subtle, var(--muted)); }
  .bc-tags-inp { min-width: 120px; flex: 1; }

  .bc-links { display: flex; flex-direction: column; gap: 6px; }
  .bc-link-row { display: grid; grid-template-columns: 1fr 2fr auto auto; gap: 6px; align-items: center; }

  .bc-key { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: inherit; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; cursor: pointer; font-size: 13px; }

  .bc-hint { color: var(--muted); font-size: 12px; }
  .bc-notice {
    padding: 10px 12px; border-radius: var(--radius); font-size: 13px;
    background: var(--bc-warn-bg, #fffbeb); color: var(--bc-text, inherit);
    border: 1px solid var(--bc-warn, #a16207);
  }
  .bc-ins-total { font-weight: 700; margin-bottom: 8px; }
  .bc-ins-days { display: flex; gap: 4px; align-items: flex-end; height: 64px; margin: 8px 0 12px; }
  .bc-ins-day { flex: 1; height: 100%; display: flex; align-items: flex-end; background: var(--bc-surface-4, rgba(0,0,0,.04)); border-radius: var(--bc-radius-sm, 4px); overflow: hidden; }
  .bc-ins-day-fill { width: 100%; background: var(--accent); border-radius: 4px 4px 0 0; min-height: 2px; }
  .bc-ins-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 5px 0; border-top: 1px solid var(--border); font-size: 13px; }
  .bc-ins-row:first-child { border-top: 0; }
  .bc-ins-val { font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; }
  .bc-ins-spark { line-height: 0; }
  .bc-rec-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; }
  .bc-rec-title { font-weight: 600; }
  .bc-rec-meta { font-size: 12px; color: var(--muted); }
  .bc-rec-days { display: flex; gap: 10px; flex-wrap: wrap; margin: 4px 0; }
  .bc-rec-form { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); }
  .bc-rec-form input[type=time], .bc-rec-form input[type=date] { padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: inherit; font: inherit; }

  .bc-gpa { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .bc-gpa th, .bc-gpa td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
  .bc-gpa-cred { width: 70px; }
  .bc-gpa-total { margin-top: 10px; font-weight: 700; }
  /* A token, not opacity: fading text that already sits at AA drops it below AA. */
  .bc-concluded td { color: var(--bc-text-subtle, var(--muted)); }
  `;
})();
