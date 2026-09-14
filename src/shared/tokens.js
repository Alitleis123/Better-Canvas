/*
 * Better Canvas — the single design-token emitter.
 *
 * This lives in shared/ because four separate documents need byte-identical
 * tokens: the Canvas page (via theming.js), the settings drawer's shadow root,
 * the standalone options page, and the toolbar popup. Only theming.js is a
 * content script, so the emitter cannot live there. Before this existed there
 * were four disconnected colour systems and three of them never saw the user's
 * theme at all.
 *
 * Pure: no DOM, no storage. Depends only on BC.color, BC.DARK_TONES and
 * BC.LIGHT_PRESETS.
 *
 * Design direction is "refined & Canvas-native": quiet borders, a single accent,
 * tabular figures, restraint. Panels at rest get a border and NO shadow;
 * elevation is reserved for things that genuinely float.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  // Text contrast floor (WCAG AA). Non-text (rings, bars, chart strokes) uses 3:1
  // per WCAG 1.4.11.
  const AA_TEXT = 4.5;
  const AA_NONTEXT = 3.0;

  // Used when a custom background makes settings text unreadable no matter how far
  // we push the foreground — e.g. darkBg #e8e8e8 yields ~1.05:1, reachable in two
  // clicks today.
  const SAFE_NEUTRAL = {
    light: { bg: "#f5f1ea", bg2: "#fffdf9", bg3: "#eee7dc", border: "#e3dacc", text: "#1d1a16", muted: "#6b6155" },
    dark:  { bg: "#141210", bg2: "#1c1a17", bg3: "#252119", border: "#332e27", text: "#f3ede4", muted: "#a49a8c" },
  };

  // Semantic fills. These differ from the values previously hardcoded around the
  // codebase because those failed AA: white on #ca8a04 is 2.6:1 and on #65a30d is
  // 2.9:1. Every light fill below clears 4.5:1 against white.
  const SEMANTIC = {
    light: {
      success: "#047857", "success-fg": "#ffffff", "success-bg": "#ecfdf5",
      warn:    "#a16207", "warn-fg":    "#ffffff", "warn-bg":    "#fffbeb",
      danger:  "#b91c1c", "danger-fg":  "#ffffff", "danger-bg":  "#fef2f2",
      info:    "#0369a1", "info-fg":    "#ffffff", "info-bg":    "#eff6ff",
    },
    dark: {
      success: "#34d399", "success-fg": "#05261c", "success-bg": "rgba(52,211,153,.14)",
      warn:    "#fbbf24", "warn-fg":    "#2b1f02", "warn-bg":    "rgba(251,191,36,.14)",
      danger:  "#f87171", "danger-fg":  "#2a0b0b", "danger-bg":  "rgba(248,113,113,.14)",
      info:    "#60a5fa", "info-fg":    "#0a1a2e", "info-bg":    "rgba(96,165,250,.14)",
    },
  };

  // Grade bands are categorical, not semantic — a C is not a "warning".
  const GRADE = {
    light: { a: "#047857", b: "#4d7c0f", c: "#a16207", d: "#c2410c", f: "#b91c1c" },
    dark:  { a: "#34d399", b: "#a3e635", c: "#fbbf24", d: "#fb923c", f: "#f87171" },
  };

  // Categorical chart ramp (weight donut, etc). Same hue order in both modes so a
  // legend stays stable across a mode switch.
  const CAT = {
    light: ["#4f46e5", "#0891b2", "#059669", "#a16207", "#c2410c", "#be185d", "#7c3aed", "#4d7c0f"],
    dark:  ["#8b85f0", "#3fc0dd", "#34d399", "#e0a82e", "#f97b4a", "#ec4899", "#a78bfa", "#a3e635"],
  };

  // Deliberately NOT theme-derived: sticky notes keep their paper metaphor. They
  // do need a dark variant though — they were a glaring white rectangle before.
  const NOTE = {
    light: { bg: "#fffbe6", border: "#f6d67a", text: "#1f1a05" },
    dark:  { bg: "#3a3421", border: "#5a4f2c", text: "#f0e6c8" },
  };

  const SHADOW = {
    light: {
      1: "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.06)",
      2: "0 2px 4px rgba(16,24,40,.05), 0 4px 12px rgba(16,24,40,.08)",
      3: "0 8px 16px rgba(16,24,40,.08), 0 16px 40px rgba(16,24,40,.12)",
      4: "0 12px 24px rgba(16,24,40,.10), 0 32px 72px rgba(16,24,40,.18)",
    },
    dark: {
      1: "0 1px 2px rgba(0,0,0,.40)",
      2: "0 2px 6px rgba(0,0,0,.45), 0 8px 20px rgba(0,0,0,.35)",
      3: "0 10px 24px rgba(0,0,0,.50), 0 24px 56px rgba(0,0,0,.42)",
      4: "0 16px 32px rgba(0,0,0,.55), 0 40px 96px rgba(0,0,0,.50)",
    },
  };

  // Resolve one mode's colour tokens, applying the readability guard.
  function resolveMode(pal, mode) {
    const C = BC.color;
    const guard = { textCorrected: false, surfaceFallback: false, hierarchyCollapsed: false };

    const S1 = pal.bg, S2 = pal.bg2, S3 = pal.bg3, border = pal.border;

    // Guard against EVERY surface the ink can land on, not just one. Body text
    // appears on the page background and inside panels; muted text appears on
    // panels and on cards. Guarding a single pairing leaves the others short (pure
    // mid-grey custom backgrounds landed at 4.1-4.3:1 that way). Each pass only
    // pushes further toward an endpoint and returns early once it passes, so for
    // every shipped theme — which already clears AA — this is a no-op.
    const guardOn = (fg, min, surfaces) => {
      let out = fg;
      for (const s of surfaces) out = C.ensureContrast(out, s, min);
      return out;
    };

    // Text guard.
    const text = guardOn(pal.text, AA_TEXT, [S2, S1, S3]);
    if (text !== pal.text) guard.textCorrected = true;

    // A custom "dark" background light enough that legible text has to be DARK has
    // defeated dark mode. Text stays readable either way, but the settings panel
    // would then be a near-white sheet while every other dark-mode surface expects
    // the opposite — so the settings surfaces (only) fall back to a neutral set and
    // the Appearance tab says why. Canvas pages keep the user's choice: they picked
    // it, and we don't own their reading of Canvas content.
    //
    // Note there is deliberately no "neither endpoint reaches AA" branch: white
    // clears 4.5:1 up to background luminance 0.183 and black from 0.175, so the
    // ranges overlap and every possible surface has a passing endpoint. Such a
    // branch would be unreachable.
    if (mode === "dark" && C.relLuminance(text) < 0.5) guard.surfaceFallback = true;

    // Guard muted, then keep it distinguishable from body text.
    //
    // Distinctness is separated INTO the surface and AWAY from it, in that order.
    // Mixing toward the surface is the prettier direction and is what a normal
    // theme takes, but it costs contrast, so the result has to be re-guarded --
    // and on a surface where text only just clears AA (a near-white custom
    // "dark" background pushes text to a mid grey) re-guarding drags the mix
    // straight back onto text and the two become indistinguishable.
    //
    // Stepping AWAY from the surface has the opposite property: it monotonically
    // increases contrast against every surface, so AA is preserved for free and
    // separation from text is always reachable. `separate` therefore tries the
    // toward-surface mix first and falls back to stepping outward.
    const MIN_SEPARATION = 1.3;
    const separate = (from, surfaces, towardMix) => {
      const pretty = guardOn(towardMix, AA_TEXT, surfaces);
      if (C.contrastRatio(pretty, from) >= MIN_SEPARATION) return pretty;
      // Whichever endpoint the primary surface is farther from is the direction
      // that gains contrast rather than losing it.
      const endpoint = C.contrastRatio("#000000", S2) >= C.contrastRatio("#ffffff", S2) ? "#000000" : "#ffffff";
      for (let i = 1; i <= 12; i++) {
        const out = C.mix(from, endpoint, i / 12 * 0.6);
        if (C.contrastRatio(out, from) >= MIN_SEPARATION) return guardOn(out, AA_TEXT, surfaces);
      }
      return pretty;
    };

    const mutedSurfaces = [S3, S2, S1];
    let muted = guardOn(pal.muted, AA_TEXT, mutedSurfaces);
    if (C.contrastRatio(muted, text) < MIN_SEPARATION) {
      muted = separate(text, mutedSurfaces, C.mix(text, S2, 0.35));
    }
    // A mid-luminance surface admits no type hierarchy at all: every ink that
    // clears 4.5:1 against it is crushed into a narrow band near one endpoint,
    // so body and muted text cannot be told apart no matter how they are
    // derived. AA still holds -- the text is readable -- but the hierarchy is
    // gone, and that is worth telling the user rather than shipping silently.
    guard.hierarchyCollapsed = C.contrastRatio(muted, text) < MIN_SEPARATION;
    const textSubtle = guardOn(C.mix(muted, S2, 0.28), AA_TEXT, [S3, S2]);

    // Accent family. The accent FILL is never altered — the user picked it. What
    // gets derived is everything that has to be legible against or on top of it.
    const accent = pal.accent;
    // Bounded by the accent itself: a mid-luminance accent can cap text-on-accent
    // below 4.5:1 no matter what, and the fix would be to change the fill — which
    // we've committed not to do. contrastText picks the better endpoint and
    // ensureContrast can only improve on it, so this is always the best achievable.
    const accentContrast = C.ensureContrast(C.contrastText(accent), accent, AA_TEXT);
    // Guarded against every surface, like text and muted are. Guarding only S2
    // left links failing on S3, which is where they most often sit: a dashboard
    // card body, a table cell, an inner panel. A card title came out at 3.93:1.
    const accentText = guardOn(accent, AA_TEXT, [S2, S3, S1]);
    const accentStroke = guardOn(accent, AA_NONTEXT, [S2, S3, S1]);
    const dark = mode === "dark";

    const t = {
      "surface-1": S1,
      "surface-2": S2,
      "surface-3": S3,
      "surface-4": dark ? "rgba(255,255,255,.055)" : "rgba(16,24,40,.045)",
      "surface-inverse": dark ? "#f2f4f7" : "#1f2937",
      "text-inverse": dark ? "#16181d" : "#ffffff",
      "overlay": dark ? "rgba(0,0,0,.62)" : "rgba(15,20,28,.44)",

      border: border,
      "border-subtle": C.mix(border, S2, 0.5),
      "border-strong": C.ensureContrast(border, S2, AA_NONTEXT),

      text: text,
      muted: muted,
      "text-subtle": textSubtle,
      link: accentText,

      accent: accent,
      "accent-contrast": accentContrast,
      "accent-text": accentText,
      "accent-stroke": accentStroke,
      "accent-hover": dark ? C.lighten(accent, 0.1) : C.darken(accent, 0.08),
      "accent-weak": C.withAlpha(accent, 0.12),
      "accent-border": C.withAlpha(accent, 0.45),
      "focus-ring": accentStroke,
      "focus-halo": S2,

      "note-bg": NOTE[mode].bg,
      "note-border": NOTE[mode].border,
      "note-text": NOTE[mode].text,
      "pattern-ink": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)",
      "ruler-tint": dark ? "rgba(255,235,59,.10)" : "rgba(255,235,59,.16)",
    };

    for (const [k, v] of Object.entries(SEMANTIC[mode])) t[k] = v;
    t["danger-border"] = C.withAlpha(SEMANTIC[mode].danger, 0.45);
    for (const [k, v] of Object.entries(GRADE[mode])) {
      t["grade-" + k] = v;
      t["grade-" + k + "-fg"] = C.ensureContrast(C.contrastText(v), v, AA_TEXT);
    }
    CAT[mode].forEach((c, i) => { t["cat-" + (i + 1)] = c; });
    for (const [k, v] of Object.entries(SHADOW[mode])) t["shadow-" + k] = v;

    return { tokens: t, guard };
  }

  function decls(t, indent) {
    const pad = indent || "  ";
    return Object.keys(t).map((k) => pad + "--bc-" + k + ": " + t[k] + ";").join("\n");
  }

  // Back-compat aliases. Older feature CSS (and any user custom CSS) still
  // references these; they resolve per-mode via the canonical names.
  const ALIASES = `
  --bc-d-bg: var(--bc-surface-1); --bc-d-bg2: var(--bc-surface-2);
  --bc-d-bg3: var(--bc-surface-3); --bc-d-border: var(--bc-border);
  --bc-d-text: var(--bc-text); --bc-d-muted: var(--bc-muted);
  --bc-d-link: var(--bc-link);`;

  BC.tokens = {
    resolve(theming) {
      const pals = BC.color.themePalettes(theming || {});
      const light = resolveMode(pals.light, "light");
      const dark = resolveMode(pals.dark, "dark");
      return {
        light: light.tokens,
        dark: dark.tokens,
        guard: {
          light: light.guard,
          dark: dark.guard,
          // True when EITHER mode had to fall back, since the settings surfaces
          // need one consistent answer.
          surfaceFallback: light.guard.surfaceFallback || dark.guard.surfaceFallback,
          hierarchyCollapsed: light.guard.hierarchyCollapsed || dark.guard.hierarchyCollapsed,
        },
      };
    },

    // scope: selector for the light/base block (default ":root").
    // mode: "both" (default) | "light" | "dark" — the popup and options page render
    // a single mode, the Canvas page needs both.
    css(theming, opts) {
      const o = opts || {};
      const scope = o.scope || ":root";
      const r = BC.tokens.resolve(theming);
      const out = [];
      if (o.mode === "dark") {
        out.push(scope + " {\n" + decls(r.dark) + ALIASES + "\n}");
      } else {
        out.push(scope + " {\n" + decls(r.light) + ALIASES + "\n}");
        if (o.mode !== "light") out.push("html.bc-dark {\n" + decls(r.dark) + "\n}");
      }
      // Settings surfaces only. Canvas pages keep whatever theme the user chose —
      // they picked it, and we don't own their reading of Canvas content — but the
      // settings panel must stay operable, so it gets the safe neutral set and an
      // honest notice (rendered by the Appearance tab).
      if (r.guard.surfaceFallback) {
        const safeLight = { ...SAFE_NEUTRAL.light };
        const safeDark = { ...SAFE_NEUTRAL.dark };
        const emit = (sel, s) => sel + " {\n" +
          "  --bc-surface-1: " + s.bg + "; --bc-surface-2: " + s.bg2 + "; --bc-surface-3: " + s.bg3 + ";\n" +
          "  --bc-border: " + s.border + "; --bc-text: " + s.text + "; --bc-muted: " + s.muted + ";\n" +
          "  --bc-text-subtle: " + s.muted + ";\n}";
        out.push(emit(".bc-app", safeLight));
        out.push(emit("html.bc-dark .bc-app, .bc-app.bc-dark", safeDark));
      }
      return out.join("\n");
    },

    // Mode-independent scales. Written once and never rebuilt.
    staticCss() {
      return `
:root {
  /* spacing — the only consumer of the density setting for our own surfaces */
  --bc-space-scale: 1;
  --bc-space-unit: calc(4px * var(--bc-space-scale, 1));
  --bc-space-1: var(--bc-space-unit);
  --bc-space-2: calc(var(--bc-space-unit) * 1.5);
  --bc-space-3: calc(var(--bc-space-unit) * 2);
  --bc-space-4: calc(var(--bc-space-unit) * 2.5);
  --bc-space-5: calc(var(--bc-space-unit) * 3);
  --bc-space-6: calc(var(--bc-space-unit) * 3.5);
  --bc-space-7: calc(var(--bc-space-unit) * 4);
  --bc-space-8: calc(var(--bc-space-unit) * 5);
  --bc-space-9: calc(var(--bc-space-unit) * 6);
  --bc-space-10: calc(var(--bc-space-unit) * 7);
  /* Panel rhythm. The settings surfaces were built out of --bc-space-6/8 (14px
     and 20px), which is the bottom of the scale; every "the spacing is off"
     report was about this. These are the two measurements that set the feel of
     a panel, so they get names rather than being picked per rule. */
  --bc-pad-card: calc(var(--bc-space-unit) * 6);    /* 24px */
  --bc-pad-row:  calc(var(--bc-space-unit) * 3.5);  /* 14px */
  --bc-gap-card: calc(var(--bc-space-unit) * 4);    /* 16px */

  /* The spectrum. A fixed set of hues rather than theme colours, because the
     only thing that reads it maps hue to a VALUE — the rainbow progress style,
     where the colour at the tip of the bar is what tells you how far along you
     are. hsl so it stays legible against both modes, and one definition so a
     feature never hardcodes a gradient of its own. */
  --bc-spectrum: linear-gradient(90deg,
    hsl(350 78% 56%), hsl(28 88% 54%), hsl(48 92% 50%),
    hsl(142 62% 42%), hsl(198 82% 46%), hsl(262 68% 58%));

  /* A tick as a mask, for the places we restyle Canvas's OWN markup and so
     cannot put an <svg> inside the element. A mask takes its colour from
     background-color, which means one definition works in both modes — a
     background-image would need a light and a dark copy. Same geometry as
     BC.icons "check". */
  --bc-check-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5 6.25 11.25 12.5 4.75' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");

  /* radius, derived from the user's slider */
  --bc-radius: 8px;
  --bc-radius-sm: calc(var(--bc-radius) * 0.5);
  --bc-radius-md: var(--bc-radius);
  --bc-radius-lg: calc(var(--bc-radius) * 1.25);
  --bc-radius-xl: calc(var(--bc-radius) * 1.5);
  --bc-radius-pill: 999px;
  --bc-radius-circle: 50%;

  /* type */
  /* Rounded terminals, from fonts every platform already has. Nothing is
     fetched, so this costs no request and works offline -- but it is the single
     cheapest change that makes our own chrome stop reading as a control panel.
     The grotesque stack is kept as the fallback, so a machine without a rounded
     face is exactly where it was. */
  --bc-font-sans: ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  --bc-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --bc-font-scale: 1;
  --bc-text-3xs: calc(10px * var(--bc-font-scale));
  --bc-text-2xs: calc(11px * var(--bc-font-scale));
  --bc-text-xs:  calc(12px * var(--bc-font-scale));
  --bc-text-sm:  calc(13px * var(--bc-font-scale));
  --bc-text-md:  calc(14px * var(--bc-font-scale));
  --bc-text-lg:  calc(15px * var(--bc-font-scale));
  --bc-text-xl:  calc(17px * var(--bc-font-scale));
  --bc-text-2xl: calc(20px * var(--bc-font-scale));
  --bc-text-figure: calc(24px * var(--bc-font-scale));
  --bc-line-height: 1.5;
  --bc-leading-tight: 1.25;
  --bc-leading-body: var(--bc-line-height);
  --bc-letter-spacing: 0px;
  --bc-tracking: var(--bc-letter-spacing);
  --bc-tracking-caps: 0.04em;
  --bc-weight-medium: 500;
  --bc-weight-semibold: 600;
  --bc-weight-bold: 700;

  /* motion — dividing by the speed slider means 2x really is twice as fast */
  --bc-anim-speed: 1;
  --bc-dur-1: calc(90ms / var(--bc-anim-speed, 1));
  --bc-dur-2: calc(160ms / var(--bc-anim-speed, 1));
  --bc-dur-3: calc(220ms / var(--bc-anim-speed, 1));
  --bc-dur-4: calc(300ms / var(--bc-anim-speed, 1));
  --bc-ease-standard: cubic-bezier(.2,0,.2,1);
  --bc-ease-out: cubic-bezier(.05,.7,.1,1);
  --bc-ease-in: cubic-bezier(.3,0,.8,.15);
  --bc-ease-spring: cubic-bezier(.22,.61,.36,1);

  /* z-index scale, replacing a dozen ad-hoc literals; order matches what
     shipped before (dock < notes < hud < popover < drawer < modal < palette < toast) */
  --bc-z-base: 1;
  --bc-z-raised: 10;
  --bc-z-sticky: 100;
  --bc-z-dock: 2147480000;
  --bc-z-underlay: 2147480500;
  --bc-z-hud: 2147481000;
  --bc-z-popover: 2147481500;
  --bc-z-drawer: 2147482000;
  --bc-z-modal: 2147482500;
  --bc-z-palette: 2147483000;
  --bc-z-toast: 2147483200;

  /* Bottom-right corner budget. The toast stack, the Pomodoro dock and the
     page-utility buttons all anchor here and used to overlap each other. Each
     piece of persistent chrome raises its own slot, and the toast stack starts
     above the sum, so the corner is arbitrated in one place rather than by each
     feature guessing an offset. */
  --bc-dock-bottom: 0px;   /* Pomodoro dock */
  --bc-utility-h: 0px;     /* Copy URL / Print buttons */
}

/* A gentler curve than the legacy --bc-density multiplier: at 0.6 a 4px gap
   would collapse to 2.4px. */
:root[data-bc-density="compact"]  { --bc-space-scale: 0.82; }
:root[data-bc-density="spacious"] { --bc-space-scale: 1.22; }
:root[data-bc-density="cozy"]     { --bc-space-scale: 1.45; }

/* "Rounded UI off" now squares our own components too, not just Canvas's. */
:root[data-bc-rounded="0"] { --bc-radius: 0px; }

:root[data-bc-motion="0"] {
  --bc-dur-1: 0.01ms; --bc-dur-2: 0.01ms; --bc-dur-3: 0.01ms; --bc-dur-4: 0.01ms;
}
@media (prefers-reduced-motion: reduce) {
  :root {
    --bc-dur-1: 0.01ms; --bc-dur-2: 0.01ms; --bc-dur-3: 0.01ms; --bc-dur-4: 0.01ms;
  }
}`;
    },

    // Memo key so theming.js can skip rebuilding a multi-KB string on every tick.
    signature(theming) {
      const t = theming || {};
      return [
        t.darkMode, t.darkTone, t.darkBg, t.lightPreset, t.accentColor,
        t.font, t.fontSizeScale, t.lineHeight, t.letterSpacing, t.density,
        t.radius, t.roundedUI, t.cursor, t.focusRing, t.colorBlind,
        t.highContrast, t.reducedMotion, t.animSpeed, t.sidebarWidth,
        t.logo && t.logo.mode, t.logo && t.logo.url, t.logo && t.logo.text,
      ].join("");
    },

    // theming.js interpolates the user's font stack into a declaration, and
    // cssSafe only strips <>, so `Inter; } html{display:none} .x {` would escape
    // it. Allow only what can appear in a real font-family value.
    safeFontStack(s) {
      const v = String(s == null ? "" : s).trim().slice(0, 200);
      return /^[\w\s,'"À-ɏ-]+$/.test(v) ? v : "";
    },
  };
})();
