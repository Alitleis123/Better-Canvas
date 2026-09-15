/*
 * Better Canvas - test runner.
 * Zero dependencies: discovers test/*.test.js, each exporting an object of
 * { "name": fn }. A test fails by throwing.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const assert = {
  ok(v, msg) { if (!v) throw new Error(msg || `expected truthy, got ${JSON.stringify(v)}`); },
  notOk(v, msg) { if (v) throw new Error(msg || `expected falsy, got ${JSON.stringify(v)}`); },
  equal(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  notEqual(a, b, msg) { if (a === b) throw new Error(msg || `expected not ${JSON.stringify(b)}`); },
  deepEqual(a, b, msg) {
    const x = JSON.stringify(a), y = JSON.stringify(b);
    if (x !== y) throw new Error(msg || `expected ${y}, got ${x}`);
  },
  close(a, b, tol, msg) { if (Math.abs(a - b) > (tol == null ? 1e-6 : tol)) throw new Error(msg || `expected ~${b}, got ${a}`); },
  throws(fn, msg) { let t = false; try { fn(); } catch (_) { t = true; } if (!t) throw new Error(msg || "expected throw"); },
  match(s, re, msg) { if (!re.test(s)) throw new Error(msg || `expected ${re} to match ${JSON.stringify(String(s).slice(0, 200))}`); },
  noMatch(s, re, msg) { if (re.test(s)) throw new Error(msg || `expected ${re} NOT to match ${JSON.stringify(String(s).slice(0, 200))}`); },
};
// Some test files require() node's assert instead of using this one, so both
// spellings of the negative match are in circulation. A file that picks the
// wrong one fails with "not a function" rather than with its own message, which
// reads like a broken test rather than a missing alias.
assert.doesNotMatch = assert.noMatch;
global.assert = assert;

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort();
const only = process.argv[2];

let pass = 0, fail = 0;
const failures = [];

// A test may return a promise; awaiting it is what makes async assertions real
// rather than vacuously passing.
async function main() {
  for (const file of files) {
    if (only && !file.includes(only)) continue;
    const suite = require(path.join(__dirname, file));
    const suiteName = file.replace(/\.test\.js$/, "");
    for (const [name, fn] of Object.entries(suite)) {
      // Some code under test logs on purpose (util.guard warns about a contained
      // feature error, the API layer warns on a truncated list). Buffer it and
      // only surface it when the test actually fails, so a green run is quiet
      // and a red one keeps the context.
      const buffered = [];
      const real = { log: console.log, warn: console.warn, error: console.error };
      for (const k of Object.keys(real)) {
        console[k] = (...a) => buffered.push(k + ": " + a.map(String).join(" "));
      }
      try {
        await fn();
        pass++;
      } catch (e) {
        fail++;
        failures.push({ suite: suiteName, name, err: e, logs: buffered });
      } finally {
        Object.assign(console, real);
      }
    }
  }

  for (const f of failures) {
    console.log(`FAIL  ${f.suite} > ${f.name}`);
    console.log(`      ${f.err.message.split("\n").join("\n      ")}`);
    for (const line of f.logs || []) console.log(`      | ${line}`);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
