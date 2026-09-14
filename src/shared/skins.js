/*
 * Better Canvas — the skin engine.
 *
 * A *theme* in this repo used to mean a settings snapshot: a palette id, a
 * radius, a density. That is a colour scheme, not a theme, and it is why the
 * Themes tab never looked like anything. A skin is the other thing — the one
 * people actually share: surface art, card art, nav treatment, type, palette.
 *
 * Two rules shape the whole design:
 *
 * 1. A skin is PURE DATA. No functions, no DOM, nothing that cannot survive
 *    JSON.stringify. That is what lets the same object be a built-in, a file
 *    someone pastes in, and a row a gallery server hands back, with one code
 *    path for all three.
 *
 * 2. Art is GENERATED, not shipped. Every pattern below is a CSS gradient or an
 *    inline SVG built at runtime from two colours and a scale. That buys four
 *    things a folder of PNGs cannot: the extension stays asset-free, a pattern
 *    recolours to any palette instead of needing one file per variant, it stays
 *    crisp at any zoom, and nothing is fetched — so a skin works offline and
 *    leaks no request to anyone's server.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const S = (BC.skins = {});

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const num = (v, dflt, lo, hi) => (typeof v === "number" && isFinite(v) ? clamp(v, lo, hi) : dflt);

  // ---- colour helpers -----------------------------------------------------
  // BC.color is a content-script module and the options page loads it too, but
  // the gallery may want to render a swatch before it exists. These fall back
  // rather than throw, because a missing helper should cost a nicer colour, not
  // the whole panel.
  const hex = (v, dflt) => {
    const c = BC.color && BC.color.normalizeHex ? BC.color.normalizeHex(v) : null;
    return c || dflt;
  };
  const alpha = (c, a) =>
    BC.color && BC.color.withAlpha ? BC.color.withAlpha(c, a) : c;
  const mix = (a, b, w) => (BC.color && BC.color.mix ? BC.color.mix(a, b, w) : a);
  const ink = (bg) => (BC.color && BC.color.contrastText ? BC.color.contrastText(bg) : "#111111");

  // ---- SVG data URIs ------------------------------------------------------
  // encodeURIComponent would work but triples the length of every pattern by
  // escaping characters a data URI accepts verbatim. Only these five actually
  // break parsing: # ends the URL, < > and " end the attribute, and a raw
  // newline is invalid in a url() token.
  function svgUrl(svg) {
    const packed = svg.replace(/\s+/g, " ").trim()
      .replace(/"/g, "'")
      .replace(/%/g, "%25")
      .replace(/#/g, "%23")
      .replace(/</g, "%3C")
      .replace(/>/g, "%3E");
    return 'url("data:image/svg+xml,' + packed + '")';
  }

  const tile = (w, h, body) =>
    svgUrl(
      "<svg xmlns='http://www.w3.org/2000/svg' width='" + w + "' height='" + h +
      "' viewBox='0 0 " + w + " " + h + "'>" + body + "</svg>"
    );

  // ---- the pattern set ----------------------------------------------------
  // Each generator takes the resolved spec and returns { image, size } — the
  // two halves of a background shorthand, kept apart so a caller can layer
  // several patterns and still control each one's tiling.
  //
  // `u` is the tile edge in px after scaling. Gradient patterns repeat by
  // background-size; SVG patterns carry their own viewBox and repeat the same
  // way, so both obey `scale` identically.
  const PATTERNS = {
    none() {
      return { image: "none", size: "auto" };
    },

    // Two sets of half-opaque bands crossing at right angles. The overlap
    // darkens on its own — that doubling IS gingham, so the pattern needs one
    // colour rather than the three a naive version would hardcode.
    gingham({ fg, u }) {
      const band = alpha(fg, 0.45);
      return {
        image:
          "repeating-linear-gradient(0deg, " + band + " 0 " + u + "px, transparent " + u + "px " + u * 2 + "px)," +
          "repeating-linear-gradient(90deg, " + band + " 0 " + u + "px, transparent " + u + "px " + u * 2 + "px)",
        size: "auto",
      };
    },

    // Gingham rotated 45°: the open diagonal trellis, and the single most
    // recognisable "cottage" pattern there is.
    lattice({ fg, u }) {
      const band = alpha(fg, 0.5);
      const w = Math.max(1, Math.round(u * 0.34));
      return {
        image:
          "repeating-linear-gradient(45deg, " + band + " 0 " + w + "px, transparent " + w + "px " + u + "px)," +
          "repeating-linear-gradient(-45deg, " + band + " 0 " + w + "px, transparent " + w + "px " + u + "px)",
        size: "auto",
      };
    },

    stripes({ fg, u, angle }) {
      const w = Math.max(1, Math.round(u * 0.5));
      return {
        image:
          "repeating-linear-gradient(" + angle + "deg, " + alpha(fg, 0.55) + " 0 " + w + "px, transparent " + w + "px " + u + "px)",
        size: "auto",
      };
    },

    // Real plaid is not a grid: it is a wide band and a narrow band on each
    // axis, at different weights. Equal bands read as graph paper.
    plaid({ fg, u }) {
      const a = alpha(fg, 0.3), b = alpha(fg, 0.16);
      const wide = Math.round(u * 0.75), thin = Math.max(1, Math.round(u * 0.16));
      const set = (deg) =>
        "repeating-linear-gradient(" + deg + "deg, " + a + " 0 " + wide + "px, transparent " + wide + "px " + u * 2 + "px)," +
        "repeating-linear-gradient(" + deg + "deg, " + b + " " + u * 1.2 + "px " + (u * 1.2 + thin) + "px, transparent " + (u * 1.2 + thin) + "px " + u * 2 + "px)";
      return { image: set(0) + "," + set(90), size: "auto" };
    },

    grid({ fg, u }) {
      const line = alpha(fg, 0.4);
      return {
        image:
          "linear-gradient(0deg, " + line + " 1px, transparent 1px)," +
          "linear-gradient(90deg, " + line + " 1px, transparent 1px)",
        size: u + "px " + u + "px",
      };
    },

    dots({ fg, u }) {
      const r = Math.max(1, u * 0.14);
      return {
        image: "radial-gradient(circle at 50% 50%, " + alpha(fg, 0.55) + " " + r + "px, transparent " + (r + 0.6) + "px)",
        size: u + "px " + u + "px",
      };
    },

    // Offset rows, not a grid of circles: a half-tile shift is what stops a
    // polka field from reading as rank-and-file.
    polka({ fg, u }) {
      const r = Math.max(1, u * 0.13);
      const d = "radial-gradient(circle at 50% 50%, " + alpha(fg, 0.5) + " " + r + "px, transparent " + (r + 0.6) + "px)";
      return {
        image: d + "," + d,
        size: u + "px " + u + "px",
        position: "0 0, " + u / 2 + "px " + u / 2 + "px",
      };
    },

    checks({ fg, u }) {
      const c = alpha(fg, 0.32);
      return {
        image:
          "linear-gradient(45deg, " + c + " 25%, transparent 25% 75%, " + c + " 75%)," +
          "linear-gradient(45deg, " + c + " 25%, transparent 25% 75%, " + c + " 75%)",
        size: u + "px " + u + "px",
        position: "0 0, " + u / 2 + "px " + u / 2 + "px",
      };
    },

    // A five-petal sprig on a half-drop repeat. Half-drop rather than a straight
    // grid because a straight repeat of anything organic shows its seams as
    // corridors the eye follows straight to the tiling.
    floral({ fg, u }) {
      const t = Math.round(u * 4);
      const p = alpha(fg, 0.5), s = alpha(fg, 0.75), l = alpha(fg, 0.38);
      // Plum-blossom construction: five CIRCLES on a ring, plus a centre.
      // The first version used ellipses rotated to point outward, which is the
      // botanically correct petal and the wrong drawing: at tile size the tips
      // met and the whole thing read as a five-pointed star.
      const bloom = (cx, cy, r) => {
        let out = "";
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          out += "<circle cx='" + (cx + Math.cos(a) * r * 0.56).toFixed(1) +
                 "' cy='" + (cy + Math.sin(a) * r * 0.56).toFixed(1) +
                 "' r='" + (r * 0.44).toFixed(1) + "' fill='" + p + "'/>";
        }
        return out + "<circle cx='" + cx.toFixed(1) + "' cy='" + cy.toFixed(1) +
               "' r='" + (r * 0.24).toFixed(1) + "' fill='" + s + "'/>";
      };
      const leaf = (cx, cy, r, rot) =>
        "<ellipse cx='" + cx.toFixed(1) + "' cy='" + cy.toFixed(1) +
        "' rx='" + (r * 0.75).toFixed(1) + "' ry='" + (r * 0.3).toFixed(1) +
        "' transform='rotate(" + rot + " " + cx.toFixed(1) + " " + cy.toFixed(1) + ")' fill='" + l + "'/>";
      const body =
        bloom(t * 0.25, t * 0.25, t * 0.13) + leaf(t * 0.44, t * 0.4, t * 0.12, 35) +
        bloom(t * 0.75, t * 0.75, t * 0.13) + leaf(t * 0.94, t * 0.9, t * 0.12, 35) +
        bloom(t * 0.75, t * 0.25, t * 0.09) + bloom(t * 0.25, t * 0.75, t * 0.09) +
        leaf(t * 0.1, t * 0.55, t * 0.1, -25) + leaf(t * 0.6, t * 0.05, t * 0.1, -25);
      return { image: tile(t, t, body), size: t + "px " + t + "px" };
    },

    // Thin stems with paired leaves — the quieter botanical, for surfaces that
    // sit behind text and cannot afford floral's density.
    sprigs({ fg, u }) {
      const t = Math.round(u * 4);
      const c = alpha(fg, 0.42);
      // A stem carrying paired leaves and a bud. The first version drew three
      // bare curved strokes fanning off a line, which at tile size read as a
      // claw: an outline with nothing growing on it is a talon, not a plant.
      // Filled leaves are what make the shape legible that small.
      const sprig = (x, y, sc, rot) => {
        let leaves = "";
        for (let i = 0; i < 4; i++) {
          const ly = -5 - i * 3.4;
          const lr = 3.6 - i * 0.5;
          for (const side of [-1, 1]) {
            const lx = side * lr * 0.85;
            leaves += "<ellipse cx='" + lx.toFixed(1) + "' cy='" + ly.toFixed(1) +
              "' rx='" + lr.toFixed(1) + "' ry='" + (lr * 0.46).toFixed(1) +
              "' transform='rotate(" + (side * 30) + " " + lx.toFixed(1) + " " + ly.toFixed(1) +
              ")' fill='" + c + "'/>";
          }
        }
        return "<g transform='translate(" + x.toFixed(1) + " " + y.toFixed(1) +
          ") rotate(" + rot + ") scale(" + sc.toFixed(2) + ")'>" +
          "<path d='M0 3 L0 -19' stroke='" + c + "' stroke-width='1.1' fill='none' stroke-linecap='round'/>" +
          leaves + "<ellipse cx='0' cy='-20.5' rx='1.7' ry='2.9' fill='" + c + "'/></g>";
      };
      const body =
        sprig(t * 0.22, t * 0.34, t / 46, 0) + sprig(t * 0.72, t * 0.84, t / 46, 0) +
        sprig(t * 0.78, t * 0.3, t / 58, 24) + sprig(t * 0.28, t * 0.8, t / 58, -24);
      return { image: tile(t, t, body), size: t + "px " + t + "px" };
    },

    waves({ fg, u }) {
      const w = Math.round(u * 4), h = Math.round(u * 1.6);
      const c = alpha(fg, 0.4);
      const path = "M0 " + h * 0.6 + " q " + w * 0.25 + " -" + h * 0.5 + " " + w * 0.5 + " 0 t " + w * 0.5 + " 0";
      return {
        image: tile(w, h,
          "<path d='" + path + "' fill='none' stroke='" + c + "' stroke-width='1.6'/>" +
          "<path d='" + path + "' transform='translate(0 " + h * 0.4 + ")' fill='none' stroke='" + alpha(fg, 0.22) + "' stroke-width='1.6'/>"),
        size: w + "px " + h + "px",
      };
    },

    // Scattered, but from a fixed table rather than Math.random: a pattern that
    // re-rolls on every render is not a pattern, and the tile edges would stop
    // matching between the page and its own preview.
    confetti({ fg, u }) {
      const t = Math.round(u * 4);
      // Sixteen bits, each ~2.5x the area of the first pass. Ten slivers at
      // 5.5% of the tile averaged out to almost nothing on screen: the pattern
      // technically existed and was invisible, which is worse than not shipping.
      const bits = [[12, 18, 22], [63, 9, -35], [38, 47, 8], [84, 38, 55], [20, 72, -18],
                    [56, 86, 40], [88, 74, -52], [72, 60, 12], [30, 30, 70], [6, 54, -8],
                    [46, 22, -60], [78, 16, 15], [14, 92, 34], [92, 92, -20],
                    [50, 66, -44], [26, 52, 50]];
      const body = bits.map(([x, y, r], i) =>
        "<rect x='" + ((x / 100) * t).toFixed(1) + "' y='" + ((y / 100) * t).toFixed(1) +
        "' width='" + (t * 0.085).toFixed(1) + "' height='" + (t * 0.032).toFixed(1) +
        "' rx='" + (t * 0.016).toFixed(1) + "' transform='rotate(" + r + " " +
        ((x / 100) * t).toFixed(1) + " " + ((y / 100) * t).toFixed(1) + ")' fill='" +
        alpha(fg, i % 3 === 0 ? 0.62 : 0.42) + "'/>").join("");
      return { image: tile(t, t, body), size: t + "px " + t + "px" };
    },

    scallop({ fg, u }) {
      const w = Math.round(u * 2), h = Math.round(u * 1.1);
      const c = alpha(fg, 0.3);
      return {
        image: tile(w, h,
          "<path d='M0 " + h + " A " + w / 2 + " " + w / 2 + " 0 0 1 " + w + " " + h + " Z' fill='" + c + "'/>" +
          "<path d='M-" + w / 2 + " " + h + " A " + w / 2 + " " + w / 2 + " 0 0 1 " + w / 2 + " " + h + " Z' fill='" + c + "'/>"),
        size: w + "px " + h + "px",
      };
    },

    // feTurbulence, so the grain is computed by the renderer rather than stored.
    // A real noise PNG large enough not to visibly tile is ~40KB; this is ~200
    // bytes and never repeats.
    noise({ fg, u }) {
      const t = Math.max(80, Math.round(u * 10));
      return {
        image: tile(t, t,
          "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/>" +
          "<feColorMatrix type='saturate' values='0'/></filter>" +
          // A bare #, not %23: svgUrl escapes % before #, so pre-escaping here
          // would double to %2523 and the filter reference would never resolve.
          "<rect width='100%' height='100%' filter='url(#n)' opacity='0.33' fill='" + fg + "'/>"),
        size: t + "px " + t + "px",
      };
    },
  };

  S.PATTERN_KINDS = Object.keys(PATTERNS);

  // Resolve a spec to the background declarations it stands for. Returns null
  // for "no art", so callers can skip emitting the rule entirely rather than
  // paint `background-image: none` over something underneath.
  S.pattern = function (spec) {
    if (!spec || !spec.kind || spec.kind === "none") return null;
    const gen = PATTERNS[spec.kind];
    if (!gen) return null;
    const fg = hex(spec.fg, "#888888");
    const bg = hex(spec.bg, null);
    const out = gen({
      fg,
      bg,
      u: num(spec.scale, 1, 0.25, 6) * 16,
      angle: num(spec.angle, 45, -180, 180),
    });
    if (!out || out.image === "none") return null;
    return {
      image: out.image,
      size: out.size || "auto",
      position: out.position || "0 0",
      color: bg,
      opacity: num(spec.opacity, 1, 0, 1),
    };
  };

  // The same thing as a ready-to-paste declaration block, for the many callers
  // that just want to drop art on one element.
  S.patternCss = function (spec) {
    const p = S.pattern(spec);
    if (!p) return "";
    return (p.color ? "background-color: " + p.color + ";" : "") +
      "background-image: " + p.image + ";" +
      "background-size: " + p.size + ";" +
      "background-position: " + p.position + ";" +
      "background-repeat: repeat;";
  };

  // ---- validation ---------------------------------------------------------
  // Everything that reaches this function is untrusted: a pasted file, a gallery
  // response, a hand-edited export. It returns a NEW object built field by field
  // from known keys, so nothing unexpected survives into the object we later
  // interpolate into a stylesheet.
  const PAT_KEYS = ["kind", "fg", "bg", "scale", "angle", "opacity"];

  function normPattern(raw) {
    if (!raw || typeof raw !== "object") return { kind: "none" };
    const kind = PATTERNS[raw.kind] ? raw.kind : "none";
    const out = { kind };
    if (kind === "none") return out;
    out.fg = hex(raw.fg, "#888888");
    if (raw.bg) out.bg = hex(raw.bg, undefined);
    out.scale = num(raw.scale, 1, 0.25, 6);
    out.angle = num(raw.angle, 45, -180, 180);
    out.opacity = num(raw.opacity, 1, 0, 1);
    for (const k of Object.keys(out)) if (PAT_KEYS.indexOf(k) === -1) delete out[k];
    return out;
  }

  const str = (v, max) =>
    typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, max) : "";

  // Font stacks are interpolated straight into CSS, so they get the narrowest
  // whitelist of the lot: letters, digits, spaces, quotes, hyphens and commas.
  // Anything else and we fall back rather than try to repair it.
  function normFont(v) {
    const s = str(v, 200);
    if (!s || !/^[\w\s'",\-]+$/.test(s)) return "";
    return s;
  }

  S.normalize = function (raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = str(raw.id, 64).replace(/[^\w-]/g, "");
    const name = str(raw.name, 64);
    if (!id || !name) return null;

    const dark = !!raw.dark;
    const surface = hex(raw.surface, dark ? "#1a1d24" : "#f6f7fb");
    const panel = hex(raw.panel, dark ? mix(surface, "#ffffff", 0.06) : "#ffffff");
    const accent = hex(raw.accent, "#4f46e5");

    const t = {
      id,
      name,
      author: str(raw.author, 48),
      tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 6).map((x) => str(x, 24)).filter(Boolean) : [],
      dark,
      surface,
      panel,
      text: hex(raw.text, ink(surface)),
      muted: hex(raw.muted, mix(ink(surface), surface, 0.4)),
      border: hex(raw.border, mix(ink(surface), surface, 0.82)),
      accent,
      nav: hex(raw.nav, dark ? mix(surface, "#000000", 0.35) : mix(accent, "#000000", 0.35)),
      radius: num(raw.radius, 10, 0, 28),
      // Replacing the course colour is what makes a skin read as designed
      // rather than as a texture laid over Canvas -- but course colours are
      // also how people find a course at a glance, so a skin can opt to tint
      // Canvas's colour instead of covering it.
      cardColor: raw.cardColor === "course" ? "course" : "skin",
      density: ["compact", "default", "spacious", "cozy"].indexOf(raw.density) >= 0 ? raw.density : "default",
      fontSans: normFont(raw.fontSans),
      fontDisplay: normFont(raw.fontDisplay),
      page: normPattern(raw.page),
      // Cards cycle through this list, which is the whole reason a skin reads as
      // designed rather than as one texture smeared over everything: six cards,
      // six related-but-different faces.
      cards: (Array.isArray(raw.cards) ? raw.cards : []).slice(0, 8).map(normPattern),
    };
    if (!t.cards.length) t.cards = [{ kind: "none" }];
    return t;
  };

  // ---- stylesheet emission ------------------------------------------------
  // A skin drives the EXISTING token layer rather than competing with it. That
  // is what makes one skin restyle the drawer, the popup, the planner and the
  // options page at once: they already read --bc-*, so they need no knowledge
  // that skins exist at all.
  S.tokenCss = function (t) {
    if (!t) return "";
    return [
      "--bc-surface-1: " + t.surface + ";",
      "--bc-surface-2: " + t.panel + ";",
      "--bc-surface-3: " + mix(t.panel, t.text, 0.05) + ";",
      "--bc-surface-4: " + mix(t.panel, t.text, 0.09) + ";",
      "--bc-text: " + t.text + ";",
      "--bc-muted: " + t.muted + ";",
      "--bc-border: " + t.border + ";",
      "--bc-accent: " + t.accent + ";",
      "--bc-accent-contrast: " + ink(t.accent) + ";",
      // Links are the most common coloured text on a Canvas page, so leaving
      // them on the stock indigo was the one thing that still read as "not
      // themed" after everything else had changed. Contrast-corrected against
      // the surface they sit on rather than used raw: an accent chosen to look
      // right as a 40px button fill is often unreadable as 13px body text.
      "--bc-link: " + (BC.color && BC.color.ensureContrast
        ? BC.color.ensureContrast(t.accent, t.panel, 4.5) : t.accent) + ";",
      "--bc-radius: " + t.radius + "px;",
      t.fontSans ? "--bc-font-sans: " + t.fontSans + ";" : "",
    ].filter(Boolean).join("");
  };

  // Canvas's own class names. Kept in one table because they are the single
  // most brittle thing here: when Instructure renames one, this is the list to
  // fix, not fourteen scattered selectors.
  const SEL = {
    page: "#application, body.with-left-side #main",
    nav: "#header.ic-app-header, .ic-app-header",
    card: ".ic-DashboardCard",
    cardArt: ".ic-DashboardCard__header_hero",
    cardImage: ".ic-DashboardCard__header_image",
    title: ".ic-Dashboard-header__title, .ic-DashboardCard__header-title",
  };

  S.css = function (raw) {
    const t = S.normalize(raw);
    if (!t) return "";
    // `:root:root`, not `:root`. The token layer emits its dark palette under
    // `html.bc-dark` (specificity 0,1,1), which outranks a plain `:root`
    // (0,1,0) no matter what order the sheets land in -- so every dark skin
    // rendered in the generic blue-grey with only its card art coming through.
    // Repeating :root costs one class-level point and settles it (0,2,0).
    const out = [":root:root{" + S.tokenCss(t) + "}"];

    // The surface colour is emitted whether or not there is a pattern over it.
    // Gating the whole rule on having art meant a skin with `page: none` kept
    // Canvas's own grey behind its cards, so nine of ten skins were a palette
    // that stopped at the card edge.
    const page = S.pattern(t.page);
    out.push(SEL.page + "{" +
      "background-color:" + ((page && page.color) || t.surface) + ";" +
      (page
        ? "background-image:" + page.image + ";" +
          "background-size:" + page.size + ";" +
          "background-position:" + page.position + ";" +
          "background-attachment:fixed;"
        : "") +
      "}");

    out.push(SEL.nav + "{background-color:" + t.nav + ";}");
    out.push(SEL.card + "{border-radius:var(--bc-radius);overflow:hidden;}");

    // The card art replaces Canvas's flat colour block. nth-of-type rather than
    // nth-child: Canvas injects screenreader-only siblings into the grid, and
    // counting those shifts every card's pattern by one at random.
    const n = t.cards.length;
    t.cards.forEach((spec, i) => {
      const p = S.pattern(spec);
      if (!p) return;
      const at = n === 1 ? SEL.card : SEL.card + ":nth-of-type(" + n + "n+" + (i + 1) + ")";
      // !important on the colour and nothing else. Canvas writes the course
      // colour as an INLINE style on this element, and an inline declaration
      // beats any stylesheet rule: without it the skin's palette silently lost
      // and every card came back in Canvas's gold/teal/purple with the skin's
      // pattern laid over the top -- which is how this first rendered.
      // In "course" mode the colour declaration is simply omitted, so Canvas's
      // inline course colour stays and the pattern rides on top of it. That is
      // the same inline-beats-stylesheet fact exploited in reverse.
      out.push(at + " " + SEL.cardArt + "{" +
        (t.cardColor === "course" ? "" : "background-color:" + (p.color || t.panel) + " !important;") +
        "background-image:" + p.image + ";" +
        "background-size:" + p.size + ";" +
        "background-position:" + p.position + ";" +
        "opacity:" + p.opacity + ";}");
      // Canvas paints a user-uploaded course image OVER the colour block. A skin
      // that silently deleted it would be destroying the user's own content, so
      // the art goes behind it and only shows where there is no image.
      out.push(at + " " + SEL.cardImage + "{background-blend-mode:multiply;}");
    });

    if (t.fontDisplay) out.push(SEL.title + "{font-family:" + t.fontDisplay + ";}");
    return out.join("\n");
  };

  // ---- preview ------------------------------------------------------------
  // A gallery row needs a thumbnail before anything is applied. Returning inline
  // style strings (not a DOM node) keeps this usable from the drawer's shadow
  // root, the options page and the popup without three variants.
  S.swatchStyles = function (raw, count) {
    const t = S.normalize(raw);
    if (!t) return null;
    const cards = [];
    const want = count || 4;
    for (let i = 0; i < want; i++) {
      const p = S.pattern(t.cards[i % t.cards.length]);
      // Course mode has no course colour to show in a preview, so the thumbnail
      // stands in Canvas's own card palette. Anything else would preview a look
      // the page will never produce.
      const COURSE = ["#c77a2e", "#3a8f78", "#8f5aa8", "#c2564a"];
      const bg = t.cardColor === "course" ? COURSE[i % COURSE.length] : ((p && p.color) || t.panel);
      cards.push(
        "background-color:" + bg + ";" +
        (p ? "background-image:" + p.image + ";background-size:" + p.size + ";" : "")
      );
    }
    const page = S.pattern(t.page);
    return {
      page: "background-color:" + ((page && page.color) || t.surface) + ";" +
            (page ? "background-image:" + page.image + ";background-size:" + page.size + ";" : ""),
      nav: "background-color:" + t.nav + ";",
      cards,
      accent: t.accent,
      text: t.text,
    };
  };

  // ---- resolution ---------------------------------------------------------
  // The one place that answers "which skin is on?". A user's imported skins are
  // searched before the built-ins so that re-using a built-in's id overrides it
  // rather than being silently ignored -- which is what someone editing a
  // shipped skin and pasting it back expects to happen.
  S.active = function (settings) {
    const t = settings && settings.theming;
    if (!t || !t.skin) return null;
    const mine = Array.isArray(t.skins) ? t.skins : [];
    let found = null;
    for (const s of mine) if (s && s.id === t.skin) { found = s; break; }
    if (!found) for (const s of BC.SKIN_CATALOG || []) if (s.id === t.skin) { found = s; break; }
    return found ? S.normalize(found) : null;
  };

  // ---- sharing ------------------------------------------------------------
  S.export = function (t) {
    return JSON.stringify(S.normalize(t), null, 2);
  };

  S.import = function (text) {
    let raw;
    try { raw = JSON.parse(String(text)); } catch (_) { return null; }
    // A gallery response is { theme: {...} } while a file export is the theme
    // itself. Accepting both means one paste box handles either.
    return S.normalize(raw && raw.theme ? raw.theme : raw);
  };
})();
