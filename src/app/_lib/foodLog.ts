import type { DrinkEntry, FoodEntry } from './types';
import { activeOwner, GUEST_OWNER, workspaceGuard, markPending } from './localData';
import { pushFoodEntriesToCloud, syncDrinkToCloud } from './sync';

export const FOOD_BATCH_KEY = 'calsync_food_batch_v1';
type Batch = { owner: string; entries: FoodEntry[]; clearSelection?: boolean };
function readEntries<T>(key: string): T[] {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) throw new Error('Invalid local entries');
    return value as T[];
}

// The journal is written before any log/queue mutation. A reload or local-write
// failure can finish the same IDs without losing records or logging duplicates.
export function recoverFoodBatch(): void {
    const raw = localStorage.getItem(FOOD_BATCH_KEY);
    if (!raw) return;
    const batch = JSON.parse(raw) as Batch;
    if (batch.owner !== activeOwner() || !Array.isArray(batch.entries)) throw new Error('Invalid food batch owner');
    const foods = readEntries<FoodEntry>('calsync_v1');
    const ids = new Set(foods.map(food => food.id));
    const drinks = readEntries<DrinkEntry>('dropsync_v3');
    const drinkIds = new Set(drinks.map(drink => drink.id));
    const incoming = batch.entries.filter(entry => !ids.has(entry.id));
    const mirrored = batch.entries.filter(entry => entry.isDrink && !drinkIds.has(entry.id)).map(entry => ({
        id: entry.id, drink: entry.food, emoji: entry.emoji, color: entry.color,
        amount: Math.round(entry.amount ?? 250), ts: entry.ts, date: entry.date, source: 'calsync',
    }));
    if (batch.owner !== GUEST_OWNER) {
        for (const [kind, entries] of [['food', batch.entries], ['drinks', batch.entries.filter(entry => entry.isDrink)]] as const) {
            entries.forEach(entry => markPending(kind, entry.id));
        }
    }
    localStorage.setItem('calsync_v1', JSON.stringify([...foods, ...incoming]));
    if (mirrored.length) localStorage.setItem('dropsync_v3', JSON.stringify([...drinks, ...mirrored]));
    if (batch.clearSelection) localStorage.removeItem('calsync_food_selection_v1');
    localStorage.removeItem(FOOD_BATCH_KEY);
    window.dispatchEvent(new Event('storage'));
}

// Synchronous local boundary: callers may dismiss as soon as this returns and
// observe cloudSync separately. Only local/journal failures throw here.
export function commitFoodEntries(entries: FoodEntry[], userId?: string, clearSelection = true): { cloudSync: Promise<{ cloudPending: boolean }> } {
    const owner = userId || GUEST_OWNER;
    const isCurrent = workspaceGuard(owner);
    if (!isCurrent()) throw new Error('Food workspace changed');
    recoverFoodBatch();
    // Reusing every prepared ID also acknowledges a recovered, partially written
    // batch and clears its selection. Cloud upserts remain idempotent on retry.
    const existing = new Set(readEntries<FoodEntry>('calsync_v1').map(entry => entry.id));
    if (entries.some(entry => !existing.has(entry.id))) {
        localStorage.setItem(FOOD_BATCH_KEY, JSON.stringify({ owner, entries, clearSelection } satisfies Batch));
        recoverFoodBatch();
    } else if (clearSelection) localStorage.removeItem('calsync_food_selection_v1');
    if (!userId) return { cloudSync: Promise.resolve({ cloudPending: false }) };
    const cloudSync = Promise.allSettled([
        pushFoodEntriesToCloud(entries, userId),
        ...entries.filter(entry => entry.isDrink).map(entry => syncDrinkToCloud({ id: entry.id, drink: entry.food,
            emoji: entry.emoji, color: entry.color, amount: Math.round(entry.amount ?? 250), ts: entry.ts, date: entry.date, source: 'calsync' }, userId)),
    ]).then(results => ({ cloudPending: results.some(result => result.status === 'rejected') }));
    return { cloudSync };
}

export async function logFoodEntries(entries: FoodEntry[], userId?: string, clearSelection = true): Promise<{ cloudPending: boolean }> {
    return commitFoodEntries(entries, userId, clearSelection).cloudSync;
}

export async function logFoodEntry(entry: FoodEntry, userId?: string): Promise<{ cloudPending: boolean }> {
    return logFoodEntries([entry], userId, false);
}
