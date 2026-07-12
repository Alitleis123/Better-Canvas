/* Better Canvas — thin chrome.alarms wrapper (content-side fallback uses setTimeout). */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const timers = new Map();

  BC.alarms = {
    // Fire once at the given wall-clock time (Date or ms).
    at(id, whenMs, cb) {
      BC.alarms.clear(id);
      const delay = Math.max(0, whenMs - Date.now());
      const h = setTimeout(() => { timers.delete(id); try { cb(); } catch (_) {} }, delay);
      timers.set(id, h);
    },
    // Fire every intervalMs.
    every(id, intervalMs, cb) {
      BC.alarms.clear(id);
      const h = setInterval(() => { try { cb(); } catch (_) {} }, intervalMs);
      timers.set(id, h);
    },
    clear(id) {
      const h = timers.get(id);
      if (!h) return;
      clearTimeout(h); clearInterval(h);
      timers.delete(id);
    },
    clearAll() {
      for (const id of Array.from(timers.keys())) BC.alarms.clear(id);
    },
  };
})();
