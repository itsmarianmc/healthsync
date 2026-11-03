import type { FoodSearchResult } from './types';
import { GRAMS_PER_OUNCE, ML_PER_US_FL_OUNCE } from './foodPortions';

type Unit = { id: string; label: string; dimension?: 'g' | 'ml'; factor?: number };
const definitions: [string, string, 'g' | 'ml', number, string][] = [
    ['g', 'g', 'g', 1, 'g|gr|gram|grams|gramm|gramme|grammes'],
    ['kg', 'kg', 'g', 1000, 'kg|kilogram|kilograms|kilogramm'],
    ['mg', 'mg', 'g', .001, 'mg|milligram|milligrams'],
    ['mcg', 'µg', 'g', .000001, 'µg|μg|mcg|microgram|micrograms'],
    ['oz', 'oz (weight)', 'g', GRAMS_PER_OUNCE, 'oz|ounce|ounces|onz|unze|unzen'],
    ['lb', 'lb', 'g', 453.59237, 'lb|lbs|pound|pounds'],
    ['ml', 'ml', 'ml', 1, 'ml|milliliter|milliliters|millilitre|millilitres'],
    ['cl', 'cl', 'ml', 10, 'cl|centiliter|centiliters|centilitre|centilitres'],
    ['dl', 'dl', 'ml', 100, 'dl|deciliter|decilitre'],
    ['l', 'L', 'ml', 1000, 'l|liter|liters|litre|litres'],
    ['fl_oz', 'US fl oz', 'ml', ML_PER_US_FL_OUNCE, 'fl oz|floz|fl.oz|fl. oz|fl. oz.|fluid ounce|fluid ounces|oza|us fl oz'],
    ['imp_fl_oz', 'Imperial fl oz', 'ml', 28.4130625, 'imperial fl oz|uk fl oz|imperial fluid ounce|uk fluid ounce'],
    ['cup', 'cup (OFF: 240 ml)', 'ml', 240, 'cup|cups|tasse|tasses'],
    ['metric_cup', 'metric cup (250 ml)', 'ml', 250, 'metric cup|metric cups'],
    ['us_cup', 'US customary cup', 'ml', 236.5882365, 'us customary cup|us customary cups'],
    ['tsp', 'teaspoon (5 ml)', 'ml', 5, 'tsp|teaspoon|teaspoons'],
    ['tbsp', 'tablespoon (15 ml)', 'ml', 15, 'tbsp|tablespoon|tablespoons'],
    ['pint', 'US pint', 'ml', 473.176473, 'pt|pint|pints'],
    ['quart', 'US quart', 'ml', 946.352946, 'qt|quart|quarts'],
    ['gallon', 'US gallon', 'ml', 3785.411784, 'gal|gallon|gallons'],
];
const aliases = new Map<string, Unit>();
for (const [id, label, dimension, factor, names] of definitions)
    for (const name of names.split('|')) aliases.set(name, { id, label, dimension, factor });
const nutrientUnit = /^(?:kcal|kj|cal|iu|ui|%|mmol|mol)$/i;
export function normalizeBarcodeUnit(label: string): Unit | null {
    const key = label.toLocaleLowerCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ')
        .replace(/^fl\.?\s*oz\.?\s*\((uk|imperial|us)\)$/, '$1 fl oz');
    if (!key || nutrientUnit.test(key)) return null;
    if (/^(?:pcs?|pieces?|stück|stueck|pièces?|units?)$/.test(key)) return { id: 'pcs', label: 'piece' };
    if (/^(?:servings?|portions?)$/.test(key)) return { id: 'serving', label: 'serving' };
    return aliases.get(key) || { id: `off:${key.replace(/(?<!s)s$/, '')}`, label: label.trim() };
}
const numberPattern = '(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔])';
function quantity(value: string): number {
    const fractions: Record<string, number> = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3 };
    if (fractions[value]) return fractions[value];
    const parts = value.replace(',', '.').replace(/\s*\/\s*/g, '/').trim().split(/\s+/);
    const parse = (part: string) => part.includes('/') ? Number(part.split('/')[0]) / Number(part.split('/')[1]) : Number(part);
    return parts.reduce((sum, part) => sum + parse(part), 0);
}
type Measure = { amount: number; unit: Unit };
function measures(text: string): Measure[] {
    // Match fluid ounces before mass ounces; unknown labels get no grams conversion.
    const names = [...aliases.keys()].sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${numberPattern})\\s*(${names.join('|')}|[\\p{L}][\\p{L} ._-]*?)(?=$|[\\s,;()/=]|\\d)`, 'giu');
    const result: Measure[] = [];
    const normalizedText = text.replace(/fl\.?\s*oz\.?\s*\((uk|imperial|us)\)/gi, '$1 fl oz');
    for (const match of normalizedText.matchAll(pattern)) {
        const unit = normalizeBarcodeUnit(match[2]);
        if (unit && !/^(?:x|of|de)$/i.test(unit.label) && quantity(match[1]) > 0) result.push({ amount: quantity(match[1]), unit });
    }
    return result;
}
function finite(value: unknown): number {
    if (value === null || value === undefined || value === '') return NaN;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** Expects a v0 product; nutrient basis and density require explicit product data. */
export function mapBarcodeProduct(product: Record<string, unknown>): FoodSearchResult {
    const raw: Record<string, string | number> = {};
    for (const field of ['quantity', 'product_quantity', 'product_quantity_unit', 'serving_size', 'serving_quantity', 'serving_quantity_unit', 'nutrition_data_per', 'nutrition_data_prepared_per']) {
        const value = product[field];
        if (typeof value === 'string' || typeof value === 'number') raw[field] = value;
    }
    const servingText = String(raw.serving_size || '');
    const packageText = String(raw.quantity || '');
    const serving = measures(servingText), pack = measures(packageText);
    const structuredUnit = (field: string) => normalizeBarcodeUnit(String(raw[field] || ''));
    const servingUnit = structuredUnit('serving_quantity_unit');
    const packageUnit = structuredUnit('product_quantity_unit');
    // OFF quantities are already g/ml; nonstandard units cannot establish normalized amounts.
    const normalized = (field: string, unit: Unit | null): Measure | undefined => {
        const amount = finite(raw[field]);
        return amount > 0 && (unit?.id === 'g' || unit?.id === 'ml') ? { amount, unit } : undefined;
    };
    const normalizedServing = normalized('serving_quantity', servingUnit);
    const normalizedPackage = normalized('product_quantity', packageUnit);
    const physical = normalizedPackage || pack.find(item => item.unit.dimension) || normalizedServing || serving.find(item => item.unit.dimension);
    const nutriments = (product.nutriments && typeof product.nutriments === 'object' ? product.nutriments : {}) as Record<string, unknown>;
    const prepared = ['energy-kcal', 'proteins', 'carbohydrates', 'fat'].some(key => nutriments[`${key}_prepared_100g`] !== undefined);
    const prefix = prepared ? '_prepared' : '';
    const declared = String(raw[prepared ? 'nutrition_data_prepared_per' : 'nutrition_data_per'] || '');
    const has100 = ['energy-kcal', 'energy', 'proteins', 'carbohydrates', 'fat'].some(key => nutriments[`${key}${prefix}_100g`] !== undefined);
    const directServing = !has100 && declared === 'serving';
    const basis = directServing ? 'serving' : physical?.unit.dimension || (has100 || declared === '100g' ? 'g' : 'unknown');
    const choices: NonNullable<FoodSearchResult['barcodeAmounts']>['choices'] = [];
    const issue = 'No reliable amount conversion is available. Use a unit with a known product amount, or create a manual food with an explicit mapping.';
    const add = (unit: Unit, baseAmount?: number, label = unit.label) => {
        const existing = choices.find(choice => choice.unit === unit.id);
        if (existing) {
            if (baseAmount !== undefined && existing.baseAmount === undefined) { existing.baseAmount = baseAmount; delete existing.issue; }
            if (unit.id === 'serving' && label !== unit.label) existing.label = label;
            return;
        }
        choices.push({ unit: unit.id, label, ...(baseAmount && Number.isFinite(baseAmount) ? { baseAmount } : { issue }) });
    };
    // Infer density only from paired measures in one serving label.
    let gramsPerMl: number | undefined;
    if (/[=(]/.test(servingText)) {
        const mass = serving.find(item => item.unit.dimension === 'g');
        const volume = serving.find(item => item.unit.dimension === 'ml');
        if (mass && volume) gramsPerMl = mass.amount * mass.unit.factor! / (volume.amount * volume.unit.factor!);
    }
    const factor = (unit: Unit) => unit.dimension === basis ? unit.factor : gramsPerMl && unit.dimension && (basis === 'g' || basis === 'ml') ?
        unit.factor! * (basis === 'g' ? gramsPerMl : 1 / gramsPerMl) : undefined;
    if (basis === 'g' || basis === 'ml') {
        for (const id of basis === 'g' ? ['g', 'kg', 'oz'] : ['ml', 'l', 'fl oz']) add(normalizeBarcodeUnit(id)!, factor(normalizeBarcodeUnit(id)!));
    }
    for (const item of [...pack, ...serving]) add(item.unit, factor(item.unit));
    for (const unit of [packageUnit, servingUnit]) if (unit) add(unit, factor(unit));
    const servingPhysical = normalizedServing || serving.find(item => item.unit.dimension === basis);
    const servingBase = directServing ? 100 : servingPhysical && factor(servingPhysical.unit) !== undefined ? servingPhysical.amount * factor(servingPhysical.unit)! : undefined;
    if (servingText || normalizedServing || directServing) {
        add({ id: 'serving', label: 'serving' }, servingBase, servingText ? `serving (${servingText})` : 'serving');
        const count = serving.find(item => !item.unit.dimension && item.unit.id !== 'serving');
        if (count && servingBase) add(count.unit, servingBase / count.amount);
    }
    const packagePhysical = normalizedPackage || pack.find(item => item.unit.dimension === basis);
    const multiplier = packageText.match(new RegExp(`(${numberPattern})\\s*(?:[\\p{L} ]+\\s+)?(?:x|×|\\*|of|de)\\s*${numberPattern}`, 'iu'));
    const packageBase = packagePhysical && factor(packagePhysical.unit) ? packagePhysical.amount * factor(packagePhysical.unit)! *
        (!normalizedPackage && multiplier ? quantity(multiplier[1]) : 1) : undefined;
    if (packageText || normalizedPackage) add({ id: 'off:package', label: `package (${packageText || `${raw.product_quantity} ${raw.product_quantity_unit}`})` }, packageBase);
    if (multiplier && packageBase) add({ id: 'off:pack-unit', label: `one unit from ${packageText}` }, packageBase / quantity(multiplier[1]));
    const count = pack.find(item => !item.unit.dimension);
    if (count && packageBase) add(count.unit, packageBase / count.amount);
    if (!choices.length) add({ id: 'off:unknown', label: 'amount (unit unavailable)' });
    const nutrient = (key: string): number => {
        const per100 = finite(nutriments[`${key}${prefix}_100g`]);
        if (!directServing) {
            if (Number.isFinite(per100)) return per100;
            return declared === '100g' ? finite(nutriments[`${key}${prefix}`]) : NaN;
        }
        const perServing = finite(nutriments[`${key}${prefix}_serving`] ?? nutriments[`${key}${prefix}`]);
        // Like serving-yield recipes, 100 canonical units represent one serving.
        return perServing;
    };
    const kcal = nutrient('energy-kcal');
    const energy = nutrient('energy-kj');
    const kcalPer100 = Number.isFinite(kcal) ? kcal : (Number.isFinite(energy) ? energy : nutrient('energy')) / 4.184;
    const optional = (key: string) => Number.isFinite(nutrient(key)) ? nutrient(key) : null;
    return {
        name: typeof product.product_name === 'string' && product.product_name || typeof product.product_name_en === 'string' && product.product_name_en || 'Unknown Product',
        brand: typeof product.brands === 'string' ? product.brands : '',
        kcalPer100, protPer100: nutrient('proteins'), carbPer100: nutrient('carbohydrates'), fatPer100: nutrient('fat'),
        satFatPer100: optional('saturated-fat'), sugarPer100: optional('sugars'),
        saltPer100: optional('salt') ?? (optional('sodium') !== null ? nutrient('sodium') * 2.5 : null),
        energyKj: Number.isFinite(energy) ? energy : kcalPer100 * 4.184,
        emoji: 'fa-solid fa-utensils', color: 'var(--accent)', isLiquid: basis === 'ml', defaultUnit: basis === 'ml' ? 'ml' : 'g',
        isBarcode: true, provenance: 'barcode', barcode: typeof product.code === 'string' ? product.code : undefined,
        barcodeAmounts: { basis, basisLabel: directServing ? '1 serving' : `100 ${basis === 'unknown' ? 'units (basis unavailable)' : basis}${prepared ? ' (prepared)' : ''}`, choices, raw },
    };
}
