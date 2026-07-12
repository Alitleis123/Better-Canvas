/*
 * Better Canvas — discussion enhancements.
 * Collapse reply threads, jump to next unread, post/word stats, and
 * instructor-post highlighting on classic discussion topic pages.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-disc-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
    .bc-disc-meta { font-size: 12px; color: var(--bc-muted, #6b7280); }
    .bc-instr-post { border-left: 3px solid var(--bc-accent, #0374b5) !important; padding-left: 8px; }
    .bc-instr-tag {
      display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px;
      background: var(--bc-accent, #0374b5); color: #fff; font-size: 10px; font-weight: 700; vertical-align: middle;
    }
    .bc-flash { outline: 2px solid var(--bc-accent, #0374b5); outline-offset: 2px; }
  `;
  const COLLAPSE_CSS = "#discussion_subentries .discussion-entries .discussion-entries { display: none !important; }";

  let collapsed = false;

  function jumpToUnread() {
    const unread = Array.from(document.querySelectorAll(".discussion_entry.unread, .entry.unread .discussion_entry"));
    if (!unread.length) { BC.toast.info("No unread replies"); return; }
    const y = window.scrollY;
    const next = unread.find((el) => el.getBoundingClientRect().top + window.scrollY > y + 60) || unread[0];
    next.scrollIntoView({ behavior: "smooth", block: "center" });
    next.classList.add("bc-flash");
    setTimeout(() => next.classList.remove("bc-flash"), 1600);
  }

  function stats() {
    const posts = document.querySelectorAll("#discussion_subentries .discussion_entry").length;
    const unread = document.querySelectorAll(".discussion_entry.unread, .entry.unread").length;
    let words = 0;
    document.querySelectorAll("#discussion_subentries .message, #discussion_topic .message").forEach((m) => {
      words += (m.textContent.trim().match(/\S+/g) || []).length;
    });
    return { posts, unread, words };
  }

  async function highlightInstructors(courseId) {
    try {
      const staff = await BC.api.coursePeople(courseId, ["teacher", "ta"]);
      const ids = new Set(staff.map((u) => String(u.id)));
      const sel = "#discussion_subentries .discussion_entry, #discussion_topic.discussion_entry, article#discussion_topic";
      document.querySelectorAll(sel).forEach((entry) => {
        if (entry.dataset.bcInstrChecked) return;
        entry.dataset.bcInstrChecked = "1";
        const a = entry.querySelector("a[href*='/users/']");
        const m = a && (a.getAttribute("href") || "").match(/\/users\/(\d+)/);
        if (!m || !ids.has(m[1])) return;
        entry.classList.add("bc-instr-post");
        if (!entry.querySelector(".bc-instr-tag")) {
          const tag = document.createElement("span");
          tag.className = "bc-instr-tag";
          tag.textContent = "Instructor";
          a.insertAdjacentElement("afterend", tag);
        }
      });
    } catch (_) {}
  }

  function buildBar(bar, d) {
    bar.innerHTML = "";
    if (d.collapse) {
      const btn = document.createElement("button");
      btn.className = "bc-btn";
      btn.textContent = collapsed ? "Expand replies" : "Collapse replies";
      btn.addEventListener("click", () => {
        collapsed = !collapsed;
        BC.injector.setStyle("bc-disc-collapse", collapsed ? COLLAPSE_CSS : "");
        btn.textContent = collapsed ? "Expand replies" : "Collapse replies";
      });
      bar.appendChild(btn);
    }
    if (d.jumpToUnread) {
      const btn = document.createElement("button");
      btn.className = "bc-btn";
      btn.textContent = "Next unread ↓";
      btn.addEventListener("click", jumpToUnread);
      bar.appendChild(btn);
    }
    if (d.wordCount) {
      const meta = document.createElement("span");
      meta.className = "bc-disc-meta";
      bar.appendChild(meta);
    }
  }

  function apply(settings, ctx) {
    const d = settings.discussions || {};
    const anyOn = d.collapse || d.jumpToUnread || d.wordCount || d.instructorHighlight;
    const onTopic = ctx.page === "discussions" && /\/discussion_topics\/\d+/.test(ctx.path);
    if (!anyOn || !onTopic) {
      collapsed = false;
      BC.injector.removeNode("bc-disc-bar");
      BC.injector.setStyle("bc-disc-css", "");
      BC.injector.setStyle("bc-disc-collapse", "");
      return;
    }
    BC.injector.setStyle("bc-disc-css", CSS);

    if (d.collapse || d.jumpToUnread || d.wordCount) {
      const host = document.querySelector("#discussion_container, #content") || document.body;
      const bar = BC.injector.ensureNode("bc-disc-bar", host, () => {
        const div = document.createElement("div");
        div.className = "bc-disc-bar";
        host.prepend(div);
        return div;
      });
      const sig = [!!d.collapse, !!d.jumpToUnread, !!d.wordCount].join(",");
      if (bar.dataset.bcSig !== sig) { bar.dataset.bcSig = sig; buildBar(bar, d); }
      if (d.wordCount) {
        const s = stats();
        const meta = bar.querySelector(".bc-disc-meta");
        if (meta) meta.textContent =
          s.posts + " repl" + (s.posts === 1 ? "y" : "ies") +
          (s.unread ? " · " + s.unread + " unread" : "") +
          " · " + s.words.toLocaleString() + " words";
      }
    } else {
      BC.injector.removeNode("bc-disc-bar");
    }

    if (d.instructorHighlight && ctx.courseId) highlightInstructors(ctx.courseId);
  }

  BC.registry.register({
    id: "discussions",
    styles: ["bc-disc-css", "bc-disc-collapse"],
    nodes: ["bc-disc-bar"],
    apply,
  });
})();
