/*
 * Better Canvas — productivity toolkit.
 * Focus mode, reading ruler, sticky notes per page, persistent highlights,
 * auto-save drafts, word/char count on textareas, print-friendly view,
 * copy-URL button, reading-progress bar.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-focus #left-side, .bc-focus #right-side, .bc-focus .ic-app-header,
    .bc-focus .ic-app-crumbs, .bc-focus header { display: none !important; }
    .bc-focus #main, .bc-focus #wrapper { margin: 0 !important; padding: 20px !important; max-width: 900px !important; }

    .bc-ruler {
      position: fixed; left: 0; right: 0; height: 30px;
      background: rgba(255,235,59,.15); pointer-events: none; z-index: 2147481500;
      border-top: 1px solid rgba(255,235,59,.4); border-bottom: 1px solid rgba(255,235,59,.4);
      transition: top .05s linear;
    }

    .bc-progress-bar {
      position: fixed; top: 0; left: 0; height: 3px; background: var(--bc-accent, #0374b5);
      width: 0%; z-index: 2147481000; transition: width .15s ease;
    }

    .bc-copyurl-btn, .bc-print-btn {
      position: fixed; right: 16px; z-index: 2147480000;
      background: var(--bc-accent, #0374b5); color: #fff; border: 0;
      padding: 6px 10px; border-radius: 999px; cursor: pointer; font-size: 12px;
    }
    .bc-copyurl-btn { bottom: 66px; }
    .bc-print-btn { bottom: 100px; }

    .bc-note {
      position: absolute; z-index: 2147480500;
      background: #fffbe6; color: #111; border: 1px solid #f6d67a;
      padding: 6px 8px; border-radius: 6px; font-size: 13px; min-width: 140px;
      box-shadow: 0 4px 12px rgba(0,0,0,.14);
      resize: both; overflow: auto;
    }
    .bc-note-head { display: flex; justify-content: space-between; align-items: center; font-size: 11px; opacity: .6; margin-bottom: 4px; cursor: move; }
    .bc-note textarea { width: 100%; min-height: 60px; border: 0; background: transparent; resize: none; outline: none; font-family: inherit; }
    .bc-note-x { background: none; border: 0; cursor: pointer; }

    .bc-wc {
      position: absolute; right: 6px; bottom: 6px;
      font-size: 11px; color: var(--bc-d-muted, #6b7280);
      background: rgba(255,255,255,.85); padding: 2px 6px; border-radius: 4px;
      pointer-events: none;
    }
  `;

  // ---- Focus mode ------
  function applyFocus(on) { document.documentElement.classList.toggle("bc-focus", !!on); }

  // ---- Reading ruler ----
  let rulerEl = null;
  function onRulerMove(e) {
    if (!rulerEl) return;
    rulerEl.style.top = Math.max(0, e.clientY - 15) + "px";
  }
  function installRuler() {
    if (rulerEl) return;
    rulerEl = document.createElement("div");
    rulerEl.className = "bc-ruler";
    rulerEl.setAttribute("data-bc-node", "bc-ruler");
    document.body.appendChild(rulerEl);
    document.addEventListener("mousemove", onRulerMove);
  }
  function uninstallRuler() {
    document.removeEventListener("mousemove", onRulerMove);
    if (rulerEl && rulerEl.parentNode) rulerEl.remove();
    rulerEl = null;
  }

  // ---- Reading progress ----
  let progressEl = null;
  function onProgressScroll() {
    if (!progressEl) return;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
    progressEl.style.width = Math.max(0, Math.min(100, pct)) + "%";
  }
  function installProgress() {
    if (progressEl) return;
    progressEl = document.createElement("div");
    progressEl.className = "bc-progress-bar";
    progressEl.setAttribute("data-bc-node", "bc-progress-bar");
    document.body.appendChild(progressEl);
    window.addEventListener("scroll", onProgressScroll, { passive: true });
    onProgressScroll();
  }
  function uninstallProgress() {
    window.removeEventListener("scroll", onProgressScroll);
    if (progressEl && progressEl.parentNode) progressEl.remove();
    progressEl = null;
  }

  // ---- Copy URL / Print ----
  function installUrlButton() {
    if (document.querySelector('[data-bc-node="bc-copyurl-btn"]')) return;
    const b = document.createElement("button");
    b.className = "bc-copyurl-btn";
    b.setAttribute("data-bc-node", "bc-copyurl-btn");
    b.textContent = "🔗 Copy URL";
    b.addEventListener("click", () => {
      navigator.clipboard.writeText(location.href).then(() => BC.toast.success("URL copied"));
    });
    document.body.appendChild(b);
  }
  function uninstallUrlButton() { BC.injector.removeNode("bc-copyurl-btn"); }

  function installPrintButton() {
    if (document.querySelector('[data-bc-node="bc-print-btn"]')) return;
    const b = document.createElement("button");
    b.className = "bc-print-btn";
    b.setAttribute("data-bc-node", "bc-print-btn");
    b.textContent = "🖨 Print";
    b.addEventListener("click", () => window.print());
    document.body.appendChild(b);
  }
  function uninstallPrintButton() { BC.injector.removeNode("bc-print-btn"); }

  // ---- Sticky notes ----
  function pageKey() { return location.origin + location.pathname; }
  function loadNotes() {
    return (BC.storage.local && BC.storage.local.notes && BC.storage.local.notes[pageKey()]) || [];
  }
  function saveNotes(arr) {
    BC.storage.updateLocal((d) => { d.notes = d.notes || {}; d.notes[pageKey()] = arr; });
  }
  function renderNotes() {
    // Remove existing
    document.querySelectorAll('[data-bc-node="bc-note"]').forEach((n) => n.remove());
    const arr = loadNotes();
    for (const note of arr) buildNote(note);
  }
  function buildNote(note) {
    const el = document.createElement("div");
    el.className = "bc-note";
    el.setAttribute("data-bc-node", "bc-note");
    el.style.left = (note.x || 100) + "px";
    el.style.top = (note.y || 100) + "px";
    el.innerHTML = `
      <div class="bc-note-head"><span>note</span><button class="bc-note-x" title="Delete">×</button></div>
      <textarea>${BC.util.escapeHtml(note.text || "")}</textarea>
    `;
    document.body.appendChild(el);
    const head = el.querySelector(".bc-note-head");
    const ta = el.querySelector("textarea");
    el.querySelector(".bc-note-x").addEventListener("click", () => {
      const arr = loadNotes().filter((n) => n.id !== note.id);
      saveNotes(arr);
      el.remove();
    });
    ta.addEventListener("input", () => {
      const arr = loadNotes().map((n) => n.id === note.id ? { ...n, text: ta.value } : n);
      saveNotes(arr);
    });
    // drag
    let ox = 0, oy = 0, drag = false;
    head.addEventListener("mousedown", (e) => { drag = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop; });
    document.addEventListener("mousemove", (e) => { if (!drag) return; el.style.left = (e.clientX - ox) + "px"; el.style.top = (e.clientY - oy) + "px"; });
    document.addEventListener("mouseup", () => { if (drag) { drag = false; const arr = loadNotes().map((n) => n.id === note.id ? { ...n, x: el.offsetLeft, y: el.offsetTop } : n); saveNotes(arr); } });
  }
  BC.quickNote = function () {
    const id = BC.util.uuid();
    const note = { id, text: "", x: 120 + Math.random() * 80, y: 120 + Math.random() * 80 };
    saveNotes(loadNotes().concat(note));
    buildNote(note);
  };

  // ---- Auto-save drafts ----
  function draftKey(el) {
    return location.origin + location.pathname + "#" + (el.id || el.name || Array.from(document.querySelectorAll("textarea")).indexOf(el));
  }
  function installDrafts() {
    for (const ta of document.querySelectorAll("textarea, [contenteditable=true]")) {
      if (ta._bcDraft) continue; ta._bcDraft = true;
      const key = draftKey(ta);
      const saved = BC.storage.local && BC.storage.local.drafts && BC.storage.local.drafts[key];
      if (saved && !ta.value && !ta.textContent) {
        if (ta.tagName === "TEXTAREA") ta.value = saved;
        else ta.textContent = saved;
      }
      ta.addEventListener("input", BC.util.debounce(() => {
        const val = ta.tagName === "TEXTAREA" ? ta.value : ta.textContent;
        BC.storage.updateLocal((d) => { d.drafts = d.drafts || {}; d.drafts[key] = val; });
      }, 400));
    }
  }

  // ---- Word count ----
  function installWordCount() {
    for (const ta of document.querySelectorAll("textarea")) {
      if (ta._bcWc) continue; ta._bcWc = true;
      const wrap = ta.parentNode;
      if (!wrap) continue;
      wrap.style.position = wrap.style.position || "relative";
      const wc = document.createElement("div");
      wc.className = "bc-wc";
      wrap.appendChild(wc);
      const update = () => {
        const t = (ta.value || "").trim();
        const words = t ? t.split(/\s+/).length : 0;
        wc.textContent = words + " words · " + (ta.value || "").length + " chars";
      };
      ta.addEventListener("input", update);
      update();
    }
  }

  function apply(settings) {
    const p = settings.productivity || {};
    applyFocus(p.focusMode);
    p.readingRuler ? installRuler() : uninstallRuler();
    p.readingProgress ? installProgress() : uninstallProgress();
    p.copyUrlButton ? installUrlButton() : uninstallUrlButton();
    p.printFriendly ? installPrintButton() : uninstallPrintButton();
    BC.injector.setStyle("bc-productivity-css", CSS);

    if (p.stickyNotes && BC.storage.loadLocal) BC.storage.loadLocal().then(() => renderNotes());
    if (p.autoSaveDrafts && BC.storage.loadLocal) BC.storage.loadLocal().then(() => installDrafts());
    if (p.wordCount) installWordCount();
  }

  BC.registry.register({ id: "productivity", styles: ["bc-productivity-css"], nodes: ["bc-ruler", "bc-progress-bar", "bc-copyurl-btn", "bc-print-btn", "bc-note"], apply });
})();
