/*
 * Better Canvas — scheduled theme rotation.
 * Cycles through the user's selected themes once per day or week. Applies at
 * most once per period (tracked in bcLocal.lastRotation) so it never fights
 * manual theme changes mid-period.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const DAY = 864e5;

  function deepMerge(target, src) {
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (Array.isArray(v)) target[k] = v.slice();
      else if (v && typeof v === "object") {
        if (!target[k] || typeof target[k] !== "object") target[k] = {};
        deepMerge(target[k], v);
      } else target[k] = v;
    }
    return target;
  }

  function apply(settings) {
    const r = settings.theming && settings.theming.rotation;
    if (!r || !r.enabled || !Array.isArray(r.themeIds) || !r.themeIds.length) return;
    const idx = Math.floor(Date.now() / (r.mode === "weekly" ? 7 * DAY : DAY));
    const period = (r.mode || "daily") + ":" + idx;
    const last = (BC.storage.local || {}).lastRotation;
    if (last && last.period === period) return;

    const pool = (settings.customThemes || []).concat(BC.PRESET_THEMES || []);
    const id = r.themeIds[idx % r.themeIds.length];
    const theme = pool.find((t) => t && t.id === id);
    // Record the period first so the settings write below can't re-trigger us.
    BC.storage.updateLocal((d) => { d.lastRotation = { period, themeId: id }; });
    if (!theme || !theme.settings) return;
    BC.storage.update((d) => { deepMerge(d, theme.settings); });
    BC.toast.info("Theme rotated: " + (theme.name || id));
  }

  BC.registry.register({ id: "rotation", styles: [], nodes: [], apply });
})();
