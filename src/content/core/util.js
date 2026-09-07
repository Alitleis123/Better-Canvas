/* Better Canvas — shared utilities. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const PREFIX = "[Better Canvas]";

  const util = (BC.util = {
    log(...a) { try { console.log(PREFIX, ...a); } catch (_) {} },
    warn(...a) { try { console.warn(PREFIX, ...a); } catch (_) {} },
    err(...a) { try { console.error(PREFIX, ...a); } catch (_) {} },

    guard(fn, label) {
      try { return fn(); }
      catch (e) {
        util.warn("error in", label || fn.name || "anon", e);
        if (BC.diag) BC.diag.push(label || fn.name || "anon", e);
        return undefined;
      }
    },

    async aguard(fn, label) {
      try { return await fn(); }
      catch (e) {
        util.warn("async error in", label || fn.name || "anon", e);
        if (BC.diag) BC.diag.push(label || fn.name || "anon", e);
        return undefined;
      }
    },

    debounce(fn, wait) {
      let t = null;
      return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), wait); };
    },

    throttle(fn, wait) {
      let last = 0, timer = null, lastArgs = null, self;
      return function (...a) {
        const now = Date.now();
        const remaining = wait - (now - last);
        self = this; lastArgs = a;
        if (remaining <= 0) {
          if (timer) { clearTimeout(timer); timer = null; }
          last = now; fn.apply(self, lastArgs);
        } else if (!timer) {
          timer = setTimeout(() => { last = Date.now(); timer = null; fn.apply(self, lastArgs); }, remaining);
        }
      };
    },

    // Short-circuiting structural compare. Replaces the settings store's
    // stringify-and-compare, which serialized the whole tree several times per
    // keystroke; this bails on the first difference and allocates nothing.
    deepEqual(a, b) {
      if (a === b) return true;
      if (a == null || b == null || typeof a !== "object" || typeof b !== "object") return false;
      const aa = Array.isArray(a);
      if (aa !== Array.isArray(b)) return false;
      if (aa) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!util.deepEqual(a[i], b[i])) return false;
        return true;
      }
      const ak = Object.keys(a);
      if (ak.length !== Object.keys(b).length) return false;
      for (const k of ak) { if (!(k in b) || !util.deepEqual(a[k], b[k])) return false; }
      return true;
    },

    // Bounded-concurrency map. Promise.all over every course at once meant up to
    // ~400 simultaneous paginated requests from the dashboard, which Canvas
    // rate-limits — taking every other feature down with it.
    async mapLimit(items, limit, worker) {
      const list = Array.from(items || []);
      const out = new Array(list.length);
      let i = 0;
      const runners = Array.from({ length: Math.max(1, Math.min(limit, list.length)) }, async () => {
        while (i < list.length) { const n = i++; out[n] = await worker(list[n], n); }
      });
      await Promise.all(runners);
      return out;
    },

    whenBody(cb) {
      if (document.body) return cb();
      const obs = new MutationObserver(() => { if (document.body) { obs.disconnect(); cb(); } });
      obs.observe(document.documentElement, { childList: true });
    },

    onReady(cb) {
      if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", cb, { once: true });
      else cb();
    },

    courseIdFromHref(href) {
      if (!href) return null;
      const m = String(href).match(/\/courses\/(\d+)/);
      return m ? m[1] : null;
    },

    escapeHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
      ));
    },

    cssSafe(s) { return String(s == null ? "" : s).replace(/[<>]/g, ""); },

    isSafeUrl(url) {
      if (!url) return false;
      const s = String(url).trim();
      return /^(https?:|data:image\/)/i.test(s);
    },

    isSafeHttpUrl(url) {
      if (!url) return false;
      try {
        const u = new URL(url);
        return /^https?:$/.test(u.protocol);
      } catch (_) { return false; }
    },

    el(tag, attrs, children) {
      const node = document.createElement(tag);
      if (attrs) for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "checked") node.checked = !!v;
        else if (k === "value") node.value = v;
        else if (k.startsWith("on") && typeof v === "function")
          node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "dataset") Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? "" : v);
      }
      if (children != null) {
        for (const c of [].concat(children)) {
          if (c == null) continue;
          node.appendChild(typeof c === "string" || typeof c === "number"
            ? document.createTextNode(String(c)) : c);
        }
      }
      return node;
    },

    // Simple template: h('div.class#id', {attr:v}, [...]) — supports selector-ish tag
    h(sel, attrs, children) {
      if (typeof sel !== "string") return util.el(sel, attrs, children);
      const parts = sel.match(/^([a-zA-Z][\w-]*)?(#[\w-]+)?((?:\.[\w-]+)*)$/);
      if (!parts) return util.el(sel, attrs, children);
      const tag = parts[1] || "div";
      const id = parts[2] ? parts[2].slice(1) : null;
      const classes = parts[3] ? parts[3].slice(1).split(".").join(" ") : null;
      const a = Object.assign({}, attrs || {});
      if (id) a.id = id;
      if (classes) a.class = a.class ? classes + " " + a.class : classes;
      return util.el(tag, a, children);
    },

    uuid() { return "u" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); },

    clamp(n, min, max) { return Math.max(min, Math.min(max, n)); },

    // Detect Mac for shortcut labels. navigator.platform is deprecated and
    // already frozen or absent in some engines, so prefer userAgentData and fall
    // back through platform to the UA string rather than silently labelling
    // every Mac shortcut "Ctrl".
    isMac: (function () {
      try {
        const uaPlatform = navigator.userAgentData && navigator.userAgentData.platform;
        if (uaPlatform) return /mac/i.test(uaPlatform);
        if (navigator.platform) return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
        return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || "");
      } catch (_) { return false; }
    })(),

    modLabel() { return util.isMac ? "⌘" : "Ctrl"; },
  });
})();
