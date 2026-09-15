"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, load, ROOT } = require("./harness");

const BC = loadCore(createSandbox());
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const PAYLOAD = '"><img src=x onerror=alert(1)>';

module.exports = {
  "escapeHtml neutralises an attribute-breakout payload"() {
    const out = BC.util.escapeHtml(PAYLOAD);
    assert.noMatch(out, /</);
    assert.noMatch(out, />/);
    assert.noMatch(out, /"/);
  },

  "safeFontStack blocks CSS rule injection through the font setting"() {
    // theming.js interpolates this straight into a declaration.
    for (const evil of [
      "Inter; } html{display:none} .x {",
      "a; background: url(http://evil.test)",
      "}{",
      "x/*",
      "expression(alert(1))",
    ]) {
      assert.equal(BC.tokens.safeFontStack(evil), "", `allowed: ${evil}`);
    }
  },

  "safeFontStack still allows legitimate stacks"() {
    for (const ok of ["Inter", "Inter, sans-serif", '"Segoe UI", Roboto, Arial', "Söhne, sans-serif"]) {
      assert.equal(BC.tokens.safeFontStack(ok), ok, `rejected: ${ok}`);
    }
  },

  "isSafeUrl blocks javascript: and html data URLs on the logo and background"() {
    // These feed CSS url() and an <img>-ish background.
    for (const evil of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox",
      " javascript:alert(1)",
    ]) {
      assert.notOk(BC.util.isSafeUrl(evil), `allowed: ${evil}`);
    }
    assert.ok(BC.util.isSafeUrl("https://cdn.test/logo.png"));
    assert.ok(BC.util.isSafeUrl("data:image/png;base64,AAAA"));
  },

  "isSafeHttpUrl gates custom navigation links"() {
    // navigation.js writes these into an <a href>.
    for (const evil of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "chrome://settings"]) {
      assert.notOk(BC.util.isSafeHttpUrl(evil), `allowed: ${evil}`);
    }
    assert.ok(BC.util.isSafeHttpUrl("https://example.test/x"));
  },

  "navigation refuses to render a custom link with an unsafe URL"() {
    const src = read("src/content/features/navigation.js");
    assert.match(src, /isSafeHttpUrl\(l\.url\)/,
      "custom links must be scheme-checked before becoming an href");
  },

  "the logo replacement is scheme-checked before reaching CSS"() {
    const src = read("src/content/features/theming.js");
    assert.match(src, /isSafeUrl\(t\.logo\.url\)/);
  },

  "the dashboard card background image is scheme-checked"() {
    const src = read("src/content/features/dashboard.js");
    assert.match(src, /isSafeUrl\(spec\.bgImage\)/);
  },

  "the cosmetic background image is scheme-checked"() {
    const src = read("src/content/features/cosmetics.js");
    assert.match(src, /isSafeUrl\(cfg\.image\)/);
  },

  "values from settings and bcLocal are escaped before entering HTML attributes"() {
    // The settings Import button accepts an arbitrary JSON file, so "local" data
    // is attacker-controllable. These are the attributes that carry it.
    const checks = [
      ["src/content/features/grades.js", /value="\$\{esc\(goal\)\}"/, "grade goal"],
      ["src/content/features/grades.js", /value="\$\{esc\(start\)\}"/, "rubric slider value"],
      ["src/content/features/todo.js", /data-key="\$\{esc\(key\)\}"/, "planner item key"],
      ["src/content/features/todo.js", /value="\$\{esc\(\(local\.estimates/, "time estimate"],
      ["src/content/features/files.js", /data-id="\$\{BC\.util\.escapeHtml\(f\.id\)\}"/, "file id"],
    ];
    for (const [file, re, what] of checks) {
      assert.match(read(file), re, `${what} is interpolated into an attribute unescaped`);
    }
  },

  "no feature interpolates a raw Canvas title into markup"() {
    // Titles, names and course names are the fields most likely to carry markup.
    const dir = path.join(ROOT, "src/content/features");
    // Only a PROPERTY read counts (obj.title); a literal title="..." attribute in
    // the surrounding markup is not a data flow.
    const risky = /\$\{(?!esc\(|BC\.util\.escapeHtml\()[^}]*\.(title|name|display_name|courseName|context_name|description)\b[^}]*\}/;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".js")) continue;
      const src = read("src/content/features/" + f);
      for (const [i, line] of src.split("\n").entries()) {
        if (!line.includes("${")) continue;
        // Only lines that are building markup.
        if (!/[<>]/.test(line)) continue;
        assert.noMatch(line, risky, `${f}:${i + 1} interpolates an unescaped title/name into markup`);
      }
    }
  },

  "the extension never uses eval or Function construction"() {
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith(".js")) continue;
        const src = fs.readFileSync(p, "utf8");
        assert.noMatch(src, /\beval\s*\(/, `${e.name} uses eval`);
        assert.noMatch(src, /new\s+Function\s*\(/, `${e.name} constructs a Function`);
      }
    };
    walk(path.join(ROOT, "src"));
  },

  "external links opened in a new tab carry noopener"() {
    const dir = path.join(ROOT, "src");
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith(".js")) continue;
        const src = fs.readFileSync(p, "utf8");
        for (const [i, line] of src.split("\n").entries()) {
          if (/target=["']_blank["']|target\s*=\s*"_blank"/.test(line)) {
            assert.match(line, /noopener/, `${e.name}:${i + 1} opens _blank without noopener`);
          }
        }
      }
    };
    walk(dir);
  },

  "API requests only ever go to the Canvas origin"() {
    // A path that starts with http would let a crafted value exfiltrate the
    // session; every helper builds from location.origin.
    const src = read("src/content/core/api.js");
    assert.match(src, /const base = location\.origin/);
    assert.noMatch(src, /https?:\/\/(?!school)/,
      "no hardcoded external endpoint should appear in the API layer");
  },

  "nothing in the extension talks to a non-Canvas network endpoint"() {
    const walk = (d, out = []) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { walk(p, out); continue; }
        if (e.name.endsWith(".js")) out.push([p, fs.readFileSync(p, "utf8")]);
      }
      return out;
    };
    // Allowed: XML namespace URLs (identifiers, never fetched) and UI placeholder
    // strings, which contain no real host.
    const allowed = /^https?:\/\/(www\.)?w3\.org\//;
    const isRealHost = (u) => /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(u);
    for (const [p, src] of walk(path.join(ROOT, "src"))) {
      for (const m of src.matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)) {
        if (!isRealHost(m[1])) continue;   // e.g. the "https://…" input placeholder
        assert.ok(allowed.test(m[1]), `${path.basename(p)} references external URL ${m[1]}`);
      }
    }
  },

  "the manifest requests no broad host access at install time"() {
    const mv3 = JSON.parse(read("manifest.json"));
    for (const h of mv3.host_permissions) {
      assert.noMatch(h, /^\*:\/\/\*\/\*$/, "all-sites access must stay optional, not granted at install");
    }
  },

  "telemetry stays hard-wired off"() {
    assert.equal(BC.defaults.privacy.telemetry, false);
  },
};
