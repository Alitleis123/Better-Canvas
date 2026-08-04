# Better Canvas 3.1

The most feature-complete browser extension for Instructure Canvas — free forever, local-only, no accounts, no telemetry.

- **Cross-browser.** Chrome (Manifest V3), Firefox, Zen.
- **Same-origin only.** Every Canvas API call uses your existing session — nothing is sent off-domain.
- **No paywalls, no accounts.** Every feature ships free.

---

## Features

### Appearance (30+ knobs)
- Dark mode: Off / On / Auto (system) / Scheduled window.
- **Dark mode inside iframes** — SpeedGrader submissions, New Quizzes, and other embedded Canvas frames.
- **6 dark palettes** (Neutral, Slate, Midnight, Nord, Dracula, Solarized) + **6 light palettes** + custom-background derivation.
- **12 built-in preset themes** with one-click apply.
- **Theme creator** — save your current look as a named custom theme, export/import as JSON, share without accounts.
- **Theme rotation** — cycle through selected themes daily or weekly.
- Accent color, custom font stack, five font-size scales, line-height + letter-spacing sliders.
- Density (Compact/Default/Spacious/Cozy), global corner-radius slider, rounded-vs-square UI toggle, sidebar-width control.
- **Color-blind modes** (Protanopia/Deuteranopia/Tritanopia via SVG filters).
- **High-contrast**, **reduced-motion**, master **animation-speed slider**.
- Cursor styles (default/large/precise), focus-ring styles.
- Institution logo: hide / replace with image / replace with text.

### Dashboard
- Card layouts: **Grid / List / Masonry / Compact**, with size and radius sliders.
- Drag-reorder, rename, recolor, hide, background-image per card.
- **Inline grade badge**, **progress bar**, **due-count badge**, **grade sparkline** from locally recorded history.
- Course search bar, hover-lift animation.
- **Semester progress bar** — "Week 9 of 15 · 43 days left" from your term dates.
- Auto-hide concluded courses.
- Widgets: To Do, Coming Up, Recent Feedback, and an estimated-**GPA** card.

### Planner / To Do
Three modes:
- **Canvas default** — untouched.
- **Clean circles** — CSS restyle of the native list.
- **Planner widget** — completion **ring**, week nav, course filter, groupings (day/course/priority/tag/none), views (list/**kanban**/time-block), custom accent, star / snooze, personal tasks.
- **Kanban board** with drag-and-drop status columns; dropping on Done completes the Canvas item.
- **Time-block view** — drag tasks onto a 7am–10pm day grid to schedule them.
- **Recurring tasks** (daily / weekly with weekday mask / monthly), **subtasks**, **tags**, and **priorities** with an item-detail popover.
- **Streaks** with configurable **grace days** + monthly **repairs** (fixes the #1 Tasks-for-Canvas complaint).
- **Pomodoro** timer with a persistent dock widget, task binding, and a local session log — survives reloads.

### Grades & GPA
- **Grade tools panel** on every course grades page: current score, goal tracker, "grade needed on final" solver, **weight donut**, **missing-assignments** warning.
- **Grade trend chart** — inline SVG of your locally stored grade history per course.
- **Rubric predictor** on assignment pages: slide each criterion and see the projected score plus its impact on your course grade.
- **Grade goals** with breach notifications.
- **What-if** grades (Canvas built-in stays on).
- **GPA calculator**: Standard 4.0 / 4.3 scale (A+ = 4.3) / High-school unweighted.
- Auto-refresh grades page (configurable interval).

### Notifications
- In-page toasts and **browser notifications** (opt-in via permission).
- Types: due-soon, new grade, new announcement, goal breach, streak-at-risk.
- Per-type toggles, **quiet hours** window, toolbar **badge counter** for items due in 24 hours.
- Configurable lead times (defaults 1h/4h/1d).

### Files
- **Cross-course library** — one panel that lists every file across every course, with search + type + course + sort filters.
- **Star / favorite** files, one-click open.

### Announcements
- **Aggregator** on the dashboard: recent announcements across all your courses, newest first.

### Modules & courses
- **Module progress bars** — per-module completion on the modules page plus a course-wide summary.

### Discussions
- **Collapse/expand all replies**, **jump to next unread**, reply/unread/word-count stats.
- **Instructor posts highlighted** with a left border and tag.

### Quizzes
- **Quiz draft saver** — classic-quiz answers are snapshotted locally as you type; if the tab crashes or closes, a restore banner brings them back. Crash protection only — it never answers or submits anything.

### Calendar
- **.ics export** of Canvas assignments + personal events (download).
- **Mini month view** on dashboard.
- **Syllabus date extraction** — scan the syllabus page for dates and add the ones you pick to the planner.

### Navigation
- Reorder / hide global-nav items; add custom global links.
- Hide / reorder course-nav tabs by label; add custom course links.
- Breadcrumbs style (default / compact / hidden), course **quick-switch tab bar**.

### Command palette & shortcuts
- **⌘K / Ctrl-K palette** — jump to any tab, any course, any command.
- **Rebindable shortcuts** for every action (⌘⇧S settings, ⌘⇧D dark, ⌘⇧T quick task, ⌘⇧N quick note, g d/g/i/c to navigate).

### Productivity
- **Focus mode** on any Canvas page.
- **Reading ruler** and **reading-progress bar** on long pages.
- **Sticky notes** anywhere on Canvas, per URL.
- **Auto-save drafts** for every textarea, restored on next visit.
- **Word / character count** on all Canvas text editors.
- **Print-friendly view**, **copy-URL** floating button.

### Assignment previews
- Hover over any assignment link to see a floating card with title / due date / points / score / description — no page nav.

### Accessibility
- **TTS "Speak"** button on assignments / announcements / discussion bodies.
- **Larger click targets**, **dyslexia-friendly font stack**.
- Color-blind SVG palette shifts. Reduced-motion honored.

### Insights
- **Study-time tracking** — minutes on Canvas per course per day, all local, with a 14-day chart in settings.
- **Grade trend sparklines** and **Pomodoro session history** in the same tab.

### Instructor helpers
- **Roster CSV export**, attendance quick-mark (P/A buttons + CSV), **ungraded-count badges** on the assignments index.

### Backgrounds & CSS
- Full-page background: solid / gradient / image / **repeating pattern** (dots, grid, diagonal, topography), blur + opacity.
- **Custom CSS** escape hatch, injected on every page.

### Data
- Export / import all settings.
- Reset per-section or all.
- Undo/redo history (last 30 changes) inside the settings drawer.

---

## Install (from source)

1. Build the unpacked extensions:
   ```powershell
   powershell -ExecutionPolicy Bypass -File build.ps1
   ```
   This populates `dist/chrome` and `dist/firefox` after syntax-checking every JS file.

2. Load it:
   - **Chrome**: `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/chrome`.
   - **Firefox / Zen**: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `dist/firefox/manifest.json`.

3. Open any `*.instructure.com` page. Better Canvas runs automatically.

### Custom school domains
For non-instructure.com Canvas (e.g. `canvas.yourschool.edu`), click the toolbar popup on that site and grant permission. The background service worker registers the content scripts on your origin.

---

## Privacy

Better Canvas makes **no external network requests**. All Canvas calls go to your own Canvas instance using your existing cookies:

- **Reads (GET):** dashboard cards, courses/scores/terms, planner items, assignment groups, rubrics, modules, files, announcements, course people.
- **Writes (planner only):** mark a task complete, add a personal task (planner widget + syllabus extract). Uses Canvas's CSRF token — same as the Canvas UI. Nothing else is ever written — no grades, no quiz answers.

Settings live in `bcSettings`. Everything device-local — sticky notes, drafts, quiz drafts, study time, grade history, and planner metadata (stars, snoozes, subtasks, kanban status, streaks) — lives in `bcLocal`. Export/import carries both, so a backup round-trips your planner state as well as your settings. Telemetry is hard-wired **off**.

---

## Architecture

Vanilla JavaScript. No framework. No bundler. Every module attaches to a shared `globalThis.BC` namespace and is loaded as a classic script in dependency order.

```
manifest.json / manifest.firefox.json    per-browser MV3 manifests
build.ps1                                copy src/ + right manifest into dist/{chrome,firefox}
src/
  shared/
    defaults.js                          settings schema + deep-merge + migrations
    themes.js                            preset themes + isDarkActive
    tokens.js                            the single design-token emitter, shared by the
                                         page, the drawer's shadow root, the options
                                         page and the popup (+ the readability guard)
    settings/
      state.js                           undo/redo store, subscribe, adapter
      components.js                      Switch/Select/Slider/Sortable/Tags/Links/Keybind…
      index.js                           BC.SettingsUI.render(root, adapter) — every tab
  content/
    core/
      util.js, storage.js, injector.js, detect.js, observer.js
      lifecycle.js     feature registry + per-feature listener/interval bags + BC.diag
      ui.js            shared panel/card/tabs/skeleton/empty/error components
      datetime.js, color.js, cache.js, api.js, alarms.js, toast.js
      (color.js also carries the WCAG contrast helpers the token guard uses)
      shortcuts.js, commandPalette.js
    features/
      theming.js       dark/light palettes, accent, font, density, radius, focus ring, colorblind
      cosmetics.js     full-page background + custom CSS
      navigation.js    global/course nav + breadcrumbs + course tabs
      dashboard.js     cards, layouts, badges, inline grade, sparkline, hover preview
      todo.js          planner widget + kanban + time-block + recurring + streaks + Pomodoro
      grades.js        what-if, weight donut, final solver, trend chart, rubric predictor
      notifications.js due-soon + goal + announcement scans + in-page + browser toasts
      files.js         cross-course files library
      announcements.js aggregator panel
      calendar.js      .ics export + mini month view
      previews.js      hover assignment cards
      productivity.js  focus mode, reading ruler, sticky notes, drafts, word count, print
      accessibility.js TTS, colorblind SVG filters
      instructor.js    roster CSV, attendance quick-mark, ungraded badges
      quizsaver.js     classic-quiz local draft autosave + restore banner
      modules.js       per-module + course progress bars
      semester.js      dashboard term-progress bar
      discussions.js   collapse, jump-to-unread, stats, instructor highlight
      insights.js      local study-time tracker
      syllabus.js      syllabus date extraction → planner
      rotation.js      daily/weekly theme rotation
      onboarding.js    first-run tour
      settings-panel.js  left-nav trigger + Shadow-DOM drawer
    frame.js           iframe-only dark mode (SpeedGrader, New Quizzes)
    content.js         entry: applies registered features, wires observer + shortcuts + palette
  background/
    service-worker.js  register dynamic scripts on custom domains + badge + context menu
  popup/               toolbar popup: enable/dark/dash toggles + Palette + Open settings
  options/             standalone options page hosting the shared settings UI
```

### How it fits together

- **Features self-register** via `BC.registry.register({ id, styles, nodes, apply })`; `content.js` iterates the registry (theming first) and applies each feature's idempotent `apply(settings, ctx)` on every observer tick. Features swap keyed `<style>` text or toggle classes — re-applying is cheap and survives Canvas's React re-renders. Teardown derives its style/node keys from the registry.
- **`BC.lifecycle.bag(id)`** gives each feature scoped listeners/intervals that are cleared on disable; `pageBag(id)` also clears on SPA navigation. Errors land in the `BC.diag` ring buffer.
- **Settings UI is shared** via `BC.SettingsUI.render(rootEl, adapter)`. The in-page drawer backs it with live `BC.storage` + `BC.api`; the options page backs it with `chrome.storage` + messaging the active Canvas tab.
- **Dark mode / theming** is driven by CSS variables. `theming.js` emits one variable block and a static rule set consumes it — re-tinting is a single style swap.
- **Command palette + shortcuts** are wired centrally in `content.js` from `settings.shortcuts.bindings`, so users can rebind everything from Settings → Shortcuts.

### Adding a feature

1. Create `src/content/features/yourfeature.js` ending with `BC.registry.register({ id, styles: [...], nodes: [...], apply(settings, ctx) })` — declare every keyed style and node it injects so teardown can clean up.
2. Add any new settings to `src/shared/defaults.js`.
3. Register the script in both manifests and the `CONTENT_JS` list in `src/background/service-worker.js` (before `observer.js`).
4. Add controls to `src/shared/settings/index.js`.
5. Rebuild with `build.ps1`.

---

## Development

- After editing source, run `build.ps1` and reload the unpacked extension, then refresh Canvas.
- `build.ps1` runs `node --check` on every `.js` file before copying.
- No test suite — UI/feature correctness is verified in-browser on a live Canvas instance.
