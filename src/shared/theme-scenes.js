/* Original, offline scene collections. Each seed draws a different composition. */
(function () {
  "use strict";
  const BC = globalThis.BC;
  const scenes = [
    { id: "woodland", name: "Forest Retreat", category: "nature", dark: true, colors: ["#102f2b", "#347364", "#9cbea3", "#e5d8a6"], accent: "#90c9a6", description: "Layered evergreen forests · soft glass · moss green" },
    { id: "alpine", name: "Alpine Morning", category: "nature", dark: false, colors: ["#b4ced4", "#668e9c", "#e4e8df", "#e7c9a1"], accent: "#396878", description: "Alpine peaks · cool mist · open, airy surfaces" },
    { id: "dunes", name: "Desert Solstice", category: "nature", dark: false, colors: ["#edc7a3", "#b86f4f", "#d39168", "#f7e8c4"], accent: "#9c482e", description: "Sculpted dunes · terracotta · warm editorial type" },
    { id: "orbit", name: "Lunar Observatory", category: "space", dark: true, colors: ["#0b1429", "#324974", "#8aabcf", "#e3d6bd"], accent: "#a8c5ec", description: "Planetary studies · midnight glass · fine orbital lines" },
    { id: "nebula", name: "Cosmic Bloom", category: "space", dark: true, colors: ["#1e1036", "#653b96", "#c871a9", "#b3c3ff"], accent: "#d0a3f0", description: "Clouds of stardust · violet glow · deep plum panels" },
    { id: "aurora", name: "Northern Lights", category: "space", dark: true, colors: ["#071d2b", "#1e6b71", "#79d9b6", "#b7a2e8"], accent: "#8ee0c1", description: "Aurora ribbons · arctic silhouettes · luminous mint" },
    { id: "metro", name: "After Hours", category: "city", dark: true, colors: ["#101c35", "#283a62", "#e09d94", "#87cbd5"], accent: "#f0b4a4", description: "Night skylines · warm windows · smoked blue glass" },
    { id: "blueprint", name: "City Blueprint", category: "city", dark: true, colors: ["#0c2942", "#1c4862", "#90b9cb", "#e0c7a3"], accent: "#9dd5eb", description: "Architectural drawings · drafting grid · crisp edges" },
    { id: "gallery", name: "Bauhaus Studio", category: "art", dark: false, colors: ["#efe2c8", "#c85c3e", "#234d60", "#d8ab42"], accent: "#a8402e", description: "Original geometric compositions · cream paper · gallery frames" },
    { id: "collage", name: "Cut Paper", category: "art", dark: false, colors: ["#f0e5e0", "#b36e78", "#607e74", "#dfa36a"], accent: "#8f4459", description: "Layered paper shapes · muted pastels · sculptural corners" },
    { id: "paper", name: "Quiet Hours", category: "minimal", dark: false, colors: ["#e8e2d6", "#c0b4a1", "#8f9786", "#a48d78"], accent: "#655d4d", description: "Architectural shadows · warm linen · bookish typography" },
    { id: "mono", name: "Graphite", category: "minimal", dark: true, colors: ["#181b20", "#373d47", "#6a737b", "#b5b9b5"], accent: "#bdc9c4", description: "Monochrome forms · hairline borders · precise typography" },
  ];
  const byId = Object.assign(Object.create(null), Object.fromEntries(scenes.map((s) => [s.id, s])));
  const cache = new Map();
  function artwork(id, seed, wallpaper = false) {
    const s = byId[id] || byId.woodland;
    const key = s.id + ":" + seed + ":" + wallpaper;
    if (cache.has(key)) return cache.get(key);
    let n = (Number(seed) + 1) * 2654435761 >>> 0;
    const rand = (lo, hi) => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return lo + (n >>> 0) / 4294967296 * (hi - lo); };
    const int = (lo, hi) => Math.round(rand(lo, hi));
    const [bg, mid, fg, glow] = s.colors;
    const shapes = [];
    const circle = (x, y, r, fill, opacity = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
    const path = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
    const sunX = int(140, 1060), sunY = int(70, 270);
    if (["woodland", "alpine", "dunes"].includes(s.id)) {
      shapes.push(circle(sunX, sunY, int(36, 75), glow, .85));
      for (let layer = 0; layer < 5; layer++) {
        const y = 200 + layer * 75;
        let d = `M-100 800L-100 ${y}`;
        for (let x = -100; x <= 1400; x += 150) {
          d += s.id === "alpine" ? `L${x} ${int(y - 170, y + 35)}` : `Q${x - 75} ${int(y - 130, y + 50)} ${x + 75} ${int(y - 15, y + 70)}`;
        }
        shapes.push(path(d + "L1400 800Z", [fg, mid, bg, mid, bg][layer], `opacity="${.35 + layer * .15}"`));
        if (s.id === "woodland") for (let j = 0; j < 12; j++) {
          const x = int(-40, 1240), h = int(45, 100) + layer * 20, base = y + int(70, 150);
          shapes.push(path(`M${x} ${base - h}l${h / 3} ${h}h${-h * 2 / 3}Z`, layer > 2 ? bg : mid, `opacity="${.3 + layer * .16}"`));
        }
      }
    } else if (["orbit", "nebula", "aurora"].includes(s.id)) {
      if (s.id === "nebula") for (let j = 0; j < 8; j++) shapes.push(`<ellipse cx="${int(50, 1150)}" cy="${int(30, 650)}" rx="${int(100, 380)}" ry="${int(40, 170)}" fill="${j % 2 ? fg : mid}" opacity=".27" filter="url(#soft)" transform="rotate(${int(-40, 40)} 600 350)"/>`);
      if (s.id === "aurora") for (let j = 0; j < 5; j++) shapes.push(path(`M-100 ${int(0, 300)}Q${int(200, 450)} ${int(350, 600)} 650 170T1300 ${int(50, 350)}`, "none", `stroke="${j % 2 ? glow : fg}" stroke-width="${int(15, 65)}" opacity=".2" filter="url(#soft)"`));
      for (let j = 0; j < 65; j++) shapes.push(circle(int(0, 1200), int(0, 700), rand(.4, 2).toFixed(1), glow, rand(.2, .8).toFixed(2)));
      if (s.id === "orbit") {
        const r = int(75, 185);
        shapes.push(`<ellipse cx="${sunX}" cy="${sunY + 100}" rx="${r * 2.6}" ry="${r * .5}" fill="none" stroke="${fg}" opacity=".35" transform="rotate(-24 ${sunX} ${sunY + 100})"/>`);
        shapes.push(circle(sunX, sunY + 100, r, "url(#planet)"));
        for (let j = 0; j < 9; j++) shapes.push(circle(sunX + int(-r / 2, r / 2), sunY + 100 + int(-r / 2, r / 2), int(4, r / 9), bg, .17));
        shapes.push(circle(int(140, 1000), int(60, 600), int(15, 35), mid));
      }
      shapes.push(path(`M0 700V${int(560, 640)}L200 590L${int(350, 600)} 500L800 600L1200 540V700Z`, bg));
    } else if (["metro", "blueprint"].includes(s.id)) {
      shapes.push(circle(sunX, sunY, int(25, 55), glow, .75));
      if (s.id === "blueprint") for (let x = 0; x < 1200; x += 32) shapes.push(path(`M${x} 0V700M0 ${x}H1200`, "none", `stroke="${fg}" opacity=".1"`));
      for (let layer = 0; layer < 3; layer++) for (let x = -30; x < 1250;) {
        const w = int(45, 120), h = int(90, 380), y = 610 - h + layer * 20;
        shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${layer === 1 ? mid : bg}" stroke="${fg}" stroke-opacity="${s.id === "blueprint" ? .6 : .12}"/>`);
        if (rand(0, 1) > .55) shapes.push(path(`M${x + w / 2} ${y}v-25`, "none", `stroke="${fg}" opacity=".5"`));
        let windows = "";
        for (let wx = x + 10; wx < x + w - 8; wx += 20) for (let wy = y + 15; wy < 580; wy += 30) {
          if (rand(0, 1) > .58) windows += `M${wx} ${wy}h4v8h-4z`;
        }
        shapes.push(path(windows, layer % 2 ? fg : glow, 'opacity=".5"'));
        x += w + int(5, 22);
      }
      shapes.push(path("M0 625H1200", "none", `stroke="${glow}" opacity=".35"`));
    } else {
      // Different arrangements, shapes and negative space for every card.
      for (let j = 0; j < 7; j++) {
        const x = int(-60, 1060), y = int(-60, 580), w = int(80, 300), h = int(80, 330), fill = [mid, fg, glow][j % 3];
        if (s.id === "collage") shapes.push(path(`M${x} ${y}q${w} ${-h / 2} ${w} ${h / 2}t${-w / 2} ${h / 2}t${-w / 2} ${-h}Z`, fill, 'opacity=".85"'));
        else if (j % 3 === 0) shapes.push(circle(x, y, w / 2, fill, .75));
        else shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s.id === "paper" ? w / 2 : 0}" fill="${fill}" opacity=".75" transform="rotate(${s.id === "gallery" ? 0 : int(-35, 35)} ${x} ${y})"/>`);
      }
      if (s.id !== "collage") for (let j = 0; j < 6; j++) shapes.push(path(`M${150 + j * 24} 70v540`, "none", `stroke="${bg}" stroke-width="2" opacity=".7"`));
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${wallpaper ? 1000 : 850}" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="${mid}"/></linearGradient><linearGradient id="planet" x2="1" y2=".6"><stop stop-color="${glow}"/><stop offset=".55" stop-color="${fg}"/><stop offset="1" stop-color="${bg}"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="18"/></filter></defs><path fill="url(#sky)" d="M0 0H1200V700H0Z"/>${shapes.join("")}</svg>`;
    const result = { url: "data:image/svg+xml," + encodeURIComponent(svg), title: s.name + " · composition " + (seed + 1), creator: "Better Canvas", license: "Original artwork" };
    if (cache.size > 1024) cache.clear();
    cache.set(key, result);
    return result;
  }
  BC.sceneArt = artwork;
  BC.themeScenes = byId;
  for (const s of scenes) {
    const theme = BC.themeLibrary.makeTheme([], s);
    let images;
    Object.defineProperty(theme.settings.dashboard, "themeImages", { enumerable: true,
      get() { return images || (images = Array.from({ length: 48 }, (_, i) => artwork(s.id, i))); } });
    theme.id = "scene-" + s.id;
    theme.description = s.description;
    Object.assign(theme.settings.theming, {
      experience: s.id, darkBg: s.colors[0], lightBg: s.colors[0], accentColor: s.accent,
      radius: ["blueprint", "gallery", "mono"].includes(s.id) ? 6 : 20,
      font: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    });
    theme.settings.cosmetics.background = { mode: "image", image: artwork(s.id, 731, true).url, opacity: 100, blur: 0, when: "always" };
    BC.PRESET_THEMES.push(theme);
  }
})();
