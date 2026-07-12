/*
 * Better Canvas — default settings schema.
 * Single source of truth. Loaded as a classic script by every surface
 * (content scripts, popup, options) and attaches to globalThis.BC.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  BC.VERSION = "3.0.0";
  BC.SETTINGS_KEY = "bcSettings";
  BC.LOCAL_KEY = "bcLocal";
  BC.PROFILES_KEY = "bcProfiles";

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

  BC.GPA_SCALES = {
    "standard-4": {
      label: "Standard 4.0",
      bands: [
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
    },
    "plus-4-3": {
      label: "4.3 scale (A+ = 4.3)",
      bands: [
        { min: 97, points: 4.3, letter: "A+" },
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
    },
    "hs-unweighted": {
      label: "High school (unweighted)",
      bands: [
        { min: 90, points: 4.0, letter: "A" },
        { min: 80, points: 3.0, letter: "B" },
        { min: 70, points: 2.0, letter: "C" },
        { min: 60, points: 1.0, letter: "D" },
        { min: 0, points: 0.0, letter: "F" },
      ],
    },
  };

  BC.defaults = {
    version: 3,
    enabled: true,
    activeProfile: "default",
    firstRun: true,

    dashboard: {
      enabled: true,
      autoHideConcluded: true,
      layout: "grid",              // grid | list | masonry | compact
      cardSize: "m",               // s | m | l
      cardRadius: 8,               // 0-24
      hoverLift: true,
      showInlineGrade: false,
      showProgressBar: false,
      showBadges: false,           // unread announcements / due count / ungraded
      showSparkline: false,
      hoverPreview: false,
      courseSearch: true,
      semesterProgress: true,      // "Week 9 of 15" term progress bar
      groupBy: "none",             // none | term | custom | status
      customGroups: [],            // [{id, name, courseIds:[]}]
      pinned: [],                  // course ids
      courseOrder: [],
      widgets: {
        todo: true,
        comingUp: true,
        recentFeedback: true,
        gpa: false,
        streak: false,
        weekly: false,
        announcements: false,
        calendar: false,
      },
      hideSidebar: false,
      courses: {},                 // per-course: {hidden, nickname, color, bgImage, bgGradient, note}
    },

    todo: {
      mode: "default",             // default | clean | custom
      view: "list",                // list | day | week | kanban | timeblock
      rangeDays: 7,                // 3 | 7 | 14 | 30 | custom
      showCompleted: false,
      accent: "",
      allowNewTask: true,
      groupBy: "day",              // day | course | priority | tag | none
      ring: true,                  // weekly progress ring
      streaks: {
        enabled: true,
        graceDays: 2,
        repairsAvailable: 3,       // per month
      },
      pomodoro: {
        enabled: true,
        workMin: 25,
        shortBreakMin: 5,
        longBreakMin: 15,
        longEvery: 4,
        sound: true,
      },
      recurring: [],               // [{id, title, courseId, rule, at, until}]
      tags: [],                    // user-defined tag names
      local: {                     // local-only augmentation of tasks
        priorities: {},            // {itemKey: 1|2|3}
        tagsByItem: {},            // {itemKey: [tag]}
        notes: {},                 // {itemKey: text}
        stars: {},                 // {itemKey: bool}
        snoozed: {},               // {itemKey: iso}
        subtasks: {},              // {itemKey: [{text, done}]}
        estimates: {},             // {itemKey: minutes}
        links: {},                 // {itemKey: url}
        status: {},                // {itemKey: "doing"} — kanban middle column
        scheduled: {},             // {itemKey: {ymd, start: "HH:MM", dur: minutes}}
        recurringDone: {},         // {ruleId: {ymd: true}}
      },
    },

    theming: {
      darkMode: "off",
      darkSchedule: { start: "20:00", end: "07:00" },
      darkTone: "neutral",         // neutral | slate | black | nord | dracula | solarized
      darkBg: "",
      lightPreset: "default",      // default | rose | forest | ocean | sand | solarized
      accentColor: "",
      perCourseAccent: {},         // {courseId: "#rrggbb"}
      font: "",
      fontSizeScale: "m",          // xs|s|m|l|xl
      lineHeight: 1.5,
      letterSpacing: 0,            // px
      density: "default",          // compact | default | spacious | cozy
      radius: 8,                   // global corner radius
      cursor: "default",           // default | large | precise
      focusRing: "default",        // default | bold | high-contrast
      colorBlind: "off",           // off | protanopia | deuteranopia | tritanopia
      highContrast: false,
      reducedMotion: false,        // force reduced motion even if OS doesn't
      animSpeed: 1.0,              // 0.5-2.0 multiplier
      roundedUI: true,
      sidebarWidth: 0,             // 0 = default; else px
      logo: { mode: "default", url: "", text: "" }, // default | hide | replace | text
      perPage: { grades: "", inbox: "" },  // accent override per page
      rotation: { enabled: false, mode: "daily", themeIds: [] }, // auto theme cycling
    },

    navigation: {
      global: { hidden: [], order: [], customLinks: [] },
      course: { hidden: [], order: [], customLinks: [] },
      breadcrumbs: "default",      // default | compact | hidden
      courseTabs: false,           // pinned quick-switch bar
      quickSearch: true,           // ⌘K palette shortcut
      recentPages: true,
    },

    cosmetics: {
      background: {
        mode: "none",              // none | color | gradient | image | pattern
        color: "#0b1220",
        gradient: { from: "#1e3a8a", to: "#0b1220", angle: 135 },
        image: "",
        pattern: "none",           // none | dots | grid | diagonal | topography
        blur: 0,
        opacity: 100,
      },
      customCss: "",
      cssTemplates: [],            // user's saved CSS snippets [{name, css}]
    },

    grades: {
      gpaScale: "standard-4",
      customScale: [],             // [{min, points, letter}]
      creditsByCourse: {},
      whatIfEnabled: true,
      autoRefresh: false,
      autoRefreshMin: 5,
      rubricPredictor: true,
      goals: {},                   // {courseId: {target: number, notify: bool}}
      showTrendChart: true,
      showImpactSim: true,
      showWeightDonut: true,
      showMissingWarning: true,
    },

    notifications: {
      enabled: false,              // browser notifications (permission-gated)
      inPage: true,                // toasts for due-soon etc.
      leadMinutes: [60, 240, 1440], // 1h, 4h, 1d
      types: {
        dueSoon: true,
        newGrade: true,
        newAnnouncement: true,
        goalBreach: true,
        streakAtRisk: true,
      },
      perCourse: {},               // {courseId: {dueSoon, newGrade, ...}}
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
      badgeCount: true,
      history: [],                 // {iso, type, title, url}
    },

    files: {
      enabled: false,
      starred: [],                 // file ids
      recent: [],                  // last 20 accessed
      library: { enabled: false }, // opt-in cross-course listing
    },

    announcements: {
      aggregator: false,
      unreadBadge: true,
      digestDay: 1,                // 0=Sun..6=Sat, 1=Monday
    },

    calendar: {
      icsExport: true,
      miniOnDashboard: false,
      events: [],                  // personal events
      timeBlock: false,
      syllabusExtract: true,       // offer to add syllabus dates to planner
    },

    previews: {
      hoverAssignmentCards: true,
    },

    modules: {
      progressBars: true,
    },

    discussions: {
      collapse: true,
      jumpToUnread: true,
      wordCount: true,
      instructorHighlight: true,
    },

    productivity: {
      focusMode: false,
      readingRuler: false,
      stickyNotes: true,           // enable feature; notes stored below
      highlights: true,
      autoSaveDrafts: true,
      quizDraftSaver: true,
      wordCount: true,
      printFriendly: true,
      copyUrlButton: true,
      readingProgress: true,
      studyLog: {},                // {courseId: totalMinutes}
    },

    accessibility: {
      tts: true,                   // show TTS buttons on text
      largeTargets: false,
      dyslexiaFont: false,
    },

    instructor: {
      rosterExport: true,
      bulkGradeHelpers: true,
      attendanceQuick: true,
    },

    shortcuts: {
      enabled: true,
      vimMode: false,
      bindings: {
        commandPalette: "Mod+K",
        settings: "Mod+Shift+S",
        toggleDark: "Mod+Shift+D",
        quickTask: "Mod+Shift+T",
        quickNote: "Mod+Shift+N",
        gotoDashboard: "g d",
        gotoGrades: "g g",
        gotoInbox: "g i",
        gotoCalendar: "g c",
        focusMode: "Mod+Shift+F",
      },
    },

    customThemes: [],              // saved theme snapshots [{id, name, settings}]

    insights: {
      enabled: true,               // local study-time tracking
    },

    onboarding: {
      seen: false,
      lastWhatsNewVersion: "",
    },

    privacy: { telemetry: false },  // hard-wired
  };

  BC.cloneDefaults = function () {
    return JSON.parse(JSON.stringify(BC.defaults));
  };

  BC.mergeDefaults = function (stored, carry) {
    const base = BC.cloneDefaults();
    if (!stored || typeof stored !== "object") return base;
    const merge = (target, src) => {
      for (const k of Object.keys(src)) {
        const sv = src[k];
        if (Array.isArray(sv)) target[k] = sv;
        else if (sv && typeof sv === "object")
          target[k] = merge(target[k] && typeof target[k] === "object" ? target[k] : {}, sv);
        else if (sv !== undefined) target[k] = sv;
      }
      return target;
    };
    const merged = merge(base, stored);
    return BC.migrate(merged, carry);
  };

  BC.SETTINGS_VERSION = 3;

  // Each entry upgrades settings from (v-1) to v. `carry` collects data that
  // must move to the bcLocal store — storage.load() persists it there.
  BC.MIGRATIONS = {
    3(s, carry) {
      const gh = s.grades && s.grades.gradeHistory;
      if (gh && typeof gh === "object" && Object.keys(gh).length) carry.gradeHistory = gh;
      if (s.grades) delete s.grades.gradeHistory;
    },
  };

  BC.migrate = function (s, carry) {
    carry = carry || {};
    let v = s.version >= 2 ? s.version : 2;
    while (v < BC.SETTINGS_VERSION) {
      v += 1;
      const fn = BC.MIGRATIONS[v];
      if (fn) fn(s, carry);
    }
    s.version = BC.SETTINGS_VERSION;
    return s;
  };
})();
