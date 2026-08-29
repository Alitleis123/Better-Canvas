/*
 * Better Canvas - test harness.
 * Loads the extension's classic scripts into a shared sandbox with minimal
 * DOM and chrome.* shims, so pure logic (tokens, color, dates, grades,
 * migrations, settings state) can be exercised in Node without a browser.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

// ---- minimal DOM ---------------------------------------------------------
// Only what the loaded modules touch at import time. Anything a test actually
// needs is asserted on directly, so a silent no-op here becomes a failing test
// rather than a false pass.
function makeElement(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    children: [], childNodes: [], attributes: {}, style: {}, dataset: {},
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c, f) { const on = f === undefined ? !this._s.has(c) : !!f; on ? this._s.add(c) : this._s.delete(c); return on; },
      get length() { return this._s.size; },
      [Symbol.iterator]() { return this._s[Symbol.iterator](); },
    },
    textContent: "", innerHTML: "", value: "", checked: false,
    isConnected: false, parentNode: null, parentElement: null,
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    hasAttribute(k) { return k in this.attributes; },
    toggleAttribute(k, f) { const on = f === undefined ? !(k in this.attributes) : !!f; on ? (this.attributes[k] = "") : delete this.attributes[k]; return on; },
    appendChild(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; c.parentElement = this; c.isConnected = true; return c; },
    insertBefore(c) { return this.appendChild(c); },
    prepend(c) { this.children.unshift(c); c.parentNode = this; c.isConnected = true; return c; },
    replaceChildren(...c) { this.children = c.slice(); this.childNodes = c.slice(); },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); this.isConnected = false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }; },
    getClientRects() { return []; },
    closest() { return null; },
    focus() {}, blur() {}, click() {},
    get nextElementSibling() { return null; },
    nodeType: 1,
  };
  el.style.setProperty = (k, v) => { el.style[k] = v; };
  el.style.getPropertyValue = (k) => el.style[k] || "";
  el.style.removeProperty = (k) => { delete el.style[k]; };
  return el;
}

function makeDocument() {
  const head = makeElement("head");
  const body = makeElement("body");
  const documentElement = makeElement("html");
  head.isConnected = body.isConnected = documentElement.isConnected = true;
  return {
    head, body, documentElement, readyState: "complete", cookie: "", title: "test",
    activeElement: null, scrollingElement: documentElement,
    createElement: makeElement,
    createElementNS: (ns, tag) => makeElement(tag),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t), parentElement: null }),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  };
}

// ---- chrome shim ---------------------------------------------------------
// Backed by a plain object so tests can inspect exactly what was persisted.
function makeChrome() {
  const store = {};
  const listeners = [];
  return {
    _store: store,
    storage: {
      local: {
        get(keys, cb) {
          const out = {};
          for (const k of [].concat(keys)) if (k in store) out[k] = JSON.parse(JSON.stringify(store[k]));
          cb ? cb(out) : null;
        },
        set(obj, cb) {
          const changes = {};
          for (const k of Object.keys(obj)) {
            changes[k] = { oldValue: store[k], newValue: obj[k] };
            store[k] = JSON.parse(JSON.stringify(obj[k]));
          }
          if (cb) cb();
          for (const l of listeners) l(changes, "local");
        },
        getBytesInUse(_k, cb) { cb(JSON.stringify(store).length); },
      },
      onChanged: { addListener(fn) { listeners.push(fn); }, removeListener(fn) { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); } },
    },
    runtime: { onMessage: { addListener() {} }, sendMessage() {}, lastError: null, getManifest: () => JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")) },
  };
}

// ---- sandbox -------------------------------------------------------------
function createSandbox(opts = {}) {
  const document = makeDocument();
  const chrome = makeChrome();
  const sandbox = {
    document, chrome, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Promise, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Error,
    Set, Map, WeakMap, WeakSet, Symbol, isFinite, isNaN, parseInt, parseFloat,
    structuredClone: typeof structuredClone === "function" ? structuredClone : undefined,
    URL, Blob: class {}, TextEncoder, TextDecoder,
    navigator: { platform: "MacIntel", userAgent: "node", clipboard: { writeText: () => Promise.resolve() } },
    location: { origin: "https://school.instructure.com", pathname: opts.pathname || "/", search: "", hostname: "school.instructure.com", href: "https://school.instructure.com/" },
    history: { pushState() {}, replaceState() {} },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    fetch: opts.fetch || (() => Promise.reject(new Error("no fetch in tests"))),
    MutationObserver: class { observe() {} disconnect() {} },
    getComputedStyle: () => ({ background: "" }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function load(sandbox, relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  vm.runInContext(code, sandbox, { filename: relPath });
}

// The dependency-ordered prefix every logic test needs. Deliberately excludes
// feature modules, which need a real DOM.
const CORE = [
  "src/shared/defaults.js",
  "src/shared/themes.js",
  "src/content/core/util.js",
  "src/content/core/datetime.js",
  "src/content/core/color.js",
  "src/shared/tokens.js",
];

function loadCore(sandbox) {
  for (const f of CORE) load(sandbox, f);
  return sandbox.BC;
}

module.exports = { createSandbox, load, loadCore, CORE, makeElement, ROOT };
