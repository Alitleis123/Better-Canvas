// Every palette we ship, against every element that carries text.
//
// Run by test/browser/contrast.sh. __bcAudit resolves the background the way
// the browser paints it — the nearest ancestor with an opaque background, not
// the element's own declaration — so this is the contrast a person actually
// gets, not the contrast the CSS claims.
//
// Two sweeps, because they fail differently. A dark tone re-tints a palette
// that is otherwise ours; a skin replaces the whole token layer, so it can fail
// where every tone passes. That is what found 9 of the 44 skins drawing the
// course code below AA.
//
// Layouts are in the tone sweep because the dashboard's four layouts put text
// on different backgrounds: the compact layout has no artwork behind its title
// and the list layout puts the monogram beside it rather than under it.
(async () => {
  const bad = [];
  const fmt = (f) => f.map((b) => b.sel + " " + b.ratio.toFixed(2)).join(" | ");

  for (const tone of Object.keys(BC.DARK_TONES)) {
    for (const layout of ["grid", "list", "masonry", "compact"]) {
      __bcClear();
      __bcApply({ theming: { darkMode: "on", darkTone: tone }, dashboard: { layout } });
      const f = __bcAudit().filter((a) => a.ratio < 4.5);
      if (f.length) bad.push("dark " + tone + "/" + layout + ": " + fmt(f));
    }
  }

  for (const k of BC.SKIN_CATALOG) {
    __bcClear();
    __bcApply({ theming: { skin: k.id } });
    const f = __bcAudit().filter((a) => a.ratio < 4.5);
    if (f.length) bad.push("skin " + k.id + ": " + fmt(f));
  }

  // Light mode with no skin is the default everybody gets, so it is checked on
  // its own rather than only as the baseline the others are compared to.
  __bcClear();
  __bcApply({});
  const plain = __bcAudit().filter((a) => a.ratio < 4.5);
  if (plain.length) bad.push("default light: " + fmt(plain));

  const tones = Object.keys(BC.DARK_TONES).length;
  return bad.length
    ? "FAIL (" + bad.length + ")\n" + bad.slice(0, 30).join("\n")
    : "PASS — " + tones + " dark tones x 4 layouts, " + BC.SKIN_CATALOG.length +
      " skins, and default light, all at or above 4.5:1";
})()
