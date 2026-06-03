/* Better Canvas — small shared utilities (content + extension pages). */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const PREFIX = "[Better Canvas]";
  const util = (BC.util = {
    log(...args) {
      try {
        console.log(PREFIX, ...args);
      } catch (_) {}
    },
    warn(...args) {
      try {
        console.warn(PREFIX, ...args);
      } catch (_) {}
    },

    // Run fn safely; never let one feature's error break Canvas or other features.
    guard(fn, label) {
      try {
        return fn();
      } catch (e) {
        util.warn("error in", label || fn.name || "anonymous", e);
        return undefined;
      }
    },

    debounce(fn, wait) {
      let t = null;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    // Resolve once the DOM body exists (works even at document_start).
    whenBody(cb) {
      if (document.body) return cb();
      const obs = new MutationObserver(() => {
        if (document.body) {
          obs.disconnect();
          cb();
        }
      });
      obs.observe(document.documentElement, { childList: true });
    },

    onReady(cb) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", cb, { once: true });
      } else {
        cb();
      }
    },

    // Extract a course id from a Canvas href like "/courses/12345" or
    // ".../courses/12345/..." Returns string id or null.
    courseIdFromHref(href) {
      if (!href) return null;
      const m = String(href).match(/\/courses\/(\d+)/);
      return m ? m[1] : null;
    },

    escapeHtml(s) {
      return String(s == null ? "" : s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c]
      );
    },

    // Basic CSS string sanitizer for user-provided values used inside style text.
    cssSafe(s) {
      return String(s == null ? "" : s).replace(/[<>]/g, "");
    },

    // Convert "#rrggbb" (or short hex) to {r,g,b}; returns null on failure.
    hexToRgb(hex) {
      if (!hex) return null;
      let h = String(hex).trim().replace(/^#/, "");
      if (h.length === 3)
        h = h
          .split("")
          .map((c) => c + c)
          .join("");
      if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    },

    // Perceived luminance 0-255 (for choosing readable text on a colored card).
    luminance(hex) {
      const c = util.hexToRgb(hex);
      if (!c) return 255;
      return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    },

    // Build an element with attrs/children quickly.
    el(tag, attrs, children) {
      const node = document.createElement(tag);
      if (attrs)
        for (const [k, v] of Object.entries(attrs)) {
          if (v == null) continue;
          if (k === "class") node.className = v;
          else if (k === "style" && typeof v === "object")
            Object.assign(node.style, v);
          else if (k === "text") node.textContent = v;
          else if (k.startsWith("on") && typeof v === "function")
            node.addEventListener(k.slice(2).toLowerCase(), v);
          else if (k === "dataset") Object.assign(node.dataset, v);
          else node.setAttribute(k, v);
        }
      if (children)
        for (const c of [].concat(children))
          if (c != null)
            node.appendChild(
              typeof c === "string" ? document.createTextNode(c) : c
            );
      return node;
    },

    // True when a value is a safe http(s)/data image URL (used before injecting).
    isSafeUrl(url) {
      if (!url) return false;
      return /^(https?:|data:image\/)/i.test(String(url).trim());
    },
  });
})();
