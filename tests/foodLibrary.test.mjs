import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader, storageFixture, deferred } from './helpers/loadTs.mjs';

const food = (id = 'oats', extra = {}) => ({ id, kind: 'food', name: 'Oats', brand: 'Mill', defaultUnit: 'g',
    kcalPer100: 400, protPer100: 10, carbPer100: 60, fatPer100: 10, ...extra });
let load, library, local, builder;
beforeEach(() => {
    storageFixture();
    load = moduleLoader({ './supabase': { supabase: {} } });
    library = load('./foodLibrary'); local = load('./localData'); builder = load('./foodEntry');
});
const recipe = (id = 'porridge', ingredients = [{ foodId: 'oats', amount: 50, unit: 'g' }], yieldValue = { amount: 2, unit: 'serving' }) =>
    food(id, { kind: 'recipe', name: 'Porridge', recipe: { ingredients, yield: yieldValue } });

test('legacy migration retains sources, stable custom IDs, metadata and distinct favorites without rewriting history', () => {
    localStorage.setItem('calsync_custom_foods', JSON.stringify([food()]));
    localStorage.setItem('calsync_favourites', JSON.stringify([food(), food('ignored', { brand: 'Other' })]));
    const history = [{ id: 'old', food: 'Oats', kcal: 400, prot: 10, carb: 60, fat: 10, amount: 100, unit: 'g', ts: Date.now(), date: new Date().toDateString() }];
    localStorage.setItem('calsync_v1', JSON.stringify(history));
    const data = library.libraryData();
    assert.equal(data.foods.size, 2); assert.equal(data.favorites.size, 2); assert.equal(data.foods.get('oats').name, 'Oats');
    const serialized = localStorage.getItem(library.FOOD_LIBRARY_KEY);
    library.libraryData(); assert.equal(localStorage.getItem(library.FOOD_LIBRARY_KEY), serialized);
    assert.deepEqual(JSON.parse(localStorage.getItem('calsync_v1')), history);
    assert.equal(JSON.parse(localStorage.getItem('calsync_custom_foods'))[0].id, 'oats');
});

test('latest linked occurrence appears once, all occurrences retain independent snapshot totals', () => {
    const definition = library.saveLibraryFood(food());
    const old = builder.buildFoodEntry(definition, 100, 'g', Date.now() - 86400000);
    const latest = builder.buildFoodEntry(definition, 50, 'g', Date.now());
    const results = library.searchLibrary([old, latest, old], '');
    assert.equal(results.length, 1); assert.equal(results[0].latest.id, latest.id);
    assert.equal(old.kcal + latest.kcal, 600);
});

test('14 days applies only to history while saved foods and favorites remain indefinitely', () => {
    const now = Date.now();
    const make = (id, age) => ({ ...builder.buildFoodEntry(food(id, { name: id }), 100, 'g', now - age), catalogFoodId: undefined });
    const logs = [make('expired', 14 * 86400000 + 1), make('boundary', 14 * 86400000), make('recent', 1)];
    library.saveLibraryFood(food('saved')); library.setFoodFavorite(food('favorite', { name: 'Favorite' }), true);
    assert.deepEqual(library.searchLibrary(logs, '', false, now).map(item => item.food.name).sort(), ['Favorite', 'Oats', 'boundary', 'recent']);
    assert.deepEqual(library.searchLibrary(logs, '', true, now).map(item => item.food.name), ['Favorite']);
    assert.equal(library.searchLibrary(logs, 'recent', true, now).length, 0);
});

test('identical new foods reuse an ID while distinct brands, barcodes, units and nutrition stay separate', () => {
    library.saveLibraryFood(food('one')); assert.equal(library.saveLibraryFood(food('two')).id, 'one');
    const logs = [food('a', { brand: 'Other' }), food('b', { barcode: '123' }), food('c', { defaultUnit: 'ml', isLiquid: true }), food('d', { kcalPer100: 410 })]
        .map(item => ({ ...builder.buildFoodEntry(item, 100, item.defaultUnit), catalogFoodId: undefined }));
    assert.equal(library.searchLibrary(logs, '').length, 5);
});

test('favoriting history establishes saved identity without mutating the log and survives unfavoriting', () => {
    const log = builder.buildFoodEntry(food(), 100, 'g');
    const original = JSON.stringify(log);
    const result = library.searchLibrary([log], '')[0];
    const saved = library.setFoodFavorite(result.food, true);
    assert.ok(saved.catalogFoodId); assert.equal(library.searchLibrary([log], '', true).length, 1);
    library.setFoodFavorite(saved, false);
    assert.equal(library.searchLibrary([log], '', true).length, 0);
    assert.equal(library.searchLibrary([log], '').length, 1); assert.equal(JSON.stringify(log), original);
});

test('definitions, favorites, drafts, journals and pending operations are guest/A/B isolated and clear with reset', () => {
    library.saveLibraryFood(food('guest'));
    localStorage.setItem('calsync_food_selection_v1', '{"version":1,"items":[]}');
    local.switchWorkspace('A'); assert.equal(library.libraryData().foods.size, 0);
    local.importGuestData('A'); assert.equal(library.libraryData().foods.size, 0);
    library.saveLibraryFood(food('A')); local.switchWorkspace('B'); assert.equal(library.libraryData().foods.size, 0);
    local.switchWorkspace('A'); assert.ok(library.libraryData().foods.has('A'));
    local.clearActiveHealthData(); assert.equal(localStorage.getItem(library.FOOD_LIBRARY_KEY), null);
    local.switchWorkspace('guest'); assert.ok(library.libraryData().foods.has('guest'));
    assert.ok(localStorage.getItem('calsync_food_selection_v1'));
});

test('invalid or quota-limited local data is preserved rather than overwritten', () => {
    localStorage.setItem(library.FOOD_LIBRARY_KEY, '{');
    assert.throws(() => library.saveLibraryFood(food())); assert.equal(localStorage.getItem(library.FOOD_LIBRARY_KEY), '{');
    localStorage.removeItem(library.FOOD_LIBRARY_KEY); library.saveLibraryFood(food());
    const original = localStorage.getItem(library.FOOD_LIBRARY_KEY), setter = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => library.saveLibraryFood(food('new')));
    localStorage.setItem = setter; assert.equal(localStorage.getItem(library.FOOD_LIBRARY_KEY), original);
});

test('stale pulls cannot erase local edit, delete or later favorite; independent device edits converge', () => {
    local.switchWorkspace('A'); library.saveLibraryFood(food('one')); library.saveLibraryFood(food('two'));
    const initial = structuredClone(library.readLibraryState().changes);
    library.saveLibraryFood(food('one', { name: 'New' })); library.deleteLibraryFood('two');
    const newer = structuredClone(library.readLibraryState().changes);
    library.mergeLibraryChanges(initial, initial.map(item => item.id), 'A');
    assert.equal(library.libraryData().foods.get('one').name, 'New'); assert.equal(library.libraryData().foods.has('two'), false);
    const remote = { id: 'remote-star', foodId: 'one', at: 500, kind: 'favorite', favorite: true };
    library.mergeLibraryChanges([remote], [], 'A');
    assert.ok(library.libraryData().favorites.has('one')); assert.ok(library.readLibraryState().pending.length);
    assert.deepEqual(library.materialize([...newer, remote]), library.materialize([remote, ...newer].reverse()));
});

test('recipe portions calculate nested ingredients and retain full logged snapshots after future edits', () => {
    library.saveLibraryFood(food()); library.saveLibraryFood(recipe());
    const first = library.resolveFood('porridge', library.libraryData().foods);
    assert.equal(first.kcalPer100, 100); assert.deepEqual(first.portion, { unit: 'serving', amount: 100 });
    assert.deepEqual(load('./foodPortions').foodAmountUnits(first), ['serving']);
    assert.equal(load('./foodPortions').foodBasisLabel(first), '1 serving');
    assert.equal(builder.buildFoodEntry(first, 150, 'g').amount, 1.5);
    assert.equal(builder.buildFoodEntry(first, 150, 'g').unit, 'serving');
    library.saveLibraryFood(recipe('double', [{ foodId: 'porridge', amount: 2, unit: 'serving' }], { amount: 200, unit: 'g' }));
    const nested = library.resolveFood('double', library.libraryData().foods);
    assert.equal(nested.kcalPer100, 100);
    const logged = builder.buildFoodEntry(nested, 200, 'g'); const snapshot = JSON.stringify(logged);
    library.saveLibraryFood(food('oats', { kcalPer100: 800 }));
    assert.equal(library.resolveFood('double', library.libraryData().foods).kcalPer100, 200);
    assert.equal(logged.kcal, 200); assert.equal(JSON.stringify(logged), snapshot);
    assert.equal(logged.foodSnapshot.recipeSnapshot.ingredients[0].food.recipeSnapshot.ingredients[0].food.kcalPer100, 400);
});

test('recipe deletes are blocked for referenced ingredients; missing/cyclic/invalid nutrition stays visible', () => {
    library.saveLibraryFood(food()); library.saveLibraryFood(recipe());
    assert.throws(() => library.deleteLibraryFood('oats'), /recipe/);
    assert.throws(() => library.saveLibraryFood(recipe('cycle', [{ foodId: 'cycle', amount: 1, unit: 'g' }])), /circular/);
    assert.throws(() => library.saveLibraryFood(recipe('missing', [{ foodId: 'absent', amount: 1, unit: 'g' }])), /missing/);
    assert.throws(() => library.saveLibraryFood(food('bad', { protPer100: null })), /Invalid/);
    library.mergeLibraryChanges([{ id: 'remote-delete', foodId: 'oats', at: Date.now() + 10000, kind: 'definition', food: null }], [], 'guest');
    assert.match(library.searchLibrary([], '').find(item => item.id === 'porridge').error, /missing/);
});

test('batch journal recovers partial storage failures exactly once and queues food and hydration for retry', async () => {
    local.switchWorkspace('A');
    const logging = load('./foodLog');
    const foods = [builder.buildFoodEntry(food(), 100, 'g'), builder.buildFoodEntry(food('milk', { defaultUnit: 'ml', isLiquid: true }), 250, 'ml')];
    const setter = localStorage.setItem;
    localStorage.setItem = (key, value) => { if (key === 'dropsync_v3') throw new Error('quota'); setter(key, value); };
    await assert.rejects(logging.logFoodEntries(foods, 'A'), /quota/);
    assert.ok(localStorage.getItem(logging.FOOD_BATCH_KEY));
    localStorage.setItem = setter; logging.recoverFoodBatch(); logging.recoverFoodBatch();
    assert.equal(JSON.parse(localStorage.getItem('calsync_v1')).length, 2);
    assert.equal(JSON.parse(localStorage.getItem('dropsync_v3')).length, 1);
    assert.equal(local.pendingIds('food').size, 2); assert.equal(local.pendingIds('drinks').size, 1);
    assert.equal(localStorage.getItem(logging.FOOD_BATCH_KEY), null);
});

test('single food logging does not discard an unrelated multi-food selection', async () => {
    localStorage.setItem('calsync_food_selection_v1', '{"version":1,"items":[]}');
    await load('./foodLog').logFoodEntry(builder.buildFoodEntry(food(), 100, 'g'));
    assert.ok(localStorage.getItem('calsync_food_selection_v1'));
});

test('batch totals match rounded entries with converted portions and one shared local timestamp', () => {
    const { selectionEntry, batchNutrition } = load('./foodBatch');
    const { calendarDay, localBatchTime } = load('./foodDateTime');
    const ts = localBatchTime(calendarDay(new Date(2026, 9, 30)), 21, 15);
    const selections = [
        { id: 'a', food: food('a', { kcalPer100: 149, protPer100: 10.03, portion: { unit: 'pcs', amount: 30 } }), amount: '2.5', unit: 'pcs' },
        { id: 'b', food: food('b'), amount: '0.05', unit: 'kg' },
    ];
    const entries = selections.map(item => selectionEntry(item, ts));
    assert.deepEqual(batchNutrition(entries), { kcal: 312, prot: 12.5, carb: 75, fat: 12.5 });
    entries.forEach(entry => { assert.equal(entry.ts, ts); assert.equal(entry.date, new Date(ts).toDateString()); });
    assert.equal(new Date(ts).getHours(), 21); assert.equal(new Date(ts).getMinutes(), 15);
});

test('calendar days survive years of scrolling in both directions and cyclic wheels wrap', () => {
    const { calendarDay, dateForDay, wrapWheel, localBatchTime } = load('./foodDateTime');
    const start = calendarDay(new Date(2026, 9, 30));
    for (const offset of [-10000, -365, -1, 0, 1, 365, 10000]) {
        assert.equal(calendarDay(dateForDay(start + offset)), start + offset);
        const ts = localBatchTime(start + offset, 23, 59);
        assert.equal(calendarDay(new Date(ts)), start + offset);
    }
    assert.equal(wrapWheel(24, 24), 0); assert.equal(wrapWheel(-1, 24), 23);
    assert.equal(wrapWheel(60, 60), 0); assert.equal(wrapWheel(-1, 60), 59);
    assert.equal(wrapWheel(60059, 60), 59);
});

test('local commit returns before cloud settles; cloud failure keeps pending entries and selection cleared', async () => {
    local.switchWorkspace('A');
    const wait = deferred();
    const loader = moduleLoader({ './sync': { pushFoodEntriesToCloud: () => wait.promise, syncDrinkToCloud: async () => {} } });
    const logging = loader('./foodLog');
    const entries = [builder.buildFoodEntry(food(), 100, 'g')];
    localStorage.setItem('calsync_food_selection_v1', '{"version":1,"items":[1]}');
    const { cloudSync } = logging.commitFoodEntries(entries, 'A');
    assert.equal(JSON.parse(localStorage.getItem('calsync_v1')).length, 1);
    assert.equal(localStorage.getItem('calsync_food_selection_v1'), null);
    assert.equal(localStorage.getItem(logging.FOOD_BATCH_KEY), null);
    let settled = false; cloudSync.then(() => { settled = true; });
    await Promise.resolve(); assert.equal(settled, false);
    wait.resolve(Promise.reject(new Error('offline')));
    assert.deepEqual(await cloudSync, { cloudPending: true });
    assert.equal(local.pendingIds('food').size, 1);
    assert.equal(JSON.parse(localStorage.getItem('calsync_v1')).length, 1);
});

test('retry after recovery clears cached selection with the same IDs and rejects a different workspace', async () => {
    const logging = load('./foodLog');
    const entries = [builder.buildFoodEntry(food(), 100, 'g')];
    localStorage.setItem(logging.FOOD_BATCH_KEY, JSON.stringify({ owner: 'guest', entries, clearSelection: true }));
    logging.recoverFoodBatch();
    localStorage.setItem('calsync_food_selection_v1', '{"version":1,"items":[1]}');
    await logging.commitFoodEntries(entries).cloudSync;
    assert.equal(JSON.parse(localStorage.getItem('calsync_v1')).length, 1);
    assert.equal(localStorage.getItem('calsync_food_selection_v1'), null);
    local.switchWorkspace('B');
    assert.throws(() => logging.commitFoodEntries(entries, 'A'), /workspace/);
    assert.equal(localStorage.getItem('calsync_v1'), null);
});

function syncFixture() {
    const remote = new Map(); const uploads = []; let fail = false, hook = async () => {};
    const loader = moduleLoader({ './supabase': { supabase: {
        auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) },
        from: table => {
            let owner, start = 0, end = 499;
            const chain = { select: () => chain, eq: (_key, value) => { owner = value; return chain; }, gt: () => chain, order: () => chain,
                range: (a, b) => { start = a; end = b; return chain; },
                then: (yes, no) => { const rows = [...remote.values()].filter(row => row.user_id === owner).sort((a,b) => a.operation_id.localeCompare(b.operation_id));
                    return Promise.resolve({ data: rows.slice(start, Math.min(end + 1, start + 2)), count: rows.length, error: fail ? {} : null }).then(yes,no); },
                upsert: async (payload, options) => { uploads.push({ table, payload, options }); await hook(); if (fail) return { error: {} };
                    payload.forEach(row => { if (!remote.has(row.operation_id)) remote.set(row.operation_id, row); }); return { error: null }; },
            }; return chain;
        },
    } } });
    globalThis.fetch = async () => ({ ok: true });
    return { loader, remote, uploads, setFail: value => { fail = value; }, setHook: value => { hook = value; } };
}

test('cloud library uses immutable owner-scoped inserts, paginates, retains failed queue, and restores favorites on a second device', async () => {
    const fixture = syncFixture(); const a = fixture.loader('./foodLibrary'); const loc = fixture.loader('./localData'); loc.switchWorkspace('A');
    a.saveLibraryFood(food()); a.setFoodFavorite(food(), true); a.saveLibraryFood(food('other', { name: 'Other' }));
    fixture.setFail(true); await assert.rejects(fixture.loader('./sync').syncFoodLibrary('A')); assert.ok(a.readLibraryState().pending.length);
    fixture.setFail(false); await fixture.loader('./sync').syncFoodLibrary('A'); assert.equal(a.readLibraryState().pending.length, 0);
    assert.ok(fixture.uploads.every(item => item.table === 'food_library_changes' && item.options.ignoreDuplicates && item.payload.every(row => row.user_id === 'A')));
    loc.clearActiveHealthData(); await fixture.loader('./sync').syncFoodLibrary('A');
    assert.equal(a.libraryData().foods.size, 2); assert.ok(a.libraryData().favorites.has('oats'));
});

test('late cloud acknowledgement cannot clear pending edits after A -> B -> A', async () => {
    const fixture = syncFixture(); const a = fixture.loader('./foodLibrary'); const loc = fixture.loader('./localData'); loc.switchWorkspace('A'); a.saveLibraryFood(food());
    const gate = deferred(), started = deferred(); fixture.setHook(async () => { started.resolve(); await gate.promise; });
    const syncing = fixture.loader('./sync').syncFoodLibrary('A'); await started.promise;
    loc.switchWorkspace('B'); loc.switchWorkspace('A'); gate.resolve(); await assert.rejects(syncing, /upload/);
    assert.ok(a.readLibraryState().pending.length);
});

test('AI validates all nutrition and distinguishes editable recipe estimates', () => {
    const gemini = moduleLoader({ '@/lib/logger': { logger: { error() {} } } })('./gemini');
    const candidate = { name: 'Oats', brand: '', amount: 100, unit: 'g', calories: 400, protein: 10, carbs: 60, fat: 10 };
    for (const bad of [null, undefined, -1, '10', NaN]) assert.throws(() => gemini.sanitizeGeminiResponse({ ...candidate, protein: bad }), /no_json/);
    const recipe = { name: 'Porridge', ingredients: [{ name: 'Oats', amount: 50, unit: 'g' }], yield: { amount: 2, unit: 'serving' } };
    const result = gemini.sanitizeGeminiResponse({ ...candidate, kind: 'recipe', recipe });
    assert.equal(result.kind, 'recipe');
    const draft = gemini.toGeminiFoodSearchResult(result, { name: 'Food', emoji: '', color: '' });
    assert.deepEqual(draft.aiRecipeCandidate, recipe); assert.throws(() => library.ensureLibraryFood(draft), /Review/);
    assert.throws(() => gemini.sanitizeGeminiResponse({ ...candidate, kind: 'recipe', recipe: { ...recipe, ingredients: [] } }), /no_json/);
});

test('AI food icons are validated, retained in catalog/log snapshots, and missing icons keep the category fallback', async () => {
    const gemini = moduleLoader({ '@/lib/logger': { logger: { error() {} } } })('./gemini');
    const candidate = { name: 'Oats', brand: '', amount: 100, unit: 'g', calories: 400, protein: 10, carbs: 60, fat: 10, icon: 'fa-solid fa-bowl-food' };
    const fallback = { name: 'Food', emoji: 'fa-solid fa-egg', color: '' };
    const result = gemini.sanitizeGeminiResponse(candidate);
    const saved = library.ensureLibraryFood(gemini.toGeminiFoodSearchResult(result, fallback));
    assert.equal(saved.emoji, candidate.icon);
    assert.equal(library.libraryData().foods.get(saved.catalogFoodId).emoji, candidate.icon);
    assert.equal(builder.buildFoodEntry(saved, 100, 'g').foodSnapshot.emoji, candidate.icon);
    for (const icon of [undefined, null, 'unknown', '<svg onload=alert(1)>', 'fa-solid fa-bowl-food extra-class']) {
        const parsed = gemini.sanitizeGeminiResponse({ ...candidate, icon });
        assert.equal(gemini.toGeminiFoodSearchResult(parsed, fallback).emoji, fallback.emoji);
    }
    const original = globalThis.fetch;
    try {
        globalThis.fetch = async (_url, request) => {
            const body = JSON.parse(request.body);
            assert.ok(body.generationConfig.response_schema.required.includes('icon'));
            assert.ok(body.generationConfig.response_schema.properties.icon.enum.includes(candidate.icon));
            assert.match(body.contents[0].parts[0].text, /"icon": the most relevant food icon/);
            return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(candidate) }] } }] }) };
        };
        assert.equal((await gemini.analyzeWithGemini('100 g oats', 'fixture-placeholder', 'text')).icon, candidate.icon);
    } finally { globalThis.fetch = original; }
});
