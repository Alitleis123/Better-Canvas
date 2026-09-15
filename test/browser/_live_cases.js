// Does changing a setting DO anything, without a reload?
//
// Run by test/browser/live.sh against live.html, which boots the whole
// extension the way content.js does on Canvas — real registry, real applyAll,
// real storage-subscribe path. That is the only place this question can be
// asked: page.html drives features directly, so it cannot tell a setting that
// re-renders from one whose only effect happens at boot.
//
// Each node case sets the setting off, counts the node, sets it on, counts
// again, then sets it off once more. A setting that needs a reload reads the
// same all three times. The third read matters as much as the second: a
// feature that mounts on and never unmounts is just as stuck, and only the
// round trip catches it.
//
// Style cases do the same for settings whose effect is a computed property
// rather than a node.
//
// Additions are cheap and worth it. Two real defects came out of the first run
// of this sweep — read-aloud buttons with no off branch, and theming's global
// radius outranking the dashboard's own card-radius control, so that slider
// moved nothing.
window.__BC_NODE_CASES = [
  { name: "dashboard.courseSearch", sel: '[data-bc-node="bc-course-search"]',
    off: { dashboard: { courseSearch: false } }, on: { dashboard: { courseSearch: true } } },
  { name: "dashboard.semesterProgress", sel: '[data-bc-node="bc-semester"]',
    off: { dashboard: { semesterProgress: false } }, on: { dashboard: { semesterProgress: true } } },
  { name: "dashboard.widgets.gpa", sel: '[data-bc-node="bc-gpa-card"]',
    off: { dashboard: { widgets: { gpa: false } } }, on: { dashboard: { widgets: { gpa: true } } } },
  { name: "todo.mode=custom", sel: '[data-bc-node="bc-todo-widget"]',
    off: { todo: { mode: "default" } }, on: { todo: { mode: "custom" } } },
  { name: "productivity.readingRuler", sel: '[data-bc-node="bc-ruler"]',
    off: { productivity: { readingRuler: false } }, on: { productivity: { readingRuler: true } } },
  { name: "productivity.printFriendly", sel: '[data-bc-node="bc-print-btn"]',
    off: { productivity: { printFriendly: false } }, on: { productivity: { printFriendly: true } } },
  { name: "productivity.copyUrlButton", sel: '[data-bc-node="bc-copyurl-btn"]',
    off: { productivity: { copyUrlButton: false } }, on: { productivity: { copyUrlButton: true } } },
  { name: "accessibility.tts", sel: '[data-bc-node="bc-tts-btn"]',
    off: { accessibility: { tts: false } }, on: { accessibility: { tts: true } } },
  { name: "calendar.miniOnDashboard", sel: '[data-bc-node="bc-mini-cal"]',
    off: { calendar: { miniOnDashboard: false } }, on: { calendar: { miniOnDashboard: true } } },
  { name: "files.enabled", sel: '[data-bc-node="bc-files-panel"]',
    off: { files: { enabled: false } }, on: { files: { enabled: true } } },
  { name: "announcements.aggregator", sel: '[data-bc-node="bc-ann-panel"]',
    off: { announcements: { aggregator: false } }, on: { announcements: { aggregator: true } } },
  { name: "dashboard.showBadges", sel: '[data-bc-node="bc-badges"], .bc-dc-due',
    off: { dashboard: { showBadges: false } }, on: { dashboard: { showBadges: true } } },
  { name: "dashboard.showInlineGrade", sel: '[data-bc-node="bc-inline-grade"], .bc-dc-chip',
    off: { dashboard: { showInlineGrade: false } }, on: { dashboard: { showInlineGrade: true } } },
  { name: "dashboard.showProgressBar", sel: '.bc-dc-bar:not(.is-empty), [data-bc-node="bc-progress-bar"]',
    off: { dashboard: { showProgressBar: false } }, on: { dashboard: { showProgressBar: true } } },
];

window.__BC_STYLE_CASES = [
  { name: "theming.radius", sel: ".bc-dc", prop: "borderTopLeftRadius",
    a: { theming: { radius: 2 }, dashboard: { cardRadius: 2 } },
    b: { theming: { radius: 20 }, dashboard: { cardRadius: 20 } } },
  { name: "dashboard.cardRadius alone", sel: ".bc-dc", prop: "borderTopLeftRadius",
    a: { dashboard: { cardRadius: 0 } }, b: { dashboard: { cardRadius: 22 } } },
  { name: "theming.darkMode", sel: "body", prop: "backgroundColor",
    a: { theming: { darkMode: "off" } }, b: { theming: { darkMode: "on" } } },
  { name: "theming.fontSizeScale", sel: "html", prop: "fontSize",
    a: { theming: { fontSizeScale: "s" } }, b: { theming: { fontSizeScale: "xl" } } },
  { name: "theming.density", sel: "html", prop: "--bc-pad-row",
    a: { theming: { density: "compact" } }, b: { theming: { density: "spacious" } } },
  { name: "theming.accentColor", sel: "html", prop: "--bc-accent",
    a: { theming: { accentColor: "#8844cc" } }, b: { theming: { accentColor: "#22aa66" } } },
  { name: "theming.sidebarWidth", sel: "#right-side-wrapper", prop: "width",
    a: { theming: { sidebarWidth: 240 } }, b: { theming: { sidebarWidth: 380 } } },
  { name: "theming.lineHeight", sel: "body", prop: "lineHeight",
    a: { theming: { lineHeight: 1.2 } }, b: { theming: { lineHeight: 2 } } },
  { name: "theming.letterSpacing", sel: "body", prop: "letterSpacing",
    a: { theming: { letterSpacing: 0 } }, b: { theming: { letterSpacing: 2 } } },
  { name: "dashboard.cardSize", sel: ".bc-dc", prop: "width",
    a: { dashboard: { cardSize: "s" } }, b: { dashboard: { cardSize: "l" } } },
  { name: "dashboard.maxColumns", sel: '[data-bc-node="bc-dashgrid"]', prop: "width",
    a: { dashboard: { maxColumns: 3 } }, b: { dashboard: { maxColumns: 6 } } },
  { name: "cosmetics.background", sel: "#bc-bg-layer", prop: "backgroundImage",
    a: { cosmetics: { background: { mode: "none" } } },
    b: { cosmetics: { background: { mode: "gradient", gradient: { from: "#123456", to: "#654321", angle: 90 } } } } },
  { name: "theming.skin", sel: "html", prop: "--bc-accent",
    a: { theming: { skin: "" } }, b: { theming: { skin: "matcha-strawberry" } } },
  { name: "theming.highContrast", sel: "html", prop: "filter",
    a: { theming: { highContrast: false } }, b: { theming: { highContrast: true } } },
  { name: "accessibility.dyslexiaFont", sel: "body", prop: "fontFamily",
    a: { accessibility: { dyslexiaFont: false } }, b: { accessibility: { dyslexiaFont: true } } },
  { name: "accessibility.largeTargets", sel: ".Button", prop: "minHeight",
    a: { accessibility: { largeTargets: false } }, b: { accessibility: { largeTargets: true } } },
];

// High contrast and colour-blind correction both want the single `filter`
// property. Each worked alone; together, the inline colour-blind filter
// outranked the stylesheet's contrast boost and silently dropped it.
window.__BC_STYLE_CASES.push(
  { name: "highContrast under colorBlind", sel: "html", prop: "filter",
    a: { theming: { highContrast: false, colorBlind: "deuteranopia" } },
    b: { theming: { highContrast: true, colorBlind: "deuteranopia" } } },
  { name: "colorBlind under highContrast", sel: "html", prop: "filter",
    a: { theming: { highContrast: true, colorBlind: "off" } },
    b: { theming: { highContrast: true, colorBlind: "protanopia" } } },
);
