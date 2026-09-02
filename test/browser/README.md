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
python3 -m http.server 8731          # from the repo root
# open http://localhost:8731/test/browser/page.html
```

The page loads the extension's real source in manifest order with small
stand-ins for the pieces that need a live Canvas (storage, the API, the
registry). `BC.injector.setStyle` is the real behaviour: one keyed `<style>` tag
appended last.

## Drive it from the console

```js
__bcApply({ theming: { darkMode: "on" } })   // apply real settings
__bcApply({ theming: { darkMode: "on", darkTone: "nord" } })
__bcClear()                                   // remove every sheet and mark

__bcAudit()                                   // every element carrying text,
                                              // with its rendered colours and
                                              // contrast against what is
                                              // actually behind it
__bcAudit().filter(a => a.ratio < 4.5)        // anything failing AA
```

`__bcAudit` resolves the background the way the browser paints it: the nearest
ancestor with an opaque background, not the element's own declaration.

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
