/* Better Canvas — toast/notification system. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  // Toasts stay deliberately dark/inverse rather than adopting --bc-surface-2:
  // a surface-coloured toast disappears against the page in dark mode. The level
  // colours below are kept verbatim because they already clear AA against white
  // (#1f2937 13.5:1, #0f5132 9.6:1, #8a5a00 6.4:1, #7f1d1d 9.9:1).
  const CSS = `
    .bc-toast-host {
      position: fixed; right: 16px;
      /* Sits above whichever persistent chrome is mounted in this corner: the
         Pomodoro dock raises --bc-dock-bottom, the page-utility buttons raise
         --bc-utility-h. */
      bottom: calc(16px + var(--bc-dock-bottom, 0px) + var(--bc-utility-h, 0px));
      display: flex; flex-direction: column; gap: var(--bc-space-3, 8px);
      z-index: var(--bc-z-toast, 2147483200); pointer-events: none;
      font-family: var(--bc-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: var(--bc-text-md, 14px); line-height: 1.4;
    }
    .bc-toast {
      pointer-events: auto;
      min-width: 240px; max-width: 380px;
      padding: var(--bc-space-4, 10px) var(--bc-space-6, 14px);
      border-radius: var(--bc-radius-lg, 10px);
      background: #1f2937; color: #fff;
      box-shadow: var(--bc-shadow-3, 0 8px 30px rgba(0,0,0,.28));
      display: flex; align-items: flex-start; gap: var(--bc-space-4, 10px);
      opacity: 0; transform: translateY(10px) scale(.98);
      transition: opacity var(--bc-dur-3, 180ms) var(--bc-ease-out, ease),
                  transform var(--bc-dur-3, 180ms) var(--bc-ease-out, ease);
    }
    .bc-toast.show { opacity: 1; transform: translateY(0) scale(1); }
    .bc-toast.info    { background: #1f2937; }
    .bc-toast.success { background: #0f5132; }
    .bc-toast.warn    { background: #8a5a00; }
    .bc-toast.error   { background: #7f1d1d; }
    .bc-toast .bc-toast-body { flex: 1; }
    .bc-toast .bc-toast-title { font-weight: var(--bc-weight-semibold, 600); }
    /* Documented exception: 0.92 white on these chips is still >12:1. */
    .bc-toast .bc-toast-msg { color: rgba(255,255,255,.92); margin-top: 2px; font-size: var(--bc-text-sm, 13px); }
    .bc-toast .bc-toast-close {
      background: none; border: 0; color: #fff; cursor: pointer;
      font-size: var(--bc-text-xl, 16px); line-height: 1; border-radius: var(--bc-radius-sm, 4px); padding: 0 3px;
    }
    .bc-toast .bc-toast-close:hover { background: rgba(255,255,255,.16); }
    .bc-toast .bc-toast-close:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
    .bc-toast .bc-toast-actions { display: flex; gap: var(--bc-space-2, 6px); margin-top: var(--bc-space-2, 6px); }
    .bc-toast .bc-toast-action {
      background: rgba(255,255,255,.12); color: #fff;
      border: 0; border-radius: var(--bc-radius-md, 6px);
      padding: var(--bc-space-1, 4px) var(--bc-space-3, 8px);
      font-family: inherit; font-size: var(--bc-text-xs, 12px); cursor: pointer;
    }
    .bc-toast .bc-toast-action:hover { background: rgba(255,255,255,.2); }
    .bc-toast .bc-toast-action:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
  `;

  // Two hosts, because one region cannot serve both politeness levels: info and
  // success are polite, warn and error are assertive. Before this there was no
  // aria-live at all, so every toast was completely silent to screen readers.
  function host(level) {
    if (!document.body) return null;
    const assertive = level === "warn" || level === "error";
    const id = assertive ? "bc-toast-host-alert" : "bc-toast-host";
    let h = document.querySelector('[data-bc-node="' + id + '"]');
    if (!h) {
      BC.injector && BC.injector.setStyle("bc-toast-css", CSS);
      h = document.createElement("div");
      h.className = "bc-toast-host";
      h.setAttribute("data-bc-node", id);
      h.setAttribute("role", assertive ? "alert" : "status");
      h.setAttribute("aria-live", assertive ? "assertive" : "polite");
      h.setAttribute("aria-atomic", "false");
      document.body.appendChild(h);
    }
    return h;
  }

  BC.toast = {
    show(opts) {
      const { title, message, level, timeout, actions } = Object.assign(
        { level: "info", timeout: 4200 },
        typeof opts === "string" ? { message: opts } : opts || {}
      );
      const h = host(level);
      if (!h) return;
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
      const reduced = BC.ui && BC.ui.motion && BC.ui.motion.reduced();
      if (reduced) el.classList.add("show");
      else requestAnimationFrame(() => el.classList.add("show"));
      if (timeout > 0) {
        setTimeout(() => {
          el.classList.remove("show");
          setTimeout(() => el.remove(), reduced ? 0 : 240);
        }, timeout);
      }
      return el;
    },
    info(msg, opts)    { return BC.toast.show(Object.assign({ level: "info",    message: msg }, opts || {})); },
    success(msg, opts) { return BC.toast.show(Object.assign({ level: "success", message: msg }, opts || {})); },
    warn(msg, opts)    { return BC.toast.show(Object.assign({ level: "warn",    message: msg }, opts || {})); },
    error(msg, opts)   { return BC.toast.show(Object.assign({ level: "error",   message: msg }, opts || {})); },
  };
})();
