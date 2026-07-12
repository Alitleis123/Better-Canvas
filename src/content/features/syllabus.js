/*
 * Better Canvas — syllabus quick-extract.
 * Scans the course syllabus for lines containing dates and offers to add the
 * selected ones to the Canvas planner as to-do notes. Nothing is added
 * without an explicit click.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-syl { margin: 10px 0; padding: 12px 14px; border-radius: 10px;
      background: var(--bc-surface-2, #f3f4f6); border: 1px solid var(--bc-border, #e5e7eb); }
    .bc-syl-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-weight: 600; font-size: 14px; }
    .bc-syl-list { margin: 10px 0 0; max-height: 260px; overflow: auto; display: none; }
    .bc-syl.open .bc-syl-list { display: block; }
    .bc-syl-item { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; font-size: 13px;
      border-top: 1px solid var(--bc-border, #e5e7eb); }
    .bc-syl-item:first-child { border-top: 0; }
    .bc-syl-date { color: var(--bc-muted, #6b7280); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .bc-syl-item.added { opacity: .5; }
    .bc-syl-actions { margin-top: 10px; display: none; gap: 8px; }
    .bc-syl.open .bc-syl-actions { display: flex; }
  `;

  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const RE_MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/i;
  const RE_NUM = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
  const RE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/;

  function inferYear(date) {
    // No explicit year: assume this year, roll forward if far in the past.
    if (Date.now() - date.getTime() > 180 * 864e5) date.setFullYear(date.getFullYear() + 1);
    return date;
  }

  function extractDate(text) {
    let m = text.match(RE_ISO);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3], 23, 59);
      return isNaN(d) ? null : d;
    }
    m = text.match(RE_MONTH);
    if (m) {
      const d = new Date(new Date().getFullYear(), MONTHS[m[1].toLowerCase().slice(0, 3)], +m[2], 23, 59);
      if (isNaN(d)) return null;
      if (m[3]) { d.setFullYear(+m[3]); return d; }
      return inferYear(d);
    }
    m = text.match(RE_NUM);
    if (m) {
      const mo = +m[1], day = +m[2];
      if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
      const d = new Date(new Date().getFullYear(), mo - 1, day, 23, 59);
      if (isNaN(d)) return null;
      if (m[3]) { d.setFullYear(+m[3] < 100 ? 2000 + +m[3] : +m[3]); return d; }
      return inferYear(d);
    }
    return null;
  }

  function candidates() {
    const root = document.getElementById("course_syllabus");
    if (!root) return [];
    const out = [];
    const seen = new Set();
    root.querySelectorAll("p, li, td, h1, h2, h3, h4, h5, h6").forEach((el) => {
      if (out.length >= 60) return;
      if (el.querySelector("p, li, td")) return; // only leaf-ish blocks
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 240) return;
      const date = extractDate(text);
      if (!date) return;
      const title = text.length > 90 ? text.slice(0, 87) + "…" : text;
      const key = title + "|" + date.toDateString();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ title, date });
    });
    return out;
  }

  function buildPanel(panel, found, courseId) {
    panel.innerHTML = "";
    const head = document.createElement("div");
    head.className = "bc-syl-head";
    head.innerHTML = "📅 Better Canvas found <b>" + found.length + "</b> date" +
      (found.length === 1 ? "" : "s") + " in this syllabus.";
    const toggle = document.createElement("button");
    toggle.className = "bc-btn";
    toggle.textContent = "Review & add to To Do";
    toggle.addEventListener("click", () => {
      panel.classList.toggle("open");
      toggle.textContent = panel.classList.contains("open") ? "Hide" : "Review & add to To Do";
    });
    head.appendChild(toggle);
    panel.appendChild(head);

    const list = document.createElement("div");
    list.className = "bc-syl-list";
    const rows = found.map((f) => {
      const row = document.createElement("label");
      row.className = "bc-syl-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      const date = document.createElement("span");
      date.className = "bc-syl-date";
      date.textContent = f.date.toLocaleDateString();
      const title = document.createElement("span");
      title.textContent = f.title;
      row.appendChild(cb); row.appendChild(date); row.appendChild(title);
      list.appendChild(row);
      return { row, cb, f };
    });
    panel.appendChild(list);

    const actions = document.createElement("div");
    actions.className = "bc-syl-actions";
    const all = document.createElement("button");
    all.className = "bc-btn";
    all.textContent = "Select all";
    all.addEventListener("click", () => {
      const target = rows.some((r) => !r.cb.checked && !r.cb.disabled);
      rows.forEach((r) => { if (!r.cb.disabled) r.cb.checked = target; });
      all.textContent = target ? "Select none" : "Select all";
    });
    const add = document.createElement("button");
    add.className = "bc-btn";
    add.textContent = "Add selected to To Do";
    add.addEventListener("click", async () => {
      const picked = rows.filter((r) => r.cb.checked && !r.cb.disabled);
      if (!picked.length) { BC.toast.info("Select at least one date first"); return; }
      add.disabled = true;
      let ok = 0;
      for (const r of picked) {
        try {
          await BC.api.createPlannerNote({ title: r.f.title, todoDate: r.f.date.toISOString(), courseId });
          r.row.classList.add("added");
          r.cb.checked = false; r.cb.disabled = true;
          ok++;
        } catch (_) {}
      }
      add.disabled = false;
      if (ok) BC.toast.success("Added " + ok + " task" + (ok === 1 ? "" : "s") + " to your planner");
      else BC.toast.error("Couldn't add tasks");
    });
    actions.appendChild(all); actions.appendChild(add);
    panel.appendChild(actions);
  }

  function apply(settings, ctx) {
    const on = settings.calendar && settings.calendar.syllabusExtract &&
      /\/courses\/\d+\/assignments\/syllabus/.test(ctx.path) && ctx.courseId;
    if (!on) {
      BC.injector.removeNode("bc-syllabus");
      BC.injector.setStyle("bc-syl-css", "");
      return;
    }
    if (!document.getElementById("course_syllabus")) return;
    BC.injector.setStyle("bc-syl-css", CSS);
    const host = document.querySelector("#content") || document.body;
    const panel = BC.injector.ensureNode("bc-syllabus", host, () => {
      const div = document.createElement("div");
      div.className = "bc-syl";
      host.prepend(div);
      return div;
    });
    if (panel.dataset.bcBuilt) return;
    const found = candidates();
    if (!found.length) { BC.injector.removeNode("bc-syllabus"); return; }
    panel.dataset.bcBuilt = "1";
    buildPanel(panel, found, ctx.courseId);
  }

  BC.registry.register({ id: "syllabus", styles: ["bc-syl-css"], nodes: ["bc-syllabus"], apply });
})();
