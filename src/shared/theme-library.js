/* Better Canvas — searchable, openly licensed image themes. No remote code. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const categories = [
    { id: "nature", label: "Nature", query: "forest landscape", accent: "#25866c", tone: "#101e1a", light: "forest" },
    { id: "space", label: "Space", query: "nebula stars", accent: "#a78bfa", tone: "#141126", light: "default" },
    { id: "city", label: "City", query: "city skyline night", accent: "#38bdf8", tone: "#111b29", light: "ocean" },
    { id: "art", label: "Art", query: "Monet landscape", accent: "#c18444", tone: "#211a17", light: "sand" },
    { id: "minimal", label: "Minimal", query: "minimal abstract", accent: "#818cf8", tone: "#18181b", light: "default" },
  ];
  const safeUrl = (value) => {
    if (typeof value !== "string" || value.length > 4096) return "";
    try {
      const u = new URL(value);
      if (u.protocol !== "https:" || u.username || u.password || u.port ||
          !u.hostname.includes(".") || /(^|\.)(localhost|local|internal)$|^[\d.]+$|:/.test(u.hostname)) return "";
      return u.href;
    } catch (_) { return ""; }
  };
  const plain = (value) => String(value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 160);

  function normalize(result) {
    if (!result || !/^[a-f0-9-]{36}$/i.test(result.id || "") || result.mature) return null;
    if (!['cc0', 'pdm', 'by', 'by-sa'].includes(result.license)) return null;
    const url = safeUrl(result.url), source = safeUrl(result.foreign_landing_url);
    if (!url || !source) return null;
    return { url, source, title: plain(result.title) || "Untitled image", creator: plain(result.creator),
      license: result.license.toUpperCase(), licenseUrl: safeUrl(result.license_url),
      thumbnail: "https://api.openverse.org/v1/images/" + result.id + "/thumb/" };
  }

  function makeTheme(images, { name, category = "nature", dark = true, background = true } = {}) {
    const c = categories.find((item) => item.id === category) || categories[0];
    const art = BC.themeImages(images);
    let hash = 2166136261;
    for (const ch of art.map((i) => i.url).join("|")) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
    return {
      id: "image-" + hash.toString(36) + "-" + c.id + (dark ? "-dark" : "-light") + (background ? "-page" : ""),
      name: name || (art[0] && art[0].title) || c.label,
      category: c.id,
      settings: {
        theming: { darkMode: dark ? "on" : "off", darkBg: c.tone, lightPreset: c.light,
          accentColor: dark ? c.accent : ({ space: "#7c3aed", city: "#0369a1", minimal: "#4f46e5" }[c.id] || c.accent),
          experience: { nature: "woodland", space: "orbit", city: "metro", art: "gallery", minimal: "paper" }[c.id], radius: 18 },
        cosmetics: { background: background && art.length
          ? { mode: "image", image: art[0].url, opacity: 100, blur: 0, when: "always" }
          : { mode: "none" } },
        dashboard: { themeImages: art },
      },
    };
  }

  function search(query, page = 1, refresh = false) {
    return new Promise((resolve, reject) => {
      // A missing/updated extension should not leave the gallery spinning forever.
      const timer = setTimeout(() => reject(new Error("The image library took too long. Try again.")), 18000);
      try {
        chrome.runtime.sendMessage({ type: "bc:themeSearch", query, page, refresh }, (response) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) { reject(new Error("Reload the extension to connect to the image library.")); return; }
          if (!response || !response.ok) { reject(new Error(response && response.error || "The image library is unavailable. Try again.")); return; }
          resolve({ images: (response.results || []).map(normalize).filter(Boolean),
            page: response.page, pages: response.pages, total: response.total });
        });
      } catch (_) { clearTimeout(timer); reject(new Error("Reload the extension to connect to the image library.")); }
    });
  }
  BC.themeLibrary = { categories, normalize, makeTheme, search, safeUrl };
})();
