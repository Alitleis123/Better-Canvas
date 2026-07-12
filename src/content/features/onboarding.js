/* Better Canvas — first-run tour + "what's new". */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const CSS = `
    .bc-tour-back {
      position: fixed; inset: 0; z-index: 2147482800;
      background: rgba(0,0,0,.4);
      display: flex; align-items: center; justify-content: center;
      font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .bc-tour {
      background: #fff; color: #111; padding: 24px; border-radius: 12px;
      max-width: 460px; box-shadow: 0 30px 80px rgba(0,0,0,.4);
    }
    html.bc-dark .bc-tour { background: #1a1d24; color: #e5e7eb; }
    .bc-tour h2 { margin: 0 0 4px; font-size: 20px; }
    .bc-tour p { margin: 0 0 12px; color: #6b7280; }
    .bc-tour-nav { display: flex; justify-content: space-between; margin-top: 14px; }
    .bc-tour-btn { padding: 6px 12px; border: 0; border-radius: 6px; background: #4f46e5; color: #fff; cursor: pointer; }
    .bc-tour-btn.ghost { background: transparent; color: inherit; border: 1px solid #ddd; }
  `;

  const STEPS = [
    { title: "Welcome to Better Canvas", body: "Everything you'll see is free and stays on your device. No accounts, no telemetry." },
    { title: "Dark mode + themes", body: "Head to Appearance for 12+ built-in themes, or write your own custom CSS." },
    { title: "Planner widget", body: "Try the To Do → Planner widget for a weekly ring, streaks, Pomodoro, and grouped views." },
    { title: "Command palette", body: "Press " + BC.util.modLabel() + "+K to jump anywhere: any tab, any course, any setting." },
    { title: "Open settings any time", body: "Click Better Canvas in Canvas's left navigation, or use " + BC.util.modLabel() + "+Shift+S." },
  ];

  function show() {
    let step = 0;
    const back = document.createElement("div");
    back.className = "bc-tour-back";
    back.setAttribute("data-bc-node", "bc-tour");
    const box = document.createElement("div"); box.className = "bc-tour";
    back.appendChild(box);
    document.body.appendChild(back);
    BC.injector.setStyle("bc-tour-css", CSS);
    function draw() {
      const s = STEPS[step];
      box.innerHTML = `
        <h2>${BC.util.escapeHtml(s.title)}</h2>
        <p>${BC.util.escapeHtml(s.body)}</p>
        <div class="bc-tour-nav">
          <button class="bc-tour-btn ghost" data-skip>Skip</button>
          <div>
            <span style="opacity:.5; margin-right:8px;">${step + 1}/${STEPS.length}</span>
            <button class="bc-tour-btn" data-next>${step === STEPS.length - 1 ? "Done" : "Next"}</button>
          </div>
        </div>
      `;
      box.querySelector("[data-skip]").addEventListener("click", finish);
      box.querySelector("[data-next]").addEventListener("click", () => { if (step === STEPS.length - 1) finish(); else { step++; draw(); } });
    }
    function finish() {
      BC.storage.update((d) => { d.onboarding.seen = true; d.firstRun = false; d.onboarding.lastWhatsNewVersion = BC.VERSION; });
      back.remove();
      BC.injector.setStyle("bc-tour-css", "");
    }
    draw();
  }

  function apply(settings, ctx) {
    if (!settings.onboarding || settings.onboarding.seen) return;
    if (ctx.page !== "dashboard") return;
    // Delay so Canvas has time to render.
    setTimeout(show, 800);
  }

  BC.registry.register({ id: "onboarding", styles: ["bc-tour-css"], nodes: ["bc-tour"], apply });
})();
