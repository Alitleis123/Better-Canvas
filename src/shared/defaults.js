/*
 * Better Canvas — default settings schema (single source of truth).
 * Loaded as a classic script in content scripts, options, and popup.
 * Attaches to globalThis.BC so every surface shares one definition.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  BC.SETTINGS_KEY = "bcSettings";

  // Known global (left) navigation items in Canvas, keyed by their element id.
  BC.GLOBAL_NAV_ITEMS = [
    { key: "global_nav_dashboard_link", label: "Dashboard" },
    { key: "global_nav_courses_link", label: "Courses" },
    { key: "global_nav_groups_link", label: "Groups" },
    { key: "global_nav_calendar_link", label: "Calendar" },
    { key: "global_nav_conversations_link", label: "Inbox" },
    { key: "global_nav_history_link", label: "History" },
    { key: "global_nav_commons_link", label: "Commons" },
    { key: "global_nav_help_link", label: "Help" },
    { key: "global_nav_accounts_link", label: "Admin" },
    { key: "global_nav_profile_link", label: "Account" },
  ];

  // Standard 4.0 GPA scale (lower-bound percent -> grade points).
  BC.GPA_SCALES = {
    "standard-4": [
      { min: 93, points: 4.0, letter: "A" },
      { min: 90, points: 3.7, letter: "A-" },
      { min: 87, points: 3.3, letter: "B+" },
      { min: 83, points: 3.0, letter: "B" },
      { min: 80, points: 2.7, letter: "B-" },
      { min: 77, points: 2.3, letter: "C+" },
      { min: 73, points: 2.0, letter: "C" },
      { min: 70, points: 1.7, letter: "C-" },
      { min: 67, points: 1.3, letter: "D+" },
      { min: 63, points: 1.0, letter: "D" },
      { min: 60, points: 0.7, letter: "D-" },
      { min: 0, points: 0.0, letter: "F" },
    ],
  };

  BC.defaults = {
    version: 1,
    enabled: true,

    dashboard: {
      enabled: true,
      autoHideConcluded: true,
      // courseOrder is an ordered array of course id strings.
      courseOrder: [],
      widgets: { todo: true, comingUp: true, recentFeedback: true },
      hideSidebar: false, // hide the entire right-hand dashboard sidebar
      // Per-course overrides keyed by course id string:
      // { hidden:bool, nickname:string, color:"#rrggbb", bgImage:"url|dataURI" }
      courses: {},
    },

    // The To Do list. "default" leaves Canvas alone; "clean" is a CSS-only
    // circular restyle of the native list; "custom" replaces it with Better
    // Canvas's own planner widget (completion ring, week nav, course filter,
    // checkable tasks, and a New Task composer).
    todo: {
      mode: "default", // default | clean | custom
      rangeDays: 7, // days ahead the custom widget shows (7 = a week)
      showCompleted: false, // include completed items in the custom widget
      accent: "", // "" = use the theme accent; otherwise "#rrggbb" for ring + checks
      allowNewTask: true, // show the "New Task" composer in the custom widget
    },

    theming: {
      darkMode: "off", // off | on | auto | scheduled
      darkSchedule: { start: "20:00", end: "07:00" },
      darkTone: "neutral", // neutral | slate | black — base palette for dark mode
      darkBg: "", // "#rrggbb" custom dark background; "" = use the tone above
      accentColor: "", // "" = leave Canvas default
      font: "", // "" = default; otherwise a CSS font-family stack
      density: "default", // compact | default | spacious
      logo: { mode: "default", url: "" }, // default | hide | replace
    },

    navigation: {
      global: { hidden: [], order: [], customLinks: [] }, // customLinks: {label,url,newTab}
      course: { hidden: [], order: [], customLinks: [] }, // hidden/order by lowercased label
    },

    cosmetics: {
      background: {
        mode: "none", // none | color | image
        color: "#0b1220",
        image: "",
        blur: 0, // px
        opacity: 100, // 0-100
      },
      customCss: "",
    },

    grades: {
      gpaScale: "standard-4",
      // creditsByCourse keyed by course id string -> number
      creditsByCourse: {},
      whatIfEnabled: true,
    },

    privacy: { telemetry: false }, // hard-wired false; never sends anything
  };

  // Deep clone so callers never mutate the canonical defaults.
  BC.cloneDefaults = function () {
    return JSON.parse(JSON.stringify(BC.defaults));
  };

  /*
   * Deep-merge stored settings over defaults so new keys appear after upgrades
   * and corrupt/missing branches fall back safely.
   */
  BC.mergeDefaults = function (stored) {
    const base = BC.cloneDefaults();
    if (!stored || typeof stored !== "object") return base;
    const merge = (target, src) => {
      for (const k of Object.keys(src)) {
        const sv = src[k];
        if (Array.isArray(sv)) {
          target[k] = sv;
        } else if (sv && typeof sv === "object") {
          target[k] = merge(
            target[k] && typeof target[k] === "object" ? target[k] : {},
            sv
          );
        } else if (sv !== undefined) {
          target[k] = sv;
        }
      }
      return target;
    };
    return merge(base, stored);
  };
})();
