# Better Canvas 3.1

The most feature-complete browser extension for Instructure Canvas — free forever, local-only, no accounts, no telemetry.

- **Cross-browser.** Chrome (Manifest V3), Firefox, Zen.
- **Same-origin only.** Every Canvas API call uses your existing session — nothing is sent off-domain.
- **No paywalls, no accounts.** Every feature ships free.

---

## The settings panel

One bar of chrome, thirteen tabs in four named groups, and a drawn mark on every
row. It is warm paper rather than a control panel: a rounded system face, an
ochre-clay accent, and card padding on the panel scale instead of the component
scale.

| | Before | Now |
|---|---|---|
| Chrome bars | 2 (the second overflowed its own right edge) | 1 |
| Tabs | 17, flat | 13, in Look / Pages / Tools / You |
| Rows carrying an icon | 0 of 125 | 128 of 128 |
| Section headings carrying an icon | 0 of 46 | 48 of 48 |
| Words of hint and section copy | 438 | 357 |
| Narrowest label column, 360–900px | 26px at 600px | ≥ 144px at every width |
| Deepest wrapped hint | 7 lines | 2 |

Five tabs that held one or two switches each — Files, Calendar, Announcements,
Instructor, and the Modules and Discussions blocks — became one **Course tools**
tab; **Accessibility** joined the colour-blind and reduced-motion switches it
already belonged beside, in Appearance. Nothing was removed.

Rows with no bearing on your current choice go inert rather than sitting there
live: pick "Canvas's own" for the planner and the planner's ten controls dim;
set the page background to None and its eight follow-up controls dim with it.

When the panel is too narrow for two columns, a row puts its control on the line
below its label, left-aligned under it. Rows whose control is a single switch are
exempt: a switch is 40px and fits beside a label at any width the panel reaches,
and stacking those too cost a second line on most of the panel at a 1100px
window.

Everything below the shell got the same treatment, because half of it had
never been rendered in a test at all: the course editor handed two `1fr` tracks
to a 300px row, so its nickname field was six characters wide and its image-URL
field read "backgro"; the GPA panel was a bordered `<table>` that wrapped every
course name over three lines; the global-nav list was the last native checkbox
in the product, rendering in system blue against a warm accent while its own
caption said "switch off to hide".

Numbers above are measured, not estimated — `test/browser/page.html` plus
`__bcPanel(width)` and `__bcRowWidths()` report label widths and hint depth from
the real engine, and `test/panel.test.js` holds them there.

---

## Features

### Skins
Not a colour scheme — a whole look. A skin carries surface art, per-card art, nav treatment, type and palette, and drives the same `--bc-*` tokens everything else reads, so one click restyles the page, the drawer, the popup and the planner together.
- **10 built-in skins** — Matcha Strawberry, Forest Study, Harvest, Bubblegum, Blueprint, Phosphor, Paper, Frost, Dusk, Meadow.
- **14 patterns generated at runtime** — gingham, lattice, plaid, stripes, grid, dots, polka, checks, floral, sprigs, waves, confetti, scallop, noise. Every one is a CSS gradient or an inline SVG built from two colours and a scale: **no image files ship**, a pattern recolours to any palette instead of needing one file per variant, it stays crisp at any zoom, and **nothing is fetched** — skins work offline and leak no request.
- **Cards cycle through the skin's patterns**, so six cards read as six related faces rather than one texture smeared across the dashboard.
- **Course colours: replace or tint.** A skin can own the card colour, or keep Canvas's course colour and let the pattern tint it — for people who navigate by colour.
- **Import / export as JSON.** A built-in, a pasted file and an edited fork are the same kind of object on the same code path. Editing a built-in forks it rather than mutating shipped data.
- **Every built-in clears AA** for body text, hint text, links and accent labels — enforced by the suite, because a pretty theme nobody can read their assignments in is not shippable.

### Appearance (30+ knobs)
- **One drawn icon set** — a single 16px grid at one stroke weight, shared by every settings row, the tab rail, the planner, the popup and every button. Nothing is a typed glyph, so nothing renders in the wrong colour or as a box when the host font lacks it.
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
- **Planner widget** — week nav, course filter, groupings (day/course/priority/tag/none), views (list/**kanban**/time-block), custom accent, star / snooze, personal tasks.
- **Five layouts** — Comfortable (boxed rows), **Compact** (hairline-separated, for a full week in a small sidebar), **Cards** (each task an object), **Minimal** (no boxes; hierarchy from type alone), **Timeline** (a rail with a node per task that fills in as you finish). One attribute drives all five, so no layout can drift into a different feature set — and none of them hides a control.
- **Six progress indicators** — ring (showing what's *left*, not a percentage), line bar, per-task segments, a **rainbow** whose hue tracks how far along you are, plain text, or none. Picked from swatches that draw themselves, not a dropdown.
- **Kanban board** with drag-and-drop status columns; dropping on Done completes the Canvas item.
- **Time-block view** — drag tasks onto a 7am to 10pm day grid to schedule them.
- **Recurring tasks** (daily / weekly with weekday mask / monthly), **subtasks**, **tags**, and **priorities** with an item-detail popover.
- **Streaks** with configurable **grace days** + monthly **repairs** (fixes the #1 Tasks-for-Canvas complaint).
- **Pomodoro** timer with a persistent dock widget, **pause/resume**, task binding, and a local session log — survives reloads.

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
Lives in the Appearance tab, beside the colour-blind and reduced-motion switches.
- **TTS "Speak"** button on assignments / announcements / discussion bodies.
- **Larger click targets**, **dyslexia-friendly font stack**.
- Color-blind SVG palette shifts. Reduced-motion honored.

### Insights
- **Study-time tracking** — minutes on Canvas per course per day, all local, with a 14-day chart in settings.
- **Grade trend sparklines** and **Pomodoro session history** in the same tab.

### Instructor helpers
In the Course tools tab.
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
   ```sh
   ./build.sh                                              # macOS, Linux
   powershell -ExecutionPolicy Bypass -File build.ps1      # Windows
   ```
   Both run `node --check` over every JS file and the full test suite, then
   populate `dist/chrome` and `dist/firefox`. They do the same thing; keep them
   in step.

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
    icons.js                             the icon set: one 16px grid, one stroke weight,
                                         currentColor. Geometry is verified by test/icons
    skins.js                             the skin engine: 14 runtime-generated patterns,
                                         validation for untrusted skins, and the stylesheet
                                         emitter that drives the token layer
    skin-catalog.js                      the 10 built-in skins. Pure data — adding one is
                                         adding an object, no code and no assets
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
                       (six progress-indicator styles; every length on the spacing scale)
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
  popup/               toolbar popup: master switch, dark/dash/reminders, palette, settings
  options/             standalone options page hosting the shared settings UI
```

### How it fits together

- **Features self-register** via `BC.registry.register({ id, styles, nodes, pages?, apply })`; `content.js` iterates the registry (theming first) and applies each feature's idempotent `apply(settings, ctx)` on every observer tick. Features swap keyed `<style>` text or toggle classes — re-applying is cheap and survives Canvas's React re-renders. Teardown derives its style/node keys from the registry.
- **`pages`** is an optional allowlist of page names from `BC.detect`. A feature that declares it is skipped entirely while off its pages, and gets exactly one more call on the tick the page changes so its own cleanup branch still runs. Features with no `pages` are global. On a course page this takes the per-tick work from 22 feature entry points down to 12.
- **`BC.lifecycle.bag(id)`** gives each feature scoped listeners/intervals that are cleared on disable; `pageBag(id)` also clears on SPA navigation. Errors land in the `BC.diag` ring buffer.
- **Settings UI is shared** via `BC.SettingsUI.render(rootEl, adapter)`. The in-page drawer backs it with live `BC.storage` + `BC.api`; the options page backs it with `chrome.storage` + messaging the active Canvas tab.
- **Dark mode / theming** is driven by CSS variables. `theming.js` emits one variable block and a static rule set consumes it — re-tinting is a single style swap.
- **Dark mode does not rely on a selector allowlist.** Colour inherits but background does not, so any Canvas surface a selector list misses keeps its light background, inherits the light text, and renders blank. No list can be complete against an app that renames its containers between releases, and CSS cannot ask what an element's computed background is. So a bounded pass measures it: block containers only, capped, throttled off real DOM change (never a poll), and scoped to skip our own UI, instructor-authored content, background images, already-dark surfaces, dashboard cards, and any *saturated* fill — a pale course colour is meaning, not chrome.
- **The dashboard card container is derived at runtime**, not matched by class name, and marked `data-bc-cardgrid`. Canvas has changed this markup more than once; `.ic-DashboardCard__box` is the per-card wrapper, and styling it as the container is what made every card a one-column grid and stacked them.
- **Command palette + shortcuts** are wired centrally in `content.js` from `settings.shortcuts.bindings`, so users can rebind everything from Settings → Shortcuts.

### Adding a feature

1. Create `src/content/features/yourfeature.js` ending with `BC.registry.register({ id, styles: [...], nodes: [...], apply(settings, ctx) })` — declare every keyed style and node it injects so teardown can clean up.
2. Add any new settings to `src/shared/defaults.js`.
3. Register the script in **both manifests**, before `observer.js`. The service worker derives its injection lists from `manifest.json` at runtime, so there is no second list to update.
4. If it only applies to certain pages, declare `pages: [...]` so it is skipped elsewhere.
5. Add controls to `src/shared/settings/index.js`. Every row takes an `icon:`
   from `BC.icons`, and a hint only where the label genuinely cannot say it —
   `test/panel.test.js` enforces both, plus a word budget for the whole panel.
6. Run `npm test` (or `node test/run.js`) and rebuild with `./build.sh`.

---

## Development

- After editing source, run `./build.sh` (or `build.ps1` on Windows) and reload the unpacked extension, then refresh Canvas.
- Both build scripts run `node --check` on every `.js` file and the test suite before copying. A build is only a copy, so the only thing that can go wrong is copying something broken.

### Tests

```sh
node test/run.js            # everything
node test/run.js tokens     # one suite, by filename fragment
```

No dependencies and no install step: `test/harness.js` loads the real source files
into a sandbox with small DOM and `chrome.*` shims, including a selector engine
good enough to exercise the injector and observer against an actual tree.

| Suite | Covers |
| --- | --- |
| `tokens`, `color` | WCAG contrast of every shipped theme, on every surface, in both modes |
| `designsystem` | no literal colours outside the palette sources, token existence, z-index order |
| `settings`, `state` | schema, migrations, undo/redo, import/export, state identity |
| `storage` | migration carry-over, subscriber delivery, every prune bound |
| `api`, `cache` | pagination, retry policy, CSRF, TTL and request de-duplication |
| `lifecycle`, `injector`, `observer` | registry, bags, sheet/node lifecycle, ownership rules |
| `detect`, `pagescope`, `applyall` | route mapping and the page-scoping dispatch rule |
| `grades` | weighted and points totals, GPA bands, donut geometry |
| `shortcuts` | combos, chords, typing guards, rebinding |
| `security` | escaping, URL scheme gating, no eval, no external endpoints |
| `a11y` | focus management, roles and labels, reduced motion, contrast pairings |
| `icons` | icon geometry: painted bounds, optical centring, size, one grid, no typed glyphs |
| `skins` | pattern determinism and escaping, nothing fetched, untrusted-skin validation, every built-in's contrast, the apply wiring |
| `progress` | every progress style's maths at 0%, 100% and an empty window; the ring migration |
| `pomodoro` | pause/resume arithmetic: no drift across cycles, no countdown while frozen |
| `widgetcss` | planner markup and stylesheet agree; no dead rules; spacing and type come off the scale |
| `darksweep` | every exclusion the light-surface sweep makes, and its bounds |
| `dashboardlayout` | card container derivation across both Canvas DOM shapes |
| `robustness` | async failure paths, unhandled rejections, error containment |

Feature behaviour against a live Canvas instance is still verified in-browser;
the suite covers the logic, the design system and the integration rules.
