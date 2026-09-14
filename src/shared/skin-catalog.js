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
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, ui-serif, serif";
  const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
  const ROUND = "'Avenir Next', Avenir, 'Segoe UI', system-ui, sans-serif";

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
  ];
})();
