/*
 * Better Canvas — shared UI kit.
 * Small element factories (panel, card, button, tabs) plus async-state views
 * (skeleton, empty, errorState) so every feature panel looks and behaves the
 * same. One shared stylesheet built on the mode-aware theme variables.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  // Refined & Canvas-native: panels at rest carry a border and NO shadow —
  // elevation is reserved for things that genuinely float. Every value is a token,
  // with a literal fallback so the kit still renders if it somehow paints before
  // theming has emitted them.
  const SHEET = `
    .bc-panel {
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #1b2430);
      border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-lg, 10px);
      padding: var(--bc-space-5, 12px); margin-bottom: var(--bc-space-5, 12px);
      font-family: var(--bc-font-sans);
      font-size: var(--bc-text-md, 14px);
      line-height: var(--bc-leading-body, 1.5);
      letter-spacing: var(--bc-tracking, 0px);
    }
    .bc-panel-head { display: flex; align-items: center; gap: var(--bc-space-3, 8px); margin-bottom: var(--bc-space-4, 10px); }
    .bc-panel-title { flex: 1; margin: 0; font-size: var(--bc-text-md, 14px); font-weight: var(--bc-weight-bold, 700); }
    .bc-card { background: var(--bc-surface-3, #f7fafc); border-radius: var(--bc-radius-md, 8px); padding: var(--bc-space-4, 10px); }

    /* Figures: tabular numerals so columns of numbers actually align, and no
       inherited letter-spacing to skew them. */
    .bc-num { font-variant-numeric: tabular-nums; letter-spacing: 0; }

    .bc-btn {
      display: inline-flex; align-items: center; gap: var(--bc-space-2, 6px);
      padding: 5px var(--bc-space-5, 12px);
      border-radius: var(--bc-radius-md, 6px); cursor: pointer;
      font-family: inherit; font-size: var(--bc-text-sm, 13px);
      border: 1px solid var(--bc-border, #e5e7eb);
      background: var(--bc-surface-3, #f7fafc); color: var(--bc-text, #1b2430);
      transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                  border-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
    }
    /* A mode-aware wash instead of a brightness filter, which did nothing at all on
       the transparent ghost variant and needed a separate dark-mode twin. */
    .bc-btn:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); }
    .bc-btn.primary {
      background: var(--bc-accent, #4f46e5); border-color: var(--bc-accent, #4f46e5);
      color: var(--bc-accent-contrast, #fff);
    }
    .bc-btn.primary:hover { background: var(--bc-accent-hover, var(--bc-accent, #4f46e5)); }
    .bc-btn.ghost { background: transparent; }
    .bc-btn.ghost:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); }
    .bc-btn:disabled { opacity: .5; cursor: default; }
    .bc-btn:focus-visible {
      outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 1px;
    }

    .bc-sk { display: grid; gap: var(--bc-space-3, 8px); padding: var(--bc-space-1, 4px) 0; }
    .bc-sk-bar {
      height: 14px; border-radius: var(--bc-radius-sm, 4px);
      background: linear-gradient(90deg, var(--bc-surface-3, #eef1f5) 25%, var(--bc-border, #e5e7eb) 50%, var(--bc-surface-3, #eef1f5) 75%);
      background-size: 200% 100%; animation: bc-shimmer 1.2s ease-in-out infinite;
    }
    @keyframes bc-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .bc-sk-bar { animation: none; } }
    :root[data-bc-motion="0"] .bc-sk-bar { animation: none; }

    .bc-empty, .bc-error {
      padding: var(--bc-space-6, 14px) var(--bc-space-4, 10px);
      font-size: var(--bc-text-sm, 13px); color: var(--bc-muted, #6b7280);
    }
    /* A token, not opacity: dimming already-AA text with opacity pushes it below AA. */
    .bc-empty-hint { font-size: var(--bc-text-xs, 12px); color: var(--bc-text-subtle, var(--bc-muted, #6b7280)); margin-top: var(--bc-space-1, 4px); }
    .bc-error { display: flex; align-items: center; gap: var(--bc-space-4, 10px); flex-wrap: wrap; color: var(--bc-danger, #b91c1c); }
    .bc-error-msg::before { content: "⚠ "; }

    .bc-tabs [role="tablist"] { display: flex; gap: var(--bc-space-1, 4px); border-bottom: 1px solid var(--bc-border, #e5e7eb); margin-bottom: var(--bc-space-4, 10px); }
    .bc-tabs [role="tab"] {
      padding: var(--bc-space-2, 6px) var(--bc-space-5, 12px); border: 0; background: transparent; cursor: pointer;
      font-family: inherit; color: var(--bc-muted, #6b7280); font-size: var(--bc-text-sm, 13px);
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .bc-tabs [role="tab"][aria-selected="true"] { color: var(--bc-text, #1b2430); border-bottom-color: var(--bc-accent-stroke, var(--bc-accent, #4f46e5)); font-weight: var(--bc-weight-semibold, 600); }
    .bc-tabs [role="tab"]:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: -2px; }

    .bc-sr-only {
      position: absolute !important; width: 1px; height: 1px; overflow: hidden;
      clip-path: inset(50%); white-space: nowrap; border: 0; padding: 0; margin: -1px;
    }

    .bc-iconbtn {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 26px; min-height: 26px; padding: 2px;
      border: 0; border-radius: var(--bc-radius-md, 6px);
      background: transparent; color: var(--bc-muted, #6b7280); cursor: pointer;
      font-family: inherit; font-size: var(--bc-text-sm, 13px); line-height: 1;
      transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                  color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
    }
    .bc-iconbtn:hover { background: var(--bc-surface-4, rgba(0,0,0,.05)); color: var(--bc-text, #1b2430); }
    .bc-iconbtn[aria-pressed="true"] { background: var(--bc-accent-weak, rgba(79,70,229,.12)); color: var(--bc-accent-text, var(--bc-accent)); }
    .bc-iconbtn:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 1px; }

    .bc-badge2 {
      display: inline-flex; align-items: center; gap: var(--bc-space-1, 4px);
      padding: 1px var(--bc-space-2, 6px); border-radius: var(--bc-radius-pill, 999px);
      font-size: var(--bc-text-2xs, 11px); font-weight: var(--bc-weight-semibold, 600);
      background: var(--bc-surface-4, rgba(0,0,0,.05)); color: var(--bc-text, #1b2430);
    }
    .bc-badge2--accent  { background: var(--bc-accent, #4f46e5); color: var(--bc-accent-contrast, #fff); }
    .bc-badge2--success { background: var(--bc-success, #047857); color: var(--bc-success-fg, #fff); }
    .bc-badge2--warn    { background: var(--bc-warn, #a16207); color: var(--bc-warn-fg, #fff); }
    .bc-badge2--danger  { background: var(--bc-danger, #b91c1c); color: var(--bc-danger-fg, #fff); }
    .bc-badge2--info    { background: var(--bc-info, #0369a1); color: var(--bc-info-fg, #fff); }

    .bc-eyebrow {
      font-size: var(--bc-text-2xs, 11px); font-weight: var(--bc-weight-semibold, 600);
      text-transform: uppercase; letter-spacing: var(--bc-tracking-caps, .04em);
      color: var(--bc-muted, #6b7280);
    }
    .bc-stat { display: flex; flex-direction: column; gap: 2px; }
    .bc-stat-value { font-size: var(--bc-text-figure, 24px); font-weight: var(--bc-weight-bold, 700); line-height: var(--bc-leading-tight, 1.25); }
    .bc-stat-sub { font-size: var(--bc-text-xs, 12px); color: var(--bc-text-subtle, var(--bc-muted, #6b7280)); }
    .bc-t-success { color: var(--bc-success, #047857); }
    .bc-t-warn    { color: var(--bc-warn, #a16207); }
    .bc-t-danger  { color: var(--bc-danger, #b91c1c); }

    .bc-progress2 {
      position: relative; height: 6px; border-radius: var(--bc-radius-pill, 999px);
      background: var(--bc-surface-4, rgba(0,0,0,.06)); overflow: hidden;
    }
    .bc-progress2-fill {
      height: 100%; width: 0%; border-radius: inherit;
      background: var(--bc-accent-stroke, var(--bc-accent, #4f46e5));
      transition: width var(--bc-dur-4, 300ms) var(--bc-ease-out, ease);
    }
    .bc-bg-success { background: var(--bc-success, #047857); }
    .bc-bg-warn    { background: var(--bc-warn, #a16207); }
    .bc-bg-danger  { background: var(--bc-danger, #b91c1c); }
    .bc-spark { line-height: 0; display: inline-block; }

    .bc-scrim {
      position: fixed; inset: 0; z-index: var(--bc-z-modal, 2147482500);
      background: var(--bc-overlay, rgba(15,20,28,.44));
      display: flex; align-items: center; justify-content: center;
      padding: var(--bc-space-7, 16px);
      animation: bc-fade var(--bc-dur-3, 220ms) var(--bc-ease-out, ease);
    }
    @keyframes bc-fade { from { opacity: 0; } to { opacity: 1; } }
    .bc-dialog {
      background: var(--bc-surface-2, #fff); color: var(--bc-text, #1b2430);
      border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-xl, 12px);
      box-shadow: var(--bc-shadow-4, 0 24px 64px rgba(0,0,0,.3));
      padding: var(--bc-space-8, 20px); max-width: 460px; width: 100%;
      font-family: var(--bc-font-sans); font-size: var(--bc-text-md, 14px);
      line-height: var(--bc-leading-body, 1.5);
      animation: bc-pop var(--bc-dur-3, 220ms) var(--bc-ease-out, ease);
    }
    @keyframes bc-pop { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: none; } }
    :root[data-bc-motion="0"] .bc-scrim, :root[data-bc-motion="0"] .bc-dialog { animation: none; }
    @media (prefers-reduced-motion: reduce) { .bc-scrim, .bc-dialog { animation: none; } }
    .bc-dialog-title { margin: 0 0 var(--bc-space-2, 6px); font-size: var(--bc-text-xl, 17px); font-weight: var(--bc-weight-bold, 700); }
    .bc-dialog-body { color: var(--bc-text, #1b2430); }
    .bc-dialog-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--bc-space-3, 8px); margin-top: var(--bc-space-6, 14px); }
    .bc-dialog-body p { margin: 0; color: var(--bc-muted, #6b7280); }
    .bc-tour-nav { display: inline-flex; align-items: center; gap: var(--bc-space-3, 8px); }
  `;

  // Hoisted behind a flag: every factory called ensure(), so a panel built from a
  // dozen primitives hit setStyle a dozen times. Reset by the registry apply() so
  // teardown followed by re-enable still re-injects the sheet.
  let injected = false;
  function ensure() {
    if (injected) return;
    injected = true;
    if (BC.injector) BC.injector.setStyle("bc-ui", SHEET);
    else if (document.head) {
      // Standalone documents (options page) have no injector.
      const tag = document.createElement("style");
      tag.setAttribute("data-better-canvas", "bc-ui");
      tag.textContent = SHEET;
      document.head.appendChild(tag);
    }
  }

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

    visuallyHidden(text) { return el("span", { class: "bc-sr-only", text: text || "" }); },

    // Honours BOTH the in-app reduced-motion switch and the OS setting. CSS can't
    // reach JS-driven animation (scrollIntoView, rAF sequences), so those gate here.
    motion: {
      reduced() {
        if (document.documentElement.getAttribute("data-bc-motion") === "0") return true;
        return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      },
    },

    // Two singletons: one host cannot serve both politeness levels.
    liveRegion(politeness) {
      const assertive = politeness === "assertive";
      const id = assertive ? "bc-live-assertive" : "bc-live-polite";
      let node = document.querySelector('[data-bc-node="' + id + '"]');
      if (!node) {
        node = el("div", {
          class: "bc-sr-only", role: assertive ? "alert" : "status",
          "aria-live": assertive ? "assertive" : "polite", "aria-atomic": "true",
        });
        node.setAttribute("data-bc-node", id);
        (document.body || document.documentElement).appendChild(node);
      }
      return {
        announce(text) {
          // Clear first, or an identical string is not re-announced.
          node.textContent = "";
          setTimeout(() => { node.textContent = String(text == null ? "" : text); }, 30);
        },
      };
    },

    // `label` is required — an icon-only control with no accessible name is the
    // single most common a11y defect in this codebase.
    iconButton(glyph, { label, title, variant, pressed, onClick } = {}) {
      ensure();
      if (!label) BC.util.warn("ui.iconButton called without a label", glyph);
      const b = el("button", {
        class: "bc-iconbtn" + (variant ? " " + variant : ""), type: "button",
        "aria-label": label || "", title: title || label || "",
      });
      b.appendChild(el("span", { "aria-hidden": "true", text: glyph }));
      if (pressed != null) b.setAttribute("aria-pressed", pressed ? "true" : "false");
      if (onClick) b.addEventListener("click", onClick);
      return b;
    },

    badge(text, { tone, label } = {}) {
      ensure();
      const s = el("span", { class: "bc-badge2 bc-num" + (tone ? " bc-badge2--" + tone : ""), text: String(text) });
      if (label) { s.setAttribute("aria-label", label); }
      return s;
    },

    stat({ label, value, sub, tone } = {}) {
      ensure();
      const kids = [el("div", { class: "bc-eyebrow", text: label || "" }),
                    el("div", { class: "bc-stat-value bc-num" + (tone ? " bc-t-" + tone : ""), text: String(value == null ? "—" : value) })];
      if (sub) kids.push(el("div", { class: "bc-stat-sub", text: sub }));
      return el("div", { class: "bc-stat" }, kids);
    },

    // set() transitions ONLY when the value actually changed, so a bar inside a
    // feature that re-applies ~5x/second stops re-animating on every tick.
    progress({ value = 0, max = 100, label, tone } = {}) {
      ensure();
      const fill = el("div", { class: "bc-progress2-fill" + (tone ? " bc-bg-" + tone : "") });
      const root = el("div", {
        class: "bc-progress2", role: "progressbar",
        "aria-valuemin": "0", "aria-valuemax": String(max), "aria-label": label || "Progress",
      }, [fill]);
      let current = null;
      function set(v) {
        const pct = Math.max(0, Math.min(100, max ? (Number(v) / max) * 100 : 0));
        if (current !== null && Math.abs(current - pct) < 0.01) return;
        current = pct;
        root.setAttribute("aria-valuenow", String(Math.round(Number(v) || 0)));
        fill.style.width = pct.toFixed(1) + "%";
      }
      set(value);
      return { root, set };
    },

    // The one implementation of sparkline point math. There were two independent
    // hand-rolled copies (grades.js trendSVG and the Insights tab).
    sparkline(values, { width = 120, height = 28, pad = 3, tone = "auto", label } = {}) {
      ensure();
      const v = (values || []).map(Number).filter((n) => isFinite(n));
      if (v.length < 2) return null;
      const min = Math.min(...v), max = Math.max(...v);
      const span = Math.max(0.001, max - min);
      const pts = v.map((s, i) =>
        ((i / (v.length - 1)) * (width - pad * 2) + pad).toFixed(1) + "," +
        (height - pad - ((s - min) / span) * (height - pad * 2)).toFixed(1)).join(" ");
      const delta = v[v.length - 1] - v[0];
      const stroke = tone === "auto"
        ? (delta >= 0 ? "var(--bc-success)" : "var(--bc-danger)")
        : "var(--bc-accent-stroke, var(--bc-accent))";
      const wrap = el("span", { class: "bc-spark" });
      wrap.innerHTML = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height +
        '" role="img" aria-label="' + BC.util.escapeHtml(label || ("Trend, " + (delta >= 0 ? "up " : "down ") + Math.abs(delta).toFixed(1))) +
        '"><polyline points="' + pts + '" fill="none" stroke="' + stroke + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
      return wrap;
    },

    // container may be a ShadowRoot. From outside a shadow root
    // document.activeElement reports the HOST, not the focused control, so a naive
    // trap on the drawer never matches and lets focus escape immediately.
    focusTrap(container, { initial, returnTo } = {}) {
      const SEL = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),' +
                  'textarea:not(:disabled),[tabindex]:not([tabindex="-1"]),summary,' +
                  '[contenteditable=""],[contenteditable="true"]';
      const activeIn = () => container.activeElement || document.activeElement;
      const tabbables = () => Array.from(container.querySelectorAll(SEL))
        .filter((e) => !e.hasAttribute("inert") && e.getClientRects().length > 0);
      const previous = returnTo ||
        (document.activeElement && document.activeElement !== document.body ? document.activeElement : null);

      function onKey(e) {
        if (e.key !== "Tab") return;
        const list = tabbables();
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        const cur = activeIn();
        if (e.shiftKey && (cur === first || list.indexOf(cur) === -1)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
      }
      container.addEventListener("keydown", onKey, true);
      const target = initial || tabbables()[0];
      if (target) BC.util.guard(() => target.focus(), "focusTrap initial");
      return {
        release() {
          container.removeEventListener("keydown", onKey, true);
          if (previous && previous.isConnected) BC.util.guard(() => previous.focus(), "focusTrap restore");
        },
      };
    },

    // Modal dialog: scrim, focus trap, Escape, focus restoration.
    dialog({ title, body, actions, dismissible = true, onClose, nodeId = "bc-dialog" } = {}) {
      ensure();
      const titleId = "bc-dlg-t-" + Math.random().toString(36).slice(2, 8);
      const head = el("h2", { class: "bc-dialog-title", id: titleId, text: title || "" });
      const bodyEl = el("div", { class: "bc-dialog-body" }, body ? [].concat(body) : []);
      const foot = el("div", { class: "bc-dialog-foot" }, actions || []);
      const panel = el("div", {
        class: "bc-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId,
      }, title ? [head, bodyEl, foot] : [bodyEl, foot]);
      const root = el("div", { class: "bc-scrim" }, [panel]);
      root.setAttribute("data-bc-node", nodeId);

      let trap = null;
      function close() {
        if (trap) { trap.release(); trap = null; }
        root.remove();
        if (onClose) BC.util.guard(onClose, "dialog onClose");
      }
      root.addEventListener("mousedown", (e) => { if (dismissible && e.target === root) close(); });
      root.addEventListener("keydown", (e) => { if (dismissible && e.key === "Escape") { e.stopPropagation(); close(); } });

      return {
        root, panel, body: bodyEl, foot,
        open() {
          (document.body || document.documentElement).appendChild(root);
          trap = BC.ui.focusTrap(root);
          return root;
        },
        close,
        setBody(node) { bodyEl.replaceChildren(node); },
      };
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

  // Registered so teardown removes the shared sheet with everything else. Guarded
  // because the kit is also loaded in documents that have no registry.
  if (BC.registry) {
    BC.registry.register({
      id: "ui", styles: ["bc-ui"], nodes: [],
      apply() {
        // Re-assert only if a teardown actually removed the sheet, rather than
        // calling setStyle on every tick.
        if (injected && !document.querySelector('style[data-better-canvas="bc-ui"]')) injected = false;
        ensure();
      },
    });
  }
})();
