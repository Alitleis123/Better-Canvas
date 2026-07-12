/* Better Canvas — built-in theme presets (light + dark). */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  BC.DARK_TONES = {
    neutral:  { bg: "#1a1d24", label: "Neutral" },
    slate:    { bg: "#1c2130", label: "Slate (cool)" },
    black:    { bg: "#0d0f14", label: "Midnight" },
    nord:     { bg: "#2e3440", label: "Nord" },
    dracula:  { bg: "#282a36", label: "Dracula" },
    solarized:{ bg: "#002b36", label: "Solarized Dark" },
  };

  BC.LIGHT_PRESETS = {
    default:   { bg: "#f6f7fb", accent: "",        label: "Default" },
    rose:      { bg: "#fdf2f7", accent: "#c2185b", label: "Rose" },
    forest:    { bg: "#f0f7ee", accent: "#2e7d32", label: "Forest" },
    ocean:     { bg: "#eff7fb", accent: "#0277bd", label: "Ocean" },
    sand:      { bg: "#fbf6ee", accent: "#a15c1b", label: "Sand" },
    solarized: { bg: "#fdf6e3", accent: "#268bd2", label: "Solarized Light" },
  };

  // Preset theme snapshots (shareable via JSON export/import).
  BC.PRESET_THEMES = [
    {
      id: "bc-default",
      name: "Better Canvas Default",
      settings: {
        theming: { darkMode: "off", darkTone: "neutral", lightPreset: "default", accentColor: "", radius: 8, density: "default" },
      },
    },
    {
      id: "midnight",
      name: "Midnight",
      settings: {
        theming: { darkMode: "on", darkTone: "black", accentColor: "#6366f1", radius: 10, density: "default" },
      },
    },
    {
      id: "nord",
      name: "Nord",
      settings: {
        theming: { darkMode: "on", darkTone: "nord", accentColor: "#88c0d0", radius: 8, density: "default" },
      },
    },
    {
      id: "dracula",
      name: "Dracula",
      settings: {
        theming: { darkMode: "on", darkTone: "dracula", accentColor: "#bd93f9", radius: 12, density: "default" },
      },
    },
    {
      id: "solarized-dark",
      name: "Solarized Dark",
      settings: {
        theming: { darkMode: "on", darkTone: "solarized", accentColor: "#268bd2", radius: 6, density: "default" },
      },
    },
    {
      id: "rose",
      name: "Rose",
      settings: {
        theming: { darkMode: "off", lightPreset: "rose", accentColor: "#c2185b", radius: 12, density: "default" },
      },
    },
    {
      id: "forest",
      name: "Forest",
      settings: {
        theming: { darkMode: "off", lightPreset: "forest", accentColor: "#2e7d32", radius: 10, density: "default" },
      },
    },
    {
      id: "ocean",
      name: "Ocean",
      settings: {
        theming: { darkMode: "off", lightPreset: "ocean", accentColor: "#0277bd", radius: 10, density: "default" },
      },
    },
    {
      id: "sand",
      name: "Sand",
      settings: {
        theming: { darkMode: "off", lightPreset: "sand", accentColor: "#a15c1b", radius: 8, density: "default" },
      },
    },
    {
      id: "high-contrast",
      name: "High Contrast",
      settings: {
        theming: { darkMode: "on", darkTone: "black", accentColor: "#ffcc00", highContrast: true, focusRing: "bold", radius: 4 },
      },
    },
    {
      id: "focus",
      name: "Focus",
      settings: {
        theming: { darkMode: "auto", accentColor: "", radius: 6, density: "compact", reducedMotion: true },
        dashboard: { hoverLift: false, showBadges: false },
      },
    },
    {
      id: "cozy",
      name: "Cozy",
      settings: {
        theming: { darkMode: "off", lightPreset: "sand", accentColor: "#b45309", radius: 16, density: "spacious", lineHeight: 1.7 },
      },
    },
  ];

  // isDarkActive — canonical source of truth used by every surface.
  BC.isDarkActive = function (settings) {
    if (!settings || !settings.theming) return false;
    const mode = settings.theming.darkMode;
    if (mode === "on") return true;
    if (mode === "off") return false;
    if (mode === "auto") {
      try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
      catch (_) { return false; }
    }
    if (mode === "scheduled") {
      const sc = settings.theming.darkSchedule || {};
      return BC.dt ? BC.dt.withinSchedule(sc.start, sc.end) : false;
    }
    return false;
  };
})();
