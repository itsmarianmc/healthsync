import type { LibraryItem } from '../../_lib/foodLibrary';
import type { FoodSearchResult } from '../../_lib/types';
import { foodAmountLabel, foodAmountToBase, foodDefaultAmount, formatFoodNumber } from '../../_lib/foodPortions';
import { foodNutrition } from '../../_lib/foodEntry';

export function libraryPortionLabel(food: FoodSearchResult): string {
    const selected = foodDefaultAmount(food);
    try {
        const base = foodAmountToBase(food, selected.amount, selected.unit);
        return `${foodAmountLabel(food, selected.amount, selected.unit)} • ${formatFoodNumber(foodNutrition(food, base.amount).kcal)}kcal`;
    } catch { return 'Portion unavailable'; }
}

export function isBarcodeFood(food: FoodSearchResult): boolean {
    return food.isBarcode === true || food.provenance === 'barcode';
}

export function libraryBrand(brand?: string): string | undefined {
    return brand?.trim().toLowerCase() === 'ai detection' ? undefined : brand;
}

export function usageDayGroups(items: LibraryItem[], now = new Date()) {
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const groups = new Map<string, { key: string; label: string; day: number; items: LibraryItem[] }>();
    for (const item of items) {
        // Inclusion uses elapsed time; headings use the stored local calendar date.
        const date = item.latest && item.latest.ts >= now.getTime() - 14 * 86400000
            ? new Date(item.latest.date) : null;
        const day = date && Number.isFinite(date.getTime()) ? date : null;
        const key = day?.toDateString() || 'saved';
        if (!groups.has(key)) groups.set(key, {
            key,
            label: key === today ? 'Today' : key === yesterday.toDateString() ? 'Yesterday'
                : day ? day.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Saved',
            day: day?.getTime() ?? -Infinity,
            items: [],
        });
        groups.get(key)!.items.push(item);
    }
    return [...groups.values()].sort((a, b) => b.day - a.day);
}
