import type { FoodPortion, FoodPortionUnit, FoodSearchResult } from './types';

// NIST Handbook 44, Appendix C: avoirdupois ounce and US fluid ounce.
export const GRAMS_PER_OUNCE = 28.349523125;
export const ML_PER_US_FL_OUNCE = 29.5735295625;
export type FoodAmountUnit = 'g' | 'ml' | 'kg' | 'l' | FoodPortionUnit;
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
    return food.defaultUnit === 'ml' || food.isLiquid ? 'ml' : 'g';
}

export function foodAmountUnits(food: FoodSearchResult): FoodAmountUnit[] {
    if (food.defaultUnit === 'pcs' && !food.portion) return ['pcs'];
    const units: FoodAmountUnit[] = foodBaseUnit(food) === 'g' ? ['g', 'kg', 'oz'] : ['ml', 'l', 'fl_oz'];
    if (food.portion && !units.includes(food.portion.unit)) units.push(food.portion.unit);
    return units;
}

export function foodAmountToBase(food: FoodSearchResult, amount: number, unit: FoodAmountUnit): { amount: number; unit: 'g' | 'ml' | 'pcs' } {
    if (!Number.isFinite(amount) || amount <= 0 || !foodAmountUnits(food).includes(unit)) throw new Error('Invalid food amount or unit');
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

export function foodBasisLabel(food: FoodSearchResult): string {
    return food.portion ? `1 ${FOOD_UNIT_LABELS[food.portion.unit]} (${formatFoodAmount(food.portion.amount)} ${foodBaseUnit(food)})` :
        `100 ${food.defaultUnit || (food.isLiquid ? 'ml' : 'g')}`;
}

export function nutritionPer100(value: number, basisAmount: number): number {
    const normalized = value * (100 / basisAmount);
    if (!Number.isFinite(value) || value < 0 || !Number.isFinite(basisAmount) || basisAmount <= 0 ||
        !Number.isFinite(normalized) || normalized < 0) throw new Error('Invalid food nutrition');
    return normalized;
}
