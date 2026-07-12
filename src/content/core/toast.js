/* Better Canvas — toast/notification system. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const CSS = `
    .bc-toast-host {
      position: fixed; right: 16px; bottom: 16px;
      display: flex; flex-direction: column; gap: 8px;
      z-index: 2147483000; pointer-events: none;
      font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .bc-toast {
      pointer-events: auto;
      min-width: 240px; max-width: 380px;
      padding: 10px 14px; border-radius: 10px;
      background: #1f2937; color: #fff;
      box-shadow: 0 8px 30px rgba(0,0,0,.28), 0 2px 6px rgba(0,0,0,.18);
      display: flex; align-items: flex-start; gap: 10px;
      opacity: 0; transform: translateY(10px) scale(.98);
      transition: opacity .18s ease, transform .18s ease;
    }
    .bc-toast.show { opacity: 1; transform: translateY(0) scale(1); }
    .bc-toast.info    { background: #1f2937; }
    .bc-toast.success { background: #0f5132; }
    .bc-toast.warn    { background: #8a5a00; }
    .bc-toast.error   { background: #7f1d1d; }
    .bc-toast .bc-toast-body { flex: 1; }
    .bc-toast .bc-toast-title { font-weight: 600; }
    .bc-toast .bc-toast-msg   { opacity: .92; margin-top: 2px; font-size: 13px; }
    .bc-toast .bc-toast-close {
      background: none; border: 0; color: inherit; cursor: pointer; opacity: .8; font-size: 16px;
    }
    .bc-toast .bc-toast-actions { display: flex; gap: 6px; margin-top: 6px; }
    .bc-toast .bc-toast-action {
      background: rgba(255,255,255,.12); color: #fff;
      border: 0; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer;
    }
    .bc-toast .bc-toast-action:hover { background: rgba(255,255,255,.2); }
  `;

  function host() {
    if (!document.body) return null;
    let h = document.querySelector('[data-bc-node="bc-toast-host"]');
    if (!h) {
      BC.injector && BC.injector.setStyle("bc-toast-css", CSS);
      h = document.createElement("div");
      h.className = "bc-toast-host";
      h.setAttribute("data-bc-node", "bc-toast-host");
      document.body.appendChild(h);
    }
    return h;
  }

  BC.toast = {
    show(opts) {
      const h = host();
      if (!h) return;
      const { title, message, level, timeout, actions } = Object.assign(
        { level: "info", timeout: 4200 },
        typeof opts === "string" ? { message: opts } : opts || {}
      );
      const el = document.createElement("div");
      el.className = "bc-toast " + level;

      const body = document.createElement("div");
      body.className = "bc-toast-body";
      if (title) {
        const t = document.createElement("div");
        t.className = "bc-toast-title";
        t.textContent = title;
        body.appendChild(t);
      }
      if (message) {
        const m = document.createElement("div");
        m.className = "bc-toast-msg";
        m.textContent = message;
        body.appendChild(m);
      }
      if (Array.isArray(actions) && actions.length) {
        const row = document.createElement("div");
        row.className = "bc-toast-actions";
        for (const a of actions) {
          const b = document.createElement("button");
          b.className = "bc-toast-action";
          b.textContent = a.label;
          b.addEventListener("click", () => { try { a.onClick && a.onClick(); } catch (_) {} el.remove(); });
          row.appendChild(b);
        }
        body.appendChild(row);
      }

      const close = document.createElement("button");
      close.className = "bc-toast-close";
      close.setAttribute("aria-label", "Dismiss");
      close.textContent = "×";
      close.addEventListener("click", () => el.remove());

      el.appendChild(body);
      el.appendChild(close);
      h.appendChild(el);
      requestAnimationFrame(() => el.classList.add("show"));
      if (timeout > 0) setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 220); }, timeout);
      return el;
    },
    info(msg, opts)    { return BC.toast.show(Object.assign({ level: "info",    message: msg }, opts || {})); },
    success(msg, opts) { return BC.toast.show(Object.assign({ level: "success", message: msg }, opts || {})); },
    warn(msg, opts)    { return BC.toast.show(Object.assign({ level: "warn",    message: msg }, opts || {})); },
    error(msg, opts)   { return BC.toast.show(Object.assign({ level: "error",   message: msg }, opts || {})); },
  };
})();
