import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader, storageFixture } from './helpers/loadTs.mjs';

let portions, library, entries, local, load;
const food = overrides => ({ id: 'piece-food', name: 'Rice cake', defaultUnit: 'g',
  kcalPer100: 400, protPer100: 8, carbPer100: 80, fatPer100: 4, ...overrides });
beforeEach(() => {
  storageFixture();
  load = moduleLoader({ './sync': { pushFoodEntriesToCloud: async () => {}, syncDrinkToCloud: async () => {} } });
  portions = load('./foodPortions');
  library = load('./customFoods');
  entries = load('./foodEntry');
  local = load('./localData');
});

test('per-piece nutrition normalizes and scales through the shared FoodEntry calculation', () => {
  assert.equal(portions.nutritionPer100(20, 5), 400);
  const template = library.parseCustomFoods([food({ portion: { unit: 'pcs', amount: 5 } })])[0];
  const base = portions.foodAmountToBase(template, 2.5, 'pcs');
  assert.deepEqual(base, { amount: 12.5, unit: 'g' });
  const entry = entries.buildFoodEntry(template, base.amount, base.unit);
  assert.equal(entry.kcal, 50);
  assert.equal(entry.prot, 1);
  assert.equal(entry.amount, 12.5);
  assert.equal(entry.unit, 'g');
});

test('a custom nutrition reference normalizes independently of consumption and survives storage', () => {
  for (const [reference, unit, amount, kcal, prot] of [[150, 'g', 80, 160, 8], [250, 'ml', 125, 150, 7.5], [12.5, 'g', 6.25, 150, 7.5]]) {
    const template = food({ defaultUnit: unit, nutritionBasisAmount: reference,
      kcalPer100: portions.nutritionPer100(300, reference), protPer100: portions.nutritionPer100(15, reference) });
    library.saveCustomFoods([template], 'guest');
    const [saved] = library.readCustomFoods();
    assert.equal(saved.nutritionBasisAmount, reference);
    assert.deepEqual(portions.foodDefaultAmount(saved), { amount: reference, unit });
    const entry = entries.buildFoodAmountEntry(saved, amount, unit);
    assert.equal(entry.kcal, kcal);
    assert.equal(entry.prot, prot);
    assert.equal(entry.foodSnapshot.nutritionBasisAmount, reference);
    assert.equal(entry.foodSnapshot.selectedAmount.amount, amount);
  }
  assert.deepEqual(portions.foodDefaultAmount(food()), { amount: 100, unit: 'g' });
  for (const nutritionBasisAmount of [0, -1, NaN, Infinity, '50', null]) {
    assert.equal(library.parseCustomFoods([food({ nutritionBasisAmount })]), null);
    assert.throws(() => portions.nutritionPer100(300, nutritionBasisAmount));
  }
});

test('ounce, US fluid ounce, kilogram and liter have separate mass/volume conversions', () => {
  const solid = food();
  const liquid = food({ defaultUnit: 'ml', isLiquid: true });
  assert.equal(portions.foodAmountToBase(solid, 1, 'oz').amount, 28.349523125);
  assert.equal(portions.foodAmountToBase(liquid, 1, 'fl_oz').amount, 29.5735295625);
  assert.equal(portions.foodAmountToBase(solid, 0.25, 'kg').amount, 250);
  assert.equal(portions.foodAmountToBase(liquid, 0.5, 'l').amount, 500);
  assert.throws(() => portions.foodAmountToBase(solid, 1, 'fl_oz'));
  assert.throws(() => portions.foodAmountToBase(liquid, 1, 'oz'));
});

test('a weight explicitly supplied for a US fluid ounce is used instead of guessing density', () => {
  const template = library.parseCustomFoods([food({ portion: { unit: 'fl_oz', amount: 32 } })])[0];
  assert.deepEqual(portions.foodAmountToBase(template, 2, 'fl_oz'), { amount: 64, unit: 'g' });
  assert.equal(template.isLiquid, false);
  assert.ok(portions.foodAmountUnits(template).includes('fl_oz'));
  assert.equal(portions.foodAmountToBase(template, portions.ML_PER_US_FL_OUNCE, 'ml').amount, 32);
  assert.equal(portions.foodUnitOptionLabel(template, 'ml'), 'ml');
});

test('mass-based foods offer a labeled 1:1 ml estimate and kg switching preserves nutrition', () => {
  const template = food();
  assert.ok(portions.foodAmountUnits(template).includes('ml'));
  assert.equal(portions.foodUnitOptionLabel(template, 'ml'), 'ml (1:1 estimate)');
  const grams = portions.foodAmountToBase(template, .5, 'kg');
  const ml = portions.foodAmountToBase(template, grams.amount, 'ml');
  assert.deepEqual(ml, { amount: 500, unit: 'g' });
  assert.equal(entries.foodNutrition(template, ml.amount).kcal, entries.foodNutrition(template, grams.amount).kcal);
  assert.throws(() => portions.foodAmountToBase(template, Infinity, 'ml'));
});

test('fractional ml remain precise in food; hydration retains its whole-ml storage convention', async () => {
  const template = library.parseCustomFoods([food({ defaultUnit: 'ml', portion: { unit: 'serving', amount: 0.5 } })])[0];
  const base = portions.foodAmountToBase(template, 0.5, 'serving');
  const entry = entries.buildFoodEntry(template, base.amount, base.unit);
  await load('./foodLog').logFoodEntry(entry);
  assert.equal(entry.amount, 0.25);
  assert.equal(JSON.parse(localStorage.getItem('dropsync_v3'))[0].amount, 0);
  const fluid = food({ defaultUnit: 'ml', isLiquid: true });
  const fluidAmount = portions.foodAmountToBase(fluid, 1, 'fl_oz');
  await load('./foodLog').logFoodEntry(entries.buildFoodEntry(fluid, fluidAmount.amount, fluidAmount.unit));
  assert.equal(JSON.parse(localStorage.getItem('dropsync_v3'))[1].amount, 30);
});

test('portion metadata survives save/reload, pending settings and cloud confirmation without changing old templates', () => {
  local.switchWorkspace('A');
  const definitions = library.parseCustomFoods([food({ portion: { unit: 'pcs', amount: 5 } }), food({ id: 'legacy' })]);
  library.saveCustomFoods(definitions, 'A');
  const reloaded = moduleLoader()('./customFoods');
  assert.deepEqual(reloaded.readCustomFoods()[0].portion, { unit: 'pcs', amount: 5 });
  assert.equal(reloaded.readCustomFoods()[1].portion, undefined);
  const queued = JSON.parse(localStorage.getItem('healthsync_pending_settings'));
  assert.deepEqual(queued.custom_foods[0].portion, { unit: 'pcs', amount: 5 });
  local.acknowledgeSettings(queued);
  reloaded.applyCloudCustomFoods(queued.custom_foods);
  assert.deepEqual(reloaded.readCustomFoods(), definitions);
});

test('search preserves foods with different portion sizes', () => {
  const first = food({ portion: { unit: 'pcs', amount: 5 } });
  const second = food({ portion: { unit: 'pcs', amount: 10 } });
  assert.equal(library.searchSavedFoods([], [first, first, second], '').length, 2);
});

for (const amount of [0, -1, NaN, Infinity, '50', null]) {
  test(`reject invalid portion size ${String(amount)}`, () => {
    assert.equal(library.parseCustomFoods([food({ portion: { unit: 'pcs', amount } })]), null);
  });
}

test('reject unknown portions, mass ounces with an ml base, overflow and unsupported unit conversions', () => {
  for (const portion of [null, {}, { unit: 'unknown', amount: 10 }])
    assert.equal(library.parseCustomFoods([food({ portion })]), null);
  assert.equal(library.parseCustomFoods([food({ defaultUnit: 'ml', portion: { unit: 'oz', amount: 28 } })]), null);
  for (const amount of [0, -1, NaN, Infinity]) assert.throws(() => portions.foodAmountToBase(food(), amount, 'g'));
  assert.throws(() => portions.foodAmountToBase(food(), Number.MAX_VALUE, 'kg'));
  assert.throws(() => portions.nutritionPer100(Number.MAX_VALUE, 0.001));
  assert.throws(() => portions.nutritionPer100(100, 0));
  assert.throws(() => portions.nutritionPer100(-1, 50));
});

test('legacy favourites with pcs keep their previous per-100 piece interpretation', () => {
  const legacy = food({ defaultUnit: 'pcs' });
  assert.deepEqual(portions.foodAmountUnits(legacy), ['pcs']);
  assert.deepEqual(portions.foodAmountToBase(legacy, 2, 'pcs'), { amount: 2, unit: 'pcs' });
  assert.equal(entries.buildFoodEntry(legacy, 2, 'pcs').kcal, 8);
});
