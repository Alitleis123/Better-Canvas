/*
 * Better Canvas — shared settings UI.
 * Builds the entire settings interface in JS and injects its own <style>, so it
 * renders identically inside a Shadow-DOM drawer (content script) and on the
 * standalone options page. All reads/writes go through a small adapter; this
 * module never touches chrome.* directly.
 *
 * BC.SettingsUI.render(rootEl, adapter) -> { refresh }
 *
 * adapter = {
 *   getState()    -> merged settings object (sync snapshot)
 *   save(state)   -> persist (may return a Promise)
 *   subscribe(cb) -> external-change notifications, returns unsubscribe (optional)
 *   getCourses()  -> Promise<[{id,name,code,color}]>
 *   getGpaData()  -> Promise<[{id,name,score,concluded}]>
 * }
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const el = BC.util.el;

  const BRAND_SVG =
    '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
    '<rect x="3" y="3" width="8" height="8" rx="2.2" fill="#fff"/>' +
    '<rect x="13" y="3" width="8" height="8" rx="2.2" fill="#fff" fill-opacity="0.82"/>' +
    '<rect x="3" y="13" width="8" height="8" rx="2.2" fill="#fff" fill-opacity="0.82"/>' +
    '<rect x="13" y="13" width="8" height="8" rx="2.2" fill="#fff"/></svg>';

  const STYLE = `
:host { all: initial; }
.bc-ui, .bc-ui *, .bc-ui *::before, .bc-ui *::after { box-sizing: border-box; }
.bc-ui {
  --bc-bg: #f4f4fa;
  --bc-surface: #ffffff;
  --bc-surface-2: #f0f0f7;
  --bc-text: #15151f;
  --bc-muted: #5e5e76;
  --bc-faint: #9595ac;
  --bc-border: #ebebf3;
  --bc-border-strong: #d8d8e6;
  --bc-brand: #5b4ee6;
  --bc-brand-2: #8b5cf6;
  --bc-brand-soft: rgba(91, 78, 230, 0.10);
  --bc-accent: #12a878;
  --bc-danger: #e0524c;
  --bc-grad: linear-gradient(135deg, #5b4ee6, #8b5cf6);
  --bc-ring: rgba(91, 78, 230, 0.30);
  --bc-shadow: 0 10px 34px -10px rgba(30, 27, 75, 0.30);
  --bc-font: ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --bc-mono: ui-monospace, "Cascadia Code", "SF Mono", "JetBrains Mono", Consolas, monospace;

  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--bc-bg);
  color: var(--bc-text);
  font-family: var(--bc-font);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.bc-ui.bc-dark {
  --bc-bg: #100f17;
  --bc-surface: #1a1925;
  --bc-surface-2: #232233;
  --bc-text: #edecf6;
  --bc-muted: #a6a6c0;
  --bc-faint: #6f6f8c;
  --bc-border: #29283a;
  --bc-border-strong: #3a3950;
  --bc-brand: #8b7cf8;
  --bc-brand-2: #b29bfb;
  --bc-brand-soft: rgba(139, 124, 248, 0.16);
  --bc-accent: #2dd4a7;
  --bc-danger: #f0685c;
  --bc-grad: linear-gradient(135deg, #8b7cf8, #b29bfb);
  --bc-ring: rgba(139, 124, 248, 0.40);
  --bc-shadow: 0 16px 50px -10px rgba(0, 0, 0, 0.6);
}

.bc-hidden { display: none !important; }

/* ---- Top bar ---------------------------------------------------------- */
.bc-topbar {
  flex: 0 0 auto;
  padding: 16px 18px 13px;
  background: var(--bc-surface);
  border-bottom: 1px solid var(--bc-border);
}
.bc-topbar-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
.bc-brand { display: flex; align-items: center; gap: 11px; min-width: 0; flex: 1 1 auto; }
.bc-brandmark {
  flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 10px; background: var(--bc-grad);
  box-shadow: 0 4px 12px -2px var(--bc-ring);
}
.bc-brand-tt { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.bc-brand-tt strong { font-size: 15px; font-weight: 800; letter-spacing: -0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-brand-tt small { font-size: 10px; color: var(--bc-faint); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.12em; }

.bc-enabled { display: inline-flex; align-items: center; gap: 9px; font-weight: 700;
  font-size: 12px; color: var(--bc-muted); flex: 0 0 auto; }

.bc-topbar-actions { display: flex; align-items: center; gap: 7px; margin-top: 13px; min-width: 0; }
.bc-status { margin-left: auto; font-size: 12px; font-weight: 700; color: var(--bc-faint);
  white-space: nowrap; flex: 0 0 auto; }
.bc-status--saving { color: var(--bc-muted); }
.bc-status--ok { color: var(--bc-accent); }

/* ---- Tabs ------------------------------------------------------------- */
.bc-tabs {
  flex: 0 0 auto;
  display: flex; flex-wrap: wrap; gap: 2px 3px; padding: 7px 10px 0;
  background: var(--bc-surface);
  border-bottom: 1px solid var(--bc-border);
}
.bc-tab {
  position: relative; flex: 0 1 auto;
  border: none; background: none; cursor: pointer;
  padding: 8px 10px 11px; font: inherit; font-weight: 700; font-size: 12.5px;
  color: var(--bc-muted); white-space: nowrap; border-radius: 8px 8px 0 0;
  transition: color 0.14s, background 0.14s;
}
.bc-tab:hover { color: var(--bc-text); background: var(--bc-surface-2); }
.bc-tab.bc-active { color: var(--bc-brand); }
.bc-tab.bc-active::after {
  content: ""; position: absolute; left: 11px; right: 11px; bottom: 0; height: 3px;
  border-radius: 3px 3px 0 0; background: var(--bc-grad);
}

/* ---- Body / panels ---------------------------------------------------- */
.bc-body { flex: 1 1 auto; min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden;
  padding: 16px; scrollbar-width: thin; scrollbar-color: var(--bc-border-strong) transparent; }
.bc-body::-webkit-scrollbar { width: 10px; }
.bc-body::-webkit-scrollbar-thumb { background: var(--bc-border-strong); border-radius: 99px;
  border: 3px solid var(--bc-bg); }
.bc-panel { display: none; min-width: 0; }
.bc-panel.bc-active { display: block; animation: bc-fade 0.26s ease; }
@keyframes bc-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* ---- Cards ------------------------------------------------------------ */
.bc-card {
  min-width: 0; overflow: hidden;
  background: var(--bc-surface); border: 1px solid var(--bc-border);
  border-radius: 14px; padding: 4px 15px; margin-bottom: 13px;
  box-shadow: 0 1px 2px rgba(16, 16, 31, 0.04);
}
.bc-card-head { display: flex; align-items: center; justify-content: space-between;
  gap: 10px; min-width: 0; padding: 13px 0 5px; }
.bc-card-title { margin: 0; min-width: 0; font-size: 14px; font-weight: 800; letter-spacing: -0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-card-head .bc-btn { flex: 0 0 auto; }
.bc-subhead { margin: 13px 0 3px; font-size: 11px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--bc-faint); }

.bc-row { display: flex; align-items: center; justify-content: space-between; gap: 14px;
  min-width: 0; padding: 11px 0; border-bottom: 1px solid var(--bc-border); }
.bc-row:last-child { border-bottom: none; }
.bc-row-label { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto;
  font-weight: 600; overflow-wrap: anywhere; }
.bc-row-hint { font-weight: 500; color: var(--bc-faint); font-size: 12px; line-height: 1.35; }
.bc-row-control { flex: 0 0 auto; min-width: 0; display: inline-flex; align-items: center;
  gap: 8px; justify-content: flex-end; max-width: 60%; }
.bc-inline { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.bc-time-wrap { display: inline-flex; align-items: center; gap: 6px; color: var(--bc-muted); }

.bc-hint { color: var(--bc-muted); font-size: 13px; margin: 8px 0 4px; }

/* ---- Controls --------------------------------------------------------- */
.bc-select, .bc-input, .bc-time {
  font: inherit; color: var(--bc-text); background: var(--bc-surface);
  border: 1px solid var(--bc-border-strong); border-radius: 9px; padding: 7px 10px;
  min-width: 0; max-width: 100%; transition: border-color 0.14s, box-shadow 0.14s;
}
.bc-select { width: 158px; max-width: 100%; }
.bc-input { flex: 1 1 auto; width: 100%; }
.bc-time { width: 112px; }
.bc-select:focus, .bc-input:focus, .bc-time:focus, textarea:focus {
  outline: none; border-color: var(--bc-brand); box-shadow: 0 0 0 3px var(--bc-ring); }
.bc-select {
  -webkit-appearance: none; appearance: none; padding-right: 30px; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6b82' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 11px center;
}
.bc-color { width: 42px; height: 32px; padding: 2px; border: 1px solid var(--bc-border-strong);
  border-radius: 9px; background: var(--bc-surface); cursor: pointer; flex: 0 0 auto; }
.bc-color::-webkit-color-swatch-wrapper { padding: 0; }
.bc-color::-webkit-color-swatch { border: none; border-radius: 6px; }

textarea {
  width: 100%; max-width: 100%; padding: 12px; color: var(--bc-text); background: var(--bc-surface);
  border: 1px solid var(--bc-border-strong); border-radius: 11px; resize: vertical;
  font: 13px/1.55 var(--bc-mono);
}

.bc-range { flex: 1 1 auto; min-width: 0; max-width: 200px; height: 6px;
  -webkit-appearance: none; appearance: none;
  background: var(--bc-surface-2); border-radius: 99px; cursor: pointer; }
.bc-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px;
  border-radius: 50%; background: var(--bc-grad); border: 2px solid var(--bc-surface);
  box-shadow: 0 1px 4px var(--bc-ring); cursor: pointer; }
.bc-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%;
  background: var(--bc-brand); border: 2px solid var(--bc-surface); cursor: pointer; }
.bc-range-val { color: var(--bc-brand); font-variant-numeric: tabular-nums; font-weight: 700; }

/* ---- Switch ----------------------------------------------------------- */
.bc-sw { position: relative; display: inline-flex; flex: 0 0 auto; width: 42px; height: 24px;
  cursor: pointer; }
.bc-sw input { position: absolute; opacity: 0; width: 0; height: 0; margin: 0; }
.bc-sw-track { width: 42px; height: 24px; border-radius: 99px; background: var(--bc-border-strong);
  transition: background 0.18s; display: inline-block; }
.bc-sw-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); transition: transform 0.18s; }
.bc-sw input:checked + .bc-sw-track { background: var(--bc-grad); }
.bc-sw input:checked + .bc-sw-track .bc-sw-thumb { transform: translateX(18px); }
.bc-sw input:focus-visible + .bc-sw-track { box-shadow: 0 0 0 3px var(--bc-ring); }

/* ---- Buttons ---------------------------------------------------------- */
.bc-btn {
  font: inherit; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap;
  padding: 7px 13px; border-radius: 9px; border: 1px solid var(--bc-border-strong);
  background: var(--bc-surface); color: var(--bc-text);
  transition: background 0.14s, border-color 0.14s, transform 0.06s; }
.bc-btn:hover { background: var(--bc-surface-2); }
.bc-btn:active { transform: translateY(1px); }
.bc-btn--sm { padding: 5px 10px; font-size: 12px; }
.bc-btn--primary { background: var(--bc-grad); color: #fff; border-color: transparent;
  box-shadow: 0 4px 12px -3px var(--bc-ring); }
.bc-btn--primary:hover { background: var(--bc-grad); filter: brightness(1.06); }
.bc-btn--ghost-danger { color: var(--bc-danger);
  border-color: color-mix(in srgb, var(--bc-danger) 40%, var(--bc-border-strong)); }
.bc-btn--ghost-danger:hover { background: color-mix(in srgb, var(--bc-danger) 12%, transparent); }

/* ---- Sortable lists --------------------------------------------------- */
.bc-sortable { display: flex; flex-direction: column; gap: 7px; margin: 10px 0 4px; min-width: 0; }
.bc-item { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 8px 10px;
  background: var(--bc-surface-2); border: 1px solid var(--bc-border); border-radius: 10px; }
.bc-item.bc-dragging { opacity: 0.5; }
.bc-grip { flex: 0 0 auto; color: var(--bc-faint); cursor: grab; user-select: none;
  letter-spacing: -2px; font-size: 16px; }
.bc-swatch { width: 16px; height: 16px; border-radius: 5px; border: 1px solid var(--bc-border-strong);
  flex: 0 0 auto; }
.bc-item-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; font-weight: 600; }
.bc-item input[type="text"] { flex: 0 1 116px; min-width: 60px; padding: 5px 8px; font: inherit;
  color: var(--bc-text); background: var(--bc-surface); border: 1px solid var(--bc-border-strong);
  border-radius: 7px; }
.bc-item input[type="color"] { width: 30px; height: 28px; padding: 1px; border-radius: 7px;
  border: 1px solid var(--bc-border-strong); background: var(--bc-surface); flex: 0 0 auto; }
.bc-item input[type="checkbox"] { width: 17px; height: 17px; accent-color: var(--bc-brand);
  flex: 0 0 auto; cursor: pointer; }

/* ---- Custom links ----------------------------------------------------- */
.bc-links { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; min-width: 0; }
.bc-linkrow { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bc-linkrm { flex: 0 0 auto; border: none; background: none; cursor: pointer; color: var(--bc-danger);
  font-size: 20px; line-height: 1; padding: 0 4px; }

/* ---- GPA -------------------------------------------------------------- */
.bc-gpa-row { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 9px 0;
  border-bottom: 1px solid var(--bc-border); }
.bc-gpa-row:last-child { border-bottom: none; }
.bc-gpa-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; font-weight: 600; }
.bc-gpa-score { flex: 0 0 auto; color: var(--bc-muted); font-variant-numeric: tabular-nums; font-size: 13px; }
.bc-gpa-row input { flex: 0 0 auto; width: 64px; padding: 5px 8px; font: inherit; color: var(--bc-text);
  background: var(--bc-surface); border: 1px solid var(--bc-border-strong); border-radius: 7px; }
.bc-gpa-result { font-size: 24px; font-weight: 800; margin-top: 14px; letter-spacing: -0.02em;
  background: var(--bc-grad); -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; min-height: 28px; }

/* ---- About ------------------------------------------------------------ */
.bc-about p { margin: 6px 0; }
.bc-about ul { margin: 8px 0; padding-left: 18px; color: var(--bc-muted); }
.bc-about li { margin: 4px 0; }
.bc-about code { font-family: var(--bc-mono); font-size: 12px; background: var(--bc-surface-2);
  padding: 1px 5px; border-radius: 5px; }
`;

  BC.SettingsUI = {
    render(rootEl, adapter) {
      // ---- working state -------------------------------------------------
      let state = BC.mergeDefaults(adapter.getState());
      let courses = []; // [{id,name,code,color}]
      let gpaCourses = []; // [{id,name,score}]
      let lastSavedJson = JSON.stringify(state);
      let saveTimer = null;
      const syncers = [];

      const clone = (o) => JSON.parse(JSON.stringify(o));

      // ---- references filled during build --------------------------------
      let wrapper, statusEl, scheduleRow, logoUrlRow, todoCustomRows;
      let courseListEl, courseHintEl;
      let globalNavEl, globalLinksEl, courseLinksEl;
      let gpaListEl, gpaResultEl, gpaHintEl;

      // ---- theme + conditional rows --------------------------------------
      function timeInWindow(now, start, end) {
        const toMin = (s) => {
          const [h, m] = String(s).split(":").map(Number);
          return (h || 0) * 60 + (m || 0);
        };
        const cur = now.getHours() * 60 + now.getMinutes();
        const s = toMin(start), e = toMin(end);
        return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
      }
      function isDark(t) {
        switch (t.darkMode) {
          case "on": return true;
          case "off": return false;
          case "auto": return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
          case "scheduled": return timeInWindow(new Date(), t.darkSchedule.start, t.darkSchedule.end);
          default: return false;
        }
      }
      function applyPanelTheme() { wrapper.classList.toggle("bc-dark", isDark(state.theming)); }
      function updateConditionals() {
        scheduleRow.classList.toggle("bc-hidden", state.theming.darkMode !== "scheduled");
        logoUrlRow.classList.toggle("bc-hidden", state.theming.logo.mode !== "replace");
        if (todoCustomRows) todoCustomRows.classList.toggle("bc-hidden", state.todo.mode !== "custom");
      }

      // ---- persistence ---------------------------------------------------
      function status(text, kind) {
        statusEl.textContent = text || "";
        statusEl.className = "bc-status" + (kind ? " bc-status--" + kind : "");
      }
      function scheduleSave() {
        status("Saving…", "saving");
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          const snap = clone(state);
          lastSavedJson = JSON.stringify(snap);
          Promise.resolve(adapter.save(snap)).then(() => {
            status("Saved", "ok");
            setTimeout(() => { if (statusEl.textContent === "Saved") status(""); }, 1200);
          });
        }, 250);
      }
      // Run after every change: keep panel theme + conditional rows in sync, persist.
      function commit() { applyPanelTheme(); updateConditionals(); scheduleSave(); }
      function runSyncers() { for (const s of syncers) BC.util.guard(s, "settings sync"); }

      // ---- control builders ---------------------------------------------
      function switchFor(get, set) {
        const input = el("input", { type: "checkbox" });
        input.addEventListener("change", () => { set(input.checked); commit(); });
        syncers.push(() => { input.checked = !!get(); });
        return el("label", { class: "bc-sw" }, [
          input,
          el("span", { class: "bc-sw-track" }, el("span", { class: "bc-sw-thumb" })),
        ]);
      }
      function selectFor(opts, get, set) {
        const sel = el("select", { class: "bc-select" });
        for (const o of opts) sel.appendChild(el("option", { value: o.value, text: o.label }));
        sel.addEventListener("change", () => { set(sel.value); commit(); });
        syncers.push(() => { sel.value = get(); });
        return sel;
      }
      function textFor(get, set, ph) {
        const inp = el("input", { type: "text", class: "bc-input", placeholder: ph || "" });
        inp.addEventListener("change", () => { set(inp.value); commit(); });
        syncers.push(() => { inp.value = get() || ""; });
        return inp;
      }
      function colorFor(get, set, fallback) {
        const inp = el("input", { type: "color", class: "bc-color" });
        inp.addEventListener("input", () => { set(inp.value); commit(); });
        syncers.push(() => { const v = get(); inp.value = /^#[0-9a-f]{6}$/i.test(v || "") ? v : fallback; });
        return inp;
      }
      // A div (not a <label>): controls here include switches that are already
      // wrapped in their own <label>, and nested labels double-fire the toggle.
      function row(label, control, opts) {
        const labelNode = typeof label === "string" ? document.createTextNode(label) : label;
        const lab = el("span", { class: "bc-row-label" }, [
          labelNode,
          opts && opts.hint ? el("small", { class: "bc-row-hint", text: opts.hint }) : null,
        ]);
        const ctrl = el("span", { class: "bc-row-control" }, [control]);
        return el("div", { class: "bc-row" }, [lab, ctrl]);
      }
      function rangeRow(label, get, set, min, max, unit) {
        const valEl = el("b", { class: "bc-range-val" });
        const input = el("input", { type: "range", class: "bc-range", min: String(min), max: String(max) });
        input.addEventListener("input", () => {
          set(Number(input.value)); valEl.textContent = input.value + unit; commit();
        });
        syncers.push(() => { input.value = get(); valEl.textContent = get() + unit; });
        const lab = el("span", { class: "bc-row-label" }, [label + ": ", valEl]);
        return el("div", { class: "bc-row" }, [lab, input]);
      }
      function card(children, opts) {
        const head = opts && (opts.title || opts.action)
          ? el("div", { class: "bc-card-head" }, [
              opts.title ? el("h3", { class: "bc-card-title", text: opts.title }) : null,
              opts.action || null,
            ])
          : null;
        return el("div", { class: "bc-card" }, [head].concat(children));
      }

      function makeSortable(container, onReorder) {
        let dragEl = null;
        container.addEventListener("dragstart", (e) => {
          dragEl = e.target.closest(".bc-item");
          if (dragEl) dragEl.classList.add("bc-dragging");
        });
        container.addEventListener("dragend", () => {
          if (dragEl) dragEl.classList.remove("bc-dragging");
          dragEl = null;
          onReorder([...container.querySelectorAll(".bc-item")].map((i) => i.dataset.id));
        });
        container.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (!dragEl) return;
          const after = [...container.querySelectorAll(".bc-item:not(.bc-dragging)")].find((it) => {
            const r = it.getBoundingClientRect();
            return e.clientY < r.top + r.height / 2;
          });
          if (after) container.insertBefore(dragEl, after);
          else container.appendChild(dragEl);
        });
      }

      // ====================================================================
      // TOP BAR
      // ====================================================================
      const brandMark = el("span", { class: "bc-brandmark" });
      brandMark.innerHTML = BRAND_SVG;
      const enabledSwitch = switchFor(() => state.enabled, (v) => (state.enabled = v));
      statusEl = el("span", { class: "bc-status" });

      const exportBtn = el("button", { class: "bc-btn bc-btn--sm", type: "button", text: "Export" });
      const importBtn = el("button", { class: "bc-btn bc-btn--sm", type: "button", text: "Import" });
      const resetBtn = el("button", { class: "bc-btn bc-btn--sm bc-btn--ghost-danger", type: "button", text: "Reset" });
      const importFile = el("input", { type: "file", accept: "application/json", style: { display: "none" } });

      exportBtn.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "better-canvas-settings.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      });
      importBtn.addEventListener("click", () => importFile.click());
      importFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            state = BC.mergeDefaults(JSON.parse(reader.result));
            refreshAll();
            scheduleSave();
          } catch (_) {
            window.alert("Import failed: invalid settings file.");
          }
        };
        reader.readAsText(file);
        e.target.value = "";
      });
      resetBtn.addEventListener("click", () => {
        if (!window.confirm("Reset all Better Canvas settings to defaults?")) return;
        state = BC.cloneDefaults();
        refreshAll();
        scheduleSave();
      });

      const topbar = el("header", { class: "bc-topbar" }, [
        el("div", { class: "bc-topbar-main" }, [
          el("div", { class: "bc-brand" }, [
            brandMark,
            el("div", { class: "bc-brand-tt" }, [
              el("strong", { text: "Better Canvas" }),
              el("small", { text: "Settings" }),
            ]),
          ]),
          el("span", { class: "bc-enabled" }, [enabledSwitch, el("span", { text: "Enabled" })]),
        ]),
        el("div", { class: "bc-topbar-actions" }, [exportBtn, importBtn, resetBtn, statusEl, importFile]),
      ]);

      // ====================================================================
      // TABS
      // ====================================================================
      const TAB_DEFS = [
        ["dashboard", "Dashboard"],
        ["theming", "Theming"],
        ["navigation", "Navigation"],
        ["cosmetics", "Cosmetics"],
        ["grades", "Grades"],
        ["about", "About"],
      ];
      const tabButtons = {};
      const panels = {};
      const tabsNav = el("nav", { class: "bc-tabs" });
      for (const [key, label] of TAB_DEFS) {
        const b = el("button", { class: "bc-tab", type: "button", text: label });
        b.addEventListener("click", () => selectTab(key));
        tabButtons[key] = b;
        tabsNav.appendChild(b);
      }
      function selectTab(name) {
        for (const k in tabButtons) tabButtons[k].classList.toggle("bc-active", k === name);
        for (const k in panels) panels[k].classList.toggle("bc-active", k === name);
      }

      const body = el("div", { class: "bc-body" });

      // ====================================================================
      // DASHBOARD PANEL
      // ====================================================================
      courseListEl = el("div", { class: "bc-sortable" });
      courseHintEl = el("p", { class: "bc-hint" });
      makeSortable(courseListEl, (ids) => { state.dashboard.courseOrder = ids; commit(); });
      const reloadCoursesBtn = el("button", { class: "bc-btn bc-btn--sm", type: "button", text: "Reload courses" });
      reloadCoursesBtn.addEventListener("click", loadCourses);

      // To Do list — its own section. "Planner widget" replaces Canvas's native
      // list with a completion ring, week nav, course filter, and a New Task button.
      const todoAccentInput = colorFor(() => state.todo.accent, (v) => (state.todo.accent = v), "#5b4ee6");
      const todoAccentClear = el("button", { class: "bc-btn bc-btn--sm", type: "button", text: "Default" });
      todoAccentClear.addEventListener("click", () => { state.todo.accent = ""; runSyncers(); commit(); });
      todoCustomRows = el("div", {}, [
        row("Show ahead", selectFor(
          [{ value: "7", label: "1 week" }, { value: "14", label: "2 weeks" }, { value: "30", label: "1 month" }],
          () => String(state.todo.rangeDays), (v) => (state.todo.rangeDays = Number(v))),
          { hint: "How far ahead the planner looks" }),
        row("Show completed tasks", switchFor(() => state.todo.showCompleted, (v) => (state.todo.showCompleted = v))),
        row("Widget accent", el("span", { class: "bc-inline" }, [todoAccentInput, todoAccentClear]),
          { hint: "Color of the ring and checkmarks" }),
        row("Allow adding tasks", switchFor(() => state.todo.allowNewTask, (v) => (state.todo.allowNewTask = v)),
          { hint: "Show the New Task composer" }),
      ]);
      const todoCard = card([
        row("Style", selectFor(
          [{ value: "default", label: "Canvas default" }, { value: "clean", label: "Clean circles" }, { value: "custom", label: "Planner widget" }],
          () => state.todo.mode, (v) => (state.todo.mode = v)),
          { hint: "Planner widget adds a ring, week navigation, and New Task" }),
        todoCustomRows,
      ], { title: "To Do list" });

      panels.dashboard = el("section", { class: "bc-panel bc-active" }, [
        card([
          row("Customize dashboard", switchFor(() => state.dashboard.enabled, (v) => (state.dashboard.enabled = v))),
          row("Auto-hide concluded courses", switchFor(() => state.dashboard.autoHideConcluded, (v) => (state.dashboard.autoHideConcluded = v))),
          el("div", { class: "bc-subhead", text: "Sidebar widgets" }),
          row("Hide entire sidebar", switchFor(() => state.dashboard.hideSidebar, (v) => (state.dashboard.hideSidebar = v)),
            { hint: "Removes the whole right column at once" }),
          row("To Do", switchFor(() => state.dashboard.widgets.todo, (v) => (state.dashboard.widgets.todo = v))),
          row("Coming Up", switchFor(() => state.dashboard.widgets.comingUp, (v) => (state.dashboard.widgets.comingUp = v))),
          row("Recent Feedback", switchFor(() => state.dashboard.widgets.recentFeedback, (v) => (state.dashboard.widgets.recentFeedback = v))),
        ]),
        todoCard,
        card([
          el("p", { class: "bc-hint", text: "Drag to reorder. Toggle visibility, set a nickname, and pick a color. You can also use the Edit pill on each card on your dashboard." }),
          courseListEl,
          courseHintEl,
        ], { title: "Course cards", action: reloadCoursesBtn }),
      ]);

      // ====================================================================
      // THEMING PANEL
      // ====================================================================
      const darkStart = el("input", { type: "time", class: "bc-time" });
      const darkEnd = el("input", { type: "time", class: "bc-time" });
      darkStart.addEventListener("change", () => { state.theming.darkSchedule.start = darkStart.value; commit(); });
      darkEnd.addEventListener("change", () => { state.theming.darkSchedule.end = darkEnd.value; commit(); });
      syncers.push(() => { darkStart.value = state.theming.darkSchedule.start; darkEnd.value = state.theming.darkSchedule.end; });
      scheduleRow = el("div", { class: "bc-row" }, [
        el("span", { class: "bc-row-label", text: "Schedule (dark from → until)" }),
        el("span", { class: "bc-time-wrap" }, [darkStart, document.createTextNode("→"), darkEnd]),
      ]);

      const accentInput = colorFor(() => state.theming.accentColor, (v) => (state.theming.accentColor = v), "#0374b5");
      const accentClear = el("button", { class: "bc-btn bc-btn--sm", type: "button", text: "Default" });
      accentClear.addEventListener("click", () => { state.theming.accentColor = ""; runSyncers(); commit(); });

      const darkBgInput = colorFor(() => state.theming.darkBg, (v) => (state.theming.darkBg = v), "#1a1a1d");
      const darkBgClear = el("button", { class: "bc-btn bc-btn--sm", type: "button", text: "Default" });
      darkBgClear.addEventListener("click", () => { state.theming.darkBg = ""; runSyncers(); commit(); });

      const fontOpts = [
        { value: "", label: "Canvas default" },
        { value: "system-ui, sans-serif", label: "System" },
        { value: "Georgia, serif", label: "Georgia (serif)" },
        { value: "'Times New Roman', serif", label: "Times" },
        { value: "'Courier New', monospace", label: "Monospace" },
        { value: "'Comic Sans MS', cursive", label: "Comic Sans" },
      ];
      const fontSel = el("select", { class: "bc-select" });
      for (const o of fontOpts) fontSel.appendChild(el("option", { value: o.value, text: o.label }));
      const fontCustom = el("input", { type: "text", class: "bc-input", placeholder: "e.g. 'Inter', sans-serif" });
      fontSel.addEventListener("change", () => { if (!fontCustom.value.trim()) { state.theming.font = fontSel.value; commit(); } });
      fontCustom.addEventListener("change", () => { state.theming.font = fontCustom.value.trim() || fontSel.value; commit(); });
      syncers.push(() => {
        const presetVals = fontOpts.map((o) => o.value);
        if (presetVals.includes(state.theming.font)) { fontSel.value = state.theming.font; fontCustom.value = ""; }
        else { fontCustom.value = state.theming.font; }
      });

      const logoUrlInput = textFor(() => state.theming.logo.url, (v) => (state.theming.logo.url = v.trim()), "https://…");
      logoUrlRow = row("Logo image URL", logoUrlInput);

      panels.theming = el("section", { class: "bc-panel" }, [
        card([
          row("Dark mode", selectFor(
            [{ value: "off", label: "Off" }, { value: "on", label: "On" }, { value: "auto", label: "Auto (follow system)" }, { value: "scheduled", label: "Scheduled" }],
            () => state.theming.darkMode, (v) => (state.theming.darkMode = v))),
          scheduleRow,
          row("Dark theme tone", selectFor(
            [{ value: "neutral", label: "Neutral gray" }, { value: "slate", label: "Slate (cool)" }, { value: "black", label: "Midnight black" }],
            () => state.theming.darkTone, (v) => (state.theming.darkTone = v)),
            { hint: "Base palette used when dark mode is on" }),
          row("Custom dark background", el("span", { class: "bc-inline" }, [darkBgInput, darkBgClear]),
            { hint: "Overrides the tone with your own color" }),
          row("Accent color", el("span", { class: "bc-inline" }, [accentInput, accentClear])),
          row("Font", fontSel),
          row("Custom font family", fontCustom, { hint: "Overrides the preset above" }),
          row("Density", selectFor(
            [{ value: "compact", label: "Compact" }, { value: "default", label: "Default" }, { value: "spacious", label: "Spacious" }],
            () => state.theming.density, (v) => (state.theming.density = v))),
          row("Institution logo", selectFor(
            [{ value: "default", label: "Show (default)" }, { value: "hide", label: "Hide" }, { value: "replace", label: "Replace with image" }],
            () => state.theming.logo.mode, (v) => (state.theming.logo.mode = v))),
          logoUrlRow,
        ]),
      ]);

      // ====================================================================
      // NAVIGATION PANEL
      // ====================================================================
      globalNavEl = el("div", { class: "bc-sortable" });
      makeSortable(globalNavEl, (ids) => { state.navigation.global.order = ids; commit(); });
      globalLinksEl = el("div", { class: "bc-links" });
      courseLinksEl = el("div", { class: "bc-links" });
      const addGlobalLink = el("button", { class: "bc-btn bc-btn--sm", type: "button", text: "+ Add link" });
      const addCourseLink = el("button", { class: "bc-btn bc-btn--sm", type: "button", text: "+ Add link" });
      addGlobalLink.addEventListener("click", () => { state.navigation.global.customLinks.push({ label: "", url: "", newTab: true }); commit(); renderLinks("global"); });
      addCourseLink.addEventListener("click", () => { state.navigation.course.customLinks.push({ label: "", url: "", newTab: true }); commit(); renderLinks("course"); });

      const courseHideInput = el("input", { type: "text", class: "bc-input", placeholder: "Files, Quizzes" });
      courseHideInput.addEventListener("change", () => {
        state.navigation.course.hidden = courseHideInput.value.split(",").map((s) => s.trim()).filter(Boolean); commit();
      });
      syncers.push(() => { courseHideInput.value = (state.navigation.course.hidden || []).join(", "); });
      const courseOrderInput = el("input", { type: "text", class: "bc-input", placeholder: "Home, Grades, Modules" });
      courseOrderInput.addEventListener("change", () => {
        state.navigation.course.order = courseOrderInput.value.split(",").map((s) => s.trim()).filter(Boolean); commit();
      });
      syncers.push(() => { courseOrderInput.value = (state.navigation.course.order || []).join(", "); });

      panels.navigation = el("section", { class: "bc-panel" }, [
        card([
          el("p", { class: "bc-hint", text: "Drag to reorder, uncheck to hide." }),
          globalNavEl,
        ], { title: "Global navigation" }),
        card([globalLinksEl, addGlobalLink], { title: "Global custom links" }),
        card([
          row("Hide tabs (comma-separated labels)", courseHideInput),
          row("Order (comma-separated labels)", courseOrderInput),
          el("div", { class: "bc-subhead", text: "Course custom links" }),
          courseLinksEl,
          addCourseLink,
        ], { title: "Course navigation" }),
      ]);

      // ====================================================================
      // COSMETICS PANEL
      // ====================================================================
      const customCss = el("textarea", { rows: "12", spellcheck: "false", placeholder: "/* your CSS */" });
      customCss.addEventListener("change", () => { state.cosmetics.customCss = customCss.value; commit(); });
      syncers.push(() => { customCss.value = state.cosmetics.customCss || ""; });

      panels.cosmetics = el("section", { class: "bc-panel" }, [
        card([
          row("Mode", selectFor(
            [{ value: "none", label: "None" }, { value: "color", label: "Solid color" }, { value: "image", label: "Image" }],
            () => state.cosmetics.background.mode, (v) => (state.cosmetics.background.mode = v))),
          row("Color", colorFor(() => state.cosmetics.background.color, (v) => (state.cosmetics.background.color = v), "#0b1220")),
          row("Image URL", textFor(() => state.cosmetics.background.image, (v) => (state.cosmetics.background.image = v.trim()), "https://…")),
          rangeRow("Blur", () => state.cosmetics.background.blur, (v) => (state.cosmetics.background.blur = v), 0, 40, "px"),
          rangeRow("Opacity", () => state.cosmetics.background.opacity, (v) => (state.cosmetics.background.opacity = v), 0, 100, "%"),
        ], { title: "Full-page background" }),
        card([
          el("p", { class: "bc-hint", text: "The ultimate escape hatch — your CSS is injected on every Canvas page." }),
          customCss,
        ], { title: "Custom CSS" }),
      ]);

      // ====================================================================
      // GRADES PANEL
      // ====================================================================
      gpaListEl = el("div");
      gpaResultEl = el("div", { class: "bc-gpa-result" });
      gpaHintEl = el("p", { class: "bc-hint" });
      const loadGpaBtn = el("button", { class: "bc-btn bc-btn--sm", type: "button", text: "Load my courses" });
      loadGpaBtn.addEventListener("click", loadGpa);

      panels.grades = el("section", { class: "bc-panel" }, [
        card([
          row("What-if grades on the grades page", switchFor(() => state.grades.whatIfEnabled, (v) => (state.grades.whatIfEnabled = v))),
          row("GPA scale", selectFor([{ value: "standard-4", label: "Standard 4.0" }], () => state.grades.gpaScale, (v) => (state.grades.gpaScale = v))),
        ]),
        card([
          el("p", { class: "bc-hint", text: "Pulled from your Canvas session. Enter credit hours per course; set 0 to exclude." }),
          gpaListEl,
          gpaResultEl,
          gpaHintEl,
        ], { title: "GPA calculator", action: loadGpaBtn }),
      ]);

      // ====================================================================
      // ABOUT PANEL
      // ====================================================================
      const aboutCard = el("div", { class: "bc-card bc-about" });
      aboutCard.innerHTML =
        "<p><b>Better Canvas</b> customizes Instructure Canvas entirely in your browser.</p>" +
        "<ul><li>No telemetry, no analytics, no external servers.</li>" +
        "<li>All settings are stored locally via the browser's extension storage.</li>" +
        "<li>Grade tools use your own Canvas session (same-origin, read-only).</li>" +
        "<li>Works on <code>*.instructure.com</code> and custom school domains you enable from the popup.</li></ul>" +
        "<p class=\"bc-hint\">Use Export to back up your settings and Import to restore them.</p>";
      panels.about = el("section", { class: "bc-panel" }, [aboutCard]);

      // ---- dynamic list renderers ----------------------------------------
      function ensureCfg(id) {
        return (state.dashboard.courses[id] = state.dashboard.courses[id] || {});
      }
      function orderedCourseIds() {
        const present = new Set(courses.map((c) => c.id));
        const ordered = (state.dashboard.courseOrder || []).filter((id) => present.has(id));
        for (const c of courses) if (!ordered.includes(c.id)) ordered.push(c.id);
        return ordered;
      }
      function renderCourseList() {
        courseListEl.replaceChildren();
        if (!courses.length) {
          if (!courseHintEl.textContent) courseHintEl.textContent = 'Click "Reload courses" to load your courses.';
          return;
        }
        const byId = new Map(courses.map((c) => [c.id, c]));
        for (const id of orderedCourseIds()) {
          const c = byId.get(id);
          if (!c) continue;
          const cfg = state.dashboard.courses[id] || {};
          const color = /^#[0-9a-f]{6}$/i.test(cfg.color || "") ? cfg.color
            : /^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : "#394b58";

          const swatch = el("span", { class: "bc-swatch" });
          swatch.style.background = color;
          const hide = el("input", { type: "checkbox", title: "Visible" });
          hide.checked = !cfg.hidden;
          hide.addEventListener("change", () => { ensureCfg(id).hidden = !hide.checked; commit(); });
          const nick = el("input", { type: "text", placeholder: c.name });
          nick.value = cfg.nickname || "";
          nick.addEventListener("change", () => { ensureCfg(id).nickname = nick.value.trim(); commit(); });
          const colorIn = el("input", { type: "color" });
          colorIn.value = color;
          colorIn.addEventListener("input", () => { ensureCfg(id).color = colorIn.value; swatch.style.background = colorIn.value; commit(); });

          courseListEl.appendChild(el("div", { class: "bc-item", draggable: "true", dataset: { id } }, [
            el("span", { class: "bc-grip", text: "⋮⋮" }),
            hide, swatch,
            el("span", { class: "bc-item-name", text: c.name + (c.code ? "  ·  " + c.code : "") }),
            nick, colorIn,
          ]));
        }
      }
      function renderGlobalNav() {
        const items = BC.GLOBAL_NAV_ITEMS;
        const byKey = new Map(items.map((i) => [i.key, i]));
        const ordered = (state.navigation.global.order || []).filter((k) => byKey.has(k));
        for (const i of items) if (!ordered.includes(i.key)) ordered.push(i.key);
        const hidden = new Set(state.navigation.global.hidden);
        globalNavEl.replaceChildren();
        for (const key of ordered) {
          const info = byKey.get(key);
          const cb = el("input", { type: "checkbox" });
          cb.checked = !hidden.has(key);
          cb.addEventListener("change", () => {
            const set = new Set(state.navigation.global.hidden);
            if (cb.checked) set.delete(key); else set.add(key);
            state.navigation.global.hidden = [...set]; commit();
          });
          globalNavEl.appendChild(el("div", { class: "bc-item", draggable: "true", dataset: { id: key } }, [
            el("span", { class: "bc-grip", text: "⋮⋮" }), cb, el("span", { class: "bc-item-name", text: info.label }),
          ]));
        }
      }
      function renderLinks(scope) {
        const wrap = scope === "global" ? globalLinksEl : courseLinksEl;
        const links = state.navigation[scope].customLinks;
        wrap.replaceChildren();
        links.forEach((link, idx) => {
          const label = el("input", { type: "text", class: "bc-input", placeholder: "Label" });
          label.value = link.label || "";
          label.addEventListener("change", () => { link.label = label.value; commit(); });
          const url = el("input", { type: "text", class: "bc-input", placeholder: "https://…" });
          url.value = link.url || "";
          url.addEventListener("change", () => { link.url = url.value.trim(); commit(); });
          const rm = el("button", { class: "bc-linkrm", type: "button", title: "Remove", text: "×" });
          rm.addEventListener("click", () => { links.splice(idx, 1); commit(); renderLinks(scope); });
          wrap.appendChild(el("div", { class: "bc-linkrow" }, [label, url, rm]));
        });
      }
      function gradePoints(pct) {
        const scale = BC.GPA_SCALES[state.grades.gpaScale] || BC.GPA_SCALES["standard-4"];
        for (const r of scale) if (pct >= r.min) return r;
        return scale[scale.length - 1];
      }
      function renderGpaList() {
        gpaListEl.replaceChildren();
        for (const c of gpaCourses) {
          const credIn = el("input", { type: "number", min: "0", step: "0.5" });
          credIn.value = state.grades.creditsByCourse[c.id] != null ? state.grades.creditsByCourse[c.id] : 3;
          credIn.addEventListener("input", () => { state.grades.creditsByCourse[c.id] = Number(credIn.value); commit(); computeGpa(); });
          const gp = gradePoints(c.score);
          gpaListEl.appendChild(el("div", { class: "bc-gpa-row" }, [
            el("span", { class: "bc-gpa-name", text: c.name }),
            el("span", { class: "bc-gpa-score", text: c.score.toFixed(1) + "% (" + gp.letter + ")" }),
            credIn,
          ]));
        }
        computeGpa();
      }
      function computeGpa() {
        let pts = 0, cr = 0;
        for (const c of gpaCourses) {
          const credit = state.grades.creditsByCourse[c.id] != null ? Number(state.grades.creditsByCourse[c.id]) : 3;
          if (!credit) continue;
          pts += gradePoints(c.score).points * credit;
          cr += credit;
        }
        gpaResultEl.textContent = cr > 0 ? (pts / cr).toFixed(3) + " GPA" : "";
      }

      // ---- data loaders --------------------------------------------------
      async function loadCourses() {
        courseHintEl.textContent = "Loading courses…";
        try {
          const list = await adapter.getCourses();
          courses = list || [];
          courseHintEl.textContent = courses.length ? "" : "No courses found.";
        } catch (_) {
          courseHintEl.textContent = "Open your Canvas dashboard and sign in, then Reload courses.";
        }
        renderCourseList();
      }
      async function loadGpa() {
        gpaHintEl.textContent = "Loading grades…";
        try {
          const list = await adapter.getGpaData();
          gpaCourses = (list || []).filter((c) => c.score != null);
          gpaHintEl.textContent = gpaCourses.length ? "" : "No graded courses found.";
        } catch (_) {
          gpaHintEl.textContent = "Open Canvas and sign in, then try again.";
        }
        renderGpaList();
      }

      // ---- refresh / external sync --------------------------------------
      function refreshAll() {
        runSyncers();
        renderCourseList();
        renderGlobalNav();
        renderLinks("global");
        renderLinks("course");
        renderGpaList();
        applyPanelTheme();
        updateConditionals();
      }

      if (adapter.subscribe) {
        adapter.subscribe((incoming) => {
          if (!incoming) return;
          const json = JSON.stringify(BC.mergeDefaults(incoming));
          if (json === lastSavedJson) return; // echo of our own save
          lastSavedJson = json;
          state = JSON.parse(json);
          refreshAll();
        });
      }

      // ---- assemble ------------------------------------------------------
      for (const [key] of TAB_DEFS) body.appendChild(panels[key]);
      const style = el("style");
      style.textContent = STYLE;
      wrapper = el("div", { class: "bc-ui" }, [topbar, tabsNav, body]);

      rootEl.replaceChildren(style, wrapper);
      selectTab("dashboard");
      refreshAll();
      loadCourses(); // best-effort auto-load

      return { refresh: refreshAll };
    },
  };
})();
