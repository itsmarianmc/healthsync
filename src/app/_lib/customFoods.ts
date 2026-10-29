import type { CustomFood, FoodSearchResult } from './types';
import { activeOwner, GUEST_OWNER, queueSettings } from './localData';
import { validFoodPortion } from './foodPortions';

export const CUSTOM_FOODS_KEY = 'calsync_custom_foods';
export const CUSTOM_FOODS_DIRTY_KEY = 'calsync_custom_foods_dirty';
const nutrients = ['kcalPer100', 'protPer100', 'carbPer100', 'fatPer100'] as const;

function validFood(value: unknown): value is FoodSearchResult & Record<string, unknown> {
    if (!value || typeof value !== 'object') return false;
    const food = value as FoodSearchResult;
    return typeof food.name === 'string' && !!food.name.trim() && food.name.trim().length <= 200 &&
        (food.brand === undefined || (typeof food.brand === 'string' && food.brand.trim().length <= 200)) &&
        (food.portion === undefined || validFoodPortion(food.portion)) &&
        nutrients.every(key => typeof food[key] === 'number' && Number.isFinite(food[key]) && food[key] >= 0);
}

export function parseCustomFoods(value: unknown): CustomFood[] | null {
    if (!Array.isArray(value)) return null;
    const ids = new Set<string>();
    const foods: CustomFood[] = [];
    for (const item of value) {
        if (!validFood(item) || typeof item.id !== 'string' || !item.id.trim() ||
            ids.has(item.id) || (item.defaultUnit !== 'g' && item.defaultUnit !== 'ml') ||
            (item.portion?.unit === 'oz' && item.defaultUnit !== 'g')) return null;
        ids.add(item.id);
        foods.push({
            id: item.id, name: item.name.trim(), brand: item.brand?.trim() || undefined,
            kcalPer100: item.kcalPer100, protPer100: item.protPer100,
            carbPer100: item.carbPer100, fatPer100: item.fatPer100,
            defaultUnit: item.defaultUnit, isLiquid: item.defaultUnit === 'ml',
            ...(item.portion ? { portion: { unit: item.portion.unit, amount: item.portion.amount } } : {}),
        });
    }
    return foods;
}

export function readCustomFoods(): CustomFood[] {
    try { return parseCustomFoods(JSON.parse(localStorage.getItem(CUSTOM_FOODS_KEY) || '[]')) || []; }
    catch { return []; }
}

export function saveCustomFoods(value: CustomFood[], expectedOwner: string): { queuePending: boolean } {
    if (activeOwner() !== expectedOwner) throw new Error('Food workspace changed');
    const foods = parseCustomFoods(value);
    if (!foods) throw new Error('Invalid custom foods');
    // Write the marker first: even a failed settings-queue write must be recoverable after reload.
    const wasDirty = localStorage.getItem(CUSTOM_FOODS_DIRTY_KEY) === 'true';
    localStorage.setItem(CUSTOM_FOODS_DIRTY_KEY, 'true');
    try {
        localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods));
    } catch (error) {
        if (!wasDirty) localStorage.removeItem(CUSTOM_FOODS_DIRTY_KEY);
        throw error;
    }
    let queuePending = false;
    if (expectedOwner !== GUEST_OWNER) {
        try { queueSettings({ custom_foods: foods }); }
        catch { queuePending = true; }
    }
    window.dispatchEvent(new Event('storage'));
    return { queuePending };
}

export function queueDirtyCustomFoods(): void {
    if (activeOwner() === GUEST_OWNER || localStorage.getItem(CUSTOM_FOODS_DIRTY_KEY) !== 'true') return;
    const foods = parseCustomFoods(JSON.parse(localStorage.getItem(CUSTOM_FOODS_KEY) || '[]'));
    if (!foods) throw new Error('Invalid local custom foods');
    queueSettings({ custom_foods: foods });
}

export function applyCloudCustomFoods(value: unknown): void {
    const foods = parseCustomFoods(value);
    if (!foods) return;
    const pending = JSON.parse(localStorage.getItem('healthsync_pending_settings') || '{}');
    if (Object.hasOwn(pending, 'custom_foods')) return;
    const serialized = JSON.stringify(foods);
    if (localStorage.getItem(CUSTOM_FOODS_DIRTY_KEY) === 'true') {
        // A delayed pull cannot replace a newer local save (including a deletion).
        if (serialized !== JSON.stringify(readCustomFoods())) return;
        localStorage.removeItem(CUSTOM_FOODS_DIRTY_KEY);
    }
    localStorage.setItem(CUSTOM_FOODS_KEY, serialized);
}

export interface SavedFood { key: string; food: FoodSearchResult; source: 'custom' | 'favourite' }

function foodIdentity(food: FoodSearchResult): string {
    return JSON.stringify([food.name.trim(), food.brand?.trim() || '', food.barcode || '',
        food.defaultUnit || (food.isLiquid ? 'ml' : 'g'), !!food.isLiquid,
        ...nutrients.map(nutrient => food[nutrient]), food.servingSize ?? null,
        food.satFatPer100 ?? null, food.sugarPer100 ?? null, food.saltPer100 ?? null,
        !!food.isPrepared, food.portion?.unit ?? null, food.portion?.amount ?? null]);
}

export function searchSavedFoods(custom: CustomFood[], favourites: unknown, query: string): SavedFood[] {
    const results: SavedFood[] = custom.map(food => ({ key: `custom:${food.id}`, food, source: 'custom' }));
    const seen = new Set(custom.map(foodIdentity));
    if (Array.isArray(favourites)) favourites.forEach(food => {
        if (!validFood(food)) return;
        // Name alone is never an identity. Preserve differing brands, nutrition, units and barcodes.
        const key = foodIdentity(food);
        if (seen.has(key)) return;
        seen.add(key);
        results.push({ key: `favourite:${key}`, food, source: 'favourite' });
    });
    const terms = query.trim().toLocaleLowerCase().split(/\s+/);
    return results.filter(({ food }) => terms.every(term =>
        `${food.name} ${food.brand || ''}`.toLocaleLowerCase().includes(term)));
}

export function readFavourites(): unknown {
    try { return JSON.parse(localStorage.getItem('calsync_favourites') || '[]'); }
    catch { return []; }
}
