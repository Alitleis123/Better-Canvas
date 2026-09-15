/*
 * Better Canvas - capture a real Canvas page so the test replica can be built
 * from it rather than from assumptions.
 *
 * Run this in the console ON a Canvas dashboard. It records STRUCTURE and
 * COMPUTED STYLE only: no text content, no course names, no ids from the page.
 * Text is reduced to a length so layout can be reproduced without carrying
 * anything personal.
 */
(() => {
  const ours = (el) => el.closest &&
    el.closest('[data-bc-node],[data-better-canvas],[class^="bc-"],[class*=" bc-"]');

  const MARKERS = ["data-bc-lit", "data-bc-dim", "data-bc-paper",
                   "data-bc-cardgrid", "data-bc-carditem", "data-bc-course-colour"];

  let budget = 400;
  const snap = (el, depth) => {
    if (!el || budget <= 0 || depth > 9) return null;
    budget--;
    const cs = getComputedStyle(el);
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim().length)
      .reduce((a, b) => a + b, 0);
    const node = {
      t: el.tagName.toLowerCase(),
      c: (el.className || "").toString().trim().slice(0, 120) || undefined,
      i: el.id || undefined,
      bg: cs.backgroundColor,
      fg: cs.color,
      // Only whether there IS an image, not which.
      img: cs.backgroundImage && cs.backgroundImage !== "none" ? true : undefined,
      d: cs.display,
      fs: cs.fontSize,
      fw: cs.fontWeight,
      pad: cs.padding === "0px" ? undefined : cs.padding,
      // Text length only. No content leaves the page.
      len: ownText || undefined,
      mk: MARKERS.filter((m) => el.hasAttribute(m)),
      ours: ours(el) ? true : undefined,
    };
    if (!node.mk.length) delete node.mk;
    const kids = [...el.children].map((k) => snap(k, depth + 1)).filter(Boolean);
    if (kids.length) node.k = kids;
    return node;
  };

  const pick = (sel) => {
    const el = document.querySelector(sel);
    return el ? snap(el, 0) : { missing: sel };
  };

  const cards = [...document.querySelectorAll(".ic-DashboardCard")].slice(0, 2);

  const out = {
    note: "structure + computed styles only; no page text captured",
    extensionActive: !!document.querySelector("style[data-better-canvas]"),
    darkClass: document.documentElement.className,
    version: (() => { try { return chrome.runtime.getManifest().version; } catch { return null; } })(),
    viewport: { w: innerWidth, h: innerHeight },
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyFg: getComputedStyle(document.body).color,

    // The page shell, shallow: where the columns and the content area live.
    shell: (() => {
      const el = document.querySelector("#application, .ic-app") || document.body;
      const shallow = (n, d) => d > 4 ? null : ({
        t: n.tagName.toLowerCase(),
        c: (n.className || "").toString().trim().slice(0, 100) || undefined,
        i: n.id || undefined,
        bg: getComputedStyle(n).backgroundColor,
        d: getComputedStyle(n).display,
        k: [...n.children].map((x) => shallow(x, d + 1)).filter(Boolean),
      });
      return shallow(el, 0);
    })(),

    // What the layout rules have to target.
    cardContainer: pick("#DashboardCard_Container"),
    cardParent: cards[0] ? (() => {
      const p = cards[0].parentElement;
      return { t: p.tagName.toLowerCase(), c: (p.className || "").toString().trim(), i: p.id || undefined,
               d: getComputedStyle(p).display, kids: p.childElementCount };
    })() : null,
    cards: cards.map((c) => snap(c, 0)),

    dashboardHeader: pick(".ic-Dashboard-header__layout, #dashboard_header_container, .ic-Dashboard-header"),
    sidebar: pick("#right-side"),
  };

  const json = JSON.stringify(out);
  try { copy(json); } catch (_) {}
  console.log("captured " + json.length + " chars; copied to clipboard if the console allowed it");
  return json;
})();
