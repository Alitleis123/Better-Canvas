/*
 * Better Canvas — dashboard.
 * Card reorder / rename / recolor / hide / bg-image, layout modes, card sizes,
 * inline grade badge, progress bar, unread badges, hover-preview, auto-hide
 * concluded courses, sidebar widget toggles.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const originalTitles = new WeakMap();
  const originalColors = new WeakMap();
  const appliedBg = new WeakMap();     // last background WE wrote, so we can skip no-op writes
  const appliedImg = new WeakMap();
  let concludedIds = null;
  let concludedFetching = false;

  function maybeFetchConcluded(auto) {
    if (!auto || concludedIds || concludedFetching || !BC.api) return;
    concludedFetching = true;
    BC.api.coursesWithScores().then((list) => {
      concludedIds = new Set(list.filter((c) => c.concluded || (c.enrollments || []).some((e) => e.enrollment_state === "completed")).map((c) => String(c.id)));
    }).catch((e) => BC.diag.push("dashboard:concluded", e)).finally(() => { concludedFetching = false; });
  }

  function widgetsCss(w) {
    const rules = [];
    if (!w.todo)           rules.push(`.Sidebar__TodoListContainer, .ToDoSidebar { display: none !important; }`);
    if (!w.comingUp)       rules.push(`.events_list, .coming_up { display: none !important; }`);
    if (!w.recentFeedback) rules.push(`.recent_feedback { display: none !important; }`);
    return rules.join("\n");
  }

  // The element that actually contains the cards is found at runtime and marked
  // with data-bc-cardgrid, so the layout rules never have to guess a Canvas class
  // name. See markCardGrid.
  //
  // This previously targeted .ic-DashboardCard__box for the container rules while
  // ALSO treating that same class as per-card chrome (border-radius, and the dark
  // background in theming.js). It cannot be both. It is the per-card wrapper, so
  // `display: grid` landed on every individual card -- each became a one-column
  // grid containing itself -- and the real container never got a layout at all,
  // which is why the cards stacked in a single column.
  const GRID = "[data-bc-cardgrid]";

  function layoutCss(d) {
    const size = { s: 200, m: 250, l: 320 }[d.cardSize || "m"] || 250;
    const rad = (d.cardRadius|0) + "px";
    let css = `
      .ic-DashboardCard { border-radius: ${rad} !important; overflow: hidden; }
      .ic-DashboardCard__link, .ic-DashboardCard__box { border-radius: ${rad} !important; }
      ${d.hoverLift ? `.ic-DashboardCard:hover { transform: translateY(-2px); }
      :root[data-bc-motion="0"] .ic-DashboardCard:hover { transform: none; }
      @media (prefers-reduced-motion: reduce) { .ic-DashboardCard:hover { transform: none; } }` : ""}
    `;
    const spanRow = `${GRID} > :not([data-bc-carditem]) { grid-column: 1 / -1 !important; }`;

    // "Quiet instrument": the course colour runs the full height of the card as a
    // spine, not just the header block. Scrolling past the artwork, the spine is
    // what still tells you which course a card is. An inset shadow rather than a
    // border so it costs no layout and survives the card's overflow:hidden.
    //
    // --bc-course is stamped per card in applyCourseIdentity; the fallback keeps
    // the rule harmless on a card whose colour we could not read.
    const spine = `
      .ic-DashboardCard {
        position: relative !important;
        /* Only transform is transitioned. Animating an identity cue in on every
           load is noise rather than craft; the spine is simply there. */
        transition: transform var(--bc-dur-2, 160ms) var(--bc-ease-standard, ease) !important;
      }
      /* A pseudo-element, NOT an inset box-shadow. An inset shadow paints above
         the element's own background but BELOW its children's, and every part of
         a card (artwork, hero, body, action row) paints its own background, so
         the spine was covered everywhere except the few pixels no child reached
         -- it showed as a stub at the bottom-left corner. This sits above the
         children instead. */
      .ic-DashboardCard::before {
        content: "" !important;
        position: absolute !important;
        left: 0 !important; top: 0 !important; bottom: 0 !important;
        width: 3px !important;
        background: var(--bc-course, transparent) !important;
        z-index: 3 !important;
        pointer-events: none !important;
        border-top-left-radius: inherit; border-bottom-left-radius: inherit;
      }
      .ic-DashboardCard:focus-within {
        outline: 2px solid var(--bc-focus-ring, var(--bc-accent)) !important;
        outline-offset: 2px !important;
      }
      /* Typography: a clear three-step hierarchy where Canvas has one. Figures are
         tabular so a column of course codes lines up. */
      .ic-DashboardCard__header-title, .ic-DashboardCard__header-title span {
        font-size: var(--bc-text-lg, 15px) !important;
        font-weight: var(--bc-weight-semibold, 600) !important;
        line-height: var(--bc-leading-tight, 1.25) !important;
      }
      .ic-DashboardCard__header-subtitle {
        font-variant-numeric: tabular-nums !important;
        font-size: var(--bc-text-xs, 12px) !important;
        color: var(--bc-muted) !important;
      }
      .ic-DashboardCard__header-term {
        font-size: var(--bc-text-2xs, 11px) !important;
        color: var(--bc-text-subtle, var(--bc-muted)) !important;
      }
      /* The action row is the one part that should recede. */
      .ic-DashboardCard__action-container {
        background: var(--bc-surface-3) !important;
        border-top: 1px solid var(--bc-border-subtle, var(--bc-border)) !important;
      }`;
    // Canvas gives the card a fixed width, so without this the cards sit
    // left-aligned inside whatever column width the size slider produced, with
    // dead space to the right of each one.
    const fillCell = `${GRID} > [data-bc-carditem] { width: 100% !important; }
      ${GRID} > [data-bc-carditem] .ic-DashboardCard, ${GRID} > .ic-DashboardCard { width: 100% !important; }`;
    if (d.layout === "grid") css += `${GRID} { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(${size}px, 1fr)) !important; gap: 16px !important; align-items: start !important; }
      ${spanRow}
      ${fillCell}
      ${spine}`;
    if (d.layout === "list") css += `${spine}
      ${GRID} { display: flex !important; flex-direction: column !important; gap: var(--bc-space-3, 8px) !important; }
      ${GRID} > * { width: 100% !important; }
      .ic-DashboardCard { display: flex !important; flex-direction: row !important; height: 90px !important; }
      .ic-DashboardCard__header { flex: 0 0 120px !important; }
      .ic-DashboardCard__action-container { display: none !important; }`;
    if (d.layout === "compact") css += `${GRID} { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(${size}px, 1fr)) !important; gap: 12px !important; align-items: start !important; }
      ${spanRow}
      ${fillCell}
      ${spine}
      .ic-DashboardCard { max-height: 120px !important; }
      .ic-DashboardCard__header_image { height: 40px !important; }`;
    if (d.layout === "masonry") css += `${spine}
      ${GRID} { columns: ${Math.max(2, Math.floor(1200/size))} auto !important; column-gap: var(--bc-space-6, 14px) !important; display: block !important; }
      .ic-DashboardCard { break-inside: avoid !important; margin-bottom: var(--bc-space-6, 14px) !important; }`;
    return css;
  }

  // Canvas has changed this container's markup more than once, so derive it from
  // where the cards actually are rather than from a class name. Cards can be
  // wrapped one level deep, so climb to the nearest ancestor that holds all of
  // them. data-bc-cardgrid is not in the observer's attributeFilter, so writing
  // it cannot retrigger applyAll.
  function markCardGrid(cards) {
    if (!cards.length) return null;
    let host = cards[0].parentElement;
    // If the parent holds only this one card it is a wrapper, not the container.
    while (host && host !== document.body && host.childElementCount === 1) host = host.parentElement;
    if (!host || host === document.body || host === document.documentElement) return null;
    for (const el of document.querySelectorAll("[data-bc-cardgrid]")) {
      if (el !== host) el.removeAttribute("data-bc-cardgrid");
    }
    if (!host.hasAttribute("data-bc-cardgrid")) host.setAttribute("data-bc-cardgrid", "");

    // Canvas puts headings ("Published Courses") inside this container too, and
    // making it a grid would drop them into a card slot. Mark the children that
    // actually hold a card so everything else can be told to span the full row.
    // Marking the ITEMS rather than negating a card class is what makes this work
    // whether the cards are direct children or each sits in its own wrapper.
    const items = new Set();
    for (const card of cards) {
      let n = card;
      while (n && n.parentElement !== host) n = n.parentElement;
      if (n) items.add(n);
    }
    for (const child of Array.from(host.children)) {
      const want = items.has(child);
      if (child.hasAttribute("data-bc-carditem") !== want) {
        if (want) child.setAttribute("data-bc-carditem", "");
        else child.removeAttribute("data-bc-carditem");
      }
    }
    return host;
  }

  // The course colour lives in Canvas's own markup: an inline background on the
  // hero block, or the link's background on cards with artwork. Read it once per
  // card and stamp it as a custom property, so the spine and any hover state can
  // reference it from CSS without re-reading computed styles every tick.
  //
  // A per-card stamp rather than a stylesheet because the value is per course,
  // and generating N rules would mean rebuilding the sheet whenever a card
  // re-rendered.
  function applyCourseIdentity(card, spec) {
    // An explicit user override always wins over whatever Canvas painted.
    const chosen = spec && spec.color && BC.color.isHex(spec.color) ? spec.color : null;
    if (chosen) {
      if (card.dataset.bcCourseColour !== chosen) {
        card.style.setProperty("--bc-course", chosen);
        card.dataset.bcCourseColour = chosen;
      }
      return;
    }
    if (card.dataset.bcCourseColour) return;   // already resolved for this card
    // Priority order, not document order. querySelector with a selector list
    // returns whichever matches FIRST in the tree, and Canvas nests the hero
    // inside the image wrapper, so a card with artwork returned the wrapper --
    // which carries a background image and no colour to read.
    const candidates = [];
    for (const sel of [".ic-DashboardCard__header_hero",
                       ".ic-DashboardCard__header_image",
                       ".ic-DashboardCard__link"]) {
      const el = card.querySelector(sel);
      if (el) candidates.push(el);
    }
    candidates.push(card);
    let found = null;
    for (const el of candidates) {
      let bg;
      try { bg = getComputedStyle(el).backgroundColor; } catch (_) { continue; }
      const parsed = BC.color.parseCssColor(bg);
      // Skip transparent, and skip our own dark surfaces: a card whose colour we
      // already repainted would otherwise stamp itself grey.
      if (!parsed || parsed.a < 0.5) continue;
      if (BC.color.chroma(bg) < 12) continue;
      found = BC.color.rgbToHex(parsed.r, parsed.g, parsed.b);
      break;
    }
    if (!found) return;
    card.style.setProperty("--bc-course", found);
    card.dataset.bcCourseColour = found;
  }

  function clearCourseIdentity() {
    for (const el of document.querySelectorAll("[data-bc-course-colour]")) {
      el.style.removeProperty("--bc-course");
      delete el.dataset.bcCourseColour;
    }
  }

  function unmarkCardGrid() {
    for (const el of document.querySelectorAll("[data-bc-cardgrid]")) el.removeAttribute("data-bc-cardgrid");
    for (const el of document.querySelectorAll("[data-bc-carditem]")) el.removeAttribute("data-bc-carditem");
  }

  function overlayCard(card, spec) {
    // spec: { nickname, color, bgImage, hidden }
    const title = card.querySelector(".ic-DashboardCard__link, .ic-DashboardCard__header-title, .ic-DashboardCard__header_hero");
    const link = card.querySelector(".ic-DashboardCard__link");
    if (title) {
      if (!originalTitles.has(card)) originalTitles.set(card, title.textContent);
      // Read before write. Assigning textContent replaces the child text node even
      // when the string is identical; the observer sees a childList mutation whose
      // added node is a bare text node on a Canvas-owned element, treats it as
      // foreign, and schedules another applyAll — forever, on every card. Note the
      // else-branch fires for cards WITHOUT a nickname too, so this looped for
      // everyone with the dashboard feature on.
      const want = (spec.nickname && spec.nickname.trim()) ? spec.nickname : originalTitles.get(card);
      if (want != null && title.textContent !== want) title.textContent = want;
    }
    if (link) {
      if (!originalColors.has(card)) originalColors.set(card, link.style.background || link.style.backgroundColor || "");
      const orig = originalColors.get(card);
      const wantBg = (spec.color && BC.color.isHex(spec.color)) ? spec.color : (orig || null);
      // Compare against what we last wrote — reading style.background back gives a
      // normalized value that never equals the hex we assigned.
      if (wantBg != null && appliedBg.get(link) !== wantBg) { link.style.background = wantBg; appliedBg.set(link, wantBg); }
    }
    if (spec.bgImage && BC.util.isSafeUrl(spec.bgImage)) {
      const header = card.querySelector(".ic-DashboardCard__header_image, .ic-DashboardCard__header");
      if (header && appliedImg.get(header) !== spec.bgImage) {
        header.style.backgroundImage = `url("${BC.util.cssSafe(spec.bgImage)}")`;
        header.style.backgroundSize = "cover";
        header.style.backgroundPosition = "center";
        appliedImg.set(header, spec.bgImage);
      }
    }
    const wantDisplay = spec.hidden ? "none" : "";
    if (card.style.display !== wantDisplay) card.style.display = wantDisplay;
  }

  function overlayInlineGrade(card, courseId, scoresMap) {
    const s = scoresMap.get(String(courseId));
    if (s == null) return;
    let badge = card.querySelector(".bc-inline-grade");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "bc-inline-grade";
      badge.setAttribute("data-bc-node", "bc-inline-grade");
      const link = card.querySelector(".ic-DashboardCard__link");
      if (link) link.appendChild(badge);
      else card.appendChild(badge);
    }
    const text = s.toFixed(1) + "%";
    if (badge.textContent !== text) badge.textContent = text;
    // Tokens, not literals: white on the old #ca8a04 was 2.6:1 and on #65a30d 2.9:1,
    // both failing AA. Each band now carries a matching guaranteed-contrast fg.
    let band = "a";
    if (s < 90) band = "b";
    if (s < 80) band = "c";
    if (s < 70) band = "d";
    if (s < 60) band = "f";
    if (badge.dataset.bcBand !== band) {
      badge.style.background = "var(--bc-grade-" + band + ")";
      badge.style.color = "var(--bc-grade-" + band + "-fg)";
      badge.dataset.bcBand = band;
    }
  }

  function overlayProgress(card, plannerCountByCourse) {
    const cid = BC.util.courseIdFromHref(card.querySelector("a") && card.querySelector("a").getAttribute("href"));
    if (!cid) return;
    const info = plannerCountByCourse.get(cid);
    if (!info) return;
    const pct = info.total ? Math.round((info.done / info.total) * 100) : 0;
    let bar = card.querySelector(".bc-progress");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "bc-progress";
      bar.setAttribute("data-bc-node", "bc-progress");
      bar.innerHTML = `<div class="bc-progress-fill"></div>`;
      card.appendChild(bar);
    }
    const fill = bar.querySelector(".bc-progress-fill");
    const w = pct + "%";
    if (fill.style.width !== w) fill.style.width = w;
  }

  // Previously this read a `badges` Map that nothing ever populated, so it always
  // returned at the first guard — the advertised badges never appeared. Now it shows
  // the one count that's free from data we already fetch: items due in 24 hours.
  function overlayDueBadge(card, courseId) {
    const n = dueSoonByCourse.get(String(courseId)) || 0;
    let strip = card.querySelector(".bc-badges");
    if (!n) { if (strip) strip.remove(); return; }
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "bc-badges";
      strip.setAttribute("data-bc-node", "bc-badges");
      card.appendChild(strip);
    }
    if (strip.dataset.bcN === String(n)) return;   // apply() runs ~5x/sec
    strip.dataset.bcN = String(n);
    const label = n + " item" + (n === 1 ? "" : "s") + " due in the next 24 hours";
    const b = document.createElement("span");
    b.className = "bc-badge due";
    b.innerHTML = BC.icons.svg("clock", { size: 11 }) + '<span class="bc-num">' + n + "</span>";
    b.title = label;
    b.setAttribute("aria-label", label);   // the bare number conveys nothing alone
    strip.replaceChildren(b);
  }

  // Grade trend from locally recorded history. Stamped with the history length so
  // the SVG is rebuilt only when a new point actually lands.
  function overlaySparkline(card, courseId) {
    const hist = ((BC.storage.local && BC.storage.local.gradeHistory) || {})[String(courseId)] || [];
    if (hist.length < 2) return;
    if (card.dataset.bcSpark === String(hist.length)) return;
    card.dataset.bcSpark = String(hist.length);
    const svg = BC.ui.sparkline(hist.map((h) => Number(h.score)).filter((n) => isFinite(n)),
      { width: 96, height: 22, label: "Grade trend for this course" });
    if (!svg) return;
    const existing = card.querySelector(".bc-card-spark");
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.className = "bc-card-spark";
    wrap.setAttribute("data-bc-node", "bc-card-spark");
    wrap.appendChild(svg);
    (card.querySelector(".ic-DashboardCard__link") || card).appendChild(wrap);
  }

  // Built ONCE by the factory and never rewritten by apply() — that's what keeps the
  // caret and the typed value alive across Canvas's own re-renders.
  let query = "";
  function ensureCourseSearch() {
    if (document.querySelector('[data-bc-node="bc-course-search"]')) return;
    const container = document.getElementById("DashboardCard_Container") || document.querySelector(".ic-DashboardCard__box");
    if (!container || !container.parentNode) return;
    const wrap = document.createElement("div");
    wrap.className = "bc-course-search";
    wrap.setAttribute("data-bc-node", "bc-course-search");
    const input = document.createElement("input");
    input.type = "search";
    input.className = "bc-course-search-input";
    input.placeholder = "Filter courses…";
    input.setAttribute("aria-label", "Filter courses");
    input.addEventListener("input", () => {
      query = input.value.trim().toLowerCase();
      if (BC.requestApply) BC.requestApply();
    });
    wrap.appendChild(input);
    container.parentNode.insertBefore(wrap, container);
  }

  // Every input already exists: coursesWithScores() is fetched for inline grades,
  // BC.grades.gradePoints is exported, and creditsByCourse is user-editable.
  function ensureGpaCard(settings) {
    if (!scoresMap.size) return;
    const host = document.querySelector("#right-side") || document.querySelector(".ic-app-main-content__secondary");
    if (!host) return;
    const credits = (settings.grades && settings.grades.creditsByCourse) || {};
    const scale = settings.grades && settings.grades.gpaScale;
    let weighted = 0, hours = 0, plain = 0, count = 0;
    for (const [id, score] of scoresMap) {
      const gp = BC.grades.gradePoints(Number(score), scale);
      plain += gp.points; count++;
      const cr = Number(credits[id]) || 0;
      if (cr > 0) { weighted += gp.points * cr; hours += cr; }
    }
    if (!count) return;
    // Credit-weighted when credits are set, otherwise an unweighted mean so the card
    // is useful without any configuration.
    const gpa = hours > 0 ? weighted / hours : plain / count;
    const sub = hours > 0 ? hours + " credit hours" : count + " courses · unweighted";
    const node = BC.injector.ensureNode("bc-gpa-card", host, () => {
      const el = document.createElement("div");
      el.className = "bc-panel bc-gpa-card";
      host.prepend(el);
      return el;
    });
    const sig = gpa.toFixed(3) + "|" + sub;
    if (node.dataset.bcSig === sig) return;
    node.dataset.bcSig = sig;
    node.replaceChildren(BC.ui.stat({ label: "Estimated GPA", value: gpa.toFixed(2), sub }));
  }

  let scoresMap = new Map();
  let plannerCountByCourse = new Map();
  let dueSoonByCourse = new Map();

  // idle | loading | done | failed. The guard has to be the STATE, not map
  // emptiness: a legitimately empty result — API error, start of term, teacher
  // enrollment, nothing inside the planner window — leaves the map empty
  // forever, so `!map.size` re-fires the load on every apply and spins applyAll
  // at the debounce floor indefinitely. Errors deliberately propagate here
  // instead of being swallowed, so `failed` is reachable.
  const loadState = { scores: "idle", planner: "idle" };

  function ensureLoaded(key, loader) {
    if (loadState[key] !== "idle") return;
    loadState[key] = "loading";
    loader().then(() => {
      loadState[key] = "done";
      if (BC.requestApply) BC.requestApply();
    }).catch((e) => {
      loadState[key] = "failed";
      BC.diag.push("dashboard:" + key, e);
    });
  }

  async function loadInlineGrades() {
    const list = await BC.api.coursesWithScores();
    scoresMap.clear();
    for (const c of list) {
      const enr = (c.enrollments || [])[0] || {};
      const s = enr.computed_current_score != null ? enr.computed_current_score : enr.computed_final_score;
      if (s != null) scoresMap.set(String(c.id), Number(s));
    }
  }

  async function loadPlannerCounts() {
    const start = new Date(); start.setDate(start.getDate() - 30);
    const end = new Date(); end.setDate(end.getDate() + 14);
    const items = await BC.api.plannerItems(start.toISOString(), end.toISOString());
    plannerCountByCourse.clear();
    dueSoonByCourse.clear();
    const now = Date.now();
    for (const it of items) {
      const cid = it.course_id ? String(it.course_id) : (it.context_type === "Course" ? String(it.context_id) : null);
      if (!cid) continue;
      const entry = plannerCountByCourse.get(cid) || { total: 0, done: 0 };
      entry.total++;
      const done = !!((it.planner_override && it.planner_override.marked_complete) ||
                      (it.submissions && it.submissions.submitted));
      if (done) entry.done++;
      plannerCountByCourse.set(cid, entry);

      // Due-in-24h count for the card badge — free from the data we already have.
      const dueISO = it.plannable_date || (it.plannable && it.plannable.due_at);
      if (!done && dueISO) {
        const diff = new Date(dueISO).getTime() - now;
        if (diff > 0 && diff <= 24 * 60 * 60 * 1000) dueSoonByCourse.set(cid, (dueSoonByCourse.get(cid) || 0) + 1);
      }
    }
  }

  function apply(settings, ctx) {
    if (ctx.page !== "dashboard") {
      BC.injector.setStyle("bc-dashboard-ui", "");
      BC.injector.setStyle("bc-dashboard-widgets", "");
      return;
    }
    const d = settings.dashboard || {};
    if (!d.enabled) return;

    // pageBag marks clear on SPA navigation, so this re-arms the loaders exactly
    // once per page visit. The underlying BC.api calls are TTL-cached, so
    // navigating back is a cache hit rather than a refetch.
    BC.lifecycle.pageBag("dashboard").once("loaders", () => {
      loadState.scores = "idle";
      loadState.planner = "idle";
    });

    // widget CSS
    const widgetCss = widgetsCss(d.widgets || {}) + (d.hideSidebar ? "\n#right-side, #right-side-wrapper { display: none !important; }\n#main { margin-right: 0 !important; }" : "");
    BC.injector.setStyle("bc-dashboard-widgets", widgetCss);

    // layout CSS
    BC.injector.setStyle("bc-dashboard-ui", layoutCss(d) + `
      .bc-inline-grade {
        position: absolute; top: 8px; right: 8px; z-index: 2;
        padding: 2px var(--bc-space-3, 8px); border-radius: 999px; font-size: var(--bc-text-2xs, 11px); font-weight: 700;
        /* background + color are set from --bc-grade-* per band in JS */
        box-shadow: var(--bc-shadow-1, 0 1px 4px rgba(0,0,0,.2));
      }
      .bc-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--bc-surface-4, rgba(0,0,0,.1)); }
      .bc-progress-fill {
        height: 100%; background: var(--bc-accent-stroke, var(--bc-accent, #0374b5)); width: 0%;
        transition: width var(--bc-dur-4, 400ms) var(--bc-ease-out, ease);
      }
      .bc-badges { position: absolute; left: 6px; bottom: 6px; display: flex; gap: var(--bc-space-1, 4px); }
      .bc-badge {
        font-size: var(--bc-text-3xs, 10px);
        background: var(--bc-surface-inverse, rgba(0,0,0,.65));
        color: var(--bc-text-inverse, #fff);
        padding: 2px var(--bc-space-2, 6px); border-radius: var(--bc-radius-pill, 999px);
        font-variant-numeric: tabular-nums;
      }
      .bc-badge.due { background: var(--bc-warn, #a16207); color: var(--bc-warn-fg, #fff); }
      .ic-DashboardCard { position: relative; }

      .bc-course-search { margin: 0 0 var(--bc-space-5, 12px); }
      .bc-course-search-input {
        width: min(320px, 100%);
        padding: var(--bc-space-2, 6px) var(--bc-space-4, 10px);
        border: 1px solid var(--bc-border, #e5e7eb);
        border-radius: var(--bc-radius-md, 8px);
        background: var(--bc-surface-2, #fff); color: var(--bc-text, #1b2430);
        font-family: var(--bc-font-sans); font-size: var(--bc-text-sm, 13px);
      }
      .bc-course-search-input:focus-visible {
        outline: 2px solid var(--bc-focus-ring, var(--bc-accent, #4f46e5)); outline-offset: 1px;
      }
      .bc-card-spark {
        position: absolute; left: 8px; bottom: 12px; z-index: 2;
        line-height: 0; pointer-events: none;
      }
      .bc-gpa-card { margin-bottom: var(--bc-space-5, 12px); }
    `);

    // Load whatever any ENABLED consumer needs, not just the one feature that
    // happens to share a name with the loader. The GPA card reads scoresMap and
    // the due badge reads dueSoonByCourse, so gating those loads on
    // showInlineGrade / showProgressBar meant turning on only the GPA card or
    // only the badge left its data source empty forever and the feature simply
    // never appeared.
    //
    // These run BEFORE the card check: none of them need a card to exist. The
    // GPA card mounts into the sidebar, so gating it on cards meant it never
    // appeared on a dashboard rendering no cards at all.
    if (d.showInlineGrade || (d.widgets && d.widgets.gpa)) ensureLoaded("scores", loadInlineGrades);
    if (d.showProgressBar || d.showBadges) ensureLoaded("planner", loadPlannerCounts);
    if (d.widgets && d.widgets.gpa) ensureGpaCard(settings);
    else BC.injector.removeNode("bc-gpa-card");

    // course cards
    if (d.autoHideConcluded) maybeFetchConcluded(true);
    const cards = document.querySelectorAll(".ic-DashboardCard");
    if (!cards.length) { unmarkCardGrid(); return; }
    markCardGrid(Array.from(cards));

    // Build id order + reordering
    const cardsById = new Map();
    for (const card of cards) {
      const a = card.querySelector("a.ic-DashboardCard__link");
      const cid = a && BC.util.courseIdFromHref(a.getAttribute("href"));
      if (cid) cardsById.set(cid, card);
    }

    const order = d.courseOrder || [];
    const ordered = new Set(order);
    let idx = 0;
    const setOrder = (c) => { const o = String(idx++); if (c.style.order !== o) c.style.order = o; };
    for (const id of order) {
      const c = cardsById.get(id);
      if (c) setOrder(c);
    }
    for (const [id, card] of cardsById) if (!ordered.has(id)) setOrder(card);

    if (d.courseSearch) ensureCourseSearch();
    else BC.injector.removeNode("bc-course-search");

    // Apply per-card overrides
    for (const [id, card] of cardsById) {
      const spec = (d.courses && d.courses[id]) || {};
      // The search filter folds into the existing hidden computation, so it's
      // idempotent and survives re-apply with no extra DOM bookkeeping.
      const titleEl = card.querySelector(".ic-DashboardCard__link, .ic-DashboardCard__header-title, .ic-DashboardCard__header_hero");
      const name = ((originalTitles.get(card) || (titleEl && titleEl.textContent) || "") + " " + (spec.nickname || "")).toLowerCase();
      const effHidden = spec.hidden === true
        || (d.autoHideConcluded && concludedIds && concludedIds.has(id))
        || (!!query && name.indexOf(query) === -1);
      applyCourseIdentity(card, spec);
      overlayCard(card, { ...spec, hidden: effHidden });
      if (d.showInlineGrade)   overlayInlineGrade(card, id, scoresMap);
      if (d.showProgressBar)   overlayProgress(card, plannerCountByCourse);
      if (d.showBadges)        overlayDueBadge(card, id);
      if (d.showSparkline)     overlaySparkline(card, id);
    }

    // Ensure grid uses order — apply flex/grid ordering
    const container = document.getElementById("DashboardCard_Container") || document.querySelector(".ic-DashboardCard__box");
    if (container) container.style.display = ""; // let CSS layoutCss govern

  }

  BC.registry.register({
    id: "dashboard", pages: ["dashboard"],
    styles: ["bc-dashboard-widgets", "bc-dashboard-ui"],
    // These were injected per card but declared nowhere, so teardown left every
    // badge, grade pill and progress bar stuck on the Canvas cards.
    nodes: ["bc-inline-grade", "bc-progress", "bc-badges", "bc-card-spark", "bc-course-search", "bc-gpa-card"],
    apply,
    unmount() {
      unmarkCardGrid();
      clearCourseIdentity();
      scoresMap.clear();
      plannerCountByCourse.clear();
      dueSoonByCourse.clear();
      concludedIds = null;
      concludedFetching = false;
      loadState.scores = "idle";
      loadState.planner = "idle";
      query = "";
    },
  });
})();
