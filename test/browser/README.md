# Visual harness

The node suite matches our CSS against a described DOM. This runs it in a real
browser instead, against a replica of Canvas's markup, so the actual cascade and
layout engine decide the answer.

It exists because three visual defects shipped while the node suite was green:
a real engine caught two more within minutes of being pointed at the same page
(course subtitles at 3.2:1, and an authored `<blockquote>` the sweep never
visited because the tag was missing from its list).

## Run it

```sh
node test/browser/serve.js           # from the repo root
# open http://localhost:8731/test/browser/page.html
```

Use this server, not `python3 -m http.server`: it sends `no-store`, and the page
fetches each source file with a cache-busting query. A cached subresource means
an edited file is not what the browser runs, which made a fix look applied twice
before it actually was.

The page loads the extension's real source in manifest order with small
stand-ins for the pieces that need a live Canvas (storage, the API, the
registry). `BC.injector.setStyle` is the real behaviour: one keyed `<style>` tag
appended last. Everything is behind `await window.__bcReady`.

## Drive it from the console

```js
await __bcReady                               // sources are fetched, so wait
__bcApply({ theming: { darkMode: "on" } })   // apply real settings
__bcApply({ theming: { darkMode: "on", darkTone: "nord" } })
__bcClear()                                   // remove every sheet and mark

__bcTodo()                                    // render the planner widget on the
__bcTodo("segments")                          // fixture sidebar, in any of its
__bcTodo("rainbow")                           // six progress styles
__bcTodo("ring", { theming: { density: "compact" } })

__bcAudit()                                   // every element carrying text,
                                              // with its rendered colours and
                                              // contrast against what is
                                              // actually behind it
__bcAudit().filter(a => a.ratio < 4.5)        // anything failing AA
```

`__bcAudit` resolves the background the way the browser paints it: the nearest
ancestor with an opaque background, not the element's own declaration. It walks
the light DOM; for the settings panel, which lives in a shadow root, reach it
through `document.querySelector('[data-bc-node="bc-drawer"]').shadowRoot`.

```js
__bcPanel(600)                                // the drawer, pinned to a width
__bcTab("grades")                             // aim it at a tab
__bcRowWidths(160)                            // rows whose label got starved
```

## Photograph it

Three pages exist so a change can be *looked at* rather than described. Each one
takes its state in the query string, so a capture is one command and no manual
clicking.

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --virtual-time-budget=3000 --window-size=1440,1250 \
  --screenshot=/tmp/out.png --user-data-dir=/tmp/bcshot \
  'http://localhost:8731/test/browser/_shot.html?m=panel&t=grades'
```

- **`_shot.html`** — the surface, ready to photograph.
  `m=panel|todo|skin|plain`, plus `t=<tab id>`, `w=<drawer px>`,
  `p=<progress style>`, `s=<skin id>`, `dark=1`.
- **`_eval.html?c=<expr>`** — run one expression and print the result into the
  page, because headless Chrome gives you no console to read. `__bcPanel`,
  `__bcRowWidths`, `__bcAudit` and `BC` are all in scope.
- **`_popup.html`** — the toolbar popup, light and dark side by side. It splices
  a `chrome.*` stub in ahead of the popup's own scripts; stubbing after load
  races them and silently leaves `render()` un-run.
- **`_options.html`** — the standalone options page, which hosts the same shared
  settings UI but in its own document: no shadow root, a 1080px container, and
  the page itself as the scroller. Nothing was checking that layout.

## Check the other engine

The extension ships a Firefox manifest, and every render above is Blink. The
panel leans on container queries, `:has()`, `color-mix()`, `inert` and a
rounded system face, so `_support.html` reports each one and then MEASURES a
miniature of the real row: does the label keep its width, does the wide row
stack, does the slim row stay inline, does `inert` actually block focus.

It is synchronous on purpose. Gecko's `--screenshot` fires at load and will not
wait for the harness to fetch the sources, so the full panel cannot be
photographed there this way.

```sh
"/Applications/Zen.app/Contents/MacOS/zen" --headless --profile /tmp/p \
  --window-size=640,560 --screenshot /tmp/gecko.png \
  'http://localhost:8731/test/browser/_support.html'
```

Result as of Zen 1.21 (Gecko): everything passes and the row measures
identically to Blink. The one difference is `text-wrap: pretty`, which Gecko
does not support, so hints and section descriptions get ordinary ragging there.
It is a progressive enhancement with no polyfill, so it degrades silently and is
left alone.

One caveat, learned the hard way. Under `--virtual-time-budget`, a tight
synchronous loop of `.click()` calls leaves `getComputedStyle` reporting the
*first* tab as the selected one for `color` and `background`, while
`font-weight` and `::before` from the same rule follow the class correctly. It
is not containment, not `var()` substitution, and not a competing rule: a
single click, or the same loop paced with real `setTimeout`, renders correctly
in the pixels. Drop `--virtual-time-budget` and read the screenshot before
believing a computed-style mismatch you find this way.

Chrome does not always exit after writing the file — poll for the PNG and kill
the process rather than waiting on it.

Two defects in the panel rebuild were visible only here and passed the whole
node suite: a renderer that threw left the *previous* tab's body mounted while
the rail highlighted the new one, and a `<select>` sized to its widest option
starved its label to 26px with a seven-line hint at a 600px drawer.

## What it does and does not prove

It exercises the real cascade, real specificity, real inheritance, and real
layout, so `display: grid` genuinely produces columns and a `background`
shorthand genuinely erases an image.

It is still a *replica*. `canvas.css` is an approximation of Canvas's own
stylesheet, and the markup is hand-written. A defect that depends on markup
Canvas emits but this page does not model will not show up here. Verifying
against a live Canvas instance is still a manual step.

## Checks worth re-running after any dark-mode change

- `__bcAudit().filter(a => a.ratio < 4.5)` is empty, for every value of
  `darkTone` and a few accents
- the course image is still an image: `getComputedStyle(document.querySelector('.ic-DashboardCard__header_image')).backgroundImage`
- the course colour is unchanged: `.ic-DashboardCard__header_hero`
- an authored box keeps its own background and gains legible ink: `.user_content .callout`
- cards lay out in columns: distinct `getBoundingClientRect().y` values across `.ic-DashboardCard`
- `__bcApply({theming:{darkMode:"off"}})` leaves zero `[data-bc-lit]`,
  `[data-bc-paper]` and `[data-bc-dim]` marks

## Full sweep

Paste this to run every tone against every layout in one go:

```js
await __bcReady;
const fails = [];
for (const tone of Object.keys(BC.DARK_TONES))
  for (const layout of ["grid", "list", "masonry", "compact"]) {
    __bcClear();
    __bcApply({ theming: { darkMode: "on", darkTone: tone }, dashboard: { layout } });
    const bad = __bcAudit().filter(a => a.ratio < 4.5);
    if (bad.length) fails.push(`${tone}/${layout}: ` + bad.map(b => b.sel + " " + b.ratio).join(", "));
  }
fails;   // [] means clean
```
