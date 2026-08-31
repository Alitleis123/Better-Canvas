/*
 * Better Canvas - a model of Canvas's own DOM and default colours.
 *
 * `bg` / `fg` on a node are what CANVAS paints there with no extension
 * installed. Our stylesheets are then matched against this tree, so a test can
 * ask the question that actually matters: with our CSS applied, what colour is
 * this text and what is it sitting on?
 *
 * `fg` is set ONLY where Canvas genuinely declares a colour on that element:
 * the body ink, links, and a few components. Everything else inherits. Painting
 * an fg on every node would be the difference between a fixture that catches
 * inherited-text-on-undarkened-surface and one that cannot see it at all, since
 * a direct declaration always beats an inherited value.
 *
 * Class names follow Canvas's dashboard and course markup. Where Canvas has
 * changed a container over time both shapes are covered by separate fixtures.
 */
"use strict";
const { node } = require("./cssmatch");

const WHITE = "#ffffff";
const PAGE = "#f5f5f5";
const INK = "#2d3b45";        // Canvas's default body ink
const LINK = "#0374b5";

// Attach Canvas's own painted colours to a node.
function paint(el, bg, fg) {
  if (bg) el.bg = bg;
  if (fg) el.fg = fg;
  return el;
}

function card({ courseColor, hasImage }) {
  const hero = paint(node("div", ".ic-DashboardCard__header_hero"), courseColor);
  const image = node("div", ".ic-DashboardCard__header_image", {}, [hero]);
  if (hasImage) image.bgImage = true;
  return node("div", ".ic-DashboardCard", {}, [
    node("div", ".ic-DashboardCard__header", {}, [
      image,
      paint(node("a", ".ic-DashboardCard__link", { href: "/courses/1" }, [
        node("div", ".ic-DashboardCard__header-title", {}, [node("span", "")]),
        node("div", ".ic-DashboardCard__header-subtitle"),
        node("div", ".ic-DashboardCard__header-term"),
      ]), WHITE, INK),
    ]),
    node("nav", ".ic-DashboardCard__action-container", {}, [
      paint(node("a", ".ic-DashboardCard__action"), null, LINK),
    ]),
  ]);
}

// Canvas's dashboard. `wrappedCards` covers the markup where each card sits in
// its own .ic-DashboardCard__box.
function dashboard({ wrappedCards = true, cards = 3 } = {}) {
  const made = [];
  for (let i = 0; i < cards; i++) {
    made.push(card({ courseColor: ["#4a9d7f", "#8c5a9e", "#c0562e"][i % 3], hasImage: i < 2 }));
  }
  const items = wrappedCards
    ? made.map((c) => node("div", ".ic-DashboardCard__box", {}, [c]))
    : made;

  const cardContainer = node("div", "#DashboardCard_Container", {}, [
    // Inherits, like most Canvas headings.
    node("h2", ".ic-DashboardCard__box_header"),
    ...items,
  ]);

  return paint(node("html", ".bc-dark", {}, [
    paint(node("body", "", {}, [
      node("div", "#application.ic-app", {}, [
        paint(node("header", "#header.ic-app-header", {}, [
          node("nav", "#menu", {}, [
            paint(node("li", ".ic-app-header__menu-list-item", {}, [
              paint(node("a", ".ic-app-header__menu-list-link"), null, WHITE),
            ]), "#2d3b45"),
          ]),
        ]), "#394b58"),
        node("div", "#wrapper.ic-Layout-wrapper", {}, [
          node("div", "#main.ic-Layout-columns", {}, [
            node("div", "#content-wrapper.ic-Layout-contentWrapper", {}, [
              paint(node("div", "#content.ic-Layout-contentMain", {}, [
                // The header bar that rendered white-on-white.
                paint(node("div", ".ic-Dashboard-header__layout", {}, [
                  node("h1", ".ic-Dashboard-header__title"),
                  node("div", ".ic-Dashboard-header__actions", {}, [
                    paint(node("button", ".Button"), WHITE),
                  ]),
                ]), WHITE),
                cardContainer,
              ]), PAGE),
            ]),
            node("div", "#right-side-wrapper", {}, [
              paint(node("aside", "#right-side", {}, [
                paint(node("div", ".Sidebar__TodoListContainer", {}, [
                  node("h2", ".todo-list-header"),
                  paint(node("a", ".todo-item"), null, LINK),
                ]), WHITE),
                paint(node("div", ".recent_feedback", {}, [
                  node("span", ""),
                ]), WHITE),
              ]), PAGE),
            ]),
          ]),
        ]),
      ]),
    ]), PAGE, INK),
  ]), PAGE, INK);
}

// A course page: the other place a light panel is common.
function coursePage() {
  return paint(node("html", ".bc-dark", {}, [
    paint(node("body", "", {}, [
      node("div", "#application.ic-app", {}, [
        node("div", "#wrapper.ic-Layout-wrapper", {}, [
          node("div", "#main.ic-Layout-columns", {}, [
            paint(node("aside", "#left-side", {}, [
              node("nav", "#section-tabs", {}, [
                paint(node("li", "", {}, [paint(node("a", ""), null, LINK)]), WHITE),
              ]),
            ]), PAGE),
            paint(node("div", "#content.ic-Layout-contentMain", {}, [
              paint(node("div", ".ic-Action-header", {}, [
                node("h1", ".ic-Action-header__Heading"),
              ]), WHITE),
              paint(node("table", ".ic-Table", {}, [
                node("thead", "", {}, [paint(node("th", ""), PAGE)]),
                node("tbody", "", {}, [
                  node("tr", "", {}, [paint(node("td", ""), WHITE)]),
                ]),
              ]), WHITE),
              // Instructor-authored content: ours to leave alone.
              paint(node("div", ".user_content", {}, [
                paint(node("div", ".callout"), "#fff9c4", "#3e2723"),
              ]), WHITE, INK),
            ]), PAGE),
          ]),
        ]),
      ]),
    ]), PAGE, INK),
  ]), PAGE, INK);
}

module.exports = { dashboard, coursePage, card, WHITE, PAGE, INK, LINK };
