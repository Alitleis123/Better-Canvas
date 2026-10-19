/* Better Canvas — assignment hover previews. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    /* role=tooltip, not dialog: it's hover-only and never takes focus. */
    .bc-preview {
      position: fixed; z-index: var(--bc-z-popover, 2147481500);
      background: var(--bc-surface-2, #fff); color: var(--bc-text, inherit);
      border: 1px solid var(--bc-border, #e5e7eb); border-radius: var(--bc-radius-lg, 10px);
      padding: var(--bc-space-4, 10px) var(--bc-space-5, 12px);
      box-shadow: var(--bc-shadow-3, 0 10px 30px rgba(0,0,0,.18));
      max-width: 340px;
      font-family: var(--bc-font-sans); font-size: var(--bc-text-sm, 13px);
      /* It sits just below the hovered link, over the next links in the list, so it
         must never catch the pointer, and it leaves the page once faded out. */
      pointer-events: none; visibility: hidden;
      opacity: 0; transform: translateY(4px);
      transition: opacity var(--bc-dur-2, 150ms) var(--bc-ease-out, ease),
                  transform var(--bc-dur-2, 150ms) var(--bc-ease-out, ease),
                  visibility 0s linear var(--bc-dur-2, 150ms);
    }
    .bc-preview.show { opacity: 1; transform: translateY(0); visibility: visible; transition-delay: 0s; }
    .bc-preview h5 { margin: 0 0 4px; font-size: var(--bc-text-md, 14px); }
    .bc-preview p { margin: 0; color: var(--bc-muted, #6b7280); }
  `;

  let previewEl = null;
  let hoverTimer = null;
  let showSeq = 0;           // the latest show(); older fetches resolve into nothing

  function ensure() {
    if (previewEl && previewEl.isConnected) return previewEl;
    previewEl = document.createElement("div");
    previewEl.className = "bc-preview";
    previewEl.setAttribute("data-bc-node", "bc-preview");
    previewEl.setAttribute("role", "tooltip");
    document.body.appendChild(previewEl);
    return previewEl;
  }

  function hide() {
    showSeq++;
    if (previewEl) previewEl.classList.remove("show");
    clearTimeout(hoverTimer);
  }

  async function show(a, courseId, id) {
    const seq = ++showSeq;
    const el = ensure();
    el.innerHTML = `<h5>Loading…</h5>`;
    positionAt(a, el);
    el.classList.add("show");
    try {
      const asn = await BC.api.assignment(courseId, id);
      // Hovering A then B quickly left whichever request finished LAST on screen,
      // so the card could describe the wrong assignment.
      if (seq !== showSeq) return;
      const due = asn.due_at ? BC.dt.dueLabel(asn.due_at) : "No due date";
      const points = asn.points_possible != null ? " · " + asn.points_possible + " pts" : "";
      const sub = asn.submission || {};
      const score = sub.score != null ? `<div><strong>Score:</strong> ${sub.score}/${asn.points_possible || 0}</div>` : "";
      el.innerHTML = `
        <h5>${BC.util.escapeHtml(asn.name || "Assignment")}</h5>
        <p>${BC.util.escapeHtml(due + points)}</p>
        ${score}
        <p style="margin-top:6px;">${BC.util.escapeHtml(plainText(asn.description).slice(0, 180))}</p>
      `;
    } catch (e) {
      if (seq !== showSeq) return;
      // Was swallowed silently, leaving the card reading "Loading…" forever.
      el.innerHTML = `<h5>Couldn't load</h5><p>Open the assignment to see details.</p>`;
      BC.diag.push("previews", e);
    }
  }

  // Canvas descriptions are HTML. An inert parsed document decodes &nbsp; and
  // &amp; without loading images or running anything.
  function plainText(html) {
    if (!html) return "";
    const body = new DOMParser().parseFromString(html, "text/html").body;
    // Paragraphs and line breaks would otherwise run together: "FirstSecond".
    for (const n of body.querySelectorAll("p, div, li, br, h1, h2, h3, h4, h5, h6, td")) n.after(" ");
    return (body.textContent || "").replace(/\s+/g, " ").trim();
  }

  function positionAt(target, el) {
    const rect = target.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 200, rect.bottom + 6);
    const left = Math.min(window.innerWidth - 360, rect.left);
    el.style.top = Math.max(8, top) + "px";
    el.style.left = Math.max(8, left) + "px";
  }

  function onOver(ev) {
    const a = ev.target.closest && ev.target.closest('a[href*="/assignments/"]');
    if (!a) return;
    const m = a.getAttribute("href").match(/\/courses\/(\d+)\/assignments\/(\d+)/);
    if (!m) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => show(a, m[1], m[2]), 220);
  }

  function onOut(ev) {
    const a = ev.target.closest && ev.target.closest('a[href*="/assignments/"]');
    if (!a) return;
    // mouseout also fires when moving onto a child of the same link (an icon, a
    // <span>), which hid the card and re-fetched it after a flicker.
    if (ev.relatedTarget && a.contains(ev.relatedTarget)) return;
    hide();
  }

  let installed = false;
  function install() {
    if (installed) return;
    installed = true;
    BC.injector.setStyle("bc-preview-css", CSS);
    // Bagged, so teardown removes them even if unmount is never reached. As raw
    // document listeners they survived a disable and kept fetching assignment data
    // while the extension was supposedly off.
    const bag = BC.lifecycle.bag("previews");
    bag.listen(document, "mouseover", onOver);
    bag.listen(document, "mouseout", onOut);
    bag.listen(document, "keydown", (e) => { if (e.key === "Escape") hide(); });
    bag.listen(window, "scroll", hide, { capture: true, passive: true });
  }
  function uninstall() {
    if (!installed) return;
    installed = false;
    BC.lifecycle.bag("previews").clear();
    clearTimeout(hoverTimer);
    BC.injector.setStyle("bc-preview-css", "");
    BC.injector.removeNode("bc-preview");
    previewEl = null;
  }

  function apply(settings) {
    if (settings.previews && settings.previews.hoverAssignmentCards) install();
    else uninstall();
  }

  BC.registry.register({
    id: "previews", styles: ["bc-preview-css"], nodes: ["bc-preview"], apply,
    // `installed` stayed true across a teardown, so after disable/enable install()
    // early-returned and bc-preview-css — which teardown had removed — was never
    // re-injected, leaving an unstyled, effectively invisible hover card.
    unmount() { uninstall(); },
  });
})();
