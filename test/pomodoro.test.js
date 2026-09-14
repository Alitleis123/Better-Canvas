"use strict";
const fs = require("fs");
const path = require("path");
const { createSandbox, loadCore, load, ROOT } = require("./harness");

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const src = read("src/content/features/todo.js");

// todo.js expects a live page, so give it just enough to finish loading and
// then reach for the pause arithmetic it exposes.
function boot() {
  const sb = createSandbox();
  loadCore(sb);
  const BC = sb.BC;
  BC.registry = { register() {} };
  BC.injector = { setStyle() {}, removeStyle() {}, removeNode() {}, ensureNode() { return null; } };
  BC.lifecycle = { bag: () => ({ once() {}, timeout() {}, interval() { return 1; }, listen() {} }),
                   pageBag: () => ({ once() {}, timeout() {}, interval() { return 1; }, listen() {} }) };
  BC.storage = { current: null, local: {}, update: () => Promise.resolve(),
                 updateLocal: () => Promise.resolve(), subscribe: () => () => {} };
  BC.api = { plannerItems: () => Promise.resolve([]), createPlannerNote: () => Promise.resolve({}) };
  BC.toast = { info() {}, success() {}, error() {} };
  BC.cache = BC.cache || { get: () => null, set() {} };
  load(sb, "src/content/features/todo.js");
  return BC;
}

const BC = boot();
const P = BC.todoPomodoro;
const MIN = 60000;

// A running work phase with `mins` left as of `now`.
const running = (now, mins) => ({ phase: "work", cycle: 0, pausedAt: null,
                                  startedAt: now, endsAt: now + mins * MIN, sessions: [] });

module.exports = {
  "the module exposes the pause arithmetic"() {
    assert.ok(P && typeof P.togglePause === "function");
    assert.ok(typeof P.pomRemaining === "function");
  },

  "a running timer counts down"() {
    const t = 1_000_000;
    const p = running(t, 25);
    assert.equal(P.pomRemaining(p, t), 25 * MIN);
    assert.equal(P.pomRemaining(p, t + 10 * MIN), 15 * MIN);
  },

  "pausing freezes the countdown"() {
    // The defect this prevents: a dock that looks stopped while the underlying
    // deadline keeps moving, so a 25-minute timer fires during your phone call.
    const t = 1_000_000;
    const p = running(t, 25);
    P.togglePause(p, t + 5 * MIN);
    assert.equal(p.pausedAt, t + 5 * MIN);
    assert.equal(P.pomRemaining(p, t + 5 * MIN), 20 * MIN);
    // An hour later, still twenty minutes left.
    assert.equal(P.pomRemaining(p, t + 65 * MIN), 20 * MIN);
  },

  "resuming gives back exactly the time you were away"() {
    const t = 1_000_000;
    const p = running(t, 25);
    P.togglePause(p, t + 5 * MIN);            // 20 left
    P.togglePause(p, t + 40 * MIN);           // away for 35 minutes
    assert.equal(p.pausedAt, null, "resuming must clear the pause mark");
    assert.equal(P.pomRemaining(p, t + 40 * MIN), 20 * MIN,
      "the remaining time must be unchanged across a pause");
    assert.equal(P.pomRemaining(p, t + 50 * MIN), 10 * MIN, "and then run again");
  },

  "many pause cycles do not drift"() {
    const t = 1_000_000;
    const p = running(t, 25);
    let now = t;
    let expected = 25 * MIN;
    for (let i = 0; i < 20; i++) {
      now += 30_000;                          // run for 30s
      expected -= 30_000;
      P.togglePause(p, now);                  // pause
      now += 120_000;                         // away for 2 minutes
      P.togglePause(p, now);                  // resume
      assert.equal(P.pomRemaining(p, now), expected, `drifted on cycle ${i + 1}`);
    }
  },

  "remaining never goes negative"() {
    const t = 1_000_000;
    const p = running(t, 1);
    assert.equal(P.pomRemaining(p, t + 10 * MIN), 0,
      "a negative remaining would render as a minus sign in the dock");
  },

  "a stopped timer has nothing left and cannot be paused"() {
    assert.equal(P.pomRemaining(null, Date.now()), 0);
    assert.equal(P.pomRemaining({ phase: null, endsAt: Date.now() + MIN }, Date.now()), 0);
    const dead = { phase: null, endsAt: 5 };
    P.togglePause(dead, 1000);
    assert.equal(dead.pausedAt, undefined, "a stopped timer must not acquire a pause mark");
  },

  "starting, stopping and advancing all clear the pause"() {
    // A pause carried across a phase boundary would freeze the break the moment
    // it began, with no control that looked like it would unfreeze it.
    assert.match(src, /phase: "work", cycle: prev\.cycle \|\| 0, pausedAt: null,/,
      "a new session must start unpaused");
    assert.match(src, /d\.pomodoro\.pausedAt = null;/, "stopping must clear the pause");
    assert.match(src, /p\.endsAt = Date\.now\(\)[\s\S]{0,200}?p\.pausedAt = null;/,
      "advancing a phase must clear the pause");
  },

  "the dock exposes pause as a labelled control"() {
    assert.match(src, /dbtn\("pause", "data-pom-pause", "Pause the timer"\)/);
    assert.match(src, /data-pom-pause\]"\)\.addEventListener\("click", togglePomodoroPause\)/);
    // The icon has to flip, or the button lies about what it will do.
    assert.match(src, /BC\.icons\.svg\(paused \? "play" : "pause"/);
    assert.match(src, /btn\.setAttribute\("aria-label", label\)/);
  },

  "a paused dock is distinguishable without colour"() {
    assert.match(src, /\.bc-pom-dock\.bc-paused \{[^}]*border-style: dashed/,
      "colour alone would not survive a colour-blind mode");
  },
};
