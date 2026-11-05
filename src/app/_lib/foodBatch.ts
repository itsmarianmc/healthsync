import { buildFoodAmountEntry } from './foodEntry';
import { foodDefaultAmount, type FoodAmountUnit } from './foodPortions';
import { generateId } from './ids';
import type { FoodEntry, FoodSearchResult } from './types';

export type FoodSelection = { id: string; food: FoodSearchResult; amount: string; unit: FoodAmountUnit };
export const FOOD_SELECTION_KEY = 'calsync_food_selection_v1';
export type FoodSelectionCache = { version: 1; items: FoodSelection[]; ts?: number; batch?: FoodEntry[] };

export function readFoodSelection(strict = false): FoodSelectionCache {
    try {
        const value = JSON.parse(localStorage.getItem(FOOD_SELECTION_KEY) || '{"version":1,"items":[]}');
        if (value.version === 1 && Array.isArray(value.items)) return value;
        throw new Error('Invalid food selection');
    } catch (error) {
        if (strict) throw error;
        return { version: 1, items: [] };
    }
}

export function prependFoodSelection(item: FoodSelection): boolean {
    const cached = readFoodSelection(true);
    if (cached.batch?.length) return false;
    if (!cached.items.some(existing => existing.id === item.id)) {
        localStorage.setItem(FOOD_SELECTION_KEY, JSON.stringify({ ...cached, items: [item, ...cached.items] }));
        window.dispatchEvent(new Event('storage'));
    }
    return true;
}

export function createFoodSelection(food: FoodSearchResult): FoodSelection {
    const { amount, unit } = foodDefaultAmount(food);
    return { id: generateId('selection'), food, amount: String(amount), unit };
}

export function selectionEntry(item: FoodSelection, ts: number): FoodEntry {
    return buildFoodAmountEntry(item.food, item.amount.trim() ? Number(item.amount) : NaN, item.unit, ts);
}

// Sum the rounded occurrence values, exactly as stored in the food log.
export function batchNutrition(entries: FoodEntry[]) {
    return entries.reduce((total, entry) => ({ kcal: total.kcal + entry.kcal,
        prot: Math.round((total.prot + entry.prot) * 10) / 10,
        carb: Math.round((total.carb + entry.carb) * 10) / 10,
        fat: Math.round((total.fat + entry.fat) * 10) / 10 }), { kcal: 0, prot: 0, carb: 0, fat: 0 });
}
