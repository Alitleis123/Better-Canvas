const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
function context(data = {}) {
  const chrome = { runtime: { getURL: (s) => 'chrome-extension://test/' + s }, storage: { local: {
    get: (_keys, cb) => queueMicrotask(() => cb(structuredClone(data))),
    set: (value, cb) => { Object.assign(data, structuredClone(value)); queueMicrotask(cb); },
    remove: (key, cb) => { delete data[key]; queueMicrotask(cb); },
  } } };
  const ctx = vm.createContext({ URL, navigator: { platform: "MacIntel" }, chrome, crypto: { randomUUID }, setTimeout, clearTimeout, structuredClone });
  for (const file of ['shared/defaults', 'shared/themes', 'shared/theme-library', 'shared/theme-scenes', 'shared/theme-artwork', 'shared/theme-media', 'content/core/util', 'shared/settings/locker'])
    vm.runInContext(fs.readFileSync(path.join(root, 'src/' + file + '.js'), 'utf8'), ctx);
  return { BC: ctx.BC, chrome, data };
}
test('bundled anime artwork is portable, distinct per course and present in both browser packages', () => {
  const { BC } = context();
  const packs = BC.PRESET_THEMES.filter((p) => p.category === 'anime');
  assert.equal(packs.length, 6);
  for (const pack of packs) {
    const imported = BC.themeOnly(JSON.parse(JSON.stringify(pack.settings)));
    assert.equal(imported.dashboard.themeImages.length, 32);
    const assigned = BC.assignThemeImages(imported.dashboard.themeImages, Array.from({ length: 32 }, (_, i) => String(i * 32)));
    assert.equal(new Set([...assigned.values()].map((a) => BC.themeMedia.resolve(a.url))).size, 32);
    assert.match(BC.themeMedia.resolve(imported.cosmetics.background.image), /-wallpaper\.png$/);
    for (const url of [imported.cosmetics.background.image, ...imported.dashboard.themeImages.map((i) => i.url)]) {
      const resolved = BC.themeMedia.resolve(url).replace('chrome-extension://test/', '').split('#')[0];
      assert.ok(fs.existsSync(path.join(root, resolved)));
    }
    const state = BC.cloneDefaults();
    state.theming.reducedMotion = true;
    BC.applyTheme(state, { settings: imported });
    assert.equal(state.theming.reducedMotion, true);
    assert.equal(state.cosmetics.motion, pack.settings.cosmetics.motion);
  }
  for (const file of ['manifest.json', 'manifest.firefox.json']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, file)));
    assert.ok(manifest.web_accessible_resources.some((r) => r.resources.includes('src/assets/themes/*.png')));
  }
});
test('asset references cannot escape the bundled artwork allowlist', () => {
  const { BC } = context();
  for (const url of ['bc-art:../../secret#0', 'bc-art:anime-garden#32', 'bc-art:anime-night#-1', 'bc-wall:../../other', 'chrome-extension://other/private.png', 'javascript:alert(1)']) {
    assert.equal(BC.themeMedia.parse(url), null);
    assert.equal(BC.themeImages([{ url }]).length, 0);
  }
  assert.equal(BC.themeMedia.position('bc-art:anime-garden#31'), '100% 100%');
  assert.equal(BC.themeMedia.position('bc-wall:anime-night'), 'center');
});
test('locker items persist across contexts and separate item writes preserve unrelated notes and planner data', async () => {
  const data = { bcLocal: { todo: { keep: true } } };
  const a = context(data), b = context(data);
  await Promise.all([
    a.BC.Locker.save({ id: 'note-a', type: 'note', title: 'Biology', body: 'Study photosynthesis' }),
    b.BC.Locker.save({ id: 'set-b', type: 'set', title: 'Cells', cards: [{ front: 'Powerhouse?', back: 'Mitochondria' }] }),
  ]);
  const restored = await context(data).BC.Locker.list();
  assert.equal(restored.length, 2);
  assert.equal(restored.find((i) => i.id === 'set-b').cards[0].back, 'Mitochondria');
  await a.BC.Locker.remove('note-a');
  assert.equal((await b.BC.Locker.list()).length, 1);
  assert.deepEqual(data.bcLocal, { todo: { keep: true } });
});
test('locker rejects malformed items and unsafe bookmark URLs and reports storage failures', async () => {
  const { BC, chrome } = context();
  assert.equal(BC.Locker.normalize({ type: 'script' }), null);
  const note = BC.Locker.normalize({ type: 'link', url: 'javascript:alert(1)', body: 'x'.repeat(110000), cards: [null, { front: '<img src=x onerror=alert(1)>', back: 'plain text' }] });
  assert.equal(note.url, ''); assert.equal(note.body.length, 100000); assert.equal(note.cards.length, 1);
  chrome.storage.local.set = (_value, cb) => { chrome.runtime.lastError = { message: 'Quota exceeded' }; cb(); delete chrome.runtime.lastError; };
  await assert.rejects(BC.Locker.save({ id: 'test', type: 'note', title: 'Keep this draft' }), /Quota exceeded/);
});
