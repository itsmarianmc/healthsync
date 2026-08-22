'use client';

import { useCallback } from 'react';
import type { FoodSearchResult } from '../_lib/types';

const ACTIVE_DRAFT_KEY = 'calsync_active_draft';
const ACTIVE_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ActiveFoodDraft {
    id: string;
    food: FoodSearchResult;
    amount: number;
    unit: 'g' | 'ml' | 'pcs';
    ts: number;
    status: 'pending';
}

export function usePendingFoodDraft() {
    const clearActiveDraft = useCallback(() => {
        try {
            localStorage.removeItem(ACTIVE_DRAFT_KEY);
        } catch {}
    }, []);

    const saveActiveDraft = useCallback((draft: Omit<ActiveFoodDraft, 'status'>) => {
        try {
            localStorage.setItem(ACTIVE_DRAFT_KEY, JSON.stringify({ ...draft, status: 'pending' }));
        } catch {}
    }, []);

    const loadActiveDraft = useCallback((): ActiveFoodDraft | null => {
        try {
            const raw = localStorage.getItem(ACTIVE_DRAFT_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as ActiveFoodDraft;
            if (!parsed || parsed.status !== 'pending' || !parsed.food) return null;
            if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > ACTIVE_DRAFT_TTL_MS) {
                clearActiveDraft();
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }, [clearActiveDraft]);

    return { saveActiveDraft, loadActiveDraft, clearActiveDraft };
}