"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, ROOT } = require("./harness");

const BC = loadCore(createSandbox());
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Files that legitimately contain literal colours: they DEFINE the palette, or
// they compute against fixed endpoints.
const PALETTE_SOURCES = new Set([
  "src/shared/tokens.js",       // the token values themselves
  "src/shared/themes.js",       // tone and preset definitions
  "src/content/core/color.js",  // contrast maths against black/white endpoints
  "src/shared/defaults.js",     // default cosmetic background colours
  "src/content/core/toast.js",  // documented exception, see below
  "src/background/service-worker.js", // chrome.action badge colour, not CSS
]);

function jsFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

// Real CSS properties that take a colour. Matching on the property name (rather
// than on anything shaped like "key: #hex") is what keeps JS object literals --
// an <input type="color"> default, a chrome.action badge colour -- out of the
// results.
const COLOR_PROPS = [
  "color", "background", "background-color", "background-image", "border",
  "border-color", "border-top", "border-right", "border-bottom", "border-left",
  "border-top-color", "border-bottom-color", "border-left-color", "border-right-color",
  "outline", "outline-color", "box-shadow", "text-shadow", "fill", "stroke",
  "caret-color", "accent-color", "column-rule", "text-decoration-color",
];
const DECL = new RegExp("(?:^|[;{]|\\s)(" + COLOR_PROPS.join("|") + ")\\s*:");

// A literal colour inside a CSS declaration, ignoring var() fallbacks and comments.
function cssColorLiterals(src) {
  const out = [];
  for (const [i, line] of src.split("\n").entries()) {
    const code = line.replace(/\/\/.*$/, "");
    if (/^\s*\*|^\s*\/\*/.test(code)) continue;
    if (!DECL.test(code)) continue;
    for (const m of code.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const before = code.slice(0, m.index);
      if (/var\(--[\w-]+,\s*[^)]*$/.test(before)) continue;   // documented fallback
      out.push({ line: i + 1, color: m[0], text: code.trim().slice(0, 120) });
    }
  }
  return out;
}

module.exports = {
  "no feature stylesheet hardcodes a colour outside the token system"() {
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      if (PALETTE_SOURCES.has(rel)) continue;
      const found = cssColorLiterals(fs.readFileSync(abs, "utf8"));
      // theming.js's high-contrast focus ring is a deliberate fixed yellow.
      const violations = found.filter((f) => !(rel.endsWith("theming.js") && f.color === "#ffeb3b"));
      assert.equal(violations.length, 0,
        `${rel} hardcodes ${violations.map((v) => v.color + " @" + v.line).join(", ")}; use a --bc-* token so it re-tints per mode`);
    }
  },

  "the toast palette exception is still accurate"() {
    // toast.js keeps fixed dark chips on purpose: a surface-coloured toast
    // disappears against the page in dark mode. The claim is that each chip
    // clears AA against white text, so verify that rather than trusting it.
    const chips = { info: "#1f2937", success: "#0f5132", warn: "#8a5a00", error: "#7f1d1d" };
    const src = read("src/content/core/toast.js");
    for (const [level, hex] of Object.entries(chips)) {
      assert.ok(src.includes(".bc-toast." + level) && src.includes(hex),
        `toast.${level} is no longer ${hex}; re-check its contrast`);
      const ratio = BC.color.contrastRatio("#ffffff", hex);
      assert.ok(ratio >= 4.5, `white on the ${level} toast is ${ratio.toFixed(2)}:1`);
    }
  },

  "the settings switch adapts to the theme in both states"() {
    const src = read("src/shared/settings/index.js");
    assert.match(src, /\.bc-switch \{[^}]*background: var\(/, "the off state must use a token");
    assert.match(src, /\.bc-switch-thumb \{[^}]*background: var\(/, "the thumb must use a token");
  },

  "text on the accent uses the derived contrast colour"() {
    // The accent is user-chosen, so white is not always legible on it.
    const src = read("src/shared/settings/index.js");
    assert.match(src, /\.bc-logo \{[\s\S]*?color: var\(--bc-accent-contrast/);
  },

  "every --bc-* variable a stylesheet reads is one the token layer emits"() {
    // A typo'd token silently falls back to the literal default forever.
    const emitted = new Set();
    const r = BC.tokens.resolve({});
    for (const k of Object.keys(r.light)) emitted.add("--bc-" + k);
    for (const m of BC.tokens.staticCss().matchAll(/(--bc-[\w-]+)\s*:/g)) emitted.add(m[1]);
    // Aliases and runtime-set properties.
    // Set at runtime rather than emitted by the token layer: aliases, values
    // driven by a setting, and per-element stamps whose value differs per node
    // (--bc-course is one course colour per card, so it cannot be a rule).
    for (const extra of ["--bc-d-bg", "--bc-d-bg2", "--bc-d-bg3", "--bc-d-border",
                         "--bc-d-text", "--bc-d-muted", "--bc-d-link",
                         "--bc-density", "--bc-todo-accent", "--bc-sidebar-w",
                         "--bc-pattern-ink", "--bc-ruler-tint", "--bc-note-bg",
                         "--bc-note-border", "--bc-note-text", "--bc-course"]) emitted.add(extra);

    const missing = new Map();
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      const src = fs.readFileSync(abs, "utf8");
      for (const m of src.matchAll(/var\((--bc-[\w-]+)/g)) {
        // Some tokens are built by concatenation, e.g. "var(--bc-grade-" + band.
        // Accept a name that is a prefix of at least one emitted token.
        if (emitted.has(m[1])) continue;
        if ([...emitted].some((e) => e.startsWith(m[1]))) continue;
        if (!missing.has(m[1])) missing.set(m[1], rel);
      }
    }
    assert.equal(missing.size, 0,
      "unknown tokens referenced: " + [...missing].map(([k, f]) => `${k} (${f})`).join(", "));
  },

  "the z-index scale covers every layer the UI stacks"() {
    const css = BC.tokens.staticCss();
    const layers = ["dock", "underlay", "hud", "popover", "drawer", "modal", "palette", "toast"];
    const values = layers.map((l) => {
      const m = css.match(new RegExp("--bc-z-" + l + ":\\s*(\\d+)"));
      assert.ok(m, `--bc-z-${l} is missing`);
      return Number(m[1]);
    });
    for (let i = 1; i < values.length; i++) {
      assert.ok(values[i] > values[i - 1],
        `z-index scale is out of order: ${layers[i]} (${values[i]}) must sit above ${layers[i - 1]} (${values[i - 1]})`);
    }
  },

  "toasts sit above every other floating surface"() {
    const css = BC.tokens.staticCss();
    const get = (n) => Number(css.match(new RegExp("--bc-z-" + n + ":\\s*(\\d+)"))[1]);
    for (const other of ["dock", "hud", "popover", "drawer", "modal", "palette"]) {
      assert.ok(get("toast") > get(other), `toasts must outrank ${other}`);
    }
  },

  "the bottom-right corner is arbitrated by one shared variable"() {
    // The toast stack, the Pomodoro dock and the page-utility buttons all anchor
    // near this corner and used to overlap.
    assert.match(BC.tokens.staticCss(), /--bc-dock-bottom:/);
    assert.match(read("src/content/core/toast.js"), /bottom: calc\([^)]*var\(--bc-dock-bottom/);
    assert.match(read("src/content/features/todo.js"), /--bc-dock-bottom/);
    // The utility buttons moved out of the contested corner entirely.
    const prod = read("src/content/features/productivity.js");
    assert.match(prod, /\.bc-copyurl-btn, \.bc-print-btn \{[^}]*left: 16px/,
      "the utility buttons must not share the toast corner");
  },

  "motion respects both the in-app switch and the OS setting"() {
    const css = BC.tokens.staticCss();
    assert.match(css, /:root\[data-bc-motion="0"\]/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  },

  "spacing, radius and type all derive from a single scale"() {
    const css = BC.tokens.staticCss();
    assert.match(css, /--bc-space-unit: calc\(4px \* var\(--bc-space-scale/);
    assert.match(css, /--bc-radius-md: var\(--bc-radius\)/);
    assert.match(css, /--bc-text-md:\s*calc\(14px \* var\(--bc-font-scale\)\)/);
  },

  "corner radius always derives from the user's slider"() {
    // A literal radius ignores the global corner-radius setting, so turning it
    // to 0 left some surfaces rounded and the panels stopped matching.
    // 999px (pill) and 50% (circle) are shapes, not radii, and are exempt.
    const SHAPES = new Set(["999px", "50%", "0", "inherit"]);
    const offenders = [];
    for (const abs of jsFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      const src = fs.readFileSync(abs, "utf8");
      for (const [i, line] of src.split("\n").entries()) {
        for (const m of line.matchAll(/border-radius:\s*([^;\n]+)/g)) {
          const v = m[1].replace("!important", "").trim();
          if (v.includes("var(") || SHAPES.has(v) || v.startsWith("${")) continue;
          offenders.push(`${rel}:${i + 1} (${v})`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      "literal border-radius values ignore the radius slider: " + offenders.join(", "));
  },

  "top-level feature panels share one surface treatment"() {
    // These are the panels a user sees side by side on the dashboard; they used
    // to disagree on radius (10 vs 12) and padding (10 vs 12 vs 14).
    const panels = [
      ["src/content/features/announcements.js", ".bc-ann-panel"],
      ["src/content/features/calendar.js", ".bc-mini-cal"],
      ["src/content/features/semester.js", ".bc-semester"],
      ["src/content/features/modules.js", ".bc-mod-summary"],
      ["src/content/features/syllabus.js", ".bc-syl"],
      ["src/content/features/quizsaver.js", ".bc-quiz-banner"],
      ["src/content/features/todo.js", ".bc-todo"],
    ];
    for (const [file, sel] of panels) {
      const src = read(file);
      const i = src.indexOf(sel + " {");
      assert.ok(i > -1, `${sel} not found in ${file}`);
      const block = src.slice(i, src.indexOf("}", i));
      assert.match(block, /border-radius:\s*var\(--bc-radius/,
        `${sel} must take its radius from the token scale`);
      assert.match(block, /padding:\s*[^;]*var\(--bc-space/,
        `${sel} must take its padding from the spacing scale so density applies`);
    }
  },

  "a per-element custom property is set alongside a fallback"() {
    // --bc-course is one colour per card, so it cannot be a stylesheet rule. Any
    // rule reading it must still render sensibly on a card whose colour could
    // not be resolved.
    const src = read("src/content/features/dashboard.js");
    for (const m of src.matchAll(/var\(--bc-course([^)]*)\)/g)) {
      assert.match(m[1], /^,\s*\S/, "var(--bc-course) must carry a fallback");
    }
    assert.match(src, /card\.style\.setProperty\("--bc-course"/,
      "the property has to actually be stamped on the card");
    assert.match(src, /clearCourseIdentity/, "and cleared on teardown");
  },
};
