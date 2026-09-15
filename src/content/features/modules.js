/*
 * Better Canvas — module progress tracking.
 * Per-module progress bars on the modules page plus a course-wide summary,
 * computed from Canvas completion requirements. Read-only.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-mod-bar { display: flex; align-items: center; gap: var(--bc-space-3, 8px); margin: var(--bc-space-2, 6px) var(--bc-space-5, 12px) var(--bc-space-3, 8px); }
    .bc-mod-track { flex: 1; height: 6px; border-radius: 999px; background: var(--bc-surface-3, #e5e7eb); overflow: hidden; }
    .bc-mod-fill { height: 100%; background: var(--bc-accent, #0374b5); border-radius: 999px; transition: width .4s ease; }
    .bc-mod-fill.done { background: var(--bc-success, #047857); }
    .bc-mod-label { font-size: var(--bc-text-xs, 12px); color: var(--bc-muted, #6b7280); white-space: nowrap; }
    .bc-mod-summary {
      display: flex; align-items: center; gap: var(--bc-space-5, 12px);
      margin: var(--bc-space-3, 8px) 0;
      padding: var(--bc-space-4, 10px) var(--bc-space-6, 14px);
      border-radius: var(--bc-radius-lg, 10px); background: var(--bc-surface-2, #f3f4f6);
      border: 1px solid var(--bc-border, #e5e7eb);
      font-size: var(--bc-text-sm, 13px); font-weight: var(--bc-weight-semibold, 600);
    }
    .bc-mod-summary .bc-mod-track { max-width: 260px; }
  `;

  // Read before write throughout: render() runs on every apply tick, and
  // reassigning an identical style or textContent still invalidates style and
  // still registers as a DOM mutation the observer turns into another applyAll.
  function setBar(bar, done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const fill = bar.querySelector(".bc-mod-fill");
    const w = pct + "%";
    if (fill.style.width !== w) fill.style.width = w;
    if (fill.classList.contains("done") !== (pct >= 100)) fill.classList.toggle("done", pct >= 100);
    const label = bar.querySelector(".bc-mod-label");
    const text = done + "/" + total + " · " + pct + "%";
    if (label && label.textContent !== text) label.textContent = text;
    return pct;
  }

  function moduleBar(host) {
    let bar = host.querySelector(".bc-mod-bar");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.className = "bc-mod-bar";
    bar.setAttribute("data-bc-node", "bc-mod-bar");   // declared below so teardown removes it
    bar.innerHTML = '<div class="bc-mod-track"><div class="bc-mod-fill"></div></div><span class="bc-mod-label"></span>';
    const header = host.querySelector(".header, .ig-header");
    if (header) header.insertAdjacentElement("afterend", bar);
    else host.prepend(bar);
    return bar;
  }

  function render(courseId) {
    BC.api.courseModules(courseId).then((mods) => {
      let done = 0, total = 0;
      for (const m of mods) {
        const req = (m.items || []).filter((it) => it.completion_requirement);
        if (!req.length) continue;
        const d = req.filter((it) => it.completion_requirement.completed).length;
        done += d; total += req.length;
        const host = document.getElementById("context_module_" + m.id);
        if (host) setBar(moduleBar(host), d, req.length);
      }
      if (!total) { BC.injector.removeNode("bc-mod-summary"); return; }
      const summary = BC.injector.ensureNode("bc-mod-summary", document.querySelector("#content") || document.body, () => {
        const div = document.createElement("div");
        div.className = "bc-mod-summary";
        div.innerHTML = '<span class="bc-mod-sum"></span><div class="bc-mod-track"><div class="bc-mod-fill"></div></div>';
        (document.querySelector("#content") || document.body).prepend(div);
        return div;
      });
      const pct = total ? Math.round((done / total) * 100) : 0;
      const sumEl = summary.querySelector(".bc-mod-sum");
      const sumText = "Course progress: " + done + "/" + total + " requirements (" + pct + "%)";
      if (sumEl.textContent !== sumText) sumEl.textContent = sumText;
      const fill = summary.querySelector(".bc-mod-fill");
      const w = pct + "%";
      if (fill.style.width !== w) fill.style.width = w;
      if (fill.classList.contains("done") !== (pct >= 100)) fill.classList.toggle("done", pct >= 100);
    }).catch((e) => BC.diag.push("modules", e));
  }

  function apply(settings, ctx) {
    const on = settings.modules && settings.modules.progressBars && ctx.page === "modules" && ctx.courseId;
    if (!on) {
      BC.injector.removeNode("bc-mod-summary");
      BC.injector.setStyle("bc-mod-css", "");
      document.querySelectorAll(".bc-mod-bar").forEach((n) => n.remove());
      return;
    }
    BC.injector.setStyle("bc-mod-css", CSS);
    render(ctx.courseId);
  }

  // bc-mod-bar was injected per module but never declared, so disabling the
  // extension left stale progress bars sitting inside Canvas's module headers.
  BC.registry.register({ id: "modules", pages: ["modules"], styles: ["bc-mod-css"], nodes: ["bc-mod-summary", "bc-mod-bar"], apply });
})();
