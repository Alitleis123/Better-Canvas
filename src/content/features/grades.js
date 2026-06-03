/*
 * Better Canvas — grades feature.
 * On a course grades page: a "Grade Tools" panel with live what-if/hypothetical
 * grades and a "what do I need on the final" calculator. All math uses the
 * user's own Canvas session via the same-origin API — nothing leaves the browser.
 *
 * Shared math (computeTotal, gradePoints) is reused by the options-page GPA tool.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};
  const U = BC.util;

  // --- shared grade math ---------------------------------------------------
  function gradePoints(pct, scaleKey) {
    const scale = BC.GPA_SCALES[scaleKey] || BC.GPA_SCALES["standard-4"];
    for (const row of scale) if (pct >= row.min) return row;
    return scale[scale.length - 1];
  }

  // scoreFn(assignmentId, originalScoreOrNull) -> number|null (the value to use).
  function computeTotal(groups, scoreFn) {
    const weighted = groups.some((g) => Number(g.group_weight) > 0);
    const acc = (a, num, den) => {
      if (a.omit_from_final_grade) return false;
      const pts = Number(a.points_possible);
      if (!(pts > 0)) return false;
      const sub = a.submission || {};
      if (sub.excused) return false;
      const score = scoreFn(a.id, sub.score == null ? null : Number(sub.score));
      if (score == null || isNaN(score)) return false;
      num.v += score;
      den.v += pts;
      return true;
    };
    if (weighted) {
      let wNum = 0,
        wDen = 0;
      for (const g of groups) {
        const num = { v: 0 },
          den = { v: 0 };
        let has = false;
        for (const a of g.assignments || []) if (acc(a, num, den)) has = true;
        if (has && den.v > 0) {
          const w = Number(g.group_weight) || 0;
          wNum += (num.v / den.v) * w;
          wDen += w;
        }
      }
      return wDen > 0 ? (wNum / wDen) * 100 : null;
    }
    const num = { v: 0 },
      den = { v: 0 };
    let has = false;
    for (const g of groups)
      for (const a of g.assignments || []) if (acc(a, num, den)) has = true;
    return has && den.v > 0 ? (num.v / den.v) * 100 : null;
  }

  BC.grades = { gradePoints, computeTotal };

  // --- grades-page panel ---------------------------------------------------
  const groupsCache = new Map(); // courseId -> groups[]
  const overrides = new Map(); // assignmentId -> number (what-if)

  const PANEL_CSS = `
.bc-grade-tools { font-size:13px; margin:12px 0; padding:12px; border:1px solid #c7cdd1;
  border-radius:8px; background:#fff; color:#2d3b45; }
html.bc-dark .bc-grade-tools { background:#161b22; color:#dfe3e8; border-color:#2b313a; }
.bc-grade-tools h3 { margin:0 0 8px; font-size:14px; }
.bc-grade-tools .bc-gt-totals { display:flex; gap:16px; margin-bottom:8px; font-weight:700; }
.bc-grade-tools .bc-gt-list { max-height:260px; overflow:auto; margin:8px 0; }
.bc-grade-tools .bc-gt-row { display:flex; align-items:center; gap:6px; padding:3px 0; }
.bc-grade-tools .bc-gt-row .bc-gt-name { flex:1 1 auto; min-width:0; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.bc-grade-tools .bc-gt-row input { width:56px; padding:2px 4px; }
.bc-grade-tools .bc-gt-grp { font-weight:700; margin-top:8px; opacity:.8; }
.bc-grade-tools .bc-gt-final { margin-top:10px; border-top:1px solid #c7cdd1; padding-top:10px; }
.bc-grade-tools .bc-gt-final input { width:64px; }
.bc-grade-tools .bc-gt-need { font-weight:700; margin-top:6px; }
.bc-grade-tools button { padding:4px 10px; border:1px solid #c7cdd1; border-radius:4px;
  background:#f5f5f5; color:#2d3b45; cursor:pointer; }
`;

  function fmtPct(p) {
    return p == null ? "—" : p.toFixed(2) + "%";
  }

  function renderPanel(panel, courseId, groups) {
    overrides.clear();
    const scoreFn = (id, orig) =>
      overrides.has(id) ? overrides.get(id) : orig;
    const current = computeTotal(groups, (id, orig) => orig);

    const curEl = U.el("span", { text: fmtPct(current) });
    const whatIfEl = U.el("span", { text: fmtPct(current) });

    const list = U.el("div", { class: "bc-gt-list" });
    for (const g of groups) {
      if (!(g.assignments || []).length) continue;
      list.appendChild(
        U.el("div", {
          class: "bc-gt-grp",
          text: g.name + (g.group_weight ? ` (${g.group_weight}%)` : ""),
        })
      );
      for (const a of g.assignments) {
        const sub = a.submission || {};
        const input = U.el("input", {
          type: "number",
          step: "any",
          placeholder: sub.score == null ? "—" : "",
          value: sub.score == null ? "" : String(sub.score),
          dataset: { aid: String(a.id) },
        });
        input.addEventListener("input", () => {
          const v = input.value.trim();
          if (v === "") overrides.delete(a.id);
          else overrides.set(a.id, Number(v));
          whatIfEl.textContent = fmtPct(computeTotal(groups, scoreFn));
        });
        list.appendChild(
          U.el("div", { class: "bc-gt-row" }, [
            U.el("span", { class: "bc-gt-name", text: a.name, title: a.name }),
            input,
            U.el("span", { text: "/ " + (a.points_possible ?? "—") }),
          ])
        );
      }
    }

    const reset = U.el("button", { type: "button", text: "Reset what-if" });
    reset.addEventListener("click", () => {
      overrides.clear();
      list.querySelectorAll("input").forEach((inp) => {
        const orig = inp.getAttribute("value");
        inp.value = orig || "";
      });
      whatIfEl.textContent = fmtPct(current);
    });

    // Final-grade target calculator.
    const curIn = U.el("input", { type: "number", step: "any", value: current == null ? "" : current.toFixed(2) });
    const targetIn = U.el("input", { type: "number", step: "any", value: "90" });
    const weightIn = U.el("input", { type: "number", step: "any", value: "20" });
    const needEl = U.el("div", { class: "bc-gt-need", text: "" });
    const recalcNeed = () => {
      const cur = Number(curIn.value);
      const target = Number(targetIn.value);
      const w = Number(weightIn.value) / 100;
      if (!w || w <= 0 || w > 1 || isNaN(cur) || isNaN(target)) {
        needEl.textContent = "Enter current %, target %, and final weight.";
        return;
      }
      const need = (target - cur * (1 - w)) / w;
      needEl.textContent =
        `You need ${need.toFixed(2)}% on the final` +
        (need > 100 ? " (not reachable with this weight)." : need <= 0 ? " — you've already secured it." : ".");
    };
    [curIn, targetIn, weightIn].forEach((el) => el.addEventListener("input", recalcNeed));
    recalcNeed();

    panel.replaceChildren(
      U.el("h3", { text: "Grade Tools — Better Canvas" }),
      U.el("div", { class: "bc-gt-totals" }, [
        U.el("span", {}, ["Current: ", curEl]),
        U.el("span", {}, ["What-if: ", whatIfEl]),
      ]),
      U.el("div", { text: "Edit any score below to see your hypothetical grade.", style: { opacity: ".75" } }),
      list,
      reset,
      U.el("div", { class: "bc-gt-final" }, [
        U.el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "What do I need on the final?" }),
        U.el("div", { class: "bc-gt-row" }, [U.el("span", { class: "bc-gt-name", text: "Current grade %" }), curIn]),
        U.el("div", { class: "bc-gt-row" }, [U.el("span", { class: "bc-gt-name", text: "Target grade %" }), targetIn]),
        U.el("div", { class: "bc-gt-row" }, [U.el("span", { class: "bc-gt-name", text: "Final weight %" }), weightIn]),
        needEl,
      ])
    );
  }

  function ensurePanel(courseId) {
    const host =
      document.getElementById("right-side") ||
      document.getElementById("content") ||
      document.body;
    const panel = BC.injector.ensureNode("bc-grade-tools", host, () =>
      U.el("div", { class: "bc-grade-tools" }, [U.el("div", { text: "Loading grade tools…" })])
    );
    if (panel.dataset.bcCourse === courseId) return; // already rendered
    panel.dataset.bcCourse = courseId;
    const cached = groupsCache.get(courseId);
    if (cached) return renderPanel(panel, courseId, cached);
    BC.api
      .assignmentGroups(courseId)
      .then((groups) => {
        groupsCache.set(courseId, groups);
        renderPanel(panel, courseId, groups);
      })
      .catch(() => {
        panel.replaceChildren(
          U.el("div", { text: "Could not load grades (are you signed in?)." })
        );
        panel.dataset.bcCourse = ""; // allow retry
      });
  }

  BC.features.grades = {
    id: "grades",

    apply(settings, ctx) {
      if (ctx.page !== "grades" || !settings.grades.whatIfEnabled || !ctx.courseId) {
        BC.injector.removeNode("bc-grade-tools");
        BC.injector.setStyle("bc-grade-tools", "");
        return;
      }
      BC.injector.setStyle("bc-grade-tools", PANEL_CSS);
      U.guard(() => ensurePanel(ctx.courseId), "grade panel");
    },
  };
})();
