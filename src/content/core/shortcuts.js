/* Better Canvas — global keyboard shortcut manager. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const bindings = new Map(); // id -> { combo, handler }
  let chord = null;
  let chordTimer = null;

  function isTypingTarget(t) {
    if (!t) return false;
    const tag = (t.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (t.isContentEditable) return true;
    return false;
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
    if (!s || !s.shortcuts || !s.shortcuts.enabled) return;

    // Chord (two-step, e.g. "g d")
    if (chord) {
      if (!keyOnly(ev)) { chord = null; clearTimeout(chordTimer); return; }
      const combo = chord + " " + (ev.key || "").toLowerCase();
      chord = null; clearTimeout(chordTimer);
      for (const { combo: c, handler } of bindings.values()) {
        if (c && c.toLowerCase() === combo) {
          ev.preventDefault(); ev.stopPropagation();
          try { handler(ev); } catch (_) {}
          return;
        }
      }
      return;
    }

    for (const { combo, handler } of bindings.values()) {
      if (!combo) continue;
      if (combo.indexOf(" ") > -1) {
        const firstToken = combo.split(" ")[0];
        if (keyOnly(ev) && (ev.key || "").toLowerCase() === firstToken.toLowerCase()) {
          chord = firstToken.toLowerCase();
          chordTimer = setTimeout(() => { chord = null; }, 1200);
          ev.preventDefault();
          return;
        }
      } else {
        if (eventMatchesToken(ev, combo)) {
          ev.preventDefault(); ev.stopPropagation();
          try { handler(ev); } catch (_) {}
          return;
        }
      }
    }
  }

  BC.shortcuts = {
    register(id, combo, handler) {
      bindings.set(id, { combo: normalizeCombo(combo), handler });
    },
    unregister(id) { bindings.delete(id); },
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
