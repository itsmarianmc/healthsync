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
} as const;

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
