/*
 * Better Canvas — default settings schema.
 * Single source of truth. Loaded as a classic script by every surface
 * (content scripts, options page) and attaches to globalThis.BC.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  BC.VERSION = "3.1.0";
  BC.SETTINGS_KEY = "bcSettings";
  BC.LOCAL_KEY = "bcLocal";

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
    version: 6,
    enabled: true,

    dashboard: {
      enabled: true,
      autoHideConcluded: true,
      layout: "grid",              // grid | list | masonry | compact
      cardSize: "m",               // s | m | l
      // Cards per row, at most. 0 lifts the cap and lets the grid fill the
      // window. This is the control that makes a 15", a 24" and a 27" render the
      // same dashboard: above the cap the layout depends on your course count
      // rather than on which monitor you happen to be sitting at.
      maxColumns: 5,               // 0 = fill the window, else 3-12
      cardRadius: 8,               // 0-24
      hoverLift: true,
      showInlineGrade: false,
      showProgressBar: false,
      showBadges: false,           // due-count badge on each card
      showSparkline: false,        // grade trend sparkline from local history
      courseSearch: true,          // filter box above the card grid
      semesterProgress: true,      // "Week 9 of 15" term progress bar
      pinned: [],                  // course ids — read by the course quick-switch bar
      courseOrder: [],
      widgets: {
        todo: true,
        comingUp: true,
        recentFeedback: true,
        gpa: false,
      },
      hideSidebar: false,
      courses: {},                 // per-course: {hidden, nickname, color, bgImage, bgGradient, note}
    },

    todo: {
      mode: "default",             // default | clean | custom
      view: "list",                // list | kanban | timeblock
      layout: "comfortable",       // comfortable | compact | cards | minimal | timeline
      rangeDays: 7,                // 3 | 7 | 14 | 30 | custom
      showCompleted: false,
      accent: "",
      allowNewTask: true,
      groupBy: "day",              // day | course | priority | tag | none
      // Was a `ring` boolean. One indicator suits one person: a ring is a poor
      // fit in a 280px sidebar at large font scales, and some people just want a
      // line. See MIGRATIONS[6].
      progress: "ring",            // off | ring | bar | segments | rainbow | text
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
      // Per-task augmentation (stars, snoozes, subtasks, kanban status, …) lives in
      // bcLocal.todo, NOT here. Every one of those is written on a micro-interaction,
      // and a bcSettings write re-applies all ~24 features and blows away the open
      // settings drawer's DOM. See MIGRATIONS[4].
    },

    theming: {
      darkMode: "off",
      darkSchedule: { start: "20:00", end: "07:00" },
      darkTone: "neutral",         // neutral | slate | black | nord | dracula | solarized
      darkBg: "",
      lightPreset: "default",      // default | rose | forest | ocean | sand | solarized
      accentColor: "",
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
      rotation: { enabled: false, mode: "daily", themeIds: [] }, // auto theme cycling
      skin: "",                    // id from BC.SKIN_CATALOG or theming.skins; "" = none
      skins: [],                   // imported skin objects, BC.skins.normalize shape
    },

    navigation: {
      global: { hidden: [], order: [], customLinks: [] },
      course: { hidden: [], order: [], customLinks: [] },
      breadcrumbs: "default",      // default | compact | hidden
      courseTabs: false,           // pinned quick-switch bar
      quickSearch: true,           // ⌘K palette shortcut
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
    },

    grades: {
      gpaScale: "standard-4",
      creditsByCourse: {},
      panelEnabled: true,          // show the Grade Tools panel (was mislabelled whatIfEnabled)
      autoRefresh: false,
      autoRefreshMin: 5,
      rubricPredictor: true,
      goals: {},                   // {courseId: {target: number, notify: bool}}
      showTrendChart: true,
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
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
      badgeCount: true,
      // Toast history lives in bcLocal.notifHistory — it's written from the notify
      // path, and a bcSettings write there re-applies every feature.
    },

    files: {
      enabled: false,
      starred: [],                 // file ids
    },

    announcements: {
      aggregator: false,
    },

    calendar: {
      miniOnDashboard: false,
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
      stickyNotes: true,           // enable feature; notes stored in bcLocal
      autoSaveDrafts: true,
      quizDraftSaver: true,
      wordCount: true,
      printFriendly: true,
      copyUrlButton: true,
      readingProgress: true,
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

  BC.SETTINGS_VERSION = 6;

  // Each entry upgrades settings from (v-1) to v. `carry` collects data that
  // must move to the bcLocal store — storage.load() persists it there.
  //
  // Removing a key from BC.defaults is NOT enough to remove it from an existing
  // user: mergeDefaults() iterates the STORED object, so an orphaned key survives
  // every load, gets re-saved, and keeps showing up in exported JSON. Only an
  // explicit delete here actually cleans it up.
  BC.MIGRATIONS = {
    3(s, carry) {
      const gh = s.grades && s.grades.gradeHistory;
      if (gh && typeof gh === "object" && Object.keys(gh).length) carry.gradeHistory = gh;
      if (s.grades) delete s.grades.gradeHistory;
    },

    4(s, carry) {
      carry.local = carry.local || {};

      // --- moves to bcLocal (render-path writes must not touch bcSettings) ---
      if (s.todo && s.todo.local && Object.keys(s.todo.local).length) carry.local.todo = s.todo.local;
      if (s.todo) delete s.todo.local;
      if (s.notifications && Array.isArray(s.notifications.history) && s.notifications.history.length) {
        carry.local.notifHistory = s.notifications.history;
      }
      if (s.notifications) delete s.notifications.history;

      // --- rename: the flag always gated the whole panel, it was just mislabelled ---
      // Assign unconditionally. Migrations run AFTER defaults are merged in, so
      // panelEnabled is already sitting at its default here — guarding on
      // "panelEnabled === undefined" would never fire and would silently re-enable
      // the panel for anyone who had turned it off. The version gate already
      // guarantees this runs at most once.
      if (s.grades) {
        if (s.grades.whatIfEnabled !== undefined) s.grades.panelEnabled = s.grades.whatIfEnabled;
        delete s.grades.whatIfEnabled;
        delete s.grades.customScale;
        delete s.grades.showImpactSim;
      }

      // --- removals: settings that were wired to UI but had no implementation ---
      if (s.dashboard) {
        delete s.dashboard.groupBy;
        delete s.dashboard.customGroups;
        delete s.dashboard.hoverPreview;
        if (s.dashboard.widgets) {
          delete s.dashboard.widgets.streak;       // duplicated the planner streak chip
          delete s.dashboard.widgets.weekly;       // duplicated todo.ring
          delete s.dashboard.widgets.announcements; // duplicated announcements.aggregator
          delete s.dashboard.widgets.calendar;     // duplicated calendar.miniOnDashboard
        }
      }
      if (s.theming) { delete s.theming.perCourseAccent; delete s.theming.perPage; }
      if (s.navigation) delete s.navigation.recentPages;
      if (s.cosmetics) delete s.cosmetics.cssTemplates;
      if (s.notifications) delete s.notifications.perCourse;
      if (s.files) { delete s.files.recent; delete s.files.library; }
      if (s.announcements) { delete s.announcements.unreadBadge; delete s.announcements.digestDay; }
      if (s.calendar) { delete s.calendar.events; delete s.calendar.timeBlock; }
      if (s.productivity) { delete s.productivity.highlights; delete s.productivity.studyLog; }
      if (s.shortcuts) delete s.shortcuts.vimMode;

      // Sanitize a stored value whose options no longer exist.
      if (s.todo && ["list", "kanban", "timeblock"].indexOf(s.todo.view) === -1) s.todo.view = "list";
    },

    5(s) {
      // Vestigial: BC.PROFILES_KEY and a "profiles" feature never existed, so
      // activeProfile was written on every save and exported in every backup
      // while nothing ever read it.
      delete s.activeProfile;
      // The .ics export button is unconditional and always has been, so a toggle
      // gating nothing was just a dead switch in the Calendar tab.
      if (s.calendar) delete s.calendar.icsExport;
      // Write-only flags: both were set when the tour was dismissed and then
      // never read by anything. onboarding.seen is the real gate.
      delete s.firstRun;
      if (s.onboarding) delete s.onboarding.lastWhatsNewVersion;
    },

    6(s) {
      // todo.ring (boolean) became todo.progress (a style). Read the old flag
      // before the default wins: someone who had turned the ring off wanted no
      // indicator, not the new default one.
      if (s.todo) {
        if (s.todo.ring !== undefined) s.todo.progress = s.todo.ring ? "ring" : "off";
        delete s.todo.ring;
        const STYLES = ["off", "ring", "bar", "segments", "rainbow", "text"];
        if (STYLES.indexOf(s.todo.progress) === -1) s.todo.progress = "ring";
      }
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
