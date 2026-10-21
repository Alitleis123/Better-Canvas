/* Evaluate in the synthetic fixture served by studio-fixture.cjs. */
(async () => {
  if (chrome.runtime.id !== "audit-mock" || !["localhost", "127.0.0.1"].includes(location.hostname)) throw Error("Run only in the local synthetic fixture");
  const results = [], check = (value, message) => { if (!value) throw Error(message); results.push(message); };
  const root = document.querySelector("#bc-drawer").shadowRoot;
  const wait = () => new Promise((resolve) => setTimeout(resolve, 420));
  const until = async (test, message) => {
    for (let i = 0; i < 60; i++) { const value = await test(); if (value) return check(value, message); await new Promise((resolve) => setTimeout(resolve, 100)); }
    check(false, message);
  };
  const mirror = () => root.querySelector(".bcs-mirror iframe.is-front")?.contentDocument;
  const saved = () => new Promise((resolve) => chrome.storage.local.get("bcSettings", (r) => resolve(JSON.stringify(r.bcSettings))));
  const wallpaper = () => { const layer = mirror()?.querySelector("#bc-bg-layer"); return layer ? getComputedStyle(layer).backgroundImage : ""; };
  const click = (text) => {
    const button = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
    if (!button) throw Error("Missing button: " + text); button.click();
  };
  const fill = (label, value) => {
    const input = root.querySelector('[aria-label="' + label + '"]');
    input.value = value; input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  BC.SettingsUI.goto("themes");
  const initial = JSON.stringify(BC.storage.current), initialSaved = await saved();
  await until(() => mirror()?.querySelectorAll(".ic-DashboardCard").length === 32 && !mirror().querySelector("script, #bc-drawer"), "Live preview is a copy of this page without its scripts or the workspace");
  check(root.querySelector(".bcs-mirror iframe").getAttribute("sandbox") === "allow-same-origin" && root.querySelector(".bcs-mirror-shield"), "The copy can't run scripts or be clicked");
  root.querySelector('[aria-label="Preview theme Rainy After Hours"]').click();
  check(await saved() === initialSaved && BC.storage.current.cosmetics.motion === "rain", "Preview shows a theme on Canvas without saving it");
  await until(() => wallpaper().includes("anime-night-wallpaper"), "Live preview shows the theme being tried");
  check(!root.querySelector(".bcs-draft-bar").hidden, "Preview offers Apply and Cancel");
  click("Cancel");
  check(JSON.stringify(BC.storage.current) === initial && await saved() === initialSaved, "Cancel puts the original theme back");
  await until(() => !wallpaper().includes("anime-night-wallpaper"), "Live preview drops the cancelled theme");
  const frame = root.querySelector(".bcs-mirror iframe.is-front");
  check(frame.contentWindow.innerWidth === innerWidth && frame.contentWindow.innerHeight === innerHeight, "The copy has the window's own size");
  root.querySelector('[aria-label="Preview theme Rainy After Hours"]').click();
  const other = JSON.parse(await saved()); other.theming.lineHeight = 1.9;
  await new Promise((resolve) => chrome.storage.local.set({ bcSettings: other }, resolve)); await wait();
  click("Cancel");
  await until(() => BC.storage.current.theming.lineHeight === 1.9 && BC.storage.current.cosmetics.motion !== "rain", "A change from another tab during a theme preview lands after Cancel");
  const title = document.querySelector(".ic-DashboardCard__header-title span").firstChild, oldTitle = title.data;
  title.data = "Renamed course";
  await until(() => mirror()?.querySelector(".ic-DashboardCard__header-title span")?.textContent === "Renamed course", "Live preview follows a text change on the page");
  title.data = oldTitle;
  BC.SettingsUI.goto("theming");
  const lineHeight = root.querySelector('input[type="range"][aria-label="Line height"]');
  lineHeight.value = lineHeight.max; lineHeight.dispatchEvent(new Event("input", { bubbles: true }));
  await until(() => mirror() && getComputedStyle(mirror().body).lineHeight === getComputedStyle(document.body).lineHeight && mirror().querySelector('style[data-better-canvas="bc-theming"]').textContent === document.querySelector('style[data-better-canvas="bc-theming"]').textContent, "Live preview follows a slider as it moves");
  BC.SettingsUI.goto("themes");
  root.querySelector('[aria-label="Preview theme Rainy After Hours"]').click(); click("Apply theme"); await wait();
  check(BC.storage.current.cosmetics.motion === "rain", "Apply saves the selected full theme");
  const cards = [...document.querySelectorAll(".ic-DashboardCard__header_image")];
  check(new Set(cards.map((n) => getComputedStyle(n).backgroundImage + "|" + getComputedStyle(n).backgroundPosition)).size === 32, "32 course cards have distinct anime scenes");
  scrollTo(0, 600);
  check(document.querySelector(".ic-Dashboard-header").getBoundingClientRect().bottom < 0, "The scene dashboard header scrolls away with the page");
  scrollTo(0, 0);
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
  BC.features.settingsPanel.open("todo");
  await until(() => mirror()?.querySelector('[data-bc-node="bc-todo-widget"]')?.shadowRoot?.querySelector(".bcs-progress-art svg path"), "Live preview copies the planner widget with its heart progress");
  const marker = planner.querySelector(".bc-root").appendChild(Object.assign(document.createElement("p"), { className: "bc-test-marker", textContent: "Added later" }));
  await until(() => mirror()?.querySelector('[data-bc-node="bc-todo-widget"]')?.shadowRoot?.querySelector(".bc-test-marker"), "Live preview follows changes inside the planner widget");
  marker.remove();
  BC.SettingsUI.goto("themes");
  check(!auditErrors.length, "No browser runtime errors");
  window.bcStudioTestResults = results;
  return results;
})()
