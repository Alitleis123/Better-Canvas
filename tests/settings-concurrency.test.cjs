const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { root, load, domContext, settle, copy } = require("./audit-helpers.cjs");
const { database } = require("./storage-harness.cjs");

async function surface(db, name) {
  const client = db.client(), chrome = client.chrome;
  chrome.tabs = { query: async () => [] };
  const html = name === "studio" ? '<div id="root"></div>' : fs.readFileSync(path.join(root, "src", name, name + ".html"), "utf8");
  const page = domContext(html, { chrome });
  load(page.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/icons.js", "src/content/core/ui.js", "src/content/core/storage.js", "src/content/core/lifecycle.js", "src/shared/settings/state.js", "src/shared/settings/components.js");
  const BC = page.context.BC;
  await BC.storage.load();
  let adapter, store;
  if (name === "studio") {
    vm.runInContext(fs.readFileSync(path.join(root, "src/content/features/settings-panel.js"), "utf8")
      .replace("  BC.registry.register({", "  BC.testAdapter = makeAdapter;\n  BC.registry.register({"), page.context);
    adapter = BC.testAdapter();
  } else {
    BC.SettingsUI = { render(_root, value) { adapter = value; } };
    load(page.context, "src/" + name + "/" + name + ".js");
    await settle();
  }
  if (adapter) store = BC.SettingsState.create(adapter);
  return { ...page, BC, store, adapter, client, doc: page.dom.window.document,
    close() { store?.destroy(); page.dom.window.close(); } };
}

for (const name of ["studio", "options"]) {
  test(name + " real throttle persists a reversal queued behind an in-flight save", async () => {
    const db = database(), a = await surface(db, name);
    let release;
    try {
      const send = a.client.chrome.runtime.sendMessage;
      let held = false;
      a.client.chrome.runtime.sendMessage = (message, callback) => {
        if (message.type === "bc:settingsCommit" && !held) {
          held = true; release = () => send(message, callback); return;
        }
        return send(message, callback);
      };
      a.store.set((d) => { d.dashboard.cardRadius = 12; });
      for (let i = 0; i < 100 && !release; i++) await settle();
      assert.ok(release);
      a.store.set((d) => { d.dashboard.cardRadius = 8; });
      // Let the production 220 ms trailing throttle queue the reversal.
      await new Promise((resolve) => setTimeout(resolve, 260));
      release();
      for (let i = 0; i < 100 && db.data.bcSettings?.dashboard.cardRadius !== 8; i++) await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(db.data.bcSettings.dashboard.cardRadius, 8);
      assert.equal(a.store.get().dashboard.cardRadius, 8);
    } finally { a.close(); }
  });

  test(name + " net-zero edits before saving preserve another editor's value", async () => {
    const db = database(), a = await surface(db, name), b = await surface(db, name === "studio" ? "options" : "studio");
    try {
      // Both edits precede the first queued save's microtask.
      a.store.set((d) => { d.dashboard.cardRadius = 12; });
      a.store.set((d) => { d.dashboard.cardRadius = 8; });
      b.store.set((d) => { d.dashboard.cardRadius = 9; });
      await b.store.flush(); await a.store.flush();
      assert.equal(db.data.bcSettings.dashboard.cardRadius, 9);
      assert.equal(a.store.get().dashboard.cardRadius, 9);
    } finally { a.close(); b.close(); }
  });
}

for (const kind of ["built-in", "custom", "undo", "redo", "reset"]) {
  test(kind + " theme action replaces unchanged artwork and theme fields from a stale editor", async () => {
    const db = database(), a = await surface(db, "studio"), b = await surface(db, "options");
    try {
      load(a.context, "src/shared/themes.js");
      const preset = kind === "built-in" ? a.BC.PRESET_THEMES[0] : { settings: { theming: { accentColor: "#ff0000" }, dashboard: { themeImages: [] } } };
      if (kind === "undo" || kind === "redo") {
        a.store.applyPreset(preset); await a.store.flush();
        if (kind === "redo") { a.store.undo(); await a.store.flush(); }
      }
      b.store.set((d) => {
        d.dashboard.themeImages = [{ url: "https://external.test/art" }];
        d.dashboard.courses[42] = { nickname: "Keep me", bgImage: "https://external.test/course" };
        d.theming.accentColor = "#abcdef"; d.theming.rotation.enabled = true;
        d.theming.cursor = "large"; d.todo.tags.push("external");
      }); await b.store.flush();
      if (kind === "undo") a.store.undo();
      else if (kind === "redo") a.store.redo();
      else if (kind === "reset") a.store.reset();
      else a.store.applyPreset(preset);
      await a.store.flush();
      assert.deepEqual(db.data.bcSettings.dashboard.themeImages, []);
      assert.notEqual(db.data.bcSettings.theming.accentColor, "#abcdef");
      if (kind !== "reset") {
        assert.equal(db.data.bcSettings.dashboard.courses[42].bgImage, undefined);
        assert.equal(db.data.bcSettings.dashboard.courses[42].nickname, "Keep me");
        assert.equal(db.data.bcSettings.theming.rotation.enabled, true);
        assert.equal(db.data.bcSettings.theming.cursor, "large");
        assert.deepEqual(db.data.bcSettings.todo.tags, ["external"]);
      }
    } finally { a.close(); b.close(); }
  });
}

for (const action of ["built-in", "custom", "online", "import", "restore"]) {
  test("theme " + action + " DOM action replaces external artwork through the production handler", async () => {
    const db = database(), a = await surface(db, "studio"), b = await surface(db, "options");
    try {
      load(a.context, "src/shared/themes.js", "src/shared/theme-library.js", "src/shared/theme-scenes.js", "src/shared/theme-artwork.js", "src/shared/theme-media.js", "src/content/core/color.js");
      const theme = { id: "custom", name: "Custom", settings: { theming: { accentColor: "#ff0000" } } };
      a.store.set((d) => { d.customThemes.push(theme); }); await a.store.flush();
      vm.runInContext(fs.readFileSync(path.join(root, "src/shared/settings/index.js"), "utf8")
        .replace("  BC.SettingsUI = {", "  BC.testRenderThemes = renderThemes;\n  BC.SettingsUI = {"), a.context);
      a.doc.body.append(...a.BC.testRenderThemes(a.store));
      const button = (text) => [...a.doc.querySelectorAll("button")].find((node) => node.textContent.trim() === text);
      const external = "https://external.test/art";
      b.store.set((d) => { d.dashboard.themeImages = [{ url: external }]; d.dashboard.courses[42] = { nickname: "Keep", bgImage: external }; }); await b.store.flush();
      if (action === "restore") button("Restore Canvas images").click();
      else if (action === "custom") a.doc.querySelector('[aria-label="Preview theme Custom"]').click();
      else if (action === "built-in") {
        button("Classic palettes").click(); a.doc.querySelector('[aria-label="Preview theme ' + a.BC.PRESET_THEMES[0].name + '"]').click();
      } else if (action === "online") {
        a.BC.themeLibrary.search = async () => ({ images: [{ url: "https://chosen.test/a", title: "Chosen" }], page: 1, pages: 1 });
        button("Explore online").click(); await settle();
        a.doc.querySelector(".bcs-themes .bcs-theme__apply").click(); await settle();
      } else {
        let input; const create = a.doc.createElement.bind(a.doc);
        a.doc.createElement = (tag, ...args) => { const node = create(tag, ...args); if (tag === "input") { input = node; node.click = () => {}; } return node; };
        button("Import").click();
        Object.defineProperty(input, "files", { value: [{ text: async () => JSON.stringify(theme) }] }); input.onchange(); await settle();
      }
      await a.store.flush();
      assert.equal(db.data.bcSettings.dashboard.themeImages.some((image) => image.url === external), false);
      assert.equal(db.data.bcSettings.dashboard.courses[42].bgImage, undefined);
      assert.equal(db.data.bcSettings.dashboard.courses[42].nickname, "Keep");
      if (action === "online") assert.equal(db.data.bcSettings.dashboard.themeImages.length, 48);
      else assert.deepEqual(db.data.bcSettings.dashboard.themeImages, []);
    } finally { a.close(); b.close(); }
  });
}

test("reapplying an unchanged theme carries replacement intent and retains a failed attempt", async () => {
  const db = database(), a = await surface(db, "studio"), b = await surface(db, "options");
  try {
    load(a.context, "src/shared/themes.js");
    const preset = { settings: { theming: { accentColor: "#ff0000" } } };
    a.store.applyPreset(preset); await a.store.flush();
    b.store.set((d) => { d.dashboard.themeImages = [{ url: "https://external.test/art" }]; }); await b.store.flush();
    db.fail("quota"); a.BC.util.warn = () => {};
    a.store.applyPreset(preset); await assert.rejects(a.store.flush(), /quota/);
    db.fail(null); await a.store.flush();
    assert.deepEqual(db.data.bcSettings.dashboard.themeImages, []);
  } finally { a.close(); b.close(); }
});

for (const [control, pathParts, value] of [["enabled", ["enabled"], false], ["dashEnabled", ["dashboard", "enabled"], false], ["darkMode", ["theming", "darkMode"], "on"], ["notifsIn", ["notifications", "inPage"], false]]) {
  test("popup " + control + " changes only its field after an options edit", async () => {
    const db = database(), popup = await surface(db, "popup"), options = await surface(db, "options");
    try {
      options.store.set((d) => { d.dashboard.columns = 7; }); await options.store.flush();
      const input = popup.doc.getElementById(control);
      if (input.type === "checkbox") input.checked = value; else input.value = value;
      input.dispatchEvent(new popup.dom.window.Event("change"));
      for (let i = 0; i < 100 && pathParts.reduce((d, k) => d?.[k], db.data.bcSettings) !== value; i++) await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(pathParts.reduce((d, k) => d?.[k], db.data.bcSettings), value);
      assert.equal(db.data.bcSettings.dashboard.columns, 7);
    } finally { popup.close(); options.close(); }
  });
}

test("studio and options rebase scalar, membership and id-keyed settings changes", async () => {
  const db = database({ bcSettings: { version: 5, todo: { tags: ["base"] } } });
  const a = await surface(db, "studio"), b = await surface(db, "options");
  try {
    a.store.set((d) => { d.todo.tags.push("A"); d.customThemes.push({ id: "a", name: "A" }); d.todo.recurring.push({ id: "a", title: "A" }); d.dashboard.courses[1] = { color: "red" }; });
    await a.store.flush();
    b.store.set((d) => { d.todo.tags.push("B"); d.customThemes.push({ id: "b", name: "B" }); d.todo.recurring.push({ id: "b", title: "B" }); d.dashboard.courses[1] = { nickname: "Name" }; });
    await b.store.flush();
    assert.deepEqual(db.data.bcSettings.todo.tags, ["base", "A", "B"]);
    for (const items of [db.data.bcSettings.customThemes, db.data.bcSettings.todo.recurring]) assert.deepEqual(items.map((x) => x.id), ["a", "b"]);
    assert.deepEqual(db.data.bcSettings.dashboard.courses[1], { color: "red", nickname: "Name" });
    a.store.set((d) => { d.todo.tags = d.todo.tags.filter((v) => v !== "base"); d.customThemes = d.customThemes.filter((v) => v.id !== "a"); });
    b.store.set((d) => { d.todo.tags.push("C"); d.todo.recurring[0].title = "Renamed"; });
    await Promise.all([a.store.flush(), b.store.flush()]);
    assert.deepEqual(new Set(db.data.bcSettings.todo.tags), new Set(["A", "B", "C"]));
    assert.deepEqual(db.data.bcSettings.customThemes.map((x) => x.id), ["b"]);
    assert.equal(db.data.bcSettings.todo.recurring.find((x) => x.id === "a").title, "Renamed");
  } finally { a.close(); b.close(); }
});

test("custom link handlers retain ids across removal and independent settings edits", async () => {
  const db = database({ bcSettings: { version: 5, navigation: { global: { customLinks: [{ label: "A", url: "https://a.test" }, { label: "B", url: "https://b.test" }] } } } });
  const a = await surface(db, "studio"), b = await surface(db, "options");
  const make = (v) => v.BC.SettingsComponents.links({ get: () => v.store.get().navigation.global.customLinks, set: (links) => v.store.set((d) => { d.navigation.global.customLinks = links; }) });
  try {
    const linksA = make(a), linksB = make(b); a.doc.body.append(linksA); b.doc.body.append(linksB);
    const labels = linksB.querySelectorAll('[aria-label="Link label"]');
    linksA.querySelector('[aria-label="Remove link"]').click(); await a.store.flush();
    labels[1].value = "Renamed B"; labels[1].dispatchEvent(new b.dom.window.Event("input")); await b.store.flush();
    assert.deepEqual(db.data.bcSettings.navigation.global.customLinks.map((link) => link.label), ["Renamed B"]);
    // Refresh changes row positions while the retained control still refers to B.
    labels[0].value = "Deleted A"; labels[0].dispatchEvent(new b.dom.window.Event("input")); await b.store.flush();
    assert.deepEqual(db.data.bcSettings.navigation.global.customLinks.map((link) => link.label), ["Renamed B"]);
    for (const v of [a, b]) [...make(v).querySelectorAll("button")].find((button) => button.textContent === "Add link").click();
    await Promise.all([a.store.flush(), b.store.flush()]);
    assert.equal(db.data.bcSettings.navigation.global.customLinks.length, 3);
    assert.equal(new Set(db.data.bcSettings.navigation.global.customLinks.map((link) => link.id)).size, 3);
  } finally { a.close(); b.close(); }
});

test("settings conflicts rerun fresh mutators and imports and reset deliberately replace settings", async () => {
  const db = database(), a = db.tab(), b = await surface(db, "options"); await a.storage.load();
  try {
    let runs = 0, once = false;
    db.beforeSend((message) => { if (message.type === "bc:settingsCommit" && !once) { once = true; db.data.bcSettings = { version: 5, dashboard: { columns: 9 } }; } });
    await a.storage.update((d) => { runs++; d.files.starred.push("one"); });
    assert.equal(runs, 2); assert.equal(db.data.bcSettings.dashboard.columns, 9);
    db.beforeSend(null);
    b.store.importJSON('{"enabled":false}'); await b.store.flush();
    assert.equal(db.data.bcSettings.enabled, false);
    assert.deepEqual(db.data.bcSettings.files.starred, []);
    assert.equal(db.data.bcSettings.dashboard.columns, b.BC.cloneDefaults().dashboard.columns);
    b.store.reset(); await b.store.flush(); assert.equal(db.data.bcSettings.enabled, true);
    assert.deepEqual(copy(b.store.get()), copy(db.data.bcSettings));
  } finally { b.close(); }
});


test("settings writer bounds retries, recovers after failure and only writes its fixed key", async () => {
  const db = database(), a = db.tab(); await a.storage.load();
  let commits = 0;
  db.beforeSend((message) => { if (message.type === "bc:settingsCommit") db.data.bcSettings = { version: 5, interference: ++commits }; });
  await assert.rejects(a.storage.update((d) => { d.enabled = false; }), /Other tabs kept changing settings/);
  assert.equal(commits, 8);
  db.beforeSend(null);
  await a.storage.update((d) => { d.enabled = false; });
  const snapshot = await a.storage.request({ type: "bc:settingsRead" });
  await a.storage.request({ type: "bc:settingsCommit", base: snapshot.base, value: snapshot.value, key: "untrusted", values: { untrusted: true } });
  assert.equal(db.data.bcSettings.enabled, false);
  assert.equal(db.data.untrusted, undefined);
  assert.equal(db.data.bcLocal.notes && Object.keys(db.data.bcLocal.notes).length, 0);
});
