/*
 * Better Canvas — the dashboard, rendered by us.
 *
 * WHY THIS EXISTS
 *
 * Every earlier version of the dashboard was a pile of `!important` overrides
 * aimed at Canvas's own card markup. That approach cannot be made reliable, and
 * the reason is not craft: Canvas has shipped the card link both INSIDE
 * .ic-DashboardCard__header and beside it, so a rule that lines the metadata up
 * on one Canvas version silently does nothing on the other. Two rounds of fixes
 * measured perfectly against the replica in test/browser and both landed wrong
 * on a real dashboard — once as a 51px row gap where 16 was asked for, once as a
 * card that read as a box inside a box.
 *
 * So we stop overriding and render the cards ourselves. Canvas already hands us
 * exactly the data its own cards are built from, at
 * /api/v1/dashboard/dashboard_cards: name, course code, term, colour, image,
 * href, and the quick links with their counts. With our own markup there is no
 * cascade to fight, no markup to guess at, and the layout is the same layout on
 * every Canvas version and every monitor.
 *
 * Canvas's grid is hidden rather than removed: if the fetch fails we put it back
 * and the dashboard is exactly what it was.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const NODE = "bc-dashgrid";
  const STYLE = "bc-dashgrid";

  // Canvas's own container. This is the ONE Canvas selector this feature needs,
  // and it is an id rather than a generated class name, which is why it is the
  // one piece of their markup worth depending on.
  const CANVAS_GRID = "#DashboardCard_Container";

  let cards = null;            // the dashboard_cards payload
  let custom = null;           // /users/self/colors -> { course_123: "#hex" }
  let state = "idle";          // idle | loading | done | failed
  let fails = 0;               // consecutive fetch failures, for the retry
  const colours = new Map();   // course id -> the colour we actually painted

  // The planner widget renders beside these cards and had no idea what colour
  // any course was, so the two halves of the dashboard looked like two products.
  // This is the resolved colour -- a user override, then Canvas's, then our
  // deterministic fallback -- so a course is the same colour in both places,
  // including the ones Canvas has no colour for at all.
  // The card width table and the cap arithmetic, in ONE place. The page chrome
  // around the grid -- the header bar, the content column's measure -- has to end
  // exactly where the cards end, and it used to compute that from its own copy of
  // the numbers. They agreed at the medium size and disagreed at the other two,
  // so a small or large card left the header running wider than the grid under it.
  // 250 for medium is not a taste call, it is the number that makes the cap
  // reachable. The cap is maxColumns cards wide, and a layout is only identical
  // across monitors for windows at least that wide -- so it has to clear the
  // SMALLEST target. A 15" MacBook at 1710 CSS px leaves about 1357px of content
  // column once Canvas's nav and sidebar are out; at 260 the five-column cap is
  // 1364 and that machine falls to four columns while a 24" gets five. At 250 the
  // cap is 1314, all three clear it, and all three render five columns of 250.
  const CARD_W = { s: 210, m: 250, l: 300 };
  // The list layout's art is a fixed strip at every card size. Both the flex
  // basis that sizes it and the monogram that has to fit inside it read this,
  // because when they were two literals the monogram outgrew the strip.
  const LIST_ART = 132;
  const GAP = 16;
  function metrics(d) {
    const w = CARD_W[(d && d.cardSize) || "m"] || CARD_W.m;
    const cols = Math.max(0, Math.min(12, d && d.maxColumns == null ? 5 : (d.maxColumns | 0)));
    return { w, gutter: GAP, cols, cap: cols > 0 ? cols * w + (cols - 1) * GAP : 0 };
  }

  BC.dashgrid = {
    colourFor: (id) => colours.get(String(id)) || null,
    metrics,
    // How many courses we actually have. The measure is capped at maxColumns,
    // but a five-column measure around four courses leaves the fifth track
    // empty, so the cap has to know the count as well as the width.
    get count() { return cards ? cards.length : 0; },
  };

  // ---- data ---------------------------------------------------------------

  function load() {
    if (state !== "idle") return;
    state = "loading";
    // The colours are fetched ALONGSIDE the cards, not after them, and failing to
    // get them is not failing to render: a dashboard with fallback colours beats
    // no dashboard.
    Promise.all([
      BC.api.dashboardCards(),
      BC.api.customColors().catch((e) => { BC.diag.push("dashgrid:colors", e); return null; }),
    ]).then(([list, cc]) => {
      cards = Array.isArray(list) ? list : [];
      custom = (cc && cc.custom_colors) || null;
      state = "done";
      if (BC.requestApply) BC.requestApply();
    }).catch((e) => {
      state = "failed";
      fails++;
      BC.diag.push("dashgrid:load", e);
      // One dropped request should not cost somebody their dashboard until they
      // reload the tab. "failed" latched forever, so a single timeout on a slow
      // connection -- or a request that went out before the session was ready --
      // meant Canvas's own cards for the rest of the visit with no way back.
      // Back off, then try again; after three it stays down and the fallback
      // dashboard is the answer.
      if (fails <= 3) {
        setTimeout(() => {
          if (state !== "failed") return;
          state = "idle";
          if (BC.requestApply) BC.requestApply();
        }, 1000 * fails);
      }
      if (BC.requestApply) BC.requestApply();
    });
  }

  // ---- art ----------------------------------------------------------------

  // A course with no image and no colour is the single worst thing on the real
  // dashboard: it renders as a black slab with no identity at all, and a screen
  // of them is indistinguishable. Rather than paint nothing, derive a pattern
  // from the course id so the card is at least consistently, recognisably ITS
  // OWN — the same course gets the same art on every machine and every reload,
  // because the only input is the id.
  const ART_KINDS = ["lattice", "waves", "sprigs", "dots", "grid", "scallop",
                     "polka", "checks", "stripes", "confetti"];

  // Eight courses is already an unusual load, so eight hues is enough for every
  // card on a realistic dashboard to differ from every other.
  const FALLBACK = ["#4f6d9a", "#5b7f6b", "#8a6a9c", "#9c6b52",
                    "#4d7f8a", "#8a5f6d", "#6b7a4a", "#6a6f8c"];

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  }

  // The subject code, for the monogram: the letters a course code opens with,
  // before the numbers. "SOCL3441.38190.202630" -> SOCL, "CS3100.MERGED" -> CS.
  // Falls back to the initials of the name, so there is always something.
  function monogram(card) {
    const code = String(card.courseCode || "").trim();
    const m = code.match(/^[A-Za-z]{2,5}/);
    if (m) return m[0].toUpperCase();
    const words = String(card.shortName || card.originalName || "")
      .split(/[\s\-_]+/).filter(Boolean).slice(0, 3);
    return words.map((x) => x[0]).join("").toUpperCase() || "\u00b7";
  }

  function artStyle(card, colour, dark) {
    if (card.image && BC.util.isSafeUrl(card.image)) {
      return 'background-image: url("' + BC.util.cssSafe(card.image) + '");' +
             "background-size: cover; background-position: center;";
    }
    // A GRADIENT and a monogram, not a repeating pattern.
    //
    // The pattern engine is the skins feature's, and it is right for wallpapering
    // a whole page at low contrast. On a 250x140 card face it is not a texture,
    // it is the subject: eight cards of gingham and polka dots next to four cards
    // carrying real course artwork made the artwork look like the exception and
    // the rest look like placeholder swatches. Photographed on a real dashboard,
    // that is the single thing that read as cheap.
    //
    // A soft gradient in the course's own colour sits underneath its monogram
    // instead. It is calm next to a photograph, it is unmistakably that course's
    // colour, and the monogram gives the card something to be recognised by at a
    // glance -- which is what the pattern was reaching for.
    const h = hash(String(card.id || card.assetString || card.shortName || ""));
    const lum = BC.color.relLuminance(colour);
    // Lift the top-left and drop the bottom-right, always in the card's own hue.
    const a = lum < 0.5 ? BC.color.lighten(colour, 0.16) : BC.color.lighten(colour, 0.10);
    const b = lum < 0.5 ? BC.color.darken(colour, 0.14) : BC.color.darken(colour, 0.08);
    // Four angles, chosen by id, so a wall of cards is not four identical ramps
    // -- deterministic, so a card never changes on reload.
    const angle = [135, 120, 160, 200][h % 4];
    return "background-image: linear-gradient(" + angle + "deg, " + a + " 0%, " +
           colour + " 52%, " + b + " 100%);";
  }

  // Canvas hands back the colour it shows in its own colour picker. A course
  // that has never been given one comes back null, and on a dark theme the
  // fallback must not be the theme's own surface or the card loses its edge.
  function courseColour(card, spec, dark) {
    if (spec && spec.color && BC.color.isHex(spec.color)) return spec.color;
    // Canvas's own colour picker, first: it is the one place the user's choice is
    // definitely recorded, and it is keyed by asset string ("course_123").
    if (custom) {
      const cc = custom[card.assetString || ("course_" + card.id)];
      if (cc && BC.color.isHex(cc)) return BC.color.normalizeHex(cc);
    }
    // Then whatever the card itself carries. Three spellings, because this field
    // has moved between Canvas versions and reading only one of them is how every
    // course on a real dashboard ended up painted with our fallback instead of
    // the colour its owner actually chose -- a purple course came out brown.
    const c = card.backgroundColor || card.background_color || card.color;
    if (c && BC.color.isHex(c)) return BC.color.normalizeHex(c);
    // Deterministic, and picked from a fixed set rather than computed, so every
    // fallback colour is one somebody chose: evenly spaced around the wheel,
    // mid-chroma, and all within a stop of each other in luminance so no card
    // shouts louder than its neighbour. A hue computed from a hash lands on
    // muddy olives and acid greens about a third of the time.
    return FALLBACK[hash(String(card.id || "")) % FALLBACK.length];
  }

  // ---- one card -----------------------------------------------------------

  // Canvas's dashboard_cards payload is camelCase at the top level (shortName,
  // courseCode, backgroundColor) but its `links` array is SNAKE_CASE. Reading
  // only `cssClass` meant every link resolved to undefined and fell through to
  // the default glyph, so every card's footer was the same document icon
  // repeated two to four times -- the quick links were decoration. The fixture
  // used cssClass too, which is why the harness agreed.
  //
  // Both spellings, then the `icon` field (icon-announcement, icon-assignment),
  // then the path itself, because a link that cannot be identified is worse than
  // useless: it looks like the one next to it.
  function linkKind(l) {
    const raw = l.css_class || l.cssClass || "";
    if (raw) return String(raw).toLowerCase();
    const icon = String(l.icon || "").replace(/^icon-/, "").toLowerCase();
    if (icon) return ICON_ALIAS[icon] || icon;
    const m = /\/(announcements|assignments|discussion_topics|files|quizzes|grades|users|syllabus|modules|pages)\b/
      .exec(String(l.path || ""));
    return m ? (ICON_ALIAS[m[1]] || m[1]) : "";
  }

  // Canvas's icon names are singular and its paths are not always the same word
  // as the section.
  const ICON_ALIAS = {
    announcement: "announcements",
    assignment: "assignments",
    discussion: "discussions",
    discussion_topics: "discussions",
    document: "files",
    folder: "files",
    quiz: "quizzes",
    users: "people",
    user: "people",
    gradebook: "grades",
  };

  const LINK_ICON = {
    announcements: "megaphone",
    assignments: "checklist",
    discussions: "bell",
    files: "folder",
    quizzes: "check",
    syllabus: "file",
    grades: "trend",
    people: "star",
    modules: "columns",
    pages: "file",
  };

  // Canvas's own card carried a kebab: colour, rename, unfavourite. Replacing
  // its cards with ours took that away and left the settings drawer as the only
  // way to recolour or rename a course -- which is a long walk for something you
  // are looking straight at. The menu writes the SAME per-course overrides the
  // drawer's course editor writes, so the two are one setting seen twice.
  const SWATCHES = ["#b4341f", "#c2703a", "#a98407", "#4f7a3a", "#2f7d6b",
                    "#2f6a9a", "#4f5bb8", "#7a4f9e", "#a8447a", "#5c6675"];

  let openMenu = null;
  function closeMenu() {
    if (openMenu) { openMenu.remove(); openMenu = null; }
  }
  // One document listener for the lifetime of the feature, not one per card.
  if (typeof document !== "undefined" && !BC.__dashgridMenuWired) {
    BC.__dashgridMenuWired = true;
    document.addEventListener("mousedown", (e) => {
      if (openMenu && !openMenu.contains(e.target) && !e.target.closest(".bc-dc-kebab")) closeMenu();
    }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  }

  function write(id, patch) {
    BC.storage.update((d) => {
      d.dashboard.courses = d.dashboard.courses || {};
      const cur = Object.assign({}, d.dashboard.courses[String(id)] || {});
      for (const k of Object.keys(patch)) {
        if (patch[k] === null) delete cur[k];
        else cur[k] = patch[k];
      }
      d.dashboard.courses[String(id)] = cur;
    });
  }

  function buildMenu(card, spec, anchor) {
    const el = BC.ui.el;
    const id = String(card.id);
    const menu = el("div", { class: "bc-dc-menu", role: "dialog", "aria-label": "Course options" });

    const swatches = el("div", { class: "bc-dc-sw" });
    for (const c of SWATCHES) {
      const b = el("button", { type: "button", class: "bc-dc-swatch", "aria-label": "Set colour " + c });
      b.style.background = c;
      if ((spec.color || "").toLowerCase() === c) b.setAttribute("aria-current", "true");
      b.addEventListener("click", () => { write(id, { color: c }); closeMenu(); });
      swatches.appendChild(b);
    }
    menu.appendChild(el("p", { class: "bc-dc-mh", text: "Colour" }));
    menu.appendChild(swatches);

    menu.appendChild(el("p", { class: "bc-dc-mh", text: "Name" }));
    const name = el("input", { class: "bc-dc-mi", type: "text",
      placeholder: card.originalName || card.shortName || "Course name",
      "aria-label": "Rename this course" });
    name.value = spec.nickname || "";
    // Commit on Enter or on blur, not per keystroke: every write re-renders the
    // grid, which would take the field out from under the caret mid-word.
    const commit = () => write(id, { nickname: name.value.trim() || null });
    name.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); closeMenu(); }
    });
    name.addEventListener("blur", commit);
    menu.appendChild(name);

    const row = el("div", { class: "bc-dc-mr" });
    const reset = el("button", { type: "button", class: "bc-dc-mb", text: "Reset" });
    reset.addEventListener("click", () => { write(id, { color: null, nickname: null }); closeMenu(); });
    const hide = el("button", { type: "button", class: "bc-dc-mb", text: "Hide card" });
    hide.addEventListener("click", () => { write(id, { hidden: true }); closeMenu(); });
    row.appendChild(reset);
    row.appendChild(hide);
    menu.appendChild(row);

    anchor.appendChild(menu);
    const f = menu.querySelector(".bc-dc-swatch");
    if (f) BC.util.guard(() => f.focus(), "dashgrid menu focus");
    return menu;
  }

  function buildCard(card, opts) {
    const el = BC.ui.el;
    const spec = opts.overrides[String(card.id)] || {};
    const colour = courseColour(card, spec, opts.dark);
    const name = (spec.nickname && spec.nickname.trim()) || card.shortName || card.originalName || "Course";
    const href = card.href || ("/courses/" + card.id);

    const art = el("div", { class: "bc-dc-art" });
    art.setAttribute("style", artStyle(card, colour, opts.dark));
    art.setAttribute("aria-hidden", "true");

    // The scrim exists to keep the chip legible on arbitrary artwork. With no
    // chip there is nothing to protect, and a gradient over a flat pattern just
    // reads as a smudge across the top of every card, so it is not emitted.
    const arts = [art];
    // Only when there is no photograph to speak for the course. Over real
    // artwork it would be graffiti.
    if (!(card.image && BC.util.isSafeUrl(card.image))) {
      arts.push(el("span", { class: "bc-dc-mono", "aria-hidden": "true", text: monogram(card) }));
    }
    const wantsChip = (opts.showGrade && opts.grades.get(String(card.id)) != null) ||
                      (opts.showBadges && opts.due.get(String(card.id))) ||
                      (opts.showSparkline && (opts.history[String(card.id)] || []).length >= 2);
    if (wantsChip) arts.push(el("div", { class: "bc-dc-scrim", "aria-hidden": "true" }));

    // The grade and the due-count ride ON the art, where there is always room,
    // rather than in the body where they would compete with the title for the
    // two lines it needs.
    const grade = opts.grades.get(String(card.id));
    if (opts.showGrade && grade != null) {
      arts.push(el("span", { class: "bc-dc-chip bc-num", text: Math.round(grade) + "%" }));
    }
    const due = opts.due.get(String(card.id));
    if (opts.showBadges && due) {
      arts.push(el("span", { class: "bc-dc-due bc-num", text: String(due) },
        [document.createTextNode("")]));
      arts[arts.length - 1].textContent = due + " due";
    }

    const body = el("div", { class: "bc-dc-body" }, [
      el("p", { class: "bc-dc-code bc-num", text: card.courseCode || card.subtitle || "" }),
      // The stretched link. The anchor covers the whole card through ::after, so
      // the card is one target, but the quick links below sit above it on z and
      // stay individually clickable. Nesting them inside the anchor instead
      // would be invalid HTML and would make every icon open the course.
      el("h3", { class: "bc-dc-title" }, [
        el("a", { class: "bc-dc-a", href, text: name }),
      ]),
    ]);
    if (card.term && card.term.name && !/^default/i.test(card.term.name)) {
      body.appendChild(el("p", { class: "bc-dc-term", text: card.term.name }));
    }

    const kids = [el("div", { class: "bc-dc-artwrap" }, arts), body];

    // The grade trend. The Canvas-card path drew this from the same local
    // history and our renderer did not, so "Grade trend sparkline" sat in the
    // settings panel doing nothing at all once we owned the cards. It rides on
    // the art, beside the grade chip it explains, rather than in the body where
    // it would push the title.
    if (opts.showSparkline) {
      const hist = (opts.history[String(card.id)] || [])
        .map((h) => Number(h && h.score)).filter((n) => isFinite(n));
      if (hist.length >= 2 && BC.ui.sparkline) {
        const svg = BC.ui.sparkline(hist, { width: 76, height: 20, label: "Grade trend for " + name });
        if (svg) {
          const sp = el("span", { class: "bc-dc-spark", "aria-hidden": "true" }, [svg]);
          arts.push(sp);
        }
      }
    }

    if (opts.showProgress) {
      const p = opts.progress.get(String(card.id));
      if (p && p.total) {
        const pct = Math.round((p.done / p.total) * 100);
        const bar = el("div", { class: "bc-dc-bar" }, [el("i", { style: "width:" + pct + "%" })]);
        bar.setAttribute("role", "img");
        bar.setAttribute("aria-label", p.done + " of " + p.total + " done");
        body.appendChild(bar);
      } else {
        // A course with nothing in the planner window still reserves the slot.
        // The term is pinned to the bottom of the body, so a card missing its
        // bar drops its term a row below every neighbour's -- the same defect
        // the missing footer caused, from the same cause.
        //
        // Hidden rather than drawn at 0%: an empty track reads as "none of it is
        // done", which is a different and wrong statement about a course that
        // simply has nothing due.
        const ph = el("div", { class: "bc-dc-bar is-empty", "aria-hidden": "true" });
        body.appendChild(ph);
      }
    }

    // The footer is rendered even when a course has no quick links. The term is
    // pinned to the bottom of the body so it lines up across a row, which means
    // a card missing its footer has a taller body and drops its term ~40px below
    // everyone else's -- one card out of nine was enough to make a row look
    // ragged. An empty strip costs nothing and keeps the baseline.
    const links = (card.links || []).filter((l) => l && !l.hidden && l.path);
    {
      const nav = el("nav", { class: "bc-dc-links", "aria-label": name + " quick links" });
      if (!links.length) nav.classList.add("is-empty");
      for (const l of links.slice(0, 5)) {
        const kind = linkKind(l);
        // The label is what a screen reader reads and what the tooltip shows, so
        // it falls back to the resolved kind rather than to an empty string.
        const label = l.label || (kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Open");
        const a = el("a", { class: "bc-dc-ln", href: l.path, title: label });
        a.setAttribute("aria-label", label + " — " + name);
        a.appendChild(BC.icons.el(LINK_ICON[kind] || "file"));
        if (l.icon && /unread|new/i.test(String(l.icon))) a.classList.add("is-new");
        nav.appendChild(a);
      }
      kids.push(nav);
    }

    const root = el("article", { class: "bc-dc", "data-bc-course": String(card.id) }, kids);

    const kebab = el("button", { type: "button", class: "bc-dc-kebab",
      "aria-label": "Options for " + name, "aria-haspopup": "dialog" });
    kebab.appendChild(BC.icons.el("more"));
    kebab.addEventListener("click", (e) => {
      // The card is one big stretched link; without this the menu opens the
      // course instead.
      e.preventDefault(); e.stopPropagation();
      const wasMine = openMenu && openMenu.parentElement === root;
      closeMenu();
      if (!wasMine) openMenu = buildMenu(card, spec, root);
    });
    root.appendChild(kebab);

    colours.set(String(card.id), colour);
    root.style.setProperty("--dc-c", colour);
    // Ink that is guaranteed legible on this course's colour, for the chip and
    // anything else that sits directly on the art.
    root.style.setProperty("--dc-ink", BC.color.contrastText(colour));
    // White on a dark course colour, black on a light one, both at low alpha.
    // A single fixed white would vanish on a pale course and a single black
    // would look like a smudge on a dark one.
    root.style.setProperty("--dc-mono",
      BC.color.relLuminance(colour) < 0.5 ? "rgba(255,255,255,.20)" : "rgba(0,0,0,.16)");
    return root;
  }

  // ---- the sheet ----------------------------------------------------------

  function sheet(d) {
    const { w, gutter: gap, cap } = metrics(d);
    const rad = (d.cardRadius | 0);

    // THE LAYOUT, and the reason a 15", a 24" and a 27" now agree.
    //
    // Tracks are minmax(w, 1fr) and the CONTAINER is capped at exactly the width
    // maxColumns cards need. Above the cap you get maxColumns identical columns
    // on every monitor; below it the count drops and the cards flex, but only
    // ever between w and the next breakpoint, which is a band of a few dozen
    // pixels rather than the 250-to-301 swing the old fixed-track grid had.
    //
    // A fixed track was the previous answer to the same problem. It keeps the
    // card identical but cannot absorb leftover space, so every row ended in a
    // ragged gutter of up to one whole column. 1fr inside a capped container
    // gets the consistency without the gutter.
    return `
    [data-bc-node="${NODE}"] {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, ${w}px), 1fr));
      gap: ${gap}px;
      ${cap ? `max-width: min(100%, var(--bc-dash-measure, ${cap}px));` : ""}
      margin: 0 0 var(--bc-space-7, 16px);
      align-items: stretch;
      container-type: inline-size;
    }
    [data-bc-node="${NODE}"] .bc-dc {
      position: relative;
      display: flex; flex-direction: column;
      min-width: 0;
      background: var(--bc-surface-2, #fff);
      border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: ${rad}px;
      overflow: hidden;
      transition: transform var(--bc-dur-2, 160ms) var(--bc-ease-standard, ease),
                  box-shadow var(--bc-dur-2, 160ms) var(--bc-ease-standard, ease),
                  border-color var(--bc-dur-2, 160ms) var(--bc-ease-standard, ease);
    }
    /* The course colour as a rail across the top of the body, not a 3px spine
       down the side. At a glance down a column of cards the rail is what tells
       them apart, and unlike a spine it cannot be hidden by a child's own
       background, which is what made the previous attempt show as a stub in one
       corner. */
    [data-bc-node="${NODE}"] .bc-dc-artwrap {
      position: relative;
      border-bottom: 3px solid var(--dc-c, transparent);
    }
    [data-bc-node="${NODE}"] .bc-dc-art {
      aspect-ratio: 16 / 9;
      background-color: var(--dc-c, #888);
      background-repeat: repeat;
      transition: transform var(--bc-dur-3, 240ms) var(--bc-ease-standard, ease);
    }
    /* A scrim, always, image or pattern. It is what lets the chip sit on top of
       arbitrary artwork and stay readable — a course photograph can be any
       brightness at all, and per-image sampling is not something CSS can do. */
    /* The monogram. Big, tight, and deliberately low contrast: it is the card's
       texture, not a second label -- the course code is already printed in full
       two lines below it. Ink is chosen against the course colour so it works on
       a pale yellow and a near-black alike. */
    [data-bc-node="${NODE}"] .bc-dc-mono {
      position: absolute; left: var(--bc-pad-row, 14px); bottom: 6px;
      font-family: var(--bc-font-sans);
      /* Sized off the CARD, not off the reading scale. This was
         calc(--bc-text-2xl * 2.3), which ties a decorative mark on a piece of
         artwork to the user's text-size preference: at xl the monogram grew
         past the art it sits on and "COMM" lost 4px of its last stem to the
         overflow clip, while the card it was drawn on had not changed size at
         all. A monogram is texture, not text to be read, so it follows the one
         box it belongs to. 0.184 reproduces the previous default exactly at a
         250px card. */
      font-size: ${Math.round(w * 0.184)}px; line-height: .8;
      font-weight: var(--bc-weight-bold, 700);
      letter-spacing: -.03em;
      color: var(--dc-mono, rgba(255,255,255,.22));
      pointer-events: none; user-select: none;
      /* Never wider than the card, however long the subject code is. */
      max-width: calc(100% - var(--bc-pad-row, 14px) * 2);
      overflow: hidden; white-space: nowrap;
    }
    /* The list layout's art is a fixed 132px strip whatever the card size, so
       its monogram is a fixed size too — and for the same reason as above, not
       a multiple of the reading scale. */
    [data-bc-node="${NODE}"][data-layout="list"] .bc-dc-mono {
      font-size: ${Math.round(LIST_ART * 0.212)}px; bottom: 4px; left: 8px;
      /* The inset moved to 8px here but the ceiling kept subtracting the row
         padding, which density owns — so at cozy the box shrank to 88px around
         a 93px monogram while 116px of art sat unused beside it. The ceiling
         has to be derived from the same inset the rule above it sets. */
      max-width: calc(100% - 16px);
    }
    [data-bc-node="${NODE}"] .bc-dc-scrim {
      position: absolute; inset: 0;
      /* Dark at BOTH ends, clear through the middle. The chip and the due badge
         ride the top and the sparkline rides the bottom, so a top-only gradient
         left the trend line unprotected on pale artwork. */
      background: linear-gradient(to bottom, rgba(0,0,0,.34) 0%, rgba(0,0,0,0) 42%,
                                             rgba(0,0,0,0) 62%, rgba(0,0,0,.34) 100%);
      pointer-events: none;
    }
    [data-bc-node="${NODE}"] .bc-dc-chip,
    [data-bc-node="${NODE}"] .bc-dc-due {
      position: absolute;
      display: inline-flex; align-items: center;
      height: 22px; padding: 0 var(--bc-space-3, 8px);
      border-radius: var(--bc-radius-pill, 999px);
      font-size: var(--bc-text-2xs, 11px);
      font-weight: var(--bc-weight-semibold, 600);
      background: rgba(0,0,0,.52); color: #fff;
      backdrop-filter: blur(6px);
    }
    /* Bottom-right. It used to be top-right, which is where the options kebab
       now lives -- the grade sat under it and the two overlapped on hover. */
    [data-bc-node="${NODE}"] .bc-dc-chip { right: 8px; bottom: 8px; }
    /* Bottom-left of the art: the chip is top-right, so the two never collide
       however long either gets. */
    [data-bc-node="${NODE}"] .bc-dc-spark {
      position: absolute; left: 8px; bottom: 8px;
      line-height: 0; pointer-events: none;
      color: #fff; opacity: .9;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.55));
    }
    [data-bc-node="${NODE}"] .bc-dc-due { left: 8px; top: 8px; background: var(--bc-accent, #b4341f); }

    /* Top-right, where Canvas put its own. Each corner of the artwork holds one
       thing: due badge top-left, kebab top-right, trend bottom-left, grade
       bottom-right, so nothing ever collides with anything else. */
    [data-bc-node="${NODE}"] .bc-dc-kebab {
      position: absolute; top: 6px; right: 6px; z-index: 4;
      width: 26px; height: 26px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border: 0; border-radius: var(--bc-radius-md, 8px);
      background: rgba(0,0,0,.45); color: #fff; cursor: pointer;
      opacity: 0; transition: opacity var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
    }
    [data-bc-node="${NODE}"] .bc-dc:hover .bc-dc-kebab,
    [data-bc-node="${NODE}"] .bc-dc:focus-within .bc-dc-kebab { opacity: 1; }
    /* No hover to reveal it with, so it stays put. */
    @media (hover: none) { [data-bc-node="${NODE}"] .bc-dc-kebab { opacity: 1; } }
    [data-bc-node="${NODE}"] .bc-dc-kebab:focus-visible {
      outline: 2px solid var(--bc-focus-ring, var(--bc-accent)); outline-offset: 2px;
    }
    [data-bc-node="${NODE}"] .bc-dc-menu {
      position: absolute; top: 34px; right: 6px; z-index: 6;
      width: 216px; padding: var(--bc-space-4, 10px);
      background: var(--bc-surface-2, #fff); color: var(--bc-text);
      border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-lg, 10px);
      box-shadow: var(--bc-shadow-3, 0 12px 32px rgba(0,0,0,.24));
      text-align: left;
    }
    [data-bc-node="${NODE}"] .bc-dc-mh {
      margin: 0 0 var(--bc-space-2, 6px);
      font-size: var(--bc-text-2xs, 11px); font-weight: var(--bc-weight-semibold, 600);
      letter-spacing: var(--bc-tracking-caps, .06em); text-transform: uppercase;
      color: var(--bc-text-subtle, var(--bc-muted));
    }
    [data-bc-node="${NODE}"] .bc-dc-sw {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--bc-space-2, 6px);
      margin-bottom: var(--bc-space-4, 10px);
    }
    [data-bc-node="${NODE}"] .bc-dc-swatch {
      height: 22px; border: 0; border-radius: var(--bc-radius-sm, 6px);
      cursor: pointer; padding: 0;
    }
    [data-bc-node="${NODE}"] .bc-dc-swatch[aria-current="true"] {
      outline: 2px solid var(--bc-text); outline-offset: 2px;
    }
    [data-bc-node="${NODE}"] .bc-dc-swatch:focus-visible {
      outline: 2px solid var(--bc-focus-ring, var(--bc-accent)); outline-offset: 2px;
    }
    [data-bc-node="${NODE}"] .bc-dc-mi {
      width: 100%; box-sizing: border-box;
      padding: var(--bc-space-2, 6px) var(--bc-space-3, 8px);
      border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-md, 8px);
      background: var(--bc-surface-1, #fff); color: var(--bc-text);
      font: inherit; font-size: var(--bc-text-sm, 13px);
      margin-bottom: var(--bc-space-4, 10px);
    }
    [data-bc-node="${NODE}"] .bc-dc-mr { display: flex; gap: var(--bc-space-2, 6px); }
    [data-bc-node="${NODE}"] .bc-dc-mb {
      flex: 1 1 auto; padding: var(--bc-space-2, 6px);
      border: 1px solid var(--bc-border, #e5e7eb);
      border-radius: var(--bc-radius-md, 8px);
      background: var(--bc-surface-3, #f7fafc); color: var(--bc-text);
      font: inherit; font-size: var(--bc-text-xs, 12px); cursor: pointer;
    }
    [data-bc-node="${NODE}"] .bc-dc-mb:hover { background: var(--bc-surface-4, rgba(0,0,0,.06)); }

    [data-bc-node="${NODE}"] .bc-dc-body {
      display: flex; flex-direction: column;
      flex: 1 1 auto; min-height: 0;
      padding: var(--bc-pad-row, 14px);
      gap: 2px;
    }
    [data-bc-node="${NODE}"] .bc-dc-code {
      margin: 0;
      font-size: var(--bc-text-2xs, 11px);
      font-weight: var(--bc-weight-semibold, 600);
      letter-spacing: var(--bc-tracking-caps, .06em);
      text-transform: uppercase;
      color: var(--bc-text-subtle, var(--bc-muted));
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    [data-bc-node="${NODE}"] .bc-dc-title {
      margin: 0;
      font-size: var(--bc-text-lg, 15px);
      font-weight: var(--bc-weight-semibold, 600);
      line-height: var(--bc-leading-tight, 1.25);
    }
    [data-bc-node="${NODE}"] .bc-dc-a {
      color: var(--bc-text, #1b2430);
      text-decoration: none;
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
      overflow: hidden; overflow-wrap: anywhere;
    }
    /* The stretched link: the whole card is one target. */
    [data-bc-node="${NODE}"] .bc-dc-a::after { content: ""; position: absolute; inset: 0; z-index: 1; }
    [data-bc-node="${NODE}"] .bc-dc-a:hover { text-decoration: underline; }
    /* The term is the lowest rung of the hierarchy and it is what gets pushed to
       the bottom, so the metadata lines up across a row whether the title above
       it took one line or two. This is the thing that kept failing against
       Canvas's markup; here the box is ours and it simply works. */
    [data-bc-node="${NODE}"] .bc-dc-term {
      margin: auto 0 0;
      padding-top: var(--bc-space-3, 8px);
      font-size: var(--bc-text-2xs, 11px);
      color: var(--bc-text-subtle, var(--bc-muted));
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    [data-bc-node="${NODE}"] .bc-dc-bar {
      margin-top: var(--bc-space-4, 10px);
      height: 4px; border-radius: 999px;
      background: var(--bc-surface-4, rgba(0,0,0,.08));
      overflow: hidden;
    }
    [data-bc-node="${NODE}"] .bc-dc-bar i { display: block; height: 100%; background: var(--dc-c); }
    [data-bc-node="${NODE}"] .bc-dc-bar.is-empty { visibility: hidden; }

    [data-bc-node="${NODE}"] .bc-dc-links {
      display: flex; gap: 2px;
      padding: var(--bc-space-2, 6px) calc(var(--bc-pad-row, 14px) - 6px);
      border-top: 1px solid var(--bc-border-subtle, var(--bc-border, #e5e7eb));
      background: var(--bc-surface-3, #f7fafc);
    }
    /* A card with no quick links still gets the strip, so a row of cards keeps
       one rhythm. It has to be the height a POPULATED strip resolves to, and a
       hardcoded 28px was not it: the real one is a 28px icon inside 6px of
       padding over a 1px border, which comes to 41. The 13px difference did not
       show up as a short footer -- the row forces one height -- it showed up
       INSIDE the card, as a body 13px taller whose auto margin pushed the course
       code, title and term down by 13px against every neighbour in the row.
       A zero-width spacer of the icon's own height means the box is measured by
       exactly the rules that measure a real one, so the two cannot drift again
       when the padding token or the icon size changes. */
    [data-bc-node="${NODE}"] .bc-dc-links.is-empty::before {
      content: ""; display: block; width: 0; height: 28px;
    }
    [data-bc-node="${NODE}"] .bc-dc-ln {
      position: relative; z-index: 2;
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: var(--bc-radius-md, 8px);
      color: var(--bc-text-subtle, var(--bc-muted));
      transition: background-color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease),
                  color var(--bc-dur-1, 90ms) var(--bc-ease-standard, ease);
    }
    [data-bc-node="${NODE}"] .bc-dc-ln:hover { background: var(--bc-surface-4, rgba(0,0,0,.06)); color: var(--bc-text); }
    [data-bc-node="${NODE}"] .bc-dc-ln.is-new::after {
      content: ""; position: absolute; top: 4px; right: 4px;
      width: 6px; height: 6px; border-radius: 50%; background: var(--bc-accent);
    }
    [data-bc-node="${NODE}"] .bc-dc-ln:focus-visible,
    [data-bc-node="${NODE}"] .bc-dc-a:focus-visible {
      outline: 2px solid var(--bc-focus-ring, var(--bc-accent)); outline-offset: 2px;
    }
    /* Focus lands on the anchor but should read on the CARD, since the anchor's
       visible box is only the title. */
    [data-bc-node="${NODE}"] .bc-dc:focus-within {
      border-color: var(--dc-c);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--dc-c) 30%, transparent);
    }
    ${d.hoverLift ? `
    @media (hover: hover) {
      [data-bc-node="${NODE}"] .bc-dc:hover {
        transform: translateY(-3px);
        border-color: var(--dc-c);
        box-shadow: 0 10px 24px -12px color-mix(in srgb, var(--dc-c) 60%, transparent),
                    0 2px 6px -2px rgba(0,0,0,.12);
      }
      [data-bc-node="${NODE}"] .bc-dc:hover .bc-dc-art { transform: scale(1.04); }
    }
    :root[data-bc-motion="0"] [data-bc-node="${NODE}"] .bc-dc,
    :root[data-bc-motion="0"] [data-bc-node="${NODE}"] .bc-dc-art { transition: none; }
    :root[data-bc-motion="0"] [data-bc-node="${NODE}"] .bc-dc:hover { transform: none; }
    :root[data-bc-motion="0"] [data-bc-node="${NODE}"] .bc-dc:hover .bc-dc-art { transform: none; }
    @media (prefers-reduced-motion: reduce) {
      [data-bc-node="${NODE}"] .bc-dc:hover { transform: none; }
      [data-bc-node="${NODE}"] .bc-dc:hover .bc-dc-art { transform: none; }
    }` : ""}

    /* ---- list ---- */
    /* One card height for the WHOLE grid, not one per row. align-items: stretch
       only equalises cards that share a row, so a course with a one-line title
       on the last row drew a card 19px shorter than the eight above it. 1fr rows
       on an auto-height grid all resolve to the tallest, which is the only
       reading of "every card is the same card" that survives a second row.
       Grid layout only: list rows are one card each, and masonry's whole premise
       is rows that do not agree. */
    [data-bc-node="${NODE}"][data-layout="grid"] { grid-auto-rows: 1fr; }
    [data-bc-node="${NODE}"][data-layout="list"] { grid-template-columns: 1fr; max-width: none; gap: var(--bc-space-3, 8px); }
    [data-bc-node="${NODE}"][data-layout="list"] .bc-dc { flex-direction: row; align-items: stretch; }
    [data-bc-node="${NODE}"][data-layout="list"] .bc-dc-artwrap {
      flex: 0 0 ${LIST_ART}px; border-bottom: 0; border-right: 3px solid var(--dc-c, transparent);
    }
    [data-bc-node="${NODE}"][data-layout="list"] .bc-dc-art { height: 100%; aspect-ratio: auto; }
    [data-bc-node="${NODE}"][data-layout="list"] .bc-dc-body { justify-content: center; }
    [data-bc-node="${NODE}"][data-layout="list"] .bc-dc-term { margin-top: 0; padding-top: 2px; }
    [data-bc-node="${NODE}"][data-layout="list"] .bc-dc-links {
      border-top: 0; border-left: 1px solid var(--bc-border-subtle, var(--bc-border));
      align-items: center; background: none;
    }

    /* ---- compact: no art, just identity and name ---- */
    [data-bc-node="${NODE}"][data-layout="compact"] .bc-dc-artwrap { display: none; }
    [data-bc-node="${NODE}"][data-layout="compact"] .bc-dc {
      border-left: 3px solid var(--dc-c, transparent);
    }
    [data-bc-node="${NODE}"][data-layout="compact"] .bc-dc-links { display: none; }
    [data-bc-node="${NODE}"][data-layout="compact"] .bc-dc-a { -webkit-line-clamp: 1; }

    /* ---- masonry ---- */
    [data-bc-node="${NODE}"][data-layout="masonry"] {
      display: block; columns: ${w}px auto; column-gap: ${gap}px;
    }
    [data-bc-node="${NODE}"][data-layout="masonry"] .bc-dc {
      break-inside: avoid; margin-bottom: ${gap}px;
    }

    /* A card is never narrower than it is readable: below this the body drops to
       one title line so a two-line title cannot push the term off the card. */
    @container (max-width: 190px) {
      [data-bc-node="${NODE}"] .bc-dc-a { -webkit-line-clamp: 3; }
      [data-bc-node="${NODE}"] .bc-dc-links { display: none; }
    }

    /* Canvas's own grid, kept in the document but out of the layout, so putting
       it back is one line if our fetch fails. */
    [data-bc-dashgrid-off] { display: none !important; }
    `;
  }

  // ---- mount --------------------------------------------------------------

  function hostFor() {
    const canvas = document.querySelector(CANVAS_GRID);
    if (canvas && canvas.parentElement) return { anchor: canvas, parent: canvas.parentElement };
    return null;
  }

  function teardown() {
    for (const n of document.querySelectorAll('[data-bc-node="' + NODE + '"]')) n.remove();
    for (const n of document.querySelectorAll("[data-bc-dashgrid-off]")) n.removeAttribute("data-bc-dashgrid-off");
    BC.injector.setStyle(STYLE, "");
  }

  function apply(settings, ctx) {
    const d = settings.dashboard || {};
    if (ctx.page !== "dashboard" || !d.enabled || d.ownCards === false) return teardown();

    const spot = hostFor();
    if (!spot) return;                       // Canvas has not rendered yet

    // No once()-armed reset here. Tying the load state to a bag mark means a
    // wrong bag implementation shows up as a feature that never renders at all
    // rather than as anything diagnosable, and it buys nothing: unmount() clears
    // the state when the page changes, and BC.api's own TTL makes coming back a
    // cache hit rather than a refetch.
    load();

    // Until the cards arrive, Canvas's own grid stays visible and untouched.
    // Blanking the dashboard behind a spinner for a network round trip is worse
    // than showing Canvas's cards for one, and a failed fetch then costs nothing.
    if (state !== "done" || !cards) {
      if (state === "failed") teardown();
      return;
    }

    BC.injector.setStyle(STYLE, sheet(d));
    spot.anchor.setAttribute("data-bc-dashgrid-off", "");

    let root = document.querySelector('[data-bc-node="' + NODE + '"]');
    if (!root) {
      root = BC.ui.el("div", { "data-bc-node": NODE });
      spot.parent.insertBefore(root, spot.anchor);
    }
    root.setAttribute("data-layout", d.layout || "grid");

    const overrides = d.courses || {};
    const query = (BC.dashboard && BC.dashboard.query ? BC.dashboard.query : "").toLowerCase();
    const order = Array.isArray(d.courseOrder) ? d.courseOrder.map(String) : [];

    let list = cards.slice();
    // A user order, then Canvas's own position, so an unordered install still
    // matches what Canvas showed a moment ago rather than reshuffling.
    if (order.length) {
      list.sort((a, b) => {
        const ia = order.indexOf(String(a.id)), ib = order.indexOf(String(b.id));
        return (ia === -1 ? 1e6 + (a.position || 0) : ia) - (ib === -1 ? 1e6 + (b.position || 0) : ib);
      });
    }
    list = list.filter((c) => {
      const spec = overrides[String(c.id)] || {};
      if (spec.hidden === true) return false;
      if (!query) return true;
      const hay = ((spec.nickname || "") + " " + (c.shortName || "") + " " +
                   (c.originalName || "") + " " + (c.courseCode || "")).toLowerCase();
      return hay.indexOf(query) !== -1;
    });

    const opts = {
      overrides,
      dark: BC.isDarkActive(settings),
      showGrade: !!d.showInlineGrade,
      showBadges: !!d.showBadges,
      showProgress: !!d.showProgressBar,
      showSparkline: !!d.showSparkline,
      history: (BC.storage.local && BC.storage.local.gradeHistory) || {},
      grades: (BC.dashboard && BC.dashboard.scores) || new Map(),
      due: (BC.dashboard && BC.dashboard.dueSoon) || new Map(),
      progress: (BC.dashboard && BC.dashboard.progress) || new Map(),
    };

    // Rebuild wholesale. These are a few dozen small nodes at most, the data
    // only changes on a real settings or fetch change, and diffing them would be
    // a cache to keep correct for no measurable gain.
    // Rebuilding the grid drops any open menu with it; reopening it after the
    // rebuild would fight the caret in the rename field. Closing is the honest
    // behaviour and it is what a colour click wants anyway.
    closeMenu();
    const frag = document.createDocumentFragment();
    for (const c of list) frag.appendChild(buildCard(c, opts));
    root.textContent = "";
    root.appendChild(frag);
  }

  BC.registry.register({
    id: "dashgrid",
    pages: ["dashboard"],
    styles: [STYLE],
    nodes: [NODE],
    apply,
    unmount() { teardown(); state = "idle"; cards = null; custom = null; fails = 0; colours.clear(); },
  });
})();
