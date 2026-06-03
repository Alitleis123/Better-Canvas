/*
 * Better Canvas — cosmetics feature.
 * Full-page custom background (color or image, with blur + opacity) rendered on
 * a fixed layer behind Canvas, plus the custom-CSS escape hatch.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};
  const U = BC.util;

  BC.features.cosmetics = {
    id: "cosmetics",

    apply(settings) {
      const c = settings.cosmetics;
      const bg = c.background;

      if (bg.mode === "none") {
        BC.injector.removeNode("bc-bg");
        BC.injector.setStyle("bc-bg", "");
      } else {
        // Fixed layer behind everything; main surfaces made transparent so it
        // shows through the gutters while cards keep their own background.
        const layer = BC.injector.ensureNode("bc-bg", document.body, () =>
          U.el("div")
        );
        const blur = Math.max(0, Math.min(40, Number(bg.blur) || 0));
        const opacity = Math.max(0, Math.min(100, Number(bg.opacity) || 100)) / 100;
        Object.assign(layer.style, {
          position: "fixed",
          inset: "0",
          zIndex: "-1",
          pointerEvents: "none",
          opacity: String(opacity),
          filter: blur ? `blur(${blur}px)` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        });
        if (bg.mode === "color") {
          layer.style.backgroundColor = U.cssSafe(bg.color || "#0b1220");
          layer.style.backgroundImage = "none";
        } else if (bg.mode === "image" && U.isSafeUrl(bg.image)) {
          layer.style.backgroundImage = `url("${U.cssSafe(bg.image)}")`;
        }
        // Let the layer peek through Canvas's opaque page chrome.
        BC.injector.setStyle(
          "bc-bg",
          `html body, html #application, html #wrapper, html #main {
  background-color:transparent !important; }`
        );
      }

      // Custom CSS escape hatch — user's own rules, injected verbatim last.
      BC.injector.setStyle("bc-custom-css", c.customCss || "");
    },
  };
})();
