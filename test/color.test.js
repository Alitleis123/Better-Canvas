"use strict";
const { createSandbox, loadCore } = require("./harness");
const BC = loadCore(createSandbox());
const C = BC.color;

module.exports = {
  "normalizeHex expands shorthand and lowercases"() {
    assert.equal(C.normalizeHex("#ABC"), "#aabbcc");
    assert.equal(C.normalizeHex("FF0000"), "#ff0000");
    assert.equal(C.normalizeHex("nope"), "");
  },

  "contrastRatio matches WCAG reference values"() {
    assert.close(C.contrastRatio("#000000", "#ffffff"), 21, 0.01);
    assert.close(C.contrastRatio("#ffffff", "#ffffff"), 1, 0.01);
    // Known reference pair: #767676 on white is the AA threshold.
    assert.close(C.contrastRatio("#767676", "#ffffff"), 4.54, 0.05);
  },

  "contrastText picks the legible endpoint"() {
    assert.equal(C.contrastText("#ffffff"), "#16181d");
    assert.equal(C.contrastText("#000000"), "#ffffff");
  },

  "ensureContrast reaches the requested ratio for every hue"() {
    const bgs = ["#ffffff", "#000000", "#8a8a8a", "#4f46e5", "#fdf6e3", "#002b36", "#7f7f7f"];
    for (const bg of bgs) {
      const out = C.ensureContrast("#808080", bg, 4.5);
      assert.ok(C.contrastRatio(out, bg) >= 4.5,
        `ensureContrast failed on ${bg}: got ${C.contrastRatio(out, bg).toFixed(2)}`);
    }
  },

  "ensureContrast picks the endpoint with more headroom for mid greys"() {
    // The documented regression: a relative-luminance test sends #8a8a8a toward
    // white (3.4:1) when black reaches 6.1:1.
    const out = C.ensureContrast("#8a8a8a", "#8a8a8a", 4.5);
    assert.ok(C.contrastRatio(out, "#8a8a8a") >= 4.5);
  },

  "mix clamps weight and is symmetric at the endpoints"() {
    assert.equal(C.mix("#000000", "#ffffff", 0), "#000000");
    assert.equal(C.mix("#000000", "#ffffff", 1), "#ffffff");
    assert.equal(C.mix("#000000", "#ffffff", 2), "#ffffff");
    assert.equal(C.mix("#000000", "#ffffff", -1), "#000000");
  },

  "themePalettes honours a custom dark background over the tone preset"() {
    const p = C.themePalettes({ darkBg: "#123456", darkTone: "nord" });
    assert.equal(p.dark.bg, "#123456");
  },

  "themePalettes falls back to the neutral tone for an unknown tone"() {
    const p = C.themePalettes({ darkTone: "does-not-exist" });
    assert.equal(p.dark.bg, BC.DARK_TONES.neutral.bg);
  },
};
