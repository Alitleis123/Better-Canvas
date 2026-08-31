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

// A course grades table: dense, cell-painted, and the page most students live on.
function gradesPage() {
  const row = (bg) => node("tr", ".student_assignment", {}, [
    paint(node("th", ".title", {}, [paint(node("a", ""), null, LINK)]), bg),
    paint(node("td", ".due"), bg),
    paint(node("td", ".assignment_score", {}, [
      node("span", ".grade"), node("span", ".score_value"),
    ]), bg),
    paint(node("td", ".points_possible"), bg),
  ]);
  return shell([
    paint(node("div", ".ic-Action-header", {}, [
      node("h1", ".ic-Action-header__Heading"),
    ]), WHITE),
    paint(node("table", "#grades_summary.editable", {}, [
      node("thead", "", {}, [
        node("tr", "", {}, [
          paint(node("th", ""), PAGE), paint(node("th", ""), PAGE),
          paint(node("th", ""), PAGE), paint(node("th", ""), PAGE),
        ]),
      ]),
      node("tbody", "", {}, [row(WHITE), row(PAGE), row(WHITE)]),
    ]), WHITE),
    paint(node("div", "#student-grades-right-content", {}, [
      paint(node("div", ".student_assignment.final_grade"), PAGE),
    ]), WHITE),
  ]);
}

// Modules: nested item groups, each with its own painted header.
function modulesPage() {
  const item = () => paint(node("li", ".context_module_item.ig-row", {}, [
    paint(node("a", ".ig-title"), null, LINK),
    node("div", ".ig-details", {}, [node("span", ".due_date_display")]),
  ]), WHITE);
  return shell([
    paint(node("div", "#context_modules.context_module", {}, [
      paint(node("div", ".header.ig-header", {}, [
        node("span", ".name.ig-header-title"),
        node("span", ".ig-header-admin"),
      ]), PAGE),
      node("ul", ".ig-list.context_module_items", {}, [item(), item(), item()]),
    ]), WHITE),
  ]);
}

// A discussion topic: entries plus authored message bodies.
function discussionPage() {
  const entry = () => paint(node("div", ".discussion_entry.entry", {}, [
    node("div", ".header", {}, [paint(node("a", ".author"), null, LINK)]),
    paint(node("div", ".message.user_content", {}, [
      node("p", ""),
      paint(node("blockquote", ""), "#eef3f8"),
    ]), null, INK),
  ]), WHITE);
  return shell([
    paint(node("div", "#discussion_topic.discussion_entry", {}, [
      paint(node("div", ".message.user_content", {}, [node("p", "")]), null, INK),
    ]), WHITE),
    node("div", "#discussion_subentries", {}, [entry(), entry()]),
  ]);
}

// An assignment page with a right sidebar.
function assignmentPage() {
  return shell([
    paint(node("div", "#assignment_show.assignment", {}, [
      node("h1", ".title"),
      paint(node("div", ".description.user_content", {}, [
        node("p", ""),
        paint(node("table", "", {}, [
          node("tr", "", {}, [paint(node("td", ""), "#f9f9f9")]),
        ]), WHITE),
      ]), null, INK),
    ]), WHITE),
    paint(node("div", "#sidebar_content.rs-margin-bottom", {}, [
      paint(node("div", ".description"), null, INK),
    ]), WHITE),
  ]);
}

// The shared page shell every course page sits in.
function shell(contentChildren) {
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
            paint(node("div", "#content.ic-Layout-contentMain", {}, contentChildren), PAGE),
          ]),
        ]),
      ]),
    ]), PAGE, INK),
  ]), PAGE, INK);
}

module.exports = {
  dashboard, coursePage, gradesPage, modulesPage, discussionPage, assignmentPage,
  card, WHITE, PAGE, INK, LINK,
};
