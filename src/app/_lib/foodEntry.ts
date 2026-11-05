import { generateEntryId } from './ids';
import type { FoodEntry, FoodSearchResult } from './types';
import { foodAmountToBase, type FoodAmountUnit } from './foodPortions';

export function buildFoodAmountEntry(food: FoodSearchResult, amount: number, unit: FoodAmountUnit, ts = Date.now()): FoodEntry {
    const base = foodAmountToBase(food, amount, unit);
    return buildFoodEntry({ ...food, selectedAmount: { amount, unit } }, base.amount, base.unit, ts,
        !!food.isLiquid && base.unit === 'ml');
}

export function foodNutrition(food: FoodSearchResult, amount: number) {
    return {
        kcal: Math.round(food.kcalPer100 * amount / 100),
        prot: Math.round(food.protPer100 * amount / 100 * 10) / 10,
        carb: Math.round(food.carbPer100 * amount / 100 * 10) / 10,
        fat: Math.round(food.fatPer100 * amount / 100 * 10) / 10,
    };
}

export function buildFoodEntry(
    food: FoodSearchResult, amount: number, unit: 'g' | 'ml' | 'pcs',
    ts = Date.now(), isDrink = !!food.isLiquid,
): FoodEntry {
    const nutrition = foodNutrition(food, amount);
    if (!Number.isFinite(amount) || amount <= 0 ||
        Object.values(nutrition).some(value => !Number.isFinite(value) || value < 0)) {
        throw new Error('Invalid food amount or nutrition');
    }
    return {
        id: generateEntryId(), food: food.name, brand: food.brand || '',
        emoji: food.emoji || 'fa-solid fa-utensils', color: food.color || 'var(--accent)',
        ...nutrition,
        amount: food.recipeSnapshot?.recipe.yield.unit === 'serving' || food.barcodeAmounts?.basis === 'serving' ? amount / 100 : amount,
        unit: food.recipeSnapshot?.recipe.yield.unit === 'serving' || food.barcodeAmounts?.basis === 'serving' ? 'serving' : unit,
        ts, date: new Date(ts).toDateString(), isDrink,
        isBarcode: !!food.isBarcode, barcode: food.barcode || undefined,
        catalogFoodId: food.temporary ? undefined : food.catalogFoodId,
        foodSnapshot: JSON.parse(JSON.stringify(food.temporary ? { ...food, catalogFoodId: undefined } : food)),
    };
}
