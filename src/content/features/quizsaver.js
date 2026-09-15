/*
 * Better Canvas — quiz draft saver.
 * Crash protection for classic quizzes: snapshots answer inputs locally while
 * a quiz is being taken, and offers to restore them after a reload or crash.
 * Never answers questions and never submits anything on its own.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-quiz-banner {
      display: flex; align-items: center; gap: var(--bc-space-4, 10px); flex-wrap: wrap;
      margin: var(--bc-space-4, 10px) 0;
      padding: var(--bc-space-4, 10px) var(--bc-space-6, 14px);
      border-radius: var(--bc-radius-lg, 10px);
      background: var(--bc-surface-2, #eef2ff); border: 1px solid var(--bc-border, #e5e7eb);
      font-size: var(--bc-text-md, 14px);
    }
    .bc-quiz-banner .bc-btn { padding: var(--bc-space-1, 4px) var(--bc-space-4, 10px); }
    .bc-quiz-save-dot {
      position: fixed; bottom: 14px; left: 14px; z-index: var(--bc-z-dock, 2147480000);
      padding: var(--bc-space-1, 4px) var(--bc-space-4, 10px); border-radius: 999px; font-size: var(--bc-text-2xs, 11px);
      background: var(--bc-surface-2, #f3f4f6); color: var(--bc-muted, #6b7280);
      border: 1px solid var(--bc-border, #e5e7eb); opacity: 0; transition: opacity .3s ease;
      pointer-events: none;
    }
    .bc-quiz-save-dot.show { opacity: 1; }
  `;

  const MAX_DRAFTS = 10;
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function onTakePage(path) {
    return /^\/courses\/\d+\/quizzes\/\d+\/take/.test(path);
  }

  function draftKey() {
    return location.pathname.replace(/\/$/, "");
  }

  function collectInputs() {
    return Array.from(document.querySelectorAll(
      "#questions input[type=radio], #questions input[type=checkbox], " +
      "#questions input[type=text], #questions input[type=number], " +
      "#questions textarea, #questions select"
    ));
  }

  function inputKey(el, idx) {
    const base = el.name || el.id || "i" + idx;
    return el.type === "radio" || el.type === "checkbox" ? base + ":" + el.value : base;
  }

  function snapshot() {
    const answers = {};
    collectInputs().forEach((el, idx) => {
      const key = inputKey(el, idx);
      if (el.type === "radio" || el.type === "checkbox") {
        if (el.checked) answers[key] = true;
      } else if (el.value) {
        answers[key] = el.value;
      }
    });
    return answers;
  }

  function flashSaved() {
    const dot = document.querySelector('[data-bc-node="bc-quiz-dot"]');
    if (!dot) return;
    dot.classList.add("show");
    setTimeout(() => dot.classList.remove("show"), 1200);
  }

  function saveDraft() {
    if (!onTakePage(location.pathname)) return;
    const answers = snapshot();
    const key = draftKey();
    BC.storage.updateLocal((d) => {
      const q = (d.quizDrafts = d.quizDrafts || {});
      if (!Object.keys(answers).length) { delete q[key]; return; }
      q[key] = { savedAt: Date.now(), answers };
      const keys = Object.keys(q);
      if (keys.length > MAX_DRAFTS) {
        keys.sort((a, b) => ((q[a] && q[a].savedAt) || 0) - ((q[b] && q[b].savedAt) || 0));
        for (const k of keys.slice(0, keys.length - MAX_DRAFTS)) delete q[k];
      }
    });
    flashSaved();
  }

  function deleteDraft(key) {
    BC.storage.updateLocal((d) => {
      if (d.quizDrafts) delete d.quizDrafts[key];
    });
  }

  function diffCount(draft) {
    let n = 0;
    collectInputs().forEach((el, idx) => {
      const v = draft.answers[inputKey(el, idx)];
      if (v === undefined) return;
      if (el.type === "radio" || el.type === "checkbox") { if (!el.checked) n++; }
      else if (el.value !== v) n++;
    });
    return n;
  }

  function restore(draft) {
    let applied = 0;
    collectInputs().forEach((el, idx) => {
      const v = draft.answers[inputKey(el, idx)];
      if (v === undefined) return;
      if (el.type === "radio" || el.type === "checkbox") {
        if (!el.checked) {
          el.checked = true;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          applied++;
        }
      } else if (el.value !== v) {
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        applied++;
      }
    });
    if (applied) BC.toast.success("Restored " + applied + " answer" + (applied === 1 ? "" : "s"));
    else BC.toast.info("Your answers already match the saved draft");
  }

  function ensureBanner(draft) {
    const host = document.querySelector("#content") || document.body;
    const banner = BC.injector.ensureNode("bc-quiz-banner", host, () => {
      const div = document.createElement("div");
      div.className = "bc-quiz-banner";
      host.prepend(div);
      return div;
    });
    if (banner.dataset.bcBuilt) return;
    banner.dataset.bcBuilt = "1";
    const when = new Date(draft.savedAt).toLocaleString();
    const msg = document.createElement("span");
    msg.innerHTML = BC.icons.svg("save", { size: 14 }) +
        " Better Canvas saved a local draft of your answers (<b>" +
      BC.util.escapeHtml(when) + "</b>). Restore them?";
    const yes = document.createElement("button");
    yes.className = "bc-btn"; yes.textContent = "Restore answers";
    yes.addEventListener("click", () => { restore(draft); BC.injector.removeNode("bc-quiz-banner"); });
    const no = document.createElement("button");
    no.className = "bc-btn"; no.textContent = "Discard draft";
    no.addEventListener("click", () => { deleteDraft(draftKey()); BC.injector.removeNode("bc-quiz-banner"); });
    banner.appendChild(msg); banner.appendChild(yes); banner.appendChild(no);
  }

  const debouncedSave = () => {
    if (!debouncedSave._fn) debouncedSave._fn = BC.util.debounce(saveDraft, 800);
    debouncedSave._fn();
  };

  function pruneOld() {
    const q = BC.storage.local && BC.storage.local.quizDrafts;
    if (!q) return;
    const cutoff = Date.now() - MAX_AGE_MS;
    const stale = Object.keys(q).filter((k) => !q[k] || (q[k].savedAt || 0) < cutoff);
    if (stale.length) BC.storage.updateLocal((d) => {
      for (const k of stale) if (d.quizDrafts) delete d.quizDrafts[k];
    });
  }

  function apply(settings, ctx) {
    const enabled = settings.productivity && settings.productivity.quizDraftSaver;
    const active = enabled && onTakePage(ctx.path) && !!document.querySelector("#questions");
    if (!active) {
      BC.injector.removeNode("bc-quiz-banner");
      BC.injector.removeNode("bc-quiz-dot");
      BC.injector.setStyle("bc-quiz-css", "");
      return;
    }
    BC.injector.setStyle("bc-quiz-css", CSS);
    BC.injector.ensureNode("bc-quiz-dot", document.body, () => {
      const dot = document.createElement("div");
      dot.className = "bc-quiz-save-dot";
      dot.textContent = "Draft saved";
      document.body.appendChild(dot);
      return dot;
    });

    const bag = BC.lifecycle.bag("quizsaver");
    bag.once("listeners", () => {
      const inQuestions = (t) => t && t.closest && t.closest("#questions");
      bag.listen(document, "change", (e) => { if (inQuestions(e.target)) debouncedSave(); }, true);
      bag.listen(document, "input", (e) => { if (inQuestions(e.target)) debouncedSave(); }, true);
      // Submitting the quiz makes the draft obsolete.
      bag.listen(document, "click", (e) => {
        if (e.target && e.target.closest && e.target.closest("#submit_quiz_button")) deleteDraft(draftKey());
      }, true);
    });

    // Once per page visit, not once per apply tick (which is several a second).
    bag.once("prune", pruneOld);
    const draft = BC.storage.local && BC.storage.local.quizDrafts && BC.storage.local.quizDrafts[draftKey()];
    if (draft && draft.answers && diffCount(draft) > 0) ensureBanner(draft);
  }

  BC.registry.register({
    id: "quizsaver", pages: ["course"],
    styles: ["bc-quiz-css"],
    nodes: ["bc-quiz-banner", "bc-quiz-dot"],
    apply,
  });
})();
