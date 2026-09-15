// Every settings tab, at every drawer width, checked for the two things that
// starve a row. Run by test/browser/panel.sh inside the harness page, where
// __bcPanel, __bcTab and __bcRowWidths are in scope.
//
// Neither defect is visible from one screenshot of one tab at one width:
//
//   * the label column, squeezed by whatever the control asks for. The panel
//     has had this three times -- a select at 26px, a colour field at 29px, and
//     a single switch at 114px -- each on a tab and a width nobody had looked
//     at, each with the node suite green.
//   * the hint, wrapping past two lines, which is what turns a page of settings
//     into a wall of prose.
(async () => {
  const TABS = ["themes", "theming", "cosmetics", "dashboard", "todo", "grades", "coursetools",
                "productivity", "notifications", "navigation", "shortcuts", "insights", "about"];
  const WIDTHS = [360, 420, 520, 600, 720, 900];
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const bad = [];
  for (const w of WIDTHS) {
    __bcPanel(w);
    await pause(120);
    for (const t of TABS) {
      if (!__bcTab(t)) { bad.push(w + "/" + t + ": TAB MISSING"); continue; }
      // Paced with a real timeout on purpose. A tight loop of .click() calls
      // leaves the engine reporting the FIRST tab as selected for colour and
      // background on every one of them, which reads as a panel-wide failure
      // that is not in the pixels.
      await pause(90);
      const rows = __bcRowWidths();
      if (typeof rows === "string") { bad.push(w + "/" + t + ": " + rows); continue; }
      if (!rows.length) { bad.push(w + "/" + t + ": no rows rendered"); continue; }
      const starved = rows.filter((r) => r.w < 144 && !r.wrapped);
      const deep = rows.filter((r) => r.hintLines > 2);
      if (starved.length) {
        bad.push(w + "/" + t + ": labels " +
          starved.map((r) => r.label.trim() + "=" + r.w).slice(0, 4).join(", "));
      }
      if (deep.length) {
        bad.push(w + "/" + t + ": hints " +
          deep.map((r) => r.label.trim() + "=" + r.hintLines + "L").slice(0, 4).join(", "));
      }
    }
  }
  return bad.length
    ? "FAIL\n" + bad.join("\n")
    : "PASS — 13 tabs x 6 widths, no starved label, no hint over two lines";
})()
