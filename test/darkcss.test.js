"use strict";
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./harness");
const { splitCompounds } = require("./cssmatch");

const AUTHORED_ROOTS = new Set([
  "user_content", "show-content", "description", "assignment-description",
  "discussion-topic-body",
]);

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// The dark-mode rule text from each file that emits any.
function darkCss() {
  const out = [];
  for (const f of ["src/content/features/theming.js", "src/content/frame.js"]) {
    const src = read(f);
    for (const m of src.matchAll(/`([\s\S]*?)`/g)) {
      if (m[1].includes("bc-dark")) out.push({ file: f, css: m[1] });
    }
  }
  return out;
}

// [selector, declarations] pairs. Comments are stripped first: prose inside a
// /* ... */ block otherwise parses as a selector.
function rules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...clean.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
    selector: m[1].trim().replace(/\s+/g, " "),
    body: m[2].trim(),
  }));
}

// Canvas elements that carry imagery or a user-chosen colour of their own.
// The card container itself is deliberately darkened, so it is not listed: only
// the parts whose appearance is somebody's choice rather than chrome.
const ARTWORK = [
  "ic-DashboardCard__header_image",   // the course image
  "ic-DashboardCard__header_hero",    // the course colour
  "ic-DashboardCard__header",         // wrapper for both
];

// A selector matches a class name when every [class*="x"] it requires is present
// and no [class*="x"] inside a :not() is. Excluded substrings have to be pulled
// out first or a :not() would read as another requirement.
function substringMatch(selector, className) {
  const lower = className.toLowerCase();
  const excluded = [...selector.matchAll(/:not\(\[class\*=["']([^"']+)["']\s*i?\]\)/g)].map((m) => m[1].toLowerCase());
  const bare = selector.replace(/:not\([^)]*\)/g, "");
  const required = [...bare.matchAll(/\[class\*=["']([^"']+)["']\s*i?\]/g)].map((m) => m[1].toLowerCase());
  if (!required.length) return false;
  if (!required.every((sub) => lower.includes(sub))) return false;
  return !excluded.some((sub) => lower.includes(sub));
}

module.exports = {
  "no dark-mode rule uses the background shorthand"() {
    // `background: <colour>` resets background-image to none, so any rule using
    // the shorthand silently deletes whatever image sits on the element it
    // matches. That is what blanked the dashboard course card artwork.
    for (const { file, css } of darkCss()) {
      for (const r of rules(css)) {
        assert.noMatch(r.body, /(^|[;\s])background:\s/,
          `${file}: "${r.selector.slice(0, 70)}" uses the background shorthand, which erases background-image; use background-color`);
      }
    }
  },

  "no substring selector matches the course card artwork"() {
    // Substring matching survives Canvas renaming its containers, but it has to
    // be chosen carefully: [class*="ic-Dashboard"] together with [class*="header"]
    // also matches ic-DashboardCard__header_image.
    for (const { file, css } of darkCss()) {
      for (const r of rules(css)) {
        for (const part of r.selector.split(",")) {
          for (const cls of ARTWORK) {
            assert.notOk(substringMatch(part, cls),
              `${file}: "${part.trim()}" matches ${cls} by substring, which would repaint the course card`);
          }
        }
      }
    }
  },

  "the dashboard header is still covered by its own names"() {
    // Dropping the over-broad selector must not lose the fix it was there for.
    const css = darkCss().map((d) => d.css).join("\n");
    for (const needed of ["Dashboard-header", "dashboard_header_container"]) {
      assert.ok(css.includes(needed), `the dashboard header must still be darkened via ${needed}`);
    }
  },

  "every rule that darkens a surface also sets its text colour"() {
    for (const { file, css } of darkCss()) {
      for (const r of rules(css)) {
        if (!/background-color:\s*var\(--bc-(d-bg|surface)/.test(r.body)) continue;
        // The sweep rule deliberately sets background only: the text on those
        // surfaces already inherits our light colour.
        if (r.selector.includes("data-bc-lit")) continue;
        assert.match(r.body, /color:\s*var\(--bc-(d-text|text)/,
          `${file}: "${r.selector.slice(0, 70)}" darkens a surface without setting the text colour`);
      }
    }
  },

  "course card colour and artwork are never repainted by the sweep"() {
    const src = read("src/content/features/theming.js");
    // Artwork and course colours are protected by MEASUREMENT, not by excluding
    // the card subtree. Excluding it also shielded the card's plain white body,
    // which left a white panel under every header in dark mode.
    assert.noMatch(src, /NO_REPAINT_SCOPES/,
      "a card needs no scope exclusion; isSweepable already protects what matters");
    assert.match(src, /if \(backgroundImage && backgroundImage !== "none"\) return false;/,
      "artwork is protected by skipping anything carrying a background image");
    assert.match(src, /chroma\(backgroundColor\) > NEUTRAL_MAX_CHROMA\) return false;/,
      "course colours are protected by skipping saturated fills");
    assert.match(src, /function isSweepable\(backgroundColor, backgroundImage\)/,
      "the sweep decision should be a named, testable predicate");
    assert.match(src, /if \(backgroundImage && backgroundImage !== "none"\) return false;/,
      "the sweep must skip anything carrying a background image");
  },

  "the frame stylesheet follows the same rules"() {
    // Subframes get their own sheet; the same shorthand bug would blank
    // SpeedGrader and New Quizzes imagery.
    const src = read("src/content/frame.js");
    assert.noMatch(src, /(^|[;\s])background:\s*var\(--bc-/m,
      "frame.js must not use the background shorthand either");
  },

  "the substring matcher itself is right"() {
    // The whole test above rests on this, so check it directly.
    assert.ok(substringMatch('[class*="card" i]', "ic-DashboardCard__header_image"));
    assert.notOk(substringMatch('[class*="card" i]:not([class*="image" i])', "ic-DashboardCard__header_image"));
    assert.ok(substringMatch('[class*="card" i]:not([class*="image" i])', "ic-Card"));
    assert.ok(substringMatch('[class*="ic-Dashboard" i][class*="header" i]', "ic-DashboardCard__header"));
    assert.notOk(substringMatch('.some-plain-class', "ic-DashboardCard"));
  },

  "no dark rule sets a text colour on a surface it does not also darken"() {
    // The inverse of the rule above, and the one that actually bit: a
    // colour-only rule leaves Canvas's light background in place and paints
    // near-white text onto it. Every colour-only selector must therefore name
    // something that sits INSIDE a surface darkened elsewhere in the sheet, not
    // a surface of its own.
    const darkened = new Set();
    for (const { css } of darkCss()) {
      for (const r of rules(css)) {
        if (!/background-color:/.test(r.body)) continue;
        for (const part of r.selector.split(",")) {
          const m = part.trim().match(/\.([\w-]+)\s*$/);
          if (m) darkened.add(m[1]);
        }
      }
    }
    for (const { file, css } of darkCss()) {
      for (const r of rules(css)) {
        if (/background-color:/.test(r.body)) continue;
        if (!/color:\s*var\(--bc-(d-text|text)/.test(r.body)) continue;
        for (const part of r.selector.split(",")) {
          const sel = part.trim();
          // A descendant selector is fine: its ancestor carries the surface.
          if (splitCompounds(sel).length > 2) continue;
          const m = sel.match(/\.([\w-]+)\s*$/);
          if (!m) continue;
          // Authored prose roots are transparent by design: they sit on the
          // container we darkened, and a box inside them that paints its own
          // background is handed back legible ink via data-bc-paper.
          if (AUTHORED_ROOTS.has(m[1])) continue;
          assert.ok(darkened.has(m[1]),
            `${file}: "${sel}" sets our text colour on .${m[1]}, which nothing darkens, so it lands on Canvas's light background`);
        }
      }
    }
  },

  "table cells are darkened, not just the table"() {
    // A cell paints its own background, so darkening only the table left the
    // cells light under inherited light text.
    const css = darkCss().map((d) => d.css).join("\n");
    for (const sel of ["html.bc-dark th", "html.bc-dark td"]) {
      assert.ok(css.includes(sel), `${sel} must be darkened or its text is unreadable`);
    }
  },

  "the course colour block is not painted with our ink"() {
    // It is a fill the user chose; forcing our light text onto it ignores
    // whatever contrast that colour actually has.
    const css = darkCss().map((d) => d.css).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.noMatch(css, /ic-DashboardCard__header_hero/,
      "the course colour block should be left to the card's own styling");
  },
};
