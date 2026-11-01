import { buildFoodEntry } from './foodEntry';
import { foodAmountToBase, foodBaseUnit, type FoodAmountUnit } from './foodPortions';
import { generateId } from './ids';
import type { FoodEntry, FoodSearchResult } from './types';

export type FoodSelection = { id: string; food: FoodSearchResult; amount: string; unit: FoodAmountUnit };
export const FOOD_SELECTION_KEY = 'calsync_food_selection_v1';
export type FoodSelectionCache = { version: 1; items: FoodSelection[]; ts?: number; batch?: FoodEntry[] };

export function readFoodSelection(): FoodSelectionCache {
    try {
        const value = JSON.parse(localStorage.getItem(FOOD_SELECTION_KEY) || '{"version":1,"items":[]}');
        return value.version === 1 && Array.isArray(value.items) ? value : { version: 1, items: [] };
    } catch { return { version: 1, items: [] }; }
}

export function createFoodSelection(food: FoodSearchResult): FoodSelection {
    return { id: generateId('selection'), food, amount: food.portion ? '1' : '100', unit: food.portion?.unit || foodBaseUnit(food) };
}

export function selectionEntry(item: FoodSelection, ts: number): FoodEntry {
    const base = foodAmountToBase(item.food, item.amount.trim() ? Number(item.amount) : NaN, item.unit);
    return buildFoodEntry(item.food, base.amount, base.unit, ts);
}

// Sum the rounded occurrence values, exactly as stored in the food log.
export function batchNutrition(entries: FoodEntry[]) {
    return entries.reduce((total, entry) => ({ kcal: total.kcal + entry.kcal,
        prot: Math.round((total.prot + entry.prot) * 10) / 10,
        carb: Math.round((total.carb + entry.carb) * 10) / 10,
        fat: Math.round((total.fat + entry.fat) * 10) / 10 }), { kcal: 0, prot: 0, carb: 0, fat: 0 });
}
