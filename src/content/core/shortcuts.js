/* Better Canvas — global keyboard shortcut manager. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const bindings = new Map(); // id -> { combo, handler }
  let chord = null;
  let chordTimer = null;

  function isTypingTarget(t) {
    if (!t) return false;
    if (t.isContentEditable) return true;
    const tag = (t.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    // ARIA text widgets report neither a form tag nor contentEditable on the event
    // target — Canvas's InstUI comboboxes and its rich-text editors both land here.
    return !!(t.closest && t.closest(
      '[contenteditable=""],[contenteditable="true"],[role="textbox"],' +
      '[role="combobox"],[role="searchbox"],.ProseMirror,.tox-edit-area'
    ));
  }

  function normalizeCombo(str) {
    return String(str || "").trim();
  }

  function eventMatchesToken(ev, token) {
    // Token: "Mod+K", "Mod+Shift+D", "g", "ArrowDown"
    const parts = token.split("+").map((s) => s.trim());
    const key = parts.pop().toLowerCase();
    const need = { mod: false, shift: false, alt: false };
    for (const p of parts) {
      const q = p.toLowerCase();
      if (q === "mod" || q === "cmd" || q === "ctrl") need.mod = true;
      else if (q === "shift") need.shift = true;
      else if (q === "alt" || q === "option") need.alt = true;
    }
    const modOK = need.mod ? (ev.metaKey || ev.ctrlKey) : (!ev.metaKey && !ev.ctrlKey);
    const shiftOK = need.shift ? ev.shiftKey : !ev.shiftKey;
    const altOK   = need.alt ? ev.altKey : !ev.altKey;
    if (!modOK || !shiftOK || !altOK) return false;
    const evKey = (ev.key || "").toLowerCase();
    return evKey === key;
  }

  function keyOnly(ev) {
    // Simple non-modifier key press (for chord second-part)
    return !ev.metaKey && !ev.ctrlKey && !ev.altKey && !ev.shiftKey && (ev.key || "").length === 1;
  }

  function onKey(ev) {
    if (isTypingTarget(ev.target)) return;
    const s = BC.storage && BC.storage.current;
    // The master switch has to gate this too. The listener is installed once at
    // document level and teardown never removes it, so checking only
    // shortcuts.enabled left every binding live while the extension was off --
    // Mod+Shift+D still toggled dark mode on a "disabled" extension.
    if (!s || !s.enabled || !s.shortcuts || !s.shortcuts.enabled) return;

    // Chord second key (e.g. "g d").
    if (chord) {
      const pending = chord;
      chord = null;
      clearTimeout(chordTimer);
      if (keyOnly(ev)) {
        const combo = pending + " " + (ev.key || "").toLowerCase();
        for (const { combo: c, handler } of bindings.values()) {
          if (c && c.toLowerCase() === combo) {
            ev.preventDefault(); ev.stopPropagation();
            BC.util.guard(() => handler(ev), "shortcut " + combo);
            return;
          }
        }
      }
      // Nothing matched — fall through so the key can still trigger a single-key
      // binding instead of being silently eaten.
    }

    for (const { combo, handler } of bindings.values()) {
      if (!combo) continue;
      if (combo.indexOf(" ") > -1) {
        const firstToken = combo.split(" ")[0];
        if (keyOnly(ev) && (ev.key || "").toLowerCase() === firstToken.toLowerCase()) {
          chord = firstToken.toLowerCase();
          clearTimeout(chordTimer);
          chordTimer = setTimeout(() => { chord = null; }, 800);
          // Deliberately NOT preventDefault. Starting a chord used to swallow the
          // keystroke for 1.2s, so a bare "g" anywhere outside a recognised input —
          // including widgets isTypingTarget missed — lost the letter entirely.
          return;
        }
      } else if (eventMatchesToken(ev, combo)) {
        ev.preventDefault(); ev.stopPropagation();
        BC.util.guard(() => handler(ev), "shortcut " + combo);
        return;
      }
    }
  }

  BC.shortcuts = {
    // `id` is the settings.shortcuts.bindings key, so reloadFromSettings can
    // find the entry. It previously took an arbitrary id ("bc-palette") that
    // never matched a settings key ("commandPalette"), which made
    // reloadFromSettings a silent no-op.
    register(id, combo, handler) {
      bindings.set(id, { combo: normalizeCombo(combo), handler });
    },
    unregister(id) { bindings.delete(id); },
    has(id) { return bindings.has(id); },
    comboFor(id) { const e = bindings.get(id); return e ? e.combo : null; },
    reloadFromSettings(settings) {
      const b = settings && settings.shortcuts && settings.shortcuts.bindings;
      if (!b) return;
      for (const [id, entry] of bindings.entries()) {
        if (b[id] != null) entry.combo = normalizeCombo(b[id]);
      }
    },
    prettify(combo) {
      if (!combo) return "";
      return combo.replace(/Mod/g, BC.util.isMac ? "⌘" : "Ctrl").replace(/Shift/g, "⇧").replace(/Alt/g, "⌥");
    },
    _install() {
      document.addEventListener("keydown", onKey, true);
    },
  };

  BC.util.whenBody(() => BC.shortcuts._install());
})();
