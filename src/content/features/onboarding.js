/* Better Canvas — first-run tour. */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  BC.features = BC.features || {};

  const STEPS = [
    { title: "Welcome to Better Canvas", body: "Everything you'll see is free and stays on your device. No accounts, no telemetry." },
    { title: "Dark mode + themes", body: "Head to Appearance for 12+ built-in themes, or write your own custom CSS." },
    { title: "Planner widget", body: "Try the To Do → Planner widget for a weekly ring, streaks, Pomodoro, and grouped views." },
    { title: "Command palette", body: "Press " + BC.util.modLabel() + "+K to jump anywhere: any tab, any course, any setting." },
    { title: "Open settings any time", body: "Click Better Canvas in Canvas's left navigation, or use " + BC.util.modLabel() + "+Shift+S." },
  ];

  function show() {
    if (document.querySelector('[data-bc-node="bc-tour"]')) return;

    let step = 0;
    let done = false;

    // aria-live so advancing a step is announced rather than silently swapped.
    const bodyText = BC.ui.el("p", { "aria-live": "polite" });
    const counter = BC.ui.badge("", {});
    const skipBtn = BC.ui.button("Skip", { variant: "ghost", onClick: () => finish() });
    const nextBtn = BC.ui.button("Next", { variant: "primary", onClick: () => {
      if (step >= STEPS.length - 1) finish();
      else { step++; draw(); }
    } });

    const dlg = BC.ui.dialog({
      title: STEPS[0].title,
      body: bodyText,
      actions: [skipBtn, BC.ui.el("div", { class: "bc-tour-nav" }, [counter, nextBtn])],
      dismissible: true,
      nodeId: "bc-tour",
      // Escape and scrim-click are equivalent to Skip: don't nag on the next tick.
      onClose: () => { if (!done) markSeen(); },
    });

    const titleEl = dlg.panel.querySelector(".bc-dialog-title");

    function draw() {
      const s = STEPS[step];
      titleEl.textContent = s.title;
      bodyText.textContent = s.body;
      counter.textContent = (step + 1) + "/" + STEPS.length;
      counter.setAttribute("aria-label", "Step " + (step + 1) + " of " + STEPS.length);
      nextBtn.textContent = step === STEPS.length - 1 ? "Done" : "Next";
    }

    function markSeen() {
      done = true;
      BC.storage.update((d) => {
        d.onboarding.seen = true;
        d.firstRun = false;
        d.onboarding.lastWhatsNewVersion = BC.VERSION;
      });
    }

    function finish() { markSeen(); dlg.close(); }

    draw();
    dlg.open();
  }

  function apply(settings, ctx) {
    if (!settings.onboarding || settings.onboarding.seen) return;
    if (ctx.page !== "dashboard") return;
    if (document.querySelector('[data-bc-node="bc-tour"]')) return;
    // once() is the anti-stacking guard: applyAll runs ~5x/sec and onboarding.seen
    // stays false until the tour is dismissed, so an unguarded apply queued a fresh
    // dialog every tick and each new one covered the last — which is why "Next"
    // appeared to do nothing. The bagged timeout is cancelled on navigation instead
    // of firing into a page that moved on, and the mark clears on navigation so the
    // tour re-arms if the user comes back to the dashboard.
    const bag = BC.lifecycle.pageBag("onboarding");
    bag.once("tour", () => bag.timeout(show, 800));
  }

  // Styling now comes entirely from the shared kit's tokens — this used to hardcode
  // #fff / #111 / #6b7280 / #4f46e5 / #ddd / #1a1d24 and ignore the theme.
  BC.registry.register({ id: "onboarding", pages: ["dashboard"], styles: [], nodes: ["bc-tour"], apply });
})();
