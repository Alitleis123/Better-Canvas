/*
 * Better Canvas — reusable settings UI components.
 * Every control follows the same contract: it's constructed with (opts) that
 * include get()/set() bound to the state store, so no ad-hoc plumbing.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const el = (t, a, c) => BC.util.el(t, a, c);
  const h = (s, a, c) => BC.util.h(s, a, c);

  const C = (BC.SettingsComponents = {});

  // Section wrapper with title + optional description.
  C.section = function ({ title, description, children }) {
    const body = h("div.bc-section-body", null, children);
    return h("section.bc-section", null, [
      title ? h("h3.bc-section-title", null, title) : null,
      description ? h("p.bc-section-desc", null, description) : null,
      body,
    ]);
  };

  // Row: label + control.
  C.row = function ({ label, hint, control, warn }) {
    return h("div.bc-row", null, [
      h("div.bc-row-label", null, [
        h("div.bc-row-title", null, label),
        hint ? h("div.bc-row-hint", null, hint) : null,
        warn ? h("div.bc-row-warn", null, warn) : null,
      ]),
      h("div.bc-row-control", null, control),
    ]);
  };

  // On/off switch.
  C.switch = function ({ get, set, ariaLabel }) {
    const input = el("input", { type: "checkbox", checked: !!get(), "aria-label": ariaLabel || "toggle" });
    input.addEventListener("change", () => set(input.checked));
    const track = h("span.bc-switch", null, [input, h("span.bc-switch-thumb", null)]);
    return track;
  };

  C.select = function ({ get, set, options, ariaLabel }) {
    const sel = el("select", { class: "bc-select", "aria-label": ariaLabel || "" });
    for (const o of options) {
      const opt = el("option", { value: o.value }, o.label);
      if (o.value === get()) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => set(sel.value));
    return sel;
  };

  C.text = function ({ get, set, placeholder, ariaLabel, validate }) {
    const wrap = h("div.bc-text-wrap", null);
    const inp = el("input", { type: "text", class: "bc-text", placeholder: placeholder || "", value: get() || "", "aria-label": ariaLabel || "" });
    const warn = h("div.bc-text-warn", null);
    inp.addEventListener("input", () => {
      const v = inp.value;
      if (validate) {
        const r = validate(v);
        if (r === true || r == null || r === "") { warn.textContent = ""; wrap.classList.remove("bc-invalid"); set(v); }
        else { warn.textContent = String(r); wrap.classList.add("bc-invalid"); }
      } else { set(v); }
    });
    wrap.appendChild(inp); wrap.appendChild(warn);
    return wrap;
  };

  C.textarea = function ({ get, set, placeholder, rows }) {
    const ta = el("textarea", { class: "bc-textarea", placeholder: placeholder || "", rows: rows || 4 });
    ta.value = get() || "";
    ta.addEventListener("input", () => set(ta.value));
    return ta;
  };

  C.number = function ({ get, set, min, max, step }) {
    const inp = el("input", { type: "number", class: "bc-number", value: (get() ?? "") });
    if (min != null) inp.min = min;
    if (max != null) inp.max = max;
    if (step != null) inp.step = step;
    inp.addEventListener("input", () => {
      const v = parseFloat(inp.value);
      if (!isFinite(v)) return;
      set(v);
    });
    return inp;
  };

  C.slider = function ({ get, set, min, max, step, format }) {
    const wrap = h("div.bc-slider", null);
    const rng = el("input", { type: "range", min: min ?? 0, max: max ?? 100, step: step ?? 1, value: get() ?? 0 });
    const val = h("span.bc-slider-val", null, format ? format(get()) : String(get()));
    rng.addEventListener("input", () => { const v = parseFloat(rng.value); val.textContent = format ? format(v) : String(v); set(v); });
    wrap.appendChild(rng); wrap.appendChild(val);
    return wrap;
  };

  C.color = function ({ get, set, allowEmpty }) {
    const wrap = h("div.bc-color", null);
    const cur = get() || "";
    const picker = el("input", { type: "color", value: cur || "#000000" });
    const text   = el("input", { type: "text", class: "bc-color-text", value: cur, placeholder: "#rrggbb" });
    picker.addEventListener("input", () => { text.value = picker.value; set(picker.value); });
    text.addEventListener("input", () => {
      const v = text.value.trim();
      if (v === "" && allowEmpty) { set(""); return; }
      if (BC.color.isHex(v)) { picker.value = v; set(v); wrap.classList.remove("bc-invalid"); }
      else wrap.classList.add("bc-invalid");
    });
    if (allowEmpty) {
      const clr = el("button", { class: "bc-btn bc-btn-ghost", type: "button" }, "Clear");
      clr.addEventListener("click", () => { text.value = ""; set(""); });
      wrap.appendChild(picker); wrap.appendChild(text); wrap.appendChild(clr);
    } else {
      wrap.appendChild(picker); wrap.appendChild(text);
    }
    return wrap;
  };

  C.button = function ({ label, onClick, variant, icon }) {
    const b = el("button", { class: "bc-btn " + (variant ? "bc-btn-" + variant : ""), type: "button" });
    if (icon) b.appendChild(h("span.bc-btn-ic", null, icon));
    b.appendChild(document.createTextNode(label));
    b.addEventListener("click", onClick);
    return b;
  };

  // Drag-sortable list. items: [{id, label, ...}]. onChange(orderedIds).
  C.sortable = function ({ items, render, onChange, itemClass }) {
    const list = h("ul.bc-sortable", null);
    items.forEach((it) => {
      const li = el("li", { class: "bc-sortable-item " + (itemClass || ""), draggable: "true", "data-id": String(it.id) });
      li.appendChild(h("span.bc-drag", null, "⋮⋮"));
      li.appendChild(render(it));
      list.appendChild(li);
    });
    let dragEl = null;
    list.addEventListener("dragstart", (e) => {
      const li = e.target.closest(".bc-sortable-item");
      if (!li) return;
      dragEl = li; li.classList.add("bc-dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    list.addEventListener("dragend", () => { if (dragEl) dragEl.classList.remove("bc-dragging"); dragEl = null; });
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      const over = e.target.closest(".bc-sortable-item");
      if (!over || over === dragEl || !dragEl) return;
      const rect = over.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      list.insertBefore(dragEl, before ? over : over.nextSibling);
    });
    list.addEventListener("drop", () => {
      const ids = Array.from(list.children).map((li) => li.getAttribute("data-id"));
      onChange(ids);
    });
    return list;
  };

  // Chip-style tag input.
  C.tags = function ({ get, set, placeholder }) {
    const wrap = h("div.bc-tags", null);
    const chips = h("div.bc-chips", null);
    const inp = el("input", { type: "text", class: "bc-tags-inp", placeholder: placeholder || "add tag…" });
    function refresh() {
      chips.innerHTML = "";
      for (const t of (get() || [])) {
        const chip = h("span.bc-chip", null, [t, h("button.bc-chip-x", { type: "button", onclick: () => { set((get() || []).filter((x) => x !== t)); refresh(); } }, "×")]);
        chips.appendChild(chip);
      }
    }
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const v = inp.value.trim();
        if (v && !(get() || []).includes(v)) { set([...(get() || []), v]); refresh(); }
        inp.value = "";
      } else if (e.key === "Backspace" && !inp.value) {
        const arr = (get() || []).slice(); arr.pop(); set(arr); refresh();
      }
    });
    refresh();
    wrap.appendChild(chips); wrap.appendChild(inp);
    return wrap;
  };

  // Custom-link editor.
  C.links = function ({ get, set }) {
    const wrap = h("div.bc-links", null);
    function render() {
      wrap.innerHTML = "";
      (get() || []).forEach((lnk, i) => {
        const row = h("div.bc-link-row", null, [
          el("input", { type: "text", class: "bc-text", placeholder: "Label", value: lnk.label || "", oninput: (e) => { const arr = (get() || []).slice(); arr[i] = { ...arr[i], label: e.target.value }; set(arr); } }),
          el("input", { type: "url", class: "bc-text", placeholder: "https://…", value: lnk.url || "", oninput: (e) => { const arr = (get() || []).slice(); arr[i] = { ...arr[i], url: e.target.value }; set(arr); } }),
          h("label.bc-mini-check", null, [
            el("input", { type: "checkbox", checked: !!lnk.newTab, onchange: (e) => { const arr = (get() || []).slice(); arr[i] = { ...arr[i], newTab: e.target.checked }; set(arr); } }),
            "New tab",
          ]),
          el("button", { class: "bc-btn bc-btn-ghost", type: "button", onclick: () => { const arr = (get() || []).slice(); arr.splice(i, 1); set(arr); render(); } }, "Remove"),
        ]);
        wrap.appendChild(row);
      });
      const add = el("button", { class: "bc-btn", type: "button", onclick: () => { set([...(get() || []), { label: "New link", url: "", newTab: true }]); render(); } }, "+ Add link");
      wrap.appendChild(add);
    }
    render();
    return wrap;
  };

  // Keybinding recorder.
  C.keybind = function ({ get, set }) {
    const btn = el("button", { class: "bc-key", type: "button" });
    let recording = false;
    let chordBuf = "";
    let chordTO = null;
    function refresh() { btn.textContent = recording ? "Press keys…" : (BC.shortcuts.prettify(get() || "") || "unset"); }
    refresh();
    btn.addEventListener("click", () => { recording = true; refresh(); btn.focus(); });
    btn.addEventListener("blur", () => { recording = false; chordBuf = ""; refresh(); });
    btn.addEventListener("keydown", (e) => {
      if (!recording) return;
      if (e.key === "Escape") { recording = false; refresh(); btn.blur(); return; }
      e.preventDefault();
      const parts = [];
      if (e.metaKey || e.ctrlKey) parts.push("Mod");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      if (e.key.length === 1) parts.push(e.key.toUpperCase());
      else parts.push(e.key);
      const combo = parts.join("+");
      if (chordBuf) {
        set(chordBuf + " " + (e.key || "").toLowerCase());
        chordBuf = ""; clearTimeout(chordTO); recording = false; refresh(); btn.blur();
      } else if (parts.length === 1 && e.key && e.key.length === 1) {
        // Start chord if plain letter
        chordBuf = (e.key || "").toLowerCase();
        chordTO = setTimeout(() => { set(chordBuf); chordBuf = ""; recording = false; refresh(); btn.blur(); }, 800);
      } else {
        set(combo); recording = false; refresh(); btn.blur();
      }
    });
    return btn;
  };
})();
