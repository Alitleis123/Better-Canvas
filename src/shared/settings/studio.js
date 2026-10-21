/* Edit Canvas preview: isolated, read-only, with no duplicate Canvas API requests. */
(function () {
  "use strict";
  const BC = globalThis.BC = globalThis.BC || {};
  const el = (tag, attrs, kids) => BC.ui.el(tag, attrs, kids);
  let clipId = 0;
  BC.progressArt = function (style, done, total) {
    const pct = total > 0 ? Math.max(0, Math.min(100, done / total * 100)) : 0;
    const node = el("div", { class: "bcs-progress-art", role: "img", "aria-label": total ? done + " of " + total + " complete" : "No tasks due" });
    const color = "var(--bc-accent, #8583ff)", track = "var(--bc-border, #bbb)";
    if (style === "bar") {
      node.innerHTML = '<div style="height:8px;background:' + track + ';border-radius:8px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + color + '"></div></div>';
    } else if (style === "heart" || style === "cloud") {
      const path = style === "heart" ? "M50 89 12 52C-12 22 26-1 50 25 74-1 112 22 88 52Z" : "M23 77C-7 77-6 39 20 37 19 2 76 1 79 36 108 34 111 77 80 77Z";
      const id = "bc-progress-" + (++clipId);
      node.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="' + id + '"><rect x="0" y="' + (100 - pct) + '" width="100" height="100"/></clipPath></defs><path d="' + path + '" fill="' + track + '"/><path d="' + path + '" fill="' + color + '" clip-path="url(#' + id + ')"/></svg>';
    } else {
      node.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="' + track + '" stroke-width="9"/><circle cx="50" cy="50" r="40" fill="none" stroke="' + color + '" stroke-width="9" pathLength="100" stroke-dasharray="' + pct + ' 100" transform="rotate(-90 50 50)" stroke-linecap="round"/></svg>';
      if (style === "rainbow") {
        const gradient = "bc-rainbow-" + (++clipId);
        node.querySelector("svg").insertAdjacentHTML("afterbegin", '<defs><linearGradient id="' + gradient + '" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7af68"/><stop offset=".4" stop-color="#df80b4"/><stop offset=".7" stop-color="#9c8bef"/><stop offset="1" stop-color="#6ac9b8"/></linearGradient></defs>');
        node.querySelectorAll("circle")[1].setAttribute("stroke", "url(#" + gradient + ")");
      }
    }
    node.appendChild(el("span", { text: total ? Math.round(pct) + "%" : "—" }));
    return node;
  };
  // On a Canvas page the preview is a copy of that page. The page behind the
  // workspace already shows every change, so copying its DOM into a frame and
  // scaling it down shows exactly what a change does, without asking Canvas for
  // any data.
  // Left out: Better Canvas's own overlays, and anything that would run or fetch.
  const LEAVE_OUT = '[data-bc-node="bc-drawer"],[data-bc-node="bc-pop-layer"],[data-bc-node^="bc-toast-host"],[data-bc-node^="bc-live-"],[data-bc-node="bc-dialog"],[data-bc-node="bc-sheet"],[data-bc-node="bc-tour"],[data-bc-node="bc-cp"],[data-better-canvas="bc-studio-open"],script,noscript,object,embed,link[rel~="preload"],link[rel~="modulepreload"],link[rel~="prefetch"]';
  const OWN_STYLES = ":is(:root, head) > style[data-better-canvas]";
  const sheetText = (sheet) => { try { return [...sheet.cssRules].map((r) => r.cssText).join("\n"); } catch (_) { return ""; } };
  function adoptSheets(live, copy, doc) {
    let text = "";
    try { text = [...(live.adoptedStyleSheets || [])].map(sheetText).join("\n"); } catch (_) {}
    if (text) (copy.querySelector("head") || copy).appendChild(doc.createElement("style")).textContent = text;
  }
  // importNode copies the tree but not shadow roots, CSS added through the CSSOM
  // (Canvas's own components do that, so their <style> tags are empty), or canvas
  // pixels. Both trees are walked in step to fill those in.
  function graft(live, copy, doc, roots) {
    const a = document.createTreeWalker(live, NodeFilter.SHOW_ELEMENT), b = doc.createTreeWalker(copy, NodeFilter.SHOW_ELEMENT), drop = [];
    for (let x = live.nodeType === 1 ? live : a.nextNode(), y = copy.nodeType === 1 ? copy : b.nextNode(); x && y; x = a.nextNode(), y = b.nextNode()) {
      if (x.matches(LEAVE_OUT)) { drop.push(y); continue; }
      if (x.localName === "style" && !x.textContent && x.sheet) y.textContent = sheetText(x.sheet);
      else if (x.localName === "iframe") { y.removeAttribute("src"); y.removeAttribute("srcdoc"); }
      // Lazy images never load in a frame without scripts. Ones the page already
      // loaded come from the cache, and ones it hasn't stay unloaded here too.
      else if (x.localName === "img" && x.complete && x.naturalWidth) y.removeAttribute("loading");
      else if (x.localName === "canvas") try { y.getContext("2d").drawImage(x, 0, 0); } catch (_) {}
      if (x.shadowRoot && !y.shadowRoot) {
        let root;
        try { root = y.attachShadow({ mode: "open" }); } catch (_) { continue; }
        for (const n of x.shadowRoot.childNodes) root.appendChild(doc.importNode(n, true));
        adoptSheets(x.shadowRoot, root, doc);
        roots.push(x.shadowRoot);
        graft(x.shadowRoot, root, doc, roots);
      }
    }
    for (const n of drop) n.remove();
  }
  function syncAttributes(from, to) {
    for (const a of [...to.attributes]) if (!from.hasAttribute(a.name)) to.removeAttribute(a.name);
    for (const a of from.attributes) if (to.getAttribute(a.name) !== a.value) to.setAttribute(a.name, a.value);
  }

  // 0: nothing the preview shows, 1: only Better Canvas's style tags or the
  // html/body attributes, which patch in place, 2: anything else, a full copy.
  function change(r) {
    const n = r.target, t = n.nodeType === 1 ? n : n.parentElement || (n.parentNode || n).host;
    if (!t || t.closest(LEAVE_OUT)) return 0;
    // Card motion pauses offscreen. The copy keeps the state it was taken with,
    // which matches what it shows at its starting scroll position.
    if (r.attributeName === "data-bc-motion-visible") return 0;
    // Canvas rewrites some attributes with the value they already have.
    if (r.type === "attributes" && r.oldValue === t.getAttribute(r.attributeName)) return 0;
    if (r.type === "attributes") return t === document.documentElement || t === document.body ? 1 : 2;
    if (t.matches(OWN_STYLES)) return 1;
    if (r.type === "characterData") return 2;
    const nodes = [...r.addedNodes, ...r.removedNodes];
    if (nodes.every((n) => n.nodeType === 1 && n.matches(LEAVE_OUT))) return 0;
    return nodes.every((n) => n.nodeType === 1 && n.matches("style[data-better-canvas]")) ? 1 : 2;
  }

  function pagePreview(show) {
    const root = el("section", { class: "bcs-live-preview bcs-live-preview--page", "aria-label": "Preview of this page" });
    const caption = el("span", { text: "Live preview · this page" });
    const holder = el("div", { class: "bcs-mirror" });
    // Two frames, so a new copy loads its stylesheets behind the one on screen.
    const frames = [0, 1].map(() => el("iframe", { name: "bc-mirror", sandbox: "allow-same-origin", srcdoc: "<!doctype html><title>Preview</title>", tabindex: "-1", "aria-hidden": "true" }));
    const loaded = new Map(frames.map((f) => [f, new Promise((resolve) => f.addEventListener("load", resolve, { once: true }))]));
    const shield = el("div", { class: "bcs-mirror-shield", "aria-hidden": "true" });
    holder.append(...frames, shield);
    root.append(el("div", { class: "bcs-preview-toolbar" }, [caption, el("span", { class: "bc-spacer" }), el("span", { text: "Canvas" })]), holder);

    let scale = 1, front = null, watching = false, epoch = 0, need = 0, timer = 0, first = 0, built = 0, busy = false, drafted = false, drag = null;
    // The copy gets the window's own size, so viewport units, fixed elements and
    // wallpaper cropping match. The holder takes the window's shape, and a short
    // workspace letterboxes it.
    function fit() {
      holder.style.aspectRatio = innerWidth + " / " + innerHeight;
      if (!holder.clientWidth) return;
      scale = Math.min(holder.clientWidth / innerWidth, holder.clientHeight / innerHeight);
      const left = Math.max(0, (holder.clientWidth - innerWidth * scale) / 2);
      for (const f of frames) f.style.cssText = "width:" + innerWidth + "px;height:" + innerHeight + "px;left:" + left + "px;transform:scale(" + scale + ")";
    }
    new ResizeObserver(fit).observe(holder);

    const clear = (f) => { f.classList.remove("is-front"); f.contentDocument?.documentElement?.replaceChildren(); };
    async function rebuild() {
      const back = frames.find((f) => f !== front), mine = epoch;
      await loaded.get(back);
      if (mine !== epoch) return;
      const doc = back.contentDocument;
      const copy = doc.importNode(document.documentElement, true), roots = [];
      graft(document.documentElement, copy, doc, roots);
      // Watch the shadow roots this copy shows too, like the planner's. Records
      // queued so far are already in the copy.
      observer.takeRecords();
      observer.disconnect();
      for (const node of [document.documentElement, ...roots]) observer.observe(node, WATCH);
      adoptSheets(document, copy, doc);
      copy.querySelector("body")?.setAttribute("inert", "");
      doc.replaceChild(copy, doc.documentElement);
      fit();
      const links = [...doc.querySelectorAll('link[rel~="stylesheet"]')].map((l) => new Promise((resolve) => { l.addEventListener("load", resolve); l.addEventListener("error", resolve); }));
      await Promise.race([Promise.all(links).then(() => { void doc.documentElement.offsetHeight; return doc.fonts.ready; }), new Promise((resolve) => setTimeout(resolve, 1500))]);
      if (mine !== epoch) return;
      const from = front ? front.contentWindow : window;
      back.contentWindow.scrollTo(from.scrollX, from.scrollY);
      back.classList.add("is-front");
      if (front) clear(front);
      front = back;
    }
    function patch() {
      const doc = front.contentDocument, have = new Map([...doc.querySelectorAll(OWN_STYLES)].map((s) => [s.getAttribute("data-better-canvas"), s]));
      for (const s of document.querySelectorAll(OWN_STYLES)) {
        if (s.matches(LEAVE_OUT)) continue;
        const key = s.getAttribute("data-better-canvas");
        let tag = have.get(key);
        have.delete(key);
        if (!tag) { tag = doc.head.appendChild(doc.createElement("style")); tag.setAttribute("data-better-canvas", key); }
        if (tag.textContent !== s.textContent) tag.textContent = s.textContent;
      }
      for (const tag of have.values()) tag.remove();
      syncAttributes(document.documentElement, doc.documentElement);
      syncAttributes(document.body, doc.body);
      doc.body.setAttribute("inert", "");
    }
    // Style changes patch on the next task. A full copy waits for the page to
    // settle, 150ms after the last change but never more than 600ms behind it,
    // and comes at most once a second, so a page that keeps changing can't keep
    // the copy rebuilding and its images reloading.
    function want(level) {
      need = Math.max(need, level);
      if (busy) return;
      const now = Date.now();
      if (!timer) first = now;
      clearTimeout(timer);
      timer = setTimeout(run, need === 1 ? 0 : Math.max(now - first >= 600 ? 0 : 150, built + 1000 - now));
    }
    async function run() {
      timer = 0;
      if (!holder.isConnected) return stop();
      const level = need;
      need = 0;
      if (level === 1 && front) return patch();
      busy = true;
      built = Date.now();
      try { await rebuild(); } catch (e) { BC.diag?.push?.("page preview", e); } finally { busy = false; }
      if (need && watching) want(need);
    }
    const WATCH = { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true };
    const observer = new MutationObserver((records) => {
      let level = 0;
      for (const r of records) if ((level = Math.max(level, change(r))) === 2) break;
      if (level) want(level);
    });
    // Only while the preview is on screen. Closing the workspace drops both copies.
    function start() {
      if (watching) return;
      watching = true;
      observer.observe(document.documentElement, WATCH);
      addEventListener("resize", fit);
      want(2);
    }
    function stop() {
      watching = false;
      epoch++;
      observer.disconnect();
      removeEventListener("resize", fit);
      clearTimeout(timer);
      timer = need = 0;
      front = null;
      for (const f of frames) clear(f);
    }
    new IntersectionObserver((entries) => entries.at(-1).isIntersecting ? start() : stop()).observe(holder);

    // The copy can't be clicked or focused. Wheel and drag scroll it.
    const pan = (dx, dy) => front?.contentWindow.scrollBy(dx / scale, dy / scale);
    shield.addEventListener("wheel", (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? holder.clientHeight : 1;
      pan(e.deltaX * unit, e.deltaY * unit);
    }, { passive: false });
    shield.addEventListener("pointerdown", (e) => { if (e.button === 0) { drag = [e.clientX, e.clientY]; shield.setPointerCapture(e.pointerId); } });
    shield.addEventListener("pointermove", (e) => { if (drag) { pan(drag[0] - e.clientX, drag[1] - e.clientY); drag = [e.clientX, e.clientY]; } });
    shield.addEventListener("pointerup", () => { drag = null; });
    shield.addEventListener("pointercancel", () => { drag = null; });

    return { root, paint(settings, name) {
      caption.textContent = name ? "Previewing " + name : "Live preview · this page";
      // A theme being tried out isn't saved, so the page only shows it through
      // here. Cancel, Apply or closing the workspace paints the saved state back.
      if (name || drafted) { drafted = !!name; show(settings, drafted); }
    } };
  }

  BC.StudioPreview = function (show) {
    if (show && BC.detect?.isCanvas?.()) return pagePreview(show);
    const cards = [...document.querySelectorAll(".ic-DashboardCard")].map((n, i) => ({
      id: n.dataset.courseId || n.querySelector('a[href*="/courses/"]')?.getAttribute("href")?.match(/courses\/(\d+)/)?.[1] || String(i),
      name: n.querySelector(".ic-DashboardCard__header-title")?.textContent?.trim() || n.getAttribute("aria-label") || "Course " + (i + 1),
      image: n.querySelector(".ic-DashboardCard__header_image")?.style.backgroundImage || "",
    })).slice(0, 12);
    if (!cards.length) for (let i = 0; i < 9; i++) cards.push({ id: String(i), name: ["Creative writing", "Visual storytelling", "Computer science", "World history", "Studio arts", "Statistics", "Literature", "Design systems", "Astronomy"][i], image: "" });
    const root = el("section", { class: "bcs-live-preview", "aria-label": "Canvas layout preview" });
    const caption = el("span", { text: "Sample page · open settings on Canvas to preview your own" });
    const viewport = el("div", { class: "bcs-preview-canvas" });
    root.append(el("div", { class: "bcs-preview-toolbar" }, [caption, el("span", { class: "bc-spacer" }), el("span", { text: "Canvas" })]), viewport);
    let last = "";
    return { root, paint(settings, name) {
      const sig = JSON.stringify([settings.theming, settings.dashboard, settings.cosmetics, settings.todo, settings.calendar]);
      caption.textContent = name ? "Previewing " + name : "Sample page · open settings on Canvas to preview your own";
      if (sig === last) return; last = sig;
      const t = settings.theming, dark = BC.isDarkActive(settings), p = BC.color.themePalettes(t)[dark ? "dark" : "light"];
      viewport.style.cssText = "--pv-bg:" + p.bg + ";--pv-panel:" + p.bg2 + ";--pv-text:" + p.text + ";--pv-muted:" + p.muted + ";--pv-border:" + p.border + ";--bc-accent:" + (t.accentColor || p.accent) + ";--bc-border:" + p.border + ";--pv-radius:" + Math.min(24, t.radius) + "px;";
      const bg = settings.cosmetics.background;
      const wallpaper = el("div", { class: "bcs-preview-wallpaper" });
      if (bg.mode === "image") wallpaper.style.cssText = BC.themeMedia.style(bg.image);
      else if (bg.mode === "color") wallpaper.style.backgroundColor = bg.color;
      else if (bg.mode === "gradient") wallpaper.style.backgroundImage = "linear-gradient(" + (bg.gradient.angle | 0) + "deg," + BC.util.cssSafe(bg.gradient.from) + "," + BC.util.cssSafe(bg.gradient.to) + ")";
      else if (bg.mode === "pattern") wallpaper.style.backgroundImage = "radial-gradient(var(--pv-muted) 1px,transparent 1px)", wallpaper.style.backgroundSize = "12px 12px";
      wallpaper.style.opacity = Math.max(0, Math.min(100, bg.opacity)) / 100;
      wallpaper.style.filter = "blur(" + Math.max(0, Math.min(40, bg.blur)) / 2 + "px)";
      wallpaper.hidden = bg.when === "dark" && !dark || bg.when === "light" && dark;
      const assigned = BC.assignThemeImages(settings.dashboard.themeImages, cards.map((c) => c.id));
      const grid = el("div", { class: "bcs-preview-grid" });
      grid.dataset.layout = settings.dashboard.layout;
      grid.dataset.size = settings.dashboard.cardSize;
      for (const course of cards) {
        const art = assigned.get(course.id), custom = settings.dashboard.courses?.[course.id] || {};
        if (custom.hidden) continue;
        const hero = el("div", { class: "bcs-preview-art" });
        if (custom.bgImage || art) hero.style.cssText = BC.themeMedia.style(custom.bgImage || art.url);
        else hero.style.backgroundImage = course.image;
        grid.appendChild(el("div", { class: "bcs-preview-card" }, [hero,
          el("div", { class: "bcs-preview-card-body" }, [el("strong", { text: custom.nickname || course.name }), el("span", { text: "Course materials" }), el("div", { class: "bcs-preview-card-icons" }, [BC.ui.icon("folder"), BC.ui.icon("calendar"), BC.ui.icon("message")])])
        ]));
      }
      const todo = el("aside", { class: "bcs-preview-todo" }, [el("strong", { text: "Your week" }), el("span", { text: "TO DO" })]);
      if (settings.todo.mode === "custom" && settings.todo.ring !== false) todo.append(BC.progressArt(settings.todo.progressStyle, 2, 5));
      if (settings.todo.mode === "custom") todo.append(el("small", { text: ({ list: "List", kanban: "Board", timeblock: "Day plan" }[settings.todo.view] || "List") + " · " + settings.todo.rangeDays + " days" }));
      for (const title of ["Read chapter three", "Sketch a new idea", "Review your notes"]) todo.append(el("div", { class: "bcs-preview-task" }, [el("span", { text: "○" }), el("span", { text: title })]));
      todo.append(el("div", { class: "bcs-preview-add", text: "+ Add a task" }));
      todo.hidden = settings.dashboard.hideSidebar || settings.dashboard.widgets.todo === false;
      if (settings.calendar.miniOnDashboard) todo.append(el("strong", { text: "Calendar" }), el("span", { text: "M  T  W  T  F  S  S" }));
      const nav = el("div", { class: "bcs-preview-nav" }, [el("b", { text: "BC" }), ...["grid", "book", "calendar", "message", "folder"].map((i) => BC.ui.icon(i))]);
      viewport.replaceChildren(wallpaper, nav, el("div", { class: "bcs-preview-page" }, [el("div", { class: "bcs-preview-heading" }, [el("h3", { text: "A space to make it yours." }), el("span", { text: "Dashboard" })]), el("div", { class: "bcs-preview-columns" }, [grid, todo])]));
      viewport.querySelector(".bcs-preview-columns").classList.toggle("no-sidebar", todo.hidden);
      if (!t.reducedMotion) viewport.append(el("style", null, BC.themeMotionCSS(settings.cosmetics.motion, ".bcs-preview-art")));
    } };
  };
  BC.studioCSS = `
  .bc-app .bcs-shell {max-width:none;grid-template-columns:164px minmax(0,1fr);border:0;width:100%}
  .bc-app .bcs-nav {padding:18px 10px;background:var(--bc-surface-1)}
  .bc-app .bcs-header {height:66px;padding:0 22px;gap:24px}
  .bc-app .bcs-logo {width:36px;height:36px;border-radius:12px;font-size:13px}
  .bc-app .bcs-nav__item {min-height:44px;border-radius:12px;margin:3px 0;font-weight:550}
  .bc-app .bcs-nav__group {margin-top:24px}
  .bcs-workspace {display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--bc-surface-2)}
  .bcs-workspace-head {padding:23px 26px 0;flex:none}
  .bcs-workspace-head h1 {font-size:26px;font-weight:650;letter-spacing:-.8px}
  .bcs-workspace-head p {font-size:13px;color:var(--bc-text-muted);margin-top:5px}
  .bcs-subnav {display:flex;gap:20px;overflow-x:auto;white-space:nowrap;margin-top:20px;border-bottom:1px solid var(--bc-border);scrollbar-width:thin}
  .bcs-subnav button {border:0;border-bottom:3px solid transparent;background:none;padding:10px 0 13px;font-weight:550;cursor:pointer;color:var(--bc-text-muted)}
  .bcs-subnav button[aria-current] {border-color:var(--bc-accent);color:var(--bc-text)}
  .bcs-workspace-body {display:grid;grid-template-columns:minmax(0,1.15fr) minmax(370px,1fr);gap:24px;min-height:0;flex:1;padding:24px}
  .bcs-workspace-body:not(.is-editing) {display:block;overflow:auto;padding:0}
  .bc-app .bcs-main {min-width:0;padding:0 4px 36px;overflow:auto;min-height:0}
  .bcs-workspace-body:not(.is-editing) .bcs-main {padding:24px;max-width:1100px;margin:auto}
  .bcs-workspace-body:not(.is-editing) .bcs-page__head {display:none}
  .bcs-workspace .bcs-theme-categories [aria-pressed="true"], .bcs-workspace .bcs-inline > [aria-pressed="true"] {background:var(--bc-accent-weak);color:var(--bc-text)}
  .bcs-workspace-body.is-editing .bcs-page__head {display:none}
  .bcs-workspace .bcs-section {border-radius:18px;margin-bottom:18px}
  .bcs-workspace .bcs-section__body {padding:16px}
  .bcs-workspace .bcs-themes {grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .bcs-workspace .bcs-theme__preview {height:118px}
  .bcs-workspace .bcs-theme__description {font-size:11px;line-height:1.45}
  .bcs-preview-column {display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0}
  .bcs-live-preview {min-height:0;overflow:hidden;border-radius:16px;border:1px solid var(--bc-border);box-shadow:0 12px 32px #0001;flex:1;background:var(--bc-surface-1)}
  .bcs-preview-toolbar {display:flex;gap:10px;padding:13px 16px;font-size:11px;color:var(--bc-text-muted);border-bottom:1px solid var(--bc-border)}
  .bcs-preview-canvas {position:relative;isolation:isolate;height:calc(100% - 42px);overflow:auto;display:flex;background-color:var(--pv-bg);color:var(--pv-text);font-size:10px;min-height:280px}
  .bcs-preview-wallpaper {position:absolute;inset:0;z-index:-1;pointer-events:none}
  .bcs-live-preview--page {flex:0 1 auto;display:flex;flex-direction:column}
  .bcs-mirror {position:relative;flex:0 1 auto;min-height:0;overflow:hidden;background:var(--bc-surface-2)}
  .bcs-mirror iframe {position:absolute;top:0;left:0;border:0;transform-origin:0 0}
  .bcs-mirror iframe.is-front {z-index:1}
  .bcs-mirror-shield {position:absolute;inset:0;z-index:2;cursor:grab;touch-action:none}.bcs-mirror-shield:active{cursor:grabbing}
  .bcs-preview-nav {width:34px;flex:none;display:flex;align-items:center;flex-direction:column;gap:27px;padding:15px 6px;background:color-mix(in srgb,var(--pv-panel) 90%,transparent)}
  .bcs-preview-nav .bc-icon {width:15px;height:15px}.bcs-preview-nav b{font-size:10px;color:var(--bc-accent)}
  .bcs-preview-page {padding:24px 16px;flex:1;min-width:0}
  .bcs-preview-heading {background:color-mix(in srgb,var(--pv-panel) 90%,transparent);border-radius:var(--pv-radius);padding:18px;margin-bottom:18px}
  .bcs-preview-heading h3 {font-family:Georgia,serif;font-size:23px;line-height:1.15;letter-spacing:-.6px;margin-bottom:10px}
  .bcs-preview-heading span {font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--pv-muted)}
  .bcs-preview-columns {display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:13px;align-items:start}
  .bcs-preview-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .bcs-preview-grid[data-layout="list"]{grid-template-columns:1fr}.bcs-preview-grid[data-layout="list"] .bcs-preview-card{display:flex}.bcs-preview-grid[data-layout="list"] .bcs-preview-art{width:38%;flex:none;height:auto;min-height:80px}
  .bcs-preview-grid[data-layout="compact"] .bcs-preview-art{height:44px}.bcs-preview-grid[data-size="s"]:not([data-layout="list"]){grid-template-columns:repeat(3,minmax(0,1fr))}
  .bcs-preview-columns.no-sidebar {grid-template-columns:1fr}
  .bcs-preview-card {overflow:hidden;border-radius:var(--pv-radius);background:var(--pv-panel);border:1px solid var(--pv-border)}
  .bcs-preview-art {height:90px;background:var(--bc-accent);background-size:cover;background-position:center}
  .bcs-preview-card-body {padding:11px}.bcs-preview-card-body strong {display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:10px;line-height:1.45;min-height:28px}
  .bcs-preview-card-body>span {display:block;color:var(--pv-muted);font-size:8px;margin-top:6px}
  .bcs-preview-card-icons {display:flex;gap:15px;margin-top:14px;color:var(--pv-muted)}.bcs-preview-card-icons .bc-icon{width:11px;height:11px}
  .bcs-preview-todo {border-radius:var(--pv-radius);padding:13px 10px;background:var(--pv-panel);display:flex;flex-direction:column;gap:13px;border:1px solid var(--pv-border)}
  .bcs-preview-todo>span {letter-spacing:1px;font-size:7px;color:var(--pv-muted)}
  .bcs-preview-task {display:flex;gap:5px;line-height:1.5;font-size:8px;border-bottom:1px solid var(--pv-border);padding-bottom:9px}
  .bcs-preview-add {font-size:8px;color:var(--pv-muted);padding:6px;border:1px solid var(--pv-border);border-radius:20px}
  .bcs-draft-bar {padding:15px;background:var(--bc-surface-1);border:1px solid var(--bc-border);border-radius:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px}
  .bcs-draft-bar strong {flex:1;min-width:100px}
  .bcs-progress-art {position:relative;width:80px;max-width:100%;margin:0 auto;text-align:center;flex:none}
  .bcs-progress-art svg {width:100%;height:auto;display:block}.bcs-progress-art>span{display:block;font-size:11px;font-weight:600;margin-top:4px}
  .bcs-theme-art {display:block;background-size:cover;background-position:center;min-height:44px}
  .bcs-theme__preview>.bcs-theme-art {position:absolute;inset:0}
  .bcs-theme__mini-cards .bcs-theme-art {height:44px}
  .bcs-progress-picker {grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px}.bcs-progress-picker .bcs-choice__preview{height:90px;display:flex;align-items:center;justify-content:center}.bcs-progress-picker .bcs-progress-art{width:48px}.bcs-progress-picker .bcs-progress-art>span{display:none}.bcs-progress-picker .bcs-choice__text{padding:8px;text-align:center}
  .bcs-motion-badge {position:absolute;left:9px;top:9px;white-space:nowrap;background:#151a27d9;color:white;font-size:9px;padding:4px 7px;border-radius:20px}
  @media(min-width:1600px){.bcs-preview-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.bcs-preview-art{height:115px}.bcs-preview-columns{grid-template-columns:minmax(0,1fr) 140px}}
  @media(max-width:1100px){.bc-app .bcs-shell{grid-template-columns:70px minmax(0,1fr)}.bc-app .bcs-nav__label,.bc-app .bcs-nav__group,.bc-app .bcs-master__text{display:none}.bc-app .bcs-nav__item{justify-content:center}.bcs-workspace-body{gap:14px;padding:16px;grid-template-columns:minmax(0,1fr) minmax(340px,1fr)}.bcs-preview-columns{display:block}.bcs-preview-todo{display:none}.bcs-preview-heading h3{font-size:20px}}
  @media(max-width:760px){.bcs-workspace .bcs-inline{flex-wrap:wrap;max-width:100%}.bcs-workspace .bc-seg{flex-wrap:wrap;width:100%;height:auto;max-width:100%;border-radius:12px}.bcs-workspace .bc-seg__thumb{display:none}.bcs-workspace .bc-seg .bc-seg__opt[aria-checked="true"]{background:var(--bc-surface-2)}.bcs-workspace .bc-seg__opt{flex:1 1 auto}.bc-app .bcs-shell{grid-template-columns:54px minmax(0,1fr)}.bc-app .bcs-header{height:58px;padding:0 10px;gap:10px}.bcs-brand__text{display:none}.bcs-header .bcs-search{min-width:60px}.bcs-workspace-head{padding:16px 14px 0}.bcs-workspace-head h1{font-size:23px}.bcs-subnav{gap:18px;margin-top:12px}.bcs-workspace-body{display:block;overflow:auto;padding:14px}.bcs-preview-column{height:300px;margin-bottom:18px}.bcs-live-preview{min-height:210px}.bcs-preview-canvas{min-height:0}.bcs-preview-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.bcs-preview-heading{display:none}.bcs-preview-art{height:65px}.bcs-preview-page{padding:12px}.bcs-preview-card-body{padding:7px}.bcs-preview-card-icons{display:none}.bc-app .bcs-main{overflow:visible}.bcs-workspace .bcs-themes{grid-template-columns:repeat(2,minmax(0,1fr))}.bcs-workspace .bcs-section{padding:12px}.bcs-workspace .bcs-theme__preview{height:92px}.bc-app .bcs-nav{padding:12px 4px}.bcs-header__actions{gap:0}.bcs-draft-bar{position:fixed;left:66px;right:12px;bottom:12px;z-index:5;box-shadow:var(--bc-shadow-3,0 10px 30px rgba(0,0,0,.25))}}
  `;
})();
