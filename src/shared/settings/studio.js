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
  BC.StudioPreview = function () {
    const cards = [...document.querySelectorAll(".ic-DashboardCard")].map((n, i) => ({
      id: n.dataset.courseId || n.querySelector('a[href*="/courses/"]')?.getAttribute("href")?.match(/courses\/(\d+)/)?.[1] || String(i),
      name: n.querySelector(".ic-DashboardCard__header-title")?.textContent?.trim() || n.getAttribute("aria-label") || "Course " + (i + 1),
      image: n.querySelector(".ic-DashboardCard__header_image")?.style.backgroundImage || "",
    })).slice(0, 12);
    if (!cards.length) for (let i = 0; i < 9; i++) cards.push({ id: String(i), name: ["Creative writing", "Visual storytelling", "Computer science", "World history", "Studio arts", "Statistics", "Literature", "Design systems", "Astronomy"][i], image: "" });
    const root = el("section", { class: "bcs-live-preview", "aria-label": "Canvas layout preview" });
    const caption = el("span", { text: "Layout preview · sample tasks" });
    const viewport = el("div", { class: "bcs-preview-canvas" });
    root.append(el("div", { class: "bcs-preview-toolbar" }, [caption, el("span", { class: "bc-spacer" }), el("span", { text: "Canvas" })]), viewport);
    let last = "";
    return { root, paint(settings, name) {
      const sig = JSON.stringify([settings.theming, settings.dashboard, settings.cosmetics, settings.todo]);
      caption.textContent = name ? "Previewing " + name : "Layout preview · sample tasks";
      if (sig === last) return; last = sig;
      const t = settings.theming, dark = BC.isDarkActive(settings), p = BC.color.themePalettes(t)[dark ? "dark" : "light"];
      viewport.style.cssText = "--pv-bg:" + p.bg + ";--pv-panel:" + p.bg2 + ";--pv-text:" + p.text + ";--pv-muted:" + p.muted + ";--pv-border:" + p.border + ";--bc-accent:" + (t.accentColor || p.accent) + ";--bc-border:" + p.border + ";--pv-radius:" + Math.min(24, t.radius) + "px;";
      const bg = settings.cosmetics.background;
      if (bg.mode === "image") viewport.style.cssText += BC.themeMedia.style(bg.image);
      else if (bg.mode === "color") viewport.style.backgroundColor = bg.color;
      else if (bg.mode === "gradient") viewport.style.backgroundImage = "linear-gradient(" + (bg.gradient.angle | 0) + "deg," + BC.util.cssSafe(bg.gradient.from) + "," + BC.util.cssSafe(bg.gradient.to) + ")";
      const assigned = BC.assignThemeImages(settings.dashboard.themeImages, cards.map((c) => c.id));
      const grid = el("div", { class: "bcs-preview-grid" });
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
      if (settings.todo.ring !== false) todo.append(BC.progressArt(settings.todo.progressStyle, 2, 5));
      for (const title of ["Read chapter three", "Sketch a new idea", "Review your notes"]) todo.append(el("div", { class: "bcs-preview-task" }, [el("span", { text: "○" }), el("span", { text: title })]));
      todo.append(el("div", { class: "bcs-preview-add", text: "+ Add a task" }));
      const nav = el("div", { class: "bcs-preview-nav" }, [el("b", { text: "BC" }), ...["grid", "book", "calendar", "message", "folder"].map((i) => BC.ui.icon(i))]);
      viewport.replaceChildren(nav, el("div", { class: "bcs-preview-page" }, [el("div", { class: "bcs-preview-heading" }, [el("h3", { text: "A space to make it yours." }), el("span", { text: "Dashboard" })]), el("div", { class: "bcs-preview-columns" }, [grid, todo])]));
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
  .bcs-workspace-body.is-editing .bcs-page__head {display:none}
  .bcs-workspace .bcs-section {border-radius:18px;margin-bottom:18px}
  .bcs-workspace .bcs-section__body {padding:16px}
  .bcs-workspace .bcs-themes {grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .bcs-workspace .bcs-theme__preview {height:118px}
  .bcs-workspace .bcs-theme__description {font-size:11px;line-height:1.45}
  .bcs-preview-column {display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0}
  .bcs-live-preview {min-height:0;overflow:hidden;border-radius:16px;border:1px solid var(--bc-border);box-shadow:0 12px 32px #0001;flex:1;background:var(--bc-surface-1)}
  .bcs-preview-toolbar {display:flex;gap:10px;padding:13px 16px;font-size:11px;color:var(--bc-text-muted);border-bottom:1px solid var(--bc-border)}
  .bcs-preview-canvas {height:calc(100% - 42px);overflow:auto;display:flex;background-color:var(--pv-bg);color:var(--pv-text);font-size:10px;min-height:280px}
  .bcs-preview-nav {width:34px;flex:none;display:flex;align-items:center;flex-direction:column;gap:27px;padding:15px 6px;background:color-mix(in srgb,var(--pv-panel) 90%,transparent)}
  .bcs-preview-nav .bc-icon {width:15px;height:15px}.bcs-preview-nav b{font-size:10px;color:var(--bc-accent)}
  .bcs-preview-page {padding:24px 16px;flex:1;min-width:0}
  .bcs-preview-heading {background:color-mix(in srgb,var(--pv-panel) 90%,transparent);border-radius:var(--pv-radius);padding:18px;margin-bottom:18px}
  .bcs-preview-heading h3 {font-family:Georgia,serif;font-size:23px;line-height:1.15;letter-spacing:-.6px;margin-bottom:10px}
  .bcs-preview-heading span {font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--pv-muted)}
  .bcs-preview-columns {display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:13px;align-items:start}
  .bcs-preview-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
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
  .bcs-motion-badge {position:absolute;left:9px;top:9px;background:#151a27d9;color:white;font-size:9px;padding:4px 7px;border-radius:20px}
  @media(min-width:1600px){.bcs-preview-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.bcs-preview-art{height:115px}.bcs-preview-columns{grid-template-columns:minmax(0,1fr) 140px}}
  @media(max-width:1100px){.bc-app .bcs-shell{grid-template-columns:70px minmax(0,1fr)}.bc-app .bcs-nav__label,.bc-app .bcs-nav__group,.bc-app .bcs-master__text{display:none}.bc-app .bcs-nav__item{justify-content:center}.bcs-workspace-body{gap:14px;padding:16px;grid-template-columns:minmax(0,1fr) minmax(340px,1fr)}.bcs-preview-columns{display:block}.bcs-preview-todo{display:none}.bcs-preview-heading h3{font-size:20px}}
  @media(max-width:760px){.bc-app .bcs-shell{grid-template-columns:54px minmax(0,1fr)}.bc-app .bcs-header{height:58px;padding:0 10px;gap:10px}.bcs-brand__text{display:none}.bcs-header .bcs-search{min-width:60px}.bcs-workspace-head{padding:16px 14px 0}.bcs-workspace-head h1{font-size:23px}.bcs-subnav{gap:18px;margin-top:12px}.bcs-workspace-body{display:block;overflow:auto;padding:14px}.bcs-preview-column{height:300px;margin-bottom:18px}.bcs-live-preview{min-height:210px}.bcs-preview-canvas{min-height:0}.bcs-preview-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.bcs-preview-heading{display:none}.bcs-preview-art{height:65px}.bcs-preview-page{padding:12px}.bcs-preview-card-body{padding:7px}.bcs-preview-card-icons{display:none}.bc-app .bcs-main{overflow:visible}.bcs-workspace .bcs-themes{grid-template-columns:repeat(2,minmax(0,1fr))}.bcs-workspace .bcs-section{padding:12px}.bcs-workspace .bcs-theme__preview{height:92px}.bc-app .bcs-nav{padding:12px 4px}.bcs-header__actions{gap:0}}
  `;
})();
