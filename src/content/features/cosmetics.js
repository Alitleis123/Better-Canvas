/* Better Canvas — full-page background + custom CSS. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};
  let motionObserver = null;
  const motionNodes = new Set();
  function stopMotion() {
    if (motionObserver) motionObserver.disconnect();
    motionObserver = null;
    for (const node of motionNodes) node.removeAttribute("data-bc-motion-visible");
    motionNodes.clear();
  }
  function observeMotion(enabled) {
    if (!enabled || typeof IntersectionObserver !== "function") { stopMotion(); return; }
    if (!motionObserver) motionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.target.toggleAttribute("data-bc-motion-visible", entry.isIntersecting);
    });
    for (const node of motionNodes) if (!node.isConnected) { motionObserver.unobserve(node); motionNodes.delete(node); }
    for (const node of document.querySelectorAll(".ic-DashboardCard__header_image")) if (!motionNodes.has(node)) {
      motionNodes.add(node); motionObserver.observe(node);
    }
  }

  const PATTERNS = {
    none: "",
    // Mode-aware ink: black-on-black meant the pattern was invisible over any dark
    // custom background.
    dots: `background-image: radial-gradient(var(--bc-pattern-ink, rgba(0,0,0,.08)) 1px, transparent 1px); background-size: 12px 12px;`,
    grid: `background-image: linear-gradient(var(--bc-pattern-ink, rgba(0,0,0,.05)) 1px, transparent 1px), linear-gradient(90deg, var(--bc-pattern-ink, rgba(0,0,0,.05)) 1px, transparent 1px); background-size: 24px 24px;`,
    diagonal: `background: repeating-linear-gradient(45deg, var(--bc-pattern-ink, rgba(0,0,0,.03)) 0 10px, transparent 10px 20px);`,
    // A data URI can't read --bc-pattern-ink. Mid-grey shows on light and dark pages.
    topography: `background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='%23808080' stroke-opacity='.12' stroke-width='1'><path d='M0 60 Q30 30 60 60 T120 60'/><path d='M0 40 Q30 10 60 40 T120 40'/><path d='M0 80 Q30 50 60 80 T120 80'/></g></svg>");`,
  };

  function bgCSS(cfg, settings) {
    if (!cfg || cfg.mode === "none") return "";
    const blur = Math.max(0, Math.min(40, cfg.blur | 0));
    const opacity = Math.max(0, Math.min(100, cfg.opacity | 0)) / 100;
    let layer = "";
    if (cfg.mode === "color") layer = `background: ${BC.util.cssSafe(cfg.color)};`;
    else if (cfg.mode === "image" && BC.util.isSafeUrl(cfg.image)) {
      const scene = BC.themeScenes && BC.themeScenes[settings.theming.experience];
      const fallback = scene && /^https?:/i.test(cfg.image) ? `, url("${BC.util.cssUrl(BC.sceneArt(scene.id, 731, true).url)}") center/cover no-repeat` : "";
      layer = BC.themeMedia && BC.themeMedia.parse(cfg.image) ? BC.themeMedia.style(cfg.image, true) : `background: url("${BC.util.cssUrl(cfg.image)}") center/cover no-repeat${fallback};`;
    } else if (cfg.mode === "gradient") {
      layer = `background: linear-gradient(${cfg.gradient.angle|0}deg, ${BC.util.cssSafe(cfg.gradient.from)} 0%, ${BC.util.cssSafe(cfg.gradient.to)} 100%);`;
    } else if (cfg.mode === "pattern") {
      layer = `background: ${BC.util.cssSafe(cfg.color || "#f6f7fb")}; ${PATTERNS[cfg.pattern || "none"] || ""}`;
    }
    // The html.bc-dark variants matter: theming paints these same containers with
    // `html.bc-dark #main { background: … !important }`, which outranks a bare
    // `#main` on specificity, so in dark mode the layer sat hidden behind them.
    return `#bc-bg-layer {
      position: fixed; inset: 0; z-index: -1; pointer-events: none;
      ${layer}
      filter: blur(${blur}px);
      opacity: ${opacity};
    }
    html body { isolation: isolate; }
    html body, html #wrapper, html #main, html .ic-app-main-content, html .ic-Layout-columns, html .ic-Layout-contentMain,
    html.bc-dark:root body, html.bc-dark body #wrapper, html.bc-dark body #main,
    html.bc-dark body .ic-app-main-content, html.bc-dark body .ic-Layout-columns, html.bc-dark body .ic-Layout-contentMain { background-color: transparent !important; }
    `;
  }

  function experienceCSS(settings) {
    const scene = BC.themeScenes && BC.themeScenes[settings.theming.experience];
    if (!scene) return "";
    const dark = BC.isDarkActive(settings), t = settings.theming;
    const s = 'html:root[data-bc-experience]';
    const radius = Math.max(0, Math.min(32, Number(t.radius) || 0));
    const editorial = ["paper", "dunes", "gallery"].includes(scene.id);
    const contrast = t.highContrast;
    const logoMode = (t.logo && t.logo.mode) || "default";
    return `
      ${s} { --bc-scene-panel: color-mix(in srgb, var(--bc-surface-2) ${contrast ? 100 : 94}%, transparent);
        --bc-scene-line: color-mix(in srgb, var(--bc-accent) 25%, var(--bc-border));
        --bc-scene-shadow: 0 12px 40px ${dark ? "#0004" : "#30241620"};
        --ic-brand-font-color-dark: var(--bc-text); --ic-link-color: var(--bc-link); }
      ${s} #bc-bg-layer::before { content: ""; position: absolute; inset: 0;
        background: linear-gradient(110deg, color-mix(in srgb, var(--bc-surface-1) 35%, transparent), transparent 60%, color-mix(in srgb, var(--bc-surface-1) 15%, transparent)); }
      ${s} body { color: var(--bc-text) !important; }
      ${s} .ic-app-header { background: color-mix(in srgb, var(--bc-surface-1) 92%, transparent) !important;
        border-right: 1px solid var(--bc-scene-line); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
        --ic-brand-global-nav-bgd: transparent; --ic-brand-global-nav-logo-bgd: transparent; --ic-brand-global-nav-menu-item__text-color: var(--bc-text);
        --ic-brand-global-nav-ic-icon-svg-fill: var(--bc-accent); }
      ${logoMode === "default" ? `${s} .ic-app-header__logomark-container { background: transparent !important; }
      /* The school's logo, drawn in the accent through its own shape. A missing
         image variable falls back to a clear mask, never a solid block. */
      ${s} .ic-app-header__logomark { background: var(--bc-accent) !important;
        -webkit-mask: var(--ic-brand-header-image, linear-gradient(transparent, transparent)) center / contain no-repeat;
        mask: var(--ic-brand-header-image, linear-gradient(transparent, transparent)) center / contain no-repeat; }` : ""}
      ${s} .ic-app-header__menu-list-item > a { margin: 3px 7px; border-radius: ${Math.min(radius, 12)}px; color: var(--bc-text) !important; }
      ${s} .ic-app-header__menu-list-item svg { fill: var(--bc-accent) !important; }
      ${s} .ic-app-header__menu-list-link .menu-item__text { color: var(--bc-text) !important; }
      ${s} .ic-app-header__menu-list-item.ic-app-header__menu-list-item--active > a,
      ${s} .ic-app-header__menu-list-item > a:hover { background: var(--bc-accent-weak) !important; box-shadow: inset 3px 0 var(--bc-accent); }
      ${s} .ic-Dashboard-header__layout { background: var(--bc-scene-panel) !important; padding: 24px !important; margin: 4px 0 24px;
        border: 1px solid var(--bc-scene-line) !important; border-radius: ${radius}px; box-shadow: var(--bc-scene-shadow) !important; }
      ${s} .ic-Dashboard-header__title { color: var(--bc-text) !important; font-size: clamp(28px, 3vw, 42px); letter-spacing: -.045em; font-weight: ${editorial ? 400 : 650}; }
      ${editorial ? `${s} :is(h1,h2,.ic-Dashboard-header__title) { font-family: Georgia, "Times New Roman", serif; }` : ""}
      ${s} .ic-DashboardCard { background: var(--bc-scene-panel) !important; border: 1px solid var(--bc-scene-line) !important;
        border-radius: ${radius}px !important; box-shadow: var(--bc-scene-shadow) !important; }
      ${s} .ic-DashboardCard__header_content, ${s} .ic-DashboardCard__action-container { background: transparent !important; }
      ${s} .ic-DashboardCard__header-title { color: var(--bc-text) !important; }
      ${s} .ic-DashboardCard__header-subtitle, ${s} .ic-DashboardCard__header-term, ${s} .ic-DashboardCard__action { color: var(--bc-muted) !important; }
      ${s} .ic-DashboardCard__header_content { padding: 18px 20px !important; }
      ${s} .ic-DashboardCard__action-container { border-top: 1px solid var(--bc-scene-line); }
      ${!["list", "compact"].includes(settings.dashboard.layout) ? `${s} .ic-DashboardCard__header_image, ${s} .ic-DashboardCard__header > .ic-DashboardCard__header_hero { min-height: 154px; }` : ""}
      ${s} #right-side > :is(div,section):not(:empty), ${s} #right-side .pl, ${s} #right-side .recent_feedback,
      ${s} #left-side, ${s} .header-bar, ${s} .ic-app-nav-toggle-and-crumbs { background: var(--bc-scene-panel) !important;
        border: 1px solid var(--bc-scene-line); border-radius: ${radius}px; padding: 18px; box-shadow: var(--bc-scene-shadow); color: var(--bc-text); }
      ${s} #right-side :is(h2,h3,h4) { color: var(--bc-text) !important; }
      ${s} body:not(:has(#DashboardCard_Container)) #content { background: var(--bc-scene-panel) !important;
        border: 1px solid var(--bc-scene-line); border-radius: ${radius}px; padding: 24px; }
      ${s} #right-side > :is(div,section):not(:empty) { margin-bottom: 18px; }
      ${s} #course_show_secondary, ${s} #section-tabs { background: transparent !important; }
      ${s} #section-tabs a { color: var(--bc-text) !important; border-radius: ${Math.min(radius, 10)}px; }
      ${s} #section-tabs a.active { background: var(--bc-accent-weak) !important; color: var(--bc-accent-text) !important; }
      @media(max-width: 600px) { ${s} .ic-Dashboard-header__layout { padding: 16px !important; } }
    `;
  }

  function ensureLayer() {
    return BC.injector.ensureNode("bc-bg", document.body || document.documentElement, () => {
      const d = document.createElement("div");
      d.id = "bc-bg-layer";
      return d;
    });
  }

  // A background can be limited to one mode: a dark one picked for dark mode left
  // Canvas's dark text sitting on near-black in light mode.
  function showsNow(bg, settings) {
    if (!bg || bg.mode === "none") return false;
    if (bg.when === "dark") return BC.isDarkActive(settings);
    if (bg.when === "light") return !BC.isDarkActive(settings);
    return true;
  }

  function apply(settings) {
    const cos = settings.cosmetics || {};
    const experience = BC.themeScenes && BC.themeScenes[settings.theming.experience] ? settings.theming.experience : "";
    const root = document.documentElement;
    if (experience) { if (root.getAttribute("data-bc-experience") !== experience) root.setAttribute("data-bc-experience", experience); }
    else if (root.hasAttribute("data-bc-experience")) root.removeAttribute("data-bc-experience");
    if (showsNow(cos.background, settings)) {
      ensureLayer();
      BC.injector.setStyle("bc-bg", bgCSS(cos.background, settings));
    } else {
      BC.injector.setStyle("bc-bg", "");
      BC.injector.removeNode("bc-bg");
    }
    BC.injector.setStyle("bc-custom-css", cos.customCss || "");
    const moving = !!BC.themeMotionCSS && !settings.theming.reducedMotion && ["rain", "stars", "fireflies", "petals"].includes(cos.motion);
    observeMotion(moving);
    BC.injector.setStyle("bc-experience", experienceCSS(settings) + (moving ? BC.themeMotionCSS(cos.motion, "#bc-bg-layer, .ic-DashboardCard__header_image") + `
      .ic-DashboardCard__header_image::after { animation-play-state:paused; }
      .ic-DashboardCard__header_image[data-bc-motion-visible]::after { animation-play-state:running; }
    ` : ""));
  }

  BC.registry.register({ id: "cosmetics", styles: ["bc-bg", "bc-custom-css", "bc-experience"], nodes: ["bc-bg"], apply,
    unmount() { stopMotion(); document.documentElement.removeAttribute("data-bc-experience"); } });
})();
