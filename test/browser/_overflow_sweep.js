// Does anything we draw spill, clip, or collapse — in any of the states a user
// can actually put the extension in?
//
// Run by test/browser/overflow.sh. Contrast has a sweep, the dashboard measure
// has a sweep, the settings panel has a sweep; this is the one for the rest of
// it. Three failure modes, all of which a screenshot of the default state
// cannot show:
//
//   spill    the page scrolls sideways. Something we injected is wider than the
//            window, which on Canvas means a horizontal scrollbar under every
//            page the user visits.
//   clip     one of OUR elements has more content than box, so a label is cut
//            off mid-word with nothing to indicate it. Only counted when the
//            element is not deliberately scrollable and does not ellipsize.
//   collapse an element that has text renders at zero height, i.e. the text is
//            there and invisible.
//
// The matrix is the settings that change SIZE: density and font scale multiply
// every box on the page, and the planner's five layouts and three views are the
// densest markup we ship.
(async () => {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  // Keyed by what is wrong and WHICH element, not by which of the 231 states it
  // was seen in: one defect in a fixed-position button is one defect, not 231.
  const findings = new Map();
  const note = (kind, sel, state, detail) => {
    const k = kind + " " + sel;
    const hit = findings.get(k) || { kind, sel, detail, states: 0, first: state };
    hit.states++;
    findings.set(k, hit);
  };

  const ours = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hasAttribute && n.hasAttribute("data-bc-node")) return true;
      const c = n.className;
      if (typeof c === "string" && /(^|\s)bc-/.test(c)) return true;
    }
    return false;
  };

  function check(state) {
    const doc = document.documentElement;
    // A sideways scroll of a pixel or two is subpixel rounding, not a defect.
    if (doc.scrollWidth > doc.clientWidth + 2) {
      // Name the widest thing of ours that sticks out, or the page is unactionable.
      let worst = null;
      for (const el of document.querySelectorAll('[data-bc-node], [class*="bc-"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        const over = Math.round(r.right - doc.clientWidth);
        if (over > 2 && (!worst || over > worst.over)) {
          worst = { over, sel: (el.getAttribute("data-bc-node") || el.className || el.tagName).toString().slice(0, 48) };
        }
      }
      note("spill", worst ? worst.sel : "(unattributed)", state,
        (doc.scrollWidth - doc.clientWidth) + "px over");
    }

    for (const el of document.querySelectorAll('[data-bc-node], [class*="bc-"]')) {
      if (!ours(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;

      // Clipping. Three things do it on purpose and are not defects:
      // a scrollable box, text that ellipsises or line-clamps, and a
      // reveal-on-hover control whose label is parked at max-width: 0 so a
      // screen reader can still read it. The last one is why this check reports
      // per element rather than per state: both floating utility buttons hit it
      // in all 231 states, which buried everything else.
      const scrollable = /auto|scroll/.test(cs.overflowX + cs.overflowY);
      const trimmed = cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none";
      const reveal = [...el.querySelectorAll("*")].some((k) => getComputedStyle(k).maxWidth === "0px");
      if (!scrollable && !trimmed && !reveal && cs.overflow !== "visible" &&
          el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        note("clip", (el.getAttribute("data-bc-node") || el.className).toString().slice(0, 40),
          state, "content " + el.scrollWidth + " in " + el.clientWidth);
      }

      // Text that is present and has no height to be seen in.
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && r.height === 0 && cs.position !== "absolute") {
        note("collapse", (el.getAttribute("data-bc-node") || el.className).toString().slice(0, 40), state, "");
      }
    }
  }

  for (const density of ["compact", "default", "spacious", "cozy"]) {
    for (const scale of ["xs", "m", "xl"]) {
      const theming = { density, fontSizeScale: scale };
      for (const layout of ["grid", "list", "masonry", "compact"]) {
        __bcClear();
        __bcApply({ theming, dashboard: { layout } });
        await pause(40);
        check(`dash ${density}/${scale}/${layout}`);
      }
      for (const view of ["list", "kanban", "timeblock"]) {
        for (const lay of ["comfortable", "compact", "cards", "minimal", "timeline"]) {
          __bcClear();
          __bcTodo("ring", { theming, todo: { view, layout: lay } });
          await pause(40);
          check(`todo ${density}/${scale}/${view}/${lay}`);
        }
      }
    }
  }

  const hits = [...findings.values()].sort((a, b) => b.states - a.states);
  return hits.length
    ? "FAIL (" + hits.length + " distinct)\n" + hits.slice(0, 30).map((h) =>
        h.kind + " " + h.sel + " — " + h.detail + " [" + h.states + " states, e.g. " + h.first + "]").join("\n")
    : "PASS — 4 densities x 3 scales x (4 dash layouts + 15 planner states)";
})()
