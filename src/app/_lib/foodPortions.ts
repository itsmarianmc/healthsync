import type { FoodPortion, FoodPortionUnit, FoodSearchResult } from './types';

// NIST Handbook 44, Appendix C: avoirdupois ounce and US fluid ounce.
export const GRAMS_PER_OUNCE = 28.349523125;
export const ML_PER_US_FL_OUNCE = 29.5735295625;
export type FoodAmountUnit = string;
export type NutritionBasis = 'g' | 'ml' | FoodPortionUnit;
export const FOOD_UNIT_LABELS: Record<FoodAmountUnit, string> = {
    g: 'g', ml: 'ml', kg: 'kg', l: 'L', pcs: 'piece', serving: 'serving', oz: 'oz', fl_oz: 'US fl oz',
};

export function validFoodPortion(value: unknown): value is FoodPortion {
    if (!value || typeof value !== 'object') return false;
    const portion = value as FoodPortion;
    return ['pcs', 'serving', 'oz', 'fl_oz'].includes(portion.unit) &&
        typeof portion.amount === 'number' && Number.isFinite(portion.amount) && portion.amount > 0;
}

export function foodBaseUnit(food: FoodSearchResult): 'g' | 'ml' {
    if (food.barcodeAmounts) return food.barcodeAmounts.basis === 'ml' ? 'ml' : 'g';
    return food.defaultUnit === 'ml' || food.isLiquid ? 'ml' : 'g';
}

export function foodAmountUnits(food: FoodSearchResult): FoodAmountUnit[] {
    const withMl = (units: string[]) => {
        const mass = units.findIndex(unit => unit === 'g' || unit === 'kg');
        if (foodBaseUnit(food) === 'g' && mass >= 0 && !units.includes('ml')) units.splice(mass + 1, 0, 'ml');
        return units;
    };
    if (food.barcodeAmounts) return withMl(food.barcodeAmounts.choices.filter(choice => Number.isFinite(choice.baseAmount) && choice.baseAmount! > 0 && !choice.issue).map(choice => choice.unit));
    if (food.recipeSnapshot?.recipe.yield.unit === 'serving') return ['serving'];
    if (food.defaultUnit === 'pcs' && !food.portion) return ['pcs'];
    const units: FoodAmountUnit[] = foodBaseUnit(food) === 'g' ? ['g', 'kg', 'oz'] : ['ml', 'l', 'fl_oz'];
    if (food.portion && !units.includes(food.portion.unit)) units.push(food.portion.unit);
    return withMl(units);
}

const volumeUnits: Record<string, number> = {
    ml: 1, cl: 10, dl: 100, l: 1000, fl_oz: ML_PER_US_FL_OUNCE, imp_fl_oz: 28.4130625,
    cup: 240, metric_cup: 250, us_cup: 236.5882365, tsp: 5, tbsp: 15,
    pint: 473.176473, quart: 946.352946, gallon: 3785.411784,
};

function knownGramsPerMl(food: FoodSearchResult): number | undefined {
    if (food.barcodeAmounts?.basis === 'g') {
        const choice = food.barcodeAmounts.choices.find(item => volumeUnits[item.unit] &&
            Number.isFinite(item.baseAmount) && item.baseAmount! > 0 && !item.issue);
        if (choice) return choice.baseAmount! / volumeUnits[choice.unit];
    }
    if (!food.barcodeAmounts && food.portion?.unit === 'fl_oz') return food.portion.amount / ML_PER_US_FL_OUNCE;
    return undefined;
}

export function foodUnitOptionLabel(food: FoodSearchResult, unit: FoodAmountUnit): string {
    return unit === 'ml' && foodBaseUnit(food) === 'g' && knownGramsPerMl(food) === undefined
        ? 'ml (1:1 estimate)' : foodUnitLabel(food, unit);
}

export function foodAmountToBase(food: FoodSearchResult, amount: number, unit: FoodAmountUnit): { amount: number; unit: 'g' | 'ml' | 'pcs' } {
    if (!Number.isFinite(amount) || amount <= 0 || !foodAmountUnits(food).includes(unit)) throw new Error('Invalid food amount or unit');
    if (unit === 'ml' && foodBaseUnit(food) === 'g') {
        const converted = amount * (knownGramsPerMl(food) ?? 1);
        if (!Number.isFinite(converted) || converted <= 0) throw new Error('Invalid converted amount');
        return { amount: converted, unit: 'g' };
    }
    if (food.barcodeAmounts) {
        const choice = food.barcodeAmounts.choices.find(choice => choice.unit === unit);
        const converted = amount * (choice?.baseAmount ?? NaN);
        if (!Number.isFinite(converted) || converted <= 0) throw new Error(choice?.issue || 'The product has no conversion for this unit.');
        return { amount: converted, unit: food.barcodeAmounts.basis === 'serving' ? 'pcs' : foodBaseUnit(food) };
    }
    if (food.defaultUnit === 'pcs' && !food.portion) return { amount, unit: 'pcs' };
    const factor = food.portion?.unit === unit ? food.portion.amount :
        unit === 'kg' || unit === 'l' ? 1000 : unit === 'oz' ? GRAMS_PER_OUNCE :
        unit === 'fl_oz' ? ML_PER_US_FL_OUNCE : 1;
    const converted = amount * factor;
    if (!Number.isFinite(converted) || converted <= 0) throw new Error('Invalid converted amount');
    return { amount: converted, unit: foodBaseUnit(food) };
}

export function formatFoodAmount(value: number, decimals = 3): string {
    const rounded = Number(value.toFixed(decimals));
    return rounded === 0 && value !== 0 ? Number(value.toPrecision(4)).toString() : rounded.toString();
}

const foodNumberFormat = new Intl.NumberFormat('en', { maximumSignificantDigits: 3, useGrouping: false });
export function formatFoodNumber(value: number | null | undefined): string {
    return typeof value === 'number' && Number.isFinite(value) ? foodNumberFormat.format(value) : '—';
}

export function foodDefaultAmount(food: FoodSearchResult): { amount: number; unit: FoodAmountUnit } {
    const units = foodAmountUnits(food);
    const selected = food.selectedAmount;
    if (selected && Number.isFinite(selected.amount) && selected.amount > 0 && units.includes(selected.unit)) return selected;
    const unit = food.recipeSnapshot?.recipe.yield.unit === 'serving' || food.barcodeAmounts?.basis === 'serving' ? 'serving'
        : food.portion && units.includes(food.portion.unit) ? food.portion.unit : units[0] || '';
    return { amount: unit === 'serving' || unit === food.portion?.unit ? 1 :
        unit === 'g' || unit === 'ml' ? food.nutritionBasisAmount ?? 100 : 100, unit };
}

export function foodAmountLabel(food: FoodSearchResult, amount: number, unit: FoodAmountUnit): string {
    return `${formatFoodNumber(amount)}${['g', 'kg', 'ml', 'l', 'mg', 'mcg', 'oz'].includes(unit) ? '' : ' '}${foodUnitLabel(food, unit)}`;
}

export function foodBasisLabel(food: FoodSearchResult): string {
    if (food.barcodeAmounts) return food.barcodeAmounts.basisLabel;
    if (food.recipeSnapshot?.recipe.yield.unit === 'serving') return '1 serving';
    return food.portion ? `1 ${FOOD_UNIT_LABELS[food.portion.unit]} (${formatFoodAmount(food.portion.amount)} ${foodBaseUnit(food)})` :
        `${food.nutritionBasisAmount ?? 100} ${food.defaultUnit || (food.isLiquid ? 'ml' : 'g')}`;
}

export function foodUnitLabel(food: FoodSearchResult, unit: FoodAmountUnit): string {
    return food.barcodeAmounts?.choices.find(choice => choice.unit === unit)?.label || FOOD_UNIT_LABELS[unit] || unit;
}

export function foodConversionIssue(food: FoodSearchResult, unit: FoodAmountUnit): string | undefined {
    if (food.barcodeAmounts && !foodAmountUnits(food).includes(unit)) return 'This product is missing a usable portion size. Choose another product or create a food with the details on its label.';
    return undefined;
}

export function validBarcodeAmounts(value: FoodSearchResult['barcodeAmounts']): boolean {
    if (!value) return true;
    return ['g', 'ml', 'serving', 'unknown'].includes(value.basis) && typeof value.basisLabel === 'string' &&
        Array.isArray(value.choices) && value.choices.length > 0 && value.choices.length <= 100 &&
        new Set(value.choices.map(choice => choice.unit)).size === value.choices.length &&
        value.choices.every(choice => typeof choice.unit === 'string' && !!choice.unit && typeof choice.label === 'string' &&
            (choice.baseAmount === undefined || (Number.isFinite(choice.baseAmount) && choice.baseAmount > 0)) &&
            (choice.issue === undefined || typeof choice.issue === 'string')) &&
        !!value.raw && typeof value.raw === 'object';
}

export function nutritionPer100(value: number, basisAmount: number): number {
    const normalized = value * (100 / basisAmount);
    if (!Number.isFinite(value) || value < 0 || !Number.isFinite(basisAmount) || basisAmount <= 0 ||
        !Number.isFinite(normalized) || normalized < 0) throw new Error('Invalid food nutrition');
    return normalized;
}
