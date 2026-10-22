/* Better Canvas — content-side scheduling with setTimeout and setInterval. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const timers = new Map();

  BC.alarms = {
    // Fire once at the given wall-clock time (Date or ms).
    at(id, whenMs, cb) {
      BC.alarms.clear(id);
      // setTimeout's delay is a signed 32-bit int: anything past ~24.8 days
      // overflows and fires IMMEDIATELY. Far-off times hop in max-size steps.
      const MAX_DELAY = 2147483647;
      const arm = () => {
        const delay = Math.max(0, whenMs - Date.now());
        timers.set(id, setTimeout(() => {
          if (delay > MAX_DELAY) return arm();
          timers.delete(id);
          try { cb(); } catch (_) {}
        }, Math.min(delay, MAX_DELAY)));
      };
      arm();
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
