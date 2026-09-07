"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, load, ROOT } = require("./harness");

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Build a dashboard resembling Canvas's: a container holding per-card wrappers.
function dashboard({ wrapped, heading }) {
  const sb = createSandbox({ pathname: "/" });
  loadCore(sb);
  sb.window.addEventListener = () => {};
  load(sb, "src/content/core/lifecycle.js");
  load(sb, "src/content/core/injector.js");
  load(sb, "src/content/core/detect.js");
  load(sb, "src/content/core/cache.js");
  sb.BC.ui = { stat: () => sb.document.createElement("div"), sparkline: () => null };
  sb.BC.api = {
    coursesWithScores: () => Promise.resolve([]),
    plannerItems: () => Promise.resolve([]),
  };
  sb.BC.storage = { current: null, local: {}, updateLocal: () => Promise.resolve() };
  sb.BC.requestApply = () => {};
  sb.getComputedStyle = (el) => ({
    backgroundColor: el._bg == null ? "rgba(0, 0, 0, 0)" : el._bg,
    backgroundImage: el._bgImage || "none",
    color: el._fg || "rgb(45, 59, 69)",
  });
  load(sb, "src/content/features/dashboard.js");

  const doc = sb.document;
  const container = doc.createElement("div");
  container.setAttribute("id", "DashboardCard_Container");
  doc.body.appendChild(container);

  let headingEl = null;
  if (heading) {
    headingEl = doc.createElement("h2");
    headingEl.textContent = "Published Courses";
    container.appendChild(headingEl);
  }

  const cards = [];
  for (let i = 0; i < 3; i++) {
    const card = doc.createElement("div");
    card.className = "ic-DashboardCard";
    // Canvas nests the hero (carrying the course colour) inside the image
    // wrapper, so the identity pass has to prefer it by priority, not by
    // document order.
    const imageWrap = doc.createElement("div");
    imageWrap.className = "ic-DashboardCard__header_image";
    imageWrap._bgImage = i === 0 ? 'url("art.png")' : "none";
    const hero = doc.createElement("div");
    hero.className = "ic-DashboardCard__header_hero";
    hero._bg = ["rgb(181, 138, 60)", "rgb(74, 157, 127)", "rgb(140, 90, 158)"][i % 3];
    imageWrap.appendChild(hero);
    card.appendChild(imageWrap);
    const link = doc.createElement("a");
    link.className = "ic-DashboardCard__link";
    link.setAttribute("href", "/courses/" + (i + 1));
    card.appendChild(link);
    if (wrapped) {
      // Canvas wraps each card in its own box element.
      const box = doc.createElement("div");
      box.className = "ic-DashboardCard__box";
      box.appendChild(card);
      container.appendChild(box);
    } else {
      container.appendChild(card);
    }
    cards.push(card);
  }
  return { sb, doc, container, cards, headingEl };
}

const settings = (over) => {
  const sb = createSandbox();
  loadCore(sb);
  const s = sb.BC.cloneDefaults();
  Object.assign(s.dashboard, over || {});
  return s;
};

function applyDashboard(env, s) {
  env.sb.BC.storage.current = s;
  env.sb.BC.features.dashboard.apply(s, { page: "dashboard", courseId: null, path: "/" });
}

module.exports = {
  "the card container is found even when each card sits in its own wrapper"() {
    // This is the shape that broke: .ic-DashboardCard__box is the per-card
    // wrapper, so styling it as the grid made every card a one-column grid and
    // left the real container with no layout, stacking the cards.
    const env = dashboard({ wrapped: true });
    applyDashboard(env, settings());
    const marked = env.doc.querySelectorAll("[data-bc-cardgrid]");
    assert.equal(marked.length, 1, "exactly one element should be marked as the grid");
    assert.equal(marked[0], env.container,
      "the marked element must be the container holding all cards, not a per-card wrapper");
  },

  "the card container is found when cards are direct children"() {
    const env = dashboard({ wrapped: false });
    applyDashboard(env, settings());
    const marked = env.doc.querySelectorAll("[data-bc-cardgrid]");
    assert.equal(marked.length, 1);
    assert.equal(marked[0], env.container);
  },

  "the marker never lands on body or the document element"() {
    const env = dashboard({ wrapped: false });
    applyDashboard(env, settings());
    for (const el of env.doc.querySelectorAll("[data-bc-cardgrid]")) {
      assert.notEqual(el, env.doc.body);
      assert.notEqual(el, env.doc.documentElement);
    }
  },

  "the marker is removed when the cards go away"() {
    const env = dashboard({ wrapped: false });
    applyDashboard(env, settings());
    assert.equal(env.doc.querySelectorAll("[data-bc-cardgrid]").length, 1);
    for (const c of env.cards) c.remove();
    applyDashboard(env, settings());
    assert.equal(env.doc.querySelectorAll("[data-bc-cardgrid]").length, 0,
      "a stale marker would keep a grid on an empty container");
  },

  "unmount clears the marker"() {
    const env = dashboard({ wrapped: false });
    applyDashboard(env, settings());
    env.sb.BC.features.dashboard.unmount();
    assert.equal(env.doc.querySelectorAll("[data-bc-cardgrid]").length, 0);
  },

  "layout rules target the derived container, not a Canvas class name"() {
    // .ic-DashboardCard__box is per-card chrome (theming.js gives it the card
    // background, dashboard.js gives it the card radius). Using it for the
    // container rules too is what produced the single-column stack.
    const src = read("src/content/features/dashboard.js");
    for (const layout of ["grid", "list", "compact", "masonry"]) {
      const m = src.match(new RegExp('d\\.layout === "' + layout + '"\\) css \\+= `([\\s\\S]*?)`;'));
      assert.ok(m, `no rule found for the ${layout} layout`);
      assert.match(m[1], /\$\{GRID\}|\[data-bc-cardgrid\]/,
        `the ${layout} layout must lay out the derived container`);
      assert.noMatch(m[1], /\.ic-DashboardCard__box\s*\{/,
        `the ${layout} layout must not style the per-card wrapper as the container`);
    }
  },

  "every layout gives the container an explicit display"() {
    // Switching layouts must not leave the previous layout's display in place.
    const src = read("src/content/features/dashboard.js");
    for (const layout of ["grid", "list", "compact", "masonry"]) {
      const m = src.match(new RegExp('d\\.layout === "' + layout + '"\\) css \\+= `([\\s\\S]*?)`;'));
      assert.match(m[1], /display:\s*(grid|flex|block)\s*!important/,
        `the ${layout} layout must set display on the container`);
    }
  },

  "the card wrapper keeps its card-level chrome"() {
    // It is still the right target for radius and the dark card background.
    const src = read("src/content/features/dashboard.js");
    assert.match(src, /\.ic-DashboardCard__link, \.ic-DashboardCard__box \{ border-radius/);
    assert.match(read("src/content/features/theming.js"), /ic-DashboardCard__box/);
  },

  "each card's grid item is marked, whether wrapped or not"() {
    for (const wrapped of [true, false]) {
      const env = dashboard({ wrapped });
      applyDashboard(env, settings());
      const items = env.doc.querySelectorAll("[data-bc-carditem]");
      assert.equal(items.length, 3, `wrapped=${wrapped}: every card should have a marked grid item`);
      for (const item of items) {
        assert.equal(item.parentElement, env.container,
          "a grid item must be a direct child of the grid container");
      }
    }
  },

  "a heading inside the container is not treated as a card"() {
    // Canvas puts "Published Courses" in here; making the container a grid would
    // otherwise drop the heading into a card slot.
    const env = dashboard({ wrapped: true, heading: true });
    applyDashboard(env, settings());
    assert.notOk(env.headingEl.hasAttribute("data-bc-carditem"),
      "the heading must not be marked as a card item");
    assert.equal(env.doc.querySelectorAll("[data-bc-carditem]").length, 3);
  },

  "non-card children are told to span the full row"() {
    const src = read("src/content/features/dashboard.js");
    for (const layout of ["grid", "compact"]) {
      const m = src.match(new RegExp('d\\.layout === "' + layout + '"\\) css \\+= `([\\s\\S]*?)`;'));
      assert.match(m[1], /\$\{spanRow\}/,
        `the ${layout} layout must let a heading span the row instead of taking a card slot`);
    }
    // GRID is a constant, so the source carries ${GRID} rather than the expansion.
    assert.match(src, /\$\{GRID\} > :not\(\[data-bc-carditem\]\) \{ grid-column: 1 \/ -1/);
  },

  "item marks are cleared with the grid mark"() {
    const env = dashboard({ wrapped: true });
    applyDashboard(env, settings());
    assert.ok(env.doc.querySelectorAll("[data-bc-carditem]").length > 0);
    env.sb.BC.features.dashboard.unmount();
    assert.equal(env.doc.querySelectorAll("[data-bc-carditem]").length, 0);
    assert.equal(env.doc.querySelectorAll("[data-bc-cardgrid]").length, 0);
  },

  "neither marker attribute is watched by the observer"() {
    // Writing them must not retrigger applyAll.
    const obs = read("src/content/core/observer.js");
    const filter = obs.match(/attributeFilter:\s*\[([^\]]*)\]/);
    assert.ok(filter);
    assert.noMatch(filter[1], /data-bc-cardgrid/);
    assert.noMatch(filter[1], /data-bc-carditem/);
  },

  "each card is stamped with its own course colour"() {
    // The spine is what still identifies a course once the artwork has scrolled
    // past, so every card needs its own value.
    const env = dashboard({ wrapped: false });
    applyDashboard(env, settings());
    const stamped = env.cards.map((c) => c.dataset.bcCourseColour);
    assert.deepEqual(stamped, ["#b58a3c", "#4a9d7f", "#8c5a9e"]);
    for (const c of env.cards) {
      assert.equal(c.style["--bc-course"], c.dataset.bcCourseColour,
        "the custom property must carry the colour the spine reads");
    }
  },

  "the hero wins over the image wrapper that contains it"() {
    // querySelector with a selector list returns whatever matches first in the
    // TREE, and Canvas nests the hero inside the wrapper, so a card with artwork
    // resolved to the wrapper, which has an image and no colour to read.
    const env = dashboard({ wrapped: false });
    applyDashboard(env, settings());
    assert.equal(env.cards[0].dataset.bcCourseColour, "#b58a3c",
      "a card with artwork must still resolve its course colour");
  },

  "a user's chosen colour overrides what Canvas painted"() {
    const env = dashboard({ wrapped: false });
    const s = settings();
    const id = env.cards[0].querySelector("a.ic-DashboardCard__link").getAttribute("href").split("/").pop();
    s.dashboard.courses[id] = { color: "#ff0000" };
    applyDashboard(env, s);
    assert.equal(env.cards[0].dataset.bcCourseColour, "#ff0000");
  },

  "a neutral surface is never mistaken for a course colour"() {
    // Our own dark surfaces are grey; stamping one as the course colour would
    // give every card an identical invisible spine.
    const env = dashboard({ wrapped: false });
    for (const c of env.cards) {
      c.querySelector(".ic-DashboardCard__header_hero")._bg = "rgb(37, 40, 47)";
      c._bg = "rgb(37, 40, 47)";
    }
    applyDashboard(env, settings());
    for (const c of env.cards) {
      assert.equal(c.dataset.bcCourseColour, undefined,
        "a grey is chrome, not an identity");
    }
  },

  "course colours are cleared on teardown"() {
    const env = dashboard({ wrapped: false });
    applyDashboard(env, settings());
    assert.ok(env.cards[0].dataset.bcCourseColour);
    env.sb.BC.features.dashboard.unmount();
    for (const c of env.cards) assert.equal(c.dataset.bcCourseColour, undefined);
  },

  "the spine is not animated, only the hover lift is"() {
    // box-shadow interpolating from "none" holds its start value for the whole
    // duration, so an animated spine renders blank on first paint; and animating
    // an identity cue in on every load is noise.
    const src = read("src/content/features/dashboard.js");
    const i = src.indexOf("const spine =");
    const block = src.slice(i, src.indexOf("`;", i));
    assert.match(block, /transition: transform var\(--bc-dur-2/);
    assert.noMatch(block, /transition:[^;]*box-shadow/,
      "box-shadow must not be transitioned");
  },

  "the card treatment uses tokens, not literals"() {
    const src = read("src/content/features/dashboard.js");
    const i = src.indexOf("const spine =");
    const block = src.slice(i, src.indexOf("`;", i));
    for (const token of ["--bc-text-lg", "--bc-weight-semibold", "--bc-muted",
                         "--bc-surface-3", "--bc-focus-ring"]) {
      assert.ok(block.includes(token), `the card treatment should use ${token}`);
    }
    assert.match(block, /font-variant-numeric: tabular-nums/,
      "course codes are figures and should align");
  },
};
