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
      background: var(--bc-ruler-tint, rgba(255,235,59,.15));
      pointer-events: none; z-index: var(--bc-z-hud, 2147481000);
      border-top: 1px solid rgba(255,235,59,.4); border-bottom: 1px solid rgba(255,235,59,.4);
      transition: top .05s linear;
    }

    .bc-progress-bar {
      position: fixed; top: 0; left: 0; height: 3px;
      background: var(--bc-accent-stroke, var(--bc-accent, #0374b5));
      width: 0%; z-index: var(--bc-z-hud, 2147481000);
      transition: width var(--bc-dur-2, 150ms) var(--bc-ease-out, ease);
    }

    /* Bottom-RIGHT, sharing the corner budget with the Pomodoro dock and the
       toast stack rather than competing with it. left:16px put these on top of
       Canvas's global navigation rail, which is roughly 100px wide.

       At rest each is a 32px disc showing only its glyph, so two rarely-used
       utilities do not permanently occupy a labelled strip over the content.
       The label slides out on hover or focus. The label text stays in the DOM
       throughout (clipped, not hidden) so a screen reader always reads the full
       name, and each button carries an aria-label regardless. */
    .bc-copyurl-btn, .bc-print-btn {
      position: fixed; right: 16px; z-index: var(--bc-z-dock, 2147480000);
      display: inline-flex; align-items: center; justify-content: flex-start;
      height: 32px; padding: 0; overflow: hidden;
      background: var(--bc-surface-2, #fff); color: var(--bc-text, inherit);
      border: 1px solid var(--bc-border-strong, var(--bc-border, #e5e7eb));
      border-radius: var(--bc-radius-pill, 999px); cursor: pointer;
      font-family: var(--bc-font-sans); font-size: var(--bc-text-xs, 12px);
      box-shadow: var(--bc-shadow-1, 0 1px 3px rgba(0,0,0,.12));
      transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                  border-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
    }
    /* The glyph is the fixed part: a 30px square that keeps the disc round. */
    .bc-util-ic {
      flex: 0 0 30px; width: 30px; height: 30px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    /* Clipped rather than display:none, so it stays in the accessibility tree.
       max-width animates; width:auto would not. */
    .bc-util-label {
      max-width: 0; opacity: 0; white-space: nowrap;
      padding-right: 0;
      transition: max-width var(--bc-dur-2, 160ms) var(--bc-ease-standard, ease),
                  opacity var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                  padding-right var(--bc-dur-2, 160ms) var(--bc-ease-standard, ease);
    }
    .bc-copyurl-btn:hover .bc-util-label, .bc-print-btn:hover .bc-util-label,
    .bc-copyurl-btn:focus-visible .bc-util-label, .bc-print-btn:focus-visible .bc-util-label {
      max-width: 140px; opacity: 1; padding-right: var(--bc-space-4, 10px);
    }
    .bc-copyurl-btn:hover, .bc-print-btn:hover {
      background: var(--bc-surface-4, rgba(0,0,0,.05));
      border-color: var(--bc-accent-border, var(--bc-accent));
    }
    .bc-copyurl-btn:focus-visible, .bc-print-btn:focus-visible {
      outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 2px;
    }
    /* Nothing to animate when motion is reduced: the label simply appears. */
    :root[data-bc-motion="0"] .bc-util-label { transition: none; }
    @media (prefers-reduced-motion: reduce) { .bc-util-label { transition: none; } }
    /* A touch device never hovers, so the label would otherwise be unreachable
       and the icon alone would have to carry it. Show it outright instead. */
    @media (hover: none) {
      .bc-util-label { max-width: 140px; opacity: 1; padding-right: var(--bc-space-4, 10px); }
    }
    /* Stacked above whatever dock is mounted, and the toast host is told to
       clear both via --bc-utility-h. */
    .bc-copyurl-btn { bottom: calc(16px + var(--bc-dock-bottom, 0px)); }
    .bc-print-btn { bottom: calc(60px + var(--bc-dock-bottom, 0px)); }
    /* Printing the page should not print our own floating chrome. */
    @media print {
      .bc-copyurl-btn, .bc-print-btn, .bc-ruler, .bc-progress-bar { display: none !important; }
    }

    /* Deliberately NOT theme surfaces — the paper metaphor is the point — but it
       needs a dark variant, which it never had: it was a glaring white rectangle
       in dark mode. */
    .bc-note {
      position: absolute; z-index: var(--bc-z-underlay, 2147480500);
      background: var(--bc-note-bg, #fffbe6);
      color: var(--bc-note-text, #1f1a05);
      border: 1px solid var(--bc-note-border, #f6d67a);
      padding: 6px 8px; border-radius: var(--bc-radius-md, 6px);
      font-family: var(--bc-font-sans); font-size: var(--bc-text-sm, 13px); min-width: 140px;
      box-shadow: var(--bc-shadow-2, 0 4px 12px rgba(0,0,0,.14));
      resize: both; overflow: auto;
    }
    .bc-note-head { display: flex; justify-content: space-between; align-items: center; font-size: var(--bc-text-2xs, 11px); margin-bottom: 4px; cursor: move; }
    .bc-note textarea { width: 100%; min-height: 60px; border: 0; background: transparent; resize: none; outline: none; font-family: inherit; }
    .bc-note-x { background: none; border: 0; cursor: pointer; }

    .bc-wc {
      position: absolute; right: 6px; bottom: 6px;
      font-size: var(--bc-text-2xs, 11px); color: var(--bc-muted, #6b7280);
      /* was rgba(255,255,255,.85) — a white pill floating in dark mode */
      background: var(--bc-surface-2, #fff);
      padding: 2px 6px; border-radius: var(--bc-radius-sm, 4px);
      pointer-events: none; font-variant-numeric: tabular-nums;
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

  // Inline SVG rather than a unicode glyph: at rest the icon is the entire
  // affordance, and U+2302/U+26AD both render as tofu in fonts that lack them
  // and mean the wrong thing in fonts that don't (a house, a marriage symbol).
  // Stroke weight and caps match the sparkline in core/ui.js.
  function utilIcon(paths) {
    const ic = BC.util.el("span", { class: "bc-util-ic", "aria-hidden": "true" });
    ic.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round">' + paths + '</svg>';
    return ic;
  }
  const IC_LINK = '<path d="M6.75 9.25a2.5 2.5 0 0 0 3.54 0l2-2a2.5 2.5 0 0 0-3.54-3.54l-.6.6"/>' +
    '<path d="M9.25 6.75a2.5 2.5 0 0 0-3.54 0l-2 2a2.5 2.5 0 0 0 3.54 3.54l.6-.6"/>';
  const IC_PRINTER = '<path d="M4.5 6V2.5h7V6"/>' +
    '<path d="M4.5 12H3.25A1.25 1.25 0 0 1 2 10.75v-3A1.25 1.25 0 0 1 3.25 6.5h9.5A1.25 1.25 0 0 1 14 7.75v3A1.25 1.25 0 0 1 12.75 12H11.5"/>' +
    '<rect x="4.5" y="9.75" width="7" height="3.75" rx=".75"/>';

  // ---- Copy URL / Print ----
  function installUrlButton() {
    if (document.querySelector('[data-bc-node="bc-copyurl-btn"]')) return;
    const b = document.createElement("button");
    b.className = "bc-copyurl-btn";
    b.type = "button";
    b.setAttribute("data-bc-node", "bc-copyurl-btn");
    // aria-label as well as the clipped text: the name must not depend on a
    // visual state.
    b.setAttribute("aria-label", "Copy page URL");
    b.appendChild(utilIcon(IC_LINK));
    b.appendChild(BC.util.el("span", { class: "bc-util-label", text: "Copy URL" }));
    b.addEventListener("click", () => {
      // Clipboard writes reject on a denied permission or an unfocused document,
      // and the success toast used to fire from a chain with no catch, so a
      // failure was both unreported and an unhandled rejection.
      Promise.resolve()
        .then(() => navigator.clipboard.writeText(location.href))
        .then(() => BC.toast.success("URL copied"))
        .catch((e) => { BC.diag.push("copyUrl", e); BC.toast.error("Couldn't copy the URL"); });
    });
    document.body.appendChild(b);
  }
  function uninstallUrlButton() { BC.injector.removeNode("bc-copyurl-btn"); }

  // Publish the footprint so the toast stack starts above these rather than on
  // top of them. Two 32px discs at 16px and 60px, so the upper one reaches 92px;
  // the toast host already adds its own 16px base, leaving an 8px gap.
  const UTILITY_CLEARANCE = "84px";
  function setUtilityClearance(on) {
    const root = document.documentElement;
    if (on) {
      if (root.style.getPropertyValue("--bc-utility-h") !== UTILITY_CLEARANCE) {
        root.style.setProperty("--bc-utility-h", UTILITY_CLEARANCE);
      }
    } else if (root.style.getPropertyValue("--bc-utility-h")) {
      root.style.removeProperty("--bc-utility-h");
    }
  }

  function installPrintButton() {
    if (document.querySelector('[data-bc-node="bc-print-btn"]')) return;
    const b = document.createElement("button");
    b.className = "bc-print-btn";
    b.type = "button";
    b.setAttribute("data-bc-node", "bc-print-btn");
    b.setAttribute("aria-label", "Print this page");
    b.appendChild(utilIcon(IC_PRINTER));
    b.appendChild(BC.util.el("span", { class: "bc-util-label", text: "Print" }));
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
    return BC.storage.updateLocal((d) => { d.notes = d.notes || {}; d.notes[pageKey()] = arr; });
  }

  // ONE delegated drag, installed once — not a pair of document-level listeners
  // per note per apply(). buildNote used to attach mousemove+mouseup to document
  // and never remove them, while renderNotes rebuilt every note on every tick:
  // ~10 new permanent mousemove handlers per second, which froze the tab within
  // a minute of browsing.
  let dragEl = null, dragOx = 0, dragOy = 0;
  function installNoteDrag() {
    const bag = BC.lifecycle.pageBag("productivity");
    bag.once("note-drag", () => {
      bag.listen(document, "mousedown", (e) => {
        const head = e.target.closest && e.target.closest(".bc-note-head");
        if (!head) return;
        dragEl = head.closest(".bc-note");
        if (!dragEl) return;
        dragOx = e.clientX - dragEl.offsetLeft;
        dragOy = e.clientY - dragEl.offsetTop;
        e.preventDefault();
      });
      bag.listen(document, "mousemove", (e) => {
        if (!dragEl) return;
        dragEl.style.left = (e.clientX - dragOx) + "px";
        dragEl.style.top = (e.clientY - dragOy) + "px";
      });
      bag.listen(document, "mouseup", () => {
        if (!dragEl) return;
        const el = dragEl, id = el.dataset.noteId;
        dragEl = null;
        saveNotes(loadNotes().map((n) => (n.id === id ? { ...n, x: el.offsetLeft, y: el.offsetTop } : n)));
      });
    });
  }

  // Reconcile by id rather than remove-and-rebuild, so a note being typed into
  // or dragged is never destroyed underneath the user.
  function syncNotes() {
    installNoteDrag();
    const arr = loadNotes();
    const want = new Set(arr.map((n) => n.id));
    const existing = new Map();
    for (const el of document.querySelectorAll('[data-bc-node="bc-note"]')) {
      if (want.has(el.dataset.noteId)) existing.set(el.dataset.noteId, el);
      else el.remove();
    }
    for (const note of arr) {
      const el = existing.get(note.id);
      if (!el) { buildNote(note); continue; }
      const ta = el.querySelector("textarea");
      if (ta && ta.getRootNode().activeElement !== ta && ta.value !== (note.text || "")) ta.value = note.text || "";
      if (el !== dragEl) {
        const x = (note.x || 100) + "px", y = (note.y || 100) + "px";
        if (el.style.left !== x) el.style.left = x;
        if (el.style.top !== y) el.style.top = y;
      }
    }
  }

  function buildNote(note) {
    const el = document.createElement("div");
    el.className = "bc-note";
    el.setAttribute("data-bc-node", "bc-note");
    el.dataset.noteId = note.id;
    el.style.left = (note.x || 100) + "px";
    el.style.top = (note.y || 100) + "px";
    el.innerHTML = `
      <div class="bc-note-head"><span>note</span><button class="bc-note-x" title="Delete note" aria-label="Delete note">×</button></div>
      <textarea aria-label="Sticky note"></textarea>
    `;
    const ta = el.querySelector("textarea");
    ta.value = note.text || "";
    document.body.appendChild(el);
    el.querySelector(".bc-note-x").addEventListener("click", () => {
      el.remove();
      saveNotes(loadNotes().filter((n) => n.id !== note.id));
    });
    ta.addEventListener("input", BC.util.debounce(() => {
      saveNotes(loadNotes().map((n) => (n.id === note.id ? { ...n, text: ta.value } : n)));
    }, 400));
  }

  BC.quickNote = function () {
    const id = BC.util.uuid();
    const note = { id, text: "", x: 120 + Math.random() * 80, y: 120 + Math.random() * 80 };
    saveNotes(loadNotes().concat(note));
    buildNote(note);
  };

  // ---- Auto-save drafts ----
  // The old fallback keyed on a GLOBAL textarea index:
  //   Array.from(document.querySelectorAll("textarea")).indexOf(el)
  // Canvas mounts and unmounts textareas constantly (discussion reply boxes, inline
  // editors), so index 2 today is a different box tomorrow — and the saved text was
  // written straight into it. That silently cross-contaminated the user's prose.
  // This keys on structure instead, and refuses to persist at all when there is no
  // stable anchor: losing a draft is strictly better than restoring it into the
  // wrong field.
  function draftKey(el) {
    const base = location.origin + location.pathname;
    if (el.id) return base + "#id=" + el.id;
    if (el.name) return base + "#name=" + el.name;
    let anchor = el.parentElement;
    const path = [];
    while (anchor && !anchor.id && anchor !== document.body) { path.push(anchor.tagName); anchor = anchor.parentElement; }
    if (!anchor || !anchor.id) return null;
    const peers = Array.from(anchor.querySelectorAll('textarea,[contenteditable="true"]'));
    return base + "#p=" + anchor.id + "/" + path.reverse().join(">") + "/" + peers.indexOf(el);
  }
  function installDrafts() {
    for (const ta of document.querySelectorAll("textarea, [contenteditable=true]")) {
      if (ta._bcDraft) continue; ta._bcDraft = true;
      const key = draftKey(ta);
      if (!key) continue;
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
      wc.setAttribute("data-bc-node", "bc-wc");   // so teardown can actually remove it
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

  // apply() runs several times a second. Each of the passes below walks the DOM
  // (querySelectorAll over every textarea, reconciling every note), so running
  // them unconditionally was a continuous background scan on every Canvas page
  // for work that only matters when something actually changed.
  //
  // The notes pass is keyed on the stored notes; the textarea passes are keyed on
  // how many candidates exist, which is what changes when Canvas mounts a new
  // editor. Both re-run for free after an SPA navigation because the keys reset.
  let notesSig = null;
  let textareaCount = -1;

  function syncNotesIfChanged() {
    const sig = JSON.stringify(loadNotes());
    if (sig === notesSig && document.querySelector('[data-bc-node="bc-note"]')) return;
    notesSig = sig;
    syncNotes();
  }

  function scanTextareas(p) {
    const n = document.querySelectorAll("textarea, [contenteditable=true]").length;
    if (n === textareaCount) return;
    textareaCount = n;
    if (p.autoSaveDrafts) installDrafts();
    if (p.wordCount) installWordCount();
  }

  function apply(settings) {
    const p = settings.productivity || {};
    applyFocus(p.focusMode);
    p.readingRuler ? installRuler() : uninstallRuler();
    p.readingProgress ? installProgress() : uninstallProgress();
    p.copyUrlButton ? installUrlButton() : uninstallUrlButton();
    p.printFriendly ? installPrintButton() : uninstallPrintButton();
    setUtilityClearance(!!(p.copyUrlButton || p.printFriendly));
    BC.injector.setStyle("bc-productivity-css", CSS);

    if (p.stickyNotes && BC.storage.loadLocal) BC.storage.loadLocal().then(syncNotesIfChanged);
    if (p.autoSaveDrafts || p.wordCount) {
      if (BC.storage.loadLocal) BC.storage.loadLocal().then(() => scanTextareas(p));
      else scanTextareas(p);
    }
  }

  BC.registry.register({
    id: "productivity",
    styles: ["bc-productivity-css"],
    nodes: ["bc-ruler", "bc-progress-bar", "bc-copyurl-btn", "bc-print-btn", "bc-note", "bc-wc"],
    apply,
    // Without this, teardown removed the ruler and progress-bar NODES but left
    // rulerEl/progressEl pointing at them, so install*() early-returned forever and
    // neither ever came back after a disable/enable cycle.
    unmount() {
      uninstallRuler();
      uninstallProgress();
      dragEl = null;
      notesSig = null;
      textareaCount = -1;
      setUtilityClearance(false);
      for (const ta of document.querySelectorAll("textarea, [contenteditable=true]")) {
        delete ta._bcDraft;
        delete ta._bcWc;
      }
    },
  });
})();
