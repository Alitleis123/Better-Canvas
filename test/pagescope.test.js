"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, load, ROOT } = require("./harness");

function registry() {
  const sb = createSandbox();
  loadCore(sb);
  sb.window.addEventListener = () => {};
  load(sb, "src/content/core/lifecycle.js");
  return sb.BC.registry;
}

// The page names detect.js can produce.
const PAGES = ["dashboard", "grades", "gradebook", "modules", "assignment", "assignments",
               "discussions", "announcements", "files", "pages", "course", "calendar",
               "inbox", "profile", "admin", "other"];

function declaredScopes() {
  const dir = path.join(ROOT, "src/content/features");
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".js")) continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const id = (src.match(/\bid:\s*"([\w-]+)"/) || [])[1];
    if (!id) continue;
    const m = src.match(/\bpages:\s*\[([^\]]*)\]/);
    out[id] = m ? m[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean) : null;
  }
  return out;
}

module.exports = {
  "a global feature applies on every page"() {
    const r = registry();
    const def = { id: "g", apply() {} };
    for (const p of PAGES) assert.ok(r.shouldApply(def, p, false), `global feature skipped on ${p}`);
  },

  "a page-scoped feature applies on its own pages"() {
    const r = registry();
    const def = { id: "s", pages: ["grades", "assignment"], apply() {} };
    assert.ok(r.shouldApply(def, "grades", false));
    assert.ok(r.shouldApply(def, "assignment", false));
  },

  "a page-scoped feature is skipped off its pages"() {
    const r = registry();
    const def = { id: "s", pages: ["grades"], apply() {} };
    for (const p of PAGES.filter((x) => x !== "grades")) {
      assert.notOk(r.shouldApply(def, p, false), `should have been skipped on ${p}`);
    }
  },

  "a page-scoped feature still gets one call on the tick the page changes"() {
    // That final call is where its own cleanup branch lives; skipping it would
    // strand the feature's nodes on the page it just left.
    const r = registry();
    const def = { id: "s", pages: ["dashboard"], apply() {} };
    assert.ok(r.shouldApply(def, "grades", true), "must run once after navigating away to clean up");
    assert.notOk(r.shouldApply(def, "grades", false), "but not on every subsequent tick");
  },

  "every declared page name is one detect.js can actually produce"() {
    // A typo here makes the feature silently never run, with no error anywhere.
    for (const [id, pages] of Object.entries(declaredScopes())) {
      if (!pages) continue;
      for (const p of pages) {
        assert.ok(PAGES.includes(p), `feature "${id}" declares unknown page "${p}"`);
      }
    }
  },

  "features that mount page-independent UI stay global"() {
    // todo owns the Pomodoro dock, productivity owns the ruler and floating
    // buttons, theming owns the whole page; scoping any of these to a page would
    // make their chrome vanish as soon as the user navigated.
    const scopes = declaredScopes();
    for (const id of ["theming", "cosmetics", "navigation", "todo", "productivity",
                      "accessibility", "previews", "notifications", "insights",
                      "rotation", "settingsPanel"]) {
      assert.equal(scopes[id], null, `feature "${id}" must stay global`);
    }
  },

  "the page-scoped features are the ones expected"() {
    const scopes = declaredScopes();
    const scoped = Object.entries(scopes).filter(([, p]) => p).map(([id]) => id).sort();
    assert.deepEqual(scoped, [
      "announcements", "calendar", "dashboard", "dashgrid", "discussions", "files", "grades",
      "instructor", "modules", "onboarding", "quizsaver", "semester", "syllabus",
    ]);
  },

  "each scoped feature declares the page its own guard checks"() {
    const scopes = declaredScopes();
    const expected = {
      dashboard: ["dashboard"], dashgrid: ["dashboard"], files: ["dashboard"], announcements: ["dashboard"],
      calendar: ["dashboard"], semester: ["dashboard"], onboarding: ["dashboard"],
      modules: ["modules"], discussions: ["discussions"], syllabus: ["assignments"],
      grades: ["grades", "assignment"], instructor: ["course", "assignments"],
      quizsaver: ["course"],
    };
    for (const [id, pages] of Object.entries(expected)) {
      assert.deepEqual(scopes[id], pages, `feature "${id}" scope drifted`);
    }
  },

  "work deferred on a timer re-checks that it should still happen"() {
    // The first-run tour is scheduled 800ms out. 800ms is long enough to be
    // overtaken: dismissing it in another Canvas tab marks it seen here through
    // the storage subscription, and this tab opened it anyway, over whatever the
    // person had started doing. Deciding at schedule time is not the same as
    // deciding at fire time, and this one has to be the latter.
    const src = fs.readFileSync(path.join(ROOT, "src/content/features/onboarding.js"), "utf8");
    const timer = /bag\.timeout\(([\s\S]*?), 800\)/.exec(src);
    assert.ok(timer, "the tour is still scheduled on a timer");
    assert.doesNotMatch(timer[1], /^\s*show\s*$/,
      "the timer must not call show() directly; by the time it fires the answer may have changed");
    assert.match(timer[1], /onboarding\.seen/,
      "the timer has to re-read onboarding.seen at the moment it would open the dialog");
  },

  "every registered feature declares its own teardown keys"() {
    // A node injected but never declared is stranded on the page when the
    // extension is disabled.
    //
    // settings-panel is the one deliberate exception: content.js teardown skips
    // it by id so the drawer and its nav entry survive being switched off, which
    // is the only way back to the toggle. Its register() declares no keys on
    // purpose.
    const SURVIVES_TEARDOWN = new Set(["settings-panel.js"]);
    const dir = path.join(ROOT, "src/content/features");
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".js") || SURVIVES_TEARDOWN.has(f)) continue;
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      const declared = new Set();
      const reg = src.match(/BC\.registry\.register\(\{[\s\S]*?\n?\s*\}\);/);
      if (reg) for (const m of reg[0].matchAll(/"([\w-]+)"/g)) declared.add(m[1]);
      // Every data-bc-node value the file writes must appear in its register call.
      for (const m of src.matchAll(/setAttribute\("data-bc-node",\s*"([\w-]+)"\)/g)) {
        assert.ok(declared.has(m[1]), `${f} injects node "${m[1]}" but never declares it for teardown`);
      }
      for (const m of src.matchAll(/ensureNode\("([\w-]+)"/g)) {
        assert.ok(declared.has(m[1]), `${f} injects node "${m[1]}" but never declares it for teardown`);
      }
      for (const m of src.matchAll(/setStyle\("([\w-]+)"/g)) {
        assert.ok(declared.has(m[1]), `${f} injects style "${m[1]}" but never declares it for teardown`);
      }
    }
  },

  "the settings panel is exempt from teardown on both sides"() {
    // The exemption above is only safe because content.js actually skips it.
    const src = fs.readFileSync(path.join(ROOT, "src/content/content.js"), "utf8");
    assert.match(src, /f\.id === "settingsPanel"/,
      "teardown must skip settingsPanel, or the user cannot re-enable the extension");
    const panel = fs.readFileSync(path.join(ROOT, "src/content/features/settings-panel.js"), "utf8");
    assert.match(panel, /styles:\s*\[\]/);
    assert.match(panel, /nodes:\s*\[\]/);
  },
};
