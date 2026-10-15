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

  let rotating = false;

  function apply(settings) {
    const r = settings.theming && settings.theming.rotation;
    if (!r || !r.enabled || !Array.isArray(r.themeIds) || !r.themeIds.length) return;
    // Bail until bcLocal is actually loaded. The guard below reads lastRotation from
    // it; when it was still null the guard read undefined, never tripped, and the
    // settings write re-entered apply() — repeated theme merges and toast spam.
    if (!BC.storage.local) return;
    if (rotating) return;

    // Periods count LOCAL days: dividing raw epoch ms rotated at UTC midnight, which
    // is mid-afternoon or evening across the Americas.
    const localDay = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / DAY);
    const idx = r.mode === "weekly" ? Math.floor(localDay / 7) : localDay;
    const period = (r.mode || "daily") + ":" + idx;
    const last = BC.storage.local.lastRotation;
    if (last && last.period === period) return;

    const pool = (settings.customThemes || []).concat(BC.PRESET_THEMES || []);
    const id = r.themeIds[idx % r.themeIds.length];
    const theme = pool.find((t) => t && t.id === id);

    // Await the period record before writing settings: the settings write re-enters
    // apply(), and this used to work only because saveLocal happens to assign
    // `local` before its first await.
    rotating = true;
    BC.storage.updateLocal((d) => { d.lastRotation = { period, themeId: id }; })
      .then(() => {
        if (!theme || !theme.settings) return;
        return BC.storage.update((d) => { BC.applyTheme(d, theme); })
          .then(() => BC.toast.info("Theme rotated: " + (theme.name || id)));
      })
      .catch((e) => BC.diag.push("rotation", e))
      .then(() => { rotating = false; });
  }

  BC.registry.register({ id: "rotation", styles: [], nodes: [], apply, unmount() { rotating = false; } });
})();
