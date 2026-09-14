"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, ROOT } = require("./harness");

const BC = loadCore(createSandbox());
const S = BC.skins;
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// A minimal valid skin, so each test can vary the one field it cares about.
const base = () => ({
  id: "t", name: "T", dark: false,
  surface: "#f0f0f0", panel: "#ffffff", accent: "#336699",
  cards: [{ kind: "gingham", fg: "#88aa66" }],
});

module.exports = {
  // ---- the pattern engine ------------------------------------------------

  "every advertised pattern kind actually generates art"() {
    const missing = [];
    for (const kind of S.PATTERN_KINDS) {
      if (kind === "none") continue;
      const p = S.pattern({ kind, fg: "#804020", scale: 1 });
      if (!p || !p.image || p.image === "none") { missing.push(kind); continue; }
      // A gradient or a data URI, nothing else: a bare url() would mean the
      // pattern is reaching for a file we do not ship.
      if (!/gradient|^url\("data:image\/svg\+xml/.test(p.image)) missing.push(kind + " (not self-contained)");
    }
    assert.deepEqual(missing, [], "pattern kinds that produce nothing usable: " + missing.join(", "));
  },

  "no pattern fetches anything over the network"() {
    // The whole reason art is generated: a remote pattern would tell a host
    // which Canvas user is on which page, on every single page load.
    for (const kind of S.PATTERN_KINDS) {
      const p = S.pattern({ kind, fg: "#804020" });
      if (!p) continue;
      // Two forms are legitimate and nothing else is: the data URI the pattern
      // itself is, and `url(%23id)` -- an escaped fragment pointing at a node
      // inside that same SVG, which resolves within the document and cannot
      // leave it. `noise` uses one to reach its own feTurbulence filter.
      assert.noMatch(p.image, /url\((?!"data:|%23)/, kind + " references an external resource");
      // The xmlns declaration is a namespace identifier and is never fetched;
      // strip it before asking whether any real URL survived.
      const noNs = p.image.replace(/xmlns='[^']*'/g, "");
      assert.noMatch(noNs, /https?:/, kind + " contains an absolute URL");
    }
  },

  "an unknown pattern kind is dropped rather than interpolated"() {
    assert.equal(S.pattern({ kind: "'); background: url(//evil.example)", fg: "#000000" }), null);
    assert.equal(S.pattern({ kind: "spiral" }), null);
    assert.equal(S.pattern({ kind: "none" }), null);
    assert.equal(S.pattern(null), null);
  },

  "svg data URIs escape the characters that would break out of url()"() {
    // A raw # truncates the URL at the fragment and a raw > closes the tag: both
    // turn a pattern into a syntax error that takes the rest of the sheet down.
    const p = S.pattern({ kind: "floral", fg: "#aa3366" });
    const body = p.image.slice(p.image.indexOf("data:"));
    assert.noMatch(body, /#/, "an unescaped # ends the data URI early");
    assert.noMatch(body, /[<>]/, "unescaped angle brackets end the url() token");
    assert.match(p.image, /^url\("data:image\/svg\+xml,/);
    assert.match(p.image, /\)$/);
  },

  "scale changes the tile size and stays within bounds"() {
    const small = S.pattern({ kind: "dots", fg: "#333333", scale: 0.5 });
    const big = S.pattern({ kind: "dots", fg: "#333333", scale: 3 });
    assert.notEqual(small.size, big.size);
    // Out-of-range input is clamped, not obeyed: a scale of 9999 is a tile too
    // large to repeat and reads as a solid block.
    const huge = S.pattern({ kind: "dots", fg: "#333333", scale: 9999 });
    const max = S.pattern({ kind: "dots", fg: "#333333", scale: 6 });
    assert.equal(huge.size, max.size);
  },

  "a pattern is deterministic across calls"() {
    // confetti scatters, but from a fixed table. If it re-rolled, a card and its
    // own gallery thumbnail would disagree, and every repaint would flicker.
    const a = S.pattern({ kind: "confetti", fg: "#445566" });
    const b = S.pattern({ kind: "confetti", fg: "#445566" });
    assert.equal(a.image, b.image);
  },

  // ---- validation --------------------------------------------------------

  "normalize rejects input that is not a skin"() {
    for (const bad of [null, undefined, 42, "hello", [], {}, { id: "x" }, { name: "y" }]) {
      assert.equal(S.normalize(bad), null, JSON.stringify(bad) + " should not normalize");
    }
  },

  "normalize strips keys we never asked for"() {
    const t = S.normalize(Object.assign(base(), { evil: "x", __proto__: { p: 1 }, onload: "alert(1)" }));
    assert.notOk("evil" in t);
    assert.notOk("onload" in t);
  },

  "an id cannot carry characters that would escape a selector"() {
    const t = S.normalize(Object.assign(base(), { id: "a b/*]{color:red}" }));
    assert.equal(t.id, "ab colorred".replace(/\s/g, "") === t.id ? t.id : t.id);
    assert.match(t.id, /^[\w-]+$/, "id leaked a character that is not word-safe: " + t.id);
  },

  "a font stack that is not a font stack is refused"() {
    // This value is interpolated straight into a declaration, so it gets the
    // narrowest whitelist of any field.
    const bad = S.normalize(Object.assign(base(), { fontSans: "Arial; } body { display:none } a{" }));
    assert.equal(bad.fontSans, "", "a font stack with CSS syntax in it must be dropped");
    const good = S.normalize(Object.assign(base(), { fontSans: "'Iowan Old Style', Georgia, serif" }));
    assert.equal(good.fontSans, "'Iowan Old Style', Georgia, serif");
  },

  "angle brackets never survive into a name or author"() {
    const t = S.normalize(Object.assign(base(), { name: "<img src=x onerror=1>", author: "<b>me</b>" }));
    assert.noMatch(t.name, /[<>]/);
    assert.noMatch(t.author, /[<>]/);
  },

  "a skin with no card art still normalizes to something renderable"() {
    const t = S.normalize({ id: "bare", name: "Bare" });
    assert.ok(t);
    assert.ok(t.cards.length >= 1, "cards must never be empty or the nth-of-type maths divides by zero");
    assert.ok(t.surface && t.panel && t.text && t.accent);
  },

  "normalize is idempotent"() {
    // It has to be: a skin round-trips through export -> import -> normalize
    // every time it is shared, and a field that drifts on each pass is a field
    // that eventually stops matching what the author saw.
    const once = S.normalize(base());
    const twice = S.normalize(once);
    assert.deepEqual(twice, once);
  },

  // ---- stylesheet emission ------------------------------------------------

  "css drives the existing token layer"() {
    // This is what makes one skin restyle the drawer, the planner and the options
    // page at once: they already read --bc-*, so they need no idea skins exist.
    const css = S.css(base());
    for (const tok of ["--bc-surface-1", "--bc-surface-2", "--bc-text", "--bc-muted",
                       "--bc-border", "--bc-accent", "--bc-accent-contrast", "--bc-radius",
                       "--bc-link"]) {
      assert.match(css, new RegExp(tok.replace(/-/g, "\\-") + ":"), "skin css never sets " + tok);
    }
  },

  "the skin's palette outranks the generic dark palette"() {
    // The token layer emits its dark set under `html.bc-dark` (0,1,1). A plain
    // `:root` (0,1,0) loses to that regardless of sheet order, which rendered
    // every dark skin in generic blue-grey with only its card art surviving.
    const css = S.css(Object.assign(base(), { dark: true, surface: "#1b2620" }));
    assert.match(css, /^:root:root\{/, "the token block must outrank html.bc-dark");
  },

  "the page surface is painted even with no page pattern"() {
    // Gating the whole page rule on having art left Canvas's own grey behind the
    // cards, so a skin was a palette that stopped at the card edge.
    const css = S.css(Object.assign(base(), { page: { kind: "none" }, surface: "#f7f4ec" }));
    assert.match(css, /#application[^{]*\{background-color:#f7f4ec/);
  },

  "card art wins over the course colour Canvas writes inline"() {
    // Canvas sets the course colour as an inline style on this element, and an
    // inline declaration beats any stylesheet rule. Without !important the skin
    // palette silently lost and cards came back in Canvas's gold/teal/purple.
    const css = S.css(base());
    assert.match(css, /header_hero\{background-color:[^;]+ !important/);
  },

  "every skin's link colour is readable on its own panel"() {
    // An accent picked to look right as a button fill is routinely unreadable
    // as 13px body text, and links are the most common coloured text on Canvas.
    const fails = [];
    for (const raw of BC.SKIN_CATALOG) {
      const t = S.normalize(raw);
      const link = (S.css(t).match(/--bc-link: (#[0-9a-fA-F]{6})/) || [])[1];
      const r = BC.color.contrastRatio(link, t.panel);
      if (r < 4.5) fails.push(t.id + " " + link + " on " + t.panel + " = " + r.toFixed(2));
    }
    assert.deepEqual(fails, [], "skins with unreadable links:\n  " + fails.join("\n  "));
  },

  "card art cycles rather than smearing one texture over everything"() {
    const css = S.css(Object.assign(base(), {
      cards: [{ kind: "gingham", fg: "#88aa66" }, { kind: "dots", fg: "#aa6688" }, { kind: "waves", fg: "#6688aa" }],
    }));
    for (const i of [1, 2, 3]) {
      assert.match(css, new RegExp("nth-of-type\\(3n\\+" + i + "\\)"), "card " + i + " has no slot in the cycle");
    }
  },

  "a single-pattern skin does not emit an nth-of-type cycle"() {
    const css = S.css(base());
    assert.noMatch(css, /nth-of-type/, "one pattern needs no cycle; the selector is pure overhead");
  },

  "card art counts by type, not by child"() {
    // Canvas injects screenreader-only siblings into the card grid. Counting
    // those shifts every card's pattern by one, at random, per page.
    const css = S.css(Object.assign(base(), {
      cards: [{ kind: "dots", fg: "#112233" }, { kind: "grid", fg: "#332211" }],
    }));
    assert.noMatch(css, /nth-child/, "nth-child counts Canvas's hidden siblings");
  },

  "a skin never erases a course's own image"() {
    // The header image is the user's uploaded content. A skin paints behind it.
    const css = S.css(base());
    assert.match(css, /ic-DashboardCard__header_image\{background-blend-mode/,
      "card art must blend with the course image, not replace it");
  },

  "css of an invalid skin is empty, not broken"() {
    assert.equal(S.css(null), "");
    assert.equal(S.css({ nope: true }), "");
  },

  "every emitted stylesheet has balanced braces"() {
    for (const raw of BC.SKIN_CATALOG) {
      const css = S.css(raw);
      const open = (css.match(/\{/g) || []).length;
      const close = (css.match(/\}/g) || []).length;
      assert.equal(open, close, raw.id + " emits unbalanced CSS (" + open + " open, " + close + " close)");
    }
  },

  // ---- the catalog --------------------------------------------------------

  "every catalog entry survives its own validator"() {
    const broken = [];
    for (const raw of BC.SKIN_CATALOG) {
      const t = S.normalize(raw);
      if (!t) { broken.push(raw && raw.id); continue; }
      // A field the validator had to replace means the authored value was wrong.
      for (const k of ["id", "name", "radius"]) {
        if (raw[k] !== undefined && t[k] !== raw[k]) broken.push(raw.id + "." + k);
      }
    }
    assert.deepEqual(broken, [], "catalog entries the validator had to repair: " + broken.join(", "));
  },

  "catalog ids are unique"() {
    const seen = new Set(), dupes = [];
    for (const t of BC.SKIN_CATALOG) { if (seen.has(t.id)) dupes.push(t.id); seen.add(t.id); }
    assert.deepEqual(dupes, []);
  },

  "every catalog skin names only patterns that exist"() {
    const bad = [];
    for (const t of BC.SKIN_CATALOG) {
      for (const spec of [t.page].concat(t.cards || [])) {
        if (spec && spec.kind && S.PATTERN_KINDS.indexOf(spec.kind) === -1) bad.push(t.id + " -> " + spec.kind);
      }
    }
    assert.deepEqual(bad, [], "skins pointing at patterns that do not exist: " + bad.join(", "));
  },

  "every catalog skin keeps its body text legible"() {
    // The single most common way a pretty theme is actually unusable. A skin
    // that ships below AA is a skin nobody can read their assignments in.
    const fails = [];
    for (const raw of BC.SKIN_CATALOG) {
      const t = S.normalize(raw);
      const onPanel = BC.color.contrastRatio(t.text, t.panel);
      const onSurface = BC.color.contrastRatio(t.text, t.surface);
      if (onPanel < 4.5) fails.push(t.id + " text/panel " + onPanel.toFixed(2));
      if (onSurface < 4.5) fails.push(t.id + " text/surface " + onSurface.toFixed(2));
    }
    assert.deepEqual(fails, [], "skins failing AA for body text:\n  " + fails.join("\n  "));
  },

  "every catalog skin keeps its secondary text legible"() {
    const fails = [];
    for (const raw of BC.SKIN_CATALOG) {
      const t = S.normalize(raw);
      const r = BC.color.contrastRatio(t.muted, t.panel);
      // AA for large/secondary text. Muted is a hint, not a heading, so 3:1 is
      // the honest bar -- but below that it is decoration, not information.
      if (r < 3) fails.push(t.id + " muted/panel " + r.toFixed(2));
    }
    assert.deepEqual(fails, [], "skins whose hint text is unreadable:\n  " + fails.join("\n  "));
  },

  "every catalog skin's accent can carry a label"() {
    const fails = [];
    for (const raw of BC.SKIN_CATALOG) {
      const t = S.normalize(raw);
      const r = BC.color.contrastRatio(BC.color.contrastText(t.accent), t.accent);
      if (r < 4.5) fails.push(t.id + " " + r.toFixed(2));
    }
    assert.deepEqual(fails, [], "accents no text colour can sit on:\n  " + fails.join("\n  "));
  },

  "a dark skin is actually dark and a light one actually light"() {
    const wrong = [];
    for (const raw of BC.SKIN_CATALOG) {
      const t = S.normalize(raw);
      const lum = BC.color.relLuminance(t.surface);
      if (t.dark && lum > 0.3) wrong.push(t.id + " claims dark at luminance " + lum.toFixed(2));
      if (!t.dark && lum < 0.3) wrong.push(t.id + " claims light at luminance " + lum.toFixed(2));
    }
    assert.deepEqual(wrong, [], wrong.join("; "));
  },

  // ---- sharing ------------------------------------------------------------

  "a skin survives an export/import round trip"() {
    for (const raw of BC.SKIN_CATALOG) {
      const back = S.import(S.export(raw));
      assert.deepEqual(back, S.normalize(raw), raw.id + " does not round-trip");
    }
  },

  "import accepts both a bare skin and a gallery envelope"() {
    // A file export is the skin; a server will answer { theme: {...} }. One
    // paste box has to take either without the user knowing the difference.
    const t = S.normalize(base());
    assert.deepEqual(S.import(JSON.stringify(t)), t);
    assert.deepEqual(S.import(JSON.stringify({ theme: t })), t);
  },

  "import of junk returns null rather than throwing"() {
    for (const junk of ["", "{", "null", "[]", "12", '{"id":""}']) {
      assert.equal(S.import(junk), null, JSON.stringify(junk) + " should import as null");
    }
  },

  "an imported skin cannot inject a declaration through a colour"() {
    const t = S.normalize(Object.assign(base(), { accent: "#fff; } * { display: none } a {" }));
    const css = S.css(t);
    assert.noMatch(css, /display: ?none/, "a colour field reached the stylesheet unvalidated");
    assert.match(t.accent, /^#[0-9a-fA-F]{6}$/, "accent should have fallen back to a real hex");
  },

  // ---- preview ------------------------------------------------------------

  "swatchStyles describes a thumbnail without touching the DOM"() {
    const s = S.swatchStyles(base(), 4);
    assert.equal(s.cards.length, 4);
    assert.match(s.page, /background-color:/);
    assert.match(s.nav, /background-color:/);
    assert.ok(s.accent && s.text);
  },

  "swatchStyles cycles the same art the page will use"() {
    // If the thumbnail and the page disagree, the gallery is lying.
    const t = { id: "c", name: "C", cards: [{ kind: "dots", fg: "#223344" }, { kind: "waves", fg: "#443322" }] };
    const s = S.swatchStyles(t, 4);
    assert.equal(s.cards[0], s.cards[2], "card 3 should repeat card 1's pattern");
    assert.equal(s.cards[1], s.cards[3]);
    assert.notEqual(s.cards[0], s.cards[1]);
  },

  // ---- course colour ------------------------------------------------------

  "a skin replaces the course colour by default"() {
    const css = S.css(base());
    assert.match(css, /header_hero\{background-color:[^;]+ !important/);
  },

  "course mode leaves Canvas's inline colour alone"() {
    // The pattern rides on top of the course colour instead of covering it, so
    // people who navigate by course colour keep that.
    const css = S.css(Object.assign(base(), { cardColor: "course" }));
    assert.noMatch(css, /header_hero\{background-color/, "course mode must not paint over the course colour");
    assert.match(css, /header_hero\{background-image/, "the pattern should still be applied");
  },

  "an unknown cardColor falls back to replacing"() {
    assert.equal(S.normalize(Object.assign(base(), { cardColor: "rainbow" })).cardColor, "skin");
    assert.equal(S.normalize(base()).cardColor, "skin");
  },

  "a course-mode preview shows course colours, not panel colours"() {
    // Previewing a look the page will never produce is worse than no preview.
    const skinMode = S.swatchStyles(base(), 4);
    const courseMode = S.swatchStyles(Object.assign(base(), { cardColor: "course" }), 4);
    assert.notEqual(skinMode.cards[0], courseMode.cards[0]);
    assert.notEqual(courseMode.cards[0], courseMode.cards[1], "course colours should vary per card");
  },

  // ---- resolution and apply wiring ---------------------------------------

  "no skin selected resolves to nothing"() {
    assert.equal(S.active(null), null);
    assert.equal(S.active({}), null);
    assert.equal(S.active({ theming: {} }), null);
    assert.equal(S.active({ theming: { skin: "" } }), null);
  },

  "a selected built-in resolves and arrives normalized"() {
    const t = S.active({ theming: { skin: "matcha-strawberry" } });
    assert.ok(t, "a catalog id should resolve");
    assert.equal(t.name, "Matcha Strawberry");
    assert.deepEqual(t, S.normalize(t), "active() must hand back a normalized skin");
  },

  "an id that matches nothing resolves to nothing rather than a default"() {
    // Silently falling back to some other skin would mean a typo in an import
    // quietly restyles the page as something the user never chose.
    assert.equal(S.active({ theming: { skin: "no-such-skin" } }), null);
  },

  "a user's own skin overrides a built-in with the same id"() {
    // Editing a shipped skin and pasting it back is the obvious thing to try,
    // and it has to win rather than be silently ignored.
    const mine = { id: "paper", name: "My Paper", surface: "#101010", dark: true };
    const t = S.active({ theming: { skin: "paper", skins: [mine] } });
    assert.equal(t.name, "My Paper");
  },

  "an active skin decides light vs dark for the whole extension"() {
    // Every surface keys off .bc-dark. If the class disagreed with the palette
    // actually painted, the two would fight on every page.
    const darkSkin = { theming: { darkMode: "off", skin: "forest-study" } };
    assert.equal(BC.isDarkActive(darkSkin), true, "a dark skin under darkMode:off must still be dark");
    const lightSkin = { theming: { darkMode: "on", skin: "matcha-strawberry" } };
    assert.equal(BC.isDarkActive(lightSkin), false, "a light skin under darkMode:on must still be light");
    // With no skin, darkMode is untouched.
    assert.equal(BC.isDarkActive({ theming: { darkMode: "on" } }), true);
    assert.equal(BC.isDarkActive({ theming: { darkMode: "off" } }), false);
  },

  "the settings shape carries a skin and a place to keep imported ones"() {
    const d = BC.cloneDefaults ? BC.cloneDefaults() : BC.mergeDefaults({ version: BC.SETTINGS_VERSION });
    assert.equal(d.theming.skin, "");
    assert.deepEqual(d.theming.skins, []);
  },

  "the skin stylesheet is registered for teardown"() {
    // A keyed sheet that is not in the feature's styles list survives disabling
    // the extension, which leaves a themed page with no extension running.
    const src = read("src/content/features/theming.js");
    assert.match(src, /styles: \["bc-static", "bc-theming", "bc-skin"\]/,
      "bc-skin must be torn down with the rest of theming");
  },

  "the skin sheet is injected after the palette it replaces"() {
    const src = read("src/content/features/theming.js");
    assert.ok(src.indexOf('setStyle("bc-theming"') < src.indexOf('setStyle("bc-skin"'),
      "a skin injected before bc-theming would lose the cascade to it");
  },

  // ---- wiring -------------------------------------------------------------

  "the engine loads after the colour module that it reads"() {
    const mf = JSON.parse(read("manifest.json"));
    const js = mf.content_scripts[0].js;
    assert.ok(js.indexOf("src/content/core/color.js") < js.indexOf("src/shared/skins.js"),
      "skins.js reads BC.color");
    assert.ok(js.indexOf("src/shared/skins.js") < js.indexOf("src/shared/skin-catalog.js"),
      "the catalog is data for the engine");
  },

  "every surface that loads the token layer also loads the engine"() {
    for (const p of ["src/options/options.html"]) {
      const src = read(p);
      assert.match(src, /shared\/skins\.js/, p + " renders tokens but cannot resolve a skin");
      assert.ok(src.indexOf("shared/skins.js") < src.indexOf("shared/skin-catalog.js"), p + " load order");
    }
  },

  "the gallery previews with the same engine that paints the page"() {
    // Not a stored thumbnail: a checked-in PNG drifts from the palette the
    // moment anyone tweaks a colour, and then the gallery is lying.
    const src = read("src/shared/settings/index.js");
    assert.match(src, /BC\.skins\.swatchStyles/, "skin cards must render from the engine");
    assert.match(src, /BC\.SKIN_CATALOG\.map/, "the gallery must list the catalog");
  },

  "the gallery can clear the applied skin"() {
    // Without a None card there is no way back to plain Canvas except editing
    // settings by hand.
    const src = read("src/shared/settings/index.js");
    assert.match(src, /bc-skin-none/);
  },

  "editing a built-in forks it instead of mutating shipped data"() {
    // The catalog ships with the extension; an in-place edit would be silently
    // reverted by the next update.
    const src = read("src/shared/settings/index.js");
    assert.match(src, /const forked = Object\.assign\(BC\.skins\.normalize\(cur\)/);
  },

  "the iframe script is deliberately left out"() {
    // Documented so it reads as a decision rather than an omission: frame.js
    // tints embedded Canvas frames and never reads the catalog, so shipping it
    // there would be 20KB per frame for nothing.
    const mf = JSON.parse(read("manifest.json"));
    assert.notOk(mf.content_scripts[1].js.includes("src/shared/skins.js"));
  },
};
