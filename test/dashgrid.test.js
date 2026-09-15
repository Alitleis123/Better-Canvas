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
  sb.BC.api = {
    dashboardCards: () => new Promise((res, rej) => { resolveCards = res; rejectCards = rej; }),
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
    e.apply(e.settings({}));
    const navs = e.grid().querySelectorAll(".bc-dc-links");
    assert.equal(navs.length, 2, "both cards have a footer");
    assert.ok(navs[1].classList.contains("is-empty"), "the one with no links is marked, not omitted");
    assert.match(e.sheet(), /\.bc-dc-links\.is-empty \{ min-height/,
      "and the empty one has to hold the same height");
  },

  async "a course with no colour still gets its own identity"() {
    // A colourless course rendered as a black slab on the real dashboard, and a
    // screen of them was indistinguishable. Art is derived from the id, so it is
    // stable across reloads and machines.
    const e = env();
    e.apply(e.settings({}));
    e.deliver(CARDS);
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

  "the art is derived only from the course id, so it never moves"() {
    assert.match(SRC, /hash\(String\(card\.id \|\| card\.assetString \|\| card\.shortName \|\| ""\)\)/,
      "anything viewport- or order-dependent would repaint the card on resize");
  },

  async "a hidden course is not rendered"() {
    const e = env();
    e.apply(e.settings({}));
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({ courses: { "1": { hidden: true } } }));
    assert.equal(e.grid().querySelectorAll(".bc-dc").length, 1);
  },

  async "a nickname overrides the name Canvas sent"() {
    const e = env();
    e.apply(e.settings({}));
    e.deliver(CARDS);
    await Promise.resolve(); await Promise.resolve();
    e.apply(e.settings({ courses: { "1": { nickname: "Poetry" } } }));
    const t = e.grid().querySelector(".bc-dc-a");
    assert.equal(t.textContent, "Poetry");
  },

  "the quick links sit above the stretched link, or they would all open the course"() {
    assert.match(SRC, /\.bc-dc-a::after \{ content: ""; position: absolute; inset: 0; z-index: 1; \}/);
    assert.match(SRC, /\.bc-dc-ln \{\s*position: relative; z-index: 2;/);
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
