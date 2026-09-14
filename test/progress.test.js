"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, load, ROOT } = require("./harness");

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const src = read("src/content/features/todo.js");

// todo.js registers against a live page, so the geometry is verified by pulling
// progressHtml out of the module rather than by booting the whole feature. The
// contract this protects is small and numeric: what gets drawn for a given
// done/total, at the extremes where the old ring broke.
function makeProgress() {
  const BC = loadCore(createSandbox());
  const body = src.slice(src.indexOf("  const PROGRESS_STYLES"), src.indexOf("  async function fetchWindow"));
  const fn = new Function("BC", "esc", body + "; return { progressHtml, PROGRESS_STYLES, MAX_SEGMENTS };");
  return fn(BC, (v) => BC.util.escapeHtml(v));
}
const P = makeProgress();

const pctOf = (html) => Number((html.match(/aria-valuenow="(\d+)"/) || [])[1]);
const segs = (html) => (html.match(/class="bc-prog-seg(?: on)?"/g) || []).length;
const filled = (html) => (html.match(/class="bc-prog-seg on"/g) || []).length;

module.exports = {
  "every style is renderable and off renders nothing"() {
    for (const style of P.PROGRESS_STYLES) {
      const html = P.progressHtml(style, 3, 10);
      if (style === "off") { assert.equal(html, "", "off must draw nothing at all"); continue; }
      assert.ok(html.length > 0, `${style} rendered empty`);
      assert.match(html, /role="progressbar"/, `${style} is not announced as progress`);
      assert.equal(pctOf(html), 30, `${style} reports the wrong value`);
    }
  },

  "an unknown style draws nothing rather than throwing"() {
    // The value comes out of stored settings, which an imported JSON file can
    // populate with anything.
    assert.equal(P.progressHtml("spiral", 1, 2), "");
    assert.equal(P.progressHtml(undefined, 1, 2), "");
  },

  "an empty window is 0% and not a division by zero"() {
    for (const style of P.PROGRESS_STYLES) {
      if (style === "off") continue;
      const html = P.progressHtml(style, 0, 0);
      assert.equal(pctOf(html), 0, `${style} on an empty window`);
      assert.noMatch(html, /NaN|Infinity/, `${style} leaked a non-number`);
    }
  },

  "the ring reports what is left, which is always one or two characters"() {
    // The defect this replaced: "100%" set at 12px inside a 36px hole, with a
    // <text> element that ignored the font scale entirely.
    const mid = P.progressHtml("ring", 3, 12);
    assert.match(mid, /class="bc-prog-ring-val">9</, "the figure must be the remainder");
    assert.noMatch(mid, /<text/, "the figure must be HTML so it honours the font scale");

    for (const [done, total] of [[0, 1], [7, 12], [0, 99], [98, 99]]) {
      const html = P.progressHtml("ring", done, total);
      const fig = (html.match(/class="bc-prog-ring-val">([^<]*)</) || [])[1];
      assert.ok(fig && fig.length <= 2,
        `${done}/${total} put ${JSON.stringify(fig)} inside a 38px circle`);
    }
  },

  "a finished week shows a mark instead of a zero"() {
    const done = P.progressHtml("ring", 8, 8);
    assert.match(done, /bc-prog-done/, "finishing should look like finishing");
    assert.match(done, /<svg/, "the mark is drawn, not typed");
    // An empty window is not an achievement, so it keeps the count.
    assert.noMatch(P.progressHtml("ring", 0, 0), /bc-prog-done/);
  },

  "the ring arc is fully drawn at 100% and absent at 0%"() {
    const C = 2 * Math.PI * 19;
    const at = (d, t) => Number((P.progressHtml("ring", d, t).match(/stroke-dashoffset="([\d.]+)"/) || [])[1]);
    assert.close(at(0, 10), C, 0.05, "an empty ring must be fully offset");
    assert.close(at(10, 10), 0, 0.05, "a full ring must have no offset left");
    assert.close(at(5, 10), C / 2, 0.05);
  },

  "segments are capped so they never become slivers"() {
    assert.equal(segs(P.progressHtml("segments", 2, 6)), 6, "one tick per task while it fits");
    assert.equal(filled(P.progressHtml("segments", 2, 6)), 2);
    const many = P.progressHtml("segments", 40, 80);
    assert.equal(segs(many), P.MAX_SEGMENTS, "past the cap each tick stands for several");
    assert.equal(filled(many), P.MAX_SEGMENTS / 2, "and the proportion still reads true");
    // Never zero segments, even with nothing in the window.
    assert.ok(segs(P.progressHtml("segments", 0, 0)) >= 1);
  },

  "the rainbow spans the track, not the fill"() {
    // Sizing the gradient to the fill makes 10% and 90% look identical. Sized to
    // the track, the colour at the tip is the reading.
    const low = P.progressHtml("rainbow", 1, 10);
    const high = P.progressHtml("rainbow", 9, 10);
    const size = (h) => Number((h.match(/background-size: ([\d.]+)%/) || [])[1]);
    assert.close(size(low), 1000, 0.5, "at 10% the spectrum is ten track-widths wide");
    assert.close(size(high), 111.1, 0.5);
    assert.ok(size(low) > size(high), "the gradient must compress as progress grows");
    assert.match(low, /bc-prog-fill--rainbow/, "the rainbow fill needs its own class");
    assert.match(src, /\.bc-prog-fill--rainbow \{[^}]*var\(--bc-spectrum\)/,
      "the spectrum must come from the token layer, not a literal gradient");
  },

  "a full bar is exactly 100% wide"() {
    assert.match(P.progressHtml("bar", 4, 4), /width: 100%/);
    assert.match(P.progressHtml("bar", 0, 4), /width: 0%/);
  },

  "the graphic is hidden from screen readers and the reading is on the meter"() {
    for (const style of ["ring", "bar", "segments", "rainbow"]) {
      const html = P.progressHtml(style, 3, 10);
      assert.match(html, /aria-label="3 of 10 done, 30%, 7 left"/,
        `${style} must announce the numbers, not the geometry`);
      assert.match(html, /aria-hidden="true"/, `${style} must hide its own artwork`);
    }
    assert.match(P.progressHtml("ring", 10, 10), /aria-label="10 of 10 done, 100%"/,
      "with nothing left, the label should not say '0 left'");
  },

  "the spectrum is defined once, in the token layer"() {
    const BC = loadCore(createSandbox());
    assert.match(BC.tokens.staticCss(), /--bc-spectrum:\s*linear-gradient/,
      "a feature must not carry its own rainbow");
    // hsl, not hex, and stated in one place: the designsystem suite bans literal
    // colours in feature stylesheets and this is the sanctioned exception.
    assert.noMatch(src, /linear-gradient\([^)]*#[0-9a-f]{6}/i,
      "todo.js must read the spectrum token rather than inline one");
  },

  "the old ring boolean migrates to a style"() {
    const BC = loadCore(createSandbox());
    const at = (v) => {
      const s = BC.mergeDefaults({ version: 5, todo: { ring: v } });
      BC.migrate(s, {});
      return s.todo;
    };
    assert.equal(at(true).progress, "ring", "someone who had the ring keeps it");
    assert.equal(at(false).progress, "off", "someone who turned it off must not get one back");
    assert.equal(at(true).ring, undefined, "the dead key must be removed");

    // A nonsense stored value falls back rather than rendering nothing forever.
    const junk = BC.mergeDefaults({ version: 5, todo: { progress: "spiral" } });
    BC.migrate(junk, {});
    assert.equal(junk.todo.progress, "ring");
  },

  "the settings UI offers every style the widget implements"() {
    const idx = read("src/shared/settings/index.js");
    const offered = [...idx.matchAll(/\{ value: "(\w+)",\s*label: "[^"]+" \},?\s*(?=\n\s*\{ value|\n\s*\],)/g)]
      .map((m) => m[1]);
    for (const style of P.PROGRESS_STYLES) {
      assert.ok(idx.includes(`{ value: "${style}"`),
        `${style} is implemented but cannot be chosen`);
    }
    assert.ok(offered.length >= 5, "the chooser lost its options");
    // And it is a chooser that draws itself, not a dropdown of adjectives.
    assert.match(idx, /control: S\.choice\(/);
    assert.match(idx, /preview: progressSwatch/);
  },

  "every swatch draws something"() {
    const idx = read("src/shared/settings/index.js");
    const body = idx.slice(idx.indexOf("  function progressSwatch(style) {"),
                           idx.indexOf("  function renderTodo(store) {"));
    const swatch = new Function(body + "; return progressSwatch;")();
    for (const style of P.PROGRESS_STYLES) {
      const html = swatch(style);
      assert.ok(html && html.length > 0, `the ${style} swatch is blank`);
      assert.noMatch(html, /NaN|undefined/, `the ${style} swatch leaked a non-value`);
    }
    assert.match(swatch("rainbow"), /class="bc-sw-bar rainbow"/);
    assert.match(idx, /\.bc-sw-bar\.rainbow \{[^}]*var\(--bc-spectrum\)/,
      "the swatch must advertise the same spectrum the widget paints");
  },
};
