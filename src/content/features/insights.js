/*
 * Better Canvas — study-time tracker for the Insights tab.
 * Counts the seconds a Canvas tab is visible, focused and in use (any input in
 * the last five minutes) against the current course (or "other"). Data never
 * leaves this device; the Insights settings tab renders it.
 *
 * It used to add one whole minute per minute a page stayed open. A page left
 * within a minute counted nothing, so clicking through modules recorded almost no
 * time, while a tab left open with nobody there counted all day.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const IDLE_MS = 5 * 60000, TICK_MS = 10000, FLUSH_MS = 60000;
  let lastInput = Date.now(), lastTick = Date.now(), lastFlush = Date.now(), pendingMs = 0, pendingKey = null, wasActive = false;

  const on = () => { const s = BC.storage.current; return !!(s && s.enabled && s.insights && s.insights.enabled); };
  const courseKey = () => String(BC.detect.context().courseId || "other");
  // Input inside an embedded player or document never reaches this page, so focus
  // in a frame (a lecture video someone clicked play on) counts as in use.
  const active = () => document.visibilityState === "visible" && document.hasFocus() &&
    (Date.now() - lastInput < IDLE_MS || (document.activeElement && document.activeElement.tagName === "IFRAME"));

  // The background adds the minutes itself, so one message is enough and it still
  // arrives when it's sent while the page unloads.
  function send() {
    if (pendingMs >= 1000 && pendingKey && on()) {
      const minutes = +(pendingMs / 60000).toFixed(2);
      try { chrome.runtime.sendMessage({ type: "bc:studyTime", ymd: BC.dt.ymd(new Date()), key: pendingKey, minutes }, () => void chrome.runtime.lastError); } catch (_) {}
    }
    pendingMs = 0; lastFlush = Date.now();
  }

  // Each interval counts if the tab was in use when it began. Checking at its end
  // lost the last stretch before a blur or tab switch.
  function tick() {
    const now = Date.now(), key = courseKey();
    if (key !== pendingKey) { send(); pendingKey = key; }
    // Capped, so a laptop waking from sleep doesn't count the time it was shut.
    if (wasActive && on()) pendingMs += Math.min(now - lastTick, TICK_MS * 2);
    lastTick = now;
    wasActive = active();
    if (now - lastFlush >= FLUSH_MS) send();
  }

  const seen = () => { const idle = !wasActive; lastInput = Date.now(); if (idle) tick(); };
  const leave = () => { tick(); send(); };

  function apply(settings) {
    const bag = BC.lifecycle.bag("insights");
    if (!settings.insights || !settings.insights.enabled) {
      // Switched off: stop the clock and drop anything not yet sent.
      bag.clear(); pendingMs = 0; wasActive = false;
      return;
    }
    bag.once("tick", () => {
      lastTick = Date.now(); pendingKey = courseKey(); wasActive = active();
      for (const type of ["pointerdown", "keydown", "wheel", "mousemove", "touchstart"]) bag.listen(document, type, seen, { passive: true, capture: true });
      bag.listen(window, "scroll", seen, { passive: true, capture: true });
      bag.listen(document, "visibilitychange", () => { if (document.visibilityState === "hidden") leave(); else seen(); });
      bag.listen(window, "pagehide", leave);
      bag.listen(window, "blur", tick);
      bag.listen(window, "focus", seen);
      bag.interval(tick, TICK_MS);
    });
  }

  BC.registry.register({ id: "insights", styles: [], nodes: [], apply });
})();
