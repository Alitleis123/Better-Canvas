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

      const iconBtn = (name, label, onClick) => {
        const b = el("button", { class: "bc-icon-btn", type: "button", title: label, "aria-label": label });
        b.innerHTML = BC.icons.svg(name, { size: 16 });
        b.addEventListener("click", onClick);
        return b;
      };

      const undoBtn = iconBtn("chevron-left", "Undo", () => store.undo());
      const redoBtn = iconBtn("chevron-right", "Redo", () => store.redo());

      // Import / Export / Reset were three full-width buttons on a bar of their
      // own. They are used once each, ever, and they were sharing a row with the
      // one switch that turns the extension off -- so they move behind a mark and
      // the bar goes away.
      const menu = h("div.bc-menu", { role: "menu", hidden: true }, null);
      const menuItem = (icon, label, onClick, danger) => {
        const b = el("button", { class: "bc-menu-item" + (danger ? " bc-danger" : ""), type: "button", role: "menuitem" });
        b.innerHTML = BC.icons.svg(icon, { size: 15 });
        b.appendChild(document.createTextNode(label));
        b.addEventListener("click", () => { closeMenu(); onClick(); });
        return b;
      };
      const menuBtn = iconBtn("more", "More actions", (e) => { e.stopPropagation(); toggleMenu(); });
      menuBtn.setAttribute("aria-haspopup", "menu");
      menuBtn.setAttribute("aria-expanded", "false");
      function closeMenu() { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
      function toggleMenu() {
        menu.hidden = !menu.hidden;
        menuBtn.setAttribute("aria-expanded", String(!menu.hidden));
        if (!menu.hidden) (menu.querySelector(".bc-menu-item") || menu).focus();
      }
      menu.appendChild(menuItem("folder", "Import settings…", () => importFlow(store)));
      menu.appendChild(menuItem("external-link", "Export settings", () => exportFlow(store)));
      menu.appendChild(h("div.bc-menu-sep", null));
      menu.appendChild(menuItem("refresh", "Reset everything", () => { if (confirm("Reset all settings to defaults?")) store.reset(); }, true));
      // The root, not document: in the drawer this tree lives in a shadow root,
      // where a document listener never sees the click that should dismiss.
      app.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
      app.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { closeMenu(); menuBtn.focus(); } });

      // The master switch keeps its place on the one remaining bar -- it is the
      // control that decides whether any of the rest does anything.
      const masterInput = el("input", {
        type: "checkbox", class: "bc-sr-only", checked: !!store.get().enabled,
        onchange: (e) => { store.set((d) => { d.enabled = e.target.checked; }); paintMaster(); },
      });
      const masterLabel = h("span", null, "On");
      const master = h("label.bc-master", { title: "Enable Better Canvas" }, [masterInput, masterLabel]);
      function paintMaster() {
        master.classList.toggle("bc-on", masterInput.checked);
        masterLabel.textContent = masterInput.checked ? "On" : "Off";
      }
      paintMaster();

      const header = h("header.bc-header", null, [
        h("div.bc-brand", null, [
          h("span.bc-logo", null, "BC"),
          h("div", null, [h("div.bc-brand-name", null, "Better Canvas"), h("div.bc-brand-sub", null, "v" + (BC.VERSION || ""))]),
        ]),
        master,
        searchInput(store, (q) => applySearch(q)),
        h("div.bc-header-actions", null, [
          undoBtn, redoBtn,
          h("div.bc-menu-wrap", null, [menuBtn, menu]),
        ]),
      ]);
      app.appendChild(header);

      const shellWrap = h("div.bc-shell-wrap", null);
      const shell = h("div.bc-shell", null);
      const nav   = h("nav.bc-nav", { "aria-label": "Settings sections" }, null);
      const navGroups = h("div.bc-nav-groups", null);
      nav.appendChild(navGroups);
      const body  = h("main.bc-body", null);
      const empty = h("p.bc-search-empty.bc-hidden", null);
      shell.appendChild(nav); shell.appendChild(body);
      shellWrap.appendChild(shell);
      app.appendChild(shellWrap);

      // Seventeen tabs listed flat, alphabetically by nothing, was the panel's
      // biggest single source of "where is that setting". Five of them held two
      // rows each -- Files, Calendar, Announcements, Instructor and the Modules
      // and Discussions blocks -- so they fold into one "Course tools" tab, and
      // Accessibility folds into Appearance beside the colour-blind and
      // reduced-motion switches it already belonged with. Thirteen tabs in four
      // named groups; nothing was removed, only put somewhere findable.
      const GROUPS = [
        { label: "Look", tabs: [
          { id: "themes",        label: "Themes",       icon: "palette",  sub: "Full-page looks with their own art, type and palette." },
          { id: "theming",       label: "Appearance",   icon: "contrast", sub: "Dark mode, colour, type, density and reading aids." },
          { id: "cosmetics",     label: "Background",   icon: "image",    sub: "Page background, patterns and your own CSS." },
        ] },
        { label: "Pages", tabs: [
          { id: "dashboard",     label: "Dashboard",    icon: "grid",         sub: "Course cards, widgets and the sidebar." },
          { id: "todo",          label: "To Do",        icon: "check-circle", sub: "Which planner you get, and how a task is drawn." },
          { id: "grades",        label: "Grades",       icon: "bars",         sub: "Grade tools, goals and the GPA calculator." },
          { id: "coursetools",   label: "Course tools", icon: "folder",       sub: "Files, calendar, announcements, modules, discussions." },
        ] },
        { label: "Tools", tabs: [
          { id: "productivity",  label: "Focus",        icon: "timer",   sub: "Focus mode, sticky notes, drafts and reading aids." },
          { id: "notifications", label: "Reminders",    icon: "bell",    sub: "What you get told about, and when." },
          { id: "navigation",    label: "Navigation",   icon: "menu",    sub: "Reorder or hide Canvas's own nav, and add your own links." },
          { id: "shortcuts",     label: "Shortcuts",    icon: "command", sub: "Every action, rebindable." },
        ] },
        { label: "You", tabs: [
          { id: "insights",      label: "Insights",     icon: "trend", sub: "Study time, grade history and Pomodoro sessions — all local." },
          { id: "about",         label: "About",        icon: "info",  sub: "Version, privacy and diagnostics." },
        ] },
      ];

      const RENDERERS = {
        dashboard: renderDashboard, todo: renderTodo, theming: renderTheming,
        themes: renderThemes, cosmetics: renderCosmetics, navigation: renderNavigation,
        grades: renderGrades, notifications: renderNotifications,
        coursetools: renderCourseTools, productivity: renderProductivity,
        insights: renderInsights, shortcuts: renderShortcuts, about: renderAbout,
      };
      const TABS = GROUPS.flatMap((g) => g.tabs.map((t) => ({ ...t, render: RENDERERS[t.id] })));

      // Drawn, not typed. These were geometric glyphs (a telephone for
      // announcements, a shogi piece for notifications) which are at the mercy
      // of the host font and, where the font had them, meant something else.
      function tabIcon(name) {
        const sp = h("span.bc-tab-ic", null);
        sp.setAttribute("aria-hidden", "true");
        sp.innerHTML = BC.icons.svg(name || "circle");
        return sp;
      }

      let active = "themes";
      let searchQuery = "";

      // The nav is built ONCE, outside showTab, so neither a tab switch nor a
      // state change rebuilds it (which is what kept resetting the responsive
      // horizontal nav's scroll position).
      const tabBtns = new Map();
      for (const g of GROUPS) {
        const group = h("div.bc-nav-group", null, [h("div.bc-nav-group-label", null, g.label)]);
        for (const t of g.tabs) {
          const btn = h("button.bc-tab", { type: "button", "data-tab": t.id, onclick: () => showTab(t.id) },
            [tabIcon(t.icon), t.label]);
          tabBtns.set(t.id, btn);
          group.appendChild(btn);
        }
        navGroups.appendChild(group);
      }

      function showTab(id) {
        active = id;
        for (const [tid, b] of tabBtns) {
          const on = tid === active;
          b.classList.toggle("active", on);
          b.setAttribute("aria-current", on ? "page" : "false");
        }
        const tab = TABS.find((t) => t.id === active) || TABS[0];
        // One line at the top of the tab, so the sections below it don't each
        // need a sentence explaining themselves. That is where most of the
        // panel's word count used to live.
        const head = h("div.bc-tab-head", null, [
          h("span.bc-tab-head-ic", { "aria-hidden": "true" }, null),
          h("div", null, [
            h("h2.bc-tab-title", null, tab.label),
            tab.sub ? h("p.bc-tab-sub", null, tab.sub) : null,
          ]),
        ]);
        head.firstChild.innerHTML = BC.icons.svg(tab.icon || "circle", { size: 20 });
        // A renderer that throws used to leave the PREVIOUS tab's body mounted
        // while the rail highlighted the new one -- so the panel silently showed
        // the wrong page and nothing said so. Build first, and if it fails, say
        // that instead of lying about which tab you are on.
        let panel;
        try {
          panel = tab.render(store, adapter, { searchQuery });
        } catch (e) {
          BC.util.warn("settings: " + tab.id + " failed to render", e);
          panel = h("div.bc-tab-body", null, [
            h("div.bc-notice", null, "This section could not be loaded. Reload the Canvas tab; if it keeps happening, the About tab has the error log."),
          ]);
        }
        // Controls in the outgoing tab detach here; C.bindings.sync prunes them
        // lazily on its next pass via isConnected, so there's nothing to unwire.
        body.replaceChildren(head, panel, empty);
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
        // Cards, as well as rows. A gallery item is not a .bc-row, so the
        // section-level fallback below was the only thing search did for it:
        // typing "gruvbox" with forty-four skins on screen kept the section --
        // because the section's text contains "Gruvbox" somewhere -- and
        // narrowed nothing. Anything carrying data-bc-filter opts into being
        // filtered individually, on that attribute rather than on its text, so a
        // skin can be found by a tag or an author it does not print.
        for (const card of body.querySelectorAll("[data-bc-filter]")) {
          const hay = (card.getAttribute("data-bc-filter") || "").toLowerCase();
          card.classList.toggle("bc-hidden", !!query && !hay.includes(query));
        }
        let shown = 0;
        for (const sec of body.querySelectorAll(".bc-section")) {
          // A section built out of rows is judged by its rows. Several are not:
          // the skin gallery, the theme grids, the GPA table and the charts are
          // whole panels. Judging those by "has a visible row" hid every one of
          // them for ANY query, so searching "skin" on the Themes tab hid the
          // skin gallery -- the search was hiding exactly what was asked for.
          const hasRows = !!sec.querySelector(".bc-row");
          const hasCards = !!sec.querySelector("[data-bc-filter]");
          const hit = hasCards
            ? !!sec.querySelector("[data-bc-filter]:not(.bc-hidden)")
            : hasRows
              ? !!sec.querySelector(".bc-row:not(.bc-hidden)")
              : (sec.textContent || "").toLowerCase().includes(query);
          sec.classList.toggle("bc-hidden", !!query && !hit);
          if (!query || hit) shown++;
        }
        // Say so, rather than leaving the tab heading above an empty void.
        empty.classList.toggle("bc-hidden", !query || shown > 0);
        empty.textContent = query ? 'Nothing in this tab matches "' + searchQuery.trim() + '".' : "";
      }

      store.subscribe((state, kind) => {
        // Targeted: each mounted control re-reads the store and writes only what
        // differs, so the control the user is touching is never destroyed. This is
        // what lets the toggle animate, the caret survive, and a drag continue.
        S.bindings.sync(state);
        if (masterInput.checked !== !!state.enabled) { masterInput.checked = !!state.enabled; paintMaster(); }
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
    const sw = (k) => S.switch({ get: () => d[k], set: (v) => store.set((x) => { x.dashboard[k] = v; }) });
    const wsw = (k) => S.switch({ get: () => d.widgets[k], set: (v) => store.set((x) => { x.dashboard.widgets[k] = v; }) });

    const container = h("div.bc-tab-body", null);
    container.appendChild(S.section({
      title: "Cards", icon: "grid",
      children: [
        S.row({ label: "Restyle the dashboard", icon: "image", control: sw("enabled") }),
        S.row({ label: "Layout", icon: "columns",
          control: S.select({ get: () => d.layout, set: (v) => store.set((x) => { x.dashboard.layout = v; }),
            options: [{value:"grid",label:"Grid"},{value:"list",label:"List"},{value:"masonry",label:"Masonry"},{value:"compact",label:"Compact"}] }) }),
        S.row({ label: "Card size", icon: "grid",
          control: S.select({ get: () => d.cardSize, set: (v) => store.set((x) => { x.dashboard.cardSize = v; }),
            options: [{value:"s",label:"Small"},{value:"m",label:"Medium"},{value:"l",label:"Large"}] }) }),
        S.row({ label: "Cards per row", icon: "columns",
          hint: "Caps the dashboard's width, so a laptop and an external monitor lay out the same.",
          control: S.select({
            get: () => String(d.maxColumns == null ? 5 : d.maxColumns),
            set: (v) => store.set((x) => { x.dashboard.maxColumns = +v; }),
            options: [{value:"3",label:"3"},{value:"4",label:"4"},{value:"5",label:"5"},
                      {value:"6",label:"6"},{value:"8",label:"8"},{value:"0",label:"Fill the window"}] }) }),
        S.row({ label: "Corner radius", icon: "circle",
          control: S.slider({ get: () => d.cardRadius, set: (v) => store.set((x) => { x.dashboard.cardRadius = v; }), min:0, max:24, format:(v)=>v+"px" }) }),
        S.row({ label: "Lift on hover", icon: "trend", control: sw("hoverLift") }),
        S.row({ label: "Hide concluded courses", icon: "archive", control: sw("autoHideConcluded") }),
        S.row({ label: "Search bar above the cards", icon: "search", control: sw("courseSearch") }),
      ],
    }));

    // Six switches that all answer "what else goes on the card". They were
    // mixed into the layout list, so the one question was asked six times in
    // six different places.
    container.appendChild(S.section({
      title: "On each card", icon: "tag",
      children: [
        S.row({ label: "Grade", icon: "bars", hint: "Needs grade access on your Canvas.", control: sw("showInlineGrade") }),
        S.row({ label: "Progress bar", icon: "timeline", control: sw("showProgressBar") }),
        S.row({ label: "Due-count badge", icon: "bell", hint: "Anything due in 24 hours.", control: sw("showBadges") }),
        S.row({ label: "Grade sparkline", icon: "trend", hint: "Fills in after a few days of history.", control: sw("showSparkline") }),
      ],
    }));

    container.appendChild(S.section({
      title: "Sidebar", icon: "columns",
      children: [
        S.row({ label: "To Do", icon: "check-circle", control: wsw("todo") }),
        S.row({ label: "Coming Up", icon: "clock", control: wsw("comingUp") }),
        S.row({ label: "Recent Feedback", icon: "megaphone", control: wsw("recentFeedback") }),
        S.row({ label: "GPA", icon: "mortarboard", control: wsw("gpa") }),
        S.row({ label: "Semester progress", icon: "timeline", hint: "Week 9 of 15, from your term dates.", control: sw("semesterProgress") }),
        S.row({ label: "Hide the sidebar entirely", icon: "close", control: sw("hideSidebar") }),
      ],
    }));

    // Course list section — pulls from Canvas via adapter.
    const coursesSection = S.section({
      title: "Your courses", icon: "mortarboard",
      description: "Drag to reorder. Rename, recolour or hide any card.",
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
        S.button({ label: "Unhide all", icon: "check", onClick: () => store.set((x) => { for (const c of courses) { x.dashboard.courses[c.id] = { ...(x.dashboard.courses[c.id] || {}), hidden: false }; } }) }),
        S.button({ label: "Reset colours", icon: "palette", onClick: () => store.set((x) => { for (const c of courses) { if (x.dashboard.courses[c.id]) delete x.dashboard.courses[c.id].color; } }) }),
        S.button({ label: "Reset names", icon: "refresh", onClick: () => store.set((x) => { for (const c of courses) { if (x.dashboard.courses[c.id]) delete x.dashboard.courses[c.id].nickname; } }) }),
      ]);
      results.appendChild(bulk);
    }
    search.addEventListener("input", draw);
    mount.appendChild(search);
    mount.appendChild(results);
    draw();
  }

  function renderCourseRow(store, c) {
    const S = BC.SettingsComponents;
    const s = store.get();
    const cur = (s.dashboard.courses && s.dashboard.courses[c.id]) || {};
    const write = (patch) => store.set((x) => {
      x.dashboard.courses[c.id] = Object.assign({}, x.dashboard.courses[c.id] || {}, patch);
    });

    // Five tracks, two of them 1fr, inside a ~300px row: the nickname field came
    // out six characters wide and the background-image field read "backgro". Two
    // lines instead, so the name gets the whole first line and the URL the whole
    // second. The colour uses the same swatch as every other colour in the panel
    // rather than a raw input, and Hide is the same switch as every other switch.
    const wrap = h("div.bc-course-row", null);

    const picker = el("input", { type: "color", value: cur.color || c.color || "#0374b5",
      "aria-label": "Colour for " + c.name });
    const swatch = h("label.bc-swatch.bc-course-swatch", { title: "Course colour" }, [picker]);
    swatch.style.background = cur.color || c.color || "";
    picker.addEventListener("input", () => { swatch.style.background = picker.value; write({ color: picker.value }); });

    const name = el("input", { type: "text", class: "bc-text bc-course-name",
      placeholder: c.name, value: cur.nickname || "", "aria-label": "Nickname for " + c.name });
    name.addEventListener("input", () => write({ nickname: name.value }));

    const hide = S.switch({
      get: () => !!((store.get().dashboard.courses || {})[c.id] || {}).hidden,
      set: (v) => write({ hidden: v }),
      ariaLabel: "Hide " + c.name,
    });

    const bg = el("input", { type: "url", class: "bc-text bc-course-bg",
      placeholder: "Card background image URL (optional)", value: cur.bgImage || "",
      "aria-label": "Background image for " + c.name });
    bg.addEventListener("input", () => write({ bgImage: bg.value.trim() }));

    wrap.appendChild(h("div.bc-course-main", null, [
      swatch, name,
      h("span.bc-course-hide", null, [h("span.bc-course-hide-label", null, "Hide"), hide]),
    ]));
    wrap.appendChild(bg);
    return wrap;
  }

  // Each progress style, drawn at 60% so the difference between them is the
  // thing on screen. These are deliberately the same class names the planner
  // widget uses, so a swatch cannot drift away from what it is advertising.
  // Layout previews. Same approach as the progress swatches: each option draws
  // its own shape, because "Compact / Cards / Minimal / Timeline" as four words
  // in a dropdown asks the reader to imagine four things they have never seen.
  // These are miniatures, not the real widget -- the real one needs live task
  // data, and a picker that renders nothing until tasks load is a picker that
  // looks broken every September.
  function layoutSwatch(style) {
    const row = (cls) => '<span class="bc-lsw-row ' + cls + '"><i></i><b></b></span>';
    if (style === "compact") return '<span class="bc-lsw compact">' + row("") + row("") + row("") + row("") + "</span>";
    if (style === "cards") return '<span class="bc-lsw cards">' + row("") + row("") + "</span>";
    if (style === "minimal") return '<span class="bc-lsw minimal">' + row("") + row("") + row("") + "</span>";
    if (style === "timeline") return '<span class="bc-lsw timeline">' + row("") + row("") + row("") + "</span>";
    return '<span class="bc-lsw comfortable">' + row("") + row("") + row("") + "</span>";
  }

  function progressSwatch(style) {
    if (style === "off") return '<span class="bc-sw-none">—</span>';
    if (style === "text") return '<span class="bc-sw-text"><b>6</b> of 10</span>';
    if (style === "ring") {
      const R = 9, C = 2 * Math.PI * R;
      return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="' + R + '" fill="none" stroke-width="2.5" class="bc-sw-track"/>' +
        '<circle cx="12" cy="12" r="' + R + '" fill="none" stroke-width="2.5" stroke-linecap="round"' +
        ' stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (C * 0.4).toFixed(2) + '"' +
        ' transform="rotate(-90 12 12)" class="bc-sw-fill"/></svg>';
    }
    if (style === "segments") {
      let out = "";
      for (let i = 0; i < 8; i++) out += '<span class="bc-sw-seg' + (i < 5 ? " on" : "") + '"></span>';
      return '<span class="bc-sw-segs">' + out + "</span>";
    }
    // bar and rainbow: same track, different fill.
    const rb = style === "rainbow";
    return '<span class="bc-sw-track-bar"><span class="bc-sw-bar' + (rb ? " rainbow" : "") +
      '" style="width:60%' + (rb ? "; background-size: 166.7% 100%" : "") + '"></span></span>';
  }

  function renderTodo(store) {
    const S = BC.SettingsComponents;
    const t = store.get().todo;
    const c = h("div.bc-tab-body", null);
    const planner = (st) => st.todo.mode === "custom";

    // "Mode" was a section holding one row called "To Do list style". The
    // section heading and the row label said the same thing twice, and the
    // section below it then had to explain in a sentence that it only applied
    // when this one was set to a particular value -- which enabledWhen now
    // shows rather than states.
    c.appendChild(S.section({ title: "Which planner", icon: "check-circle", children: [
      S.row({ label: "To Do list", icon: "list",
        control: S.select({ get: () => t.mode, set: (v) => store.set((x) => { x.todo.mode = v; }),
          options: [{value:"default",label:"Canvas's own"},{value:"clean",label:"Canvas, tidied"},{value:"custom",label:"Better Canvas planner"}] }) }),
    ]}));

    c.appendChild(S.section({ title: "How a task looks", icon: "timeline", children: [
      S.row({ label: "Layout", icon: "columns", wide: true, enabledWhen: planner,
        control: S.choice({
          ariaLabel: "Planner layout",
          get: () => t.layout,
          set: (v) => store.set((x) => { x.todo.layout = v; }),
          preview: layoutSwatch,
          options: [
            { value: "comfortable", label: "Comfortable" },
            { value: "compact",     label: "Compact" },
            { value: "cards",       label: "Cards" },
            { value: "minimal",     label: "Minimal" },
            { value: "timeline",    label: "Timeline" },
          ],
        }) }),
      // Each option draws itself at 60% progress, so the choice is made by
      // looking rather than by reading six adjectives in a dropdown.
      S.row({ label: "Progress", icon: "circle", wide: true, enabledWhen: planner,
        control: S.choice({
          ariaLabel: "Progress indicator style",
          get: () => t.progress,
          set: (v) => store.set((x) => { x.todo.progress = v; }),
          preview: progressSwatch,
          options: [
            { value: "ring",     label: "Ring" },
            { value: "bar",      label: "Bar" },
            { value: "segments", label: "Segments" },
            { value: "rainbow",  label: "Rainbow" },
            { value: "text",     label: "Text" },
            { value: "off",      label: "None" },
          ],
        }) }),
      S.row({ label: "Accent", icon: "target", enabledWhen: planner,
        control: S.color({ get: () => t.accent, set: (v) => store.set((x) => { x.todo.accent = v; }), allowEmpty: true }) }),
    ]}));

    c.appendChild(S.section({ title: "What it shows", icon: "checklist", children: [
      S.row({ label: "View", icon: "grid", enabledWhen: planner,
        control: S.select({ get: () => t.view, set: (v) => store.set((x) => { x.todo.view = v; }),
          // "Day" and "Week" were selectable but todo.js only ever rendered
          // list/kanban/timeblock, so picking them silently fell back to List.
          options: [{value:"list",label:"List"},{value:"kanban",label:"Kanban"},{value:"timeblock",label:"Time-block"}] }) }),
      S.row({ label: "How far ahead", icon: "clock", enabledWhen: planner,
        control: S.select({ get: () => String(t.rangeDays), set: (v) => store.set((x) => { x.todo.rangeDays = parseInt(v, 10); }),
          options: [{value:"3",label:"3 days"},{value:"7",label:"1 week"},{value:"14",label:"2 weeks"},{value:"30",label:"1 month"}] }) }),
      S.row({ label: "Group by", icon: "list", enabledWhen: planner,
        control: S.select({ get: () => t.groupBy, set: (v) => store.set((x) => { x.todo.groupBy = v; }),
          options: [{value:"day",label:"Day"},{value:"course",label:"Course"},{value:"priority",label:"Priority"},{value:"tag",label:"Tag"},{value:"none",label:"None"}] }) }),
      S.row({ label: "Keep finished tasks visible", icon: "check", enabledWhen: planner,
        control: S.switch({ get: () => t.showCompleted, set: (v) => store.set((x) => { x.todo.showCompleted = v; }) }) }),
      S.row({ label: "Add-a-task box", icon: "plus", enabledWhen: planner,
        control: S.switch({ get: () => t.allowNewTask, set: (v) => store.set((x) => { x.todo.allowNewTask = v; }) }) }),
      S.row({ label: "Tags", icon: "tag", wide: true, enabledWhen: planner,
        control: S.tags({ get: () => t.tags, set: (v) => store.set((x) => { x.todo.tags = v; }) }) }),
    ]}));

    c.appendChild(S.section({ title: "Streaks", icon: "flame", children: [
      S.row({ label: "Count a daily streak", icon: "flame",
        control: S.switch({ get: () => t.streaks.enabled, set: (v) => store.set((x) => { x.todo.streaks.enabled = v; }) }) }),
      S.row({ label: "Grace days", icon: "calendar", hint: "Days you can miss without losing it.", enabledWhen: (st) => st.todo.streaks.enabled,
        control: S.number({ get: () => t.streaks.graceDays, set: (v) => store.set((x) => { x.todo.streaks.graceDays = Math.max(0, v|0); }), min:0, max:14 }) }),
      S.row({ label: "Repairs a month", icon: "refresh", enabledWhen: (st) => st.todo.streaks.enabled,
        control: S.number({ get: () => t.streaks.repairsAvailable, set: (v) => store.set((x) => { x.todo.streaks.repairsAvailable = Math.max(0, v|0); }), min:0, max:31 }) }),
    ]}));

    const pom = (st) => st.todo.pomodoro.enabled;
    c.appendChild(S.section({ title: "Pomodoro", icon: "timer", children: [
      S.row({ label: "Pomodoro timer", icon: "timer",
        control: S.switch({ get: () => t.pomodoro.enabled, set: (v) => store.set((x) => { x.todo.pomodoro.enabled = v; }) }) }),
      S.row({ label: "Work", icon: "play", hint: "Minutes.", enabledWhen: pom,
        control: S.number({ get: () => t.pomodoro.workMin, set: (v) => store.set((x) => { x.todo.pomodoro.workMin = Math.max(1, v|0); }), min:1, max:180 }) }),
      S.row({ label: "Short break", icon: "pause", enabledWhen: pom,
        control: S.number({ get: () => t.pomodoro.shortBreakMin, set: (v) => store.set((x) => { x.todo.pomodoro.shortBreakMin = Math.max(1, v|0); }), min:1, max:60 }) }),
      S.row({ label: "Long break", icon: "stop", enabledWhen: pom,
        control: S.number({ get: () => t.pomodoro.longBreakMin, set: (v) => store.set((x) => { x.todo.pomodoro.longBreakMin = Math.max(1, v|0); }), min:1, max:120 }) }),
      S.row({ label: "Long break after", icon: "skip-forward", hint: "Pomodoros.", enabledWhen: pom,
        control: S.number({ get: () => t.pomodoro.longEvery, set: (v) => store.set((x) => { x.todo.pomodoro.longEvery = Math.max(1, v|0); }), min:1, max:12 }) }),
      S.row({ label: "Chime when it ends", icon: "speaker", enabledWhen: pom,
        control: S.switch({ get: () => t.pomodoro.sound, set: (v) => store.set((x) => { x.todo.pomodoro.sound = v; }) }) }),
    ]}));

    c.appendChild(renderRecurringEditor(store));
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
      S.button({ label: "Delete", icon: "trash", variant: "danger",
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

    const add = S.button({ label: "Add recurring task", icon: "plus", onClick: () => {
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
      title: "Recurring tasks", icon: "timer",
      description: "Daily, weekly or monthly. Each occurrence is ticked off on its own.",
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
    const set = (fn) => (v) => store.set((x) => fn(x, v));
    c.appendChild(contrastNotice(store));

    // "Dark mode" used to be a section whose first row was also called "Dark
    // mode", and "Light theme" was a whole card holding one dropdown. Both
    // choose what colour the page is, so they are one section and the rows are
    // named for what they answer rather than repeating the heading.
    c.appendChild(S.section({ title: "Colour", icon: "contrast", children: [
      S.row({ label: "Dark mode", icon: "moon",
        control: S.select({ get: () => t.darkMode, set: set((x, v) => { x.theming.darkMode = v; }),
          options: [{value:"off",label:"Off"},{value:"on",label:"On"},{value:"auto",label:"Match system"},{value:"scheduled",label:"On a schedule"}] }) }),
      S.row({ label: "Schedule", icon: "clock", wide: true, enabledWhen: (s) => s.theming.darkMode === "scheduled",
        control: h("div.bc-inline", null, [
          el("input", { type: "time", value: t.darkSchedule.start, "aria-label": "Dark mode starts", onchange: (e) => store.set((x) => { x.theming.darkSchedule.start = e.target.value; }) }),
          h("span", null, "to"),
          el("input", { type: "time", value: t.darkSchedule.end, "aria-label": "Dark mode ends", onchange: (e) => store.set((x) => { x.theming.darkSchedule.end = e.target.value; }) }),
        ]) }),
      S.row({ label: "Dark palette", icon: "palette",
        control: S.select({ get: () => t.darkTone, set: set((x, v) => { x.theming.darkTone = v; }),
          options: Object.entries(BC.DARK_TONES).map(([k, v]) => ({ value: k, label: v.label })) }) }),
      S.row({ label: "Light palette", icon: "image",
        control: S.select({ get: () => t.lightPreset, set: set((x, v) => { x.theming.lightPreset = v; }),
          options: Object.entries(BC.LIGHT_PRESETS).map(([k, v]) => ({ value: k, label: v.label })) }) }),
      S.row({ label: "Accent", icon: "target",
        control: S.color({ get: () => t.accentColor, set: set((x, v) => { x.theming.accentColor = v; }), allowEmpty: true }) }),
      S.row({ label: "Custom dark background", icon: "contrast",
        control: S.color({ get: () => t.darkBg, set: set((x, v) => { x.theming.darkBg = v; }), allowEmpty: true }) }),
    ]}));

    c.appendChild(S.section({ title: "Type", icon: "file-text", children: [
      // wide: a font stack is a sentence, and as a right-aligned control it was
      // an orphaned box under a hint with nothing above it to align to.
      S.row({ label: "Font", icon: "file-text", wide: true,
        control: S.text({ get: () => t.font, set: set((x, v) => { x.theming.font = v; }), placeholder: "Leave blank for the Canvas default — or e.g. Inter, system-ui, sans-serif" }) }),
      S.row({ label: "Size", icon: "bars",
        control: S.select({ get: () => t.fontSizeScale, set: set((x, v) => { x.theming.fontSizeScale = v; }),
          options: [{value:"xs",label:"XS"},{value:"s",label:"S"},{value:"m",label:"M"},{value:"l",label:"L"},{value:"xl",label:"XL"}] }) }),
      S.row({ label: "Line height", icon: "list", control: S.slider({ get: () => t.lineHeight, set: set((x, v) => { x.theming.lineHeight = v; }), min:1.1, max:2.0, step:0.05, format:(v)=>v.toFixed(2) }) }),
      S.row({ label: "Letter spacing", icon: "minus", control: S.slider({ get: () => t.letterSpacing, set: set((x, v) => { x.theming.letterSpacing = v; }), min:-1, max:3, step:0.1, format:(v)=>v.toFixed(1)+"px" }) }),
    ]}));

    c.appendChild(S.section({ title: "Shape", icon: "grid", children: [
      S.row({ label: "Density", icon: "columns",
        control: S.select({ get: () => t.density, set: set((x, v) => { x.theming.density = v; }),
          options: [{value:"compact",label:"Compact"},{value:"default",label:"Default"},{value:"spacious",label:"Spacious"},{value:"cozy",label:"Cozy"}] }) }),
      S.row({ label: "Corner radius", icon: "circle", control: S.slider({ get: () => t.radius, set: set((x, v) => { x.theming.radius = v; }), min:0, max:24, format:(v)=>v+"px" }) }),
      S.row({ label: "Round our own controls too", icon: "check-circle", control: S.switch({ get: () => t.roundedUI, set: set((x, v) => { x.theming.roundedUI = v; }) }) }),
      S.row({ label: "Sidebar width", icon: "columns", hint: "0 keeps Canvas's own width.",
        control: S.number({ get: () => t.sidebarWidth, set: set((x, v) => { x.theming.sidebarWidth = Math.max(0, v|0); }), min:0, max:400 }) }),
    ]}));

    // Accessibility was a tab of three switches, sitting one place away from the
    // colour-blind, high-contrast and reduced-motion switches it belongs beside.
    const a = store.get().accessibility;
    c.appendChild(S.section({ title: "Reading & access", icon: "accessibility", children: [
      S.row({ label: "Colour-blind mode", icon: "palette",
        control: S.select({ get: () => t.colorBlind, set: set((x, v) => { x.theming.colorBlind = v; }),
          options: [{value:"off",label:"Off"},{value:"protanopia",label:"Protanopia"},{value:"deuteranopia",label:"Deuteranopia"},{value:"tritanopia",label:"Tritanopia"}] }) }),
      S.row({ label: "High contrast", icon: "contrast", control: S.switch({ get: () => t.highContrast, set: set((x, v) => { x.theming.highContrast = v; }) }) }),
      S.row({ label: "Reduce motion", icon: "pause", control: S.switch({ get: () => t.reducedMotion, set: set((x, v) => { x.theming.reducedMotion = v; }) }) }),
      S.row({ label: "Animation speed", icon: "play", enabledWhen: (s) => !s.theming.reducedMotion,
        control: S.slider({ get: () => t.animSpeed, set: set((x, v) => { x.theming.animSpeed = v; }), min:0.25, max:2, step:0.05, format:(v)=>v.toFixed(2)+"×" }) }),
      S.row({ label: "Read aloud buttons", icon: "speaker", control: S.switch({ get: () => a.tts, set: set((x, v) => { x.accessibility.tts = v; }) }) }),
      S.row({ label: "Larger click targets", icon: "target", control: S.switch({ get: () => a.largeTargets, set: set((x, v) => { x.accessibility.largeTargets = v; }) }) }),
      S.row({ label: "Dyslexia-friendly font", icon: "file-text", control: S.switch({ get: () => a.dyslexiaFont, set: set((x, v) => { x.accessibility.dyslexiaFont = v; }) }) }),
      S.row({ label: "Cursor", icon: "search",
        control: S.select({ get: () => t.cursor, set: set((x, v) => { x.theming.cursor = v; }),
          options: [{value:"default",label:"Default"},{value:"large",label:"Large"},{value:"precise",label:"Crosshair"}] }) }),
      S.row({ label: "Focus ring", icon: "focus",
        control: S.select({ get: () => t.focusRing, set: set((x, v) => { x.theming.focusRing = v; }),
          options: [{value:"default",label:"Default"},{value:"bold",label:"Bold"},{value:"high-contrast",label:"High contrast"}] }) }),
    ]}));

    c.appendChild(S.section({ title: "Institution logo", icon: "image", children: [
      S.row({ label: "Show", icon: "image",
        control: S.select({ get: () => t.logo.mode, set: set((x, v) => { x.theming.logo.mode = v; }),
          options: [{value:"default",label:"As Canvas has it"},{value:"hide",label:"Hide it"},{value:"replace",label:"My image"},{value:"text",label:"My text"}] }) }),
      S.row({ label: "Image URL", icon: "external-link", wide: true, enabledWhen: (s) => s.theming.logo.mode === "replace",
        control: S.text({ get: () => t.logo.url, set: set((x, v) => { x.theming.logo.url = v; }), placeholder: "https://…" }) }),
      S.row({ label: "Text", icon: "file-text", wide: true, enabledWhen: (s) => s.theming.logo.mode === "text",
        control: S.text({ get: () => t.logo.text, set: set((x, v) => { x.theming.logo.text = v; }), placeholder: "e.g. Northeastern" }) }),
    ]}));

    return c;
  }

  function downloadJson(filename, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    // Revoking immediately races the download in Firefox, which reads the blob
    // asynchronously after the synthetic click returns.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function downloadTheme(bundle) {
    downloadJson(
      (bundle.name || "theme").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".bctheme.json",
      JSON.stringify(bundle, null, 2)
    );
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

  function skinCard(store, raw, opts) {
    const S = BC.SettingsComponents;
    const t = BC.skins.normalize(raw);
    if (!t) return null;
    const o = opts || {};
    const sw = BC.skins.swatchStyles(t, 4);
    const on = store.get().theming.skin === t.id;

    const page = h("div.bc-skin-page", null, sw.cards.map((style) => {
      const cell = h("div.bc-skin-cell", null);
      cell.style.cssText = style;
      return cell;
    }));
    page.style.cssText += sw.page;
    const rail = h("div.bc-skin-rail", null);
    rail.style.cssText = sw.nav;

    const dot = h("span.bc-skin-dot", null);
    dot.style.background = t.accent;
    const tags = t.tags.length ? h("span.bc-skin-tags", null, t.tags.join(" · ")) : null;

    const card = h("button.bc-skin-card" + (on ? ".bc-on" : ""), {
      type: "button",
      "aria-pressed": String(on),
      // What the tab search matches this card on. The author and the tags are in
      // here even though the card only prints the tags, so "catppuccin",
      // "gruvbox" and "rose pine" all find their family.
      "data-bc-filter": [t.name, t.author, t.dark ? "dark" : "light"].concat(t.tags).join(" "),
      // The name alone would read as "Matcha Strawberry" with no indication of
      // what the control does or whether it is the active one.
      "aria-label": (on ? "Applied skin: " : "Apply skin: ") + t.name +
        (t.dark ? ", dark" : ", light"),
      onclick: () => {
        store.set((x) => { x.theming.skin = on ? "" : t.id; });
        BC.toast && BC.toast.success(on ? "Skin removed" : "Applied " + t.name);
      },
    }, [
      h("div.bc-skin-mock", null, [rail, page]),
      h("div.bc-skin-meta", null, [
        h("div.bc-skin-line", null, [dot, h("span.bc-skin-name", null, t.name)]),
        tags,
      ]),
    ]);

    if (o.removable) {
      // Not inside the button: a button nested in a button is invalid markup and
      // the inner one stops receiving clicks in Safari.
      const del = S.button({
        label: "Delete", icon: "trash", variant: "ghost", title: "Delete " + t.name,
        onClick: () => store.set((x) => {
          x.theming.skins = (x.theming.skins || []).filter((k) => k.id !== t.id);
          // Deleting the skin that is applied has to clear the selection too,
          // or theming.skin points at nothing and the page silently unthemes
          // with the gallery still showing it as active.
          if (x.theming.skin === t.id) x.theming.skin = "";
        }),
      });
      del.classList.add("bc-skin-del");
      return h("div.bc-skin-slot", null, [card, del]);
    }
    return card;
  }

  function renderSkinGallery(store, c) {
    const S = BC.SettingsComponents;
    const t = store.get().theming;
    const mine = Array.isArray(t.skins) ? t.skins : [];

    const noneCard = h("button.bc-skin-card.bc-skin-none" + (t.skin ? "" : ".bc-on"), {
      type: "button", "aria-pressed": String(!t.skin), "aria-label": "No skin — plain Canvas",
      "data-bc-filter": "none plain canvas off",
      onclick: () => store.set((x) => { x.theming.skin = ""; }),
    }, [
      // icons.el, not icons.node -- the latter does not exist, and calling it
      // threw inside renderThemes, which left the whole tab rendering the
      // previous tab's body with no error surfaced anywhere.
      h("div.bc-skin-mock.bc-skin-empty", null, BC.icons.el("minus", { size: 20 })),
      h("div.bc-skin-meta", null, [h("span.bc-skin-name", null, "None")]),
    ]);

    // Three grids, not one. Forty-four cards under a single heading is a wall
    // you scroll past rather than a catalog you browse, and the two halves are
    // genuinely different things: the illustrated skins are drawn here, the rest
    // are ports of palettes people already know by name. Split by what you would
    // go looking for -- art, then dark, then light.
    const ported = (k) => (k.tags || []).indexOf("editor") >= 0 || k.author !== "Better Canvas";
    const own = BC.SKIN_CATALOG.filter((k) => !ported(k));
    const darkPorts = BC.SKIN_CATALOG.filter((k) => ported(k) && k.dark);
    const lightPorts = BC.SKIN_CATALOG.filter((k) => ported(k) && !k.dark);

    c.appendChild(S.section({
      title: "Illustrated", icon: "palette",
      description: "A whole look — surface art, card art, nav and type, not just colours. Every pattern is drawn here, so a skin works offline and downloads nothing.",
      children: [
        h("div.bc-skin-grid", null,
          [noneCard].concat(own.map((k) => skinCard(store, k, null)))),
      ],
    }));

    // The tab search reaches individual cards, so the count is worth stating:
    // it tells you the list is long enough to search rather than scroll.
    c.appendChild(S.section({
      title: "Dark palettes", icon: "contrast",
      description: darkPorts.length + " open-source colour schemes, ported. Search this tab by name, family or tag: catppuccin, gruvbox, retro.",
      children: [h("div.bc-skin-grid", null, darkPorts.map((k) => skinCard(store, k, null)))],
    }));

    c.appendChild(S.section({
      title: "Light palettes", icon: "sun",
      description: lightPorts.length + " of the same, for working in daylight.",
      children: [h("div.bc-skin-grid", null, lightPorts.map((k) => skinCard(store, k, null)))],
    }));

    if (mine.length) {
      c.appendChild(S.section({
        title: "My skins", icon: "star",
        description: "Yours. One with the same name as a built-in replaces it.",
        children: [h("div.bc-skin-grid", null, mine.map((k) => skinCard(store, k, { removable: true })))],
      }));
    }

    const active = BC.skins.active(store.get());
    c.appendChild(S.section({
      title: "Skin options", icon: "settings",
      children: [
        S.row({
          label: "Course card colour",
          icon: "palette",
          hint: "Replace them, or let the pattern tint them.",
          enabledWhen: (st) => !!st.theming.skin,
          control: S.select({
            get: () => (active && active.cardColor) || "skin",
            set: (v) => store.set((x) => {
              // Changing this on a built-in forks it into the user's own list:
              // the catalog is shipped data and editing it in place would be
              // undone by the next update.
              const cur = BC.skins.active(x);
              if (!cur) return;
              const forked = Object.assign(BC.skins.normalize(cur), { cardColor: v });
              const mineNow = (x.theming.skins || []).filter((k) => k.id !== forked.id);
              x.theming.skins = mineNow.concat([forked]);
            }),
            options: [{ value: "skin", label: "Use the skin's colours" },
                      { value: "course", label: "Keep course colours" }],
          }),
        }),
        h("div.bc-inline", null, [
          S.button({ label: "Export skin", icon: "external-link", onClick: () => {
            const cur = BC.skins.active(store.get());
            if (!cur) { BC.toast && BC.toast.error("No skin applied"); return; }
            downloadJson(cur.id + ".skin.json", BC.skins.export(cur));
          } }),
          S.button({ label: "Import skin", icon: "folder", onClick: () => {
            const inp = document.createElement("input");
            inp.type = "file"; inp.accept = "application/json";
            inp.onchange = () => {
              const f = inp.files && inp.files[0];
              if (!f) return;
              f.text().catch(() => null).then((txt) => {
                const skin = txt == null ? null : BC.skins.import(txt);
                if (!skin) { BC.toast && BC.toast.error("That is not a skin file"); return; }
                store.set((x) => {
                  x.theming.skins = (x.theming.skins || []).filter((k) => k.id !== skin.id).concat([skin]);
                  x.theming.skin = skin.id;
                });
                BC.toast && BC.toast.success("Imported " + skin.name);
              });
            };
            inp.click();
          } }),
        ]),
      ],
    }));
  }

  function renderThemes(store) {
    const S = BC.SettingsComponents;
    const c = h("div.bc-tab-body", null);
    const custom = store.get().customThemes || [];

    renderSkinGallery(store, c);

    const nameInput = el("input", { type: "text", class: "bc-text", placeholder: "Theme name" });
    c.appendChild(S.section({
      title: "My themes", icon: "star",
      description: "Set up a look in Appearance, then save it here.",
      children: [
        custom.length
          ? h("div.bc-theme-grid", null, custom.map((p) => themeCard(store, p, true)))
          : h("p.bc-hint", null, "Nothing saved yet."),
        h("div.bc-inline", { style: { marginTop: "10px" } }, [
          nameInput,
          S.button({ label: "Save current look", icon: "palette", onClick: () => {
            const name = nameInput.value.trim() || "My theme";
            const bundle = themeSnapshot(store, name);
            store.set((x) => { x.customThemes = (x.customThemes || []).concat([bundle]); });
            BC.toast && BC.toast.success("Saved theme: " + name);
          } }),
        ]),
      ],
    }));

    c.appendChild(S.section({
      title: "Built-in themes", icon: "palette",
      description: "One click, over whatever you have now.",
      children: [h("div.bc-theme-grid", null, BC.PRESET_THEMES.map((p) => themeCard(store, p, false)))],
    }));

    const rot = store.get().theming.rotation || { enabled: false, mode: "daily", themeIds: [] };
    const pool = custom.concat(BC.PRESET_THEMES || []);
    c.appendChild(S.section({
      title: "Rotation", icon: "refresh",
      children: [
        S.row({ label: "Change theme on a timer", icon: "clock",
          control: S.switch({ get: () => rot.enabled, set: (v) => store.set((x) => { x.theming.rotation.enabled = v; }) }) }),
        S.row({ label: "Every", icon: "calendar", enabledWhen: (st) => !!(st.theming.rotation || {}).enabled,
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
      title: "Share", icon: "external-link",
      description: "A theme is a JSON file. No account, no cloud.",
      children: [
        h("div.bc-inline", null, [
          S.button({ label: "Export current theme", icon: "external-link", onClick: () => downloadTheme(themeSnapshot(store, "My theme")) }),
          S.button({ label: "Import theme", icon: "folder", onClick: () => {
            const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json";
            inp.onchange = () => {
              const f = inp.files && inp.files[0]; if (!f) return;
              f.text().catch(() => null).then((txt) => {
                if (txt == null) { BC.toast && BC.toast.error("Couldn't read that file"); return; }
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
    // Nine rows used to show at once, of which at most three ever applied: the
    // gradient stops were live while the mode was "Image", the image URL was
    // live while the mode was "None". Each row is now tied to the mode that
    // uses it, so choosing one reveals its own three controls and no others.
    const mode = (...ms) => (st) => ms.includes(st.cosmetics.background.mode);
    c.appendChild(S.section({ title: "Page background", icon: "image", children: [
      S.row({ label: "Style", icon: "palette",
        control: S.select({ get: () => b.mode, set: (v) => store.set((x) => { x.cosmetics.background.mode = v; }),
          options: [{value:"none",label:"None"},{value:"color",label:"Solid"},{value:"gradient",label:"Gradient"},{value:"image",label:"Image"},{value:"pattern",label:"Pattern"}] }) }),
      S.row({ label: "Colour", icon: "target", enabledWhen: mode("color", "pattern"),
        control: S.color({ get: () => b.color, set: (v) => store.set((x) => { x.cosmetics.background.color = v; }) }) }),
      S.row({ label: "From", icon: "chevron-right", enabledWhen: mode("gradient"),
        control: S.color({ get: () => b.gradient.from, set: (v) => store.set((x) => { x.cosmetics.background.gradient.from = v; }) }) }),
      S.row({ label: "To", icon: "chevron-left", enabledWhen: mode("gradient"),
        control: S.color({ get: () => b.gradient.to, set: (v) => store.set((x) => { x.cosmetics.background.gradient.to = v; }) }) }),
      S.row({ label: "Angle", icon: "refresh", enabledWhen: mode("gradient"),
        control: S.slider({ get: () => b.gradient.angle, set: (v) => store.set((x) => { x.cosmetics.background.gradient.angle = v; }), min:0, max:360, format:(v)=>v+"°" }) }),
      S.row({ label: "Image", icon: "external-link", wide: true, enabledWhen: mode("image"),
        control: S.text({ get: () => b.image, set: (v) => store.set((x) => { x.cosmetics.background.image = v; }), placeholder:"https://…" }) }),
      S.row({ label: "Pattern", icon: "grid", enabledWhen: mode("pattern"),
        control: S.select({ get: () => b.pattern, set: (v) => store.set((x) => { x.cosmetics.background.pattern = v; }),
          options: [{value:"none",label:"None"},{value:"dots",label:"Dots"},{value:"grid",label:"Grid"},{value:"diagonal",label:"Diagonal"},{value:"topography",label:"Topography"}] }) }),
      S.row({ label: "Blur", icon: "contrast", enabledWhen: mode("color", "gradient", "image", "pattern"),
        control: S.slider({ get: () => b.blur, set: (v) => store.set((x) => { x.cosmetics.background.blur = v; }), min:0, max:40, format:(v)=>v+"px" }) }),
      S.row({ label: "Opacity", icon: "circle", enabledWhen: mode("color", "gradient", "image", "pattern"),
        control: S.slider({ get: () => b.opacity, set: (v) => store.set((x) => { x.cosmetics.background.opacity = v; }), min:0, max:100, format:(v)=>v+"%" }) }),
    ]}));
    c.appendChild(S.section({ title: "Custom CSS", icon: "command",
      description: "Injected on every Canvas page. An escape hatch — you can break the page with it.",
      children: [
        h("div.bc-css-wrap", null, [
          S.textarea({ get: () => store.get().cosmetics.customCss, set: (v) => store.set((x) => { x.cosmetics.customCss = v; }), placeholder: "/* your CSS */", rows: 10 }),
        ]),
      ]}));
    return c;
  }

  function renderNavigation(store) {
    const S = BC.SettingsComponents;
    const s = store.get();
    const c = h("div.bc-tab-body", null);
    const csv = (get, set) => S.text({ get, set, placeholder: "e.g. grades, files, syllabus" });

    c.appendChild(S.section({ title: "Canvas's left nav", icon: "menu",
      description: "Drag to reorder, switch off to hide.",
      children: [renderNavList(store, "global")] }));

    c.appendChild(S.section({ title: "Course nav", icon: "columns",
      description: "By label, applied to every course.",
      children: [
        S.row({ label: "Hide these", icon: "close", wide: true,
          control: csv(() => (s.navigation.course.hidden || []).join(", "),
            (v) => store.set((x) => { x.navigation.course.hidden = v.split(",").map(s => s.trim().toLowerCase()).filter(Boolean); })) }),
        S.row({ label: "Put them in this order", icon: "list", wide: true,
          control: csv(() => (s.navigation.course.order || []).join(", "),
            (v) => store.set((x) => { x.navigation.course.order = v.split(",").map(s => s.trim().toLowerCase()).filter(Boolean); })) }),
        S.row({ label: "Links of your own", icon: "paperclip", wide: true,
          control: S.links({ get: () => s.navigation.course.customLinks, set: (v) => store.set((x) => { x.navigation.course.customLinks = v; }) }) }),
      ]}));

    c.appendChild(S.section({ title: "Getting around", icon: "arrow-right", children: [
      S.row({ label: "Course quick-switch bar", icon: "columns",
        control: S.switch({ get: () => s.navigation.courseTabs, set: (v) => store.set((x) => { x.navigation.courseTabs = v; }) }) }),
      S.row({ label: "Command palette", icon: "command", hint: "⌘K, or Ctrl-K.",
        control: S.switch({ get: () => s.navigation.quickSearch, set: (v) => store.set((x) => { x.navigation.quickSearch = v; }) }) }),
      S.row({ label: "Breadcrumbs", icon: "chevron-right",
        control: S.select({ get: () => s.navigation.breadcrumbs, set: (v) => store.set((x) => { x.navigation.breadcrumbs = v; }),
          options: [{value:"default",label:"Default"},{value:"compact",label:"Compact"},{value:"hidden",label:"Hidden"}] }) }),
      S.row({ label: "Links of your own", icon: "external-link", wide: true,
        control: S.links({ get: () => s.navigation.global.customLinks, set: (v) => store.set((x) => { x.navigation.global.customLinks = v; }) }) }),
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
        // The same switch as every other on/off in the panel. This was the last
        // native checkbox left, so it rendered in the system blue against a warm
        // accent, and the section above it already said "switch off to hide".
        row.appendChild(S.switch({
          get: () => !(new Set(store.get().navigation[scope].hidden || [])).has(it.key),
          set: (on) => store.set((x) => {
            const next = new Set(x.navigation[scope].hidden || []);
            if (on) next.delete(it.key); else next.add(it.key);
            x.navigation[scope].hidden = Array.from(next);
          }),
          ariaLabel: "Show " + it.label,
        }));
        return row;
      },
      onChange: (ids) => store.set((x) => { x.navigation[scope].order = ids; }),
    });
  }

  function renderGrades(store, adapter) {
    const S = BC.SettingsComponents;
    const g = store.get().grades;
    const c = h("div.bc-tab-body", null);
    const sw = (k) => S.switch({ get: () => g[k], set: (v) => store.set((x) => { x.grades[k] = v; }) });

    c.appendChild(S.section({ title: "On the grades page", icon: "bars", children: [
      S.row({ label: "Grade tools panel", icon: "target", hint: "Goal tracker, what-if scores, and what you need on the final.",
        control: sw("panelEnabled") }),
      S.row({ label: "Trend chart", icon: "trend", control: sw("showTrendChart") }),
      S.row({ label: "Weight donut", icon: "circle", control: sw("showWeightDonut") }),
      S.row({ label: "Missing-work warning", icon: "alert", control: sw("showMissingWarning") }),
      S.row({ label: "Rubric predictor", icon: "checklist", hint: "On an assignment, slide each criterion to see the projected score.",
        control: sw("rubricPredictor") }),
    ]}));

    c.appendChild(S.section({ title: "Refresh", icon: "refresh", children: [
      S.row({ label: "Reload grades while the page is open", icon: "refresh", control: sw("autoRefresh") }),
      S.row({ label: "How often", icon: "clock", hint: "Minutes.", enabledWhen: (st) => st.grades.autoRefresh,
        control: S.number({ get: () => g.autoRefreshMin, set: (v) => store.set((x) => { x.grades.autoRefreshMin = Math.max(1, v|0); }), min:1, max:60 }) }),
    ]}));

    c.appendChild(S.section({ title: "GPA", icon: "mortarboard", children: [
      S.row({ label: "Scale", icon: "bars",
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
    mount.innerHTML = "";
    const s = store.get();
    const bands = (BC.GPA_SCALES[s.grades.gpaScale] || BC.GPA_SCALES["standard-4"]).bands;
    let total = 0, points = 0;

    // Was a bare <table>, which is a different visual language from every other
    // panel here and wrapped each course name over three lines. Rows instead, on
    // the same grid as the rest of the panel, with the name on one line and the
    // figures in a tabular group that stays aligned down the column.
    const list = h("div.bc-gpa", null, [
      h("div.bc-gpa-head", null, [
        h("span", null, "Course"),
        h("span.bc-gpa-figs", null, [h("span", null, "Score"), h("span", null, "Grade"), h("span", null, "Pts")]),
        h("span.bc-gpa-credlabel", null, "Credits"),
      ]),
    ]);

    for (const cr of courses) {
      const cred = s.grades.creditsByCourse[cr.id] != null ? s.grades.creditsByCourse[cr.id] : 3;
      let letter = "—", pts = 0;
      if (cr.score != null) { const band = bands.find((b) => cr.score >= b.min); letter = band.letter; pts = band.points; }
      const credInput = el("input", { type: "number", min: 0, step: 0.5, value: cred,
        class: "bc-number bc-gpa-cred", "aria-label": "Credits for " + cr.name });
      credInput.addEventListener("input", () => store.set((x) => {
        x.grades.creditsByCourse[cr.id] = parseFloat(credInput.value) || 0;
      }));
      // title, because the name truncates: a course code plus a title does not
      // fit a 300px column and wrapping it was what made each row three lines.
      const nameEl = h("span.bc-gpa-name", { title: cr.name }, cr.name);
      list.appendChild(h("div.bc-gpa-row" + (cr.concluded ? ".bc-concluded" : ""), null, [
        nameEl,
        h("span.bc-gpa-figs", null, [
          h("span", null, cr.score == null ? "—" : cr.score.toFixed(1) + "%"),
          h("span.bc-gpa-letter", { "data-grade": letter.charAt(0).toLowerCase() }, letter),
          h("span", null, pts.toFixed(2)),
        ]),
        credInput,
      ]));
      if (cr.score != null && cred > 0) { points += pts * cred; total += cred; }
    }
    mount.appendChild(list);

    const gpa = total > 0 ? (points / total).toFixed(3) : "—";
    mount.appendChild(h("div.bc-gpa-total", null, [
      h("span.bc-gpa-figure", null, gpa),
      h("span.bc-gpa-total-sub", null, total + " credit hours · set credits to 0 to exclude a course"),
    ]));
  }

  function renderNotifications(store) {
    const S = BC.SettingsComponents;
    const n = store.get().notifications;
    const c = h("div.bc-tab-body", null);
    const tsw = (k) => S.switch({ get: () => n.types[k], set: (v) => store.set((x) => { x.notifications.types[k] = v; }) });

    c.appendChild(S.section({ title: "How you hear about it", icon: "bell", children: [
      S.row({ label: "Browser notifications", icon: "bell", hint: "Asks permission the first time.",
        control: S.switch({ get: () => n.enabled, set: (v) => store.set((x) => { x.notifications.enabled = v; }) }) }),
      S.row({ label: "In-page toasts", icon: "megaphone",
        control: S.switch({ get: () => n.inPage, set: (v) => store.set((x) => { x.notifications.inPage = v; }) }) }),
      S.row({ label: "Toolbar badge", icon: "tag", hint: "Counts what is due in 24 hours.",
        control: S.switch({ get: () => n.badgeCount, set: (v) => store.set((x) => { x.notifications.badgeCount = v; }) }) }),
    ]}));

    c.appendChild(S.section({ title: "What you hear about", icon: "checklist", children: [
      S.row({ label: "Something is due", icon: "clock", control: tsw("dueSoon") }),
      S.row({ label: "A grade is posted", icon: "bars", control: tsw("newGrade") }),
      S.row({ label: "A new announcement", icon: "megaphone", control: tsw("newAnnouncement") }),
      S.row({ label: "A grade goal is missed", icon: "target", control: tsw("goalBreach") }),
      S.row({ label: "A streak is at risk", icon: "flame", control: tsw("streakAtRisk") }),
    ]}));

    c.appendChild(S.section({ title: "When", icon: "clock", children: [
      S.row({ label: "Warn me this far ahead", icon: "timer", hint: "Minutes before it is due, separated by commas.", wide: true,
        control: S.text({ get: () => (n.leadMinutes || []).join(", "), placeholder: "60, 240, 1440",
          set: (v) => store.set((x) => { x.notifications.leadMinutes = v.split(",").map(s => parseInt(s.trim(), 10)).filter(n => n > 0); }) }) }),
      S.row({ label: "Quiet hours", icon: "moon",
        control: S.switch({ get: () => n.quietHours.enabled, set: (v) => store.set((x) => { x.notifications.quietHours.enabled = v; }) }) }),
      S.row({ label: "Quiet from", icon: "pause", wide: true, enabledWhen: (s) => s.notifications.quietHours.enabled,
        control: h("div.bc-inline", null, [
          el("input", { type: "time", value: n.quietHours.start, "aria-label": "Quiet hours start", onchange: (e) => store.set((x) => { x.notifications.quietHours.start = e.target.value; }) }),
          h("span", null, "to"),
          el("input", { type: "time", value: n.quietHours.end, "aria-label": "Quiet hours end", onchange: (e) => store.set((x) => { x.notifications.quietHours.end = e.target.value; }) }),
        ]) }),
    ]}));

    // Every notification already gets recorded to bcLocal.notifHistory and pruned
    // to the last 100, but nothing ever displayed it, so the writes bought
    // nothing. A dismissed toast is otherwise gone for good.
    const histMount = h("div", null);
    c.appendChild(histMount);
    renderNotifHistory(histMount, store);
    return c;
  }

  function renderNotifHistory(mount, store) {
    const S = BC.SettingsComponents;
    const draw = (local) => {
      const items = (local && local.notifHistory) || [];
      const children = items.slice(0, 20).map((e) => h("div.bc-ins-row", null, [
        h("span", null, e.title || e.type || "Notification"),
        h("span.bc-ins-val", null, e.iso ? BC.dt.relative(e.iso) : ""),
      ]));
      if (!children.length) {
        children.push(h("p.bc-hint", null, "Nothing yet. Reminders you receive will be listed here."));
      } else {
        children.push(h("div.bc-inline", null, [
          S.button({
            label: "Clear history", variant: "ghost",
            onClick: () => {
              const adapter = store.adapter || {};
              if (!adapter.getLocal || !adapter.saveLocal) return;
              Promise.resolve(adapter.getLocal()).then((l) => {
                const next = Object.assign({}, l || {}, { notifHistory: [] });
                return adapter.saveLocal(next);
              }).then(() => {
                draw({ notifHistory: [] });
                BC.toast && BC.toast.info("Notification history cleared");
              }).catch(() => BC.toast && BC.toast.error("Couldn't clear the history"));
            },
          }),
        ]));
      }
      mount.replaceChildren(S.section({
        title: "Recent notifications",
        description: "The last 100, on this device only.",
        children,
      }));
    };

    const adapter = store.adapter || {};
    if (adapter.getLocal) Promise.resolve(adapter.getLocal()).then(draw).catch(() => draw(null));
    else draw(null);
  }

  // Files, Calendar, Announcements, Modules, Discussions and the instructor
  // helpers were six tabs holding sixteen rows between them -- four of them had
  // one section with one switch in it. They are all "things Better Canvas adds
  // to a course page", so they are one tab with six sections instead.
  function renderCourseTools(store) {
    const S = BC.SettingsComponents;
    const s = store.get();
    const c = h("div.bc-tab-body", null);
    const sw = (path, get) => S.switch({ get, set: (v) => store.set((x) => { path(x, v); }) });

    c.appendChild(S.section({ title: "Files", icon: "folder", children: [
      S.row({ label: "Cross-course file library", icon: "archive", hint: "One searchable panel for every course's files.",
        control: sw((x, v) => { x.files.enabled = v; }, () => s.files.enabled) }),
    ]}));

    c.appendChild(S.section({ title: "Calendar", icon: "calendar", children: [
      S.row({ label: "Mini month on the dashboard", icon: "calendar",
        control: sw((x, v) => { x.calendar.miniOnDashboard = v; }, () => s.calendar.miniOnDashboard) }),
      S.row({ label: "Read dates out of the syllabus", icon: "file-text", hint: "Offers what it finds; adds nothing on its own.",
        control: sw((x, v) => { x.calendar.syllabusExtract = v; }, () => s.calendar.syllabusExtract) }),
      S.row({ label: "Export upcoming work", icon: "save",
        control: S.button({ label: ".ics file", icon: "external-link", onClick: () => {
          if (!BC.calendar || !BC.calendar.exportIcs) { BC.toast.warn("Open a Canvas tab to export"); return; }
          BC.calendar.exportIcs();
        } }) }),
    ]}));

    c.appendChild(S.section({ title: "Announcements", icon: "megaphone", children: [
      S.row({ label: "Aggregate every course into one list", icon: "list",
        control: sw((x, v) => { x.announcements.aggregator = v; }, () => s.announcements.aggregator) }),
    ]}));

    c.appendChild(S.section({ title: "Modules", icon: "checklist", children: [
      S.row({ label: "Completion bars", icon: "bars", hint: "Per module, plus a total for the course.",
        control: sw((x, v) => { x.modules.progressBars = v; }, () => s.modules.progressBars) }),
    ]}));

    c.appendChild(S.section({ title: "Discussions", icon: "megaphone", children: [
      S.row({ label: "Collapse all replies", icon: "minus",
        control: sw((x, v) => { x.discussions.collapse = v; }, () => s.discussions.collapse) }),
      S.row({ label: "Jump to next unread", icon: "arrow-right",
        control: sw((x, v) => { x.discussions.jumpToUnread = v; }, () => s.discussions.jumpToUnread) }),
      S.row({ label: "Reply and word counts", icon: "file-text",
        control: sw((x, v) => { x.discussions.wordCount = v; }, () => s.discussions.wordCount) }),
      S.row({ label: "Mark instructor posts", icon: "mortarboard",
        control: sw((x, v) => { x.discussions.instructorHighlight = v; }, () => s.discussions.instructorHighlight) }),
    ]}));

    c.appendChild(S.section({
      title: "Teaching", icon: "mortarboard",
      description: "For teacher and TA roles. Nothing here ever writes back to Canvas.",
      children: [
        S.row({ label: "Roster CSV export", icon: "sheet",
          control: sw((x, v) => { x.instructor.rosterExport = v; }, () => s.instructor.rosterExport) }),
        S.row({ label: "Attendance quick-mark", icon: "check-circle", hint: "P/A buttons on People, stored on this device.",
          control: sw((x, v) => { x.instructor.attendanceQuick = v; }, () => s.instructor.attendanceQuick) }),
        S.row({ label: "Needs-grading badges", icon: "flag",
          control: sw((x, v) => { x.instructor.bulkGradeHelpers = v; }, () => s.instructor.bulkGradeHelpers) }),
      ],
    }));
    return c;
  }

  function renderProductivity(store) {
    const S = BC.SettingsComponents;
    const p = store.get().productivity;
    const c = h("div.bc-tab-body", null);
    const sw = (k) => S.switch({ get: () => p[k], set: (v) => store.set((x) => { x.productivity[k] = v; }) });

    c.appendChild(S.section({ title: "While you work", icon: "timer", children: [
      S.row({ label: "Focus mode", icon: "target", hint: "Strips everything but the assignment you are on.", control: sw("focusMode") }),
      S.row({ label: "Sticky notes", icon: "save", hint: "Pinned per page, kept on this device.", control: sw("stickyNotes") }),
      S.row({ label: "Print-friendly view", icon: "file-text", control: sw("printFriendly") }),
      S.row({ label: "Copy-link button", icon: "paperclip", control: sw("copyUrlButton") }),
    ]}));

    c.appendChild(S.section({ title: "Reading", icon: "file-text", children: [
      S.row({ label: "Reading ruler", icon: "minus", control: sw("readingRuler") }),
      S.row({ label: "Reading progress bar", icon: "bars", control: sw("readingProgress") }),
    ]}));

    c.appendChild(S.section({ title: "Writing", icon: "paperclip", children: [
      S.row({ label: "Auto-save drafts", icon: "save", hint: "Every Canvas text box, restored next visit.", control: sw("autoSaveDrafts") }),
      S.row({ label: "Word and character count", icon: "sheet", control: sw("wordCount") }),
      S.row({ label: "Quiz draft saver", icon: "alert", hint: "Keeps your answers locally so a crash can't wipe them. It never answers or submits.", control: sw("quizDraftSaver") }),
    ]}));
    return c;
  }

  function renderShortcuts(store) {
    const S = BC.SettingsComponents;
    const sh = store.get().shortcuts;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({ title: "Keyboard", icon: "command", children: [
      S.row({ label: "Shortcuts on", icon: "command",
        control: S.switch({ get: () => sh.enabled, set: (v) => store.set((x) => { x.shortcuts.enabled = v; }) }) }),
    ]}));
    // The mark is the action, so a rail of eleven monospace chips is scannable
    // by what it does rather than by reading ten near-identical phrases.
    const ACTIONS = [
      ["commandPalette", "Command palette", "search"],
      ["settings",       "Settings",        "settings"],
      ["toggleDark",     "Dark mode",       "moon"],
      ["focusMode",      "Focus mode",      "target"],
      ["quickTask",      "New task",        "check-circle"],
      ["quickNote",      "New note",        "save"],
      ["gotoDashboard",  "Dashboard",       "grid"],
      ["gotoGrades",     "Grades",          "bars"],
      ["gotoInbox",      "Inbox",           "megaphone"],
      ["gotoCalendar",   "Calendar",        "calendar"],
    ];
    c.appendChild(S.section({
      title: "Bindings", icon: "checklist",
      description: "Click one and press the keys. Escape cancels.",
      children: ACTIONS.map(([id, label, icon]) => S.row({
        label, icon, enabledWhen: (st) => st.shortcuts.enabled,
        control: S.keybind({ get: () => sh.bindings[id], set: (v) => store.set((x) => { x.shortcuts.bindings[id] = v; }) }),
      })),
    }));
    return c;
  }

  function renderInsights(store, adapter) {
    const S = BC.SettingsComponents;
    const c = h("div.bc-tab-body", null);
    c.appendChild(S.section({
      title: "Tracking", icon: "trend",
      description: "Computed and stored on this device. Nothing is ever uploaded.",
      children: [
        S.row({ label: "Time on Canvas", icon: "timer", hint: "Minutes per course, while a Canvas tab is in front.",
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
      title: "Time on Canvas — last 14 days", icon: "clock",
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
      title: "Pomodoro — last 7 days", icon: "timer",
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
        // Tokens, not literals: these are the only two colours in the settings
        // UI that were pinned to light-mode hues, so the trend arrows stayed
        // bright green/red on a dark surface.
        const color = delta >= 0 ? "var(--bc-success)" : "var(--bc-danger)";
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
      title: "Grade trends", icon: "trend",
      children: trendRows.length ? trendRows
        : [h("p.bc-hint", null, "Visit your course grade pages a few times to build up trend history.")],
    }));
  }

  function renderAbout(store) {
    const S = BC.SettingsComponents;
    const c = h("div.bc-tab-body", null);
    // Two paragraphs restating the feature list, to a reader who is already
    // inside the settings panel. What actually belongs here is the promise and
    // the version.
    c.appendChild(S.section({
      title: "Better Canvas " + (BC.VERSION || ""), icon: "info",
      children: [
        S.row({ label: "Everything stays here", icon: "save",
          hint: "No account, no server, no telemetry. Settings live in this browser.",
          control: h("span.bc-hint", null, "Local") }),
        S.row({ label: "Canvas is read with your own session", icon: "mortarboard",
          hint: "Same-origin requests only. Nothing is sent off-domain.",
          control: h("span.bc-hint", null, "Same-origin") }),
        S.row({ label: "Start over", icon: "refresh",
          control: S.button({ label: "Reset everything", icon: "trash", variant: "danger",
            onClick: () => { if (confirm("Reset ALL settings?")) store.reset(); } }) }),
      ],
    }));
    c.appendChild(renderDiagnostics(store));
    return c;
  }

  function renderDiagnostics(store) {
    const S = BC.SettingsComponents;
    const entries = (BC.diag && BC.diag.entries) ? BC.diag.entries.slice().reverse().slice(0, 15) : null;
    const children = [];

    if (!entries) {
      // The options page is a different JS realm, so it has its own empty BC.diag.
      children.push(h("p.bc-hint", null, "Open the settings drawer on a Canvas page to see diagnostics."));
    } else if (!entries.length) {
      children.push(h("p.bc-hint", null, "No errors recorded."));
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
            if (!navigator.clipboard) { BC.toast && BC.toast.error("Clipboard unavailable here"); return; }
            navigator.clipboard.writeText(text)
              .then(() => BC.toast && BC.toast.success("Diagnostics copied"))
              .catch(() => BC.toast && BC.toast.error("Couldn't copy diagnostics"));
          },
        }),
        S.button({ label: "Clear", variant: "ghost", onClick: () => { BC.diag.clear(); BC.toast && BC.toast.info("Diagnostics cleared"); } }),
      ]));
    }

    return S.section({
      title: "Diagnostics",
      description: "Recent internal errors, kept locally so you can report one. Nothing is uploaded.",
      children,
    });
  }

  // ---- import/export/search ---------------------------------------------

  function searchInput(store, onChange) {
    const inp = el("input", { type: "search", class: "bc-search", placeholder: "Search this tab…", "aria-label": "Search settings in this tab" });
    inp.addEventListener("input", () => onChange && onChange(inp.value));
    const ic = h("span.bc-search-ic", { "aria-hidden": "true" }, null);
    ic.innerHTML = BC.icons.svg("search", { size: 15 });
    return h("div.bc-search-wrap", null, [ic, inp]);
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
      f.text().catch(() => null).then((txt) => {
        if (txt == null) { BC.toast && BC.toast.error("Couldn't read that file"); return; }
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
  /* ============================================================================
     The settings surface.

     Direction: warm paper, not a control panel. Three things carry it and every
     rule below serves one of them.

     1. One mark per row. A tab of fourteen switches was fourteen identical
        rectangles separated by hairlines -- a spreadsheet, findable only by
        reading every label. Each row now leads with a drawn icon in a tile, and
        the tile column is what gives the list a rhythm, so the hairlines could
        go entirely.
     2. Air on the panel scale, not the component scale. Cards were padded at
        14px and rows at 6px, the bottom of the spacing ladder. --bc-pad-card
        and --bc-pad-row exist so those two measurements are named and set once.
     3. One bar of chrome. Brand, master switch, search, history and the
        destructive actions were spread over two stacked bars that ate 130px
        before any setting, and the second one overflowed its own right edge.
     ========================================================================== */
  .bc-app {
    --bg:     var(--bc-surface-1, #f5f1ea);
    --panel:  var(--bc-surface-2, #fffdf9);
    --fg:     var(--bc-text, #1d1a16);
    --muted:  var(--bc-muted, #6b6155);
    --border: var(--bc-border, #e3dacc);
    --accent: var(--bc-accent, #a8452c);
    --danger: var(--bc-danger, #b91c1c);
    --radius: var(--bc-radius-lg, 10px);
    font-family: var(--bc-font-sans, ui-rounded, "SF Pro Rounded", system-ui, sans-serif);
    font-size: var(--bc-text-md, 14px);
    line-height: var(--bc-leading-body, 1.5);
    letter-spacing: var(--bc-tracking, 0px);
    color: var(--fg); background: var(--bg);
    min-height: 100%;
    box-sizing: border-box;
  }
  .bc-app * { box-sizing: border-box; }
  /* Inside a shadow root with 'all: initial' the UA ring often doesn't render. */
  .bc-app :focus-visible {
    outline: 2px solid var(--bc-focus-ring, var(--accent));
    outline-offset: 2px;
    box-shadow: 0 0 0 4px var(--bc-focus-halo, var(--panel));
  }
  .bc-sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  /* ---- header: one bar ---------------------------------------------------
     grid rather than flex with justify-content: the search is the only track
     allowed to take the slack (minmax(0,1fr)) and the only one allowed to
     shrink, which is what stopped Redo being clipped off the right edge and
     landing under the drawer's close button. The 46px reserves that corner. */
  .bc-header {
    position: sticky; top: 0; z-index: 3;
    display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: center; gap: var(--bc-space-4, 10px);
    padding: var(--bc-space-5, 12px) var(--bc-panel-gutter, var(--bc-pad-card, 24px))
             var(--bc-space-5, 12px) var(--bc-pad-card, 24px);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
  }
  @supports not (backdrop-filter: blur(1px)) { .bc-header { background: var(--bg); } }
  .bc-brand { display: flex; align-items: center; gap: var(--bc-space-3, 8px); min-width: 0; }
  .bc-logo {
    width: 30px; height: 30px; flex: none;
    border-radius: var(--bc-radius-md, 8px); background: var(--accent);
    /* The accent is user-chosen, so the label has to be the derived contrast
       colour; a hardcoded white vanished on light accents. */
    color: var(--bc-accent-contrast, #fff);
    display: inline-flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: var(--bc-text-xs, 12px); letter-spacing: .02em;
  }
  .bc-brand-name { font-weight: 650; letter-spacing: -.01em; white-space: nowrap; }
  .bc-brand-sub  { font-size: var(--bc-text-3xs, 10px); color: var(--muted); font-variant-numeric: tabular-nums; }

  /* The master switch is the most consequential control in the panel, so it
     stays on the one bar rather than going into the overflow menu -- but it is
     a switch and a word, not a whole second bar with its own border. */
  .bc-master {
    display: inline-flex; align-items: center; gap: var(--bc-space-3, 8px);
    padding: var(--bc-space-2, 6px) var(--bc-space-4, 10px);
    border-radius: var(--bc-radius-pill, 999px);
    background: var(--bc-surface-3, rgba(0,0,0,.04));
    font-size: var(--bc-text-xs, 12px); font-weight: 600; color: var(--muted);
    cursor: pointer; white-space: nowrap;
    transition: color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
  }
  .bc-master.bc-on { color: var(--bc-accent-text, var(--accent)); background: var(--bc-accent-weak, rgba(168,69,44,.12)); }

  .bc-search-wrap { position: relative; display: flex; align-items: center; min-width: 0; }
  .bc-search-ic { position: absolute; left: var(--bc-space-3, 8px); display: inline-flex; color: var(--muted); pointer-events: none; }
  .bc-search {
    width: 100%; min-width: 0;
    padding: var(--bc-space-3, 8px) var(--bc-space-4, 10px) var(--bc-space-3, 8px) 30px;
    border: 1px solid var(--border); border-radius: var(--bc-radius-pill, 999px);
    background: var(--panel); color: inherit; font: inherit;
  }
  .bc-search::placeholder { color: var(--muted); }
  .bc-header-actions { display: flex; gap: var(--bc-space-1, 4px); align-items: center; }

  /* Square icon buttons: Undo/Redo/overflow carried full words plus icons and
     took 230px of a bar that had none to give. */
  .bc-icon-btn {
    width: 30px; height: 30px; flex: none; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid transparent; border-radius: var(--bc-radius-md, 8px);
    background: transparent; color: var(--muted); cursor: pointer; font: inherit;
    transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
  }
  .bc-icon-btn:hover:not(:disabled) { background: var(--bc-surface-3, rgba(0,0,0,.05)); color: var(--fg); }
  .bc-icon-btn:disabled { opacity: .35; cursor: default; }

  /* ---- overflow menu ---------------------------------------------------- */
  .bc-menu-wrap { position: relative; }
  .bc-menu {
    position: absolute; top: calc(100% + 6px); right: 0; z-index: 5;
    min-width: 180px; padding: var(--bc-space-2, 6px);
    background: var(--panel); border: 1px solid var(--border);
    border-radius: var(--bc-radius-lg, 10px); box-shadow: var(--bc-shadow-3, 0 8px 24px rgba(0,0,0,.12));
    display: flex; flex-direction: column; gap: 2px;
  }
  .bc-menu[hidden] { display: none; }
  .bc-menu-item {
    display: flex; align-items: center; gap: var(--bc-space-3, 8px);
    padding: var(--bc-space-3, 8px) var(--bc-space-4, 10px);
    border: 0; border-radius: var(--bc-radius-md, 8px); background: transparent;
    color: inherit; font: inherit; text-align: left; cursor: pointer; width: 100%;
  }
  .bc-menu-item:hover { background: var(--bc-surface-3, rgba(0,0,0,.05)); }
  .bc-menu-item .bc-ic { color: var(--muted); flex: none; }
  .bc-menu-item.bc-danger { color: var(--danger); }
  .bc-menu-item.bc-danger .bc-ic { color: currentColor; }
  .bc-menu-sep { height: 1px; margin: var(--bc-space-2, 6px) var(--bc-space-3, 8px); background: var(--border); }

  /* ---- shell ------------------------------------------------------------
     Container, not viewport: this UI is mounted in a shadow root inside a panel
     whose width has nothing to do with the window's, so a media query here
     collapsed the tab rail on a narrow screen and kept it on a narrow panel,
     which is exactly backwards. */
  .bc-shell-wrap { container-type: inline-size; container-name: bc-shell; padding: var(--bc-gap-card, 16px) var(--bc-pad-card, 24px) var(--bc-space-9, 24px); }
  .bc-shell { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: var(--bc-space-8, 20px); align-items: start; }
  /* ---- tab rail ---------------------------------------------------------
     No card around it. Seventeen ungrouped tabs in a bordered box was the
     single densest thing in the panel; five labelled groups on the bare page
     reads as a contents page instead. */
  .bc-nav { position: sticky; top: 64px; }
  .bc-nav-groups { display: flex; flex-direction: column; gap: var(--bc-space-6, 14px); }
  .bc-nav-group { display: flex; flex-direction: column; gap: 1px; }
  .bc-nav-group-label {
    font-size: var(--bc-text-3xs, 10px); font-weight: 700;
    letter-spacing: var(--bc-tracking-caps, .04em); text-transform: uppercase;
    color: var(--bc-text-subtle, var(--muted));
    padding: 0 var(--bc-space-4, 10px) var(--bc-space-2, 6px);
  }
  .bc-tab {
    display: flex; align-items: center; gap: var(--bc-space-4, 10px);
    padding: var(--bc-space-3, 8px) var(--bc-space-4, 10px);
    border: 0; background: transparent; color: var(--muted);
    text-align: left; cursor: pointer; border-radius: var(--bc-radius-md, 8px);
    font: inherit; font-size: var(--bc-text-sm, 13px); font-weight: 550;
    position: relative;
    transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
  }
  .bc-tab:hover { background: var(--bc-surface-3, rgba(0,0,0,.05)); color: var(--fg); }
  /* Tinted, not a solid accent block. At seventeen items a saturated fill is
     the loudest thing on the page and it is only telling you where you are. */
  /* Selected on the ATTRIBUTE as well as the class. aria-current is the real
     state -- the class is a styling alias for it -- and the rail was observed
     once painting the accent on a button whose class and aria both said it was
     not selected, i.e. a stale recalc of a class-only selector. Matching both
     means the paint has two independent invalidation triggers and the selector
     describes the state rather than a private flag. */
  .bc-tab.active, .bc-tab[aria-current="page"] { background: var(--bc-accent-weak, rgba(168,69,44,.12)); color: var(--bc-accent-text, var(--accent)); font-weight: 650; }
  .bc-tab.active::before, .bc-tab[aria-current="page"]::before {
    content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 16px; border-radius: 0 var(--bc-radius-sm, 3px) var(--bc-radius-sm, 3px) 0; background: currentColor;
  }
  .bc-tab-ic { display: inline-flex; align-items: center; justify-content: center; width: 16px; flex: 0 0 16px; }

  /* The rail only collapses when it genuinely cannot fit. It must also stop
     being a sticky column when it does: keeping flex-direction:column and
     position:sticky left a full-height list pinned over the body.
     There was a .bc-shell-collapsed variant of every rule below, for a class no
     code has ever set -- six dead rules that the a11y test was reading as proof
     of a second mechanism. */
  @container bc-shell (max-width: 470px) {
    .bc-shell { grid-template-columns: minmax(0, 1fr); }
    .bc-nav { position: static; top: auto; }
    .bc-nav-groups { flex-direction: row; overflow-x: auto; overflow-y: hidden; gap: var(--bc-space-5, 12px); padding-bottom: var(--bc-space-2, 6px); }
    .bc-nav-group { flex-direction: row; align-items: center; gap: 2px; }
    .bc-nav-group-label { display: none; }
    .bc-tab { flex: none; white-space: nowrap; }
  }

  /* Without container queries there is no way to ask how wide the PANEL is, so
     fall back to the window. It is the wrong axis -- a narrow panel on a wide
     screen is exactly the case this gets wrong -- but it is better than a rail
     that never collapses at all. The rewrite dropped this block; container
     queries are Chrome 105+, Firefox 110+ and Safari 16+, so it is insurance
     rather than a live path. */
  @supports not (container-type: inline-size) {
    @media (max-width: 900px) {
      .bc-shell { grid-template-columns: minmax(0, 1fr); }
      .bc-nav { position: static; top: auto; }
      .bc-nav-groups { flex-direction: row; overflow-x: auto; overflow-y: hidden; gap: var(--bc-space-5, 12px); padding-bottom: var(--bc-space-2, 6px); }
      .bc-nav-group { flex-direction: row; align-items: center; gap: 2px; }
      .bc-nav-group-label { display: none; }
      .bc-tab { flex: none; white-space: nowrap; }
      .bc-row:not(.bc-row-slim) { grid-template-columns: 28px minmax(0, 1fr); row-gap: var(--bc-space-3, 8px); }
      .bc-row:not(.bc-row-slim) .bc-row-control { grid-column: 2 / -1; justify-content: flex-start; max-width: 100%; }
      .bc-select { max-width: 100%; }
    }
  }

  /* ---- tab head ---------------------------------------------------------
     Replaces the per-section "description" paragraphs. One line at the top of
     the tab says what the tab is for; the sections below it then don't each
     need a sentence of their own, which is where most of the word count went. */
  .bc-tab-head { display: flex; align-items: center; gap: var(--bc-space-5, 12px); margin-bottom: var(--bc-space-2, 6px); }
  .bc-tab-head-ic {
    width: 40px; height: 40px; flex: none;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: var(--bc-radius-lg, 10px);
    background: var(--bc-accent-weak, rgba(168,69,44,.12));
    color: var(--bc-accent-text, var(--accent));
  }
  .bc-tab-title { margin: 0; font-size: var(--bc-text-2xl, 20px); font-weight: 700; letter-spacing: -.015em; }
  .bc-tab-sub { margin: 2px 0 0; color: var(--muted); font-size: var(--bc-text-sm, 13px); text-wrap: pretty; }
  .bc-search-empty {
    margin: 0; padding: var(--bc-pad-card, 24px); text-align: center;
    color: var(--muted); font-size: var(--bc-text-sm, 13px);
    background: var(--panel); border: 1px dashed var(--border);
    border-radius: var(--bc-radius-xl, 14px);
  }

  /* ---- sections --------------------------------------------------------- */
  .bc-body { min-width: 0; container-type: inline-size; container-name: bc-body; }
  .bc-tab-body { display: flex; flex-direction: column; gap: var(--bc-gap-card, 16px); }
  .bc-section {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: var(--bc-radius-xl, 14px); padding: var(--bc-pad-card, 24px);
  }
  .bc-section-head { display: flex; align-items: flex-start; gap: var(--bc-space-4, 10px); margin-bottom: var(--bc-space-5, 12px); }
  .bc-section-heading { min-width: 0; }
  /* Was 14px uppercase muted, which reads as a fieldset legend rather than a
     heading: all-caps costs ~12% legibility, and muted put the one word that
     tells you where you are below its own body text in contrast. */
  .bc-section-title { margin: 0; font-size: var(--bc-text-lg, 15px); font-weight: 650; letter-spacing: -.008em; color: var(--fg); }
  .bc-section-desc { margin: var(--bc-space-1, 4px) 0 0; color: var(--muted); font-size: var(--bc-text-sm, 13px); text-wrap: pretty; }
  .bc-section-body { display: flex; flex-direction: column; gap: 2px; }

  /* ---- the icon tile ----------------------------------------------------
     One definition for every mark in the panel. Rows, section heads and the
     menu all draw from BC.icons at one size in one container, so nothing can
     drift to a different optical weight. */
  .bc-tile {
    width: 28px; height: 28px; flex: none;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: var(--bc-radius-md, 8px);
    background: var(--bc-surface-3, rgba(0,0,0,.05));
    color: var(--muted);
    transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
  }
  .bc-tile-sm { width: 26px; height: 26px; background: var(--bc-accent-weak, rgba(168,69,44,.12)); color: var(--bc-accent-text, var(--accent)); }
  /* A row with no icon still reserves the column, so labels stay on one
     vertical line whether or not every row in the section has a mark. */
  .bc-tile-blank { background: transparent; }

  /* ---- rows -------------------------------------------------------------
     Was a 1fr/auto grid, which handed the control max-content and gave the
     label only what survived. In a ~360px drawer that crushed "Progress accent"
     -- swatch + hex field + Clear -- into a 130px label column and wrapped its
     hint over five lines. Three explicit tracks fix the priority: the mark is
     fixed, the label takes the slack, the control takes what it needs. */
  .bc-row {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--bc-space-4, 10px);
    padding: var(--bc-pad-row, 14px) var(--bc-space-4, 10px);
    margin: 0 calc(var(--bc-space-4, 10px) * -1);
    border-radius: var(--bc-radius-md, 8px);
    transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
  }
  /* The hover wash is what replaced the hairlines: it ties a label to the
     control four inches away from it, which a rule between rows never did. */
  .bc-row:hover { background: var(--bc-surface-3, rgba(0,0,0,.035)); }
  .bc-row:hover .bc-tile:not(.bc-tile-blank) { background: var(--bc-accent-weak, rgba(168,69,44,.12)); color: var(--bc-accent-text, var(--accent)); }
  /* A control that needs the width -- a text field, a textarea, a row of
     drawn choices -- takes the full line under the label and stays LEFT
     aligned. Previously it wrapped and kept margin-left:auto, so it ended up
     orphaned against the right edge with nothing above it. */
  .bc-row-wide { grid-template-columns: 28px minmax(0, 1fr); row-gap: var(--bc-space-4, 10px); }
  .bc-row-wide .bc-row-control { grid-column: 2 / -1; justify-content: flex-start; width: 100%; }
  .bc-row-label { min-width: 0; }
  .bc-hidden { display: none !important; }
  .bc-row-off { opacity: .45; }
  .bc-row-off .bc-row-control { pointer-events: none; }
  .bc-row-title { font-weight: 600; letter-spacing: -.004em; }
  .bc-row-hint  { color: var(--muted); font-size: var(--bc-text-sm, 13px); margin-top: 1px; text-wrap: pretty; }
  .bc-row-warn  { color: var(--danger); font-size: var(--bc-text-sm, 13px); margin-top: var(--bc-space-1, 4px); }
  .bc-row-control { display: flex; flex-wrap: wrap; align-items: center; gap: var(--bc-space-3, 8px); justify-content: flex-end; min-width: 0; }
  /* A select sized to its widest option is a max-content control, and an auto
     grid track hands it every pixel it asks for. Measured in the drawer at
     360px: "Course card colour" got a 29px label column and wrapped its hint
     over EIGHT lines -- the same starvation the old 1fr/auto grid caused, just
     arriving through the control rather than through the template. Capping the
     control and letting the field shrink puts the label first again. */
  /* A PERCENTAGE cap cannot do this job: against an auto grid track the
     percentage is indefinite while the track is being sized, so the browser
     ignores it during intrinsic sizing and the select gets its full max-content
     width anyway. Measured at a 600px drawer with that cap in place, the GPA
     "Scale" row still came out with a 26px label and a seven-line hint. A fixed
     ceiling is the only thing the track actually honours. */
  .bc-select { max-width: 190px; }
  .bc-number, .bc-color-text, .bc-key { max-width: 100%; }
  .bc-row-wide .bc-select { max-width: 100%; }

  /* Below this the two columns genuinely do not both fit, so every row becomes
     a wide row: label on its own line, control under it and left-aligned with
     it. Scoped to bc-body, NOT to the wrapper: the wrapper includes the 200px
     tab rail, so at a 600px drawer it measured 552px and stayed in two-column
     mode while the body it was speaking for was only 332px wide. */
  @container bc-body (max-width: 380px) {
    /* Not .bc-row-slim: its control is a single 40px switch, which fits beside a
       label at any width this panel can reach. Stacking those too turned a
       one-line toggle into two lines for most of the panel at a 1100px window,
       which is the common laptop case. */
    .bc-row:not(.bc-row-slim) { grid-template-columns: 28px minmax(0, 1fr); row-gap: var(--bc-space-3, 8px); }
    .bc-row:not(.bc-row-slim) .bc-row-control { grid-column: 2 / -1; justify-content: flex-start; max-width: 100%; }
    .bc-select { max-width: 100%; }
  }

  /* ---- choice: options that draw themselves ---------------------------- */
  .bc-choice { display: flex; flex-wrap: wrap; gap: var(--bc-space-3, 8px); }
  .bc-choice-opt {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--bc-space-3, 8px); width: 78px; padding: var(--bc-space-4, 10px) var(--bc-space-2, 6px); cursor: pointer;
    border: 1px solid var(--border); border-radius: var(--bc-radius-lg, 10px);
    background: var(--bc-surface-2, transparent); color: var(--muted);
    transition: border-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
  }
  .bc-choice-opt:hover { background: var(--bc-surface-3, rgba(0,0,0,.05)); color: var(--fg); }
  /* Two signals, not just colour: the selected card is also the only one with
     an accent rim, which survives a colour-blind mode and a mono print. */
  .bc-choice-opt.bc-on {
    border-color: var(--accent); color: var(--bc-accent-text, var(--accent));
    background: var(--bc-accent-weak, rgba(168,69,44,.10));
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .bc-choice-opt:focus-within { outline: 2px solid var(--bc-focus-ring, var(--accent)); outline-offset: 1px; }
  .bc-choice-art { display: flex; align-items: center; justify-content: center; width: 100%; height: 24px; }
  .bc-choice-label { font-size: var(--bc-text-2xs, 11px); font-weight: 600; }

  .bc-sw-track { stroke: var(--bc-surface-4, rgba(0,0,0,.12)); }
  .bc-sw-fill  { stroke: var(--accent); }
  .bc-sw-track-bar {
    display: block; width: 52px; height: 6px; border-radius: 999px;
    background: var(--bc-surface-4, rgba(0,0,0,.12)); overflow: hidden;
  }
  .bc-sw-bar { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
  .bc-sw-bar.rainbow { background-image: var(--bc-spectrum); background-repeat: no-repeat; }
  .bc-sw-segs { display: flex; gap: 2px; width: 52px; }
  .bc-sw-seg { flex: 1 1 0; height: 6px; border-radius: var(--bc-radius-sm, 2px); background: var(--bc-surface-4, rgba(0,0,0,.12)); }
  .bc-sw-seg.on { background: var(--accent); }
  .bc-sw-text { font-size: var(--bc-text-2xs, 11px); font-variant-numeric: tabular-nums; }
  .bc-sw-text b { color: var(--fg); }
  .bc-sw-none { color: var(--muted); }

  /* ---- controls ---------------------------------------------------------- */
  .bc-switch { position: relative; width: 40px; height: 23px; display: inline-block; flex: none; border-radius: 999px; background: var(--bc-border-strong, var(--border)); transition: background var(--bc-dur-2, 160ms) var(--bc-ease-standard, ease); cursor: pointer; }
  .bc-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  /* pointer-events:none is load-bearing: the thumb is a later positioned sibling,
     so without it the knob paints above the input and swallows the click. */
  .bc-switch-thumb { position: absolute; top: 2.5px; left: 2.5px; width: 18px; height: 18px; background: var(--bc-surface-2, #fff); border-radius: 50%; transition: transform var(--bc-dur-2, 160ms) var(--bc-ease-spring, ease); box-shadow: var(--bc-shadow-1, 0 1px 2px rgba(0,0,0,.15)); pointer-events: none; }
  .bc-switch input:checked + .bc-switch-thumb { transform: translateX(17px); }
  .bc-switch.bc-on, .bc-switch:has(input:checked) { background: var(--accent); }
  .bc-switch input:focus-visible + .bc-switch-thumb { box-shadow: 0 1px 2px rgba(0,0,0,.15), 0 0 0 3px color-mix(in srgb, var(--accent) 45%, transparent); }

  .bc-select, .bc-text, .bc-textarea, .bc-number, .bc-color-text, .bc-tags-inp {
    padding: var(--bc-space-3, 8px) var(--bc-space-4, 10px); border: 1px solid var(--border);
    border-radius: var(--bc-radius-md, 8px); background: var(--panel); color: inherit; font: inherit;
  }
  .bc-select { cursor: pointer; }
  .bc-textarea { width: 100%; font-family: var(--bc-font-mono, ui-monospace, Menlo, monospace); font-size: var(--bc-text-sm, 13px); line-height: 1.6; }
  .bc-number { width: 88px; }
  .bc-row-wide .bc-row-control > * { flex: 1 1 auto; min-width: 0; }
  .bc-text-wrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .bc-row-wide .bc-text-wrap, .bc-row-wide .bc-text, .bc-row-wide .bc-textarea { width: 100%; }

  /* Swatch + hex + a mark for Clear. The old control was a colour input, a hex
     field and a "Clear" BUTTON: ~230px, which is what pushed the label column
     down to 130px in the drawer. */
  .bc-color { display: inline-flex; align-items: center; gap: var(--bc-space-2, 6px); }
  /* The swatch is ours; the input just sits on it, invisible, to open the
     native picker. See the note in C.color for why the UA pseudo-element could
     not carry the unset state. */
  .bc-swatch {
    position: relative; width: 30px; height: 30px; flex: none; cursor: pointer;
    display: inline-block; overflow: hidden;
    border: 1px solid var(--bc-border-strong, var(--border));
    border-radius: var(--bc-radius-md, 8px);
  }
  .bc-swatch input[type=color] {
    position: absolute; inset: 0; width: 100%; height: 100%;
    opacity: 0; padding: 0; border: 0; margin: 0; cursor: pointer;
  }
  /* A hatch, not black: "nothing chosen" without needing a word beside it. */
  .bc-color-unset .bc-swatch {
    background-color: var(--bc-surface-3, #eee7dc);
    background-image: linear-gradient(135deg, transparent 44%, var(--bc-border-strong, #b9ab97) 44%,
                      var(--bc-border-strong, #b9ab97) 56%, transparent 56%);
  }
  .bc-swatch:focus-within { outline: 2px solid var(--bc-focus-ring, var(--accent)); outline-offset: 2px; }
  .bc-color-clear { width: 26px; height: 26px; }
  .bc-color-text { width: 92px; font-family: var(--bc-font-mono, ui-monospace, Menlo, monospace); font-size: var(--bc-text-sm, 13px); }
  .bc-slider { display: inline-flex; align-items: center; gap: var(--bc-space-3, 8px); }
  .bc-slider input[type=range] { accent-color: var(--accent); }
  .bc-slider-val { min-width: 46px; text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); font-size: var(--bc-text-sm, 13px); }
  .bc-invalid input { border-color: var(--danger); }
  .bc-text-warn { color: var(--danger); font-size: var(--bc-text-xs, 12px); }

  .bc-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--bc-space-2, 6px);
    padding: var(--bc-space-3, 8px) var(--bc-space-5, 12px);
    border: 1px solid var(--border); border-radius: var(--bc-radius-md, 8px);
    background: var(--panel); color: inherit; cursor: pointer; font: inherit;
    font-size: var(--bc-text-sm, 13px); font-weight: 600; white-space: nowrap;
    transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                border-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
  }
  /* Optically aligned with the label rather than parked on the text baseline,
     and dimmer than it: the word is the instruction, the icon is the hint. */
  .bc-btn-ic { display: inline-flex; line-height: 0; flex: 0 0 auto; opacity: .7; }
  .bc-btn:hover .bc-btn-ic { opacity: 1; }
  .bc-btn:hover { background: var(--bc-surface-3, rgba(0,0,0,.05)); border-color: var(--bc-border-strong, var(--border)); }
  .bc-btn-primary { background: var(--accent); border-color: var(--accent); color: var(--bc-accent-contrast, #fff); }
  .bc-btn-primary:hover { background: var(--bc-accent-hover, var(--accent)); border-color: var(--bc-accent-hover, var(--accent)); }
  .bc-btn-danger { color: var(--danger); border-color: var(--bc-danger-border, rgba(185,28,28,.4)); }
  .bc-btn-ghost  { background: transparent; border-color: transparent; }
  .bc-btn-ghost:hover { border-color: var(--border); }
  .bc-sortable { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--bc-space-2, 6px); }
  .bc-sortable-item {
    display: grid; grid-template-columns: 20px 1fr;
    align-items: center; gap: var(--bc-space-4, 10px); padding: var(--bc-space-2, 6px) var(--bc-space-3, 8px);
    background: var(--panel); border: 1px solid var(--border); border-radius: var(--bc-radius-md, 6px);
  }
  .bc-drag { cursor: grab; color: var(--muted); user-select: none; text-align: center; }
  .bc-sortable-item.bc-dragging { opacity: .5; }

  /* Two lines. The five-track grid handed two 1fr columns to a ~300px row, so
     the nickname field was six characters wide and the image URL read "backgro". */
  .bc-course-row { display: flex; flex-direction: column; gap: var(--bc-space-2, 6px); min-width: 0; }
  .bc-course-main { display: flex; align-items: center; gap: var(--bc-space-3, 8px); min-width: 0; }
  .bc-course-swatch { width: 26px; height: 26px; border-radius: var(--bc-radius-circle, 50%); }
  .bc-course-name { flex: 1 1 auto; min-width: 0; }
  .bc-course-bg { width: 100%; font-size: var(--bc-text-sm, 13px); }
  .bc-course-hide { display: inline-flex; align-items: center; gap: var(--bc-space-2, 6px); flex: none; }
  .bc-course-hide-label { font-size: var(--bc-text-xs, 12px); color: var(--muted); }
  .bc-mini-check { display: inline-flex; align-items: center; gap: var(--bc-space-1, 4px); font-size: var(--bc-text-xs, 12px); color: var(--muted); }
  .bc-bulk { display: flex; gap: var(--bc-space-2, 6px); margin-top: var(--bc-space-4, 10px); }

  /* wrap, because several of these hold a field plus a select plus a label plus
     a time input, which is wider than a ~330px card: the recurring-task form was
     clipping "Due at 05:00 PM" against the card's right edge. */
  .bc-inline { display: inline-flex; flex-wrap: wrap; gap: var(--bc-space-2, 6px); align-items: center; }

  .bc-theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--bc-space-4, 10px); }
  .bc-theme-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--bc-radius-lg, 10px); padding: var(--bc-space-4, 10px); cursor: pointer; text-align: left; color: inherit; }
  .bc-theme-card:hover { border-color: var(--accent); }
  .bc-theme-swatch { height: 60px; border-radius: var(--bc-radius-md, 8px); border: 2px solid; position: relative; overflow: hidden; }
  .bc-theme-swatch span { position: absolute; right: 8px; bottom: 8px; width: 20px; height: 20px; border-radius: 50%; }
  .bc-theme-name { margin-top: var(--bc-space-3, 8px); font-weight: 600; font-size: var(--bc-text-sm, 13px); }
  .bc-theme-actions { display: flex; gap: var(--bc-space-1, 4px); margin-top: var(--bc-space-3, 8px); }
  .bc-theme-actions .bc-btn { padding: 3px var(--bc-space-3, 8px); font-size: var(--bc-text-xs, 12px); }
  .bc-rot-list { display: flex; flex-wrap: wrap; gap: var(--bc-space-3, 8px) var(--bc-space-7, 16px); padding: var(--bc-space-2, 6px) 0; }

  /* Skin gallery. minmax(150px) rather than the theme grid's 140px because a
     skin card carries a four-cell mock, and below ~150px the cells stop being
     large enough to tell a lattice from a plaid -- which is the only thing the
     preview is there to do. */
  /* Layout swatches. Each miniature is built from the same two elements -- a
     dot and a bar -- so the only thing that differs between them is the
     geometry the layout itself changes. */
  .bc-lsw { display: flex; flex-direction: column; gap: 3px; width: 34px; }
  .bc-lsw-row { display: flex; align-items: center; gap: 3px; }
  .bc-lsw-row i { width: 5px; height: 5px; border-radius: var(--bc-radius-circle, 50%); border: 1px solid currentColor; flex: none; }
  .bc-lsw-row b { height: 3px; flex: 1; border-radius: var(--bc-radius-sm, 2px); background: currentColor; opacity: .45; }
  .bc-lsw.comfortable .bc-lsw-row { background: currentColor; border-radius: var(--bc-radius-sm, 2px); padding: 2px; }
  .bc-lsw.comfortable .bc-lsw-row i, .bc-lsw.comfortable .bc-lsw-row b { mix-blend-mode: screen; }
  .bc-lsw.compact { gap: 1px; }
  .bc-lsw.compact .bc-lsw-row { border-bottom: 1px solid currentColor; padding-bottom: 1px; }
  .bc-lsw.cards { gap: var(--bc-space-1, 4px); }
  .bc-lsw.cards .bc-lsw-row { border: 1px solid currentColor; border-radius: var(--bc-radius-sm, 2px); padding: 3px 2px; }
  .bc-lsw.minimal .bc-lsw-row + .bc-lsw-row { border-top: 1px solid currentColor; padding-top: 2px; }
  .bc-lsw.timeline { border-left: 1px solid currentColor; padding-left: var(--bc-space-1, 4px); margin-left: 2px; }
  /* Pull the node back over the rail: the padding, plus half a 7px dot. Written
     as maths rather than the -8px it evaluates to, so it still lands on the rail
     when the density scale moves the padding. */
  .bc-lsw.timeline .bc-lsw-row i { margin-left: calc(-1 * var(--bc-space-1, 4px) - 4px); }

  .bc-skin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--bc-space-4, 10px); }
  .bc-skin-slot { position: relative; }
  .bc-skin-card { display: block; width: 100%; padding: 0; border: 1px solid var(--border); border-radius: var(--bc-radius-lg, 10px); background: var(--panel); cursor: pointer; overflow: hidden; text-align: left; color: inherit; }
  .bc-skin-card:hover { border-color: var(--accent); }
  /* Two rings, not a colour change: the applied skin has to be findable at a
     glance in a grid where every card is already a different colour. */
  .bc-skin-card.bc-on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent) inset; }
  .bc-skin-mock { display: flex; height: 74px; }
  .bc-skin-rail { width: 14px; flex: none; }
  .bc-skin-page { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr; gap: var(--bc-space-1, 4px); padding: var(--bc-space-2, 6px); background-size: cover; }
  .bc-skin-cell { border-radius: var(--bc-radius-sm, 3px); }
  .bc-skin-empty { align-items: center; justify-content: center; color: var(--muted); background: var(--bc-surface-3, rgba(0,0,0,.04)); }
  .bc-skin-meta { display: flex; flex-direction: column; gap: 2px; padding: var(--bc-space-3, 8px); border-top: 1px solid var(--border); min-width: 0; }
  .bc-skin-line { display: flex; align-items: center; gap: var(--bc-space-2, 6px); min-width: 0; }
  .bc-skin-dot { width: 10px; height: 10px; border-radius: var(--bc-radius-circle, 50%); flex: none; }
  .bc-skin-name { font-weight: 600; font-size: var(--bc-text-sm, 13px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bc-skin-tags { font-size: var(--bc-text-xs, 12px); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Only on hover/focus-within: a delete control sitting permanently on every
     card turns a gallery into a list of things to accidentally destroy. */
  .bc-skin-del { position: absolute; top: var(--bc-space-2, 6px); right: var(--bc-space-2, 6px); opacity: 0; }
  .bc-skin-slot:hover .bc-skin-del, .bc-skin-del:focus-visible { opacity: 1; }

  .bc-navitem { display: flex; justify-content: space-between; align-items: center; width: 100%; }
  .bc-tags { display: flex; flex-wrap: wrap; gap: var(--bc-space-2, 6px); align-items: center; }
  .bc-chips { display: flex; flex-wrap: wrap; gap: var(--bc-space-1, 4px); }
  .bc-chip { display: inline-flex; align-items: center; gap: var(--bc-space-1, 4px); padding: 2px var(--bc-space-2, 6px); background: var(--bc-surface-4, rgba(0,0,0,.05)); border-radius: var(--bc-radius-pill, 999px); font-size: var(--bc-text-xs, 12px); }
  .bc-chip-x { background: none; border: 0; cursor: pointer; color: var(--bc-text-subtle, var(--muted)); }
  .bc-tags-inp { min-width: 120px; flex: 1; }

  .bc-links { display: flex; flex-direction: column; gap: var(--bc-space-2, 6px); }
  .bc-link-row { display: grid; grid-template-columns: 1fr 2fr auto auto; gap: var(--bc-space-2, 6px); align-items: center; }

  .bc-key { padding: var(--bc-space-2, 6px) var(--bc-space-4, 10px); border: 1px solid var(--border); border-radius: var(--bc-radius-md, 6px); background: var(--panel); color: inherit; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; cursor: pointer; font-size: var(--bc-text-sm, 13px); }

  .bc-hint { color: var(--muted); font-size: var(--bc-text-xs, 12px); }
  .bc-notice {
    padding: var(--bc-space-4, 10px) var(--bc-space-5, 12px); border-radius: var(--radius); font-size: var(--bc-text-sm, 13px);
    background: var(--bc-warn-bg, #fffbeb); color: var(--bc-text, inherit);
    border: 1px solid var(--bc-warn, #a16207);
  }
  .bc-ins-total { font-weight: 700; margin-bottom: var(--bc-space-3, 8px); }
  .bc-ins-days { display: flex; gap: var(--bc-space-1, 4px); align-items: flex-end; height: 64px; margin: var(--bc-space-3, 8px) 0 var(--bc-space-5, 12px); }
  .bc-ins-day { flex: 1; height: 100%; display: flex; align-items: flex-end; background: var(--bc-surface-4, rgba(0,0,0,.04)); border-radius: var(--bc-radius-sm, 4px); overflow: hidden; }
  .bc-ins-day-fill { width: 100%; background: var(--accent); border-radius: var(--bc-radius-sm, 4px) var(--bc-radius-sm, 4px) 0 0; min-height: 2px; }
  .bc-ins-row { display: flex; justify-content: space-between; align-items: center; gap: var(--bc-space-4, 10px); padding: var(--bc-space-2, 6px) 0; border-top: 1px solid var(--border); font-size: var(--bc-text-sm, 13px); }
  .bc-ins-row:first-child { border-top: 0; }
  .bc-ins-val { font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; }
  .bc-ins-spark { line-height: 0; }
  .bc-rec-row { display: flex; justify-content: space-between; align-items: center; gap: var(--bc-space-4, 10px); padding: var(--bc-space-3, 8px) var(--bc-space-4, 10px); border: 1px solid var(--border); border-radius: var(--bc-radius-md, 8px); }
  .bc-rec-title { font-weight: 600; }
  .bc-rec-meta { font-size: var(--bc-text-xs, 12px); color: var(--muted); }
  .bc-rec-days { display: flex; gap: var(--bc-space-4, 10px); flex-wrap: wrap; margin: var(--bc-space-1, 4px) 0; }
  .bc-rec-form > .bc-inline { width: 100%; }
  .bc-rec-form .bc-text { flex: 1 1 150px; min-width: 0; }
  .bc-rec-form { display: flex; flex-direction: column; gap: var(--bc-space-3, 8px); margin-top: var(--bc-space-4, 10px); padding-top: var(--bc-space-4, 10px); border-top: 1px dashed var(--border); }
  .bc-rec-form input[type=time], .bc-rec-form input[type=date] { padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--bc-radius-md, 6px); background: var(--panel); color: inherit; font: inherit; }

  /* Rows, not a <table>. Same three-track shape as a settings row so the GPA
     panel reads as part of the panel rather than as a report pasted into it. */
  .bc-gpa { display: flex; flex-direction: column; margin-top: var(--bc-space-3, 8px); }
  .bc-gpa-row, .bc-gpa-head {
    display: grid; grid-template-columns: minmax(0, 1fr) auto 68px;
    align-items: center; gap: var(--bc-space-4, 10px);
    padding: var(--bc-space-3, 8px) var(--bc-space-3, 8px);
    margin: 0 calc(var(--bc-space-3, 8px) * -1);
    border-radius: var(--bc-radius-md, 8px);
  }
  .bc-gpa-row:hover { background: var(--bc-surface-3, rgba(0,0,0,.035)); }
  .bc-gpa-head {
    font-size: var(--bc-text-2xs, 11px); font-weight: 700; color: var(--bc-text-subtle, var(--muted));
    letter-spacing: var(--bc-tracking-caps, .04em); text-transform: uppercase;
    padding-bottom: var(--bc-space-2, 6px);
  }
  /* One line with an ellipsis, and the full name in a title. A course code plus
     a title does not fit this column, and wrapping it made every row 3 lines. */
  .bc-gpa-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .bc-gpa-figs { display: grid; grid-template-columns: 52px 34px 40px; gap: var(--bc-space-2, 6px); text-align: right;
                 font-variant-numeric: tabular-nums; font-size: var(--bc-text-sm, 13px); color: var(--muted); }
  .bc-gpa-head .bc-gpa-figs { color: inherit; font-size: inherit; }
  .bc-gpa-letter { font-weight: 700; color: var(--fg); }
  /* The band colours are categorical, not semantic: a C is not a warning. */
  .bc-gpa-letter[data-grade="a"] { color: var(--bc-grade-a, var(--fg)); }
  .bc-gpa-letter[data-grade="b"] { color: var(--bc-grade-b, var(--fg)); }
  .bc-gpa-letter[data-grade="c"] { color: var(--bc-grade-c, var(--fg)); }
  .bc-gpa-letter[data-grade="d"] { color: var(--bc-grade-d, var(--fg)); }
  .bc-gpa-letter[data-grade="f"] { color: var(--bc-grade-f, var(--fg)); }
  .bc-gpa-credlabel { text-align: right; }
  .bc-gpa-cred { width: 68px; }
  .bc-gpa-total {
    display: flex; align-items: baseline; gap: var(--bc-space-4, 10px); flex-wrap: wrap;
    margin-top: var(--bc-space-5, 12px); padding-top: var(--bc-space-5, 12px);
    border-top: 1px solid var(--border);
  }
  .bc-gpa-figure { font-size: var(--bc-text-figure, 24px); font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
  .bc-gpa-total-sub { color: var(--muted); font-size: var(--bc-text-sm, 13px); }
  /* A token, not opacity: fading text that already sits at AA drops it below AA. */
  .bc-concluded td { color: var(--bc-text-subtle, var(--muted)); }
  `;
})();
