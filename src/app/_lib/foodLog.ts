import type { DrinkEntry, FoodEntry } from './types';
import { activeOwner, GUEST_OWNER, markPending } from './localData';
import { pushFoodEntriesToCloud, syncDrinkToCloud } from './sync';

function readEntries<T>(key: string): T[] {
    const value = JSON.parse(localStorage.getItem(key) || '[]') as unknown;
    if (!Array.isArray(value)) throw new Error(`Invalid local data in ${key}`);
    return value as T[];
}

export async function logFoodEntry(entry: FoodEntry, userId?: string): Promise<{ cloudPending: boolean }> {
    if (activeOwner() !== (userId || GUEST_OWNER)) {
        throw new Error('Food workspace changed while entry was open');
    }
    const foods = readEntries<FoodEntry>('calsync_v1');
    if (foods.some(food => food.id === entry.id)) return { cloudPending: false };

    const drink: DrinkEntry | null = entry.isDrink ? {
        id: entry.id,
        drink: entry.food,
        emoji: entry.emoji,
        color: entry.color,
        amount: entry.amount || 250,
        ts: entry.ts,
        date: entry.date,
        source: 'calsync',
    } : null;
    const drinks = drink ? readEntries<DrinkEntry>('dropsync_v3') : null;

    localStorage.setItem('calsync_v1', JSON.stringify([...foods, entry]));
    if (drink && drinks && !drinks.some(saved => saved.id === drink.id)) {
        localStorage.setItem('dropsync_v3', JSON.stringify([...drinks, drink]));
    }
    if (userId) {
        markPending('food', entry.id);
        if (drink) markPending('drinks', drink.id);
    }
    window.dispatchEvent(new Event('storage'));

    if (!userId) return { cloudPending: false };
    const results = await Promise.allSettled([
        pushFoodEntriesToCloud([entry], userId),
        ...(drink ? [syncDrinkToCloud(drink, userId)] : []),
    ]);
    return { cloudPending: results.some(result => result.status === 'rejected') };
}
