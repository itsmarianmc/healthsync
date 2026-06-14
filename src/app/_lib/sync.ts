import { supabase } from './supabase';
import type { FoodEntry, DrinkEntry, UserSettings, WorkoutSession, WorkoutRoutines } from './types';

export async function pushFoodEntriesToCloud(entries: FoodEntry[], userId: string): Promise<void> {
    if (!entries.length) return;
    const payload = entries.map(e => ({
        user_id: userId,
        entry_id: e.id,
        food: e.food,
        brand: e.brand || null,
        kcal: e.kcal,
        amount: e.amount || null,
        unit: e.unit || 'g',
        prot: e.prot || null,
        carb: e.carb || null,
        fat: e.fat || null,
        barcode: e.isBarcode ? '' : null,
        ts: e.ts,
        date: e.date,
        is_drink: e.isDrink === true,
    }));
    const { error } = await supabase.from('calsync_entries').upsert(payload, { onConflict: 'user_id,entry_id' });
    if (error) console.error('[sync] pushFood error:', error.message);
}

export async function deleteFoodFromCloud(entryId: string, userId: string): Promise<void> {
    const { error } = await supabase
        .from('calsync_entries')
        .delete()
        .eq('user_id', userId)
        .eq('entry_id', entryId);
    if (error) console.error('[sync] deleteFood error:', error.message);
}

export async function pullFoodFromCloud(userId: string): Promise<FoodEntry[] | null> {
    const { data, error } = await supabase
        .from('calsync_entries')
        .select('*')
        .eq('user_id', userId)
        .order('ts', { ascending: true });
    if (error) { console.error('[sync] pullFood error:', error.message); return null; }
    return (data || []).map(r => ({
        id: r.entry_id,
        food: r.food,
        brand: r.brand || '',
        kcal: r.kcal,
        amount: r.amount || 0,
        unit: r.unit || 'g',
        prot: r.prot || 0,
        carb: r.carb || 0,
        fat: r.fat || 0,
        ts: r.ts,
        date: r.date,
        emoji: 'fa-solid fa-utensils',
        color: 'var(--accent)',
        isDrink: r.is_drink === true,
    }));
}

export async function syncDrinkToCloud(entry: DrinkEntry, userId: string): Promise<void> {
    const { error } = await supabase
        .from('dropsync_entries')
        .insert({
        user_id: userId,
        entry_id: entry.id,
        drink: entry.drink,
        emoji: entry.emoji,
        color: entry.color,
        amount: entry.amount,
        ts: entry.ts,
        date: entry.date,
        source: 'dropsync',
    });
    if (error) console.error('[sync] syncDrink error:', error.message);
}

export async function deleteDrinkFromCloud(entryId: string, userId: string): Promise<void> {
    const { error } = await supabase
        .from('dropsync_entries')
        .delete()
        .eq('user_id', userId)
        .eq('entry_id', entryId);
    if (error) console.error('[sync] deleteDrink error:', error.message);
}

export async function pullDrinksFromCloud(userId: string): Promise<DrinkEntry[] | null> {
    const { data, error } = await supabase
        .from('dropsync_entries')
        .select('*')
        .eq('user_id', userId)
        .order('ts', { ascending: true });
    if (error) { console.error('[sync] pullDrinks error:', error.message); return null; }
    return (data || []).map(r => ({
        id: r.entry_id,
        drink: r.drink,
        emoji: r.emoji,
        color: r.color,
        amount: r.amount,
        ts: r.ts,
        date: r.date,
        source: r.source,
    }));
}

export async function pushSettings(
        userId: string,
        settings: Partial<Omit<UserSettings, 'user_id'>>
    ): Promise<void> {
    const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' });
    if (error) console.error('[sync] pushSettings error:', error.message);
}

export async function pullSettings(userId: string): Promise<UserSettings | null> {
    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) { console.error('[sync] pullSettings error:', error.message); return null; }
    return data;
}

export async function ensureSettings(userId: string): Promise<void> {
    const currentGoal = parseInt(localStorage.getItem('calsync_goal') || '2000');
    const currentProtein = parseInt(localStorage.getItem('calsync_goal_protein') || '0');
    const currentCarbs = parseInt(localStorage.getItem('calsync_goal_carbs') || '0');
    const currentFat = parseInt(localStorage.getItem('calsync_goal_fat') || '0');
    const currentWater = parseInt(localStorage.getItem('calsync_goal_ml') || '2000');
    const { error } = await supabase
        .from('user_settings')
        .upsert({
        user_id: userId,
        calorie_goal: currentGoal,
        protein_goal: currentProtein,
        carbs_goal: currentCarbs,
        fat_goal: currentFat,
        goal_ml: currentWater,
        }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (error) console.error('[sync] ensureSettings error:', error.message);
}

export async function pushWorkoutSessionToCloud(session: WorkoutSession, userId: string): Promise<void> {
    const { error } = await supabase
        .from('workout_sessions')
        .insert({
        user_id: userId,
        session_id: session.id,
        routine_id: session.routineId,
        routine_name: session.routineName,
        start_time: new Date(session.startTime).toISOString(),
        end_time: session.endTime ? new Date(session.endTime).toISOString() : null,
        duration_seconds: session.duration || 0,
        exercises: session.exercises,
    });
    if (error) console.error('[sync] pushWorkoutSession error:', error.message);
}

export async function syncWorkouts(userId: string): Promise<WorkoutRoutines | null> {
    const { data: meta, error } = await supabase
        .from('user_settings')
        .select('workout_routines, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) { console.error('[sync] syncWorkouts error:', error.message); return null; }

    const cloudData = meta?.workout_routines as WorkoutRoutines | null ?? null;
    const cloudUpdated = meta?.updated_at ? new Date(meta.updated_at).getTime() : 0;

    const localRaw = localStorage.getItem('healthsync_workouts');
    const localData: WorkoutRoutines | null = localRaw ? JSON.parse(localRaw) : null;
    const localUpdated = localData?._updated_at ? new Date(localData._updated_at).getTime() : 0;

    if (!cloudData && !localData) return null;
    if (!cloudData && localData) {
        await supabase.from('user_settings').upsert({
        user_id: userId, workout_routines: localData, updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        return localData;
    }
    if (cloudData && !localData) {
        localStorage.setItem('healthsync_workouts', JSON.stringify(cloudData));
        return cloudData;
    }
    if (localUpdated > cloudUpdated) {
        await supabase.from('user_settings').upsert({
        user_id: userId, workout_routines: localData, updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        return localData;
    } else {
        localStorage.setItem('healthsync_workouts', JSON.stringify(cloudData));
        return cloudData;
    }
}

export function mergeFoodEntries(cloud: FoodEntry[], local: FoodEntry[]): FoodEntry[] {
    const cloudIds = new Set(cloud.map(e => e.id));
    const localOnly = local.filter(e => !cloudIds.has(e.id));
    return [...cloud, ...localOnly].sort((a, b) => a.ts - b.ts);
}

export function mergeDrinkEntries(cloud: DrinkEntry[], local: DrinkEntry[]): DrinkEntry[] {
    const cloudIds = new Set(cloud.map(e => e.id));
    const localOnly = local.filter(e => !cloudIds.has(e.id));
    return [...cloud, ...localOnly].sort((a, b) => a.ts - b.ts);
}
