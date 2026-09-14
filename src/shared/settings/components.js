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

  // ---- live bindings ------------------------------------------------------
  // Controls own their DOM for their whole lifetime. The UI used to tear the
  // whole tab down on every state change, which destroyed the very control the
  // user was touching: the checkbox's CSS transition never ran (a transition
  // needs the element to survive the style change), the caret was lost after one
  // character, and a slider drag died on the first movement. Instead each control
  // registers a sync(state) that re-reads the store and writes only what differs.
  // For the control just touched that's a no-op, so the native interaction is
  // never interrupted; for every other control it's the cross-row reactivity
  // channel a pure "controls own their DOM" approach would lack.
  let binds = [];

  // Shadow-DOM safe: the drawer lives in a shadow root, where
  // document.activeElement reports the HOST, not the focused input.
  const focused = (n) => n.getRootNode().activeElement === n;

  C.bindings = {
    reset() { binds = []; },
    add(node, fn) { binds.push({ node, fn }); return node; },
    sync(state) {
      for (let i = binds.length - 1; i >= 0; i--) {
        const b = binds[i];
        // isConnected is shadow-inclusive, so controls detached by a tab switch or
        // a sub-panel redraw prune themselves — no bookkeeping at the call sites.
        if (!b.node.isConnected) { binds.splice(i, 1); continue; }
        BC.util.guard(() => b.fn(state), "bc-sync");
      }
    },
  };
  const bind = (node, fn) => C.bindings.add(node, fn);

  // Section wrapper. `icon` is a name from the shared set: a section heading with
  // a mark in front of it is findable by shape when you are scrolling past six of
  // them, which a line of 15px text is not.
  C.section = function ({ title, description, children, icon }) {
    const body = h("div.bc-section-body", null, children);
    const head = title ? h("div.bc-section-head", null, [
      icon ? C.iconTile(icon, "sm") : null,
      h("div.bc-section-heading", null, [
        h("h3.bc-section-title", null, title),
        description ? h("p.bc-section-desc", null, description) : null,
      ]),
    ]) : null;
    return h("section.bc-section", null, [head, body]);
  };

  // The one place an icon gets its container. Every icon in the settings UI is
  // in a tile of one of these two sizes, so they cannot drift to different
  // paddings and optical weights across seventeen renderers.
  C.iconTile = function (name, size) {
    const tile = h("span.bc-tile" + (size === "sm" ? ".bc-tile-sm" : ""), null);
    tile.setAttribute("aria-hidden", "true");
    tile.innerHTML = BC.icons.svg(name, { size: size === "sm" ? 15 : 16 });
    return tile;
  };

  // Row: label + control. `enabledWhen(state)` is optional and purely additive —
  // omit it and behaviour is identical to before. With it, the row greys out and
  // goes inert when its parent toggle is off, which nothing did previously.
  C.row = function ({ label, hint, control, warn, enabledWhen, icon, wide }) {
    const ctl = h("div.bc-row-control", null, control);
    // Three columns -- mark, label, control -- instead of two. The mark column is
    // what gives a list of fourteen switches a rhythm; without it every row was
    // the same rectangle and the only way to find one was to read all of them.
    const row = h("div.bc-row" + (wide ? ".bc-row-wide" : ""), null, [
      icon ? C.iconTile(icon) : h("span.bc-tile.bc-tile-blank", null),
      h("div.bc-row-label", null, [
        h("div.bc-row-title", null, label),
        hint ? h("div.bc-row-hint", null, hint) : null,
        warn ? h("div.bc-row-warn", null, warn) : null,
      ]),
      ctl,
    ]);
    if (enabledWhen) {
      const paint = (s) => {
        const on = !!enabledWhen(s);
        if (row.classList.contains("bc-row-off") === on) row.classList.toggle("bc-row-off", !on);
        ctl.toggleAttribute("inert", !on);
      };
      bind(row, paint);
      // Once at mount, not only on the next store change. Registering the
      // binding alone left every dependent row painted as ENABLED until the
      // user happened to change something -- so a planner-only control looked
      // live while the planner was off, which is the exact confusion the
      // feature exists to remove. C.state is set by the store on creation.
      if (C.state) BC.util.guard(() => paint(C.state()), "bc-row-init");
    }
    return row;
  };

  // On/off switch.
  C.switch = function ({ get, set, ariaLabel }) {
    const input = el("input", { type: "checkbox", checked: !!get(), "aria-label": ariaLabel || "toggle" });
    // <label>, not <span>: a click anywhere on the track — including the thumb —
    // is forwarded to the checkbox. The spec skips label activation when the
    // event target is already the labeled control, so this can't double-toggle.
    const track = h("label.bc-switch", null, [input, h("span.bc-switch-thumb", null)]);
    // Paint synchronously so the track fills in the same frame as the click,
    // without waiting on the store round-trip.
    const paint = () => track.classList.toggle("bc-on", input.checked);
    paint();
    input.addEventListener("change", () => { paint(); set(input.checked); });
    bind(track, () => { const v = !!get(); if (input.checked !== v) input.checked = v; paint(); });
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
    bind(sel, () => { const v = String(get()); if (sel.value !== v) sel.value = v; });
    return sel;
  };

  // A radio group whose options are drawn rather than described. A <select>
  // reading "Segments / Rainbow / Ring" asks the user to imagine the answer;
  // for a setting that is purely about appearance, the control should just show
  // it. `preview(value)` returns the swatch markup for each option.
  C.choice = function ({ get, set, options, ariaLabel, preview }) {
    const name = "bc-choice-" + Math.random().toString(36).slice(2, 8);
    const group = h("div.bc-choice", null);
    group.setAttribute("role", "radiogroup");
    if (ariaLabel) group.setAttribute("aria-label", ariaLabel);
    const inputs = [];

    for (const o of options) {
      const input = el("input", { type: "radio", name, value: o.value, class: "bc-sr-only" });
      input.checked = o.value === get();
      const swatch = h("span.bc-choice-art", null);
      swatch.setAttribute("aria-hidden", "true");
      if (preview) swatch.innerHTML = preview(o.value);
      const label = h("label.bc-choice-opt", null, [
        input, swatch, h("span.bc-choice-label", null, o.label),
      ]);
      const paint = () => label.classList.toggle("bc-on", input.checked);
      paint();
      // change, not click: the arrow keys a radiogroup is expected to answer to
      // move the selection without ever firing a click.
      input.addEventListener("change", () => {
        if (!input.checked) return;
        for (const i of inputs) i.paint();
        set(o.value);
      });
      inputs.push({ input, paint });
      group.appendChild(label);
    }

    bind(group, () => {
      const v = String(get());
      for (const i of inputs) {
        const want = i.input.value === v;
        if (i.input.checked !== want) i.input.checked = want;
        i.paint();
      }
    });
    return group;
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
    // Never write into a field the user is typing in — that's what cost the caret
    // after a single character.
    bind(inp, () => { const v = get() ?? ""; if (!focused(inp) && inp.value !== String(v)) inp.value = String(v); });
    return wrap;
  };

  C.textarea = function ({ get, set, placeholder, rows }) {
    const ta = el("textarea", { class: "bc-textarea", placeholder: placeholder || "", rows: rows || 4 });
    ta.value = get() || "";
    ta.addEventListener("input", () => set(ta.value));
    bind(ta, () => { const v = get() ?? ""; if (!focused(ta) && ta.value !== String(v)) ta.value = String(v); });
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
    bind(inp, () => { const v = get(); if (!focused(inp) && inp.value !== String(v ?? "")) inp.value = v ?? ""; });
    return inp;
  };

  C.slider = function ({ get, set, min, max, step, format }) {
    const wrap = h("div.bc-slider", null);
    const rng = el("input", { type: "range", min: min ?? 0, max: max ?? 100, step: step ?? 1, value: get() ?? 0 });
    const val = h("span.bc-slider-val", null, format ? format(get()) : String(get()));
    const label = (v) => { const t = format ? format(v) : String(v); if (val.textContent !== t) val.textContent = t; };
    // The readout updates on every input event (free, local); the store write is
    // throttled. A single drag used to fire 30-60 writes per second, each one
    // rebuilding the panel and destroying the range input under the pointer.
    const commit = BC.util.throttle((v) => set(v), 100);
    rng.addEventListener("input", () => { const v = parseFloat(rng.value); label(v); commit(v); });
    rng.addEventListener("change", () => set(parseFloat(rng.value)));  // definitive final value
    bind(rng, () => {
      if (focused(rng)) return;             // never fight an in-progress drag
      const v = get();
      if (rng.value !== String(v)) rng.value = v;
      label(v);
    });
    wrap.appendChild(rng); wrap.appendChild(val);
    return wrap;
  };

  C.color = function ({ get, set, allowEmpty }) {
    const wrap = h("div.bc-color", null);
    const cur = get() || "";
    const picker = el("input", { type: "color", value: cur || "#000000" });
    // The visible swatch is a label we own, with the input invisible on top of
    // it. Styling input[type=color] directly means styling ::-webkit-color-swatch,
    // which ignores a transparent background -- so an UNSET colour still painted
    // as solid black, i.e. as a deliberate choice of the one value it is not.
    // Owning the surface also lets the swatch take the radius token, which the
    // UA pseudo-element does not.
    const swatch = h("label.bc-swatch", { title: "Pick a colour" }, [picker]);
    const text   = el("input", { type: "text", class: "bc-color-text", value: cur, placeholder: "Default" });
    const paintSwatch = () => {
      const v = get() || "";
      wrap.classList.toggle("bc-color-unset", !v);
      swatch.style.background = v || "";
    };
    // Dragging in the native picker fires input continuously — throttle the store
    // write and take the definitive value on change.
    const commit = BC.util.throttle((v) => set(v), 100);
    picker.addEventListener("input", () => { text.value = picker.value; swatch.style.background = picker.value; wrap.classList.remove("bc-color-unset"); commit(picker.value); });
    picker.addEventListener("change", () => set(picker.value));
    bind(wrap, () => {
      const v = get() || "";
      if (!focused(text) && text.value !== v) text.value = v;
      if (!focused(picker) && v && picker.value !== v) picker.value = v;
      paintSwatch();
    });
    text.addEventListener("input", () => {
      const v = text.value.trim();
      if (v === "" && allowEmpty) { set(""); paintSwatch(); return; }
      if (BC.color.isHex(v)) { picker.value = v; set(v); wrap.classList.remove("bc-invalid"); paintSwatch(); }
      else wrap.classList.add("bc-invalid");
    });
    paintSwatch();
    wrap.appendChild(swatch); wrap.appendChild(text);
    // Clear is a mark, not the word "Clear": the old control was swatch + hex
    // field + button at ~230px, which is what squeezed the label column to 130px
    // in the drawer and wrapped its hint over five lines.
    if (allowEmpty) {
      const clr = el("button", { class: "bc-icon-btn bc-color-clear", type: "button", title: "Clear", "aria-label": "Clear colour" });
      clr.innerHTML = BC.icons.svg("close", { size: 13 });
      clr.addEventListener("click", () => { text.value = ""; set(""); paintSwatch(); });
      wrap.appendChild(clr);
    }
    return wrap;
  };

  // `icon` takes a name from the shared set (preferred) or a node. A name keeps
  // every button on the same grid and stroke weight as the tab rail and the
  // planner, which is the whole point of having one set.
  C.button = function ({ label, onClick, variant, icon, title }) {
    const b = el("button", { class: "bc-btn " + (variant ? "bc-btn-" + variant : ""), type: "button" });
    if (typeof icon === "string" && BC.icons && BC.icons.has(icon)) {
      const ic = h("span.bc-btn-ic", null);
      ic.setAttribute("aria-hidden", "true");
      ic.innerHTML = BC.icons.svg(icon, { size: 14 });
      b.appendChild(ic);
    } else if (icon && typeof icon !== "string") {
      b.appendChild(h("span.bc-btn-ic", null, icon));
    }
    b.appendChild(document.createTextNode(label));
    if (title) b.title = title;
    b.addEventListener("click", onClick);
    return b;
  };

  // Drag-sortable list. items: [{id, label, ...}]. onChange(orderedIds).
  C.sortable = function ({ items, render, onChange, itemClass }) {
    const list = h("ul.bc-sortable", null);
    items.forEach((it) => {
      const li = el("li", { class: "bc-sortable-item " + (itemClass || ""), draggable: "true", "data-id": String(it.id) });
      const handle = h("span.bc-drag", null);
      handle.setAttribute("aria-hidden", "true");
      handle.innerHTML = BC.icons.svg("grip", { size: 14 });
      li.appendChild(handle);
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
      wrap.dataset.bcSig = (get() || []).join(" ");
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
    bind(wrap, () => { if (wrap.dataset.bcSig !== (get() || []).join(" ")) refresh(); });
    return wrap;
  };

  // Custom-link editor.
  C.links = function ({ get, set }) {
    const wrap = h("div.bc-links", null);
    function render() {
      wrap.dataset.bcSig = String((get() || []).length);
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
    // Key on LENGTH only. Keying on content would rebuild the row while the user
    // is typing a URL into it and destroy the caret.
    bind(wrap, () => { if (wrap.dataset.bcSig !== String((get() || []).length)) render(); });
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
    // Pressing a modifier alone fires keydown with e.key === "Shift"/"Meta"/etc.
    // Recording that produced nonsense bindings like "Shift+Shift" that could
    // never match a real event, silently breaking the shortcut.
    const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "OS", "AltGraph", "CapsLock"]);
    btn.addEventListener("keydown", (e) => {
      if (!recording) return;
      if (e.key === "Escape") { recording = false; refresh(); btn.blur(); return; }
      if (MODIFIER_KEYS.has(e.key)) { e.preventDefault(); return; }   // wait for a real key
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
    bind(btn, () => { if (!recording) refresh(); });
    return btn;
  };
})();
