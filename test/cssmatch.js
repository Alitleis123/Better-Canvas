/*
 * Better Canvas - a small CSS matcher for testing what our stylesheets actually
 * do to Canvas's DOM.
 *
 * Every visual defect reported so far (stacked cards, blank headings, erased
 * course artwork) was a rule matching an element nobody checked it against.
 * Reading selectors by eye does not catch that; matching them against a
 * described DOM does.
 *
 * This is deliberately NOT a browser. It models the parts of the cascade that
 * the defects turned on: which rules match an element, which declaration wins
 * (!important, then specificity, then source order), and that `color` inherits
 * while `background-color` does not.
 */
"use strict";

// ---- selectors -----------------------------------------------------------

function parseCompound(text) {
  const out = { tag: null, id: null, classes: [], attrs: [], nots: [] };
  let s = text.trim();
  // Pull :not(...) groups out first. Their contents may be COMPLEX selectors
  // (":not(.user_content *)" means "not a descendant of .user_content"), so keep
  // the raw text and decide how to evaluate it at match time.
  s = s.replace(/:not\(([^)]*)\)/g, (_, inner) => { out.nots.push(inner.trim()); return ""; });
  // Ignore pseudo-classes/elements we do not model.
  s = s.replace(/::?[a-z-]+(\([^)]*\))?/g, "");
  const tagM = s.match(/^([a-zA-Z][\w-]*)/);
  if (tagM) { out.tag = tagM[1].toUpperCase(); s = s.slice(tagM[1].length); }
  for (const m of s.matchAll(/\[([^\]]+)\]|#([\w-]+)|\.([\w-]+)/g)) {
    if (m[1] != null) {
      const a = m[1].match(/^([\w-]+)(?:\s*([~^$*|]?=)\s*"?([^"\]]*?)"?\s*(i)?)?$/);
      if (a) out.attrs.push({ name: a[1], op: a[2] || null, value: a[3] || null, ci: !!a[4] });
    } else if (m[2] != null) out.id = m[2];
    else out.classes.push(m[3]);
  }
  return out;
}

function matchesCompound(el, c) {
  if (!el) return false;
  if (c.tag && el.tag !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  for (const cls of c.classes) if (!el.classes.includes(cls)) return false;
  for (const a of c.attrs) {
    let v = a.name === "class" ? el.classes.join(" ") : el.attrs[a.name];
    if (v == null) return false;
    if (!a.op) continue;
    let needle = a.value;
    if (a.ci) { v = String(v).toLowerCase(); needle = String(needle).toLowerCase(); }
    if (a.op === "=" && v !== needle) return false;
    if (a.op === "*=" && !String(v).includes(needle)) return false;
    if (a.op === "^=" && !String(v).startsWith(needle)) return false;
    if (a.op === "$=" && !String(v).endsWith(needle)) return false;
  }
  for (const n of c.nots) {
    // A complex argument has to be matched as a whole selector against the
    // element, walking its ancestors; a simple one is just another compound.
    const complex = /[\s>]/.test(n);
    if (complex ? matchesSelector(el, n) : matchesCompound(el, parseCompound(n))) return false;
  }
  return true;
}

// Split on a delimiter only at nesting depth zero. Selectors carry commas and
// spaces INSIDE brackets -- [style*="rgb(255, 255, 255)"], [class*="card" i] --
// and splitting naively tears them apart, which silently produces garbage
// selectors that match nothing or the wrong thing.
function splitTop(text, isDelim) {
  const out = [];
  let depth = 0, quote = null, buf = "";
  for (const ch of text) {
    if (quote) { buf += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    if (depth === 0 && isDelim(ch)) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  out.push(buf);
  return out.map((x) => x.trim()).filter(Boolean);
}

const splitList = (text) => splitTop(text, (c) => c === ",");
const splitCompounds = (text) => splitTop(text, (c) => /\s/.test(c));

// Descendant and child combinators only; that is all our CSS uses.
function matchesSelector(el, selector) {
  const combinators = [];
  const seq = [];
  for (const t of splitCompounds(selector.trim())) {
    if (t === ">") { combinators[seq.length - 1] = "child"; continue; }
    seq.push(parseCompound(t));
  }
  if (!seq.length) return false;
  let i = seq.length - 1;
  if (!matchesCompound(el, seq[i])) return false;
  let node = el.parent;
  let need = i - 1;
  while (need >= 0) {
    if (combinators[need] === "child") {
      if (!node || !matchesCompound(node, seq[need])) return false;
      node = node.parent; need--; continue;
    }
    let found = false;
    while (node) {
      if (matchesCompound(node, seq[need])) { found = true; node = node.parent; break; }
      node = node.parent;
    }
    if (!found) return false;
    need--;
  }
  return true;
}

function specificity(selector) {
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const cls = (selector.match(/\.[\w-]+|\[[^\]]+\]|:[a-z-]+/g) || []).length;
  const tags = (selector.match(/(^|[\s>])[a-zA-Z][\w-]*/g) || []).length;
  return ids * 10000 + cls * 100 + tags;
}

// ---- stylesheets ---------------------------------------------------------

function parseCss(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Drop at-rules with blocks (@media, @keyframes); their contents are not
  // modelled and would otherwise parse as top-level rules.
  const withoutAt = clean.replace(/@[a-z-]+[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, "");
  const rules = [];
  let order = 0;
  for (const m of withoutAt.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = {};
    for (const d of splitTop(m[2], (c) => c === ";")) {
      const i = d.indexOf(":");
      if (i < 0) continue;
      const prop = d.slice(0, i).trim().toLowerCase();
      let val = d.slice(i + 1).trim();
      const important = /!important$/i.test(val);
      if (important) val = val.replace(/!important$/i, "").trim();
      if (prop) decls[prop] = { value: val, important };
    }
    for (const sel of splitList(m[1])) {
      // Collapse runs of whitespace, but not inside a bracketed value.
      const s = splitCompounds(sel).join(" ");
      if (s) rules.push({ selector: s, decls, order: order++, spec: specificity(s) });
    }
  }
  return rules;
}

// Winning declaration for one property on one element.
function declFor(rules, el, prop) {
  let best = null;
  for (const r of rules) {
    const d = r.decls[prop];
    if (!d) continue;
    if (!matchesSelector(el, r.selector)) continue;
    if (!best) { best = { r, d }; continue; }
    const a = best.d.important, b = d.important;
    if (a !== b) { if (b) best = { r, d }; continue; }
    if (r.spec > best.r.spec || (r.spec === best.r.spec && r.order > best.r.order)) best = { r, d };
  }
  return best;
}

// `color` inherits; `background-color` does not.
function computed(rules, el, prop) {
  const inherits = prop === "color";
  let node = el;
  while (node) {
    const hit = declFor(rules, node, prop);
    if (hit) return { value: hit.d.value, selector: hit.r.selector, from: node };
    if (!inherits) return null;
    node = node.parent;
  }
  return null;
}

function allMatching(rules, el) {
  return rules.filter((r) => matchesSelector(el, r.selector));
}

// ---- DOM fixtures --------------------------------------------------------

// node(tag, "id.class1.class2", { attr: v }, [children])
function node(tag, sel, attrs, children) {
  const el = {
    tag: String(tag).toUpperCase(),
    id: null, classes: [], attrs: attrs || {}, parent: null, children: [],
  };
  for (const m of String(sel || "").matchAll(/#([\w-]+)|\.([\w-]+)/g)) {
    if (m[1]) el.id = m[1]; else el.classes.push(m[2]);
  }
  for (const c of children || []) { c.parent = el; el.children.push(c); }
  return el;
}

function walk(root, out = []) {
  out.push(root);
  for (const c of root.children) walk(c, out);
  return out;
}

function find(root, pred) {
  return walk(root).filter(pred);
}

function byClass(root, cls) {
  return walk(root).find((e) => e.classes.includes(cls));
}

function path(el) {
  const parts = [];
  for (let n = el; n; n = n.parent) {
    parts.unshift(n.tag.toLowerCase() + (n.id ? "#" + n.id : "") + n.classes.map((c) => "." + c).join(""));
  }
  return parts.join(" > ");
}

module.exports = {
  parseCss, matchesSelector, specificity, declFor, computed, allMatching, splitList, splitCompounds,
  node, walk, find, byClass, path,
};
