/*
 * Better Canvas — the built-in skin catalog.
 *
 * Data only. Every entry is exactly the shape BC.skins.normalize accepts and
 * BC.skins.export emits, so a built-in, a pasted file and (later) a row from the
 * gallery are the same kind of object and travel the same code path. Adding a
 * skin here is adding an object — no code, no assets, no build step.
 *
 * Type note: these name only families the OS already has. A skin cannot fetch a
 * webfont, because fetching one would tell a font host which Canvas user is
 * looking at which page, and the extension makes no outbound requests.
 *
 * Where the palettes come from
 * ----------------------------
 * There is no registry of Canvas themes to pull from, and if there were, reading
 * it would mean an outbound request on every page load -- which is the one thing
 * this extension does not do. What DOES exist, and what the people who theme
 * things actually recognise, is the open-source colour-scheme ecosystem the
 * editors share: Nord, Dracula, Gruvbox, Catppuccin, Tokyo Night, Rose Pine,
 * Solarized, Everforest, and the rest. Those are permissively licensed palettes,
 * so the catalog below ports them -- each entry credits the project it came from
 * in `author` -- and the art is still generated here from two colours and a
 * scale. Nothing is fetched and nothing is bundled.
 *
 * The illustrated skins are hand-authored, because their art IS the design: six
 * related-but-different faces chosen per skin. The ported palettes go through
 * `port()` instead. Their art follows one rule -- a restrained technical texture
 * drawn in the palette's own border colour -- so writing out thirty
 * near-identical `cards` arrays by hand would only be somewhere for a typo to
 * hide. Adding a skin is still adding an object; `port` just fills in the half
 * that is mechanical.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, ui-serif, serif";
  const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
  const ROUND = "'Avenir Next', Avenir, 'Segoe UI', system-ui, sans-serif";

  // A ported palette, finished. `s` carries what the upstream project actually
  // publishes: the surface colours, and `hues` -- the accent set every one of
  // these schemes defines (a red, a green, a yellow, a blue, and so on).
  //
  // The card faces are drawn in those hues, one per face, and that is the whole
  // point. The first version of this drew every face in the palette's BORDER
  // colour, which is a step or two from the panel by definition, so the
  // thumbnails for Catppuccin Mocha, Macchiato, Frappe, Dracula and Everforest
  // Dark came out as five near-identical dark rectangles. Photographed side by
  // side in the gallery: a catalog of forty skins nobody can tell apart is worse
  // than a catalog of ten. A palette is recognised BY its accent set, so the
  // preview has to show it.
  //
  // Only `panel` and `surface` are ever used as a face background, because those
  // are the two colours the AA gate actually checks the body text against.
  const FACE_KINDS = ["grid", "dots", "stripes", "checks", "waves", "noise"];
  const FACE_SCALES = [0.8, 1.1, 0.7, 0.9, 1.2, 1];
  // Where each skin starts in those two lists. Without it every ported skin got
  // red-grid / green-dots / yellow-stripes / blue-checks in that order, so the
  // hues fixed "all five look like the same dark rectangle" and replaced it with
  // "all thirty look like the same template". A rotation per skin is enough to
  // break that up, and deriving it from the id rather than authoring it keeps
  // the entries to colours only -- and keeps a skin's art stable, which a random
  // number would not.
  const spin = (id) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
    return h;
  };
  const port = (s) => ({
    id: s.id,
    name: s.name,
    author: s.from,
    tags: [s.dark ? "dark" : "light"].concat(s.tags || []),
    dark: s.dark,
    surface: s.surface,
    panel: s.panel,
    text: s.text,
    muted: s.muted,
    border: s.border,
    accent: s.accent,
    nav: s.nav,
    radius: s.radius == null ? 8 : s.radius,
    fontDisplay: s.mono ? MONO : undefined,
    page: { kind: "grid", fg: s.border, scale: 1.6 },
    cards: s.hues.slice(0, 6).map((_, i) => {
      const n = spin(s.id);
      return {
        kind: FACE_KINDS[(i + n) % FACE_KINDS.length],
        fg: s.hues[(i + n) % s.hues.length],
        bg: (i + n) % 2 ? s.panel : s.surface,
        scale: FACE_SCALES[(i + n) % FACE_SCALES.length],
        angle: 30 + ((n % 4) * 30),
      };
    }),
  });

  BC.SKIN_CATALOG = [
    {
      id: "matcha-strawberry",
      name: "Matcha Strawberry",
      author: "Better Canvas",
      tags: ["pastel", "cottage"],
      dark: false,
      surface: "#f7f4ec",
      panel: "#fffdf8",
      text: "#3a4038",
      muted: "#7c8479",
      border: "#e2e0d2",
      accent: "#7a9a6b",
      nav: "#4a5c42",
      radius: 12,
      fontDisplay: SERIF,
      page: { kind: "none" },
      // Six faces from two hues. The alternation is the design: a single
      // pattern repeated across every card reads as wallpaper, not as a theme.
      cards: [
        { kind: "lattice", fg: "#7a9a6b", bg: "#eef3e7", scale: 1.1 },
        { kind: "floral", fg: "#6f8f61", bg: "#f2f6ec", scale: 0.85 },
        { kind: "floral", fg: "#d98a9e", bg: "#fdeef1", scale: 0.85 },
        { kind: "sprigs", fg: "#d47f95", bg: "#fdf1f4", scale: 1 },
        { kind: "stripes", fg: "#e3a2b2", bg: "#fdf0f3", scale: 0.8, angle: 90 },
        { kind: "gingham", fg: "#8fab7e", bg: "#f1f5eb", scale: 0.75 },
      ],
    },

    {
      id: "forest-study",
      name: "Forest Study",
      author: "Better Canvas",
      tags: ["dark", "nature"],
      dark: true,
      surface: "#1b2620",
      panel: "#22302a",
      text: "#dfe8e0",
      muted: "#8fa396",
      border: "#33453b",
      accent: "#7fc79a",
      nav: "#132019",
      radius: 10,
      fontDisplay: SERIF,
      page: { kind: "sprigs", fg: "#3c5a49", scale: 1.6 },
      cards: [
        { kind: "sprigs", fg: "#4d7a62", bg: "#20302a", scale: 1 },
        { kind: "waves", fg: "#3f6b58", bg: "#1e2d27", scale: 1.2 },
        { kind: "lattice", fg: "#456e58", bg: "#213029", scale: 1.1 },
        { kind: "floral", fg: "#487a5f", bg: "#1f2e28", scale: 0.8 },
      ],
    },

    {
      id: "harvest",
      name: "Harvest",
      author: "Better Canvas",
      tags: ["warm", "seasonal"],
      dark: false,
      surface: "#fbf3e6",
      panel: "#fffaf1",
      text: "#4a3728",
      muted: "#8a7663",
      border: "#ead9c2",
      accent: "#c2703a",
      nav: "#7a4526",
      radius: 14,
      fontDisplay: SERIF,
      page: { kind: "none" },
      cards: [
        { kind: "scallop", fg: "#d98b4a", bg: "#fdf0df", scale: 1.2 },
        { kind: "confetti", fg: "#c2703a", bg: "#fdf4e8", scale: 1 },
        { kind: "plaid", fg: "#b8632f", bg: "#fcefdd", scale: 1 },
        { kind: "dots", fg: "#d9a05a", bg: "#fdf3e4", scale: 1.1 },
      ],
    },

    {
      id: "bubblegum",
      name: "Bubblegum",
      author: "Better Canvas",
      tags: ["pastel", "playful"],
      dark: false,
      surface: "#fdf2f8",
      panel: "#ffffff",
      text: "#4a2d43",
      muted: "#8d6f85",
      border: "#f2dae8",
      accent: "#b8327f",
      nav: "#8d2f66",
      radius: 18,
      density: "spacious",
      fontDisplay: ROUND,
      page: { kind: "polka", fg: "#f4c2dd", scale: 1.6 },
      cards: [
        { kind: "polka", fg: "#f09ac9", bg: "#fdeaf4", scale: 1 },
        { kind: "checks", fg: "#c9a6f0", bg: "#f6effd", scale: 0.9 },
        { kind: "confetti", fg: "#e879b8", bg: "#fdeef6", scale: 1 },
        { kind: "stripes", fg: "#f3a8d2", bg: "#fdf0f7", scale: 0.7, angle: 60 },
      ],
    },

    {
      id: "blueprint",
      name: "Blueprint",
      author: "Better Canvas",
      tags: ["dark", "technical"],
      dark: true,
      surface: "#0d1b2a",
      panel: "#15283c",
      text: "#dbe9f7",
      muted: "#7f9cb8",
      border: "#24405c",
      accent: "#4cc3ff",
      nav: "#081521",
      radius: 4,
      fontDisplay: MONO,
      page: { kind: "grid", fg: "#2a4a6b", scale: 1.5 },
      cards: [
        { kind: "grid", fg: "#2f5578", bg: "#122436", scale: 0.75 },
        { kind: "grid", fg: "#2f5578", bg: "#122436", scale: 1.5 },
      ],
    },

    {
      id: "phosphor",
      name: "Phosphor",
      author: "Better Canvas",
      tags: ["dark", "terminal"],
      dark: true,
      surface: "#080b08",
      panel: "#0e140e",
      text: "#9ef59e",
      muted: "#5c8f5c",
      border: "#1d2e1d",
      accent: "#3ddc6b",
      nav: "#040704",
      radius: 2,
      density: "compact",
      fontSans: MONO,
      fontDisplay: MONO,
      page: { kind: "noise", fg: "#1c3a1c", scale: 1 },
      cards: [
        { kind: "grid", fg: "#1f4a2a", bg: "#0b120b", scale: 0.6 },
        { kind: "noise", fg: "#255c30", bg: "#0b120b", scale: 1 },
      ],
    },

    {
      id: "paper",
      name: "Paper",
      author: "Better Canvas",
      tags: ["minimal", "light"],
      dark: false,
      surface: "#f4f1ea",
      panel: "#fbfaf6",
      text: "#2f2c26",
      muted: "#7a756a",
      border: "#e0dbcf",
      accent: "#5a5346",
      radius: 6,
      fontDisplay: SERIF,
      page: { kind: "noise", fg: "#cfc7b5", scale: 1 },
      cards: [
        { kind: "noise", fg: "#d6cdba", bg: "#f8f6f0", scale: 1 },
        { kind: "grid", fg: "#ded6c6", bg: "#faf8f3", scale: 1.2 },
      ],
    },

    {
      id: "frost",
      name: "Frost",
      author: "Better Canvas",
      tags: ["dark", "cool"],
      dark: true,
      surface: "#2e3440",
      panel: "#3b4252",
      text: "#e5e9f0",
      muted: "#9aa5b8",
      border: "#4a5468",
      accent: "#88c0d0",
      nav: "#242933",
      radius: 8,
      page: { kind: "waves", fg: "#48546b", scale: 1.6 },
      cards: [
        { kind: "waves", fg: "#5a6b85", bg: "#39404f", scale: 1.2 },
        { kind: "lattice", fg: "#55637c", bg: "#363d4b", scale: 1.2 },
        { kind: "dots", fg: "#5d6d88", bg: "#373e4d", scale: 1.1 },
      ],
    },

    {
      id: "dusk",
      name: "Dusk",
      author: "Better Canvas",
      tags: ["dark", "warm"],
      dark: true,
      surface: "#241d2b",
      panel: "#2f2637",
      text: "#ece4f2",
      muted: "#a596b0",
      border: "#43384d",
      accent: "#e0879a",
      nav: "#18121d",
      radius: 14,
      fontDisplay: SERIF,
      page: { kind: "none" },
      cards: [
        { kind: "scallop", fg: "#5b4468", bg: "#2c2434", scale: 1.3 },
        { kind: "stripes", fg: "#5f4a6d", bg: "#2a2232", scale: 0.9, angle: 75 },
        { kind: "polka", fg: "#634d72", bg: "#2d2535", scale: 1.2 },
      ],
    },

    {
      id: "meadow",
      name: "Meadow",
      author: "Better Canvas",
      tags: ["light", "nature"],
      dark: false,
      surface: "#f2f7ee",
      panel: "#ffffff",
      text: "#2f3a2c",
      muted: "#71806c",
      border: "#dbe6d4",
      accent: "#3b7139",
      nav: "#33512f",
      radius: 12,
      density: "spacious",
      page: { kind: "none" },
      cards: [
        { kind: "floral", fg: "#6aa35f", bg: "#f0f6ec", scale: 0.9 },
        { kind: "gingham", fg: "#86b47a", bg: "#f2f7ee", scale: 0.8 },
        { kind: "sprigs", fg: "#5f9a56", bg: "#eff5eb", scale: 1.1 },
        { kind: "checks", fg: "#8dbb81", bg: "#f1f6ed", scale: 0.9 },
      ],
    },

    // ---- ported open-source palettes ------------------------------------
    //
    // Grouped dark-then-light, and inside that alphabetical by family, so the
    // gallery has an order rather than an accretion. Each `from` is the project
    // the colours belong to.

    port({ id: "catppuccin-mocha", name: "Catppuccin Mocha", from: "Catppuccin",
           dark: true, tags: ["catppuccin", "pastel"], radius: 10,
           surface: "#1e1e2e", panel: "#181825", text: "#cdd6f4", muted: "#a6adc8",
           border: "#313244", accent: "#cba6f7", nav: "#11111b",
           hues: ["#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#cba6f7", "#94e2d5"] }),

    port({ id: "catppuccin-macchiato", name: "Catppuccin Macchiato", from: "Catppuccin",
           dark: true, tags: ["catppuccin", "pastel"], radius: 10,
           surface: "#24273a", panel: "#1e2030", text: "#cad3f5", muted: "#b8c0e0",
           border: "#363a4f", accent: "#c6a0f6", nav: "#181926",
           hues: ["#ed8796", "#a6da95", "#eed49f", "#8aadf4", "#c6a0f6", "#8bd5ca"] }),

    port({ id: "catppuccin-frappe", name: "Catppuccin Frappé", from: "Catppuccin",
           dark: true, tags: ["catppuccin", "pastel"], radius: 10,
           surface: "#303446", panel: "#292c3c", text: "#c6d0f5", muted: "#b5bfe2",
           border: "#414559", accent: "#ca9ee6", nav: "#232634",
           hues: ["#e78284", "#a6d189", "#e5c890", "#8caaee", "#ca9ee6", "#81c8be"] }),

    port({ id: "dracula", name: "Dracula", from: "Dracula Theme",
           dark: true, tags: ["classic"], radius: 8,
           surface: "#282a36", panel: "#21222c", text: "#f8f8f2", muted: "#a8adc4",
           border: "#44475a", accent: "#bd93f9", nav: "#191a21",
           hues: ["#ff79c6", "#50fa7b", "#f1fa8c", "#8be9fd", "#bd93f9", "#ffb86c"] }),

    port({ id: "everforest-dark", name: "Everforest Dark", from: "Everforest",
           dark: true, tags: ["nature", "muted"], radius: 8,
           surface: "#2d353b", panel: "#272e33", text: "#d3c6aa", muted: "#9da9a0",
           border: "#475258", accent: "#a7c080", nav: "#232a2e",
           hues: ["#e67e80", "#a7c080", "#dbbc7f", "#7fbbb3", "#d699b6", "#e69875"] }),

    port({ id: "github-dark", name: "GitHub Dark", from: "GitHub Primer",
           dark: true, tags: ["neutral"], radius: 6,
           surface: "#0d1117", panel: "#161b22", text: "#c9d1d9", muted: "#8b949e",
           border: "#30363d", accent: "#58a6ff", nav: "#010409",
           hues: ["#f85149", "#3fb950", "#d29922", "#58a6ff", "#bc8cff", "#db6d28"] }),

    port({ id: "gruvbox-dark", name: "Gruvbox Dark", from: "Gruvbox",
           dark: true, tags: ["retro", "warm"], radius: 4,
           surface: "#282828", panel: "#32302f", text: "#ebdbb2", muted: "#bdae93",
           border: "#504945", accent: "#d79921", nav: "#1d2021",
           hues: ["#fb4934", "#b8bb26", "#fabd2f", "#83a598", "#d3869b", "#fe8019"] }),

    port({ id: "horizon", name: "Horizon", from: "Horizon Theme",
           dark: true, tags: ["warm"], radius: 10,
           surface: "#1c1e26", panel: "#232530", text: "#d5d8da", muted: "#a5a8aa",
           border: "#2e303e", accent: "#e95678", nav: "#16161c",
           hues: ["#e95678", "#29d398", "#fac29a", "#26bbd9", "#b877db", "#fab795"] }),

    port({ id: "kanagawa", name: "Kanagawa", from: "Kanagawa",
           dark: true, tags: ["muted", "ink"], radius: 8,
           surface: "#1f1f28", panel: "#2a2a37", text: "#dcd7ba", muted: "#a59ec0",
           border: "#363646", accent: "#7e9cd8", nav: "#16161d",
           hues: ["#c34043", "#76946a", "#c0a36e", "#7e9cd8", "#957fb8", "#6a9589"] }),

    port({ id: "material-darker", name: "Material Darker", from: "Material Theme",
           dark: true, tags: ["neutral"], radius: 6,
           surface: "#212121", panel: "#292929", text: "#eeffff", muted: "#a7aeae",
           border: "#353535", accent: "#80cbc4", nav: "#171717",
           hues: ["#f07178", "#c3e88d", "#ffcb6b", "#82aaff", "#c792ea", "#80cbc4"] }),

    port({ id: "monokai", name: "Monokai", from: "Monokai",
           dark: true, tags: ["classic", "vivid"], radius: 4, mono: true,
           surface: "#272822", panel: "#1e1f1c", text: "#f8f8f2", muted: "#b3af9e",
           border: "#3e3d32", accent: "#a6e22e", nav: "#16170f",
           hues: ["#f92672", "#a6e22e", "#e6db74", "#66d9ef", "#ae81ff", "#fd971f"] }),

    port({ id: "moonlight", name: "Moonlight", from: "Moonlight",
           dark: true, tags: ["cool"], radius: 10,
           surface: "#212337", panel: "#262a3f", text: "#c8d3f5", muted: "#a6b0c7",
           border: "#2f334d", accent: "#82aaff", nav: "#191a2a",
           hues: ["#ff757f", "#c3e88d", "#ffc777", "#82aaff", "#c099ff", "#86e1fc"] }),

    port({ id: "night-owl", name: "Night Owl", from: "Night Owl",
           dark: true, tags: ["cool"], radius: 8,
           surface: "#011627", panel: "#0b2942", text: "#d6deeb", muted: "#a4b8c4",
           border: "#1d3b53", accent: "#7fdbca", nav: "#010e1a",
           hues: ["#ef5350", "#addb67", "#ecc48d", "#82aaff", "#c792ea", "#7fdbca"] }),

    port({ id: "nightfox", name: "Nightfox", from: "Nightfox",
           dark: true, tags: ["cool"], radius: 8,
           surface: "#192330", panel: "#1d2b3a", text: "#cdcecf", muted: "#a3a5a7",
           border: "#29394f", accent: "#719cd6", nav: "#131a24",
           hues: ["#c94f6d", "#81b29a", "#dbc074", "#719cd6", "#9d79d6", "#63cdcf"] }),

    port({ id: "oceanic-next", name: "Oceanic Next", from: "Oceanic Next",
           dark: true, tags: ["cool"], radius: 6,
           surface: "#1b2b34", panel: "#223b46", text: "#cdd3de", muted: "#a2aab5",
           border: "#2b3b44", accent: "#6699cc", nav: "#14232b",
           hues: ["#ec5f67", "#99c794", "#fac863", "#6699cc", "#c594c5", "#f99157"] }),

    port({ id: "one-dark", name: "One Dark", from: "Atom One",
           dark: true, tags: ["classic", "neutral"], radius: 8,
           surface: "#282c34", panel: "#21252b", text: "#abb2bf", muted: "#9099a8",
           border: "#3e4451", accent: "#61afef", nav: "#1b1f23",
           hues: ["#e06c75", "#98c379", "#e5c07b", "#61afef", "#c678dd", "#56b6c2"] }),

    port({ id: "palenight", name: "Palenight", from: "Material Palenight",
           dark: true, tags: ["muted"], radius: 10,
           surface: "#292d3e", panel: "#32364a", text: "#a6accd", muted: "#9aa0c0",
           border: "#3a3f58", accent: "#c792ea", nav: "#1f2231",
           hues: ["#f07178", "#c3e88d", "#ffcb6b", "#82aaff", "#c792ea", "#89ddff"] }),

    port({ id: "rose-pine", name: "Rosé Pine", from: "Rosé Pine",
           dark: true, tags: ["muted", "warm"], radius: 12,
           surface: "#191724", panel: "#1f1d2e", text: "#e0def4", muted: "#a39fbe",
           border: "#26233a", accent: "#ebbcba", nav: "#13111c",
           hues: ["#eb6f92", "#9ccfd8", "#f6c177", "#31748f", "#c4a7e7", "#ebbcba"] }),

    port({ id: "rose-pine-moon", name: "Rosé Pine Moon", from: "Rosé Pine",
           dark: true, tags: ["muted", "warm"], radius: 12,
           surface: "#232136", panel: "#2a273f", text: "#e0def4", muted: "#a39fbe",
           border: "#393552", accent: "#ea9a97", nav: "#1a182a",
           hues: ["#eb6f92", "#9ccfd8", "#f6c177", "#3e8fb0", "#c4a7e7", "#ea9a97"] }),

    port({ id: "solarized-dark-skin", name: "Solarized Dark", from: "Ethan Schoonover",
           dark: true, tags: ["classic"], radius: 4,
           surface: "#002b36", panel: "#073642", text: "#c2cdcd", muted: "#93a1a1",
           border: "#0f4a56", accent: "#268bd2", nav: "#00212b",
           hues: ["#dc322f", "#859900", "#b58900", "#268bd2", "#6c71c4", "#2aa198"] }),

    port({ id: "sonokai", name: "Sonokai", from: "Sonokai",
           dark: true, tags: ["vivid"], radius: 8,
           surface: "#2c2e34", panel: "#33353f", text: "#e2e2e3", muted: "#b1b3ba",
           border: "#3b3e48", accent: "#9ed072", nav: "#222327",
           hues: ["#fc5d7c", "#9ed072", "#e7c664", "#76cce0", "#b39df3", "#f39660"] }),

    port({ id: "synthwave", name: "Synthwave", from: "Synthwave '84",
           dark: true, tags: ["vivid", "retro"], radius: 6,
           surface: "#241b2f", panel: "#2a2139", text: "#f8f8f2", muted: "#bcaed0",
           border: "#34294f", accent: "#ff7edb", nav: "#1a1425",
           hues: ["#ff7edb", "#72f1b8", "#fede5d", "#36f9f6", "#b381c5", "#ff8b39"] }),

    port({ id: "tokyo-night", name: "Tokyo Night", from: "Tokyo Night",
           dark: true, tags: ["cool", "vivid"], radius: 8,
           surface: "#1a1b26", panel: "#24283b", text: "#c0caf5", muted: "#a3aed0",
           border: "#414868", accent: "#7aa2f7", nav: "#16161e",
           hues: ["#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff"] }),

    port({ id: "tokyo-night-storm", name: "Tokyo Night Storm", from: "Tokyo Night",
           dark: true, tags: ["cool"], radius: 8,
           surface: "#24283b", panel: "#1f2335", text: "#c0caf5", muted: "#a3aed0",
           border: "#3b4261", accent: "#bb9af7", nav: "#1a1b26",
           hues: ["#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff"] }),

    port({ id: "zenburn", name: "Zenburn", from: "Zenburn",
           dark: true, tags: ["muted", "classic"], radius: 4,
           surface: "#3f3f3f", panel: "#4f4f4f", text: "#dcdccc", muted: "#b8b8a8",
           border: "#5f5f5f", accent: "#8cd0d3", nav: "#2f2f2f",
           hues: ["#cc9393", "#7f9f7f", "#e0cf9f", "#8cd0d3", "#dc8cc3", "#93e0e3"] }),

    port({ id: "ayu-light", name: "Ayu Light", from: "Ayu",
           dark: false, tags: ["minimal"], radius: 6,
           surface: "#fcfcfc", panel: "#ffffff", text: "#5c6166", muted: "#767b80",
           border: "#e7e8e9", accent: "#f2a13a", nav: "#3f4b52",
           hues: ["#f07171", "#86b300", "#f2ae49", "#399ee6", "#a37acc", "#4cbf99"] }),

    port({ id: "catppuccin-latte", name: "Catppuccin Latte", from: "Catppuccin",
           dark: false, tags: ["catppuccin", "pastel"], radius: 10,
           surface: "#eff1f5", panel: "#ffffff", text: "#4c4f69", muted: "#6c6f85",
           border: "#ccd0da", accent: "#8839ef", nav: "#4c4f69",
           hues: ["#d20f39", "#40a02b", "#df8e1d", "#1e66f5", "#8839ef", "#179299"] }),

    port({ id: "everforest-light", name: "Everforest Light", from: "Everforest",
           dark: false, tags: ["nature", "muted"], radius: 8,
           surface: "#fdf6e3", panel: "#fffbef", text: "#5c6a72", muted: "#6f7f76",
           border: "#e0dcc7", accent: "#8da101", nav: "#4f585e",
           hues: ["#f85552", "#8da101", "#dfa000", "#3a94c5", "#df69ba", "#f57d26"] }),

    port({ id: "github-light", name: "GitHub Light", from: "GitHub Primer",
           dark: false, tags: ["neutral", "minimal"], radius: 6,
           surface: "#f6f8fa", panel: "#ffffff", text: "#1f2328", muted: "#636c76",
           border: "#d0d7de", accent: "#0969da", nav: "#24292f",
           hues: ["#cf222e", "#1a7f37", "#9a6700", "#0969da", "#8250df", "#bc4c00"] }),

    port({ id: "gruvbox-light", name: "Gruvbox Light", from: "Gruvbox",
           dark: false, tags: ["retro", "warm"], radius: 4,
           surface: "#fbf1c7", panel: "#f9f5d7", text: "#3c3836", muted: "#6f6559",
           border: "#ebdbb2", accent: "#af3a03", nav: "#3c3836",
           hues: ["#9d0006", "#79740e", "#b57614", "#076678", "#8f3f71", "#af3a03"] }),

    port({ id: "one-light", name: "One Light", from: "Atom One",
           dark: false, tags: ["neutral", "classic"], radius: 8,
           surface: "#fafafa", panel: "#ffffff", text: "#383a42", muted: "#63666f",
           border: "#e5e5e6", accent: "#3b6edf", nav: "#383a42",
           hues: ["#e45649", "#50a14f", "#c18401", "#4078f2", "#a626a4", "#0184bc"] }),

    port({ id: "rose-pine-dawn", name: "Rosé Pine Dawn", from: "Rosé Pine",
           dark: false, tags: ["muted", "warm"], radius: 12,
           surface: "#faf4ed", panel: "#fffaf3", text: "#575279", muted: "#6e6a8a",
           border: "#dfdad9", accent: "#a65b70", nav: "#575279",
           hues: ["#b4637a", "#56949f", "#ea9d34", "#286983", "#907aa9", "#d7827e"] }),

    port({ id: "solarized-light-skin", name: "Solarized Light", from: "Ethan Schoonover",
           dark: false, tags: ["classic"], radius: 4,
           surface: "#fdf6e3", panel: "#fffbf0", text: "#073642", muted: "#5f7379",
           border: "#eee8d5", accent: "#268bd2", nav: "#073642",
           hues: ["#dc322f", "#859900", "#b58900", "#268bd2", "#6c71c4", "#2aa198"] }),

    port({ id: "tokyo-night-day", name: "Tokyo Night Day", from: "Tokyo Night",
           dark: false, tags: ["cool"], radius: 8,
           surface: "#e1e2e7", panel: "#f4f5f8", text: "#343b58", muted: "#5a6087",
           border: "#c4c8da", accent: "#2a73d7", nav: "#343b58",
           hues: ["#f52a65", "#587539", "#8c6c3e", "#2e7de9", "#9854f1", "#007197"] }),
  ];
})();
