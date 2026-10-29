import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader, storageFixture, deferred } from './helpers/loadTs.mjs';

const food = (id = 'food-1', overrides = {}) => ({ id, name: ' Oats ', brand: ' Brand ',
  kcalPer100: 380, protPer100: 13.2, carbPer100: 60.1, fatPer100: 7.3, defaultUnit: 'g', ...overrides });
let library, local, entry, load, writes, writeError, writeHook;
beforeEach(() => {
  storageFixture();
  writes = [];
  writeError = null;
  writeHook = async () => {};
  globalThis.fetch = async () => ({ ok: true });
  load = moduleLoader({ './supabase': { supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) },
    from: table => ({ upsert: async (payload, options) => {
      writes.push({ table, payload, options });
      await writeHook();
      return { error: writeError };
    } }),
  } } });
  library = load('./customFoods');
  local = load('./localData');
  entry = load('./foodEntry');
});

test('validation trims names/brands, preserves IDs and normalizes ml', () => {
  const [parsed] = library.parseCustomFoods([food('stable', { defaultUnit: 'ml' })]);
  assert.equal(parsed.id, 'stable');
  assert.equal(parsed.name, 'Oats');
  assert.equal(parsed.brand, 'Brand');
  assert.equal(parsed.isLiquid, true);
});

for (const value of [-1, NaN, Infinity, -Infinity, '12', null, undefined]) {
  test(`reject invalid nutrition ${String(value)} in each field`, () => {
    for (const key of ['kcalPer100', 'protPer100', 'carbPer100', 'fatPer100'])
      assert.equal(library.parseCustomFoods([food('a', { [key]: value })]), null);
  });
}

test('reject blank/overlong names, bad units, malformed lists and duplicate IDs', () => {
  for (const value of [null, {}, [food('')], [food('a', { name: '   ' })],
    [food('a', { name: 'a'.repeat(201) })], [food('a', { brand: 5 })],
    [food('a', { defaultUnit: 'pcs' })], [food('a'), food('a')]])
    assert.equal(library.parseCustomFoods(value), null);
  assert.deepEqual(library.parseCustomFoods([]), []);
});

test('malformed local JSON is safe; invalid cloud data never replaces local foods', () => {
  localStorage.setItem(library.CUSTOM_FOODS_KEY, '{');
  assert.deepEqual(library.readCustomFoods(), []);
  library.saveCustomFoods([food()], 'guest');
  library.applyCloudCustomFoods([food('broken', { fatPer100: -1 })]);
  assert.equal(library.readCustomFoods()[0].id, 'food-1');
});

test('templates stay isolated, are not guest-imported, and clear with account data', () => {
  library.saveCustomFoods([food('guest-food')], 'guest');
  local.switchWorkspace('A');
  assert.deepEqual(library.readCustomFoods(), []);
  local.importGuestData('A');
  assert.deepEqual(library.readCustomFoods(), []);
  library.saveCustomFoods([food('A-food')], 'A');
  local.switchWorkspace('B');
  assert.deepEqual(library.readCustomFoods(), []);
  local.switchWorkspace('A');
  assert.equal(library.readCustomFoods()[0].id, 'A-food');
  local.clearActiveHealthData();
  assert.equal(localStorage.getItem(library.CUSTOM_FOODS_KEY), null);
  assert.equal(localStorage.getItem(library.CUSTOM_FOODS_DIRTY_KEY), null);
  local.switchWorkspace('guest');
  assert.equal(library.readCustomFoods()[0].id, 'guest-food');
});

test('wrong-owner saves reject without writing; queue failure retains data and recovers after module reload', () => {
  assert.throws(() => library.saveCustomFoods([food()], 'A'), /workspace/);
  local.switchWorkspace('A');
  const setItem = localStorage.setItem;
  localStorage.setItem = (key, value) => {
    if (key === 'healthsync_pending_settings') throw new Error('quota');
    setItem(key, value);
  };
  assert.equal(library.saveCustomFoods([food()], 'A').queuePending, true);
  const reloaded = moduleLoader()('./customFoods');
  reloaded.applyCloudCustomFoods([]);
  assert.equal(reloaded.readCustomFoods().length, 1);
  localStorage.setItem = setItem;
  reloaded.queueDirtyCustomFoods();
  assert.equal(JSON.parse(localStorage.getItem('healthsync_pending_settings')).custom_foods[0].id, 'food-1');
});

test('failed local write preserves the previous list and never queues a failed edit', () => {
  local.switchWorkspace('A');
  library.saveCustomFoods([food('original')], 'A');
  const setItem = localStorage.setItem;
  localStorage.setItem = (key, value) => {
    if (key === library.CUSTOM_FOODS_KEY) throw new Error('quota');
    setItem(key, value);
  };
  assert.throws(() => library.saveCustomFoods([], 'A'), /quota/);
  assert.equal(library.readCustomFoods()[0].id, 'original');
  assert.equal(JSON.parse(localStorage.getItem('healthsync_pending_settings')).custom_foods[0].id, 'original');
});

test('a failed first local write does not mark an empty library for upload', () => {
  local.switchWorkspace('A');
  const setItem = localStorage.setItem;
  localStorage.setItem = (key, value) => {
    if (key === library.CUSTOM_FOODS_KEY) throw new Error('quota');
    setItem(key, value);
  };
  assert.throws(() => library.saveCustomFoods([food()], 'A'), /quota/);
  assert.equal(localStorage.getItem(library.CUSTOM_FOODS_DIRTY_KEY), null);
  library.queueDirtyCustomFoods();
  assert.equal(localStorage.getItem('healthsync_pending_settings'), null);
});

test('settings upload retains queue on failure and uses owner-scoped upsert; favourites stay local', async () => {
  local.switchWorkspace('A');
  localStorage.setItem('calsync_favourites', JSON.stringify([food('fav')]));
  library.saveCustomFoods([food()], 'A');
  const pending = JSON.parse(localStorage.getItem('healthsync_pending_settings'));
  writeError = new Error('offline');
  await assert.rejects(load('./sync').pushSettings('A', pending));
  assert.deepEqual(JSON.parse(localStorage.getItem('healthsync_pending_settings')), pending);
  writeError = null;
  await load('./sync').pushSettings('A', pending);
  local.acknowledgeSettings(pending);
  library.applyCloudCustomFoods(pending.custom_foods);
  assert.equal(writes[1].table, 'user_settings');
  assert.equal(writes[1].payload.user_id, 'A');
  assert.equal(writes[1].options.onConflict, 'user_id');
  assert.equal(Object.hasOwn(writes[1].payload, 'favourites'), false);
  assert.equal(localStorage.getItem(library.CUSTOM_FOODS_DIRTY_KEY), null);
});

test('a save during upload and stale final pull cannot erase a newer edit/deletion', async () => {
  local.switchWorkspace('A');
  library.saveCustomFoods([food()], 'A');
  const oldPending = JSON.parse(localStorage.getItem('healthsync_pending_settings'));
  const wait = deferred();
  writeHook = () => wait.promise;
  const upload = load('./sync').pushSettings('A', oldPending);
  library.saveCustomFoods([], 'A');
  wait.resolve();
  await upload;
  local.acknowledgeSettings(oldPending);
  library.applyCloudCustomFoods(oldPending.custom_foods);
  assert.deepEqual(library.readCustomFoods(), []);
  assert.deepEqual(JSON.parse(localStorage.getItem('healthsync_pending_settings')).custom_foods, []);
  local.acknowledgeSettings({ custom_foods: [] });
  library.applyCloudCustomFoods(oldPending.custom_foods);
  assert.deepEqual(library.readCustomFoods(), []);
  library.applyCloudCustomFoods([]);
  assert.equal(localStorage.getItem(library.CUSTOM_FOODS_DIRTY_KEY), null);
});

test('search deduplicates exact favourites/cross-source copies but preserves distinct IDs, brands, nutrients and barcodes', () => {
  const custom = library.parseCustomFoods([food('a'), food('b')]);
  const same = { ...custom[0], isFavourite: true };
  const favourites = [same, same, { ...same, brand: 'Other' }, { ...same, kcalPer100: 400 },
    { ...same, barcode: '123' }, { ...same, barcode: '456' }, { name: 'bad' }];
  assert.equal(library.searchSavedFoods(custom, favourites, '').length, 6);
  assert.equal(library.searchSavedFoods(custom, favourites, 'oAtS OTHER').length, 1);
  assert.equal(library.searchSavedFoods(custom, favourites, 'missing').length, 0);
  assert.deepEqual(library.searchSavedFoods([], {}, ''), []);
});

test('shared calculation logs a snapshot; template creation/edit/deletion never mutates logged entries', async () => {
  const original = library.parseCustomFoods([food()])[0];
  library.saveCustomFoods([original], 'guest');
  assert.equal(localStorage.getItem('calsync_v1'), null);
  const built = entry.buildFoodEntry(original, 125, 'g', 1000);
  assert.equal(built.kcal, 475);
  assert.equal(built.prot, 16.5);
  assert.equal(built.carb, 75.1);
  assert.equal(built.fat, 9.1);
  assert.equal(built.date, new Date(1000).toDateString());
  await load('./foodLog').logFoodEntry(built);
  library.saveCustomFoods([food('food-1', { kcalPer100: 10 })], 'guest');
  library.saveCustomFoods([], 'guest');
  assert.deepEqual(JSON.parse(localStorage.getItem('calsync_v1')), [JSON.parse(JSON.stringify(built))]);
  for (const amount of [0, -1, NaN, Infinity]) assert.throws(() => entry.buildFoodEntry(original, amount, 'g'));
});

test('ml templates retain liquid logging and mirrored hydration', async () => {
  const liquid = library.parseCustomFoods([food('milk', { defaultUnit: 'ml' })])[0];
  const built = entry.buildFoodEntry(liquid, 250, 'ml');
  await load('./foodLog').logFoodEntry(built);
  assert.equal(built.isDrink, true);
  assert.equal(JSON.parse(localStorage.getItem('dropsync_v3'))[0].amount, 250);
});
