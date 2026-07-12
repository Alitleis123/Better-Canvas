/* Better Canvas — date/time helpers. Deduped across features. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const DAY_MS = 24 * 60 * 60 * 1000;
  const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const dt = (BC.dt = {
    DAY_MS,
    WEEKDAYS,
    MONTHS,

    startOfDay(d) {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    },

    endOfDay(d) {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x;
    },

    addDays(d, n) {
      const x = new Date(d);
      x.setDate(x.getDate() + n);
      return x;
    },

    startOfWeek(d, startOnMonday) {
      const x = dt.startOfDay(d);
      const dow = x.getDay();
      const shift = startOnMonday ? ((dow + 6) % 7) : dow;
      return dt.addDays(x, -shift);
    },

    ymd(d) {
      const x = new Date(d);
      return x.getFullYear() + "-" +
        String(x.getMonth() + 1).padStart(2, "0") + "-" +
        String(x.getDate()).padStart(2, "0");
    },

    fmtDay(d) {
      const x = new Date(d);
      const today = dt.startOfDay(new Date()).getTime();
      const target = dt.startOfDay(x).getTime();
      const diff = Math.round((target - today) / DAY_MS);
      if (diff === 0) return "Today";
      if (diff === 1) return "Tomorrow";
      if (diff === -1) return "Yesterday";
      return WEEKDAYS[x.getDay()] + ", " + MONTHS[x.getMonth()] + " " + x.getDate();
    },

    fmtTime(d) {
      const x = new Date(d);
      let h = x.getHours();
      const m = x.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12; if (h === 0) h = 12;
      return h + ":" + String(m).padStart(2, "0") + " " + ampm;
    },

    fmtRange(startDate, endDate) {
      const s = new Date(startDate), e = new Date(endDate);
      const sameYear = s.getFullYear() === e.getFullYear();
      const sameMonth = sameYear && s.getMonth() === e.getMonth();
      if (sameMonth) return MONTHS[s.getMonth()] + " " + s.getDate() + "–" + e.getDate();
      if (sameYear) return MONTHS[s.getMonth()] + " " + s.getDate() + " – " + MONTHS[e.getMonth()] + " " + e.getDate();
      return MONTHS[s.getMonth()] + " " + s.getDate() + ", " + s.getFullYear() + " – " +
             MONTHS[e.getMonth()] + " " + e.getDate() + ", " + e.getFullYear();
    },

    // Parse "HH:mm" -> {h, m} or null.
    parseHM(str) {
      if (!str) return null;
      const m = String(str).match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
      if (h < 0 || h > 23 || min < 0 || min > 59) return null;
      return { h, m: min };
    },

    // True if current time is within [start, end]. Handles wrap-around (20:00–07:00).
    withinSchedule(startHM, endHM, now) {
      const s = dt.parseHM(startHM), e = dt.parseHM(endHM);
      if (!s || !e) return false;
      const d = now || new Date();
      const cur = d.getHours() * 60 + d.getMinutes();
      const a = s.h * 60 + s.m;
      const b = e.h * 60 + e.m;
      if (a === b) return false;
      if (a < b) return cur >= a && cur < b;
      return cur >= a || cur < b;
    },

    relative(iso) {
      if (!iso) return "";
      const now = Date.now();
      const t = new Date(iso).getTime();
      const diff = t - now;
      const abs = Math.abs(diff);
      const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
      const sign = diff < 0 ? "ago" : "";
      const future = diff >= 0 ? "in " : "";
      if (abs < min) return diff >= 0 ? "now" : "just now";
      if (abs < hr)  return future + Math.round(abs / min) + "m" + (sign ? " " + sign : "");
      if (abs < day) return future + Math.round(abs / hr) + "h" + (sign ? " " + sign : "");
      return future + Math.round(abs / day) + "d" + (sign ? " " + sign : "");
    },

    // Human "due in X" that stays useful for both future & past due dates.
    dueLabel(iso) {
      if (!iso) return "";
      const now = new Date();
      const t = new Date(iso);
      const diff = t.getTime() - now.getTime();
      if (diff < 0) return "Overdue · " + dt.relative(iso);
      if (diff < 60 * 60 * 1000) return "Due in " + Math.round(diff / 60000) + "m";
      if (diff < 24 * 60 * 60 * 1000) return "Due in " + Math.round(diff / 3600000) + "h";
      const days = Math.round(diff / (24 * 60 * 60 * 1000));
      return "Due in " + days + " day" + (days === 1 ? "" : "s");
    },
  });
})();
