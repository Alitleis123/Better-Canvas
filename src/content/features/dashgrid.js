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
  let state = "idle";          // idle | loading | done | failed
  let fails = 0;               // consecutive fetch failures, for the retry
  const colours = new Map();   // course id -> the colour we actually painted

  // The planner widget renders beside these cards and had no idea what colour
  // any course was, so the two halves of the dashboard looked like two products.
  // This is the resolved colour -- a user override, then Canvas's, then our
  // deterministic fallback -- so a course is the same colour in both places,
  // including the ones Canvas has no colour for at all.
  BC.dashgrid = { colourFor: (id) => colours.get(String(id)) || null };

  // ---- data ---------------------------------------------------------------

  function load() {
    if (state !== "idle") return;
    state = "loading";
    BC.api.dashboardCards().then((list) => {
      cards = Array.isArray(list) ? list : [];
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

  function artStyle(card, colour, dark) {
    if (card.image && BC.util.isSafeUrl(card.image)) {
      return 'background-image: url("' + BC.util.cssSafe(card.image) + '");' +
             "background-size: cover; background-position: center;";
    }
    if (!BC.skins || !BC.skins.patternCss) return "background-color: " + colour + ";";
    const h = hash(String(card.id || card.assetString || card.shortName || ""));
    const kind = ART_KINDS[h % ART_KINDS.length];
    // The pattern sits on the course colour, drawn in a tint of itself. Toward
    // white on a dark base and toward black on a light one, so the figure is
    // always visible against its own ground without ever inventing a new hue:
    // the card still reads as the course's colour, not as decoration.
    const lum = BC.color.relLuminance(colour);
    const fg = lum < 0.5 ? BC.color.lighten(colour, 0.28) : BC.color.darken(colour, 0.24);
    return BC.skins.patternCss({
      kind,
      fg,
      bg: colour,
      scale: 0.7 + (h % 5) * 0.2,
      angle: [45, 90, 135, 60][h % 4],
    });
  }

  // Canvas hands back the colour it shows in its own colour picker. A course
  // that has never been given one comes back null, and on a dark theme the
  // fallback must not be the theme's own surface or the card loses its edge.
  function courseColour(card, spec, dark) {
    if (spec && spec.color && BC.color.isHex(spec.color)) return spec.color;
    const c = card.backgroundColor || card.color;
    if (c && BC.color.isHex(c)) return BC.color.normalizeHex(c);
    // Deterministic, and picked from a fixed set rather than computed, so every
    // fallback colour is one somebody chose: evenly spaced around the wheel,
    // mid-chroma, and all within a stop of each other in luminance so no card
    // shouts louder than its neighbour. A hue computed from a hash lands on
    // muddy olives and acid greens about a third of the time.
    return FALLBACK[hash(String(card.id || "")) % FALLBACK.length];
  }

  // ---- one card -----------------------------------------------------------

  const LINK_ICON = {
    announcements: "megaphone",
    assignments: "checklist",
    discussions: "bell",
    files: "folder",
    quizzes: "check",
    syllabus: "file",
    grades: "trend",
    people: "star",
  };

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
    const wantsChip = (opts.showGrade && opts.grades.get(String(card.id)) != null) ||
                      (opts.showBadges && opts.due.get(String(card.id)));
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
        const a = el("a", { class: "bc-dc-ln", href: l.path, title: l.label || l.cssClass });
        a.setAttribute("aria-label", (l.label || l.cssClass) + " — " + name);
        a.appendChild(BC.icons.el(LINK_ICON[l.cssClass] || "file"));
        if (l.icon && /unread|new/i.test(String(l.icon))) a.classList.add("is-new");
        nav.appendChild(a);
      }
      kids.push(nav);
    }

    const root = el("article", { class: "bc-dc", "data-bc-course": String(card.id) }, kids);
    colours.set(String(card.id), colour);
    root.style.setProperty("--dc-c", colour);
    // Ink that is guaranteed legible on this course's colour, for the chip and
    // anything else that sits directly on the art.
    root.style.setProperty("--dc-ink", BC.color.contrastText(colour));
    return root;
  }

  // ---- the sheet ----------------------------------------------------------

  function sheet(d) {
    // 250 for medium is not a taste call, it is the number that makes the cap
    // reachable. The cap below is maxColumns cards wide, and a layout is only
    // identical across monitors for windows at least that wide -- so the cap has
    // to clear the SMALLEST target. A 15" MacBook at 1710 CSS px leaves about
    // 1357px of content column once Canvas's nav and sidebar are out; at 260 the
    // five-column cap is 1364 and that machine falls to four columns while a 24"
    // gets five. At 250 the cap is 1314, every one of the three clears it, and
    // all three render five columns of 250.
    const w = { s: 210, m: 250, l: 300 }[d.cardSize || "m"] || 250;
    const gap = 16;
    const cap = d.maxColumns > 0 ? (d.maxColumns * w + (d.maxColumns - 1) * gap) : 0;
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
      ${cap ? `max-width: ${cap}px;` : ""}
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
    [data-bc-node="${NODE}"] .bc-dc-scrim {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,.34) 0%, rgba(0,0,0,0) 46%);
      pointer-events: none;
    }
    [data-bc-node="${NODE}"] .bc-dc-chip,
    [data-bc-node="${NODE}"] .bc-dc-due {
      position: absolute; top: 8px;
      display: inline-flex; align-items: center;
      height: 22px; padding: 0 var(--bc-space-3, 8px);
      border-radius: var(--bc-radius-pill, 999px);
      font-size: var(--bc-text-2xs, 11px);
      font-weight: var(--bc-weight-semibold, 600);
      background: rgba(0,0,0,.52); color: #fff;
      backdrop-filter: blur(6px);
    }
    [data-bc-node="${NODE}"] .bc-dc-chip { right: 8px; }
    [data-bc-node="${NODE}"] .bc-dc-due { left: 8px; background: var(--bc-accent, #b4341f); }

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
    [data-bc-node="${NODE}"] .bc-dc-links.is-empty { min-height: 28px; }
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
    [data-bc-node="${NODE}"][data-layout="list"] { grid-template-columns: 1fr; max-width: none; gap: var(--bc-space-3, 8px); }
    [data-bc-node="${NODE}"][data-layout="list"] .bc-dc { flex-direction: row; align-items: stretch; }
    [data-bc-node="${NODE}"][data-layout="list"] .bc-dc-artwrap {
      flex: 0 0 132px; border-bottom: 0; border-right: 3px solid var(--dc-c, transparent);
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
      grades: (BC.dashboard && BC.dashboard.scores) || new Map(),
      due: (BC.dashboard && BC.dashboard.dueSoon) || new Map(),
      progress: (BC.dashboard && BC.dashboard.progress) || new Map(),
    };

    // Rebuild wholesale. These are a few dozen small nodes at most, the data
    // only changes on a real settings or fetch change, and diffing them would be
    // a cache to keep correct for no measurable gain.
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
    unmount() { teardown(); state = "idle"; cards = null; fails = 0; colours.clear(); },
  });
})();
