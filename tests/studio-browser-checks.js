/* Evaluate in the synthetic fixture served by studio-fixture.cjs. */
(async () => {
  if (chrome.runtime.id !== "audit-mock" || !["localhost", "127.0.0.1"].includes(location.hostname)) throw Error("Run only in the local synthetic fixture");
  const results = [], check = (value, message) => { if (!value) throw Error(message); results.push(message); };
  const root = document.querySelector("#bc-drawer").shadowRoot;
  const wait = () => new Promise((resolve) => setTimeout(resolve, 420));
  const click = (text) => {
    const button = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
    if (!button) throw Error("Missing button: " + text); button.click();
  };
  const fill = (label, value) => {
    const input = root.querySelector('[aria-label="' + label + '"]');
    input.value = value; input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  BC.SettingsUI.goto("themes");
  const initial = JSON.stringify(BC.storage.current);
  root.querySelector('[aria-label="Preview theme Rainy After Hours"]').click();
  check(JSON.stringify(BC.storage.current) === initial, "Preview leaves Canvas and saved settings unchanged");
  check(!root.querySelector(".bcs-draft-bar").hidden, "Preview offers Apply and Cancel");
  click("Cancel");
  check(JSON.stringify(BC.storage.current) === initial, "Cancel preserves the original theme");
  root.querySelector('[aria-label="Preview theme Rainy After Hours"]').click(); click("Apply theme"); await wait();
  check(BC.storage.current.cosmetics.motion === "rain", "Apply saves the selected full theme");
  const cards = [...document.querySelectorAll(".ic-DashboardCard__header_image")];
  check(new Set(cards.map((n) => getComputedStyle(n).backgroundImage + "|" + getComputedStyle(n).backgroundPosition)).size === 32, "32 course cards have distinct anime scenes");
  const bg = document.querySelector("#bc-bg-layer");
  check(getComputedStyle(bg).position === "fixed" && getComputedStyle(bg).backgroundImage.includes("anime-night-wallpaper"), "Full-size wallpaper stays fixed and retains its image");
  check(getComputedStyle(bg, "::after").animationName === "bc-scene-drift", "Wallpaper motion runs");
  check(getComputedStyle(cards.at(-1), "::after").animationPlayState === "paused", "Offscreen card motion pauses");
  await BC.storage.update((s) => { s.theming.reducedMotion = true; }); BC.applyNow();
  check(getComputedStyle(bg, "::after").animationName === "none", "Reduced-motion preference stops animation");
  await BC.storage.update((s) => { s.theming.reducedMotion = false; }); BC.applyNow();
  click("My locker"); await wait(); click("New note"); await wait();
  fill("Title", "Browser test note"); fill("Your notes", "Remember the photosynthesis equation."); await wait();
  check((await BC.Locker.list()).some((i) => i.title === "Browser test note" && i.body.includes("photosynthesis")), "Note autosaves");
  click("Edit Canvas"); click("My locker"); await wait(); click("Browser test noteNote");
  check(root.querySelector('[aria-label="Your notes"]').value.includes("photosynthesis"), "Note survives leaving and reopening locker");
  click("Study set"); await wait(); fill("Title", "Browser test cards");
  fill("Card 1 question", "Powerhouse of a cell?"); fill("Card 1 answer", "Mitochondria"); click("Study this set");
  check(root.querySelector(".bcs-study-flip").textContent.includes("Powerhouse"), "Study session shows the question");
  root.querySelector(".bcs-study-flip").click();
  check(root.querySelector(".bcs-study-flip").textContent === "Mitochondria", "Flashcard reveals the answer");
  click("Show again later"); root.querySelector(".bcs-study-flip").click(); click("Got it");
  check(root.querySelector(".bcs-locker-editor").textContent.includes("Set complete"), "Review-again queue completes after learning the card");
  for (const id of ["themes", "theming", "cosmetics", "dashboard", "widgets", "todo", "navigation", "accessibility", "locker", "grades", "calendar", "files", "announcements", "productivity", "notifications", "shortcuts", "instructor", "insights", "about"]) {
    BC.SettingsUI.goto(id); check(root.querySelector(".bcs-main").childElementCount > 0, id + " section renders");
  }
  BC.SettingsUI.goto("todo");
  root.querySelector('[aria-label="To Do list style"] [data-value="custom"]').click();
  for (const shape of ["ring", "rainbow", "bar", "heart", "cloud", "off"]) {
    root.querySelector('[aria-label="Progress shape"] [data-value="' + shape + '"]').click();
    check(shape === "off" ? BC.storage.current.todo.ring === false : BC.storage.current.todo.progressStyle === shape, shape + " progress setting applies");
  }
  root.querySelector('[aria-label="Progress shape"] [data-value="heart"]').click();
  root.querySelector('[aria-label="Due-date format"] [data-value="absolute"]').click();
  check(root.querySelector(".bcs-preview-todo .bcs-progress-art svg path"), "Layout preview displays selected progress shape");
  BC.features.settingsPanel.close();
  check(!document.body.inert, "Closing the editor restores Canvas interaction");
  BC.api.plannerItems = async () => [{ plannable_type: "assignment", plannable_date: new Date(Date.now() + 86400000).toISOString(), plannable: { id: 81, title: "Sample essay", points_possible: 10 }, course_id: 100, html_url: "/courses/100/assignments/81", planner_override: { marked_complete: false } }];
  BC.features.todo.apply(BC.storage.current, { page: "dashboard" }); await wait();
  const planner = document.querySelector('[data-bc-node="bc-todo-widget"]').shadowRoot;
  check(planner.querySelector(".bcs-progress-art svg path"), "Actual planner renders heart progress");
  check(/\d/.test(planner.querySelector(".pl-due").textContent) && !planner.querySelector(".pl-due").textContent.includes("Tomorrow"), "Actual planner uses absolute due dates");
  const loaded = await Promise.all(["bc-wall:anime-garden", "bc-wall:anime-night", "bc-art:anime-garden#0", "bc-art:anime-night#31"].map((url) => new Promise((resolve) => {
    const image = new Image(); image.onload = () => resolve(image.naturalWidth >= 1000); image.onerror = () => resolve(false); image.src = BC.themeMedia.resolve(url);
  })));
  check(loaded.every(Boolean), "Both atlases and high-resolution wallpapers decode");
  BC.features.settingsPanel.open("themes");
  check(!auditErrors.length, "No browser runtime errors");
  window.bcStudioTestResults = results;
  return results;
})()
