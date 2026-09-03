/*
 * Better Canvas — theming.
 * Emits CSS variables and rules for dark mode, light presets, accent color,
 * font, density, radius, focus ring, color-blind mode, reduced motion.
 * All feature CSS references these vars so re-tinting is one style swap.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const FONT_SCALE = { xs: 0.85, s: 0.92, m: 1.0, l: 1.08, xl: 1.18 };
  const DENSITY_PAD = { compact: 0.6, default: 1.0, spacious: 1.4, cozy: 1.7 };

  // Our own UI must be exempt from the generic element rules below. Those rules
  // exist to darken Canvas's inputs and buttons, but they match by TAG, so they
  // also hit every button and input the extension itself renders -- the Print and
  // Copy URL actions came out as generic dark chips instead of accent buttons,
  // and their own styling could not win against an !important tag rule.
  const NOT_OURS = ':not([data-bc-node]):not([data-bc-node] *)' +
                   ':not([class^="bc-"]):not([class*=" bc-"])';

  const staticCSS = `
    html.bc-dark, html.bc-dark body { background-color: var(--bc-d-bg) !important; color: var(--bc-d-text) !important; }
    html.bc-dark #wrapper, html.bc-dark #main, html.bc-dark #content,
    html.bc-dark .ic-app-main-content, html.bc-dark .ic-Layout-columns,
    html.bc-dark .ic-app-course-menu, html.bc-dark #left-side, html.bc-dark #right-side {
      background-color: var(--bc-d-bg) !important; color: var(--bc-d-text) !important;
    }
    html.bc-dark .recent_feedback, html.bc-dark .events_list,
    html.bc-dark .todo-list-header-container, html.bc-dark .events_list_header,
    html.bc-dark .header-secondary,
    html.bc-dark .Sidebar__TodoListContainer, html.bc-dark .ToDoSidebar,
    html.bc-dark .PlannerApp, html.bc-dark .planner-day, html.bc-dark .planner-empty-state,
    html.bc-dark .ic-DashboardCard, html.bc-dark .ic-DashboardCard__box, html.bc-dark .ic-DashboardCard__link,
    html.bc-dark .ic-notification, html.bc-dark .Announcement, html.bc-dark .discussion-topic,
    html.bc-dark .ic-Table-content-wrapper, html.bc-dark .roster,
    html.bc-dark table:not(.user_content *), html.bc-dark thead:not(.user_content *),
    html.bc-dark tbody:not(.user_content *), html.bc-dark tr:not(.user_content *),
    html.bc-dark th:not(.user_content *), html.bc-dark td:not(.user_content *),
    html.bc-dark .header-bar, html.bc-dark .navbar, html.bc-dark .assignments-list,
    html.bc-dark .files-page, html.bc-dark #modules, html.bc-dark .context_module,
    html.bc-dark .ic-app-course-nav, html.bc-dark #course_show_secondary {
      background-color: var(--bc-d-bg2) !important; color: var(--bc-d-text) !important;
      border-color: var(--bc-d-border) !important;
    }
    html.bc-dark a${NOT_OURS} { color: var(--bc-d-link) !important; }
    html.bc-dark input${NOT_OURS}, html.bc-dark select${NOT_OURS},
    html.bc-dark textarea${NOT_OURS}, html.bc-dark button${NOT_OURS} {
      background-color: var(--bc-d-bg3) !important; color: var(--bc-d-text) !important;
      border-color: var(--bc-d-border) !important;
    }
    html.bc-dark .ui-widget-content, html.bc-dark .ic-Form-control input,
    html.bc-dark .ui-dialog, html.bc-dark .modal-body, html.bc-dark [role=dialog] {
      background-color: var(--bc-d-bg2) !important; color: var(--bc-d-text) !important;
    }
    html.bc-dark hr, html.bc-dark .border-bottom, html.bc-dark .border-top {
      border-color: var(--bc-d-border) !important;
    }
    html.bc-dark .ic-DashboardCard__header { background-color: var(--bc-d-bg3) !important; color: var(--bc-d-text) !important; }
    html.bc-dark .ic-app-course-nav-toggle { background-color: var(--bc-d-bg2) !important; color: var(--bc-d-text) !important; }
    /* Colour only, so every selector here must sit INSIDE a surface darkened
       above. .recent_feedback used to be in this list without being darkened
       anywhere, which put near-white text on Canvas's white panel; it is now a
       surface in its own right. The course colour block is not listed either:
       it is a fill chosen by the user, and forcing our light ink onto it ignores
       whatever contrast that colour actually has. */
    html.bc-dark .Sidebar__TodoListContainer h2 { color: var(--bc-d-text) !important; }
    /* The global nav shell got a dark background but no text colour, so anything
       inside it that Canvas gives an explicit dark colour stayed dark on dark. */
    html.bc-dark .ic-app-header { background-color: var(--bc-d-bg2) !important; color: var(--bc-d-text) !important; }
    html.bc-dark .ic-app-header__menu-list-item a { color: var(--bc-d-text) !important; }
    html.bc-dark img[src*="branded"] { filter: brightness(1.1); }

    /* Generic fallback for pages we don't explicitly cover */
    html.bc-dark .box-content, html.bc-dark .content-box, html.bc-dark .ui-widget,
    html.bc-dark .well, html.bc-dark .alert, html.bc-dark .ic-Card, html.bc-dark .card,
    html.bc-dark .form-actions, html.bc-dark .page-toolbar, html.bc-dark .ig-row,
    html.bc-dark .ig-header, html.bc-dark .item-group-condensed {
      background-color: var(--bc-d-bg2) !important; color: var(--bc-d-text) !important;
      border-color: var(--bc-d-border) !important;
    }

    /* Background is set from an allowlist, but the colour above is inherited by the
       whole document. Any Canvas surface the allowlist misses therefore keeps its
       own LIGHT background and inherits our near-white text, which is why such a
       surface goes blank rather than merely unstyled. The dashboard header was
       the most visible case: the "Dashboard" title was white on white.

       These use class-substring matching rather than exact names because Canvas
       renames these containers between releases, and an exact-match list silently
       stops covering them. Kept to structural chrome (headers, toolbars, page
       shells) so it cannot repaint course content.

       Substring matching has to be chosen carefully: [class*="ic-Dashboard"]
       combined with [class*="header"] also matches ic-DashboardCard__header_image,
       which is the course card's own artwork. Match the dashboard header by its
       own names instead. */
    html.bc-dark [class*="Dashboard-header" i],
    html.bc-dark [class*="dashboard_header" i],
    html.bc-dark #dashboard_header_container,
    html.bc-dark [class*="PageHeader" i],
    html.bc-dark [class*="ic-Action-header" i],
    html.bc-dark [class*="Toolbar" i],
    html.bc-dark [class*="page-title" i],
    html.bc-dark .header-bar-right, html.bc-dark .ic-Dashboard-header__layout,
    html.bc-dark .ic-Dashboard-header__title, html.bc-dark .ic-Dashboard-header__actions {
      background-color: var(--bc-d-bg) !important; color: var(--bc-d-text) !important;
      border-color: var(--bc-d-border) !important;
    }
    /* Headings inside those shells inherit rather than set their own colour. */
    html.bc-dark [class*="Dashboard-header" i] h1, html.bc-dark [class*="Dashboard-header" i] h2,
    html.bc-dark #dashboard_header_container h1, html.bc-dark #dashboard_header_container h2 {
      color: var(--bc-d-text) !important;
    }
    html.bc-dark [style*="background-color: rgb(255, 255, 255)"],
    html.bc-dark [style*="background: rgb(255, 255, 255)"],
    html.bc-dark [style*="background-color:#fff" i] {
      background-color: var(--bc-d-bg2) !important; color: var(--bc-d-text) !important;
    }

    /* Accent variable — Canvas reads --ic-brand-primary in many places */
    :root[data-bc-accent] { --ic-brand-primary: var(--bc-accent) !important; }
    :root[data-bc-accent] .btn-primary, :root[data-bc-accent] .Button--primary {
      background-color: var(--bc-accent) !important; border-color: var(--bc-accent) !important;
    }

    /* Density */
    :root[data-bc-density="compact"]  { --bc-density: 0.6; }
    :root[data-bc-density="spacious"] { --bc-density: 1.4; }
    :root[data-bc-density="cozy"]     { --bc-density: 1.7; }

    /* Global radius */
    :root[data-bc-radius] .ic-DashboardCard, :root[data-bc-radius] .ic-DashboardCard__box,
    :root[data-bc-radius] .btn, :root[data-bc-radius] input, :root[data-bc-radius] select,
    :root[data-bc-radius] .Button, :root[data-bc-radius] .card, :root[data-bc-radius] .panel {
      border-radius: var(--bc-radius) !important;
    }

    /* Focus ring */
    :root[data-bc-focus="bold"] *:focus-visible { outline: 3px solid var(--bc-accent, #4f46e5) !important; outline-offset: 2px; }
    :root[data-bc-focus="high-contrast"] *:focus-visible { outline: 3px solid #ffeb3b !important; outline-offset: 2px; box-shadow: 0 0 0 4px #000 !important; }

    /* Cursor */
    :root[data-bc-cursor="large"] { cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><polygon points='0,0 0,28 8,20 12,28 16,26 12,18 22,18' fill='black' stroke='white' stroke-width='2'/></svg>") 0 0, auto !important; }
    :root[data-bc-cursor="precise"], :root[data-bc-cursor="precise"] * { cursor: crosshair !important; }

    /* High contrast */
    :root[data-bc-hc="1"] * { text-shadow: none !important; }
    :root[data-bc-hc="1"] { filter: contrast(1.15); }

    /* Reduced motion */
    :root[data-bc-motion="0"] *, :root[data-bc-motion="0"] *::before, :root[data-bc-motion="0"] *::after {
      animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important;
    }

    /* Authored prose (a discussion post, an assignment description) is normally
       transparent, so it sits on the container we darkened above. Canvas
       declares its own dark ink on these roots, and a declaration always beats
       an inherited value, so without this the text stays dark on our dark
       surface. We do NOT darken their background: where the author painted one,
       the sweep marks it data-bc-paper below and hands the ink back. */
    html.bc-dark .user_content, html.bc-dark .show-content,
    html.bc-dark .description, html.bc-dark .assignment-description,
    html.bc-dark .discussion-topic-body {
      color: var(--bc-d-text) !important;
    }

    /* An authored box that paints its own background owns that box entirely, so
       it gets legible ink for ITS colour rather than ours. --bc-text-inverse is
       the ink for a surface running against the current mode, which in dark mode
       is exactly this case: a light box inside a dark page. Placed after the
       rule above so it wins on the element the author actually painted. */
    html.bc-dark [data-bc-paper] { color: var(--bc-text-inverse, #16181d) !important; }

    /* Canvas picks its greys for a white page. On our dark surfaces they land
       wherever they land, and a declaration beats the inherited colour we set on
       the container, so they survive at whatever contrast results. Re-mapped to
       our muted token, which is derived to clear AA against the actual surface.
       Muted rather than full-strength text because a grey was a deliberate
       de-emphasis worth preserving. */
    html.bc-dark [data-bc-dim] { color: var(--bc-d-muted) !important; }

    /* Surfaces the selector list above missed, found by measuring their computed
       background. Only the background is set: their text already inherits our
       light colour, which is what was unreadable on them. */
    html.bc-dark [data-bc-lit] {
      background-color: var(--bc-d-bg2) !important;
      border-color: var(--bc-d-border) !important;
    }

    /* Rounded UI off */
    :root[data-bc-rounded="0"] .ic-DashboardCard, :root[data-bc-rounded="0"] .btn, :root[data-bc-rounded="0"] input,
    :root[data-bc-rounded="0"] select, :root[data-bc-rounded="0"] .Button { border-radius: 0 !important; }
  `;

  // The mode-independent half never changes, so build it once rather than
  // reassembling a multi-KB string on every observer tick.
  let staticCssCache = null;
  function staticSheet() {
    if (staticCssCache == null) staticCssCache = staticCSS + "\n" + BC.tokens.staticCss();
    return staticCssCache;
  }

  // Memoized against a signature of every input that affects the output.
  let lastSig = null;
  let lastCss = "";

  function buildCss(settings) {
    const t = settings.theming;
    const fontSize = FONT_SCALE[t.fontSizeScale || "m"] || 1;
    const lineHeight = t.lineHeight || 1.5;
    const letter = t.letterSpacing || 0;
    const density = DENSITY_PAD[t.density] || 1;

    // cssSafe only strips <>, which is not enough for a value interpolated into a
    // declaration — a stack of `Inter; } html{display:none} .x {` would escape it.
    const font = BC.tokens.safeFontStack(t.font);
    const fontRule = font
      ? `:root, html body, .ic-app { font-family: ${font} !important; }
         :root { --bc-font-sans: ${font}; }`
      : "";

    // The !important root font-size is for Canvas's own text; the custom
    // properties are what let OUR components scale predictably alongside it.
    const scaleRule = `:root, html body {
      font-size: calc(14px * ${fontSize}) !important;
      line-height: ${lineHeight} !important;
      letter-spacing: ${letter}px !important;
    }
    :root {
      --bc-font-scale: ${fontSize};
      --bc-line-height: ${lineHeight};
      --bc-letter-spacing: ${letter}px;
    }`;
    const densityRule = `:root { --bc-density: ${density}; }`;
    const radiusRule  = `:root { --bc-radius: ${t.radius|0}px; }`;

    // Light preset page background (skipped when a custom cosmetic background is active).
    const lp = (BC.LIGHT_PRESETS || {})[t.lightPreset];
    const cosmeticBg = settings.cosmetics && settings.cosmetics.background && settings.cosmetics.background.mode !== "none";
    const lightBgRule = (lp && t.lightPreset !== "default" && !cosmeticBg)
      ? `html:not(.bc-dark) body, html:not(.bc-dark) .ic-Layout-contentMain { background-color: ${lp.bg} !important; }`
      : "";

    let logoRule = "";
    if (t.logo && t.logo.mode === "hide") {
      logoRule = ".ic-app-header__logomark, .ic-app-header__logomark-container { display: none !important; }";
    } else if (t.logo && t.logo.mode === "replace" && BC.util.isSafeUrl(t.logo.url)) {
      logoRule = `.ic-app-header__logomark, .ic-app-header__logomark-container { background-image: url("${BC.util.cssSafe(t.logo.url)}") !important; background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important; content: "" !important; }
      .ic-app-header__logomark img, .ic-app-header__logomark-container img { visibility: hidden !important; }`;
    }

    // Dyslexia font override
    const dyslexiaRule = (settings.accessibility && settings.accessibility.dyslexiaFont)
      ? `:root, html body, .ic-app, .ic-DashboardCard, .ic-Sidebar { font-family: "Comic Sans MS", "OpenDyslexic", Verdana, sans-serif !important; letter-spacing: 0.03em !important; }`
      : "";

    // Large targets
    const largeTargets = (settings.accessibility && settings.accessibility.largeTargets)
      ? `button, .btn, .Button, a[role=button], input[type=checkbox], input[type=radio] { min-height: 40px !important; min-width: 40px !important; }`
      : "";

    return BC.tokens.css(t) + "\n" + scaleRule + "\n" + densityRule + "\n" + radiusRule + "\n" +
           lightBgRule + "\n" + fontRule + "\n" + logoRule + "\n" + dyslexiaRule + "\n" + largeTargets + "\n" +
           `.bc-logo-text { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color: var(--bc-text); font-weight:700; font-size: var(--bc-text-sm); letter-spacing:.03em; }`;
  }

  // ---- light-surface sweep -------------------------------------------------
  //
  // Dark mode sets a text colour on the whole document but backgrounds from a
  // list of selectors. Colour inherits; background does not. So any Canvas
  // surface the list misses keeps its LIGHT background, inherits our near-white
  // text, and renders blank rather than merely unstyled.
  //
  // No selector list can be complete against an app we do not control and that
  // renames its containers between releases, and CSS cannot ask what an
  // element's computed background actually is. This is the one place a JS pass
  // is worth its cost: it runs once per page rather than on the ~5x/second apply
  // tick, is capped, and only ever looks at structural chrome.
  const LIT = "data-bc-lit";
  // Authored content is never repainted, but an authored box that paints its own
  // light background still needs ink that works ON that background, because the
  // rule above hands authored prose our light colour.
  const PAPER = "data-bc-paper";
  // Text whose own colour is too faint against the background it ends up on.
  const DIM = "data-bc-dim";

  // Block-level containers only. Deliberately excludes span/a/button and the
  // like: a light chip or badge sets its own text colour, so it is already
  // readable, and repainting it would destroy a deliberate accent.
  // Two different tag sets, because the two passes want different things.
  //
  // SURFACE: block containers only. An inline element's background is a chip or
  // a highlight, and repainting it would destroy a deliberate accent.
  const SURFACE_TAGS = "div,section,header,footer,nav,aside,main,article,form,fieldset," +
                       "table,thead,tbody,tfoot,tr,td,th,ul,ol,li,dl,dd,dt," +
                       // Authored prose reaches for these, and a blockquote or a
                       // code block routinely carries its own light background.
                       "blockquote,pre,figure,figcaption,details,summary";
  // TEXT: anything that can hold a run of text. Canvas wraps most labels in a
  // span, so a block-only walk never saw the text that most needed checking --
  // every dashboard card title sits in one.
  const TEXT_TAGS = SURFACE_TAGS + ",span,a,b,strong,em,i,small,label,p,h1,h2,h3,h4,h5,h6,caption,figcaption,time,code";
  const SWEEP_TAGS = TEXT_TAGS;

  // Two different protections, previously conflated.
  //
  // AUTHORED: prose somebody wrote. Neither its background nor its ink is ours
  // to change; a light box inside it gets PAPER so its own ink stays legible.
  const AUTHORED_SCOPES = ".user_content,.show-content,.description,.assignment-description," +
                          ".discussion-topic-body,.mce-content-body,.ProseMirror,.bc-note";
  // A dashboard card needs NO scope exclusion at all. What has to survive there
  // is the course artwork and the course colour, and isSweepable already
  // protects both by measuring them: it skips anything carrying a background
  // image, and anything whose fill is saturated rather than neutral.
  //
  // Excluding the whole .ic-DashboardCard subtree instead was too blunt. It also
  // shielded the card's white body, which is plain neutral chrome, so every card
  // kept a white panel under its header in dark mode.
  const CONTENT_SCOPES = AUTHORED_SCOPES;

  // Above this distance from grey a background is a deliberate colour rather
  // than chrome. A pale course colour or a status chip can be light enough to
  // look like a panel by luminance alone; repainting it would erase the very
  // thing it encodes.
  const NEUTRAL_MAX_CHROMA = 24;

  const SWEEP_MAX = 800;
  // Above this luminance a surface is "light". 0.5 sits between Canvas's greys
  // and its white panels, well clear of any dark tone we emit.
  const LIGHT_CUTOFF = 0.5;

  // The decision, separated from the DOM walk so tests can apply exactly this
  // rule to a described page rather than reimplementing it and drifting.
  function isSweepable(backgroundColor, backgroundImage) {
    // A background image is somebody's deliberate art direction.
    if (backgroundImage && backgroundImage !== "none") return false;
    const lum = BC.color.cssLuminance(backgroundColor);
    if (lum == null || lum < LIGHT_CUTOFF) return false;   // transparent or already dark
    // Only neutral surfaces are chrome. A saturated fill is meaning.
    if (BC.color.chroma(backgroundColor) > NEUTRAL_MAX_CHROMA) return false;
    return true;
  }

  // Our own UI and authored course content are off limits whatever their colour.
  const SWEEP_EXCLUDE = "[data-bc-node],[data-better-canvas]," + CONTENT_SCOPES;

  // Text a user has to read must be the element's OWN, not a descendant's:
  // marking a container would push a colour onto everything inside it.
  function hasOwnText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }

  // The background actually behind an element: the nearest ancestor painting an
  // opaque one. Memoised across the pass, since siblings share ancestors and
  // this would otherwise be the most expensive part of the sweep.
  function backgroundBehind(el, memo) {
    const chain = [];
    for (let n = el; n; n = n.parentElement) {
      if (memo.has(n)) { const hit = memo.get(n); for (const c of chain) memo.set(c, hit); return hit; }
      chain.push(n);
      let c;
      try { c = getComputedStyle(n).backgroundColor; } catch (_) { break; }
      const parsed = BC.color.parseCssColor(c);
      if (parsed && parsed.a >= 0.5) { for (const x of chain) memo.set(x, c); return c; }
    }
    for (const c of chain) memo.set(c, null);
    return null;
  }

  const MIN_TEXT_CONTRAST = 4.5;
  const SURFACE_TAG_SET = new Set(SURFACE_TAGS.split(",").map((t) => t.trim().toUpperCase()));

  function sweepLightSurfaces() {
    if (!document.body || !document.documentElement.classList.contains("bc-dark")) return 0;
    const scope = document.getElementById("application") || document.body;
    const bgMemo = new WeakMap();
    let marked = 0, seen = 0;
    for (const el of scope.querySelectorAll(SWEEP_TAGS)) {
      if (++seen > SWEEP_MAX) break;
      if (el.hasAttribute(LIT) || el.hasAttribute(PAPER)) continue;
      // Our own UI is skipped unconditionally. Checking it only in the
      // non-authored branch meant one of our panels rendered inside authored
      // content fell through to the paper branch and got marked.
      if (el.closest("[data-bc-node],[data-better-canvas]")) continue;
      const authored = el.closest(AUTHORED_SCOPES);
      let cs;
      try { cs = getComputedStyle(el); } catch (_) { continue; }
      if (!cs) continue;
      const lum = BC.color.cssLuminance(cs.backgroundColor);
      if (authored) {
        // Not repainted; just marked so its ink can suit its own background.
        if (lum != null && lum >= LIGHT_CUTOFF && !el.hasAttribute(PAPER)) {
          el.setAttribute(PAPER, "");
          marked++;
        }
        continue;
      }
      const isSurfaceTag = SURFACE_TAG_SET.has(el.tagName);
      if (isSurfaceTag && isSweepable(cs.backgroundColor, cs.backgroundImage)) {
        el.setAttribute(LIT, "");
        marked++;
        continue;
      }
      // Not a surface to repaint, but it may still be carrying text Canvas
      // coloured for a white page.
      if (el.hasAttribute(DIM) || !hasOwnText(el)) continue;
      const behind = backgroundBehind(el, bgMemo);
      if (!behind) continue;
      const fg = BC.color.parseCssColor(cs.color);
      if (!fg || fg.a < 0.5) continue;
      const fgHex = BC.color.rgbToHex(fg.r, fg.g, fg.b);
      const bgParsed = BC.color.parseCssColor(behind);
      if (!bgParsed) continue;
      const bgHex = BC.color.rgbToHex(bgParsed.r, bgParsed.g, bgParsed.b);
      if (BC.color.contrastRatio(fgHex, bgHex) >= MIN_TEXT_CONTRAST) continue;
      el.setAttribute(DIM, "");
      marked++;
    }
    return marked;
  }

  function clearLightSweep() {
    for (const el of document.querySelectorAll("[" + LIT + "]")) el.removeAttribute(LIT);
    for (const el of document.querySelectorAll("[" + PAPER + "]")) el.removeAttribute(PAPER);
    for (const el of document.querySelectorAll("[" + DIM + "]")) el.removeAttribute(DIM);
  }

  // Canvas renders progressively and re-renders as the user works, so a fixed
  // number of passes per page always misses something. Throttling instead means
  // the sweep piggybacks on a signal that already exists: apply() only runs when
  // the observer saw a real DOM change, so this is "at most once every few
  // seconds, and only when the page actually changed" rather than a poll. The
  // leading edge covers first paint and the trailing edge covers whatever
  // mounted during the window.
  const SWEEP_INTERVAL = 2500;
  const throttledSweep = BC.util.throttle(
    () => BC.util.guard(sweepLightSurfaces, "theming:sweep"), SWEEP_INTERVAL);

  // Imperative root state. Cheap, but every write is guarded: an unguarded
  // classList or attribute write re-serializes the attribute even when the value
  // is unchanged, which is both a style invalidation and an observer self-trigger,
  // ~5x/second forever.
  function applyRootState(settings) {
    const t = settings.theming;
    const doc = document.documentElement;
    const active = BC.isDarkActive(settings);
    if (doc.classList.contains("bc-dark") !== active) doc.classList.toggle("bc-dark", active);

    const lp = (BC.LIGHT_PRESETS || {})[t.lightPreset];
    const attr = (k, v) => { if (doc.getAttribute(k) !== v) doc.setAttribute(k, v); };
    const wantAccent = !!(BC.color.normalizeHex(t.accentColor) || (lp && lp.accent));
    if (doc.hasAttribute("data-bc-accent") !== wantAccent) doc.toggleAttribute("data-bc-accent", wantAccent);
    attr("data-bc-density", t.density || "default");
    attr("data-bc-radius", String(t.radius | 0));
    attr("data-bc-focus", t.focusRing || "default");
    attr("data-bc-cursor", t.cursor || "default");
    attr("data-bc-hc", t.highContrast ? "1" : "0");
    attr("data-bc-motion", (t.reducedMotion || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) ? "0" : "1");
    attr("data-bc-rounded", t.roundedUI ? "1" : "0");

    const filter = (t.colorBlind && t.colorBlind !== "off") ? BC.color.colorBlindFilter(t.colorBlind) : "";
    if (doc.style.filter !== filter) doc.style.filter = filter;

    // Clamped: the durations are calc(Nms / speed), so a corrupted import setting
    // this to 0 would produce division by zero across every animation.
    const speed = String(BC.util.clamp(Number(t.animSpeed) || 1, 0.25, 4));
    if (doc.style.getPropertyValue("--bc-anim-speed") !== speed) doc.style.setProperty("--bc-anim-speed", speed);

    const sw = (t.sidebarWidth && t.sidebarWidth > 0) ? t.sidebarWidth + "px" : "";
    if (doc.style.getPropertyValue("--bc-sidebar-w") !== sw) {
      if (sw) doc.style.setProperty("--bc-sidebar-w", sw);
      else doc.style.removeProperty("--bc-sidebar-w");
    }

    // Text-mode logo replacement is a real node, so it can't live in a stylesheet.
    const existing = document.getElementById("bc-logo-text");
    if (t.logo && t.logo.mode === "text" && t.logo.text) {
      const label = String(t.logo.text).slice(0, 24);
      if (!existing) {
        const holder = document.querySelector(".ic-app-header__logomark, .ic-app-header__logomark-container");
        if (holder) {
          const s = document.createElement("span");
          s.id = "bc-logo-text";
          s.className = "bc-logo-text";
          s.setAttribute("data-bc-node", "bc-logo-text");
          s.textContent = label;
          holder.style.position = "relative";
          holder.appendChild(s);
        }
      } else if (existing.textContent !== label) {
        existing.textContent = label;
      }
    } else if (existing) {
      existing.remove();
    }
  }

  function apply(settings, ctx) {
    const t = settings.theming;
    const a = settings.accessibility || {};
    const cos = (settings.cosmetics && settings.cosmetics.background && settings.cosmetics.background.mode) || "";

    BC.injector.setStyle("bc-static", staticSheet());

    const sig = BC.tokens.signature(t) + "|" + (a.dyslexiaFont ? 1 : 0) + (a.largeTargets ? 1 : 0) + "|" + cos;
    if (sig !== lastSig) { lastSig = sig; lastCss = buildCss(settings); }
    BC.injector.setStyle("bc-theming", lastCss);

    applyRootState(settings);

    // Only meaningful in dark mode; clear the marks the moment it is turned off
    // so nothing stays painted dark on a light page.
    if (document.documentElement.classList.contains("bc-dark")) throttledSweep();
    else clearLightSweep();
  }

  // Exported so the sweep's selection rules can be tested without a browser.
  // Exposed so tests measure the sheet that actually ships. Reading the source
  // text instead meant an interpolated constant stayed literal in the test, and
  // the test then measured a selector that matches nothing.
  BC.theming = Object.assign(BC.theming || {}, {
    staticSheet, rawStaticCss: () => staticCSS,
    sweepLightSurfaces, clearLightSweep, isSweepable,
    LIT, PAPER, DIM, SWEEP_TAGS, SURFACE_TAGS, TEXT_TAGS, SWEEP_EXCLUDE, CONTENT_SCOPES,
    AUTHORED_SCOPES, LIGHT_CUTOFF,
    hasOwnText, backgroundBehind, MIN_TEXT_CONTRAST,
  });

  BC.registry.register({
    id: "theming", styles: ["bc-static", "bc-theming"], nodes: ["bc-logo-text"], apply,
    // Teardown removes our stylesheets, so the memo has to be invalidated or a
    // re-enable would skip rebuilding them. (The root-level inline state is cleared
    // centrally in content.js's teardown.)
    unmount() { lastSig = null; clearLightSweep(); },
  });
})();
