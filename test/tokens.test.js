"use strict";
const { createSandbox, loadCore } = require("./harness");
const BC = loadCore(createSandbox());
const C = BC.color;

// Every shipped combination a user can reach from the Appearance tab.
function allThemings() {
  const out = [];
  for (const tone of Object.keys(BC.DARK_TONES)) {
    for (const preset of Object.keys(BC.LIGHT_PRESETS)) {
      out.push({ darkTone: tone, lightPreset: preset, accentColor: "" });
    }
  }
  for (const t of BC.PRESET_THEMES) out.push(t.settings.theming);
  // Hostile custom values a user can actually set.
  for (const bg of ["#ffffff", "#000000", "#808080", "#e8e8e8", "#7f7f7f", "#1a1a1a"]) {
    out.push({ darkBg: bg, accentColor: "#ff0000" });
    out.push({ darkBg: bg, accentColor: "" });
  }
  return out;
}

const AA = 4.5, AA_NONTEXT = 3.0;

module.exports = {
  "body text clears AA on every surface, in every shipped theme"() {
    for (const th of allThemings()) {
      const r = BC.tokens.resolve(th);
      for (const mode of ["light", "dark"]) {
        const t = r[mode];
        for (const surf of ["surface-1", "surface-2", "surface-3"]) {
          const ratio = C.contrastRatio(t.text, t[surf]);
          assert.ok(ratio >= AA,
            `text on ${surf} in ${mode} = ${ratio.toFixed(2)} for ${JSON.stringify(th)}`);
        }
      }
    }
  },

  "muted text clears AA on every surface"() {
    for (const th of allThemings()) {
      const r = BC.tokens.resolve(th);
      for (const mode of ["light", "dark"]) {
        const t = r[mode];
        for (const surf of ["surface-1", "surface-2", "surface-3"]) {
          const ratio = C.contrastRatio(t.muted, t[surf]);
          assert.ok(ratio >= AA,
            `muted on ${surf} in ${mode} = ${ratio.toFixed(2)} for ${JSON.stringify(th)}`);
        }
      }
    }
  },

  "text-subtle clears AA on the surfaces it is used on"() {
    for (const th of allThemings()) {
      const r = BC.tokens.resolve(th);
      for (const mode of ["light", "dark"]) {
        const t = r[mode];
        for (const surf of ["surface-2", "surface-3"]) {
          const ratio = C.contrastRatio(t["text-subtle"], t[surf]);
          assert.ok(ratio >= AA,
            `text-subtle on ${surf} in ${mode} = ${ratio.toFixed(2)} for ${JSON.stringify(th)}`);
        }
      }
    }
  },

  "accent-contrast is legible on the accent fill"() {
    for (const th of allThemings()) {
      const r = BC.tokens.resolve(th);
      for (const mode of ["light", "dark"]) {
        const t = r[mode];
        const ratio = C.contrastRatio(t["accent-contrast"], t.accent);
        // Bounded by the accent itself; contrastText picks the better endpoint,
        // so assert we are at least at the non-text floor and never worse than
        // the best achievable.
        const best = Math.max(C.contrastRatio("#ffffff", t.accent), C.contrastRatio("#000000", t.accent));
        assert.ok(ratio >= Math.min(AA, best) - 0.01,
          `accent-contrast in ${mode} = ${ratio.toFixed(2)} (best ${best.toFixed(2)}) for ${JSON.stringify(th)}`);
      }
    }
  },

  "accent-stroke clears the 3:1 non-text floor on panels"() {
    for (const th of allThemings()) {
      const r = BC.tokens.resolve(th);
      for (const mode of ["light", "dark"]) {
        const t = r[mode];
        const ratio = C.contrastRatio(t["accent-stroke"], t["surface-2"]);
        assert.ok(ratio >= AA_NONTEXT,
          `accent-stroke in ${mode} = ${ratio.toFixed(2)} for ${JSON.stringify(th)}`);
      }
    }
  },

  "every semantic fill carries a legible foreground"() {
    for (const th of allThemings()) {
      const r = BC.tokens.resolve(th);
      for (const mode of ["light", "dark"]) {
        const t = r[mode];
        for (const kind of ["success", "warn", "danger", "info"]) {
          // Dark-mode *-bg values are rgba washes, so only the solid fills are
          // checkable here; the fg tokens pair with those solid fills.
          const ratio = C.contrastRatio(t[kind + "-fg"], t[kind]);
          assert.ok(ratio >= AA, `${kind}-fg on ${kind} in ${mode} = ${ratio.toFixed(2)}`);
        }
      }
    }
  },

  "every grade band carries a legible foreground"() {
    const r = BC.tokens.resolve({});
    for (const mode of ["light", "dark"]) {
      for (const band of ["a", "b", "c", "d", "f"]) {
        const fill = r[mode]["grade-" + band];
        const fg = r[mode]["grade-" + band + "-fg"];
        const ratio = C.contrastRatio(fg, fill);
        assert.ok(ratio >= AA, `grade-${band}-fg in ${mode} = ${ratio.toFixed(2)}`);
      }
    }
  },

  "muted stays distinct from body text whenever the surface admits it"() {
    for (const th of allThemings()) {
      const r = BC.tokens.resolve(th);
      for (const mode of ["light", "dark"]) {
        const t = r[mode];
        if (r.guard[mode].hierarchyCollapsed) continue;   // reported, asserted below
        assert.ok(C.contrastRatio(t.muted, t.text) >= 1.3,
          `muted indistinct from text in ${mode} for ${JSON.stringify(th)}`);
      }
    }
  },

  "every shipped theme supports a real type hierarchy"() {
    // Only a free-form custom background can defeat this; nothing reachable from
    // the tone/preset/accent pickers may.
    for (const tone of Object.keys(BC.DARK_TONES)) {
      for (const preset of Object.keys(BC.LIGHT_PRESETS)) {
        const g = BC.tokens.resolve({ darkTone: tone, lightPreset: preset }).guard;
        assert.notOk(g.hierarchyCollapsed, `hierarchy collapsed for ${tone}/${preset}`);
      }
    }
    for (const t of BC.PRESET_THEMES) {
      const g = BC.tokens.resolve(t.settings.theming).guard;
      assert.notOk(g.hierarchyCollapsed, `hierarchy collapsed for preset theme ${t.id}`);
    }
  },

  "a collapsed hierarchy is always accompanied by the surface fallback"() {
    // Otherwise the user would get an unusable hierarchy with no notice anywhere.
    for (const th of allThemings()) {
      const g = BC.tokens.resolve(th).guard;
      if (g.hierarchyCollapsed) {
        assert.ok(g.surfaceFallback,
          `hierarchy collapsed with no surface fallback for ${JSON.stringify(th)}`);
      }
    }
  },

  "a mid-grey custom dark background reports a collapsed hierarchy"() {
    const g = BC.tokens.resolve({ darkBg: "#808080" }).guard;
    assert.ok(g.hierarchyCollapsed);
    assert.ok(g.surfaceFallback);
  },

  "css() emits a light block and a dark block by default"() {
    const css = BC.tokens.css({});
    assert.match(css, /^:root \{/);
    assert.match(css, /html\.bc-dark \{/);
  },

  "css(mode:light) emits no dark block"() {
    const css = BC.tokens.css({}, { mode: "light" });
    assert.noMatch(css, /html\.bc-dark \{/);
  },

  "css(mode:dark) scopes the dark tokens to the given selector"() {
    const css = BC.tokens.css({}, { mode: "dark", scope: ".x" });
    assert.match(css, /^\.x \{/);
    assert.noMatch(css, /html\.bc-dark/);
  },

  "signature changes when any input that affects output changes"() {
    const base = { darkMode: "off", radius: 8 };
    const sig = BC.tokens.signature(base);
    assert.notEqual(sig, BC.tokens.signature({ ...base, radius: 12 }));
    assert.notEqual(sig, BC.tokens.signature({ ...base, darkMode: "on" }));
    assert.notEqual(sig, BC.tokens.signature({ ...base, accentColor: "#ff0000" }));
    assert.equal(sig, BC.tokens.signature({ ...base }));
  },

  "safeFontStack rejects CSS injection but keeps real stacks"() {
    assert.equal(BC.tokens.safeFontStack("Inter, system-ui, sans-serif"), "Inter, system-ui, sans-serif");
    assert.equal(BC.tokens.safeFontStack('"Segoe UI", Roboto'), '"Segoe UI", Roboto');
    assert.equal(BC.tokens.safeFontStack("Inter; } html{display:none} .x {"), "");
    assert.equal(BC.tokens.safeFontStack("a{}"), "");
    assert.equal(BC.tokens.safeFontStack("url(evil)"), "");
  },

  "staticCss defines every scale the feature CSS references"() {
    const css = BC.tokens.staticCss();
    for (const v of ["--bc-space-5", "--bc-radius-md", "--bc-text-md", "--bc-dur-2", "--bc-z-toast", "--bc-ease-out"]) {
      assert.match(css, new RegExp(v.replace(/-/g, "\\-") + "\\s*:"), `missing ${v}`);
    }
  },
};
