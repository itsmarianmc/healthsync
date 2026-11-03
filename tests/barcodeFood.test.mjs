import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader, storageFixture } from './helpers/loadTs.mjs';
let map, portions, batch, library;
const nutrition = { 'energy-kcal_100g': 400, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 8 };
beforeEach(() => {
  storageFixture();
  const load = moduleLoader();
  map = load('./barcodeFood').mapBarcodeProduct;
  portions = load('./foodPortions');
  batch = load('./foodBatch');
  library = load('./foodLibrary');
});
const product = extra => ({ code: '123456', product_name: 'Source product', brands: 'Source brand', nutriments: nutrition, ...extra });
const converted = (food, amount, unit) => portions.foodAmountToBase(food, amount, unit).amount;

test('display numbers use three significant digits without padding or changing source precision', () => {
  for (const [value, expected] of [[0.25, '0.25'], [0.253, '0.253'], [0.25349, '0.253'], [14.370974, '14.4'], [1.268027, '1.27'], [0.200775, '0.201'], [0, '0']])
    assert.equal(portions.formatFoodNumber(value), expected);
  assert.equal(portions.formatFoodNumber(undefined), '—');
});

test('rescanning a barcode reuses its saved ID and remembers 500ml then 1ml without changing old logs', () => {
  const original = map(product({ quantity: '500 g' }));
  const saved = library.ensureLibraryFood(original);
  const oldLog = batch.selectionEntry({ food: saved, amount: '100', unit: 'g' }, 1);
  const before = JSON.stringify(oldLog);
  const current = map(product({ quantity: '500 ml', product_quantity: 500, product_quantity_unit: 'ml', nutriments: { ...nutrition, 'energy-kcal_100g': 2 } }));
  const updated = library.ensureLibraryFood({ ...current, selectedAmount: { amount: 500, unit: 'ml' } }, undefined, true);
  assert.equal(updated.catalogFoodId, saved.catalogFoodId);
  assert.equal(library.libraryData().foods.size, 1);
  const resolved = library.resolveFood(saved.catalogFoodId, library.libraryData().foods);
  const selection = batch.createFoodSelection(resolved);
  assert.equal(selection.amount, '500'); assert.equal(selection.unit, 'ml');
  assert.equal(batch.selectionEntry(selection, 2).kcal, 10);
  library.ensureLibraryFood({ ...resolved, selectedAmount: { amount: 1, unit: 'ml' } });
  assert.equal(batch.createFoodSelection(library.resolveFood(saved.catalogFoodId, library.libraryData().foods)).amount, '1');
  assert.equal(JSON.stringify(oldLog), before);
});

test('legacy duplicates with the same barcode display once, prefer mapped units, and can be unfavorited', () => {
  const old = map(product({ quantity: '500 g' }));
  const current = map(product({ quantity: '500 ml' }));
  const a = { ...old, id: 'old', catalogFoodId: 'old', kind: 'food', barcodeAmounts: undefined };
  const b = { ...current, id: 'current', catalogFoodId: 'current', kind: 'food', selectedAmount: { amount: 500, unit: 'ml' } };
  localStorage.setItem(library.FOOD_LIBRARY_KEY, JSON.stringify({ version: 1, pending: [], imported: [], changes: [
    { id: 'a', foodId: a.id, at: 1, kind: 'definition', food: a },
    { id: 'b', foodId: b.id, at: 2, kind: 'definition', food: b },
    { id: 'fav', foodId: a.id, at: 3, kind: 'favorite', favorite: true },
  ] }));
  const rows = library.searchLibrary([], '');
  assert.equal(rows.length, 1); assert.equal(rows[0].id, 'current'); assert.equal(rows[0].favorite, true);
  library.setFoodFavorite(rows[0].food, false);
  assert.equal(library.searchLibrary([], '', true).length, 0);
  assert.equal(library.libraryData().foods.size, 2);
  library.saveLibraryFood({ ...a, id: 'recipe', catalogFoodId: 'recipe', name: 'Recipe', barcode: undefined, isBarcode: false,
    kind: 'recipe', recipe: { ingredients: [{ foodId: 'old', amount: 10, unit: 'g' }], yield: { amount: 1, unit: 'serving' } } });
  assert.throws(() => library.deleteLibraryFood('current'), /Used by a recipe/);
  assert.equal(library.libraryData().foods.size, 3);
  library.deleteLibraryFood('recipe'); library.deleteLibraryFood('current');
  assert.equal(library.libraryData().foods.size, 0);
});

test('a manual food with an optional barcode stays separate from the scanned product', () => {
  const scanned = map(product({ quantity: '500 ml' }));
  const saved = library.ensureLibraryFood(scanned);
  const manual = library.saveLibraryFood({ ...scanned, id: 'manual', kind: 'food', catalogFoodId: undefined,
    isBarcode: false, provenance: 'manual', barcodeAmounts: undefined });
  assert.notEqual(manual.id, saved.catalogFoodId);
  assert.equal(library.searchLibrary([], '').length, 2);
  library.setFoodFavorite(saved, true);
  assert.equal(library.isFoodFavorite(manual), false);
});

test('OFF normalized kilograms are not converted twice; mass aliases deduplicate', () => {
  const food = map(product({ quantity: '2 kg (70.548 oz)', product_quantity: 2000, product_quantity_unit: 'g' }));
  assert.equal(converted(food, 1, 'kg'), 1000);
  assert.equal(converted(food, 1, 'oz'), portions.GRAMS_PER_OUNCE);
  assert.equal(food.barcodeAmounts.raw.product_quantity, 2000);
  assert.equal(portions.foodAmountUnits(food).filter(unit => unit === 'oz').length, 1);
  const one = batch.selectionEntry({ food, amount: '100', unit: 'g' }, 1);
  const equivalent = batch.selectionEntry({ food, amount: String(100 / portions.GRAMS_PER_OUNCE), unit: 'oz' }, 1);
  assert.equal(one.kcal, equivalent.kcal);
});

test('volume choices distinguish US fluid ounces, mass ounces and OFF cups', () => {
  const food = map(product({ quantity: '1 L', product_quantity: 1000, product_quantity_unit: 'ml', serving_size: '1 cup (240 ml)', serving_quantity: 240, serving_quantity_unit: 'ml' }));
  assert.equal(converted(food, 1, 'cup'), 240);
  assert.equal(converted(food, 1, 'fl_oz'), portions.ML_PER_US_FL_OUNCE);
  assert.equal(converted(food, 1, 'serving'), 240);
  assert.equal(batch.selectionEntry({ food, amount: '1', unit: 'cup' }, 1).kcal, 960);
  assert.throws(() => converted(food, 1, 'oz'));
});

test('pieces and named servings retain labels and explicit relationships', () => {
  const food = map(product({ quantity: '200 g', serving_size: '2 pieces (30 g)', serving_quantity: 30, serving_quantity_unit: 'g' }));
  assert.equal(converted(food, 1, 'pcs'), 15);
  assert.equal(converted(food, 1, 'serving'), 30);
  assert.match(portions.foodUnitLabel(food, 'serving'), /2 pieces/);
  const cookies = map(product({ serving_size: '2 cookies (30 g)' }));
  assert.equal(converted(cookies, 1, 'off:cookie'), 15);
});

test('unknown amount labels retain source metadata but are not offered without conversion', () => {
  const food = map(product({ quantity: '12 scoops', serving_size: '1 scoop' }));
  assert.equal(food.barcodeAmounts.choices.filter(choice => choice.unit === 'off:scoop').length, 1);
  assert.ok(!portions.foodAmountUnits(food).includes('off:scoop'));
  assert.throws(() => converted(food, 1, 'off:scoop'));
  assert.match(portions.foodConversionIssue(food, 'off:scoop'), /missing a usable portion/);
  assert.throws(() => batch.selectionEntry({ food, amount: '1', unit: 'off:scoop' }, 1));
});

test('product density overrides the optional ml estimate and unrelated volume units remain unavailable', () => {
  const food = map(product({ categories_tags: ['en:beverages'], quantity: '500 g', serving_size: '1 cup' }));
  assert.equal(food.isLiquid, false);
  assert.throws(() => converted(food, 1, 'cup'));
  assert.equal(converted(food, 500, 'ml'), 500);
  assert.equal(portions.foodUnitOptionLabel(food, 'ml'), 'ml (1:1 estimate)');
  const explicit = map(product({ quantity: '500 g', serving_size: '1 cup (120 g)' }));
  assert.equal(converted(explicit, 1, 'cup'), 120);
  assert.equal(converted(explicit, 240, 'ml'), 120);
  assert.equal(portions.foodUnitOptionLabel(explicit, 'ml'), 'ml');
});

test('serving-only nutrition has no invented piece weight and energy is not an amount unit', () => {
  const food = map(product({ nutrition_data_per: 'serving', serving_size: '2 pieces', nutriments: { 'energy-kcal_serving': 60, proteins_serving: 2, carbohydrates_serving: 8, fat_serving: 2 } }));
  assert.equal(food.barcodeAmounts.basis, 'serving');
  assert.equal(converted(food, 1, 'pcs'), 50);
  const entry = batch.selectionEntry({ food, amount: '2', unit: 'pcs' }, 1);
  assert.equal(entry.kcal, 60); assert.equal(entry.amount, 1); assert.equal(entry.unit, 'serving');
  assert.ok(!portions.foodAmountUnits(food).includes('g'));
  const energy = map(product({ serving_size: '200 kcal' }));
  assert.ok(!portions.foodAmountUnits(energy).some(unit => /kcal/.test(unit)));
});

test('source nutrition cannot mix prepared and as-sold fields or fill missing macros with zero', () => {
  const food = map(product({ nutriments: { ...nutrition, 'energy-kcal_prepared_100g': 30 } }));
  assert.ok(Number.isNaN(food.protPer100));
  assert.throws(() => batch.selectionEntry({ food, amount: '100', unit: 'g' }, 1));
});

test('catalog, selected snapshot, batch and JSON reload preserve amounts and provenance', () => {
  const food = map(product({ quantity: '1 L', serving_size: '1 cup (240 ml)' }));
  const saved = library.ensureLibraryFood({ ...food, selectedAmount: { amount: 2, unit: 'cup' } });
  const reloaded = library.resolveFood(saved.catalogFoodId, library.libraryData().foods);
  assert.deepEqual(reloaded.barcodeAmounts, food.barcodeAmounts);
  assert.equal(reloaded.provenance, 'barcode');
  const selection = batch.createFoodSelection(reloaded);
  assert.equal(selection.amount, '2'); assert.equal(selection.unit, 'cup');
  const entry = JSON.parse(JSON.stringify(batch.selectionEntry(selection, 1)));
  assert.equal(entry.amount, 480); assert.equal(entry.unit, 'ml'); assert.equal(entry.isDrink, true);
  assert.deepEqual(entry.foodSnapshot.selectedAmount, { amount: 2, unit: 'cup' });
  assert.equal(entry.barcode, '123456');
});

test('fractions and multipacks separate normalized totals from individual portions', () => {
  const food = map(product({ quantity: '6 bars x 90 g', product_quantity: 540, product_quantity_unit: 'g', serving_size: '1 / 2 bar (45 g)' }));
  assert.equal(converted(food, 1, 'off:package'), 540);
  assert.equal(converted(food, 1, 'off:pack-unit'), 90);
  assert.equal(converted(food, 1, 'off:bar'), 90);
  assert.equal(converted(food, 1, 'serving'), 45);
  const raw = map(product({ quantity: '6 x 90g' }));
  assert.equal(converted(raw, 1, 'off:package'), 540);
  assert.equal(converted(raw, 1, 'off:pack-unit'), 90);
});

test('explicit fluid-ounce conventions remain separate from mass and OFF default cups', () => {
  const food = map(product({ quantity: '500 ml', serving_size: '1 fl oz (UK)' }));
  assert.equal(converted(food, 1, 'imp_fl_oz'), 28.4130625);
  assert.equal(converted(food, 1, 'fl_oz'), portions.ML_PER_US_FL_OUNCE);
  assert.equal(portions.foodUnitLabel(food, 'imp_fl_oz'), 'Imperial fl oz');
});
