/*
 * Better Canvas — theming feature.
 * Dark mode (off/on/auto/scheduled), accent color (via Canvas --ic-brand vars),
 * custom font, density, and institution logo hide/replace.
 *
 * apply() is idempotent and cheap: it only swaps style text and toggles one
 * class on <html>, so the observer can call it as often as it likes.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};
  const U = BC.util;

  function timeInWindow(now, start, end) {
    // start/end are "HH:MM"; window may wrap past midnight.
    const toMin = (s) => {
      const [h, m] = String(s).split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const cur = now.getHours() * 60 + now.getMinutes();
    const s = toMin(start);
    const e = toMin(end);
    return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
  }

  function isDarkActive(t) {
    switch (t.darkMode) {
      case "on":
        return true;
      case "off":
        return false;
      case "auto":
        return (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        );
      case "scheduled":
        return timeInWindow(
          new Date(),
          t.darkSchedule.start,
          t.darkSchedule.end
        );
      default:
        return false;
    }
  }

  // Dark palettes. Each maps to the --bc-d-* variables consumed by DARK_CSS, so
  // the whole dark theme is re-tinted by swapping one small block of vars.
  const DARK_TONES = {
    neutral: { bg: "#1a1a1d", surface: "#232327", header: "#141416", border: "#33333a",
      input: "#141416", alt: "#202024", text: "#e6e6ea", faint: "#9a9aa6", link: "#9d8dff" },
    slate: { bg: "#0f1419", surface: "#161b22", header: "#0a0d12", border: "#2b313a",
      input: "#0b0e13", alt: "#11161d", text: "#dfe3e8", faint: "#8b949e", link: "#6cb6ff" },
    black: { bg: "#000000", surface: "#0e0e11", header: "#000000", border: "#26262b",
      input: "#0a0a0c", alt: "#0d0d10", text: "#ededf0", faint: "#8a8a92", link: "#9d8dff" },
  };

  // Build the variable block for the active tone. A valid custom background hex
  // overrides the tone and derives surrounding shades from it via color-mix.
  function darkVars(t) {
    const tone = DARK_TONES[t.darkTone] || DARK_TONES.neutral;
    let v = tone;
    if (t.darkBg && U.hexToRgb(t.darkBg)) {
      const c = U.cssSafe(t.darkBg);
      v = {
        bg: c,
        surface: `color-mix(in srgb, ${c}, #ffffff 7%)`,
        header: `color-mix(in srgb, ${c}, #000000 35%)`,
        border: `color-mix(in srgb, ${c}, #ffffff 16%)`,
        input: `color-mix(in srgb, ${c}, #000000 28%)`,
        alt: `color-mix(in srgb, ${c}, #ffffff 4%)`,
        text: tone.text, faint: tone.faint, link: tone.link,
      };
    }
    return `html.bc-dark {
  --bc-d-bg:${v.bg}; --bc-d-surface:${v.surface}; --bc-d-header:${v.header};
  --bc-d-border:${v.border}; --bc-d-input:${v.input}; --bc-d-alt:${v.alt};
  --bc-d-text:${v.text}; --bc-d-faint:${v.faint}; --bc-d-link:${v.link};
}\n`;
  }

  const DARK_CSS = `
html.bc-dark, html.bc-dark body { background-color:var(--bc-d-bg) !important; color:var(--bc-d-text) !important; }
html.bc-dark #application, html.bc-dark #wrapper, html.bc-dark #main,
html.bc-dark #content, html.bc-dark .ic-Layout-contentMain,
html.bc-dark .ic-app-main-content { background-color:var(--bc-d-bg) !important; color:var(--bc-d-text) !important; }
html.bc-dark #left-side, html.bc-dark #right-side, html.bc-dark .ic-app-course-menu,
html.bc-dark .right-side-wrapper, html.bc-dark .Sidebar__TodoListContainer {
  background-color:var(--bc-d-surface) !important; color:var(--bc-d-text) !important; border-color:var(--bc-d-border) !important; }
html.bc-dark .ic-app-header { background-color:var(--bc-d-header) !important; }
html.bc-dark .ic-DashboardCard, html.bc-dark .Card, html.bc-dark .content-box,
html.bc-dark .ic-Dashboard-header, html.bc-dark .ig-row, html.bc-dark .context_module,
html.bc-dark .ui-widget-content, html.bc-dark .ui-dialog,
html.bc-dark [data-testid="DashboardCard"] {
  background-color:var(--bc-d-surface) !important; color:var(--bc-d-text) !important; border-color:var(--bc-d-border) !important; }
html.bc-dark .ic-DashboardCard__action-container { background-color:transparent !important; }
html.bc-dark a, html.bc-dark a:visited { color:var(--bc-d-link); }
html.bc-dark h1, html.bc-dark h2, html.bc-dark h3, html.bc-dark h4,
html.bc-dark h5, html.bc-dark .ic-Dashboard-header__title,
html.bc-dark label, html.bc-dark legend, html.bc-dark span, html.bc-dark p,
html.bc-dark td, html.bc-dark th, html.bc-dark li, html.bc-dark dd, html.bc-dark dt {
  color:var(--bc-d-text); }
html.bc-dark input, html.bc-dark textarea, html.bc-dark select,
html.bc-dark .ic-Input {
  background-color:var(--bc-d-input) !important; color:var(--bc-d-text) !important; border-color:var(--bc-d-border) !important; }
html.bc-dark table, html.bc-dark tr, html.bc-dark td, html.bc-dark th {
  background-color:transparent !important; border-color:var(--bc-d-border) !important; }
html.bc-dark tr:nth-child(even), html.bc-dark .slick-row.even { background-color:var(--bc-d-alt) !important; }
html.bc-dark .ui-widget-header, html.bc-dark .pad-box, html.bc-dark .border,
html.bc-dark .ic-Table--hover-row tr:hover td { background-color:var(--bc-d-alt) !important; }
html.bc-dark hr { border-color:var(--bc-d-border) !important; }
html.bc-dark .btn, html.bc-dark .Button:not(.Button--primary) {
  background-color:var(--bc-d-alt) !important; color:var(--bc-d-text) !important; border-color:var(--bc-d-border) !important; }
html.bc-dark img.bc-keep-light { filter:none !important; }
html.bc-dark svg:not([class*="brand"]) { color:inherit; }
html.bc-dark ::placeholder { color:var(--bc-d-faint) !important; }
`;

  BC.features.theming = {
    id: "theming",
    isDarkActive,

    apply(settings) {
      const t = settings.theming;
      const root = document.documentElement;

      // Dark mode -----------------------------------------------------------
      const dark = isDarkActive(t);
      root.classList.toggle("bc-dark", dark);
      BC.injector.setStyle("bc-dark", dark ? darkVars(t) + DARK_CSS : "");

      // Accent color (Canvas brand variables) -------------------------------
      let varsCss = "";
      if (t.accentColor && U.hexToRgb(t.accentColor)) {
        const a = U.cssSafe(t.accentColor);
        varsCss += `:root, html body {
  --ic-brand-primary:${a} !important;
  --ic-link-color:${a} !important;
  --ic-brand-button--primary-bgd:${a} !important;
  --ic-brand-button--primary-bgd-darkened-5:${a} !important;
  --ic-brand-global-nav-bgd:${a} !important;
  --ic-brand-global-nav-ic-icon-svg-fill:#ffffff !important;
}\n`;
      }

      // Font ----------------------------------------------------------------
      if (t.font) {
        const f = U.cssSafe(t.font);
        varsCss += `html body, html body .ic-app, html body button,
html body input, html body textarea, html body select,
html body .ic-Dashboard-header__title { font-family:${f} !important; }\n`;
      }

      // Density -------------------------------------------------------------
      if (t.density === "compact") {
        varsCss += `
.ic-app-header__menu-list-item { margin:0 !important; }
.ic-app-header__menu-list-link { padding:0.35rem 0 !important; }
#section-tabs li { line-height:1.1 !important; }
#section-tabs li a { padding:0.2rem 8px !important; }
.ig-row { padding-top:4px !important; padding-bottom:4px !important; }
.ic-Dashboard-header { padding-top:8px !important; padding-bottom:8px !important; }
.content-box { padding:8px 0 !important; }`;
      } else if (t.density === "spacious") {
        varsCss += `
#section-tabs li a { padding:0.6rem 8px !important; }
.ig-row { padding-top:14px !important; padding-bottom:14px !important; }`;
      }

      // Institution logo ----------------------------------------------------
      if (t.logo.mode === "hide") {
        varsCss += `.ic-app-header__logomark, .ic-brand-header-logo { display:none !important; }`;
      } else if (t.logo.mode === "replace" && U.isSafeUrl(t.logo.url)) {
        const url = U.cssSafe(t.logo.url);
        varsCss += `.ic-app-header__logomark, .ic-brand-header-logo {
  background-image:url("${url}") !important; background-size:contain !important;
  background-repeat:no-repeat !important; background-position:center !important; }
.ic-app-header__logomark img, .ic-brand-header-logo img { opacity:0 !important; }`;
      }

      BC.injector.setStyle("bc-theming", varsCss);
    },
  };
})();
