const assert = require("node:assert/strict");
const test = require("node:test");
const { load, domContext } = require("./audit-helpers.cjs");

test("disabling quiz draft saving removes listeners, cancels saves and guards already queued callbacks", () => {
  const timers = new Map(), queued = []; let next = 0, writes = 0;
  const { dom, context } = domContext('<div id="questions"><input name="answer" type="text" value="Local answer"></div>', {
    setTimeout: (fn) => { timers.set(++next, fn); return next; }, clearTimeout: (id) => timers.delete(id),
  });
  try {
    dom.reconfigure({ url: "http://bc-test.instructure.com/courses/1/quizzes/2/take" });
    load(context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/lifecycle.js");
    const BC = context.BC;
    BC.injector = { setStyle() {}, removeNode() {}, ensureNode() {} };
    BC.storage = { local: {}, updateLocal(fn) { queued.push(fn); } };
    load(context, "src/content/features/quizsaver.js");
    const settings = BC.cloneDefaults(), ctx = { path: dom.window.location.pathname };
    const apply = () => BC.features.quizsaver.apply(settings, ctx);
    settings.productivity.quizDraftSaver = true; apply();
    const input = dom.window.document.querySelector("input"), change = () => input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    change(); assert.equal(timers.size, 1);
    const staleCallback = [...timers.values()][0];
    settings.productivity.quizDraftSaver = false; apply();
    assert.equal(timers.size, 0);
    change(); staleCallback(); assert.equal(timers.size, 0); assert.equal(queued.length, 0);
    settings.productivity.quizDraftSaver = true; apply(); change();
    [...timers.values()][0](); timers.clear(); assert.equal(queued.length, 1);
    settings.productivity.quizDraftSaver = false; apply();
    const data = {}; queued.shift()(data); assert.deepEqual(data, {});
    settings.productivity.quizDraftSaver = true; apply(); change();
    [...timers.values()][0](); timers.clear(); queued.shift()(data);
    if (data.quizDrafts) writes++;
    assert.equal(writes, 1, "reenabling installs one working listener set");
    assert.equal(data.quizDrafts[ctx.path].answers.answer, "Local answer");
    BC.features.quizsaver.unmount(); change(); assert.equal(timers.size, 0);
  } finally { dom.window.close(); }
});
