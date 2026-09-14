/*
 * Better Canvas — To Do list features.
 * Three modes:
 *  - "default": leave Canvas native list alone.
 *  - "clean":   restyle the native list into rounded cards + circle checks.
 *  - "custom":  replace with the Better Canvas planner widget (progress
 *               indicator, week nav, filter pane, groupings, list/kanban/
 *               time-block views, streaks, pomodoro, personal tasks).
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
      border-radius: var(--bc-radius-xl, 12px); padding: var(--bc-space-5, 12px);
      border: 1px solid var(--bc-border, #e5e7eb) !important;
    }
    .todo-list-header-container h2 {
      font-size: var(--bc-text-md, 14px) !important;
      margin-bottom: var(--bc-space-3, 8px) !important;
    }
    .to-do-list li {
      background: var(--bc-surface-3, #f7fafc) !important;
      border-radius: var(--bc-radius-lg, 10px) !important;
      padding: var(--bc-space-3, 8px) var(--bc-space-4, 10px) !important;
      margin-bottom: var(--bc-space-2, 6px) !important; border: 0 !important;
    }
    /* Canvas's "Ignore" control is an <a>, which is display:inline — so the
       width, the height and the overflow this rule used to set were all silently
       ignored, and border-radius:50% was applied to whatever box the text
       happened to make. The result was not a circle: it was a lopsided pill as
       wide as the hidden label, which text-indent:-9999px could not clip either
       (overflow does not apply to inline boxes). Laying it out as inline-flex is
       what makes every one of those declarations mean something. */
    .to-do-list li a[title="Ignore"] {
      display: inline-flex !important; align-items: center; justify-content: center;
      box-sizing: border-box !important;
      width: 22px !important; height: 22px !important; flex: 0 0 auto;
      border: 2px solid var(--bc-todo-accent, var(--bc-accent, #0374b5)) !important;
      border-radius: var(--bc-radius-circle, 50%) !important;
      background: transparent !important;
      /* The label is now clipped by a box that actually clips, and kept for
         screen readers rather than pushed off-screen by a magic number. */
      font-size: 0 !important; line-height: 0 !important; text-indent: 0 !important;
      overflow: hidden !important; text-decoration: none !important;
      transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
    }
    /* The tick is a mask rather than a background image, so it takes its colour
       from the element and needs no second rule for dark mode. */
    .to-do-list li a[title="Ignore"]::after {
      content: ""; width: 12px; height: 12px;
      background-color: var(--bc-accent-contrast, #fff);
      opacity: 0; transition: opacity var(--bc-dur-1, 90ms) var(--bc-ease-out, ease);
      -webkit-mask-image: var(--bc-check-mask); mask-image: var(--bc-check-mask);
      -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
      -webkit-mask-position: center; mask-position: center;
    }
    .to-do-list li a[title="Ignore"]:hover,
    .to-do-list li a[title="Ignore"]:focus-visible {
      background: var(--bc-todo-accent, var(--bc-accent, #0374b5)) !important;
    }
    .to-do-list li a[title="Ignore"]:hover::after,
    .to-do-list li a[title="Ignore"]:focus-visible::after { opacity: 1; }
    .to-do-list li a[title="Ignore"]:focus-visible {
      outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .to-do-list li a[title="Ignore"], .to-do-list li a[title="Ignore"]::after { transition: none; }
    }
  `;

  const LAYOUTS = ["comfortable", "compact", "cards", "minimal", "timeline"];

  const WIDGET_CSS = `
    .bc-todo {
      container-type: inline-size; container-name: bctodo;
      background: var(--bc-surface-2, #fff);
      border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-lg, 10px); padding: var(--bc-space-6, 14px);
      color: var(--bc-text, inherit);
      font: var(--bc-text-md, 14px)/var(--bc-leading-body, 1.4) var(--bc-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    }
    /* Every length here comes off the spacing scale. Hardcoded px meant the
       density setting (compact/spacious/cozy) reached every other surface we
       ship and stopped dead at this widget's border. */

    /* ---- header -------------------------------------------------------- */
    /* The old row laid the ring, the title and three text buttons out as one
       unwrapped flex line. In a 280px Canvas sidebar the title got ~100px and
       "To Do - Sep 8-14" broke across four lines. The nav is now three 26px
       icon buttons — a fixed 82px — so the title always has the rest, and the
       date moved to its own line where it cannot compete for width. */
    .bc-todo-head {
      display: flex; align-items: flex-start; gap: var(--bc-space-3, 8px);
      margin-bottom: var(--bc-space-4, 10px);
    }
    .bc-todo-headings { flex: 1 1 auto; min-width: 0; }
    .bc-todo-eyebrow {
      font-size: var(--bc-text-2xs, 11px); font-weight: var(--bc-weight-semibold, 600);
      text-transform: uppercase; letter-spacing: var(--bc-tracking-caps, .04em);
      color: var(--bc-muted, #6b7280); display: block;
    }
    .bc-todo-title {
      margin: 0; font-size: var(--bc-text-lg, 15px); font-weight: var(--bc-weight-bold, 700);
      line-height: var(--bc-leading-tight, 1.25);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bc-todo-nav {
      display: inline-flex; align-items: center; flex: 0 0 auto;
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: var(--bc-radius-pill, 999px);
      padding: 1px; gap: 1px;
    }

    /* ---- the one icon button this widget uses --------------------------- */
    .bc-todo-ibtn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; padding: 0; flex: 0 0 auto;
      border: 0; border-radius: var(--bc-radius-pill, 999px);
      background: transparent; color: var(--bc-muted, #6b7280);
      cursor: pointer; font: inherit; line-height: 0;
      transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                  color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
    }
    .bc-todo-ibtn:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); color: var(--bc-text, #1b2430); }
    .bc-todo-ibtn[aria-pressed="true"] {
      background: var(--bc-accent-weak, rgba(79,70,229,.12));
      color: var(--bc-accent-text, var(--bc-accent, #0374b5));
    }
    .bc-todo-ibtn:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 1px; }
    .bc-todo-ibtn.on { color: var(--bc-accent-text, var(--bc-accent, #0374b5)); }

    /* ---- progress ------------------------------------------------------- */
    /* Six styles off one number. The ring was the only option and it was the
       worst fit for the space it had: 46px across with a 12px "100%" inside a
       36px hole, which collided with itself at any font scale above default. */
    .bc-todo-prog { margin: 0 0 var(--bc-space-5, 12px); }

    .bc-prog-row { display: flex; align-items: center; gap: var(--bc-space-4, 10px); }
    .bc-prog-count {
      font-size: var(--bc-text-xs, 12px); color: var(--bc-muted, #6b7280);
      font-variant-numeric: tabular-nums; letter-spacing: 0; flex: 0 0 auto;
    }
    .bc-prog-count b { color: var(--bc-text, #1b2430); font-weight: var(--bc-weight-semibold, 600); }

    /* Ring: the figure inside is the number of tasks LEFT, not the percentage.
       It is one or two characters at any font scale where "100%" was four and
       overflowed, and "how many left" is the number you actually act on. At
       zero it becomes a check, so finishing the week looks like finishing. */
    .bc-prog-ringwrap { position: relative; width: 44px; height: 44px; flex: 0 0 44px; }
    .bc-prog-ring { display: block; width: 44px; height: 44px; }
    .bc-prog-ring-track { stroke: var(--bc-surface-4, rgba(0,0,0,.08)); }
    .bc-prog-ring-fill {
      stroke: var(--bc-todo-accent, var(--bc-accent-stroke, var(--bc-accent, #0374b5)));
      transition: stroke-dashoffset var(--bc-dur-4, 300ms) var(--bc-ease-out, ease);
    }
    .bc-prog-ring-val {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: var(--bc-text-sm, 13px); font-weight: var(--bc-weight-bold, 700);
      font-variant-numeric: tabular-nums; letter-spacing: 0; line-height: 1;
      color: var(--bc-text, #1b2430);
    }
    .bc-prog-ring-val.bc-prog-done { color: var(--bc-success, #047857); line-height: 0; }

    /* Bar, rainbow and segments all share the track so switching style does not
       move the rest of the widget by a pixel. */
    .bc-prog-track {
      position: relative; flex: 1 1 auto; height: 6px; min-width: 0;
      border-radius: var(--bc-radius-pill, 999px);
      background: var(--bc-surface-4, rgba(0,0,0,.08)); overflow: hidden;
    }
    .bc-prog-fill {
      height: 100%; width: 0; border-radius: inherit;
      background: var(--bc-todo-accent, var(--bc-accent-stroke, var(--bc-accent, #0374b5)));
      transition: width var(--bc-dur-4, 300ms) var(--bc-ease-out, ease);
    }
    /* The spectrum is sized to the whole TRACK, not to the fill, so the colour
       at the tip is a reading of how far along you are rather than a decoration
       that looks identical at 10% and 90%. */
    .bc-prog-fill--rainbow { background-image: var(--bc-spectrum); background-repeat: no-repeat; }

    .bc-prog-segs { display: flex; align-items: center; gap: 2px; flex: 1 1 auto; min-width: 0; }
    .bc-prog-seg {
      flex: 1 1 0; min-width: 2px; height: 6px;
      border-radius: var(--bc-radius-sm, 3px);
      background: var(--bc-surface-4, rgba(0,0,0,.08));
      transition: background-color var(--bc-dur-2, 160ms) var(--bc-ease-out, ease);
    }
    .bc-prog-seg.on { background: var(--bc-todo-accent, var(--bc-accent-stroke, var(--bc-accent, #0374b5))); }
    .bc-prog-text { font-size: var(--bc-text-sm, 13px); color: var(--bc-muted, #6b7280); }
    .bc-prog-text b { color: var(--bc-text, #1b2430); font-variant-numeric: tabular-nums; }

    /* ---- toolbar: view switch + one filter popover ---------------------- */
    /* Was four full-width <select>s stacked two-per-row above the list: in a
       280px sidebar that is most of the widget spent on chrome before a single
       task appears. The view is the only one worth a permanent control, so it
       became a segmented icon group; range, grouping and course moved behind
       one button, where they are still one click away but cost no height. */
    .bc-todo-toolbar {
      display: flex; align-items: center; gap: var(--bc-space-2, 6px);
      margin-bottom: var(--bc-space-4, 10px);
    }
    .bc-todo-seg {
      display: inline-flex; align-items: center; gap: 1px; padding: 1px;
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: var(--bc-radius-pill, 999px);
    }
    .bc-todo-spacer { flex: 1 1 auto; }
    .bc-todo-filters { position: relative; flex: 0 0 auto; }
    .bc-todo-filters > summary { list-style: none; cursor: pointer; }
    .bc-todo-filters > summary::-webkit-details-marker { display: none; }
    .bc-todo-filters[open] > summary .bc-todo-ibtn,
    .bc-todo-filters > summary:focus-visible .bc-todo-ibtn {
      background: var(--bc-surface-4, rgba(0,0,0,.05)); color: var(--bc-text, #1b2430);
    }
    .bc-todo-filters > summary:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 1px; border-radius: var(--bc-radius-pill, 999px); }
    .bc-todo-pane {
      position: absolute; right: 0; top: calc(100% + var(--bc-space-2, 6px));
      z-index: 20; width: 200px; padding: var(--bc-space-4, 10px);
      display: grid; gap: var(--bc-space-2, 6px);
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #1b2430);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: var(--bc-radius-lg, 10px);
      box-shadow: var(--bc-shadow-3, 0 8px 24px rgba(0,0,0,.18));
    }
    .bc-todo-pane label {
      display: block; font-size: var(--bc-text-2xs, 11px); font-weight: var(--bc-weight-semibold, 600);
      text-transform: uppercase; letter-spacing: var(--bc-tracking-caps, .04em);
      color: var(--bc-muted, #6b7280); margin-bottom: var(--bc-space-1, 4px);
    }
    .bc-todo-pane select {
      width: 100%; box-sizing: border-box; padding: var(--bc-space-1, 4px) var(--bc-space-2, 6px);
      border-radius: var(--bc-radius-md, 6px); border: 1px solid var(--bc-border, #e5e7eb);
      background: var(--bc-surface-2, #fff); color: inherit; font: inherit; font-size: var(--bc-text-sm, 13px);
    }

    /* ---- list ----------------------------------------------------------- */
    .bc-todo-day-header {
      font-size: var(--bc-text-2xs, 11px); text-transform: uppercase;
      letter-spacing: var(--bc-tracking-caps, .04em); font-weight: var(--bc-weight-semibold, 600);
      color: var(--bc-muted, #6b7280);
      margin: var(--bc-space-5, 12px) 0 var(--bc-space-2, 6px);
    }
    .bc-todo-day-header:first-child { margin-top: 0; }
    .bc-todo-item {
      display: grid; grid-template-columns: 22px minmax(0, 1fr) auto;
      gap: var(--bc-space-3, 8px); align-items: center;
      padding: var(--bc-space-3, 8px) var(--bc-space-4, 10px);
      border-radius: var(--bc-radius-lg, 10px);
      background: var(--bc-surface-3, #f7fafc);
      margin-bottom: var(--bc-space-2, 6px);
    }
    /* Tokens rather than opacity: fading already-AA text pushes it below AA. */
    .bc-todo-item.done .bc-todo-name { color: var(--bc-text-subtle, var(--bc-muted, #6b7280)); text-decoration: line-through; }
    .bc-todo-check {
      width: 22px; height: 22px; padding: 0; border-radius: var(--bc-radius-circle, 50%);
      border: 2px solid var(--bc-todo-accent, var(--bc-accent, #0374b5));
      background: transparent; cursor: pointer; color: var(--bc-accent-contrast, #fff);
      display: inline-flex; align-items: center; justify-content: center; line-height: 0;
      transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
    }
    .bc-todo-check:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 2px; }
    /* The tick was a CSS content: "✓" — one more glyph at the mercy of the
       font, vertically centred by a hand-tuned line-height that only held at
       one font scale. */
    .bc-todo-check > svg { opacity: 0; transform: scale(.6); transition: opacity var(--bc-dur-1, 90ms) var(--bc-ease-out, ease), transform var(--bc-dur-1, 90ms) var(--bc-ease-spring, ease); }
    .bc-todo-check.done { background: var(--bc-todo-accent, var(--bc-accent, #0374b5)); }
    .bc-todo-check.done > svg { opacity: 1; transform: none; }
    .bc-todo-name { color: inherit; text-decoration: none; font-size: var(--bc-text-sm, 13px); }
    .bc-todo-name:hover { text-decoration: underline; }
    .bc-todo-course {
      font-size: var(--bc-text-2xs, 11px); color: var(--bc-muted, #6b7280);
      margin-top: 1px;
    }

    /* Row actions: present, but not three bordered boxes shouting for
       attention on every row. They fade in on hover or keyboard focus, and
       stay put on touch, where there is no hover to reveal them. */
    .bc-todo-actions { display: flex; gap: 0; align-items: center; }
    .bc-todo-actions .bc-todo-ibtn { opacity: 0; transition: opacity var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease); }
    .bc-todo-item:hover .bc-todo-actions .bc-todo-ibtn,
    .bc-todo-item:focus-within .bc-todo-actions .bc-todo-ibtn,
    .bc-todo-actions .bc-todo-ibtn.on { opacity: 1; }
    @media (hover: none) { .bc-todo-actions .bc-todo-ibtn { opacity: 1; } }
    /* Reduced motion still needs them to APPEAR — just without the fade. */
    @media (prefers-reduced-motion: reduce) { .bc-todo-actions .bc-todo-ibtn { transition: none; } }

    /* Below this the actions squeeze the task name into a column two words
       wide, so they take their own row under it instead. */
    @container bctodo (max-width: 340px) {
      .bc-todo-item { grid-template-columns: 22px minmax(0, 1fr); }
      .bc-todo-actions { grid-column: 2; justify-content: flex-start; margin-top: var(--bc-space-1, 4px); }
      .bc-todo-actions .bc-todo-ibtn { opacity: 1; }
    }

    /* ---- layouts ---------------------------------------------------------
       Five presentations of the same markup, selected by data-bc-layout on the
       widget root. Everything below only ever changes presentation: no rule
       here hides an action, a checkbox or a link, because a layout that drops
       controls is a different feature set wearing a layout's name.

       Each one exists for a different reader:
         comfortable  the default, boxed rows
         compact      many tasks, small sidebar -- density over comfort
         cards        few tasks, each one an object worth looking at
         minimal      no boxes at all; hierarchy carried by type and rules
         timeline     order in time made spatial, for date-driven work       */

    /* compact: the row box disappears and the grid tightens. Type drops one
       step but not two -- 11px task titles are where a dense list stops being
       readable and starts being a wall. */
    [data-bc-layout="compact"] .bc-todo-item {
      background: transparent; border-radius: 0;
      padding: var(--bc-space-1, 4px) var(--bc-space-2, 6px);
      margin-bottom: 0; gap: var(--bc-space-2, 6px);
      grid-template-columns: 18px minmax(0, 1fr) auto;
      border-bottom: 1px solid var(--bc-border, rgba(0,0,0,.07));
    }
    [data-bc-layout="compact"] .bc-todo-item:last-child { border-bottom: 0; }
    [data-bc-layout="compact"] .bc-todo-check { width: 18px; height: 18px; border-width: 1.5px; }
    [data-bc-layout="compact"] .bc-todo-name { font-size: var(--bc-text-xs, 12px); }
    [data-bc-layout="compact"] .bc-todo-course { font-size: var(--bc-text-2xs, 11px); margin-top: 0; }
    [data-bc-layout="compact"] .bc-todo-day-header { margin: var(--bc-space-4, 10px) 0 var(--bc-space-1, 4px); }
    /* The tag and subtask row is the first thing to go when space is the point;
       both are still on the detail popover. */
    [data-bc-layout="compact"] .bc-todo-tags { display: none; }

    /* cards: each task an object. The lift is a border and a shadow, not a
       transform -- a hover transform on a list that re-renders on a timer
       produces a row that twitches under the pointer. */
    [data-bc-layout="cards"] .bc-todo-item {
      background: var(--bc-surface-2, #fff);
      border: 1px solid var(--bc-border, rgba(0,0,0,.08));
      box-shadow: var(--bc-shadow-1, 0 1px 2px rgba(0,0,0,.06));
      padding: var(--bc-space-5, 12px);
      margin-bottom: var(--bc-space-3, 8px);
      align-items: flex-start;
    }
    [data-bc-layout="cards"] .bc-todo-item:hover {
      border-color: var(--bc-todo-accent, var(--bc-accent, #0374b5));
      box-shadow: var(--bc-shadow-2, 0 2px 8px rgba(0,0,0,.1));
    }
    [data-bc-layout="cards"] .bc-todo-name {
      font-size: var(--bc-text-sm, 13px); font-weight: var(--bc-weight-semibold, 600);
      display: block; margin-bottom: var(--bc-space-1, 4px);
    }
    [data-bc-layout="cards"] .bc-todo-course { font-size: var(--bc-text-xs, 12px); }
    [data-bc-layout="cards"] .bc-todo-check { margin-top: 1px; }
    /* Actions stay visible here: a card has the room, and hiding them on an
       object this deliberate reads as the card being inert. */
    [data-bc-layout="cards"] .bc-todo-actions .bc-todo-ibtn { opacity: 1; }

    /* minimal: no boxes anywhere. The only separators are the group headers and
       a hairline, so the type hierarchy has to do all the work. */
    [data-bc-layout="minimal"] .bc-todo-item {
      background: transparent; border-radius: 0;
      padding: var(--bc-space-3, 8px) 0; margin-bottom: 0;
    }
    [data-bc-layout="minimal"] .bc-todo-item + .bc-todo-item {
      border-top: 1px solid var(--bc-border, rgba(0,0,0,.06));
    }
    [data-bc-layout="minimal"] .bc-todo-check {
      border-width: 1.5px; border-color: var(--bc-border-strong, var(--bc-muted, #9aa0a8));
    }
    [data-bc-layout="minimal"] .bc-todo-check.done { border-color: var(--bc-todo-accent, var(--bc-accent, #0374b5)); }
    [data-bc-layout="minimal"] .bc-todo-day-header {
      border-bottom: 1px solid var(--bc-border, rgba(0,0,0,.08));
      padding-bottom: var(--bc-space-2, 6px);
    }

    /* timeline: a rail down the left with a node per task. The rail is a
       border on the row and the node is a positioned pseudo-element, so the
       grid is untouched and every handler still finds the same elements. */
    [data-bc-layout="timeline"] .bc-todo-item {
      position: relative; background: transparent; border-radius: 0;
      margin-bottom: 0; padding: var(--bc-space-3, 8px) 0 var(--bc-space-3, 8px) var(--bc-space-6, 14px);
      border-left: 2px solid var(--bc-border, rgba(0,0,0,.12));
      margin-left: var(--bc-space-2, 6px);
    }
    [data-bc-layout="timeline"] .bc-todo-item::before {
      content: ""; position: absolute; left: -5px; top: var(--bc-space-6, 14px);
      width: 8px; height: 8px; border-radius: var(--bc-radius-circle, 50%);
      background: var(--bc-surface-1, #fff);
      border: 2px solid var(--bc-todo-accent, var(--bc-accent, #0374b5));
    }
    /* A completed node fills in, so progress reads down the rail at a glance
       without reading a single task title. */
    [data-bc-layout="timeline"] .bc-todo-item.done::before {
      background: var(--bc-todo-accent, var(--bc-accent, #0374b5));
    }
    [data-bc-layout="timeline"] .bc-todo-day-header {
      margin-left: var(--bc-space-2, 6px); padding-left: var(--bc-space-6, 14px);
    }

    /* Kanban owns its own geometry -- a card border or a timeline rail inside a
       draggable column is noise fighting the column. The time-block view needs
       no equivalent: it renders chips, not task rows, so none of the above
       reaches it. */
    [data-bc-layout] .bc-todo-kanban .bc-todo-item {
      border-left: 0; border-top: 0; border-bottom: 0; padding-left: var(--bc-space-3, 8px);
      margin-left: 0; background: var(--bc-surface-3, #f7fafc);
      border-radius: var(--bc-radius-lg, 10px);
    }
    [data-bc-layout] .bc-todo-kanban .bc-todo-item::before { display: none; }

    /* ---- composer ------------------------------------------------------- */
    /* A leading plus does the work the word "Add" was doing, so the input gets
       the width back and the row stops being input-plus-button. */
    .bc-todo-new {
      display: flex; align-items: center; gap: var(--bc-space-2, 6px);
      margin-top: var(--bc-space-4, 10px); padding: 0 var(--bc-space-2, 6px);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: var(--bc-radius-pill, 999px);
      color: var(--bc-muted, #6b7280);
      transition: border-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
    }
    .bc-todo-new:focus-within { border-color: var(--bc-accent-stroke, var(--bc-accent, #0374b5)); }
    .bc-todo-new > svg { flex: 0 0 auto; }
    .bc-todo-new input {
      flex: 1 1 auto; min-width: 0; padding: var(--bc-space-2, 6px) 0;
      border: 0; background: transparent; color: var(--bc-text, #1b2430);
      font: inherit; font-size: var(--bc-text-sm, 13px);
    }
    .bc-todo-new input:focus { outline: 0; }

    .bc-todo-empty {
      display: flex; align-items: center; gap: var(--bc-space-3, 8px);
      color: var(--bc-muted, #6b7280); font-size: var(--bc-text-sm, 13px);
      padding: var(--bc-space-5, 12px) 0;
    }
    .bc-todo-empty > svg { color: var(--bc-success, #047857); flex: 0 0 auto; }

    /* ---- snoozed -------------------------------------------------------- */
    .bc-todo-snoozed { margin-top: var(--bc-space-4, 10px); border-top: 1px solid var(--bc-border, #e5e7eb); padding-top: var(--bc-space-2, 6px); }
    .bc-todo-snoozed > summary {
      cursor: pointer; font-size: var(--bc-text-xs, 12px); color: var(--bc-muted, #6b7280);
      display: flex; align-items: center; gap: var(--bc-space-2, 6px); list-style: none;
    }
    .bc-todo-snoozed > summary::-webkit-details-marker { display: none; }
    .bc-todo-snoozed > summary:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 2px; }
    .bc-todo-snoozed-row { display: flex; align-items: center; gap: var(--bc-space-3, 8px); padding: var(--bc-space-1, 4px) 0; font-size: var(--bc-text-sm, 13px); }
    .bc-todo-snoozed-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bc-todo-snoozed-when { color: var(--bc-text-subtle, var(--bc-muted, #6b7280)); font-size: var(--bc-text-xs, 12px); }
    .bc-todo-wake {
      border: 1px solid var(--bc-border, #e5e7eb); background: var(--bc-surface-3, #f7fafc);
      color: var(--bc-text, #1b2430); border-radius: var(--bc-radius-pill, 999px);
      font: inherit; font-size: var(--bc-text-2xs, 11px);
      padding: 1px var(--bc-space-3, 8px); cursor: pointer; flex: 0 0 auto;
    }
    .bc-todo-wake:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); }
    .bc-todo-wake:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 1px; }

    /* ---- footer: streak + pomodoro -------------------------------------- */
    .bc-todo-tools {
      display: flex; align-items: center; gap: var(--bc-space-2, 6px);
      padding-top: var(--bc-space-3, 8px); margin-top: var(--bc-space-4, 10px);
      border-top: 1px solid var(--bc-border, #e5e7eb);
      font-size: var(--bc-text-xs, 12px);
    }
    .bc-todo-tools:empty { display: none; }
    /* A real button: it exposes grace/repair state and can repair a broken day. */
    .bc-todo-chip {
      display: inline-flex; align-items: center; gap: var(--bc-space-2, 6px);
      border: 0; background: transparent; color: var(--bc-muted, #6b7280);
      font: inherit; font-weight: var(--bc-weight-semibold, 600);
      cursor: pointer; padding: var(--bc-space-1, 4px) var(--bc-space-2, 6px);
      border-radius: var(--bc-radius-pill, 999px); line-height: 1;
    }
    .bc-todo-chip:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); color: var(--bc-text, #1b2430); }
    .bc-todo-chip:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 1px; }
    .bc-todo-chip .bc-num { font-variant-numeric: tabular-nums; letter-spacing: 0; }
    /* Lit only when the streak is actually alive — a flame on a zero-day streak
       is just noise. */
    .bc-todo-chip.bc-lit { color: var(--bc-warn, #a16207); }
    .bc-todo-chip.bc-lit:hover { color: var(--bc-warn, #a16207); }
    .bc-todo-pom { margin-left: auto; }
    .bc-todo-pom[aria-pressed="true"] { color: var(--bc-accent-text, var(--bc-accent, #0374b5)); }

    /* ---- kanban --------------------------------------------------------- */
    .bc-todo-kanban { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--bc-space-2, 6px); }
    .bc-kan-col {
      background: var(--bc-surface-3, #f7fafc); border-radius: var(--bc-radius-md, 8px);
      padding: var(--bc-space-3, 8px); min-height: 120px;
    }
    .bc-kan-col h4 {
      margin: 0 0 var(--bc-space-2, 6px); font-size: var(--bc-text-2xs, 11px);
      text-transform: uppercase; letter-spacing: var(--bc-tracking-caps, .04em);
      color: var(--bc-muted, #6b7280); display: flex; align-items: center; gap: var(--bc-space-1, 4px);
    }
    .bc-kan-col h4 .bc-num { font-variant-numeric: tabular-nums; letter-spacing: 0; }
    .bc-kan-col.bc-drop { outline: 2px dashed var(--bc-accent, #0374b5); outline-offset: -2px; }
    .bc-todo-kanban .bc-todo-item { cursor: grab; grid-template-columns: 1fr; }
    .bc-todo-kanban .bc-todo-item.bc-dragging { opacity: .4; }
    /* Three columns inside a sidebar are three words wide. One column each,
       stacked, is still a kanban and is actually readable. */
    @container bctodo (max-width: 340px) {
      .bc-todo-kanban { grid-template-columns: 1fr; }
      .bc-kan-col { min-height: 0; }
    }

    /* ---- detail popover ------------------------------------------------- */
    .bc-todo-pop {
      position: absolute; z-index: 30; width: 260px; padding: var(--bc-space-5, 12px);
      background: var(--bc-surface-2, #fff); border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-lg, 10px); box-shadow: var(--bc-shadow-3, 0 8px 24px rgba(0,0,0,.18));
      font-size: var(--bc-text-xs, 12px);
    }
    .bc-todo-pop h5 { margin: 0 var(--bc-space-7, 16px) var(--bc-space-3, 8px) 0; font-size: var(--bc-text-xs, 12px); }
    .bc-todo-pop label { display: block; margin: var(--bc-space-2, 6px) 0 2px; color: var(--bc-muted, #6b7280); }
    .bc-todo-pop input, .bc-todo-pop select, .bc-todo-pop textarea {
      width: 100%; box-sizing: border-box; padding: var(--bc-space-1, 4px) var(--bc-space-2, 6px);
      border-radius: var(--bc-radius-md, 6px);
      border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit;
      font: inherit; font-size: var(--bc-text-xs, 12px);
    }
    .bc-todo-pop .bc-sub { display: flex; gap: var(--bc-space-2, 6px); align-items: center; margin: var(--bc-space-1, 4px) 0; }
    .bc-todo-pop .bc-sub input[type="checkbox"] { width: auto; }
    .bc-todo-pop .bc-sub span.done { text-decoration: line-through; color: var(--bc-text-subtle, var(--bc-muted, #6b7280)); }
    .bc-todo-pop .bc-pop-close { position: absolute; top: var(--bc-space-2, 6px); right: var(--bc-space-2, 6px); }
    .bc-todo-tags { font-size: var(--bc-text-3xs, 10px); color: var(--bc-muted, #6b7280); display: flex; align-items: center; gap: var(--bc-space-2, 6px); margin-top: 2px; flex-wrap: wrap; }
    .bc-todo-tags b { font-weight: var(--bc-weight-semibold, 600); background: var(--bc-surface-4, rgba(0,0,0,.06)); border-radius: var(--bc-radius-sm, 4px); padding: 0 var(--bc-space-1, 4px); }
    .bc-todo-subcount { display: inline-flex; align-items: center; gap: 3px; font-variant-numeric: tabular-nums; }
    .bc-todo-taglist { display: inline-flex; align-items: center; gap: 3px; }

    /* ---- time-block ----------------------------------------------------- */
    .bc-tb-grid { position: relative; border: 1px solid var(--bc-border, #e5e7eb); border-radius: var(--bc-radius-md, 8px); overflow: hidden; }
    .bc-tb-hour { display: flex; height: 34px; border-top: 1px solid var(--bc-border, #e5e7eb); }
    .bc-tb-hour:first-child { border-top: 0; }
    .bc-tb-hour em {
      flex: 0 0 46px; font-style: normal; font-size: var(--bc-text-3xs, 10px);
      color: var(--bc-muted, #6b7280); padding: 2px var(--bc-space-1, 4px);
      border-right: 1px solid var(--bc-border, #e5e7eb);
      font-variant-numeric: tabular-nums;
    }
    .bc-tb-hour.bc-drop { background: var(--bc-accent-weak, rgba(3,116,181,.12)); }
    .bc-tb-block {
      position: absolute; left: 50px; right: var(--bc-space-1, 4px);
      border-radius: var(--bc-radius-md, 6px); padding: 2px var(--bc-space-2, 6px);
      background: var(--bc-todo-accent, var(--bc-accent, #0374b5)); color: var(--bc-accent-contrast, #fff);
      font-size: var(--bc-text-2xs, 11px);
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis; cursor: grab;
      display: flex; align-items: center; gap: var(--bc-space-2, 6px);
    }
    .bc-tb-block span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
    .bc-tb-block .bc-todo-ibtn { color: inherit; opacity: .85; width: 18px; height: 18px; }
    .bc-tb-block .bc-todo-ibtn:hover { opacity: 1; background: rgba(255,255,255,.2); }
    .bc-tb-tray { display: flex; flex-wrap: wrap; gap: var(--bc-space-2, 6px); margin-bottom: var(--bc-space-3, 8px); }
    .bc-tb-tray .bc-tb-chip {
      border: 1px dashed var(--bc-border, #e5e7eb); border-radius: var(--bc-radius-pill, 999px);
      padding: 2px var(--bc-space-4, 10px);
      font-size: var(--bc-text-2xs, 11px); cursor: grab; background: var(--bc-surface-3, #f7fafc);
    }
  `;

  const POM_CSS = `
    .bc-pom-dock {
      position: fixed; right: 18px; bottom: 18px; z-index: var(--bc-z-dock, 2147480000);
      display: flex; align-items: center; gap: var(--bc-space-3, 8px); padding: var(--bc-space-3, 8px) var(--bc-space-5, 12px);
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #111);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: 999px;
      box-shadow: var(--bc-shadow-3, 0 8px 24px rgba(0,0,0,.22));
      font: var(--bc-text-sm, 13px)/1.2 var(--bc-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    }
    .bc-pom-dock b { font-variant-numeric: tabular-nums; }
    .bc-pom-dock.bc-break b { color: var(--bc-success, #047857); }
    /* Two signals for a paused timer: the figure dims and the dock loses its
       accent rim. Colour alone would not survive a colour-blind mode. */
    .bc-pom-dock.bc-paused b { color: var(--bc-text-subtle, var(--bc-muted, #6b7280)); }
    .bc-pom-dock.bc-paused { border-style: dashed; }
    .bc-pom-dock button { border: 0; background: transparent; cursor: pointer; font-size: var(--bc-text-sm, 13px); color: inherit; padding: 0 2px; }
    .bc-pom-task { max-width: 140px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--bc-muted, #6b7280); }
    .bc-pom-stats {
      position: fixed; right: 18px; bottom: 64px; z-index: var(--bc-z-popover, 2147481500); width: 200px; padding: var(--bc-space-4, 10px);
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #111);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: var(--bc-radius-lg, 10px);
      box-shadow: var(--bc-shadow-3, 0 8px 24px rgba(0,0,0,.22)); font-size: var(--bc-text-xs, 12px);
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
    // Every star, snooze, drag and subtask tick lands here. updateLocal rejects
    // when the storage quota is exceeded, and each call site chains .then()
    // without a catch, so a failed write was both invisible to the user and an
    // unhandled rejection. Report once and let the chain continue, so the UI
    // still re-renders rather than freezing mid-interaction.
    return BC.storage.updateLocal((d) => { mutator((d.todo = d.todo || {})); })
      .catch((e) => {
        BC.diag.push("todo:write", e);
        BC.toast.error("Couldn't save that change");
      });
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

  // ---- progress indicator ------------------------------------------------
  // One number, six ways to show it. The ring was the only choice and the worst
  // fit for where this widget lives: 46px across, "100%" set at 12px inside a
  // 36px hole, and a <text> element that ignored the user's font scale so the
  // figure either collided with the arc or stayed tiny when everything else grew.
  const PROGRESS_STYLES = ["off", "ring", "bar", "segments", "rainbow", "text"];
  const MAX_SEGMENTS = 20;

  function progressHtml(style, done, total) {
    if (style === "off" || !PROGRESS_STYLES.includes(style)) return "";
    const pct = total ? Math.round((done / total) * 100) : 0;
    const left = Math.max(0, total - done);
    // One sentence that works for every style, because the graphic itself is
    // aria-hidden: a screen reader gets the reading, not the geometry.
    const label = total
      ? `${done} of ${total} done, ${pct}%` + (left ? `, ${left} left` : "")
      : "Nothing in this window";
    const meter = (inner) =>
      `<div class="bc-todo-prog bc-todo-prog--${style}" role="progressbar" aria-valuemin="0" ` +
      `aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(label)}" title="${esc(label)}">${inner}</div>`;

    if (style === "text") {
      return meter(`<div class="bc-prog-text"><b>${done}</b> of <b>${total}</b> done</div>`);
    }

    if (style === "ring") {
      const R = 19, C = 2 * Math.PI * R;
      const off = (C * (1 - (total ? done / total : 0))).toFixed(2);
      // The figure is what is LEFT, so it is one or two characters at any font
      // scale. At zero it becomes a check: finishing should look like finishing.
      const centre = total && left === 0
        ? `<span class="bc-prog-ring-val bc-prog-done">${BC.icons.svg("check", { size: 18 })}</span>`
        : `<span class="bc-prog-ring-val">${left}</span>`;
      return meter(
        `<div class="bc-prog-row">
          <div class="bc-prog-ringwrap">
            <svg class="bc-prog-ring" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
              <circle class="bc-prog-ring-track" cx="22" cy="22" r="${R}" fill="none" stroke-width="3.5"/>
              <circle class="bc-prog-ring-fill" cx="22" cy="22" r="${R}" fill="none" stroke-width="3.5"
                      stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off}"
                      transform="rotate(-90 22 22)"/>
            </svg>${centre}
          </div>
          <div class="bc-prog-count"><b>${done}</b>/${total} done<br>${left} to go</div>
        </div>`);
    }

    if (style === "segments") {
      // One tick per task up to a cap, then each tick stands for several. Past
      // twenty they would be sub-pixel slivers in a sidebar.
      const n = Math.max(1, Math.min(total || 1, MAX_SEGMENTS));
      const filled = total ? Math.round((done / total) * n) : 0;
      let segs = "";
      for (let i = 0; i < n; i++) segs += `<span class="bc-prog-seg${i < filled ? " on" : ""}"></span>`;
      return meter(
        `<div class="bc-prog-row">
          <div class="bc-prog-segs" aria-hidden="true">${segs}</div>
          <div class="bc-prog-count"><b>${done}</b>/${total}</div>
        </div>`);
    }

    // bar and rainbow share everything but the fill. Sizing the spectrum to the
    // TRACK rather than to the fill is what makes the colour at the tip mean
    // something: at 20% you are in the reds, at 90% in the violets.
    const rainbow = style === "rainbow";
    const size = rainbow ? ` background-size: ${(pct > 0 ? (100 / pct) * 100 : 100).toFixed(1)}% 100%;` : "";
    return meter(
      `<div class="bc-prog-row">
        <div class="bc-prog-track" aria-hidden="true">
          <div class="bc-prog-fill${rainbow ? " bc-prog-fill--rainbow" : ""}" style="width: ${pct}%;${size}"></div>
        </div>
        <div class="bc-prog-count"><b>${done}</b>/${total}</div>
      </div>`);
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
                 t.view || "", t.layout || "", t.showCompleted ? 1 : 0, accent].join("|");
    const ae = document.activeElement;
    const typing = ae && container.contains(ae) && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA");
    const popoverOpen = !!container.querySelector(".bc-todo-pop");
    if (!force && (container.dataset.bcSig === sig || typing || popoverOpen)) return;
    container.dataset.bcSig = sig;

    const start = new Date(state.windowStart || Date.now()); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate() + parseInt(t.rangeDays, 10) - 1);

    const ic = (n, size) => BC.icons.svg(n, size ? { size } : undefined);
    const iconBtn = (icon, attrs) =>
      `<button type="button" class="bc-todo-ibtn" ${attrs}>${ic(icon)}</button>`;
    const view = ["list", "kanban", "timeblock"].includes(t.view) ? t.view : "list";
    const VIEWS = [["list", "list", "List"], ["kanban", "columns", "Kanban"], ["timeblock", "timeline", "Time-block"]];

    // One attribute, five presentations. The alternative -- a render function
    // per layout -- would fork the checkbox handlers, the snooze wiring and the
    // container queries five ways, and they would drift apart within a release.
    const layout = LAYOUTS.indexOf(t.layout) >= 0 ? t.layout : "comfortable";
    if (container.getAttribute("data-bc-layout") !== layout) {
      container.setAttribute("data-bc-layout", layout);
    }

    container.innerHTML = `
      <div class="bc-todo-head">
        <div class="bc-todo-headings">
          <span class="bc-todo-eyebrow">To Do</span>
          <h3 class="bc-todo-title">${BC.util.escapeHtml(BC.dt.fmtRange(start, end))}</h3>
        </div>
        <div class="bc-todo-nav">
          ${iconBtn("chevron-left", 'data-nav="prev" aria-label="Previous period" title="Previous"')}
          ${iconBtn("target", 'data-nav="today" aria-label="Jump to today" title="Today"')}
          ${iconBtn("chevron-right", 'data-nav="next" aria-label="Next period" title="Next"')}
        </div>
      </div>
      ${progressHtml(t.progress, done, total)}
      <div class="bc-todo-toolbar">
        <div class="bc-todo-seg" role="group" aria-label="View">
          ${VIEWS.map(([id, icon, label]) =>
            `<button type="button" class="bc-todo-ibtn" data-view="${id}" aria-pressed="${view === id}" ` +
            `aria-label="${label} view" title="${label}">${ic(icon)}</button>`).join("")}
        </div>
        <span class="bc-todo-spacer"></span>
        <details class="bc-todo-filters">
          <summary aria-label="Range, grouping and course filter" title="Filters">
            <span class="bc-todo-ibtn" role="presentation">${ic("sliders")}</span>
          </summary>
          <div class="bc-todo-pane">
            <div>
              <label for="bc-todo-range-sel">Range</label>
              <select id="bc-todo-range-sel" class="bc-todo-range">
                <option value="3">3 days</option><option value="7">1 week</option>
                <option value="14">2 weeks</option><option value="30">1 month</option>
              </select>
            </div>
            <div>
              <label for="bc-todo-group-sel">Group by</label>
              <select id="bc-todo-group-sel" class="bc-todo-group">
                <option value="day">Day</option>
                <option value="course">Course</option>
                <option value="priority">Priority</option>
                <option value="tag">Tag</option>
                <option value="none">Nothing</option>
              </select>
            </div>
            <div>
              <label for="bc-todo-course-sel">Course</label>
              <select id="bc-todo-course-sel" class="bc-todo-filter"></select>
            </div>
          </div>
        </details>
      </div>
      <div class="bc-todo-list"></div>
      ${t.allowNewTask ? `<div class="bc-todo-new">
        ${ic("plus", 14)}
        <input placeholder="Add a task…" aria-label="New personal task"/>
        ${iconBtn("arrow-right", 'data-add aria-label="Add task" title="Add task"')}
      </div>` : ""}
      <div class="bc-todo-tools">
        ${t.streaks && t.streaks.enabled
          ? `<button type="button" class="bc-todo-chip bc-todo-streak" title="Daily task streak">` +
            `${ic("flame")}<span class="bc-num" data-streak>0</span></button>` : ""}
        ${t.pomodoro && t.pomodoro.enabled
          ? `<button type="button" class="bc-todo-chip bc-todo-pom" data-pom aria-pressed="false"></button>` : ""}
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

    // The view is a segmented group of icon buttons rather than a fourth select:
    // it is the one control worth permanent space, and three 26px targets cost
    // less height than a full-width dropdown.
    container.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-view");
        if (v === view) return;
        BC.storage.update((d) => { d.todo.view = v; });
      });
    });

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
        // The flame only burns while the streak does. Lit on a zero-day streak
        // it is decoration; lit only when there is something to lose, it is the
        // one spot of colour in the footer and it means something.
        streakChip.classList.toggle("bc-lit", ss.current > 0);
        // The count alone is not a sentence. The label is what a screen reader
        // gets where a sighted user gets a flame next to a number.
        streakChip.setAttribute("aria-label", ss.current + "-day streak");
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
    // startPomodoro toggles, so the label has to say which way it will go. It
    // read "Pomodoro" in both states, so pressing it during a session looked
    // like a no-op that had actually just stopped the timer.
    const pom = container.querySelector("[data-pom]");
    if (pom) {
      const paintPom = () => {
        const p = (BC.storage.local || {}).pomodoro;
        const running = !!(p && p.phase);
        const label = running ? "Stop pomodoro" : "Start pomodoro";
        // The icon carries the direction, so the word "Pomodoro" no longer has
        // to sit in a 280px footer next to the streak. The name stays on the
        // control for anyone who cannot see the icon.
        if (pom.dataset.state !== String(running)) {
          pom.dataset.state = String(running);
          pom.innerHTML = BC.icons.svg(running ? "stop" : "play", { size: 13 });
        }
        pom.setAttribute("aria-label", label);
        pom.setAttribute("title", label);
        pom.setAttribute("aria-pressed", running ? "true" : "false");
      };
      paintPom();
      pom.addEventListener("click", () => {
        startPomodoro(settings);
        // The store write is async; repaint once it has landed.
        setTimeout(paintPom, 0);
      });
    }

    // New task
    const newInp = container.querySelector(".bc-todo-new input");
    const newBtn = container.querySelector(".bc-todo-new [data-add]");
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

    if (!items.length && !sleeping.length) { list.innerHTML = `<div class="bc-todo-empty">${BC.icons.svg("check-circle", { size: 18 })}<span>Nothing due in this window</span></div>`; return; }

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
      html += `<details class="bc-todo-snoozed"><summary>${BC.icons.svg("moon", { size: 12 })} Snoozed (${sleeping.length})</summary>`;
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
      `<div class="bc-kan-col" data-col="${id}"><h4>${title}<span class="bc-num">${arr.length}</span></h4>` +
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
        <span>${esc(title)}</span>
        <button type="button" class="bc-todo-ibtn" data-unsched="${esc(key)}"
                aria-label="Unschedule ${esc(title)}" title="Unschedule"
          >${BC.icons.svg("close", { size: 12 })}</button></div>`;
    }

    list.innerHTML = `
      <div class="bc-todo-day-header">${BC.util.escapeHtml(BC.dt.fmtDay(day))} — drag tasks onto the grid</div>
      <div class="bc-tb-tray">${unscheduled.slice(0, 15).map((it) =>
        `<span class="bc-tb-chip" draggable="true" data-i="${state.items.indexOf(it)}">${BC.util.escapeHtml((it.plannable && it.plannable.title) || it.plannable_title || "Task")}</span>`
      ).join("") || `<span class="bc-todo-empty">${BC.icons.svg("check-circle", { size: 16 })}<span>Everything is scheduled</span></span>`}</div>
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
      <button type="button" class="bc-todo-ibtn bc-pop-close" aria-label="Close"
        >${BC.icons.svg("close", { size: 14 })}</button>
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
      <button type="button" class="bc-todo-chip" data-pom-task-start style="margin-top: var(--bc-space-3, 8px)"
        >${BC.icons.svg("play", { size: 13 })}Start pomodoro on this task</button>
    `;
    // Dialog semantics: it was an unlabelled div that took no focus, so a screen
    // reader user got no announcement and a keyboard user had to tab through the
    // whole page to reach it.
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "false");
    pop.setAttribute("aria-label", "Task details");
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
    // Clicking anywhere outside dismisses, which is what every other popover in
    // the extension does; without it the only way out was the small close glyph,
    // and a stale popover also blocked the widget from re-rendering.
    const onDocDown = (e) => {
      if (pop.contains(e.target) || e.target === anchor) return;
      close();
    };
    const close = () => {
      document.removeEventListener("mousedown", onDocDown, true);
      pop.remove();
      // Return focus to the control that opened it rather than dropping it to
      // <body> and losing the user's place in the list.
      BC.util.guard(() => anchor.focus(), "todo popover focus restore");
      render(settings, container, true);
    };
    document.addEventListener("mousedown", onDocDown, true);
    pop.querySelector(".bc-pop-close").addEventListener("click", close);
    pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    if (BC.ui && BC.ui.focusTrap) BC.ui.focusTrap(pop, { returnTo: anchor });
    else BC.util.guard(() => pop.querySelector("[data-pri]").focus(), "todo popover focus");
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
    if (tags.length) {
      // One icon for the group, not one per chip: the chips are already visually
      // distinct, and a glyph on each turned three tags into six objects.
      meta.push('<span class="bc-todo-taglist">' + BC.icons.svg("tag", { size: 11 }) +
                tags.map((tg) => "<b>" + BC.util.escapeHtml(tg) + "</b>").join("") + "</span>");
    }
    if (subs.length) {
      meta.push('<span class="bc-todo-subcount">' + BC.icons.svg("checklist", { size: 11 }) +
                subDone + "/" + subs.length + "</span>");
    }
    const title = BC.util.escapeHtml(p);
    // Three bordered boxes on every row read louder than the task itself. These
    // are icon buttons that surface on hover or keyboard focus — and stay put on
    // touch, where there is no hover to surface them with.
    const actions = `<div class="bc-todo-actions">
          <button type="button" class="bc-todo-ibtn bc-todo-star${starred ? " on" : ""}" data-key="${esc(key)}"
                  aria-pressed="${starred ? "true" : "false"}"
                  aria-label="Star ${title}" title="${starred ? "Unstar" : "Star"}"
            >${BC.icons.svg(starred ? "star-filled" : "star", { size: 14 })}</button>
          <button type="button" class="bc-todo-ibtn bc-todo-snooze" data-key="${esc(key)}"
                  aria-label="Snooze ${title} until tomorrow" title="Snooze until tomorrow"
            >${BC.icons.svg("moon", { size: 14 })}</button>
          <button type="button" class="bc-todo-ibtn bc-todo-more" data-key="${esc(key)}"
                  aria-label="Details for ${title}" title="Details"
            >${BC.icons.svg("more", { size: 14 })}</button>
        </div>`;
    return `
      <div class="bc-todo-item ${complete ? "done" : ""}" data-key="${esc(key)}" data-i="${idx}">
        <button type="button" class="bc-todo-check ${complete ? "done" : ""}" data-i="${idx}"
                aria-pressed="${complete ? "true" : "false"}"
                aria-label="${complete ? "Mark incomplete" : "Mark complete"}: ${title}"
          >${BC.icons.svg("check", { size: 13 })}</button>
        <div>
          <a class="bc-todo-name" href="${BC.util.escapeHtml(url)}">${title}</a>
          <div class="bc-todo-course">${BC.util.escapeHtml(course)}${due ? " · " + BC.util.escapeHtml(BC.dt.dueLabel(due)) : ""}</div>
          ${meta.length ? `<div class="bc-todo-tags">${meta.join("")}</div>` : ""}
        </div>
        ${compact ? "" : actions}
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
        phase: "work", cycle: prev.cycle || 0, pausedAt: null,
        startedAt: Date.now(), endsAt: Date.now() + min * 60000,
        taskTitle: taskTitle || "", sessions: prev.sessions || [],
      };
    }).then(() => { BC.toast.success(`Pomodoro started · ${min}m`); ensurePomodoroDock(BC.storage.current); });
  }

  // Pause was the one control a 25-minute timer obviously needed and did not
  // have: the only way to answer the door was to stop and lose the session.
  // The state is a single end timestamp, so pausing records when it froze and
  // resuming pushes the end out by however long that was.
  // Pure, and exported on BC.features.todo, because the whole correctness of
  // pause is "does the time you get back equal the time you were away" — which
  // is a statement about two numbers, not about a dock.
  function togglePause(p, now) {
    if (!p || !p.phase) return p;
    if (p.pausedAt) { p.endsAt += now - p.pausedAt; p.pausedAt = null; }
    else p.pausedAt = now;
    return p;
  }

  // One definition of "how long is left", read by the tick and by the label, so
  // a paused dock cannot count down while looking stopped.
  function pomRemaining(p, now) {
    if (!p || !p.phase) return 0;
    return Math.max(0, p.endsAt - (p.pausedAt || now));
  }

  function togglePomodoroPause() {
    BC.storage.updateLocal((d) => { togglePause(d.pomodoro, Date.now()); }).then(() => {
      const p = (BC.storage.local || {}).pomodoro || {};
      BC.toast.info(p.pausedAt ? "Pomodoro paused" : "Pomodoro resumed");
      paintPomDock();
    });
  }

  // The dock's own state, repainted from the store rather than from a closure,
  // so the tick and a click cannot disagree about whether it is running.
  function paintPomDock() {
    const el = document.querySelector('[data-bc-node="bc-pom-dock"]');
    const cur = (BC.storage.local || {}).pomodoro;
    if (!el || !cur) return;
    const paused = !!cur.pausedAt;
    const btn = el.querySelector("[data-pom-pause]");
    if (btn && btn.dataset.state !== String(paused)) {
      btn.dataset.state = String(paused);
      btn.innerHTML = BC.icons.svg(paused ? "play" : "pause", { size: 14 });
      const label = paused ? "Resume the timer" : "Pause the timer";
      btn.setAttribute("aria-label", label);
      btn.title = label;
    }
    el.classList.toggle("bc-paused", paused);
  }

  function stopPomodoro() {
    stopPomTick();
    BC.storage.updateLocal((d) => {
      if (d.pomodoro) { d.pomodoro.phase = null; d.pomodoro.taskTitle = ""; d.pomodoro.pausedAt = null; }
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
      // A new phase always starts running; carrying a pause across the boundary
      // would freeze the break the moment it began.
      p.pausedAt = null;
    }).then(() => {
      const p = (BC.storage.local || {}).pomodoro;
      if (!p || !p.phase) return;
      if (cfg.sound !== false) pomBeep();
      BC.toast.success(p.phase === "work" ? "Break over — back to work" : `Pomodoro done! ${PHASE_LABEL[p.phase]} time.`);
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
      // Every control here was a glyph: a tomato for the stats toggle, a
      // skip-track arrow and a multiplication sign. The tomato rendered in full
      // colour beside monochrome text and the other two were font roulette.
      const dbtn = (icon, attr, label) =>
        `<button type="button" class="bc-todo-ibtn" ${attr} aria-label="${label}" title="${label}"` +
        `>${BC.icons.svg(icon, { size: 14 })}</button>`;
      d.innerHTML = dbtn("timer", "data-pom-stats", "Pomodoro session stats") +
        `<b data-pom-time>--:--</b>` +
        `<span data-pom-phase></span><span class="bc-pom-task" data-pom-task></span>` +
        dbtn("pause", "data-pom-pause", "Pause the timer") +
        dbtn("skip-forward", "data-pom-skip", "Skip to the next phase") +
        dbtn("close", "data-pom-stop", "Stop the timer");
      document.body.appendChild(d);
      d.querySelector("[data-pom-stop]").addEventListener("click", stopPomodoro);
      d.querySelector("[data-pom-pause]").addEventListener("click", togglePomodoroPause);
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
        const remaining = pomRemaining(cur, Date.now());
        if (!cur.pausedAt && remaining <= 0) { advancePomodoro(BC.storage.current); return; }
        const m = Math.floor(remaining / 60000), s = Math.floor((remaining % 60000) / 1000);
        const timeEl = el.querySelector("[data-pom-time]");
        if (timeEl) timeEl.textContent = m + ":" + String(s).padStart(2, "0");
        const phEl = el.querySelector("[data-pom-phase]");
        if (phEl) phEl.textContent = PHASE_LABEL[cur.phase] || "";
        const taskEl = el.querySelector("[data-pom-task]");
        if (taskEl) taskEl.textContent = cur.taskTitle || "";
        el.classList.toggle("bc-break", cur.phase !== "work");
        paintPomDock();
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

  // Exposed for the test suite: the pause arithmetic is the part worth pinning
  // down, and it is unreachable through apply().
  BC.todoPomodoro = { togglePause, pomRemaining };

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
