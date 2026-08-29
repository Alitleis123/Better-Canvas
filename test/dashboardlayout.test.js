"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, load, ROOT } = require("./harness");

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Build a dashboard resembling Canvas's: a container holding per-card wrappers.
function dashboard({ wrapped }) {
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
  load(sb, "src/content/features/dashboard.js");

  const doc = sb.document;
  const container = doc.createElement("div");
  container.setAttribute("id", "DashboardCard_Container");
  doc.body.appendChild(container);

  const cards = [];
  for (let i = 0; i < 3; i++) {
    const card = doc.createElement("div");
    card.className = "ic-DashboardCard";
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
  return { sb, doc, container, cards };
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
};
