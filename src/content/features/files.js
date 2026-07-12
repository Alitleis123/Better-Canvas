/* Better Canvas — cross-course files library. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-files-head { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .bc-files-head input, .bc-files-head select { padding: 4px 8px; border-radius: 6px; border: 1px solid var(--bc-border, #e5e7eb); background: transparent; color: inherit; }
    .bc-files-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
    .bc-file {
      display: grid; grid-template-columns: 24px 1fr auto; gap: 6px;
      padding: 6px 8px; border-radius: 6px; background: var(--bc-surface-3, #f7fafc);
    }
    .bc-file a { color: inherit; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bc-file-ic { text-align: center; opacity: .7; }
    .bc-file-star { cursor: pointer; opacity: .6; }
    .bc-file-star.on { opacity: 1; }
    .bc-files-list .bc-empty, .bc-files-list .bc-error, .bc-files-list .bc-sk { grid-column: 1 / -1; }
  `;

  const cache = { files: [], loadedAt: 0 };

  async function loadAll() {
    if (Date.now() - cache.loadedAt < 60000 && cache.files.length) return cache.files;
    const courses = await BC.api.coursesWithScores();
    const active = courses.filter((c) => !c.concluded).slice(0, 20);
    const all = [];
    await Promise.all(active.map(async (c) => {
      try {
        const files = await BC.api.courseFiles(c.id);
        for (const f of files) all.push({ ...f, courseName: c.name, courseId: c.id });
      } catch (_) {}
    }));
    cache.files = all; cache.loadedAt = Date.now();
    return all;
  }

  function iconFor(f) {
    const ct = (f["content-type"] || f.content_type || "").toLowerCase();
    if (ct.includes("pdf")) return "📄";
    if (ct.startsWith("image")) return "🖼";
    if (ct.startsWith("video")) return "🎬";
    if (ct.startsWith("audio")) return "🎵";
    if (ct.includes("word") || ct.includes("doc")) return "📝";
    if (ct.includes("sheet") || ct.includes("excel")) return "📊";
    if (ct.includes("zip") || ct.includes("compressed")) return "🗜";
    return "📎";
  }

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
          <span class="bc-file-star ${stars.has(String(f.id)) ? "on" : ""}" data-id="${f.id}" title="Star" role="button" tabindex="0">★</span>
        </div>
      `).join("");
    }

    // Optimistic star toggle, delegated once (list element survives redraws).
    list.addEventListener("click", (e) => {
      const star = e.target.closest(".bc-file-star");
      if (!star) return;
      star.classList.toggle("on");
      const id = star.getAttribute("data-id");
      if (star.classList.contains("on")) stars.add(String(id)); else stars.delete(String(id));
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

  BC.registry.register({ id: "files", styles: ["bc-files-css"], nodes: ["bc-files-panel"], apply });
})();
