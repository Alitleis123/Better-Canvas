"use strict";
const { createSandbox, loadCore } = require("./harness");
const BC = loadCore(createSandbox());
const dt = BC.dt;

const at = (h, m) => { const d = new Date(2026, 0, 15, h, m, 0, 0); return d; };

module.exports = {
  "parseHM accepts valid times and rejects the rest"() {
    assert.deepEqual(dt.parseHM("07:05"), { h: 7, m: 5 });
    assert.deepEqual(dt.parseHM("23:59"), { h: 23, m: 59 });
    assert.deepEqual(dt.parseHM("0:00"), { h: 0, m: 0 });
    assert.equal(dt.parseHM("24:00"), null);
    assert.equal(dt.parseHM("12:60"), null);
    assert.equal(dt.parseHM("noon"), null);
    assert.equal(dt.parseHM(""), null);
    assert.equal(dt.parseHM(null), null);
  },

  "withinSchedule handles a same-day window"() {
    assert.ok(dt.withinSchedule("09:00", "17:00", at(12, 0)));
    assert.notOk(dt.withinSchedule("09:00", "17:00", at(8, 59)));
    assert.notOk(dt.withinSchedule("09:00", "17:00", at(17, 0)), "end is exclusive");
    assert.ok(dt.withinSchedule("09:00", "17:00", at(9, 0)), "start is inclusive");
  },

  "withinSchedule handles a window that wraps midnight"() {
    assert.ok(dt.withinSchedule("20:00", "07:00", at(22, 0)));
    assert.ok(dt.withinSchedule("20:00", "07:00", at(2, 0)));
    assert.ok(dt.withinSchedule("20:00", "07:00", at(20, 0)));
    assert.notOk(dt.withinSchedule("20:00", "07:00", at(12, 0)));
    assert.notOk(dt.withinSchedule("20:00", "07:00", at(7, 0)));
  },

  "withinSchedule treats a zero-length window as never"() {
    assert.notOk(dt.withinSchedule("08:00", "08:00", at(8, 0)));
    assert.notOk(dt.withinSchedule("08:00", "08:00", at(12, 0)));
  },

  "withinSchedule is false when either bound is unparseable"() {
    assert.notOk(dt.withinSchedule("nope", "07:00", at(2, 0)));
    assert.notOk(dt.withinSchedule("20:00", "", at(2, 0)));
  },

  "ymd is zero padded and sorts lexicographically as a date"() {
    assert.equal(dt.ymd(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(dt.ymd(new Date(2026, 11, 31)), "2026-12-31");
    const a = dt.ymd(new Date(2026, 0, 9)), b = dt.ymd(new Date(2026, 0, 10));
    assert.ok(a < b, "ymd string order must match date order; streak logic relies on it");
  },

  "startOfWeek respects the week start"() {
    const thu = new Date(2026, 0, 15);        // a Thursday
    assert.equal(dt.startOfWeek(thu).getDay(), 0);
    assert.equal(dt.startOfWeek(thu, true).getDay(), 1);
  },

  "addDays crosses month and year boundaries"() {
    assert.equal(dt.ymd(dt.addDays(new Date(2026, 0, 31), 1)), "2026-02-01");
    assert.equal(dt.ymd(dt.addDays(new Date(2026, 11, 31), 1)), "2027-01-01");
    assert.equal(dt.ymd(dt.addDays(new Date(2026, 0, 1), -1)), "2025-12-31");
  },

  "fmtDay names the relative days"() {
    const now = new Date();
    assert.equal(dt.fmtDay(now), "Today");
    assert.equal(dt.fmtDay(dt.addDays(now, 1)), "Tomorrow");
    assert.equal(dt.fmtDay(dt.addDays(now, -1)), "Yesterday");
    assert.match(dt.fmtDay(dt.addDays(now, 5)), /,/);
  },

  "fmtTime uses 12-hour clock with a real noon and midnight"() {
    assert.equal(dt.fmtTime(new Date(2026, 0, 1, 0, 5)), "12:05 AM");
    assert.equal(dt.fmtTime(new Date(2026, 0, 1, 12, 0)), "12:00 PM");
    assert.equal(dt.fmtTime(new Date(2026, 0, 1, 13, 30)), "1:30 PM");
  },

  "dueLabel distinguishes overdue from upcoming"() {
    const soon = new Date(Date.now() + 30 * 60000).toISOString();
    const past = new Date(Date.now() - 60 * 60000).toISOString();
    assert.match(dt.dueLabel(soon), /^Due in \d+m$/);
    assert.match(dt.dueLabel(past), /^Overdue/);
    assert.equal(dt.dueLabel(null), "");
  },

  "dueLabel pluralises days correctly"() {
    const oneDay = new Date(Date.now() + 24 * 3600 * 1000 + 60000).toISOString();
    assert.equal(dt.dueLabel(oneDay), "Due in 1 day");
    const twoDays = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    assert.equal(dt.dueLabel(twoDays), "Due in 2 days");
  },

  "fmtRange collapses shared month and year"() {
    assert.equal(dt.fmtRange(new Date(2026, 0, 1), new Date(2026, 0, 7)), "Jan 1–7");
    assert.match(dt.fmtRange(new Date(2026, 0, 28), new Date(2026, 1, 3)), /Jan 28 . Feb 3/);
    assert.match(dt.fmtRange(new Date(2026, 11, 28), new Date(2027, 0, 3)), /2026.*2027/);
  },

  "relative reads naturally in both directions"() {
    assert.equal(dt.relative(new Date(Date.now() + 1000).toISOString()), "now");
    assert.match(dt.relative(new Date(Date.now() - 3 * 3600 * 1000).toISOString()), /3h ago/);
    assert.match(dt.relative(new Date(Date.now() + 3 * 3600 * 1000).toISOString()), /^in 3h$/);
    assert.equal(dt.relative(null), "");
  },
};
