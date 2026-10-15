/* Better Canvas — full-page background + custom CSS. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const PATTERNS = {
    none: "",
    // Mode-aware ink: black-on-black meant the pattern was invisible over any dark
    // custom background.
    dots: `background-image: radial-gradient(var(--bc-pattern-ink, rgba(0,0,0,.08)) 1px, transparent 1px); background-size: 12px 12px;`,
    grid: `background-image: linear-gradient(var(--bc-pattern-ink, rgba(0,0,0,.05)) 1px, transparent 1px), linear-gradient(90deg, var(--bc-pattern-ink, rgba(0,0,0,.05)) 1px, transparent 1px); background-size: 24px 24px;`,
    diagonal: `background: repeating-linear-gradient(45deg, var(--bc-pattern-ink, rgba(0,0,0,.03)) 0 10px, transparent 10px 20px);`,
    topography: `background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='%23000' stroke-opacity='.05' stroke-width='1'><path d='M0 60 Q30 30 60 60 T120 60'/><path d='M0 40 Q30 10 60 40 T120 40'/><path d='M0 80 Q30 50 60 80 T120 80'/></g></svg>");`,
  };

  function bgCSS(cfg) {
    if (!cfg || cfg.mode === "none") return "";
    const blur = Math.max(0, Math.min(40, cfg.blur | 0));
    const opacity = Math.max(0, Math.min(100, cfg.opacity | 0)) / 100;
    let layer = "";
    if (cfg.mode === "color") layer = `background: ${BC.util.cssSafe(cfg.color)};`;
    else if (cfg.mode === "image" && BC.util.isSafeUrl(cfg.image)) {
      layer = `background: url("${BC.util.cssUrl(cfg.image)}") center/cover no-repeat;`;
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
    html body, html #wrapper, html #main, html .ic-app-main-content, html .ic-Layout-columns,
    html.bc-dark:root body, html.bc-dark body #wrapper, html.bc-dark body #main,
    html.bc-dark body .ic-app-main-content, html.bc-dark body .ic-Layout-columns { background-color: transparent !important; }
    html.bc-dark #bc-bg-layer { mix-blend-mode: multiply; }
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
    if (showsNow(cos.background, settings)) {
      ensureLayer();
      BC.injector.setStyle("bc-bg", bgCSS(cos.background));
    } else {
      BC.injector.setStyle("bc-bg", "");
      BC.injector.removeNode("bc-bg");
    }
    BC.injector.setStyle("bc-custom-css", cos.customCss || "");
  }

  BC.registry.register({ id: "cosmetics", styles: ["bc-bg", "bc-custom-css"], nodes: ["bc-bg"], apply });
})();
