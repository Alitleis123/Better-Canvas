/*
 * Better Canvas — grades tools.
 * Injects a grade tools panel on /courses/:id/grades: what-if solver,
 * "grade needed on final" calculator, weight donut, grade goal tracker,
 * trend history, missing-assignment warning.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  BC.grades = BC.grades || {};

  BC.grades.gradePoints = function (score, scaleKey) {
    const scale = BC.GPA_SCALES[scaleKey] || BC.GPA_SCALES["standard-4"];
    for (const band of scale.bands) if (score >= band.min) return { points: band.points, letter: band.letter };
    return { points: 0, letter: "F" };
  };

  BC.grades.computeTotal = function (groups) {
    // Weighted (sum of group_weight) or points-based.
    const hasWeights = groups.some((g) => g.group_weight);
    if (hasWeights) {
      let num = 0, denom = 0;
      for (const g of groups) {
        const asns = (g.assignments || []).filter((a) => !a.omit_from_final_grade);
        let pts = 0, poss = 0;
        for (const a of asns) {
          const sub = a.submission;
          if (!sub || sub.score == null) continue;
          pts += sub.score; poss += a.points_possible || 0;
        }
        if (poss > 0) { num += (pts / poss) * (g.group_weight || 0); denom += (g.group_weight || 0); }
      }
      return denom > 0 ? (num / denom) * 100 : null;
    }
    let pts = 0, poss = 0;
    for (const g of groups) for (const a of (g.assignments || [])) {
      if (a.omit_from_final_grade) continue;
      const sub = a.submission;
      if (!sub || sub.score == null) continue;
      pts += sub.score; poss += a.points_possible || 0;
    }
    return poss > 0 ? (pts / poss) * 100 : null;
  };

  const CSS = `
    .bc-grade-tools { margin: 16px 0; }
    .bc-grade-tools h3 { margin: 0 0 10px; font-size: 15px; }
    .bc-gt-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .bc-gt-card { padding: 10px; border-radius: 8px; background: var(--bc-surface-3, #f7fafc); }
    .bc-gt-total { font-size: 24px; font-weight: 800; }
    .bc-gt-label { color: var(--bc-muted, #6b7280); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    .bc-gt-goal { display: flex; align-items: center; gap: 6px; }
    .bc-gt-goal input { padding: 4px; width: 68px; border: 1px solid var(--bc-border, #e5e7eb); border-radius: 4px; background: transparent; color: inherit; }
    .bc-gt-donut { display: flex; align-items: center; gap: 8px; }
    .bc-gt-legend li { list-style: none; font-size: 12px; }
    .bc-gt-legend span { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; }
    .bc-gt-missing { color: var(--bc-danger, #b91c1c); font-size: var(--bc-text-xs, 12px); margin-top: 6px; }
    .bc-gt-final { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
    .bc-gt-final input { padding: 4px; width: 68px; border: 1px solid var(--bc-border, #e5e7eb); border-radius: 4px; background: transparent; color: inherit; }
    .bc-gt-trend { margin-top: 12px; }
    .bc-gt-trend-meta { display: flex; gap: 14px; font-size: 11px; color: var(--bc-muted, #6b7280); margin-top: 2px; }
    .bc-rubric { margin: 0 0 16px; }
    .bc-rubric h3 { margin: 0 0 8px; font-size: 15px; }
    .bc-rubric-crit { margin: 10px 0; }
    .bc-rubric-crit label { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-bottom: 2px; }
    .bc-rubric-crit input[type="range"] { width: 100%; accent-color: var(--bc-accent, #4f46e5); }
    .bc-rubric-total { margin-top: 10px; font-weight: 700; }
    .bc-rubric-impact { font-size: 12px; color: var(--bc-muted, #6b7280); margin-top: 2px; }
  `;

  // No module-level Map. BC.api.assignmentGroups already goes through
  // BC.cache.wrap with a TTL and in-flight de-duplication, so the extra cache was
  // redundant — and by never expiring it was the thing that made the grade panel
  // show stale totals for the whole session after a new grade posted.
  function ensureGroups(courseId) {
    return BC.api.assignmentGroups(courseId);
  }

  const DONUT_R = 26;

  // Pure arc geometry, exported so it can be tested without a DOM.
  //
  // stroke-dashoffset shifts the dash pattern BACKWARD along the path, so a
  // segment drawn with dasharray "<len> <rest>" starts at arc length
  // (circumference - offset). To place segment i at its cumulative position the
  // offset must therefore be `C - cum` and nothing else.
  //
  // The previous `C - dash - cum` also subtracted the segment's own length,
  // which shifted every segment forward by that amount. With equal weights the
  // errors happened to cancel into a rotation, which is why this looked fine;
  // with unequal weights (the normal case for real assignment groups) the
  // segments overlapped and the donut misreported the weighting.
  BC.grades.donutSegments = function (groups) {
    const total = (groups || []).reduce((s, g) => s + (g.group_weight || 0), 0);
    if (total <= 0) return [];
    const C = 2 * Math.PI * DONUT_R;
    const out = [];
    let cum = 0;
    for (const g of groups) {
      const fraction = (g.group_weight || 0) / total;
      const dash = C * fraction;
      out.push({
        name: g.name || "",
        fraction,
        percent: Math.round(fraction * 100),
        dash,
        gap: C - dash,
        offset: C - cum,
      });
      cum += dash;
    }
    return out;
  };

  function donutSVG(groups, hasWeights) {
    // Show weight distribution
    if (!hasWeights) return "";
    const segments = BC.grades.donutSegments(groups);
    if (!segments.length) return "";
    // Categorical ramp from the token set, so the donut re-tints per mode instead of
    // staying at fixed light-mode hues.
    const palette = ["var(--bc-cat-1)","var(--bc-cat-2)","var(--bc-cat-3)","var(--bc-cat-4)",
                     "var(--bc-cat-5)","var(--bc-cat-6)","var(--bc-cat-7)","var(--bc-cat-8)"];
    let arcs = "";
    let items = "";
    segments.forEach((s, i) => {
      const color = palette[i % palette.length];
      arcs += `<circle cx="30" cy="30" r="${DONUT_R}" fill="none" stroke="${color}" stroke-width="8" stroke-dasharray="${s.dash} ${s.gap}" stroke-dashoffset="${s.offset}" transform="rotate(-90 30 30)"/>`;
      items += `<li><span style="background:${color}"></span>${BC.util.escapeHtml(s.name)} · ${s.percent}%</li>`;
    });
    return `<div class="bc-gt-donut"><svg width="60" height="60" role="img" aria-label="Assignment group weights">${arcs}</svg><ul class="bc-gt-legend">${items}</ul></div>`;
  }

  function trendSVG(hist) {
    if (!hist || hist.length < 2) return "";
    const scores = hist.map((h) => h.score);
    const min = Math.min(...scores), max = Math.max(...scores);
    const pad = Math.max((max - min) * 0.15, 0.5);
    const lo = min - pad, hi = max + pad;
    const W = 260, H = 56;
    const pts = scores.map((s, i) => {
      const x = (i / (scores.length - 1)) * (W - 8) + 4;
      const y = H - 6 - ((s - lo) / (hi - lo)) * (H - 12);
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    const delta = scores[scores.length - 1] - scores[0];
    const sign = delta >= 0 ? "+" : "";
    const color = delta >= 0 ? "var(--bc-success)" : "var(--bc-danger)";
    const first = hist[0].date, lastPt = pts.split(" ").pop().split(",");
    return `<div class="bc-gt-trend">
      <div class="bc-gt-label">Grade trend since ${BC.util.escapeHtml(first)}</div>
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grade trend chart">
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="3" fill="${color}"/>
      </svg>
      <div class="bc-gt-trend-meta">
        <span>min ${min.toFixed(1)}%</span>
        <span>max ${max.toFixed(1)}%</span>
        <span style="color:${color}">${sign}${delta.toFixed(1)}%</span>
      </div>
    </div>`;
  }

  function render(courseId, settings) {
    const target = document.querySelector("#grades_summary, #student-grades-right-content, #GradeSummarySelectMenuGroup, #main");
    if (!target) return;
    BC.injector.setStyle("bc-grade-tools", CSS);
    const panel = BC.injector.ensureNode("bc-grade-tools", target.parentNode || target, () => {
      const d = document.createElement("div");
      d.className = "bc-grade-tools bc-panel";
      target.parentNode.insertBefore(d, target);
      return d;
    });
    if (!panel.childElementCount) panel.replaceChildren(BC.ui.skeleton(4));
    ensureGroups(courseId).then((groups) => {
      const total = BC.grades.computeTotal(groups);
      const hasWeights = groups.some((g) => g.group_weight);
      const goal = ((settings.grades.goals || {})[courseId] || {}).target || "";
      const missing = [];
      for (const g of groups) for (const a of (g.assignments || [])) {
        const sub = a.submission;
        if (sub && sub.missing) missing.push(a);
      }

      recordHistory(courseId, total);

      // History plus a virtual point for today (the write above lands async).
      let hist = ((BC.storage.local && BC.storage.local.gradeHistory) || {})[courseId] || [];
      const today = new Date().toISOString().slice(0, 10);
      if (total != null && !hist.some((e) => e.date === today)) {
        hist = hist.concat([{ date: today, score: +total.toFixed(3) }]);
      }

      // Skip the rebuild when nothing changed or while the user is typing in the panel.
      const sig = [courseId, total == null ? "" : total.toFixed(3), goal, missing.length, hist.length,
                   settings.grades.showWeightDonut ? 1 : 0, settings.grades.showMissingWarning ? 1 : 0,
                   settings.grades.showTrendChart ? 1 : 0].join("|");
      const ae = document.activeElement;
      const typing = ae && panel.contains(ae) && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA");
      if (panel.dataset.bcSig === sig || typing) return;
      panel.dataset.bcSig = sig;

      panel.innerHTML = `
        <h3>Grade Tools</h3>
        <div class="bc-gt-row">
          <div class="bc-gt-card">
            <div class="bc-gt-label">Current course grade</div>
            <div class="bc-gt-total">${total != null ? total.toFixed(2) + "%" : "—"}</div>
            <div class="bc-gt-goal">Goal:
              <input type="number" min="0" max="150" step="0.5" value="${goal}" data-goal>
              <span data-goal-status></span>
            </div>
            <div class="bc-gt-final">
              Need on final: <input type="number" placeholder="target %" data-target>
              of weight <input type="number" placeholder="weight %" data-weight>
              <span data-final-needed></span>
            </div>
          </div>
          <div class="bc-gt-card">
            <div class="bc-gt-label">Weights</div>
            ${settings.grades.showWeightDonut ? donutSVG(groups, hasWeights) : ""}
            ${settings.grades.showMissingWarning && missing.length ? `<div class="bc-gt-missing">⚠ ${missing.length} missing assignment${missing.length > 1 ? "s" : ""}</div>` : ""}
          </div>
        </div>
        ${settings.grades.showTrendChart ? trendSVG(hist) : ""}
      `;

      const goalInp = panel.querySelector("[data-goal]");
      const goalStatus = panel.querySelector("[data-goal-status]");
      function refreshGoalStatus() {
        const g = parseFloat(goalInp.value);
        if (!isFinite(g) || total == null) { goalStatus.textContent = ""; return; }
        goalStatus.textContent = total >= g ? "  ✓ on track" : "  ✗ below goal";
        goalStatus.style.color = total >= g ? "var(--bc-success)" : "var(--bc-danger)";
      }
      refreshGoalStatus();
      goalInp.addEventListener("change", () => {
        const g = parseFloat(goalInp.value);
        BC.storage.update((d) => { d.grades.goals[courseId] = { target: isFinite(g) ? g : null, notify: true }; });
        refreshGoalStatus();
      });

      const target2 = panel.querySelector("[data-target]");
      const weight = panel.querySelector("[data-weight]");
      const out = panel.querySelector("[data-final-needed]");
      function compute() {
        const t = parseFloat(target2.value), w = parseFloat(weight.value);
        if (!isFinite(t) || !isFinite(w) || w <= 0 || total == null) { out.textContent = ""; return; }
        // needed = (target - current * (1 - w/100)) / (w/100)
        const wf = w / 100;
        const current = total;
        const needed = (t - current * (1 - wf)) / wf;
        out.textContent = ` = ${needed.toFixed(1)}%`;
      }
      target2.addEventListener("input", compute);
      weight.addEventListener("input", compute);
    }).catch((e) => {
      BC.util.warn("grades", e);
      panel.dataset.bcSig = "";
      panel.replaceChildren(BC.ui.errorState("Couldn't load grade data.", () => render(courseId, settings)));
    });
  }

  // ---- Rubric predictor (assignment pages) ----

  function computeTotalWith(groups, assignmentId, score) {
    const cloned = groups.map((g) => Object.assign({}, g, {
      assignments: (g.assignments || []).map((a) =>
        String(a.id) === String(assignmentId) ? Object.assign({}, a, { submission: { score } }) : a),
    }));
    return BC.grades.computeTotal(cloned);
  }

  // The delegated listener above outlives any single build, so it dispatches
  // through this indirection to whichever rubric is currently mounted.
  let refreshRef = () => {};

  function buildRubricUI(panel, asn, rubric, groups, courseId) {
    const aid = String(asn.id);
    const draft = ((BC.storage.local && BC.storage.local.rubricDrafts) || {})[aid] || {};
    const assessment = asn.rubric_assessment || {};
    const maxTotal = rubric.reduce((s, c) => s + (c.points || 0), 0);

    let rows = "";
    for (const c of rubric) {
      const assessed = assessment[c.id] && assessment[c.id].points;
      const start = draft[c.id] != null ? draft[c.id] : (assessed != null ? assessed : c.points || 0);
      rows += `
        <div class="bc-rubric-crit" data-crit="${BC.util.escapeHtml(String(c.id))}" data-max="${c.points || 0}">
          <label><span>${BC.util.escapeHtml(c.description || "Criterion")}</span>
            <span><b data-val>${start}</b> / ${c.points || 0}</span></label>
          <input type="range" min="0" max="${c.points || 0}" step="0.5" value="${start}">
        </div>`;
    }

    panel.innerHTML = `
      <h3>Rubric predictor</h3>
      ${rows}
      <div class="bc-rubric-total" data-total></div>
      <div class="bc-rubric-impact" data-impact></div>
    `;

    const saveDraft = BC.util.debounce((values) => {
      BC.storage.updateLocal((d) => {
        const rd = (d.rubricDrafts = d.rubricDrafts || {});
        rd[aid] = values;
      });
    }, 500);

    const totalEl = panel.querySelector("[data-total]");
    const impactEl = panel.querySelector("[data-impact]");
    function refresh() {
      const values = {};
      let sum = 0;
      for (const row of panel.querySelectorAll(".bc-rubric-crit")) {
        const v = parseFloat(row.querySelector("input").value) || 0;
        row.querySelector("[data-val]").textContent = v;
        values[row.dataset.crit] = v;
        sum += v;
      }
      const pct = maxTotal > 0 ? (sum / maxTotal) * 100 : 0;
      totalEl.textContent = `Projected: ${sum} / ${maxTotal} (${pct.toFixed(1)}%)`;
      if (groups) {
        const points = asn.points_possible || maxTotal;
        const scaled = maxTotal > 0 ? (sum / maxTotal) * points : 0;
        const current = BC.grades.computeTotal(groups);
        const projected = computeTotalWith(groups, aid, scaled);
        if (projected != null) {
          impactEl.textContent = `Course grade if scored: ${projected.toFixed(2)}%` +
            (current != null ? ` (now ${current.toFixed(2)}%)` : "");
        }
      }
      saveDraft(values);
    }
    // The panel node is reused across SPA navigations (ensureNode returns the
    // existing one), so an unguarded addEventListener stacked a duplicate handler
    // for every assignment visited and ran refresh() once per accumulated listener.
    if (!panel._bcRubricWired) {
      panel._bcRubricWired = true;
      panel.addEventListener("input", (e) => {
        if (e.target && e.target.type === "range") refreshRef();
      });
    }
    refreshRef = refresh;
    refresh();
  }

  function renderRubric(courseId, assignmentId, settings) {
    const host = document.querySelector("#right-side, #assignment_show, #content");
    if (!host) return;
    BC.injector.setStyle("bc-grade-tools", CSS);
    const panel = BC.injector.ensureNode("bc-rubric", host, () => {
      const d = document.createElement("div");
      d.className = "bc-rubric bc-panel";
      host.insertBefore(d, host.firstChild);
      return d;
    });
    if (panel.dataset.bcBuilt === String(assignmentId)) return; // build once; sliders are interactive
    panel.dataset.bcBuilt = String(assignmentId);
    panel.replaceChildren(BC.ui.skeleton(3));
    Promise.all([
      BC.api.assignment(courseId, assignmentId),
      ensureGroups(courseId).catch(() => null),
    ]).then(([asn, groups]) => {
      const rubric = asn && asn.rubric;
      if (!rubric || !rubric.length) { BC.injector.removeNode("bc-rubric"); return; }
      buildRubricUI(panel, asn, rubric, groups, courseId);
    }).catch((e) => {
      BC.util.warn("rubric", e);
      panel.dataset.bcBuilt = "";
      panel.replaceChildren(BC.ui.errorState("Couldn't load the rubric.", () => renderRubric(courseId, assignmentId, settings)));
    });
  }

  // Keyed by course AND day: a Set of course ids alone meant a tab left open across
  // midnight never recorded the new day's score.
  const historyRecorded = new Set();
  // Exported so the background notification scan can record history for EVERY
  // course, not just ones whose grades page happens to get visited. That single
  // caller is what makes the trend chart, dashboard sparklines and the Insights tab
  // actually accumulate data.
  BC.grades.recordScore = function (courseId, total) { recordHistory(String(courseId), total); };
  function recordHistory(courseId, total) {
    const key = courseId + ":" + new Date().toISOString().slice(0, 10);
    if (total == null || historyRecorded.has(key)) return;
    historyRecorded.add(key);
    BC.storage.updateLocal((d) => {
      const gh = (d.gradeHistory = d.gradeHistory || {});
      const arr = gh[courseId] || [];
      const today = new Date().toISOString().slice(0, 10);
      if (!arr.some((e) => e.date === today)) arr.push({ date: today, score: +total.toFixed(3) });
      gh[courseId] = arr.slice(-90);
    });
  }

  function apply(settings, ctx) {
    const m = ctx.page === "assignment" ? ctx.path.match(/\/assignments\/(\d+)/) : null;
    const onAssignment = !!(m && ctx.courseId && settings.grades.rubricPredictor);
    const onGrades = ctx.page === "grades" && !!ctx.courseId &&
      settings.grades.panelEnabled;

    if (!onAssignment) BC.injector.removeNode("bc-rubric");
    if (!onGrades) BC.injector.removeNode("bc-grade-tools");
    if (!onAssignment && !onGrades) { BC.injector.setStyle("bc-grade-tools", ""); return; }

    if (onGrades) render(ctx.courseId, settings);
    if (onAssignment) renderRubric(ctx.courseId, m[1], settings);

    // Auto-refresh was a headline README claim wired to nothing. No page reload
    // needed — invalidate the cached groups and re-render the existing panel.
    // pageBag means the interval dies on SPA navigation for free, and render()
    // already declines to rebuild while the user is typing in the panel.
    if (onGrades && settings.grades.autoRefresh) {
      const bag = BC.lifecycle.pageBag("grades");
      const mins = Math.max(1, settings.grades.autoRefreshMin | 0);
      bag.once("auto:" + mins, () => bag.interval(() => {
        BC.cache.invalidate("LIST " + location.origin + "/api/v1/courses/" + ctx.courseId + "/assignment_groups");
        render(ctx.courseId, BC.storage.current);
      }, mins * 60000));
    }
  }

  BC.registry.register({ id: "grades", styles: ["bc-grade-tools"], nodes: ["bc-grade-tools", "bc-rubric"], apply });
})();
