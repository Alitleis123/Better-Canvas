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

// Every test in this file exercises the path that overrides Canvas's OWN cards:
// markCardGrid, the course-colour stamp, layoutCss. That path is the fallback
// now -- dashboard.ownCards defaults to true and dashgrid renders the cards
// instead -- so it has to be asked for explicitly here. The default itself is
// asserted below, so this cannot quietly drift into testing nothing.
const settings = (over) => {
  const sb = createSandbox();
  loadCore(sb);
  const s = sb.BC.cloneDefaults();
  Object.assign(s.dashboard, { ownCards: false }, over || {});
  return s;
};

function applyDashboard(env, s) {
  env.sb.BC.storage.current = s;
  env.sb.BC.features.dashboard.apply(s, { page: "dashboard", courseId: null, path: "/" });
}

module.exports = {
  "our own renderer owns the cards by default"() {
    const sb = createSandbox();
    loadCore(sb);
    assert.equal(sb.BC.cloneDefaults().dashboard.ownCards, true,
      "dashgrid is the dashboard; the Canvas-override path is the fallback");
  },

  "with our own renderer on, Canvas's cards are left alone"() {
    // Two layouts fighting over one page is what the override path was. When
    // dashgrid owns the grid, none of the Canvas-card marks may be written.
    const env = dashboard({ wrapped: false });
    applyDashboard(env, settings({ ownCards: true }));
    assert.equal(env.doc.querySelectorAll("[data-bc-cardgrid]").length, 0);
    assert.equal(env.doc.querySelectorAll("[data-bc-carditem]").length, 0);
    const tag = env.doc.querySelector('style[data-better-canvas="bc-dashboard-ui"]');
    const css = tag ? tag.textContent : "";
    // The CARD rules must not be emitted for a grid nobody can see. The page
    // chrome around it still must be: the header bar and the content column's
    // measure apply whichever renderer draws the cards, and dropping them put
    // Canvas's white title bar and hairline back under our own grid.
    assert.ok(!/\.ic-DashboardCard \{/.test(css),
      "per-card rules must not be emitted for hidden cards");
    assert.ok(!/grid-template-columns/.test(css),
      "the Canvas-card grid must not be laid out");
    assert.match(css, /\.ic-Dashboard-header__layout \{/,
      "the header bar is page chrome and still applies");
    assert.match(css, /\.ic-Layout-contentMain \{/,
      "so is the measure the content column is held to");
  },

  "the filter box survives our own renderer taking the cards"() {
    // It mounts above the grid and both renderers read it, so it has to be
    // mounted before the "Canvas has no cards" guard rather than after.
    const env = dashboard({ wrapped: false });
    applyDashboard(env, settings({ ownCards: true, courseSearch: true }));
    assert.equal(env.doc.querySelectorAll('[data-bc-node="bc-course-search"]').length, 1);
  },

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
    // --bc-surface-3 used to be here, when the action row was FILLED with it.
    // A fill made the bottom of every card a second, warmer colour and a card
    // read as two stacked panels; the row recedes with a hairline instead, so
    // the border token is what has to be tokenised now.
    for (const token of ["--bc-text-lg", "--bc-weight-semibold", "--bc-muted",
                         "--bc-border-subtle", "--bc-focus-ring"]) {
      assert.ok(block.includes(token), `the card treatment should use ${token}`);
    }
    assert.match(block, /font-variant-numeric: tabular-nums/,
      "course codes are figures and should align");
  },

  // Reported as the dashboard being well spaced on one monitor and cramped on
  // another. Measured across seven viewport widths from 1280 to 3000, the card
  // came out 299, 260, 253, 301, 256, 262 and 250 px wide, not even
  // monotonically, because the column was minmax(size, 1fr) and 1fr takes
  // whatever is left over. Canvas's own artwork is a flat 146px at every card
  // width, so its aspect ratio moved from 1.71 to 2.06 with it, and card height
  // jumped between 281 and 300 purely on whether the title wrapped.
  //
  // After: 250x316, aspect 0.79, artwork 140px at 44% of the card, at every one
  // of those widths. Only the column count changes.
  "a course card is the same card at every viewport width"() {
    // Comments stripped: the notes in the source name the rules they warn
    // against, and an unstripped scan reads those as the rules being present.
    const src = read("src/content/features/dashboard.js").replace(/\/\*[\s\S]*?\*\//g, "");

    // The grid track must not hand the leftover space to the card.
    const track = src.match(/const track = `([^`]+)`/);
    assert.ok(track, "the card grid track is not defined in one place");
    // 1fr is required here, not forbidden. Grid counts columns using the track's
    // max when that max is definite, so a definite ceiling in the track costs a
    // whole column and wraps the last card onto a row of its own. The ceiling
    // lives on the card instead.
    assert.match(track[1], /1fr\)\)$/,
      "a definite track max mis-counts the columns: " + track[1]);
    // auto-FIT, not auto-fill. auto-fill keeps the empty tracks it created, so a
    // 27" monitor laid out eight columns for five courses and drew them as a
    // strip against 900px of dead grey. auto-fit collapses them, and the cards
    // that exist share the row.
    assert.match(track[1], /repeat\(auto-fit/,
      "auto-fill leaves empty tracks on a wide monitor: " + track[1]);
    // The ceiling is what keeps the card a card: without it, four cards on a 27"
    // would each grow past 500px. It has to be on the CARD, because a definite
    // maximum in the track changes the column count.
    assert.match(src, /const grow = Math\.round\(size \* 1\.35\)/,
      "the ceiling should be a modest multiple of the chosen card size");
    const fill = src.match(/const fillCell = `([\s\S]+?)`;/);
    assert.ok(fill, "fillCell is not defined in one place");
    assert.match(fill[1], /max-width: \$\{grow\}px !important/,
      "the card must carry the ceiling, not the track");
    // And the column is capped, which is what makes 1920 and 2560 render the
    // same dashboard rather than merely a similar one.
    assert.match(src, /const measure = gm\s*\?\s*\(gm\.cap \? gm\.cap \+ "px" : "none"\)/,
      "when dashgrid draws the cards the measure must be ITS cap, not a second copy of the sum");
    assert.match(src, /: `calc\(\$\{size \* maxCols\}px/,
      "and the Canvas-card fallback still needs one measure of its own");
    // The cap is a COLUMN COUNT, defaulting to five, and 0 lifts it.
    assert.match(src, /d\.maxColumns == null \? 5 : d\.maxColumns \| 0/,
      "the column cap should default to five and be user-settable");
    assert.match(src, /const shell = !maxCols \? "" :/,
      "maxColumns: 0 has to lift the cap entirely");
    // Capping .ic-Layout-contentMain is allowed, but only together with zeroing
    // its inline padding. Canvas pads that element, so a cap on its own leaves
    // the grid the measure MINUS that padding -- 1290 against a 1314 measure,
    // 24px short of a fifth 250px column, which silently dropped every wide
    // monitor to four columns.
    const shellStart = src.indexOf("const shell =");
    const shellSrc = src.slice(shellStart, src.indexOf("`;", shellStart));
    if (/ic-Layout-contentMain/.test(shellSrc)) {
      const rule = shellSrc.slice(shellSrc.indexOf(".ic-Layout-contentMain"));
      assert.match(rule, /padding-inline: 0 !important/,
        "a cap on the padded content column must zero that padding too");
    }
    assert.match(shellSrc, /\$\{GRID\}[\s\S]{0,60}max-width: \$\{M\} !important/,
      "the grid itself must carry the measure");
    // And the measure is the SNAPPED one, with the cap as its fallback. The cap
    // alone bound only at the top end: below it the 1fr tracks handed the
    // leftover to the cards, which drew a 250px card at 307px on a 1280 window
    // and 284 at 1512 while the test above was green, because it only ever
    // checked the widths at and above the cap.
    assert.match(src, /const M = `min\(100%, var\(--bc-dash-measure, \$\{measure\}\)\)`/,
      "the measure has to fall back to the cap when nothing has snapped it");
    assert.match(src, /snapRO = new ResizeObserver/,
      "and something has to re-snap it when the window changes");
    // Observing the content column would feed its own width back into its own
    // measurement, and the clamp is one-way: once max-width pinned the column
    // narrow, widening the window could never lift it again.
    assert.match(src, /snapRO\.observe\(row\)/,
      "the snap must observe the ROW, not the column it resizes");
    // And every layout that uses a grid must use that one definition.
    const gridRules = [...src.matchAll(/grid-template-columns: ([^!]+)!important/g)].map((m) => m[1].trim());
    for (const g of gridRules) {
      assert.ok(/\$\{track\}/.test(g), "a layout restates its columns instead of using track: " + g);
    }

    // The artwork scales with the card rather than being a fixed slab.
    assert.match(src, /aspect-ratio: 16 \/ 9 !important/,
      "the card artwork needs a ratio, or its proportions move with the viewport");
    assert.match(src, /-webkit-line-clamp: 2 !important/,
      "the title must clamp, or a long course name makes a taller card");
    // Canvas sets white-space: nowrap on the title, so clamp has nothing to
    // clamp until wrapping is allowed. Without this the title is one long line
    // hard-clipped at the card edge.
    assert.match(src, /\.ic-DashboardCard__header-title \{[^}]*white-space: normal !important/,
      "the title cannot wrap to two lines while Canvas holds it at nowrap");
    // And the span must stay INLINE. Clamping it blockifies it, and
    // text-overflow cannot ellipsize an overflowing block child, which is how
    // titles ended up chopped mid-word with no ellipsis.
    assert.match(src, /\.ic-DashboardCard__header-title span \{[^}]*display: inline !important/,
      "the title's span must stay inline or the ellipsis has nothing to trim");
    // Equal heights come from stretching the row, not from reserving a line
    // inside the title: that put the slack between the title and the course
    // code, i.e. a hole in the middle of the card.
    assert.match(src, /align-items: stretch !important/,
      "cards in a row should share a height");
    // 1fr spreads the CONTAINER's height over the rows, and this container is
    // not content-sized, so one row of cards stretched to 640px with an empty
    // band above them.
    assert.ok(!/grid-auto-rows: 1fr/.test(src),
      "grid-auto-rows: 1fr stretches a row to the container, not to its content");
    assert.match(src, /\.ic-DashboardCard__action-container \{ margin-top: auto !important/,
      "the slack must collect above the action row, not inside the text");

    // The gutter belongs to the spacing scale like everything else we ship.
    assert.ok(!/gap: 16px !important/.test(src),
      "the card gutter should come from the spacing scale, not a magic 16px");
  },

  // The list layout has never shown a course name. Canvas puts the text link
  // INSIDE .ic-DashboardCard__header, and the layout treated that header as the
  // artwork with flex: 0 0 120px, so the link stacked under the hero and the
  // 90px card clipped it away. The row is the header now, with the artwork as
  // its first item and the link as its second.
  "a list row shows the course, not just its colour"() {
    const src = read("src/content/features/dashboard.js");
    const list = src.match(/if \(d\.layout === "list"\) css \+= `([\s\S]*?)`;/);
    assert.ok(list, "the list layout is missing");
    const css = list[1];
    assert.match(css, /\.ic-DashboardCard__header \{[^}]*display: flex/,
      "the header holds both the artwork and the link, so it has to be the row");
    assert.match(css, /\.ic-DashboardCard__header_image[^{]*\{[^}]*flex: 0 0 \d+px/,
      "the artwork is what gets the fixed width, not the header");
    assert.match(css, /\.ic-DashboardCard__link \{[^}]*flex: 1 1 auto/,
      "the link takes the rest of the row");
    assert.ok(!/\.ic-DashboardCard__header \{ flex: 0 0 120px/.test(css),
      "sizing the header as the artwork is what clipped the text");
  },

  // Cards are a fixed width so they never stretch, which means a row always has
  // leftover: measured 4px to 254px depending on the window. That is fine on the
  // page background and awful on a raised one, and the grid's container was being
  // treated as a card surface, so the remainder showed as an empty slab beside
  // the last card.
  "the card grid's container is layout, not a surface"() {
    const theming = read("src/content/features/theming.js").replace(/\/\*[\s\S]*?\*\//g, "");
    const surfaces = theming.match(/html\.bc-dark \.recent_feedback[\s\S]*?\}/);
    assert.ok(surfaces, "the dark surface list is missing");
    assert.ok(!/ic-DashboardCard__box/.test(surfaces[0]),
      "the grid container must not be in the surface list; it is not a card");
    assert.match(theming, /\[data-bc-cardgrid\][\s\S]{0,120}background-color: transparent/,
      "the grid container must be transparent so a row's leftover reads as page");
  },

  "Coming Up and Recent Feedback can be switched independently"() {
    // They are two settings and, on a live Canvas, ONE element: the DOM reports
    // a single div with class "events_list recent_feedback". So hiding either by
    // its own class took the other widget away with it -- one switch silently
    // operating two things.
    const src = read("src/content/features/dashboard.js");
    const fn = /function widgetsCss\(w\) \{[\s\S]*?\n  \}/.exec(src);
    assert.ok(fn, "widgetsCss not found");
    // Each switch must exempt the block that also belongs to the other one...
    assert.match(fn[0], /\.events_list:not\(\.recent_feedback\)/,
      "hiding Coming Up must not hide a block that is also Recent Feedback");
    assert.match(fn[0], /\.recent_feedback:not\(\.events_list\)/,
      "hiding Recent Feedback must not hide a block that is also Coming Up");
    // ...and the shared block goes only when BOTH are off.
    assert.match(fn[0], /!w\.comingUp && !w\.recentFeedback[\s\S]{0,120}\.events_list\.recent_feedback/,
      "the combined block should disappear only when both widgets are off");
  },

  "Canvas's own sidebar blocks get the same face as our planner"() {
    // Measured on a live dashboard: our .bc-todo is a card with a 1px border, a
    // 12.5px radius and 14px of padding, and Canvas's feedback block directly
    // below it is a bare div with none of those -- so the right column read as
    // one panel followed by some loose text. The replica had invented markup for
    // those blocks and drew all three as cards, so it never showed the gap.
    const src = read("src/content/features/dashboard.js");
    const rule = /:is\(#right-side, \.ic-app-main-content__secondary\) >[\s\S]*?\}/.exec(src);
    assert.ok(rule, "no surface rule for Canvas's sidebar blocks");
    for (const prop of ["background", "border", "border-radius", "padding"]) {
      assert.ok(rule[0].includes(prop + ":"), `sidebar surface rule is missing ${prop}`);
    }
    // Named blocks, not a child-universal selector: Canvas wraps the View Grades
    // button in a bare div, which would otherwise become a box around a button.
    assert.doesNotMatch(rule[0], />\s*\*/,
      "the surface rule must name the blocks it applies to");
  },
};
