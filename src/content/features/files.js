/* Better Canvas — cross-course files library. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-files-head { display: flex; gap: var(--bc-space-3, 8px); align-items: center; margin-bottom: var(--bc-space-3, 8px); }
    .bc-files-head input, .bc-files-head select { padding: var(--bc-space-1, 4px) var(--bc-space-3, 8px); border-radius: var(--bc-radius-md, 6px); border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit; }
    .bc-files-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--bc-space-2, 6px); }
    .bc-file {
      display: grid; grid-template-columns: 24px 1fr auto; gap: var(--bc-space-2, 6px);
      padding: var(--bc-space-2, 6px) var(--bc-space-3, 8px);
      border-radius: var(--bc-radius-md, 6px); background: var(--bc-surface-3, #f7fafc);
    }
    .bc-file a { color: inherit; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* An SVG is not text, so text-align no longer places it; and a token beats
       opacity, which dimmed the drawn icon unevenly against the two surfaces
       this list renders on. */
    .bc-file-ic {
      display: inline-flex; align-items: center; justify-content: center;
      line-height: 0; color: var(--bc-muted, #6b7280);
    }
    .bc-file-star {
      cursor: pointer; background: none; border: 0; padding: 0;
      color: var(--bc-muted, #6b7280); font: inherit; line-height: 0;
      display: inline-flex; align-items: center;
    }
    .bc-file-star:hover { color: var(--bc-text, #1b2430); }
    .bc-file-star.on { color: var(--bc-warn, #a16207); }
    .bc-file-star:focus-visible { outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 2px; }
    .bc-files-list .bc-empty, .bc-files-list .bc-error, .bc-files-list .bc-sk { grid-column: 1 / -1; }
  `;

  const cache = { files: [], loadedAt: 0, failed: 0 };

  async function loadAll() {
    if (Date.now() - cache.loadedAt < 60000 && cache.files.length) return cache.files;
    // Every active enrollment, not just student ones: a teacher has no student
    // enrollment, so the library came back empty for them.
    const courses = await BC.api.activeCourses();
    const active = courses.filter((c) => !c.concluded).slice(0, 20);
    const all = [];
    let failed = 0;
    // Concurrency-limited to 4, and 3 pages per course rather than 20. Previously
    // this was Promise.all over every course at 20 pages each — up to ~400
    // simultaneous requests fired from the dashboard, which trips Canvas's rate
    // limiter and breaks every other feature for minutes.
    await BC.util.mapLimit(active, 4, async (c) => {
      try {
        const files = await BC.api.courseFiles(c.id, 3);
        for (const f of files) all.push({ ...f, courseName: c.name, courseId: c.id });
      } catch (e) {
        failed++;
        BC.diag.push("files:" + c.id, e);   // was swallowed entirely
      }
    });
    cache.files = all; cache.loadedAt = Date.now(); cache.failed = failed;
    return all;
  }

  // Was an emoji table: a page, a picture frame, a clapperboard, a musical note,
  // a memo, a bar chart, a vice and a paperclip. Eight glyphs from four
  // different emoji sets, each rendering in its own colours at its own optical
  // weight, down the left edge of a list whose only other ink was grey text.
  function iconNameFor(f) {
    const ct = (f["content-type"] || f.content_type || "").toLowerCase();
    if (ct.includes("pdf")) return "file-text";
    if (ct.startsWith("image")) return "image";
    if (ct.startsWith("video")) return "video";
    if (ct.startsWith("audio")) return "audio";
    if (ct.includes("word") || ct.includes("doc")) return "file-text";
    if (ct.includes("sheet") || ct.includes("excel") || ct.includes("csv")) return "sheet";
    if (ct.includes("zip") || ct.includes("compressed")) return "archive";
    if (ct.includes("presentation") || ct.includes("powerpoint")) return "image";
    return "paperclip";
  }

  function iconFor(f) { return BC.icons.svg(iconNameFor(f), { size: 14 }); }

  function render(mount, settings) {
    const s = settings.files || {};
    const stars = new Set(s.starred || []);
    mount.innerHTML = `
      <div class="bc-files-head">
        <strong>Files</strong>
        <input placeholder="Search files…" type="search" data-filter>
        <select data-type>
          <option value="">All types</option>
          <option value="pdf">PDF</option>
          <option value="image">Images</option>
          <option value="video">Video</option>
          <option value="doc">Docs</option>
        </select>
        <select data-course><option value="">All courses</option></select>
        <select data-sort>
          <option value="recent">Recent</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
        </select>
        <button class="bc-btn" data-refresh>Refresh</button>
      </div>
      <div class="bc-files-list"></div>
    `;
    const list = mount.querySelector(".bc-files-list");
    const filter = mount.querySelector("[data-filter]");
    const typeSel = mount.querySelector("[data-type]");
    const courseSel = mount.querySelector("[data-course]");
    const sortSel = mount.querySelector("[data-sort]");
    const refresh = mount.querySelector("[data-refresh]");

    function draw(files) {
      const q = filter.value.toLowerCase();
      const type = typeSel.value;
      const course = courseSel.value;
      const sort = sortSel.value;
      let items = files.filter((f) => (f.display_name || "").toLowerCase().includes(q));
      if (type) items = items.filter((f) => {
        const ct = (f["content-type"] || f.content_type || "").toLowerCase();
        if (type === "pdf") return ct.includes("pdf");
        if (type === "image") return ct.startsWith("image");
        if (type === "video") return ct.startsWith("video");
        if (type === "doc") return ct.includes("word") || ct.includes("doc") || ct.includes("openxml");
        return true;
      });
      if (course) items = items.filter((f) => String(f.courseId) === course);
      if (sort === "name") items.sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));
      else if (sort === "size") items.sort((a, b) => (b.size || 0) - (a.size || 0));
      else items.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
      if (!items.length) {
        list.replaceChildren(BC.ui.empty(
          files.length ? "No files match the current filters." : "No files found in your active courses.",
          files.length ? "" : "Files appear here once your courses have published files."
        ));
        return;
      }
      list.innerHTML = items.slice(0, 200).map((f) => `
        <div class="bc-file">
          <span class="bc-file-ic">${iconFor(f)}</span>
          <a href="${BC.util.escapeHtml(f.url || f.html_url || "#")}" target="_blank" rel="noopener" title="${BC.util.escapeHtml(f.courseName || "")}">${BC.util.escapeHtml(f.display_name || "")}</a>
          <button type="button" class="bc-file-star ${stars.has(String(f.id)) ? "on" : ""}" data-id="${BC.util.escapeHtml(f.id)}" aria-pressed="${stars.has(String(f.id)) ? "true" : "false"}" aria-label="Star ${BC.util.escapeHtml(f.display_name || "file")}">${BC.icons.svg(stars.has(String(f.id)) ? "star-filled" : "star", { size: 14 })}</button>
        </div>
      `).join("");
    }

    // Optimistic star toggle, delegated once (list element survives redraws).
    // A real <button> rather than a span with role="button": the span was
    // focusable but Enter and Space did nothing, so the control was unreachable
    // by keyboard.
    list.addEventListener("click", (e) => {
      const star = e.target.closest(".bc-file-star");
      if (!star) return;
      const on = star.classList.toggle("on");
      star.setAttribute("aria-pressed", on ? "true" : "false");
      const id = star.getAttribute("data-id");
      if (on) stars.add(String(id)); else stars.delete(String(id));
      BC.storage.update((d) => {
        const arr = new Set(d.files.starred || []);
        if (arr.has(id)) arr.delete(id); else arr.add(id);
        d.files.starred = Array.from(arr);
      });
    });

    function loadAndDraw() {
      list.replaceChildren(BC.ui.skeleton(4));
      loadAll().then((files) => {
        const courses = new Map();
        for (const f of files) if (f.courseId) courses.set(String(f.courseId), f.courseName || String(f.courseId));
        courseSel.length = 1;
        for (const [id, name] of courses) {
          const o = document.createElement("option"); o.value = id; o.textContent = name;
          courseSel.appendChild(o);
        }
        draw(files);
        [filter, typeSel, courseSel, sortSel].forEach((el) => { el.oninput = () => draw(files); });
      }).catch((e) => {
        BC.util.warn("files", e);
        list.replaceChildren(BC.ui.errorState("Couldn't load files.", () => { cache.loadedAt = 0; loadAndDraw(); }));
      });
    }

    refresh.addEventListener("click", () => { cache.loadedAt = 0; loadAndDraw(); });
    loadAndDraw();
  }

  function apply(settings, ctx) {
    const f = settings.files || {};
    if (!f.enabled || ctx.page !== "dashboard") {
      BC.injector.removeNode("bc-files-panel");
      BC.injector.setStyle("bc-files-css", "");
      return;
    }
    BC.injector.setStyle("bc-files-css", CSS);
    const target = document.querySelector("#dashboard, #DashboardCard_Container");
    if (!target) return;
    const panel = BC.injector.ensureNode("bc-files-panel", target.parentNode || target, () => {
      const d = document.createElement("div");
      d.className = "bc-files-panel bc-panel";
      target.parentNode.insertBefore(d, target);
      return d;
    });
    if (!panel.childElementCount) render(panel, settings);
  }

  BC.registry.register({ id: "files", pages: ["dashboard"], styles: ["bc-files-css"], nodes: ["bc-files-panel"], apply });
})();
