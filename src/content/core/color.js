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

    // Perceived luminance 0-255. Use to pick black/white text on a colored bg.
    luminance(hex) {
      const c = color.hexToRgb(hex);
      if (!c) return 255;
      return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    },

    contrastText(hex) {
      return color.luminance(hex) > 155 ? "#111" : "#fff";
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
        : (tones[t.darkTone] || tones.neutral || { bg: "#1a1d24" }).bg;
      const lp = presets[t.lightPreset] || presets.default || { bg: "#f6f7fb", accent: "" };
      const accent = color.normalizeHex(t.accentColor) || color.normalizeHex(lp.accent) || "#4f46e5";
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
