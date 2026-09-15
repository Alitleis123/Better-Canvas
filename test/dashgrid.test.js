"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, load, ROOT } = require("./harness");

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const SRC = read("src/content/features/dashgrid.js");

// A dashboard page with Canvas's container present but no cards of our own yet.
function env(cardsPayload) {
  const sb = createSandbox({ pathname: "/" });
  loadCore(sb);
  sb.window.addEventListener = () => {};
  load(sb, "src/content/core/lifecycle.js");
  load(sb, "src/content/core/injector.js");
  load(sb, "src/content/core/detect.js");
  load(sb, "src/content/core/cache.js");
  load(sb, "src/content/core/color.js");
  load(sb, "src/shared/skins.js");
  load(sb, "src/shared/icons.js");
  sb.BC.ui = { el: (t, a, k) => {
    const n = sb.document.createElement(t);
    for (const key in a || {}) {
      if (key === "class") n.className = a[key];
      else if (key === "text") n.textContent = a[key];
      else n.setAttribute(key, a[key]);
    }
    for (const c of k || []) n.appendChild(c);
    return n;
  } };
  sb.BC.isDarkActive = () => false;
  sb.BC.storage = { current: null, local: {} };
  let resolveCards, rejectCards;
  let colours = { custom_colors: {} };
  sb.BC.api = {
    dashboardCards: () => new Promise((res, rej) => { resolveCards = res; rejectCards = rej; }),
    // Canvas's own colour picker reads and writes this; the card payload's own
    // colour field has moved between versions, so this is the reliable source.
    customColors: () => Promise.resolve(colours),
  };
  sb.BC.requestApply = () => {};
  load(sb, "src/content/features/dashgrid.js");

  const container = sb.document.createElement("div");
  container.setAttribute("id", "DashboardCard_Container");
  sb.document.body.appendChild(container);

  return {
    sb, container,
    doc: sb.document,
    settings(over) {
      const s = sb.BC.cloneDefaults();
      Object.assign(s.dashboard, over || {});
      return s;
    },
    apply(s) {
      sb.BC.features.dashgrid.apply(s, { page: "dashboard", courseId: null, path: "/" });
    },
    deliver(list) { resolveCards(list == null ? cardsPayload : list); },
    setColours(map) { colours = { custom_colors: map }; },
    fail(e) { rejectCards(e || new Error("nope")); },
    grid() { return sb.document.querySelector('[data-bc-node="bc-dashgrid"]'); },
    sheet() {
      const t = sb.document.querySelector('style[data-better-canvas="bc-dashgrid"]');
      return t ? t.textContent : "";
    },
  };
}

const CARDS = [
  { id: "1", shortName: "A long course name that wraps", courseCode: "AAA1000",
    color: "#b58a3c", term: { name: "Fall 2026" },
    links: [{ cssClass: "announcements", path: "/a", label: "Announcements" }] },
  { id: "2", shortName: "Short", courseCode: "BBB2000", term: { name: "Fall 2026" }, links: [] },
];

module.exports = {
  // ---- the thing the whole rewrite exists for ---------------------------

  "the container is capped at exactly maxColumns cards wide"() {
    // This cap is what makes a 15", a 24" and a 27" render the same dashboard.
    // Above it the column count cannot grow, so every wider monitor gets the
    // same layout; the tracks are 1fr so below it the cards flex rather than
    // leaving a ragged gutter.
    const e = env();
    const css = (() => { e.apply(e.settings({ maxColumns: 5, cardSize: "m" })); e.deliver(CARDS); return null; })();
    // The sheet is only written once the cards arrive, so assert on the source's
    // own arithmetic rather than waiting on a promise.
    assert.match(SRC, /cap: cols > 0 \? cols \* w \+ \(cols - 1\) \* GAP : 0/,
      "the cap has to be maxColumns cards plus the gaps between them");
    // And it lives in ONE place, because the page chrome around the grid has to
    // end exactly where the cards end.
    assert.match(SRC, /function metrics\(d\)/);
    assert.match(SRC, /BC\.dashgrid = \{[\s\S]{0,200}metrics,/,
      "the page chrome reads the cap from here rather than recomputing it");
    assert.ok(css === null);
  },

  "the medium card is the width that lets the smallest target reach the cap"() {
    // 250, not 260. At 260 a five-column cap is 1364px and a 15" MacBook -- which
    // leaves about 1357px of content column -- falls to four columns while a 24"
    // gets five, which is exactly the inconsistency this is meant to remove.
    assert.match(SRC, /const CARD_W = \{ s: 210, m: 250, l: 300 \};/,
      "the medium width sets the cap; changing it changes which monitors agree");
  },

  "tracks flex, so no row ends in a ragged gutter"() {
    assert.match(SRC, /repeat\(auto-fill, minmax\(min\(100%, \$\{w\}px\), 1fr\)\)/,
      "a constant track cannot absorb leftover space and leaves up to a whole column of it");
  },

  // ---- rendering ---------------------------------------------------------

  async "our grid replaces Canvas's once the cards arrive"() {
    const e = env();
    e.apply(e.settings({}));
    assert.equal(e.grid(), null, "nothing is drawn before the data lands");
    assert.equal(e.container.hasAttribute("data-bc-dashgrid-off"), false,
      "and Canvas's own cards stay visible in the meantime");
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({}));
    const g = e.grid();
    assert.ok(g, "our grid mounts");
    assert.equal(g.querySelectorAll(".bc-dc").length, 2);
    assert.ok(e.container.hasAttribute("data-bc-dashgrid-off"), "Canvas's grid is hidden");
  },

  async "a failed fetch leaves Canvas's dashboard exactly as it was"() {
    // The whole point of hiding rather than removing: if we cannot render, the
    // user still has a dashboard.
    const e = env();
    e.apply(e.settings({}));
    e.fail();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({}));
    assert.equal(e.grid(), null, "no empty grid is left behind");
    assert.equal(e.container.hasAttribute("data-bc-dashgrid-off"), false,
      "Canvas's cards must be visible again");
  },

  async "every card gets a footer, even one with no quick links"() {
    // The term is pinned to the bottom of the body so it lines up across a row.
    // A card missing its footer has a taller body and drops its term below
    // everyone else's, which made one card in nine visibly ragged.
    const e = env();
    e.apply(e.settings({}));
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({}));
    const navs = e.grid().querySelectorAll(".bc-dc-links");
    assert.equal(navs.length, 2, "both cards have a footer");
    assert.ok(navs[1].classList.contains("is-empty"), "the one with no links is marked, not omitted");
    // The empty footer has to reserve the height a POPULATED one resolves to,
    // and asserting that the rule merely EXISTS is what let this ship broken:
    // the rule was there, reserving 28px against a real footer's 41, and the
    // card it was meant to align dropped its term 13px below the row for as
    // long as the test was green. So compare the numbers. Both come from the
    // icon box, which is the only reason they can be expected to match.
    const css = e.sheet();
    const icon = /\.bc-dc-ln \{[^}]*?height: (\d+)px/s.exec(css);
    const spacer = /\.bc-dc-links\.is-empty::before \{[^}]*?height: (\d+)px/s.exec(css);
    assert.ok(icon, "the quick-link icon declares a height");
    assert.ok(spacer, "the empty footer reserves a box");
    assert.equal(spacer[1], icon[1],
      `empty footer reserves ${spacer && spacer[1]}px against an icon of ${icon && icon[1]}px`);
  },

  async "a course with no colour still gets its own identity"() {
    // A colourless course rendered as a black slab on the real dashboard, and a
    // screen of them was indistinguishable. Art is derived from the id, so it is
    // stable across reloads and machines.
    const e = env();
    e.apply(e.settings({}));
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({}));
    const cards = e.grid().querySelectorAll(".bc-dc");
    const plain = cards[1];                       // CARDS[1] has no colour
    const colour = plain.style.getPropertyValue("--dc-c");
    assert.ok(/^#[0-9a-f]{6}$/i.test(colour), "it is given a colour: " + colour);
    const art = plain.querySelector(".bc-dc-art").getAttribute("style") || "";
    assert.ok(/background-image/.test(art), "and a pattern rather than a flat fill");
  },

  "a course with no planner data still reserves the progress slot"() {
    // The term is pinned to the bottom of the body, so a card missing an
    // optional element below it drops its term a row below every neighbour's.
    // Hidden rather than drawn at 0%, which would read as "none of it is done"
    // about a course that simply has nothing due.
    assert.match(SRC, /class: "bc-dc-bar is-empty"/,
      "the slot has to be reserved, not omitted");
    assert.match(SRC, /\.bc-dc-bar\.is-empty \{ visibility: hidden; \}/,
      "and reserved without drawing a misleading empty track");
  },

  "the grade trend is drawn, not just offered in the settings panel"() {
    // The Canvas-card path drew this from BC.storage.local.gradeHistory. Our
    // renderer did not, so "Grade trend sparkline" sat in the panel doing
    // nothing at all from the moment we took over the cards -- found by sweeping
    // every dashboard setting for one that changes no pixels.
    assert.match(SRC, /if \(opts\.showSparkline\)/, "the setting has to be read");
    assert.match(SRC, /BC\.storage\.local && BC\.storage\.local\.gradeHistory/,
      "and read from the same history the old path used");
    assert.match(SRC, /hist\.length >= 2/, "one point is not a trend");
    assert.match(SRC, /class: "bc-dc-spark"/);
  },

  "anything riding on the artwork is protected at both ends"() {
    // The chip and the due badge ride the top and the sparkline rides the
    // bottom. A top-only scrim left the trend line unreadable on pale artwork.
    const i = SRC.indexOf(".bc-dc-scrim {");
    const block = SRC.slice(i, SRC.indexOf("}", i));
    assert.match(block, /rgba\(0,0,0,\.34\) 0%/, "top");
    assert.match(block, /rgba\(0,0,0,\.34\) 100%/, "and bottom");
  },

  async "the colour the user actually chose wins over everything we could guess"() {
    // On a real dashboard every course came out painted with our FALLBACK -- a
    // purple course rendered brown -- because the only field read was
    // card.backgroundColor, and that has moved between Canvas versions. The
    // picker's own endpoint is the one place the choice is definitely recorded.
    const e = env();
    e.setColours({ "course_1": "#7b2fb5" });
    e.apply(e.settings({}));
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({}));
    const card = e.grid().querySelector('.bc-dc[data-bc-course="1"]');
    assert.equal(card.style.getPropertyValue("--dc-c"), "#7b2fb5",
      "the picker's colour must beat the card payload's own");
  },

  "a missing colours response still renders a dashboard"() {
    // Fallback colours beat no dashboard, so the colour fetch is caught
    // separately rather than failing the pair.
    assert.match(SRC, /BC\.api\.customColors\(\)\.catch\(/,
      "a failed colour fetch must not take the cards down with it");
    assert.match(SRC, /Promise\.all\(\[/, "and it is fetched alongside them, not after");
  },

  async "a course with no artwork gets a gradient and a monogram, not wallpaper"() {
    // The skin engine's pattern generator is right for wallpapering a page at
    // low contrast. On a 250x140 card face it became the subject: eight cards of
    // gingham and polka dots beside four carrying real course artwork made the
    // artwork look like the exception and the rest like placeholder swatches.
    const e = env();
    e.apply(e.settings({}));
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({}));
    const plain = e.grid().querySelector('.bc-dc[data-bc-course="2"]');
    const art = plain.querySelector(".bc-dc-art").getAttribute("style") || "";
    assert.match(art, /linear-gradient/, "a soft ramp in the course's own colour");
    assert.ok(!/repeating|url\(/.test(art), "and no repeating pattern");
    const mono = plain.querySelector(".bc-dc-mono");
    assert.ok(mono, "and a monogram to be recognised by");
    assert.equal(mono.textContent, "BBB", "taken from the letters the course code opens with");
  },

  async "a course WITH artwork gets no monogram over it"() {
    const e = env();
    e.apply(e.settings({}));
    e.deliver([Object.assign({}, CARDS[0], { image: "https://x.test/a.png" })]);
    await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({}));
    const card = e.grid().querySelector(".bc-dc");
    assert.equal(card.querySelector(".bc-dc-mono"), null,
      "over a real photograph a monogram is graffiti");
  },

  "the monogram ink is chosen against the course colour"() {
    // One fixed white vanishes on a pale course; one fixed black is a smudge on
    // a dark one.
    assert.match(SRC, /--dc-mono/);
    assert.match(SRC, /relLuminance\(colour\) < 0\.5 \? "rgba\(255,255,255,\.20\)" : "rgba\(0,0,0,\.16\)"/);
  },

  "the art is derived only from the course id, so it never moves"() {
    assert.match(SRC, /hash\(String\(card\.id \|\| card\.assetString \|\| card\.shortName \|\| ""\)\)/,
      "anything viewport- or order-dependent would repaint the card on resize");
  },

  async "a hidden course is not rendered"() {
    const e = env();
    e.apply(e.settings({}));
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({ courses: { "1": { hidden: true } } }));
    assert.equal(e.grid().querySelectorAll(".bc-dc").length, 1);
  },

  async "a nickname overrides the name Canvas sent"() {
    const e = env();
    e.apply(e.settings({}));
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({ courses: { "1": { nickname: "Poetry" } } }));
    const t = e.grid().querySelector(".bc-dc-a");
    assert.equal(t.textContent, "Poetry");
  },

  "the quick links sit above the stretched link, or they would all open the course"() {
    assert.match(SRC, /\.bc-dc-a::after \{ content: ""; position: absolute; inset: 0; z-index: 1; \}/);
    assert.match(SRC, /\.bc-dc-ln \{\s*position: relative; z-index: 2;/);
  },

  async "each card can be recoloured, renamed and hidden from the card itself"() {
    // Replacing Canvas's cards took away its kebab -- colour, rename,
    // unfavourite -- and left the settings drawer as the only way to do any of
    // it, which is a long walk for something you are looking straight at. The
    // menu writes the SAME per-course overrides the drawer's course editor
    // writes, so the two are one setting seen twice.
    const e = env();
    e.apply(e.settings({}));
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({}));
    const card = e.grid().querySelector('.bc-dc[data-bc-course="1"]');
    assert.ok(card.querySelector(".bc-dc-kebab"), "every card carries the options button");
    assert.match(SRC, /function write\(id, patch\)/);
    assert.match(SRC, /d\.dashboard\.courses = d\.dashboard\.courses \|\| \{\}/,
      "it must write the same override shape the settings course editor writes");
    assert.match(SRC, /if \(patch\[k\] === null\) delete cur\[k\]/,
      "Reset has to delete the key, not write an empty one");
  },

  "opening the card menu does not open the course"() {
    // The whole card is one stretched link, so the kebab has to stop the click
    // or every attempt to recolour a course navigates away from the dashboard.
    assert.match(SRC, /e\.preventDefault\(\); e\.stopPropagation\(\);/);
    assert.match(SRC, /z-index: 4;/, "and it has to sit above the link's ::after");
  },

  "the rename field commits on blur or Enter, not per keystroke"() {
    // Every write re-renders the grid, which would take the field out from under
    // the caret mid-word.
    assert.match(SRC, /name\.addEventListener\("blur", commit\)/);
    assert.match(SRC, /if \(e\.key === "Enter"\)/);
    assert.ok(!/name\.addEventListener\("input"/.test(SRC));
  },

  "teardown removes our grid and unhides Canvas's"() {
    assert.match(SRC, /for \(const n of document\.querySelectorAll\("\[data-bc-dashgrid-off\]"\)\) n\.removeAttribute\("data-bc-dashgrid-off"\);/,
      "leaving the attribute on would hide the dashboard with nothing in its place");
  },

  "the load state is not tied to a lifecycle bag mark"() {
    // Depending on once() semantics for this meant a wrong bag implementation
    // showed up as a feature that never rendered at all rather than as anything
    // diagnosable. unmount() owns the reset instead.
    assert.ok(!/once\("dashgrid"/.test(SRC),
      "no once()-armed reset; unmount clears the state on page change");
  },
};
