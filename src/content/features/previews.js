/* Better Canvas — assignment hover previews. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-preview {
      position: fixed; z-index: 2147481000;
      background: var(--bc-d-bg2, #fff); color: var(--bc-d-text, inherit);
      border: 1px solid var(--bc-d-border, #e5e7eb); border-radius: 10px;
      padding: 10px 12px; box-shadow: 0 10px 30px rgba(0,0,0,.18);
      max-width: 340px; font-size: 13px; opacity: 0; transform: translateY(4px);
      transition: opacity .15s ease, transform .15s ease;
    }
    .bc-preview.show { opacity: 1; transform: translateY(0); }
    .bc-preview h5 { margin: 0 0 4px; font-size: 14px; }
    .bc-preview p { margin: 0; color: var(--bc-d-muted, #6b7280); }
  `;

  let previewEl = null;
  let hoverTimer = null;

  function ensure() {
    if (previewEl && previewEl.isConnected) return previewEl;
    previewEl = document.createElement("div");
    previewEl.className = "bc-preview";
    previewEl.setAttribute("data-bc-node", "bc-preview");
    document.body.appendChild(previewEl);
    return previewEl;
  }

  function hide() {
    if (previewEl) previewEl.classList.remove("show");
    clearTimeout(hoverTimer);
  }

  async function show(a, courseId, id) {
    const el = ensure();
    el.innerHTML = `<h5>Loading…</h5>`;
    positionAt(a, el);
    el.classList.add("show");
    try {
      const asn = await BC.api.assignment(courseId, id);
      const due = asn.due_at ? BC.dt.dueLabel(asn.due_at) : "No due date";
      const points = asn.points_possible != null ? " · " + asn.points_possible + " pts" : "";
      const sub = asn.submission || {};
      const score = sub.score != null ? `<div><strong>Score:</strong> ${sub.score}/${asn.points_possible || 0}</div>` : "";
      el.innerHTML = `
        <h5>${BC.util.escapeHtml(asn.name || "Assignment")}</h5>
        <p>${BC.util.escapeHtml(due + points)}</p>
        ${score}
        <p style="margin-top:6px;">${BC.util.escapeHtml((asn.description || "").replace(/<[^>]+>/g, " ").slice(0, 180) || "")}</p>
      `;
    } catch (_) {}
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
    if (!ev.target.closest || !ev.target.closest('a[href*="/assignments/"]')) return;
    hide();
  }

  let installed = false;
  function install() {
    if (installed) return;
    installed = true;
    BC.injector.setStyle("bc-preview-css", CSS);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
  }
  function uninstall() {
    if (!installed) return;
    installed = false;
    document.removeEventListener("mouseover", onOver);
    document.removeEventListener("mouseout", onOut);
    BC.injector.setStyle("bc-preview-css", "");
    BC.injector.removeNode("bc-preview");
    previewEl = null;
  }

  function apply(settings) {
    if (settings.previews && settings.previews.hoverAssignmentCards) install();
    else uninstall();
  }

  BC.registry.register({ id: "previews", styles: ["bc-preview-css"], nodes: ["bc-preview"], apply });
})();
