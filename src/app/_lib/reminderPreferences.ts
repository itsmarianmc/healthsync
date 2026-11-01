export const REMINDER_CATEGORIES = ['breakfast', 'lunch', 'supplements', 'snack', 'dinner'] as const;
export type ReminderCategory = typeof REMINDER_CATEGORIES[number];
export type ReminderPreferences = { enabled: boolean; categories: Record<ReminderCategory, boolean> };

export function defaultReminderPreferences(): ReminderPreferences {
    return { enabled: false, categories: { breakfast: false, lunch: false, supplements: false, snack: false, dinner: false } };
}

export function parseReminderPreferences(value: unknown): ReminderPreferences | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const object = value as Record<string, unknown>;
    if (Object.keys(object).sort().join(',') !== 'categories,enabled' || typeof object.enabled !== 'boolean' || !object.categories || typeof object.categories !== 'object' || Array.isArray(object.categories)) return null;
    const categories = object.categories as Record<string, unknown>;
    if (Object.keys(categories).sort().join(',') !== [...REMINDER_CATEGORIES].sort().join(',') || REMINDER_CATEGORIES.some(key => typeof categories[key] !== 'boolean')) return null;
    if (object.enabled && !REMINDER_CATEGORIES.some(key => categories[key] === true)) return null;
    return { enabled: object.enabled, categories: Object.fromEntries(REMINDER_CATEGORIES.map(key => [key, categories[key]])) as Record<ReminderCategory, boolean> };
}
