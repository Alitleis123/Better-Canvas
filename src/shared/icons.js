/*
 * Better Canvas — the icon set.
 *
 * One 16x16 grid, one stroke weight, currentColor, drawn with a compass and a
 * ruler. Every glyph the UI used to type — stars, a tomato, a party popper, a
 * flame, guillemets standing in for chevrons — was at the mercy of the host
 * font: some rendered in colour inside a monochrome row, some fell back to a
 * box, and their optical weights never matched each other.
 *
 * Conventions, enforced by test/icons.test.js:
 *  - viewBox 0 0 16 16, stroke-width 1.5, round caps and joins, fill none.
 *  - Drawing stays inside 2..14 so a 16px icon has breathing room in a 26px hit
 *    area, and nothing clips when a theme rounds the corners.
 *  - Solid fills say so explicitly (fill="currentColor" stroke="none").
 *  - Decorative by default: aria-hidden, because the button around it carries
 *    the accessible name. Pass `title` only for a standalone, meaningful icon.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const SOLID = ' fill="currentColor" stroke="none"';
  const dot = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 0.95) + '"' + SOLID + "/>";

  const P = {
    // ---- chrome & navigation ------------------------------------------------
    "chevron-left":  '<path d="M9.75 3.75 5.5 8l4.25 4.25"/>',
    "chevron-right": '<path d="M6.25 3.75 10.5 8l-4.25 4.25"/>',
    "chevron-down":  '<path d="M3.75 6.25 8 10.5l4.25-4.25"/>',
    "arrow-right":   '<path d="M2.75 8h10.5M9.25 4.25 13.25 8l-4 3.75"/>',
    close:           '<path d="M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5"/>',
    plus:            '<path d="M8 3.25v9.5M3.25 8h9.5"/>',
    minus:           '<path d="M3.25 8h9.5"/>',
    more:            dot(4, 8) + dot(8, 8) + dot(12, 8),
    grip:            dot(6, 4.25, 0.9) + dot(10, 4.25, 0.9) + dot(6, 8, 0.9) +
                     dot(10, 8, 0.9) + dot(6, 11.75, 0.9) + dot(10, 11.75, 0.9),
    search:          '<circle cx="7" cy="7" r="4.25"/><path d="m10.25 10.25 3 3"/>',
    settings:        '<circle cx="8" cy="8" r="2.25"/>' +
                     '<path d="M8 2.25v1.5M8 12.25v1.5M2.25 8h1.5M12.25 8h1.5' +
                     'M3.95 3.95l1.05 1.05M11 11l1.05 1.05M12.05 3.95 11 5M5 11l-1.05 1.05"/>',

    // ---- state & marks -----------------------------------------------------
    check:           '<path d="M3.5 8.5 6.25 11.25 12.5 4.75"/>',
    "check-circle":  '<circle cx="8" cy="8" r="5.75"/><path d="M5.5 8.25 7.25 10l3.25-3.5"/>',
    circle:          '<circle cx="8" cy="8" r="5.75"/>',
    target:          '<circle cx="8" cy="8" r="5.75"/>' + dot(8, 8, 1.5),
    star:            '<path d="M8 2.25l1.78 3.6 3.97.58-2.87 2.8.68 3.96L8 11.32l-3.54 1.87.68-3.96-2.87-2.8 3.97-.58z"/>',
    "star-filled":   '<path d="M8 2.25l1.78 3.6 3.97.58-2.87 2.8.68 3.96L8 11.32l-3.54 1.87.68-3.96-2.87-2.8 3.97-.58z" fill="currentColor"/>',
    // A crescent, not the sleeping face: that rendered in colour and broke the
    // monochrome row it sits in.
    moon:            '<path d="M13.25 9.6A5.6 5.6 0 0 1 6.4 2.75a5.6 5.6 0 1 0 6.85 6.85z"/>',
    // The counterpart to moon. The set had one and not the other, so anything
    // labelling a LIGHT option had to borrow an icon that meant something else.
    sun:             '<circle cx="8" cy="8" r="3.1"/>' +
                     '<path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6' +
                     'M3.4 3.4l1.15 1.15M11.45 11.45l1.15 1.15' +
                     'M12.6 3.4l-1.15 1.15M4.55 11.45L3.4 12.6"/>',
    alert:           '<path d="M8 2.75 14 13.25H2z"/><path d="M8 6.5v3"/>' + dot(8, 11.4, 0.85),
    bell:            '<path d="M4.5 6.75a3.5 3.5 0 0 1 7 0c0 3 1 4 1 4h-9s1-1 1-4z"/>' +
                     '<path d="M6.75 12.75a1.5 1.5 0 0 0 2.5 0"/>',
    trash:           '<path d="M3.25 4.75h9.5M6.5 4.75V3.5h3v1.25"/>' +
                     '<path d="M4.75 4.75l.6 8h5.3l.6-8"/><path d="M6.75 7v3.5M9.25 7v3.5"/>',
    // Two arcs rather than one: a single circular arrow needs its head placed
    // exactly on the arc's endpoint, and a head that misses by half a unit is
    // the most obvious flaw a 14px glyph can have. Symmetric is also unambiguous
    // about meaning — this is "go round again", not "undo".
    refresh:         '<path d="M2.9 8a5.1 5.1 0 0 1 8.7-3.6"/><path d="M11.9 2.3v2.6h-2.6"/>' +
                     '<path d="M13.1 8a5.1 5.1 0 0 1-8.7 3.6"/><path d="M4.1 13.7v-2.6h2.6"/>',
    "external-link": '<path d="M9 3.25h3.75V7"/><path d="M12.5 3.5 7.75 8.25"/>' +
                     '<path d="M11 9.5v2.25a1 1 0 0 1-1 1H4.25a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1H6.5"/>',

    // ---- time --------------------------------------------------------------
    clock:           '<circle cx="8" cy="8" r="5.75"/><path d="M8 4.75V8l2.25 1.5"/>',
    // The Pomodoro dock read as a tomato emoji. A stopwatch says "timer" in
    // every font and stays in the monochrome row.
    timer:           '<circle cx="8" cy="9.25" r="4.5"/><path d="M8 7v2.25l1.6.9"/>' +
                     '<path d="M6.25 2.5h3.5M8 2.5v2.25"/>',
    calendar:        '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/>' +
                     '<path d="M2.5 6.5h11M5.5 2.25v2.5M10.5 2.25v2.5"/>',
    play:            '<path d="M5.5 3.75 12 8l-6.5 4.25z"/>',
    pause:           '<path d="M6 4v8M10 4v8"/>',
    stop:            '<rect x="4" y="4" width="8" height="8" rx="1.25"/>',
    "skip-forward":  '<path d="M4.5 4 10 8l-5.5 4z"/><path d="M11.75 4v8"/>',
    // Every command after the M is relative, so the M alone positions the glyph:
    // at 2.25 its mass sat a whole unit high and it read as floating in the row.
    flame:           '<path d="M8 3.2c2.4 2.1 3.75 3.85 3.75 5.85a3.75 3.75 0 0 1-7.5 0c0-1.05.35-1.95 1.05-2.75.1.95.55 1.5 1.2 1.5.8 0 1.25-.65 1.25-1.65 0-1.05-.45-2-.45-3z"/>',

    // ---- layout & views ----------------------------------------------------
    list:            '<path d="M6 4.25h7.25M6 8h7.25M6 11.75h7.25"/>' +
                     dot(3.1, 4.25, 0.85) + dot(3.1, 8, 0.85) + dot(3.1, 11.75, 0.85),
    columns:         '<rect x="2.5" y="3" width="3.5" height="10" rx="1"/>' +
                     '<rect x="6.75" y="3" width="3.5" height="7" rx="1"/>' +
                     '<rect x="11" y="3" width="2.5" height="8.5" rx="1"/>',
    timeline:        '<path d="M2.5 3.25v9.5"/><rect x="4.5" y="3.5" width="7" height="2.5" rx="1"/>' +
                     '<rect x="4.5" y="7.25" width="9" height="2.5" rx="1"/>' +
                     '<rect x="4.5" y="11" width="5" height="2.5" rx="1"/>',
    grid:            '<rect x="2.5" y="2.5" width="5" height="5" rx="1"/>' +
                     '<rect x="8.5" y="2.5" width="5" height="5" rx="1"/>' +
                     '<rect x="2.5" y="8.5" width="5" height="5" rx="1"/>' +
                     '<rect x="8.5" y="8.5" width="5" height="5" rx="1"/>',
    tag:             '<path d="M7.4 2.75H12a1.25 1.25 0 0 1 1.25 1.25v4.6a1 1 0 0 1-.3.7l-4.3 4.3a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4l4.45-5.15a1 1 0 0 1 .7-.3z"/>' + dot(10.4, 5.6, 1),
    checklist:       '<path d="M7.25 4.5h6M7.25 11.5h6"/><path d="M2.5 4.4 3.6 5.5l2-2.1"/>' +
                     '<path d="M2.5 11.4 3.6 12.5l2-2.1"/>',

    // ---- file kinds --------------------------------------------------------
    // These replaced an emoji table (a page, a picture frame, a clapperboard, a
    // vice). Every one of them rendered in full colour at a different optical
    // size, in a list where the only other ink was 13px grey text.
    file:            '<path d="M9 2.5H4.75a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h6.5a1 1 0 0 0 1-1V5.5z"/>' +
                     '<path d="M9 2.5v3h3.25"/>',
    "file-text":     '<path d="M9 2.5H4.75a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h6.5a1 1 0 0 0 1-1V5.5z"/>' +
                     '<path d="M9 2.5v3h3.25M6 8.5h4M6 10.75h2.5"/>',
    sheet:           '<rect x="2.75" y="3" width="10.5" height="10" rx="1"/>' +
                     '<path d="M2.75 6.5h10.5M2.75 9.75h10.5M6.5 6.5V13M9.75 6.5V13"/>',
    video:           '<rect x="2.5" y="4" width="8" height="8" rx="1.25"/>' +
                     '<path d="M10.5 8.6l3-1.9v2.6l-3-1.9z"' + SOLID + "/>",
    audio:           '<path d="M2.75 7.25v1.5M5.5 5v6M8 3.25v9.5M10.5 5v6M13.25 7.25v1.5"/>',
    archive:         '<rect x="2.75" y="3" width="10.5" height="3" rx="1"/>' +
                     '<path d="M3.75 6v6a1 1 0 0 0 1 1h6.5a1 1 0 0 0 1-1V6"/><path d="M6.75 8.75h2.5"/>',
    paperclip:       '<path d="M13.2 7.3 7.9 12.6a3 3 0 0 1-4.25-4.25l5.6-5.6a2 2 0 0 1 2.85 2.85l-5.6 5.6a1 1 0 0 1-1.45-1.4l5.05-5.05"/>',
    flag:            '<path d="M4 13.25V3"/><path d="M4 3.4h7.5l-1.4 2.6 1.4 2.6H4"/>',
    save:            '<path d="M3.5 3.5h7L12.5 5.5v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"/>' +
                     '<path d="M5.75 3.5v2.75h4V3.5"/><rect x="5.5" y="9.25" width="5" height="4.25" rx=".5"/>',
    speaker:         '<path d="M8.25 3.25 5.25 6H3a.75.75 0 0 0-.75.75v2.5c0 .41.34.75.75.75h2.25l3 2.75z"/>' +
                     '<path d="M10.75 6.1a2.75 2.75 0 0 1 0 3.8M12.6 4.4a5.25 5.25 0 0 1 0 7.2"/>',

    // ---- settings tab rail -------------------------------------------------
    menu:            '<path d="M2.75 4.5h10.5M2.75 8h10.5M2.75 11.5h10.5"/>',
    contrast:        '<circle cx="8" cy="8" r="5.75"/>' +
                     '<path d="M8 2.25a5.75 5.75 0 0 1 0 11.5z"' + SOLID + "/>",
    palette:         '<path d="M8 2.25a5.75 5.75 0 1 0 0 11.5c.7 0 1.1-.5 1.1-1.05 0-.5-.35-.8-.35-1.2 0-.4.35-.7.8-.7h1.15A3.55 3.55 0 0 0 13.75 6.9C13.75 4.3 11.2 2.25 8 2.25z"/>' +
                     dot(5.4, 7.1, 0.8) + dot(8, 5.3, 0.8) + dot(10.6, 7.1, 0.8),
    image:           '<rect x="2.25" y="3.25" width="11.5" height="9.5" rx="1.5"/>' +
                     '<circle cx="6" cy="6.5" r="1.1"/><path d="m3 11.75 3-3 2.5 2.5L11 8.5l2.5 2.5"/>',
    folder:          '<path d="M2.5 5a1.5 1.5 0 0 1 1.5-1.5h2.2l1.3 1.5H12a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12 13H4a1.5 1.5 0 0 1-1.5-1.5z"/>',
    megaphone:       '<path d="M3 6.5v3a1 1 0 0 0 1 1h1.5L10 13.25v-10.5L5.5 5.5H4a1 1 0 0 0-1 1z"/>' +
                     '<path d="M12.25 6.25a3 3 0 0 1 0 3.5"/>',
    accessibility:   '<circle cx="8" cy="8" r="5.75"/>' + dot(8, 5.6, 0.8) +
                     '<path d="M5.6 7.4h4.8M8 7.6v2M8 9.6 6.7 11.9M8 9.6l1.3 2.3"/>',
    trend:           '<path d="M2.75 10.75 6 7.5l2.25 2.25 5-5"/><path d="M10.5 4.75h2.75V7.5"/>',
    command:         '<rect x="6" y="6" width="4" height="4" rx=".5"/>' +
                     '<path d="M6 6H4.5a1.5 1.5 0 1 1 1.5-1.5zM10 6h1.5A1.5 1.5 0 1 0 10 4.5zM6 10H4.5A1.5 1.5 0 1 0 6 11.5zM10 10h1.5a1.5 1.5 0 1 1-1.5 1.5z"/>',
    mortarboard:     '<path d="M8 2.75 14 5.5 8 8.25 2 5.5z"/>' +
                     '<path d="M4.5 6.9v3.35c0 1.1 1.6 2 3.5 2s3.5-.9 3.5-2V6.9"/>',
    info:            '<circle cx="8" cy="8" r="5.75"/><path d="M8 7.4v3.4"/>' + dot(8, 5.3, 0.75),
    // The focus ring, as a ring around a mark. Corner ticks rather than a solid
    // rect so it doesn't read as "square" in a row that also offers "Cursor".
    focus:           '<path d="M2.75 5.5v-1.5a1.25 1.25 0 0 1 1.25-1.25h1.5M10.5 2.75H12a1.25 1.25 0 0 1 1.25 1.25v1.5' +
                     'M13.25 10.5V12A1.25 1.25 0 0 1 12 13.25h-1.5M5.5 13.25H4A1.25 1.25 0 0 1 2.75 12v-1.5"/>' + dot(8, 8, 1.6),

    // ---- progress styles (settings preview affordances) --------------------
    bars:            '<path d="M3.25 12.75V9.5M6.75 12.75V5.5M10.25 12.75V7.75M13.75 12.75V3.25"/>',
  };

  const NAMES = Object.keys(P).sort();

  function svg(name, opts) {
    const o = opts || {};
    const body = P[name];
    if (!body) {
      // Loud in development, harmless in production: an empty box beats a
      // stack trace inside a template string.
      if (BC.util && BC.util.warn) BC.util.warn("icons: no such icon", name);
      return "";
    }
    const size = o.size || 16;
    const a11y = o.title
      ? 'role="img" aria-label="' + (BC.util ? BC.util.escapeHtml(o.title) : o.title) + '"'
      : 'aria-hidden="true" focusable="false"';
    return '<svg class="bc-ic' + (o.cls ? " " + o.cls : "") + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="' + (o.weight || 1.5) +
      '" stroke-linecap="round" stroke-linejoin="round" ' + a11y + ">" + body + "</svg>";
  }

  // For DOM-building call sites (the settings UI) rather than template strings.
  function el(name, opts) {
    const span = document.createElement("span");
    span.className = "bc-ic-wrap";
    span.innerHTML = svg(name, opts);
    const node = span.firstElementChild;
    return node || span;
  }

  BC.icons = { svg, el, has: (n) => Object.prototype.hasOwnProperty.call(P, n), names: () => NAMES.slice(), paths: P };
})();
