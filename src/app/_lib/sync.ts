import { supabase } from './supabase';
import type {
  FoodEntry,
  DrinkEntry,
  UserSettings,
  ActivityStatusRecord,
  WorkoutSession,
  WorkoutRoutines,
} from './types';
import { activeOwner, clearDeleted, clearPending, markDeleted, markRestoredFood, clearRestoredFood, restoredFoodIds, pendingDeleted, pendingIds } from './localData';

function assertActiveWorkspace(userId: string): void {
  if (activeOwner() !== userId) throw new Error('Workspace changed during sync');
}

async function assertUserAuthorized(userId: string): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) return false;
    const res = await fetch('/api/sync/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, userId }),
    });
    if (!res.ok) {
      console.error('[sync] server rejected user authorization.');
      return false;
    }
    return true;
  } catch {
    console.error('[sync] could not verify user authorization.');
    return false;
  }
}

function foodRow(e: FoodEntry, userId: string) {
  return {
    user_id: userId, entry_id: e.id, food: e.food, brand: e.brand || null,
    kcal: e.kcal, amount: e.amount ?? null, unit: e.unit || 'g',
    prot: e.prot ?? 0, carb: e.carb ?? 0, fat: e.fat ?? 0,
    barcode: e.barcode || null, ts: e.ts, date: e.date,
    is_drink: e.isDrink === true,
  };
}

function drinkRow(e: DrinkEntry, userId: string) {
  return {
    user_id: userId, entry_id: e.id, drink: e.drink, emoji: e.emoji,
    color: e.color, amount: e.amount, ts: e.ts, date: e.date,
    source: e.source || 'dropsync',
  };
}

export async function pushFoodEntriesToCloud(
  entries: FoodEntry[],
  userId: string,
): Promise<void> {
  if (!entries.length) return;
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  assertActiveWorkspace(userId);
  const payload = entries.map((e) => foodRow(e, userId));
  const { error } = await supabase
    .from('calsync_entries')
    .upsert(payload, { onConflict: 'user_id,entry_id' });
  if (error) throw error;
  assertActiveWorkspace(userId);
  clearPending('food', entries.map(e => e.id));
}

export async function deleteFoodFromCloud(
  entry: FoodEntry,
  userId: string,
): Promise<void> {
  assertActiveWorkspace(userId);
  markDeleted('food', entry);
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  assertActiveWorkspace(userId);
  const { error } = await supabase
    .from('calsync_entries')
    .upsert({ ...foodRow(entry, userId), deleted_at: new Date().toISOString() }, { onConflict: 'user_id,entry_id' });
  if (error) throw error;
  assertActiveWorkspace(userId);
  clearDeleted('food', [entry.id]);
}

export async function restoreFoodInCloud(entry: FoodEntry, userId: string): Promise<void> {
  assertActiveWorkspace(userId);
  markRestoredFood(entry.id);
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  assertActiveWorkspace(userId);
  const { error } = await supabase.from('calsync_entries')
    .upsert({ ...foodRow(entry, userId), deleted_at: null }, { onConflict: 'user_id,entry_id' });
  if (error) throw error;
  assertActiveWorkspace(userId);
  clearDeleted('food', [entry.id]);
  clearPending('food', [entry.id]);
  clearRestoredFood(entry.id);
}

export async function pullFoodFromCloud(
  userId: string,
): Promise<{ entries: FoodEntry[]; deletedIds: string[] } | null> {
  if (!(await assertUserAuthorized(userId))) return null;
  const { data, error } = await supabase
    .from('calsync_entries')
    .select('*')
    .eq('user_id', userId)
    .order('ts', { ascending: true });
  if (error) {
    console.error('[sync] could not load food entries.');
    return null;
  }
  const deletedIds = (data || []).filter(r => r.deleted_at).map(r => r.entry_id as string);
  return { deletedIds, entries: (data || []).filter(r => !r.deleted_at).map((r) => ({
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
    isBarcode: !!r.barcode,
    barcode: r.barcode || undefined,
  })) };
}

export async function syncDrinkToCloud(
  entry: DrinkEntry,
  userId: string,
): Promise<void> {
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  assertActiveWorkspace(userId);
  const { error } = await supabase.from('dropsync_entries')
    .upsert(drinkRow(entry, userId), { onConflict: 'user_id,entry_id' });
  if (error) throw error;
  assertActiveWorkspace(userId);
  clearPending('drinks', [entry.id]);
}

export async function deleteDrinkFromCloud(
  entry: DrinkEntry,
  userId: string,
): Promise<void> {
  assertActiveWorkspace(userId);
  markDeleted('drinks', entry);
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  assertActiveWorkspace(userId);
  const { error } = await supabase
    .from('dropsync_entries')
    .upsert({ ...drinkRow(entry, userId), deleted_at: new Date().toISOString() }, { onConflict: 'user_id,entry_id' });
  if (error) throw error;
  assertActiveWorkspace(userId);
  clearDeleted('drinks', [entry.id]);
}

export async function pullDrinksFromCloud(
  userId: string,
): Promise<{ entries: DrinkEntry[]; deletedIds: string[] } | null> {
  if (!(await assertUserAuthorized(userId))) return null;
  const { data, error } = await supabase
    .from('dropsync_entries')
    .select('*')
    .eq('user_id', userId)
    .order('ts', { ascending: true });
  if (error) {
    console.error('[sync] could not load drink entries.');
    return null;
  }
  const deletedIds = (data || []).filter(r => r.deleted_at).map(r => r.entry_id as string);
  return { deletedIds, entries: (data || []).filter(r => !r.deleted_at).map((r) => ({
    id: r.entry_id,
    drink: r.drink,
    emoji: r.emoji,
    color: r.color,
    amount: r.amount,
    ts: r.ts,
    date: r.date,
    source: r.source,
  })) };
}

export async function pushSettings(
  userId: string,
  settings: Partial<Omit<UserSettings, 'user_id'>>,
): Promise<void> {
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  assertActiveWorkspace(userId);
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function pullSettings(
  userId: string,
): Promise<UserSettings | null> {
  if (!(await assertUserAuthorized(userId))) return null;
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[sync] could not load account settings.');
    return null;
  }
  return data;
}

export function serializeActivityStatus(
  status: { status: ActivityStatusRecord['status']; duration: ActivityStatusRecord['duration']; customStartDate?: Date; customEndDate?: Date },
): ActivityStatusRecord {
  return {
    status: status.status,
    duration: status.duration,
    customStartDate: status.customStartDate ? status.customStartDate.toISOString() : null,
    customEndDate: status.customEndDate ? status.customEndDate.toISOString() : null,
  };
}

export async function ensureSettings(userId: string): Promise<void> {
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  assertActiveWorkspace(userId);
  const { data: existing, error: readError } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return;
  assertActiveWorkspace(userId);
  const currentGoal = parseInt(localStorage.getItem('calsync_goal') || '2000');
  const currentProtein = parseInt(
    localStorage.getItem('calsync_goal_protein') || '0',
  );
  const currentCarbs = parseInt(
    localStorage.getItem('calsync_goal_carbs') || '0',
  );
  const currentFat = parseInt(localStorage.getItem('calsync_goal_fat') || '0');
  const currentWater = parseInt(
    localStorage.getItem('dropsync_goal') || '2500',
  );
  const { error } = await supabase.from('user_settings').insert({
      user_id: userId,
      calorie_goal: currentGoal,
      protein_goal: currentProtein,
      carbs_goal: currentCarbs,
      fat_goal: currentFat,
      goal_ml: currentWater,
      status: { status: 'active', duration: 'until_changed', customStartDate: null, customEndDate: null },
      supplements_taken: {},
    });
  if (error) throw error;
}

export async function pushWorkoutSessionToCloud(
  session: WorkoutSession,
  userId: string,
): Promise<void> {
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  assertActiveWorkspace(userId);
  const { error } = await supabase.from('workout_sessions').upsert({
    user_id: userId,
    session_id: session.id,
    routine_id: session.routineId,
    routine_name: session.routineName,
    start_time: new Date(session.startTime).toISOString(),
    end_time: session.endTime ? new Date(session.endTime).toISOString() : null,
    duration_seconds: session.duration || 0,
    intensity: session.intensity || null,
    exercises: session.exercises,
  }, { onConflict: 'user_id,session_id' });
  if (error) throw error;
  assertActiveWorkspace(userId);
  clearPending('workouts', [session.id]);
}

export async function flushDeletedEntries(userId: string): Promise<void> {
  for (const entry of pendingDeleted<FoodEntry>('food')) await deleteFoodFromCloud(entry, userId);
  for (const entry of pendingDeleted<DrinkEntry>('drinks')) await deleteDrinkFromCloud(entry, userId);
}

export async function flushRestoredFood(userId: string): Promise<void> {
  const restored = restoredFoodIds();
  const local = JSON.parse(localStorage.getItem('calsync_v1') || '[]') as FoodEntry[];
  for (const entry of local.filter(item => restored.has(item.id))) await restoreFoodInCloud(entry, userId);
}

export async function syncWorkoutHistory(userId: string): Promise<void> {
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  if (activeOwner() !== userId) return;
  type Log = WorkoutSession & { intensity?: string };
  const local = JSON.parse(localStorage.getItem('healthsync_workout_logs') || '[]') as Log[];
  const pending = pendingIds('workouts');
  const { data: existing, error: readError } = await supabase.from('workout_sessions').select('session_id')
    .eq('user_id', userId);
  if (readError) throw readError;
  if (activeOwner() !== userId) return;
  const existingIds = new Set((existing || []).map(row => row.session_id));
  for (const log of local.filter(item => pending.has(item.id) || !existingIds.has(item.id))) {
    if (activeOwner() !== userId) return;
    await pushWorkoutSessionToCloud(log, userId);
  }
  const { data, error } = await supabase.from('workout_sessions').select('*')
    .eq('user_id', userId).order('start_time', { ascending: false });
  if (error) throw error;
  if (activeOwner() !== userId) return;
  const cloud = (data || []).map(row => ({
    id: row.session_id, routineId: row.routine_id || '',
    routineName: row.routine_name || '',
    startTime: new Date(row.start_time).getTime(),
    endTime: row.end_time ? new Date(row.end_time).getTime() : undefined,
    duration: row.duration_seconds, intensity: row.intensity || undefined,
    exercises: (row.exercises || []).map((ex: Record<string, unknown>) => ({
      ...ex,
      name: ex.name || ex.exerciseName || '',
      sets: (Array.isArray(ex.sets) ? ex.sets : []).map((set: Record<string, unknown>) => ({
        ...set, completed: set.completed ?? set.done ?? false,
      })),
    })),
  }));
  const current = JSON.parse(localStorage.getItem('healthsync_workout_logs') || '[]') as Log[];
  const stillPending = pendingIds('workouts');
  const cloudIds = new Set(cloud.map(log => log.id));
  const preserved = current.filter(log => stillPending.has(log.id) || !cloudIds.has(log.id));
  const preservedIds = new Set(preserved.map(log => log.id));
  localStorage.setItem('healthsync_workout_logs', JSON.stringify([
    ...preserved, ...cloud.filter(log => !preservedIds.has(log.id)),
  ].sort((a, b) => b.startTime - a.startTime)));
}

export async function syncWorkouts(
  userId: string,
): Promise<WorkoutRoutines | null> {
  if (!(await assertUserAuthorized(userId))) throw new Error('Cloud authorization failed');
  const { data: meta, error } = await supabase
    .from('user_settings')
    .select('workout_routines, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[sync] could not synchronize workout routines.');
    throw new Error('Could not read workout routines.');
  }
  if (activeOwner() !== userId) return null;

  const cloudData = (meta?.workout_routines as WorkoutRoutines | null) ?? null;
  const cloudUpdated = cloudData?._updated_at
    ? new Date(cloudData._updated_at).getTime()
    : 0;

  const localRaw = localStorage.getItem('healthsync_workouts');
  let localData: WorkoutRoutines | null = null;
  try { localData = localRaw ? JSON.parse(localRaw) : null; } catch { localData = null; }
  const localUpdated = localData?._updated_at
    ? new Date(localData._updated_at).getTime()
    : 0;

  if (!cloudData && !localData) return null;
  if (!cloudData && localData) {
    const { error: writeError } = await supabase.from('user_settings').upsert(
      {
        user_id: userId,
        workout_routines: localData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (writeError) throw writeError;
    return localData;
  }
  if (cloudData && !localData) {
    localStorage.setItem('healthsync_workouts', JSON.stringify(cloudData));
    return cloudData;
  }
  if (localUpdated > cloudUpdated) {
    const { error: writeError } = await supabase.from('user_settings').upsert(
      {
        user_id: userId,
        workout_routines: localData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (writeError) throw writeError;
    return localData;
  } else {
    localStorage.setItem('healthsync_workouts', JSON.stringify(cloudData));
    return cloudData;
  }
}

export function mergeFoodEntries(
  cloud: FoodEntry[],
  local: FoodEntry[],
): FoodEntry[] {
  const cloudIds = new Set(cloud.map((e) => e.id));
  const localOnly = local.filter((e) => !cloudIds.has(e.id));
  return [...cloud, ...localOnly].sort((a, b) => a.ts - b.ts);
}

export function mergeDrinkEntries(
  cloud: DrinkEntry[],
  local: DrinkEntry[],
): DrinkEntry[] {
  const cloudIds = new Set(cloud.map((e) => e.id));
  const localOnly = local.filter((e) => !cloudIds.has(e.id));
  return [...cloud, ...localOnly].sort((a, b) => a.ts - b.ts);
}
