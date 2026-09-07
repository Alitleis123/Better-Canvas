"use strict";
const { createSandbox, loadCore, load } = require("./harness");

// Each element declares the computed background the stub should report.
function env() {
  const sb = createSandbox();
  loadCore(sb);
  sb.window.addEventListener = () => {};
  load(sb, "src/content/core/lifecycle.js");
  load(sb, "src/content/core/injector.js");
  sb.getComputedStyle = (el) => ({
    backgroundColor: el._bg == null ? "rgba(0, 0, 0, 0)" : el._bg,
    backgroundImage: el._bgImage || "none",
    color: el._fg || "rgb(45, 59, 69)",
  });
  load(sb, "src/content/features/theming.js");
  sb.document.documentElement.classList.add("bc-dark");

  const app = sb.document.createElement("div");
  app.setAttribute("id", "application");
  sb.document.body.appendChild(app);

  const add = (tag, bg, parent, opts) => {
    const el = sb.document.createElement(tag);
    el._bg = bg;
    if (opts && opts.fg) el._fg = opts.fg;
    if (opts && opts.text) el.childNodes.push({ nodeType: 3, textContent: opts.text });
    if (opts && opts.bgImage) el._bgImage = opts.bgImage;
    if (opts && opts.className) el.className = opts.className;
    if (opts && opts.node) el.setAttribute("data-bc-node", opts.node);
    (parent || app).appendChild(el);
    return el;
  };
  return { sb, app, add, BC: sb.BC, doc: sb.document };
}

const isLit = (el) => el.hasAttribute("data-bc-lit");

module.exports = {
  "a light surface is marked"() {
    const e = env();
    const light = e.add("div", "rgb(255, 255, 255)");
    e.BC.theming.sweepLightSurfaces();
    assert.ok(isLit(light), "a white container must be darkened");
  },

  "an already-dark surface is left alone"() {
    const e = env();
    const dark = e.add("div", "rgb(26, 29, 36)");
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(isLit(dark), "re-painting an already-dark surface is pointless churn");
  },

  "a transparent surface is left alone"() {
    // Whatever is behind it is what shows, and that is already dark.
    const e = env();
    const t1 = e.add("div", "rgba(0, 0, 0, 0)");
    const t2 = e.add("div", "transparent");
    const t3 = e.add("div", null);
    e.BC.theming.sweepLightSurfaces();
    for (const el of [t1, t2, t3]) assert.notOk(isLit(el));
  },

  "a mostly-transparent light surface is left alone"() {
    const e = env();
    const faint = e.add("div", "rgba(255, 255, 255, 0.2)");
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(isLit(faint), "a faint wash is not what the user sees");
  },

  "an element with a background image is never repainted"() {
    // That image is somebody's deliberate art direction.
    const e = env();
    const art = e.add("div", "rgb(255, 255, 255)", null, { bgImage: 'url("x.png")' });
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(isLit(art));
  },

  "instructor-authored course content is never repainted"() {
    // Its background is a choice by whoever wrote the page.
    const e = env();
    for (const cls of ["user_content", "show-content", "description",
                       "assignment-description", "discussion-topic-body", "ProseMirror"]) {
      const scope = e.add("div", null, null, { className: cls });
      const inner = e.add("div", "rgb(255, 255, 255)", scope);
      e.BC.theming.sweepLightSurfaces();
      assert.notOk(isLit(inner), `content inside .${cls} must be left alone`);
      assert.notOk(isLit(scope), `.${cls} itself must be left alone`);
    }
  },

  "our own UI is never repainted"() {
    const e = env();
    const ours = e.add("div", "rgb(255, 255, 255)", null, { node: "bc-thing" });
    const inside = e.add("div", "rgb(255, 255, 255)", ours);
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(isLit(ours));
    assert.notOk(isLit(inside), "a child of our own panel must be left alone too");
  },

  "inline and interactive elements are out of scope"() {
    // A light chip or badge sets its own text colour, so it is already readable;
    // repainting it would destroy a deliberate accent.
    const e = env();
    const span = e.add("span", "rgb(255, 255, 255)");
    const btn = e.add("button", "rgb(255, 255, 255)");
    const link = e.add("a", "rgb(255, 255, 255)");
    e.BC.theming.sweepLightSurfaces();
    for (const el of [span, btn, link]) assert.notOk(isLit(el));
  },

  "table and list containers are in scope"() {
    // Canvas builds a lot of its chrome from these.
    const e = env();
    const made = ["table", "thead", "tbody", "tr", "td", "th", "ul", "li", "section", "header", "form"]
      .map((tag) => e.add(tag, "rgb(255, 255, 255)"));
    e.BC.theming.sweepLightSurfaces();
    for (const el of made) assert.ok(isLit(el), `<${el.tagName.toLowerCase()}> should be swept`);
  },

  "the sweep is bounded"() {
    const e = env();
    for (let i = 0; i < 2000; i++) e.add("div", "rgb(255, 255, 255)");
    const marked = e.BC.theming.sweepLightSurfaces();
    assert.ok(marked <= 800, `marked ${marked}; the sweep must stay capped`);
  },

  "a second sweep does no work on already-marked elements"() {
    const e = env();
    for (let i = 0; i < 10; i++) e.add("div", "rgb(255, 255, 255)");
    assert.equal(e.BC.theming.sweepLightSurfaces(), 10);
    assert.equal(e.BC.theming.sweepLightSurfaces(), 0,
      "re-running must be idempotent, not re-mark everything");
  },

  "a second sweep picks up newly rendered surfaces"() {
    // Canvas renders progressively, so the first pass cannot see everything.
    const e = env();
    e.add("div", "rgb(255, 255, 255)");
    assert.equal(e.BC.theming.sweepLightSurfaces(), 1);
    e.add("div", "rgb(250, 250, 250)");
    assert.equal(e.BC.theming.sweepLightSurfaces(), 1, "a late-rendered surface must still be caught");
  },

  "the sweep does nothing when dark mode is off"() {
    const e = env();
    e.doc.documentElement.classList.remove("bc-dark");
    e.add("div", "rgb(255, 255, 255)");
    assert.equal(e.BC.theming.sweepLightSurfaces(), 0);
  },

  "clearing removes every mark"() {
    const e = env();
    for (let i = 0; i < 5; i++) e.add("div", "rgb(255, 255, 255)");
    e.BC.theming.sweepLightSurfaces();
    assert.ok(e.doc.querySelectorAll("[data-bc-lit]").length > 0);
    e.BC.theming.clearLightSweep();
    assert.equal(e.doc.querySelectorAll("[data-bc-lit]").length, 0,
      "leaving marks behind would keep the page dark after dark mode is turned off");
  },

  "mid greys are treated as light so their inherited text stays readable"() {
    const e = env();
    const mid = e.add("div", "rgb(200, 200, 200)");
    const dim = e.add("div", "rgb(60, 60, 60)");
    e.BC.theming.sweepLightSurfaces();
    assert.ok(isLit(mid));
    assert.notOk(isLit(dim));
  },

  "the marker attribute is not one the observer watches"() {
    // Writing it must not retrigger applyAll.
    const fs = require("fs");
    const path = require("path");
    const { ROOT } = require("./harness");
    const obs = fs.readFileSync(path.join(ROOT, "src/content/core/observer.js"), "utf8");
    const filter = obs.match(/attributeFilter:\s*\[([^\]]*)\]/);
    assert.ok(filter, "observer should declare an attributeFilter");
    assert.noMatch(filter[1], /data-bc-lit/,
      "watching the sweep's own marker would make it retrigger itself forever");
  },

  "the sweep is driven by real DOM change, not a timer"() {
    // apply() only runs when the observer saw an actual mutation, so throttling
    // off it means "at most once every few seconds, and only when something
    // changed" rather than a poll that burns work on an idle page.
    const fs = require("fs");
    const path = require("path");
    const { ROOT } = require("./harness");
    const src = fs.readFileSync(path.join(ROOT, "src/content/features/theming.js"), "utf8");
    assert.match(src, /BC\.util\.throttle\(\s*\(\) => BC\.util\.guard\(sweepLightSurfaces/,
      "the sweep should be throttled, so a re-render is caught but an idle page costs nothing");
    assert.noMatch(src, /setInterval\([^)]*sweepLightSurfaces/,
      "the sweep must not become a background poll");
  },

  "turning dark mode off clears the marks rather than leaving the page dark"() {
    const fs = require("fs");
    const path = require("path");
    const { ROOT } = require("./harness");
    const src = fs.readFileSync(path.join(ROOT, "src/content/features/theming.js"), "utf8");
    assert.match(src, /else clearLightSweep\(\);/);
    assert.match(src, /unmount\(\) \{ lastSig = null; clearLightSweep\(\); \}/,
      "teardown must clear the marks too");
  },

  "the sweep only sets a background, never a text colour"() {
    // The text on these surfaces already inherits our light colour; that is
    // precisely what was unreadable. Setting a colour as well would be a second
    // guess at something we already know.
    const fs = require("fs");
    const path = require("path");
    const { ROOT } = require("./harness");
    const src = fs.readFileSync(path.join(ROOT, "src/content/features/theming.js"), "utf8");
    const i = src.indexOf("html.bc-dark [data-bc-lit]");
    assert.ok(i > -1, "the rule acting on the marks should exist");
    const block = src.slice(i, src.indexOf("}", i));
    assert.match(block, /background-color:/);
    assert.noMatch(block, /(^|[^-])color:\s*var\(--bc-d-text/,
      "the sweep should not also force a text colour");
  },

  "a saturated light background is left alone"() {
    // A pale course colour, a status chip or a highlight can be light enough to
    // look like a panel by luminance alone. Repainting it would erase the very
    // thing the colour encodes.
    const e = env();
    const paleYellow = e.add("div", "rgb(255, 249, 196)");
    const paleGreen  = e.add("div", "rgb(200, 247, 197)");
    const palePink   = e.add("div", "rgb(255, 205, 210)");
    e.BC.theming.sweepLightSurfaces();
    for (const el of [paleYellow, paleGreen, palePink]) {
      assert.notOk(isLit(el), `saturated fill ${el._bg} must be preserved`);
    }
  },

  "neutral light surfaces are still swept"() {
    const e = env();
    const white = e.add("div", "rgb(255, 255, 255)");
    const grey  = e.add("div", "rgb(246, 247, 251)");
    const warm  = e.add("div", "rgb(245, 245, 243)");
    e.BC.theming.sweepLightSurfaces();
    for (const el of [white, grey, warm]) assert.ok(isLit(el), `neutral ${el._bg} should be swept`);
  },

  "a card's course colour and artwork survive, but its plain body is darkened"() {
    // Protection comes from measuring the fill, not from excluding the card:
    // excluding it also shielded the white body, leaving a white panel under
    // every card header in dark mode.
    const e = env();
    const card = e.add("div", null, null, { className: "ic-DashboardCard" });
    const hero = e.add("div", "rgb(74, 157, 127)", card);        // course colour
    const art = e.add("div", "rgb(255, 255, 255)", card, { bgImage: 'url("x.png")' });
    const body = e.add("div", "rgb(255, 255, 255)", card);       // plain chrome
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(isLit(hero), "a saturated course colour must survive");
    assert.notOk(isLit(art), "course artwork must survive");
    assert.ok(isLit(body), "the card's plain white body must be darkened");
  },

  "a pale course colour still survives"() {
    // The measurement has to hold for light course colours too, not just dark
    // ones, or a pastel course would be repainted as chrome.
    const e = env();
    const card = e.add("div", null, null, { className: "ic-DashboardCard" });
    const pale = e.add("div", "rgb(255, 214, 224)", card);
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(isLit(pale), "a pale course colour is still a colour");
  },

  "the neutrality test uses distance from grey"() {
    const C = require("./harness").loadCore(require("./harness").createSandbox()).color;
    assert.equal(C.chroma("rgb(255, 255, 255)"), 0, "white is perfectly neutral");
    assert.equal(C.chroma("rgb(100, 100, 100)"), 0);
    assert.ok(C.chroma("rgb(255, 249, 196)") > 24, "a pale yellow is a colour, not chrome");
    assert.ok(C.chroma("rgb(246, 247, 251)") <= 24, "a faintly cool grey is still chrome");
    assert.equal(C.chroma("transparent"), 0);
  },

  "an authored box that paints its own background is marked, not repainted"() {
    // We hand authored prose our light ink (it is normally transparent and sits
    // on our dark container), so a box the author DID paint needs ink for its
    // own colour instead.
    const e = env();
    const scope = e.add("div", null, null, { className: "user_content" });
    const box = e.add("div", "rgb(255, 249, 196)", scope);
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(isLit(box), "an authored background must never be repainted");
    assert.ok(box.hasAttribute("data-bc-paper"),
      "it must be marked so its ink can suit its own background");
  },

  "a transparent authored box is left entirely alone"() {
    // It shows the darkened container behind it, where our light ink is correct.
    const e = env();
    const scope = e.add("div", null, null, { className: "user_content" });
    const plain = e.add("p", null, scope);
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(plain.hasAttribute("data-bc-paper"));
    assert.notOk(isLit(plain));
  },

  "a dark authored box is not marked as paper"() {
    const e = env();
    const scope = e.add("div", null, null, { className: "user_content" });
    const dark = e.add("div", "rgb(30, 30, 30)", scope);
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(dark.hasAttribute("data-bc-paper"),
      "our light ink already works on a dark authored box");
  },

  "paper marks are cleared along with the rest"() {
    const e = env();
    const scope = e.add("div", null, null, { className: "user_content" });
    e.add("div", "rgb(255, 255, 255)", scope);
    e.BC.theming.sweepLightSurfaces();
    assert.ok(e.doc.querySelectorAll("[data-bc-paper]").length > 0);
    e.BC.theming.clearLightSweep();
    assert.equal(e.doc.querySelectorAll("[data-bc-paper]").length, 0);
  },

  "marking is idempotent across both markers"() {
    const e = env();
    const scope = e.add("div", null, null, { className: "user_content" });
    e.add("div", "rgb(255, 255, 255)", scope);
    e.add("div", "rgb(255, 255, 255)");
    assert.equal(e.BC.theming.sweepLightSurfaces(), 2);
    assert.equal(e.BC.theming.sweepLightSurfaces(), 0);
  },

  "our own UI is skipped even inside an authored scope"() {
    const e = env();
    const scope = e.add("div", null, null, { className: "user_content" });
    const ours = e.add("div", "rgb(255, 255, 255)", scope, { node: "bc-thing" });
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(isLit(ours));
    assert.notOk(ours.hasAttribute("data-bc-paper"));
  },

  "text Canvas coloured for a white page is re-mapped on our dark surfaces"() {
    // Canvas picks its greys for white. A declaration beats the inherited colour
    // we set on the container, so those greys survive at whatever contrast they
    // land on. The card subtitle sat at 3.2:1 on the dark card.
    const e = env();
    const panel = e.add("div", "rgb(37, 40, 47)");
    const faint = e.add("div", null, panel, { fg: "rgb(107, 119, 128)", text: "ENGL2700.55077" });
    e.BC.theming.sweepLightSurfaces();
    assert.ok(faint.hasAttribute("data-bc-dim"), "faint text on a dark surface must be re-mapped");
  },

  "text that already has enough contrast is left alone"() {
    const e = env();
    const panel = e.add("div", "rgb(37, 40, 47)");
    const fine = e.add("div", null, panel, { fg: "rgb(230, 233, 238)", text: "Readable" });
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(fine.hasAttribute("data-bc-dim"));
  },

  "only elements with their own text are re-mapped"() {
    // Marking a container would push a colour onto everything inside it.
    const e = env();
    const panel = e.add("div", "rgb(37, 40, 47)");
    const wrapper = e.add("div", null, panel, { fg: "rgb(107, 119, 128)" });
    e.add("span", null, wrapper, { fg: "rgb(107, 119, 128)", text: "leaf" });
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(wrapper.hasAttribute("data-bc-dim"), "a container holding no text of its own must not be marked");
  },

  "a dashboard card's background is protected but its text is not"() {
    // Two different protections. Conflating them left card subtitles unreadable.
    const e = env();
    const card = e.add("div", null, null, { className: "ic-DashboardCard" });
    const hero = e.add("div", "rgb(255, 249, 196)", card);
    const body = e.add("div", "rgb(37, 40, 47)", card);
    const sub = e.add("div", null, body, { fg: "rgb(107, 119, 128)", text: "ENGL2700" });
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(isLit(hero), "the course colour must never be repainted");
    assert.ok(sub.hasAttribute("data-bc-dim"), "but the card's text is chrome and must stay legible");
  },

  "authored prose keeps the colours its writer chose"() {
    const e = env();
    const scope = e.add("div", null, null, { className: "user_content" });
    const prose = e.add("p", null, scope, { fg: "rgb(107, 119, 128)", text: "Read chapters 4 to 6." });
    e.BC.theming.sweepLightSurfaces();
    assert.notOk(prose.hasAttribute("data-bc-dim"),
      "an author's own emphasis is not ours to override");
  },

  "authored block elements are visited"() {
    // blockquote and pre were missing from the tag list, so an authored
    // blockquote with its own light background kept our light ink on it.
    const e = env();
    const scope = e.add("div", null, null, { className: "user_content" });
    for (const tag of ["blockquote", "pre", "figure", "details"]) {
      const box = e.add(tag, "rgb(238, 243, 248)", scope);
      e.BC.theming.sweepLightSurfaces();
      assert.ok(box.hasAttribute("data-bc-paper"), `<${tag}> must be visited by the sweep`);
    }
  },

  "dim marks are cleared with the rest"() {
    const e = env();
    const panel = e.add("div", "rgb(37, 40, 47)");
    e.add("div", null, panel, { fg: "rgb(107, 119, 128)", text: "faint" });
    e.BC.theming.sweepLightSurfaces();
    assert.ok(e.doc.querySelectorAll("[data-bc-dim]").length > 0);
    e.BC.theming.clearLightSweep();
    assert.equal(e.doc.querySelectorAll("[data-bc-dim]").length, 0);
  },
};
