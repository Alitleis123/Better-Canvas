/*
 * Better Canvas — shared UI kit.
 * Small element factories (panel, card, button, tabs) plus async-state views
 * (skeleton, empty, errorState) so every feature panel looks and behaves the
 * same. One shared stylesheet built on the mode-aware theme variables.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const SHEET = `
    .bc-panel {
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #1b2430);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: 10px;
      padding: 12px; margin-bottom: 12px;
    }
    .bc-panel-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .bc-panel-title { flex: 1; margin: 0; font-size: 14px; font-weight: 700; }
    .bc-card { background: var(--bc-surface-3, #f7fafc); border-radius: 8px; padding: 10px; }

    .bc-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;
      border: 1px solid var(--bc-border, #e5e7eb);
      background: var(--bc-surface-3, #f7fafc); color: var(--bc-text, #1b2430);
    }
    .bc-btn:hover { filter: brightness(0.96); }
    html.bc-dark .bc-btn:hover { filter: brightness(1.15); }
    .bc-btn.primary { background: var(--bc-accent, #4f46e5); border-color: var(--bc-accent, #4f46e5); color: #fff; }
    .bc-btn.ghost { background: transparent; }
    .bc-btn:disabled { opacity: .5; cursor: default; }
    .bc-btn:focus-visible { outline: 2px solid var(--bc-accent, #4f46e5); outline-offset: 1px; }

    .bc-sk { display: grid; gap: 8px; padding: 4px 0; }
    .bc-sk-bar {
      height: 14px; border-radius: 4px;
      background: linear-gradient(90deg, var(--bc-surface-3, #eef1f5) 25%, var(--bc-border, #e5e7eb) 50%, var(--bc-surface-3, #eef1f5) 75%);
      background-size: 200% 100%; animation: bc-shimmer 1.2s ease-in-out infinite;
    }
    @keyframes bc-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .bc-sk-bar { animation: none; } }

    .bc-empty, .bc-error { padding: 14px 10px; font-size: 13px; color: var(--bc-muted, #6b7280); }
    .bc-empty-hint { font-size: 12px; opacity: .8; margin-top: 4px; }
    .bc-error { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .bc-error-msg::before { content: "⚠ "; }

    .bc-tabs [role="tablist"] { display: flex; gap: 4px; border-bottom: 1px solid var(--bc-border, #e5e7eb); margin-bottom: 10px; }
    .bc-tabs [role="tab"] {
      padding: 6px 12px; border: 0; background: transparent; cursor: pointer;
      color: var(--bc-muted, #6b7280); font-size: 13px;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .bc-tabs [role="tab"][aria-selected="true"] { color: var(--bc-text, #1b2430); border-bottom-color: var(--bc-accent, #4f46e5); font-weight: 600; }
    .bc-tabs [role="tab"]:focus-visible { outline: 2px solid var(--bc-accent, #4f46e5); outline-offset: -2px; }
  `;

  function ensure() { BC.injector.setStyle("bc-ui", SHEET); }

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    for (const c of children || []) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  BC.ui = {
    el,

    panel({ title, actions } = {}) {
      ensure();
      const body = el("div", { class: "bc-panel-body" });
      const head = el("div", { class: "bc-panel-head" }, [
        el("h3", { class: "bc-panel-title", text: title || "" }),
        ...(actions || []),
      ]);
      const root = el("section", { class: "bc-panel" }, title || (actions && actions.length) ? [head, body] : [body]);
      return { root, head, body };
    },

    card(children) {
      ensure();
      return el("div", { class: "bc-card" }, children || []);
    },

    button(label, { variant, title, onClick } = {}) {
      ensure();
      const b = el("button", { class: "bc-btn" + (variant ? " " + variant : ""), type: "button", text: label });
      if (title) b.title = title;
      if (onClick) b.addEventListener("click", onClick);
      return b;
    },

    skeleton(rows = 3) {
      ensure();
      const widths = [92, 68, 80, 55, 74];
      const bars = [];
      for (let i = 0; i < rows; i++) bars.push(el("div", { class: "bc-sk-bar", style: "width:" + widths[i % widths.length] + "%" }));
      return el("div", { class: "bc-sk", role: "status", "aria-label": "Loading" }, bars);
    },

    empty(message, hint) {
      ensure();
      const kids = [el("div", { text: message || "Nothing here yet." })];
      if (hint) kids.push(el("div", { class: "bc-empty-hint", text: hint }));
      return el("div", { class: "bc-empty" }, kids);
    },

    errorState(message, onRetry) {
      ensure();
      const kids = [el("span", { class: "bc-error-msg", text: message || "Something went wrong." })];
      if (onRetry) kids.push(BC.ui.button("Retry", { onClick: onRetry }));
      return el("div", { class: "bc-error", role: "alert" }, kids);
    },

    // items: [{ id, label, render(container) }] — roving-tabindex tablist.
    tabs(items, { initial } = {}) {
      ensure();
      const list = el("div", { role: "tablist" });
      const view = el("div", { class: "bc-tabview" });
      const root = el("div", { class: "bc-tabs" }, [list, view]);
      const btns = new Map();
      let current = null;

      function select(id, focus) {
        if (current === id) return;
        current = id;
        for (const [tid, b] of btns) {
          const on = tid === id;
          b.setAttribute("aria-selected", on ? "true" : "false");
          b.tabIndex = on ? 0 : -1;
          if (on && focus) b.focus();
        }
        view.innerHTML = "";
        const item = items.find((i) => i.id === id);
        if (item) item.render(view);
      }

      items.forEach((item) => {
        const b = el("button", { role: "tab", type: "button", text: item.label, "aria-selected": "false" });
        b.tabIndex = -1;
        b.addEventListener("click", () => select(item.id));
        btns.set(item.id, b);
        list.appendChild(b);
      });
      list.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const ids = items.map((i) => i.id);
        const idx = ids.indexOf(current);
        const next = ids[(idx + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
        select(next, true);
        e.preventDefault();
      });

      select(initial || (items[0] && items[0].id));
      return { root, select };
    },
  };

  // Registered so teardown removes the shared sheet with everything else.
  BC.registry.register({ id: "ui", styles: ["bc-ui"], nodes: [], apply() { ensure(); } });
})();
