// Unprefixed keys hold the active workspace; snapshots remain tied to their owner across restarts.
export const HEALTH_DATA_KEYS = [
  'calsync_v1', 'dropsync_v3', 'healthsync_workout_logs', 'healthsync_workouts',
  'calsync_pending', 'calsync_goal', 'calsync_goal_protein',
  'calsync_goal_carbs', 'calsync_goal_fat', 'calsync_favourites',
  'calsync_active_draft', 'dropsync_goal',
  'calsync_goal_ml',
  'calsync_user_weight_kg', 'calsync_creatine_goal', 'calsync_magnesium_goal',
  'calsync_track_supplements', 'calsync_supplements_taken', 'calsync_custom_supplements',
  'healthsync_activity_status', 'healthsync_rest_seconds', 'healthsync_pending_food',
  'healthsync_pending_drinks', 'healthsync_pending_workouts',
  'healthsync_deleted_food', 'healthsync_deleted_drinks',
  'healthsync_restored_food',
  'healthsync_last_cloud_sync',
  'healthsync_pending_settings',
  'calsync_ai_api_key', 'calsync_ai_enabled', 'calsync_ai_terms_accepted',
  'calsync_first_name', 'calsync_theme', 'dropsync_theme',
  'calsync_splash_enabled', 'healthsync_weather_enabled',
  'healthsync_weather_lat', 'healthsync_weather_lon', 'healthsync_weather_name',
  'dropsync_delete_warning', 'calsync_display_name', 'healthsync_modals_expanded',
] as const;

const OWNER_KEY = 'healthsync_active_owner';
const workspaceKey = (owner: string) => `healthsync_workspace_${owner}`;
export const GUEST_OWNER = 'guest';

export function activeOwner(): string {
  // Existing unscoped data belongs to the guest until the user explicitly imports it.
  return localStorage.getItem(OWNER_KEY) || GUEST_OWNER;
}

export function switchWorkspace(owner: string): void {
  const previous = activeOwner();
  if (previous === owner) {
    localStorage.setItem(OWNER_KEY, owner);
    return;
  }
  const saved = localStorage.getItem(workspaceKey(owner));
  const values: Record<string, unknown> = saved ? JSON.parse(saved) : {};
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('Invalid workspace snapshot');
  }
  const snapshot: Record<string, string> = {};
  for (const key of HEALTH_DATA_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) snapshot[key] = value;
  }
  localStorage.setItem(workspaceKey(previous), JSON.stringify(snapshot));
  try {
    for (const key of HEALTH_DATA_KEYS) localStorage.removeItem(key);
    for (const key of HEALTH_DATA_KEYS) {
      if (typeof values[key] === 'string') localStorage.setItem(key, values[key]);
    }
    localStorage.setItem(OWNER_KEY, owner);
  } catch (error) {
    for (const key of HEALTH_DATA_KEYS) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(snapshot)) localStorage.setItem(key, value);
    throw error;
  }
  window.dispatchEvent(new Event('storage'));
}

export function importGuestData(owner: string): void {
  if (activeOwner() !== owner || owner === GUEST_OWNER) throw new Error('Open the account first');
  const guest = JSON.parse(localStorage.getItem(workspaceKey(GUEST_OWNER)) || '{}') as Record<string, string>;
  const importedKeys = ['calsync_v1', 'dropsync_v3', 'healthsync_workout_logs'] as const;
  for (const key of importedKeys) {
    const existing = JSON.parse(localStorage.getItem(key) || '[]') as Array<{ id: string }>;
    const incoming = JSON.parse(guest[key] || '[]') as Array<{ id: string }>;
    const ids = new Set(existing.map(item => item.id));
    const added = incoming.filter(item => {
      if (ids.has(item.id)) return false;
      ids.add(item.id);
      return true;
    });
    localStorage.setItem(key, JSON.stringify([...existing, ...added]));
    const pendingKey = key === 'calsync_v1' ? 'healthsync_pending_food' : key === 'dropsync_v3' ? 'healthsync_pending_drinks' : 'healthsync_pending_workouts';
    const pending = new Set(JSON.parse(localStorage.getItem(pendingKey) || '[]') as string[]);
    added.forEach(item => pending.add(item.id));
    localStorage.setItem(pendingKey, JSON.stringify([...pending]));
  }
  // Import consumes tracked entries while preserving guest settings, routines and preferences.
  importedKeys.forEach(key => { guest[key] = '[]'; });
  for (const key of [
    'healthsync_pending_food', 'healthsync_pending_drinks', 'healthsync_pending_workouts',
    'healthsync_deleted_food', 'healthsync_deleted_drinks', 'healthsync_restored_food',
  ]) delete guest[key];
  localStorage.setItem(workspaceKey(GUEST_OWNER), JSON.stringify(guest));
  window.dispatchEvent(new Event('storage'));
}

export function hasGuestData(): boolean {
  const guest = JSON.parse(localStorage.getItem(workspaceKey(GUEST_OWNER)) || '{}') as Record<string, string>;
  return ['calsync_v1', 'dropsync_v3', 'healthsync_workout_logs'].some(key => {
    try { return JSON.parse(guest[key] || '[]').length > 0; } catch { return false; }
  });
}

export function markPending(kind: 'food' | 'drinks' | 'workouts', id: string): void {
  const key = `healthsync_pending_${kind}`;
  const ids = new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
  ids.add(id);
  localStorage.setItem(key, JSON.stringify([...ids]));
}

export function clearPending(kind: 'food' | 'drinks' | 'workouts', ids: string[]): void {
  const key = `healthsync_pending_${kind}`;
  const pending = new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
  ids.forEach(id => pending.delete(id));
  localStorage.setItem(key, JSON.stringify([...pending]));
}

export function pendingIds(kind: 'food' | 'drinks' | 'workouts'): Set<string> {
  return new Set(JSON.parse(localStorage.getItem(`healthsync_pending_${kind}`) || '[]') as string[]);
}

export function clearActiveHealthData(): void {
  HEALTH_DATA_KEYS.forEach(key => localStorage.removeItem(key));
  window.dispatchEvent(new Event('storage'));
}

export function queueSettings(settings: Record<string, unknown>): void {
  const previous = JSON.parse(localStorage.getItem('healthsync_pending_settings') || '{}') as Record<string, unknown>;
  localStorage.setItem('healthsync_pending_settings', JSON.stringify({ ...previous, ...settings }));
}

export function acknowledgeSettings(saved: Record<string, unknown>): void {
  const raw = localStorage.getItem('healthsync_pending_settings');
  if (!raw) return;
  const pending = JSON.parse(raw) as Record<string, unknown>;
  for (const [key, value] of Object.entries(saved)) {
    if (JSON.stringify(pending[key]) === JSON.stringify(value)) delete pending[key];
  }
  if (Object.keys(pending).length) localStorage.setItem('healthsync_pending_settings', JSON.stringify(pending));
  else localStorage.removeItem('healthsync_pending_settings');
}

export function markDeleted<T extends { id: string }>(kind: 'food' | 'drinks', entry: T): void {
  const key = `healthsync_deleted_${kind}`;
  const deleted = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, T>;
  deleted[entry.id] = entry;
  localStorage.setItem(key, JSON.stringify(deleted));
  clearPending(kind, [entry.id]);
}

export function pendingDeleted<T>(kind: 'food' | 'drinks'): T[] {
  return Object.values(JSON.parse(localStorage.getItem(`healthsync_deleted_${kind}`) || '{}') as Record<string, T>);
}

export function clearDeleted(kind: 'food' | 'drinks', ids: string[]): void {
  const key = `healthsync_deleted_${kind}`;
  const deleted = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, unknown>;
  ids.forEach(id => delete deleted[id]);
  localStorage.setItem(key, JSON.stringify(deleted));
}

export function markRestoredFood(id: string): void {
  clearDeleted('food', [id]);
  const ids = new Set(JSON.parse(localStorage.getItem('healthsync_restored_food') || '[]') as string[]);
  ids.add(id);
  localStorage.setItem('healthsync_restored_food', JSON.stringify([...ids]));
}

export function restoredFoodIds(): Set<string> {
  return new Set(JSON.parse(localStorage.getItem('healthsync_restored_food') || '[]') as string[]);
}

export function clearRestoredFood(id: string): void {
  const ids = restoredFoodIds();
  ids.delete(id);
  localStorage.setItem('healthsync_restored_food', JSON.stringify([...ids]));
}
