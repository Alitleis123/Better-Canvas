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

__bcSheetHealth()                             // does every sheet we inject
                                              // actually parse to its END?
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

## The whole extension, booting itself

`page.html` loads a hand-picked subset of features and drives them directly.
That is right for looking at one surface, but it cannot answer *does changing
this setting do anything without a reload* -- which needs the real registry, the
real `applyAll`, and the real storage-subscribe path.

`live.html` loads every content script `manifest.json` declares, in the
manifest's order, and lets `content.js` boot as it does on Canvas. The list is
fetched rather than restated, so the harness cannot drift from what ships.

```
live.html?c=<uri-encoded expression>      run it after boot, print the result

await __bcLive({ theming: { radius: 20 } })   change a setting + re-apply
__bcSeen('[data-bc-node="bc-gpa-card"]')      how many are in the DOM
__bcNeedsReload(CASES)                        node-driven settings that are stuck
__bcStyleSweep(CASES)                         style-driven ones that are stuck
```

Both sweeps set a setting one way, the other way, and back, and report anything
that reads the same all three times. Two real defects came out of it: the
read-aloud buttons had no off branch, and `theming`'s global radius rule outranked
the dashboard's own card-radius control so that slider moved nothing. Three
apparent failures were wrong selectors on my part, which is the other thing this
is good for.

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
  `p=<progress style>`, `s=<skin id>`, `layout=<grid|list|compact|masonry>`,
  `n=<course count>`, `dark=1`.

  `n=` clones the fixture's cards. The fixture ships four, which is the one count
  that cannot show whether a row packs, wraps, or strands a card on a row of its
  own — four courses in a five-column measure left a 266px notch that only turned
  up at `n=4`, and seven were what showed the second row was right.

- **`shoot.sh`** — the capture command above, as a script, because every one of
  these findings needed the same shot at three widths.

  ```sh
  test/browser/shoot.sh /tmp/out.png 2560x1440 '_shot.html?m=plain&n=7'
  ```
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

It also measures the dashboard's card grid, whose track uses `min()`, `max()`
and a percentage inside `minmax()` under `auto-fit`. The column count depends on
the engine resolving all of that the same way, and if it does not, a Firefox
user gets a different number of cards in a row than the measurements were taken
against. Both the fill case and the reduce-and-still-fill case are pinned, plus
`column-span: all`, which is what lifts the section heading out of masonry's
first column.

Result as of Zen 1.21 (Gecko): everything passes and the row measures
identically to Blink. The card grid agrees exactly — 4 columns at 263px with 0
left over at 1100px, reducing to 3 with 0 left over at 1000px, in both engines.

A caution learned here: the first version of that probe asserted 4 columns at a
1000px container, where the four-column term resolves under the 250px floor and
three is the correct answer. It reported a failure in BOTH engines and looked
like a Gecko bug for as long as it took to do the arithmetic. Check the
expectation before believing the engine disagrees. The one difference is `text-wrap: pretty`, which Gecko
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
- `Object.values(__bcSheetHealth()).every(s => s.ok)` — a parse error anywhere in
  a sheet silently disables every rule after it, and nothing reports it. This is
  how a selector-splitting bug came to disable 11,820 of 21,743 characters of
  dark-mode CSS with the whole node suite green: the dashboard header kept a
  white background and took light text at 1.22:1.
- the course image is still an image: `getComputedStyle(document.querySelector('.ic-DashboardCard__header_image')).backgroundImage`
- the course colour is unchanged: `.ic-DashboardCard__header_hero`
- an authored box keeps its own background and gains legible ink: `.user_content .callout`
- cards lay out in columns: distinct `getBoundingClientRect().y` values across `.ic-DashboardCard`
- the dashboard is the same at every width worth caring about: `_measure.html`
  reports the card size, the occupied columns, the trailing gap and whether the
  header, the grid and the page content share a right edge. Trailing should be 0
  and the three right edges equal, at every width
- `__bcApply({theming:{darkMode:"off"}})` leaves zero `[data-bc-lit]`,
  `[data-bc-paper]` and `[data-bc-dim]` marks

## Full sweep

Paste this to run every tone against every layout in one go:

Skins need the same sweep, and it is a different one: a skin replaces the whole
token layer, so it can fail where a dark tone passes. This is what found 9 of
the 44 drawing the course code below AA.

```js
await __bcReady;
const bad = [];
for (const k of BC.SKIN_CATALOG) {
  __bcClear();
  __bcApply({ theming: { skin: k.id } });
  const f = __bcAudit().filter((a) => a.ratio < 4.5);
  if (f.length) bad.push(k.id + ": " + f.map((b) => b.sel + " " + b.ratio).join(" | "));
}
bad;   // [] means clean
```

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
