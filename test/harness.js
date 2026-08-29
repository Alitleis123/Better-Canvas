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
    setAttribute(k, v) {
      el.attributes[k] = String(v);
      if (k === "class") el.className = String(v);
      if (k === "id") el.attributes.id = String(v);
    },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    hasAttribute(k) { return k in this.attributes; },
    toggleAttribute(k, f) { const on = f === undefined ? !(k in this.attributes) : !!f; on ? (this.attributes[k] = "") : delete this.attributes[k]; return on; },
    appendChild(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; c.parentElement = this; c.isConnected = true; return c; },
    insertBefore(c, ref) {
      const i = ref ? el.children.indexOf(ref) : -1;
      if (i < 0) return el.appendChild(c);
      el.children.splice(i, 0, c);
      el.childNodes.splice(i, 0, c);
      c.parentNode = el; c.parentElement = el; c.isConnected = true;
      return c;
    },
    removeChild(c) { if (c && c.remove) c.remove(); return c; },
    contains(c) { for (let n = c; n; n = n.parentElement) if (n === el) return true; return false; },
    insertAdjacentElement(pos, c) {
      if (pos === "afterend" && el.parentNode) return el.parentNode.insertBefore(c, el.nextElementSibling);
      return el.appendChild(c);
    },
    prepend(c) { this.children.unshift(c); c.parentNode = this; c.isConnected = true; return c; },
    replaceChildren(...c) { this.children = c.slice(); this.childNodes = c.slice(); },
    remove() {
      if (el.parentNode) {
        el.parentNode.children = el.parentNode.children.filter((x) => x !== el);
        el.parentNode.childNodes = el.parentNode.childNodes.filter((x) => x !== el);
      }
      el.parentNode = null; el.parentElement = null; el.isConnected = false;
    },
    querySelector(sel) { return queryAll(el, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(el, sel); },
    matches(sel) { return compile(sel).some((ch) => matchesChain(el, ch)); },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }; },
    getClientRects() { return []; },
    closest(sel) {
      const chains = compile(sel);
      for (let n = el; n; n = n.parentElement) {
        if (chains.some((ch) => matchesChain(n, ch))) return n;
      }
      return null;
    },
    focus() {}, blur() {}, click() {},
    get nextElementSibling() {
      const sibs = (el.parentNode && el.parentNode.children) || [];
      const i = sibs.indexOf(el);
      return i >= 0 && i + 1 < sibs.length ? sibs[i + 1] : null;
    },
    nodeType: 1,
  };
  Object.defineProperty(el, "id", {
    get() { return el.attributes.id || ""; },
    set(v) { el.attributes.id = String(v); },
    enumerable: true, configurable: true,
  });
  // className and classList are two views of one value in a real DOM; the
  // extension writes through both, so they have to stay in sync here or
  // selector matching silently misses elements.
  Object.defineProperty(el, "className", {
    get() { return Array.from(el.classList._s).join(" "); },
    set(v) {
      el.classList._s.clear();
      for (const c of String(v).split(/\s+/)) if (c) el.classList._s.add(c);
    },
    enumerable: true, configurable: true,
  });
  el.style.setProperty = (k, v) => { el.style[k] = v; };
  el.style.getPropertyValue = (k) => el.style[k] || "";
  el.style.removeProperty = (k) => { delete el.style[k]; };
  return el;
}

// ---- selector matching --------------------------------------------------
// Supports the subset the extension actually uses: tag, #id, .class,
// [attr], [attr="value"], comma-separated groups, and descendant combinators.
function parseSimple(sel) {
  const m = sel.match(/^([a-zA-Z][\w-]*)?((?:[#.][\w-]+|\[[^\]]+\])*)$/);
  if (!m) return null;
  const out = { tag: m[1] ? m[1].toUpperCase() : null, id: null, classes: [], attrs: [] };
  for (const part of m[2].match(/[#.][\w-]+|\[[^\]]+\]/g) || []) {
    if (part[0] === "#") out.id = part.slice(1);
    else if (part[0] === ".") out.classes.push(part.slice(1));
    else {
      const a = part.slice(1, -1).match(/^([\w-]+)(?:\s*([~^$*|]?=)\s*"?([^"\]]*)"?)?$/);
      if (a) out.attrs.push({ name: a[1], op: a[2], value: a[3] });
    }
  }
  return out;
}

function matchesSimple(el, s) {
  if (!el || el.nodeType !== 1 || !s) return false;
  if (s.tag && el.tagName !== s.tag) return false;
  if (s.id && el.attributes.id !== s.id && el.id !== s.id) return false;
  for (const c of s.classes) if (!el.classList.contains(c)) return false;
  for (const a of s.attrs) {
    const v = el.getAttribute(a.name);
    if (v == null) return false;
    if (a.op === "=" && v !== a.value) return false;
    if (a.op === "*=" && !v.includes(a.value)) return false;
    if (a.op === "^=" && !v.startsWith(a.value)) return false;
    if (a.op === "$=" && !v.endsWith(a.value)) return false;
  }
  return true;
}

// One compiled selector = a chain of simple selectors joined by descendant
// combinators; an element matches if the chain matches walking up its ancestors.
function compile(selector) {
  return String(selector).split(",").map((group) => {
    const parts = group.trim().split(/\s+/).map(parseSimple);
    return parts.some((p) => !p) ? null : parts;
  }).filter(Boolean);
}

function matchesChain(el, chain) {
  let i = chain.length - 1;
  if (!matchesSimple(el, chain[i])) return false;
  i--;
  let node = el.parentElement;
  while (i >= 0 && node) {
    if (matchesSimple(node, chain[i])) i--;
    node = node.parentElement;
  }
  return i < 0;
}

function descendants(root, out) {
  for (const c of root.children || []) {
    if (c.nodeType === 1) { out.push(c); descendants(c, out); }
  }
  return out;
}

function queryAll(root, selector) {
  const chains = compile(selector);
  if (!chains.length) return [];
  return descendants(root, []).filter((el) => chains.some((ch) => matchesChain(el, ch)));
}

function makeDocument() {
  const head = makeElement("head");
  const body = makeElement("body");
  const documentElement = makeElement("html");
  head.isConnected = body.isConnected = documentElement.isConnected = true;
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const doc = {
    head, body, documentElement, readyState: "complete", cookie: "", title: "test",
    activeElement: null, scrollingElement: documentElement,
    createElement: makeElement,
    createElementNS: (ns, tag) => makeElement(tag),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t), parentElement: null }),
    querySelector: (s) => queryAll(documentElement, s)[0] || null,
    querySelectorAll: (s) => queryAll(documentElement, s),
    getElementById: (id) => descendants(documentElement, []).find((e) => e.id === id || e.attributes.id === id) || null,
    addEventListener() {}, removeEventListener() {},
  };
  return doc;
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

module.exports = { createSandbox, load, loadCore, CORE, makeElement, queryAll, ROOT };
