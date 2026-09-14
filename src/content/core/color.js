/* Better Canvas — color helpers. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const color = (BC.color = {
    isHex(s) {
      if (!s) return false;
      return /^#[0-9a-fA-F]{6}$/.test(String(s).trim());
    },

    normalizeHex(s) {
      if (!s) return "";
      let h = String(s).trim().replace(/^#/, "");
      if (h.length === 3) h = h.split("").map(c => c + c).join("");
      if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
      return "#" + h.toLowerCase();
    },

    hexToRgb(hex) {
      const h = color.normalizeHex(hex);
      if (!h) return null;
      return {
        r: parseInt(h.slice(1, 3), 16),
        g: parseInt(h.slice(3, 5), 16),
        b: parseInt(h.slice(5, 7), 16),
      };
    },

    rgbToHex(r, g, b) {
      const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
      return "#" + to(r) + to(g) + to(b);
    },

    // Perceived (BT.601) luminance 0-255. Rough brightness only — NOT valid for
    // contrast ratios; use relLuminance/contrastRatio for anything accessibility
    // related.
    luminance(hex) {
      const c = color.hexToRgb(hex);
      if (!c) return 255;
      return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    },

    // WCAG 2.1 relative luminance, 0..1.
    relLuminance(hex) {
      const c = color.hexToRgb(hex);
      if (!c) return 1;
      const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    },

    // Parse what getComputedStyle actually returns: "rgb(r, g, b)",
    // "rgba(r, g, b, a)", "transparent", or a hex. Returns {r,g,b,a} or null.
    parseCssColor(str) {
      const s = String(str == null ? "" : str).trim().toLowerCase();
      if (!s || s === "transparent" || s === "none") return null;
      if (s[0] === "#") { const c = color.hexToRgb(s); return c ? { r: c.r, g: c.g, b: c.b, a: 1 } : null; }
      const m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.%]+))?\s*\)$/);
      if (!m) return null;
      let a = 1;
      if (m[4] != null) a = m[4].indexOf("%") > -1 ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return { r: +m[1], g: +m[2], b: +m[3], a: isFinite(a) ? a : 1 };
    },

    // How far a colour is from grey, 0..255. A white or grey panel is chrome; a
    // saturated colour is somebody's deliberate choice (a course colour, a
    // status badge, a highlight) and must not be repainted as if it were a
    // surface.
    chroma(str) {
      const c = color.parseCssColor(str);
      if (!c) return 0;
      return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
    },

    // Relative luminance of a computed colour string, or null when it is too
    // transparent to be what the user actually sees.
    cssLuminance(str, minAlpha) {
      const c = color.parseCssColor(str);
      if (!c || c.a < (minAlpha == null ? 0.5 : minAlpha)) return null;
      return color.relLuminance(color.rgbToHex(c.r, c.g, c.b));
    },

    // WCAG contrast ratio, 1..21.
    contrastRatio(a, b) {
      const x = color.relLuminance(a), y = color.relLuminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    },

    // Best of near-black / near-white for text sitting ON hex.
    contrastText(hex) {
      return color.contrastRatio("#16181d", hex) >= color.contrastRatio("#ffffff", hex)
        ? "#16181d" : "#ffffff";
    },

    // Push fg toward whichever endpoint the background is farther from until it
    // clears `min` against bg. Returns the pure endpoint if even that can't reach
    // it — callers check contrastRatio again to detect that case.
    ensureContrast(fg, bg, min) {
      const base = color.normalizeHex(fg) || "#000000";
      if (color.contrastRatio(base, bg) >= min) return base;
      // Head for whichever endpoint measurably has more room. A relative-luminance
      // threshold gets this wrong for mid-greys: #8a8a8a is only ~0.26 relLum, so a
      // ">0.45 means light" test sends it toward white (3.4:1) when black would
      // reach 6.1:1.
      const toward = color.contrastRatio("#000000", bg) >= color.contrastRatio("#ffffff", bg)
        ? "#000000" : "#ffffff";
      for (let i = 1; i <= 24; i++) {
        const out = color.mix(base, toward, i / 24);
        if (color.contrastRatio(out, bg) >= min) return out;
      }
      return toward;
    },

    // Mix two hex colors, weight 0..1.
    mix(a, b, w) {
      const A = color.hexToRgb(a), B = color.hexToRgb(b);
      if (!A || !B) return a || b || "#000000";
      const t = Math.max(0, Math.min(1, w));
      return color.rgbToHex(
        A.r + (B.r - A.r) * t,
        A.g + (B.g - A.g) * t,
        A.b + (B.b - A.b) * t
      );
    },

    lighten(hex, amount) { return color.mix(hex, "#ffffff", amount); },
    darken(hex, amount)  { return color.mix(hex, "#000000", amount); },

    withAlpha(hex, alpha) {
      const c = color.hexToRgb(hex);
      if (!c) return hex;
      return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")";
    },

    // Given a base dark background, derive a coherent surface palette.
    darkSurface(base) {
      return {
        bg: base,
        bg2: color.lighten(base, 0.05),
        bg3: color.lighten(base, 0.10),
        border: color.lighten(base, 0.15),
        text: "#e6e9ee",
        muted: "#9aa4b2",
      };
    },

    // Given a base light background, derive a coherent surface palette.
    lightSurface(base) {
      return {
        bg: base,
        bg2: "#ffffff",
        bg3: color.darken(base, 0.04),
        border: color.darken(base, 0.14),
        text: "#1b2430",
        muted: "#5c6675",
      };
    },

    // Resolve full light + dark surface palettes from a theming settings object.
    // Shared by theming.js (top frame) and frame.js (iframes).
    themePalettes(t) {
      t = t || {};
      const tones = BC.DARK_TONES || {};
      const presets = BC.LIGHT_PRESETS || {};
      const darkBase = (t.darkBg && color.isHex(t.darkBg))
        ? t.darkBg
        : (tones[t.darkTone] || tones.neutral || { bg: "#1b1917" }).bg;
      const lp = presets[t.lightPreset] || presets.default || { bg: "#f5f1ea", accent: "" };
      // Warm clay, not the stock indigo every extension ships. It clears 4.9:1 on
      // the lightest paper surface and 5.9:1 for its own label, so it can be the
      // default without the guard having to rescue it.
      const accent = color.normalizeHex(t.accentColor) || color.normalizeHex(lp.accent) || "#a8452c";
      return {
        dark:  { ...color.darkSurface(darkBase), accent, link: color.lighten(accent, 0.15) },
        light: { ...color.lightSurface(lp.bg),   accent, link: accent },
      };
    },

    // Color-blind palette shifts (naive daltonization approximation).
    // Applied via CSS filter on the whole document.
    colorBlindFilter(mode) {
      switch (mode) {
        case "protanopia":   return "url(#bc-cb-protanopia)";
        case "deuteranopia": return "url(#bc-cb-deuteranopia)";
        case "tritanopia":   return "url(#bc-cb-tritanopia)";
        default: return "";
      }
    },
  });
})();
