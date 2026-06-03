# Better Canvas

A privacy-first browser extension that customizes the [Instructure Canvas](https://www.instructure.com/canvas) LMS. Dark mode, a redesigned dashboard, a planner-style To Do widget, navigation editing, custom themes, and a built-in GPA calculator — all configured from an in-page settings drawer that never leaves Canvas.

- **No telemetry, no analytics, no external servers.** Everything runs locally in your browser.
- **Cross-browser.** Works on Chrome (Manifest V3) and Firefox / Zen.
- **Same-origin only.** Grade and planner features use your existing Canvas login session; nothing is ever sent off-domain.

---

## Features

Open settings from the **Better Canvas** item in Canvas's left navigation, or from the toolbar popup → **Open settings**. The drawer slides in from the right and is style-isolated (Shadow DOM) so it never clashes with Canvas.

### Dashboard
- Drag to reorder course cards; rename, recolor, hide, or set a background image per card (also editable via the hover **Edit** pill on each card).
- Auto-hide concluded courses.
- Toggle the **To Do**, **Coming Up**, and **Recent Feedback** sidebar widgets, or hide the entire right sidebar.

### To Do list (its own section)
Three styles, chosen under Dashboard → **To Do list**:
- **Canvas default** — leaves the native list alone.
- **Clean circles** — a CSS-only restyle of the native list into rounded cards with circular markers.
- **Planner widget** — replaces the native To Do with Better Canvas's own widget:
  - A **completion ring** showing how much of the window is done.
  - **Week navigation** (‹ / ›) to move through time.
  - A **course filter** dropdown.
  - **Checkable tasks** grouped by Overdue / day — clicking the circle marks the item complete in Canvas.
  - A **New Task** composer that creates a personal planner note.
  - Customizable look-ahead window (1 week / 2 weeks / 1 month), show-completed toggle, accent color, and an option to hide the New Task button.

### Theming
- **Dark mode**: Off / On / Auto (follow system) / Scheduled (time window).
- **Dark theme tone**: Neutral gray, Slate (cool), or Midnight black — plus a **custom dark background** color that derives all surrounding shades.
- **Accent color** (re-tints Canvas's brand variables), **font** (presets or a custom family), **density** (compact / default / spacious), and **institution logo** (show / hide / replace with an image).

### Navigation
- Reorder or hide any item in the global (left) navigation; add custom links.
- Hide / reorder course navigation tabs by label; add custom course links.

### Cosmetics
- **Full-page background**: solid color or image, with blur and opacity.
- **Custom CSS**: a free-form escape hatch injected on every Canvas page.

### Grades
- **What-if grades** toggle on the grades page.
- A **GPA calculator** that pulls your courses and scores from your Canvas session; enter credit hours per course (set 0 to exclude).

### Settings management
- **Export** all settings to a JSON file, **Import** to restore them, and **Reset** to defaults.
- Settings persist locally and sync live across open Canvas tabs.

---

## Install (from source)

1. Build the unpacked extensions:
   ```powershell
   powershell -ExecutionPolicy Bypass -File build.ps1
   ```
   This populates `dist/chrome` and `dist/firefox`.

2. Load it:
   - **Chrome**: go to `chrome://extensions`, enable Developer mode, **Load unpacked** → select `dist/chrome`.
   - **Firefox / Zen**: go to `about:debugging#/runtime/this-firefox`, **Load Temporary Add-on** → select `dist/firefox/manifest.json`.

3. Open any Canvas site (`*.instructure.com`). Better Canvas runs automatically.

### Custom school domains
If your school uses a domain other than `*.instructure.com` (e.g. `canvas.yourschool.edu`), open the toolbar popup on that site and grant permission. The background service worker then registers the content scripts on that origin so Better Canvas runs there too.

---

## Privacy

Better Canvas makes **no external network requests**. The only network calls are to your own Canvas instance, using your existing session cookies:
- **Reads** (GET): dashboard cards, courses/scores, planner items.
- **Writes** (only in the To Do planner widget, and only to *your own* planner): mark a task complete, add a personal task. These use Canvas's CSRF token, exactly like the Canvas UI does.

Settings are stored in the browser's local extension storage. Telemetry is hard-wired off.

---

## Architecture

Vanilla JavaScript, no framework, no bundler. Every script attaches to a shared `globalThis.BC` namespace and is loaded as a classic script in dependency order.

```
manifest.json            Chrome (MV3) manifest
manifest.firefox.json    Firefox manifest (options page opens embedded)
build.ps1                Copies src/ + the right manifest into dist/chrome and dist/firefox
src/
  shared/
    defaults.js          Settings schema + deep-merge (single source of truth)
    settings-ui.js       BC.SettingsUI.render(root, adapter) — the entire settings UI, used by
                         both the in-page drawer and the standalone options page
  background/
    service-worker.js    Registers content scripts on user-granted custom domains
  content/
    core/
      util.js            el(), debounce, guard, hex/url helpers
      storage.js         BC.storage — load/save/subscribe over chrome.storage.local
      detect.js          Canvas detection + page context
      injector.js        Keyed <style> tags (setStyle/removeStyle) + singleton nodes
      api.js             Canvas REST helper (GET + user-planner writes with CSRF)
      observer.js        MutationObserver that re-applies features across SPA re-renders
    features/
      theming.js         Dark mode (variable-based palettes), accent, font, density, logo
      cosmetics.js       Full-page background + custom CSS
      navigation.js      Global/course nav hide, reorder, custom links
      dashboard.js       Card reorder/visuals/Edit pill, widget toggles, auto-hide concluded
      todo.js            To Do modes: clean restyle + custom planner widget
      grades.js          What-if grades + GPA tooling
      settings-panel.js  Left-nav trigger + Shadow-DOM settings drawer
    content.js           Entry point: applies all features, wires messages, runs the observer
  popup/                 Toolbar popup: quick toggles + custom-domain enable + Open settings
  options/               Standalone options page (mounts the shared settings UI)
```

### How it fits together
- **`content.js`** loads settings, then on every observer tick calls each feature's idempotent `apply(settings, ctx)`. Features only swap keyed `<style>` text or toggle classes/nodes, so re-applying is cheap and survives Canvas's React re-renders.
- **Settings UI is shared.** `BC.SettingsUI.render(rootEl, adapter)` builds the whole interface against a small adapter (`getState`/`save`/`subscribe`/`getCourses`/`getGpaData`). The in-page drawer backs the adapter with live `BC.storage` + same-origin `BC.api`; the options page backs it with `chrome.storage` + messaging the active Canvas tab. One UI, two surfaces.
- **Dark mode** is driven by CSS variables (`--bc-d-*`). `theming.js` emits one small variable block per tone/custom-background, and a static rule set consumes it — so re-tinting the whole dark theme is a one-block swap.

### Adding a feature
1. Create `src/content/features/yourfeature.js` exposing `BC.features.yourfeature = { id, apply(settings, ctx) }`.
2. Add any new settings to `src/shared/defaults.js`.
3. Register the script in `manifest.json`, `manifest.firefox.json`, and the `CONTENT_JS` list in `src/background/service-worker.js`.
4. Add the feature id to `FEATURE_ORDER` and any keyed style/node names to the teardown lists in `src/content/content.js`.
5. Add controls to `src/shared/settings-ui.js` if it's user-configurable.
6. Rebuild with `build.ps1`.

---

## Development notes

- After editing source, run `build.ps1` and reload the unpacked extension (Chrome: reload button; Firefox: re-load the temporary add-on), then refresh Canvas.
- Syntax-check a file with `node --check path/to/file.js`.
- There is no test suite; UI/feature correctness is verified in-browser against a live Canvas instance.
