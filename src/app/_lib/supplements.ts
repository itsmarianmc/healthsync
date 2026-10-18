import type { CustomSupplement, SupplementSchedule } from './types';

export interface SupplementGoals {
    creatine_g: number;
    magnesium_mg: number;
}

const CREATINE_G_PER_KG = 0.1;
const MAGNESIUM_MG_PER_KG = 5;

export const SUPPLEMENT_KEYS = {
    track: 'calsync_track_supplements',
    weightKg: 'calsync_user_weight_kg',
    creatineGoal: 'calsync_creatine_goal',
    magnesiumGoal: 'calsync_magnesium_goal',
    taken: 'calsync_supplements_taken',
    custom: 'calsync_custom_supplements',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function utcDayNumber(value: unknown): number | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return Math.floor(date.getTime() / DAY_MS);
}

function validateSchedule(value: unknown): SupplementSchedule | null {
    if (!isRecord(value)) return null;
    if (value.mode === 'weekdays') {
        if (!Array.isArray(value.weekdays) || value.weekdays.length < 1 || value.weekdays.length > 7) return null;
        const weekdays = value.weekdays;
        if (!weekdays.every(day => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 7)) return null;
        if (new Set(weekdays).size !== weekdays.length) return null;
        return { mode: 'weekdays', weekdays: [...weekdays as number[]].sort((a, b) => a - b) };
    }
    if (value.mode === 'interval') {
        if (typeof value.everyDays !== 'number' || !Number.isSafeInteger(value.everyDays) || value.everyDays < 2 || utcDayNumber(value.startDate) === null) return null;
        return { mode: 'interval', everyDays: Number(value.everyDays), startDate: String(value.startDate) };
    }
    return null;
}

/** Returns normalized definitions, or null when the stored payload is malformed. */
export function parseCustomSupplements(value: unknown): CustomSupplement[] | null {
    let parsed = value;
    if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { return null; }
    }
    if (!Array.isArray(parsed)) return null;

    const result: CustomSupplement[] = [];
    const ids = new Set<string>();
    for (const item of parsed) {
        if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id.trim())) return null;
        if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 80) return null;
        if (item.dose !== undefined && (typeof item.dose !== 'string' || item.dose.length > 80)) return null;
        const schedule = validateSchedule(item.schedule);
        if (!schedule) return null;
        const dose = typeof item.dose === 'string' ? item.dose.trim() : '';
        result.push({
            id: item.id.trim(),
            name: item.name.trim(),
            ...(dose ? { dose } : {}),
            schedule,
        });
        ids.add(item.id.trim());
    }
    return result;
}

/** Weekdays use Monday=1 through Sunday=7; interval math uses UTC calendar days. */
export function isSupplementDue(schedule: unknown, dateISO: string): boolean {
    const dateDay = utcDayNumber(dateISO);
    const validSchedule = validateSchedule(schedule);
    if (dateDay === null || !validSchedule) return false;

    if (validSchedule.mode === 'weekdays') {
        const utcWeekday = new Date(dateDay * DAY_MS).getUTCDay();
        const weekday = utcWeekday === 0 ? 7 : utcWeekday;
        return validSchedule.weekdays.includes(weekday);
    }

    const startDay = utcDayNumber(validSchedule.startDate);
    if (startDay === null || dateDay < startDay) return false;
    return (dateDay - startDay) % validSchedule.everyDays === 0;
}

export function readCustomSupplements(): CustomSupplement[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(SUPPLEMENT_KEYS.custom);
        if (raw === null) return [];
        return parseCustomSupplements(raw) ?? [];
    } catch {
        return [];
    }
}

export function calcSupplements(weightKg: number): SupplementGoals | null {
    if (!weightKg || weightKg <= 0 || !Number.isFinite(weightKg)) return null;
    return {
        creatine_g: Math.max(3, Math.round(weightKg * CREATINE_G_PER_KG * 10) / 10),
        magnesium_mg: Math.round(weightKg * MAGNESIUM_MG_PER_KG),
    };
}

export function persistSupplementGoals(weightKg: number): SupplementGoals | null {
    const goals = calcSupplements(weightKg);
    if (!goals) return null;
    if (typeof window === 'undefined') return goals;
    localStorage.setItem(SUPPLEMENT_KEYS.weightKg, String(weightKg));
    localStorage.setItem(SUPPLEMENT_KEYS.creatineGoal, String(goals.creatine_g));
    localStorage.setItem(SUPPLEMENT_KEYS.magnesiumGoal, String(goals.magnesium_mg));
    window.dispatchEvent(new Event('storage'));
    return goals;
}

export function readPersistedSupplements(): { weightKg: number; goals: SupplementGoals | null; tracking: boolean } {
    if (typeof window === 'undefined') return { weightKg: 0, goals: null, tracking: false };
    const weightKg = parseFloat(localStorage.getItem(SUPPLEMENT_KEYS.weightKg) || '0') || 0;
    const tracking = localStorage.getItem(SUPPLEMENT_KEYS.track) === 'true';
    const goals = calcSupplements(weightKg);
    return { weightKg, goals, tracking };
}
