'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../_lib/supabase';
import {
  pullSettings, ensureSettings, pullFoodFromCloud, pullDrinksFromCloud,
  pushFoodEntriesToCloud, syncDrinkToCloud, pushSettings, syncWorkouts,
  syncWorkoutHistory, flushDeletedEntries, flushRestoredFood,
} from '../_lib/sync';
import type { UserSettings, FoodEntry, DrinkEntry } from '../_lib/types';
import { switchWorkspace, activeOwner, GUEST_OWNER, pendingIds, clearActiveHealthData, clearPending, acknowledgeSettings } from '../_lib/localData';
import { entriesToUpload, mustDiscardAfterReset } from '../_lib/syncPolicy';
import { hasVerifiedMfaFactor, needsMfaVerification } from '../_lib/mfaPolicy';

interface AuthContextType {
  user: User | null;
  syncEnabled: boolean;
  loading: boolean;
  mfaRequired: boolean;
  mfaUser: User | null;
  settings: UserSettings | null;
  refreshSettings: () => Promise<void>;
  retrySync: () => Promise<void>;
  logout: (clearData?: boolean) => Promise<void>;
  showToast: (msg: string, duration?: number, undo?: (() => void) | null, cls?: string) => void;
  toastQueue: ToastItem[];
  consumeToast: () => void;
}

interface ToastItem {
  id: number;
  msg: string;
  duration: number;
  undo?: (() => void) | null;
  cls?: string;
}

let toastIdCounter = 0;

function isTokenExpired(session: { expires_at?: number } | null): boolean {
    if (!session || !session.expires_at) return true;
    return session.expires_at * 1000 <= Date.now();
}

const AuthContext = createContext<AuthContextType | null>(null);
const SYNC_TOAST_ROUTES = new Set(['/dash', '/food', '/drinks']);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const pathnameRef = React.useRef(pathname);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaUser, setMfaUser] = useState<User | null>(null);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [toastQueue, setToastQueue] = useState<ToastItem[]>([]);
    const isSyncingRef = React.useRef(false);
    const queuedSyncUserRef = React.useRef<string | null>(null);
    const lastSyncedUserIdRef = React.useRef<string | null>(null);
    const displayedUserIdRef = React.useRef<string | null>(null);
    const syncToastEpochRef = React.useRef(0);
    const syncToastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousPathnameRef = React.useRef(pathname);

    const syncEnabled = user !== null;

    const invalidateSyncToast = useCallback(() => {
        syncToastEpochRef.current += 1;
        if (syncToastTimerRef.current !== null) {
            clearTimeout(syncToastTimerRef.current);
            syncToastTimerRef.current = null;
        }
        setToastQueue(queue => queue.filter(toast =>
            toast.msg !== 'Syncing...' && toast.msg !== 'Sync complete' &&
            toast.msg !== 'Cloud sync failed. Your changes remain saved on this device and will retry.'
        ));
    }, []);

    useEffect(() => {
        pathnameRef.current = pathname;
        if (previousPathnameRef.current !== pathname) invalidateSyncToast();
        previousPathnameRef.current = pathname;
    }, [pathname, invalidateSyncToast]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') invalidateSyncToast();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            syncToastEpochRef.current += 1;
            if (syncToastTimerRef.current !== null) clearTimeout(syncToastTimerRef.current);
            syncToastTimerRef.current = null;
        };
    }, [invalidateSyncToast]);

    const showToast = useCallback((msg: string, duration = 2500, undo: (() => void) | null = null, cls = '') => {
        setToastQueue(q => {
            const next = { id: ++toastIdCounter, msg, duration, undo, cls };
            if (q.length === 0) {
                return [next];
            }

            const first = q[0];
            if (first.undo) {
                if (undo || q[q.length - 1].undo) return [...q, next];
                return [...q.slice(0, -1), next];
            }
            if (undo || first.cls !== cls) return [next];
            return [{
                ...first,
                msg,
                duration: Math.max(first.duration, duration),
            }];
        });
    }, []);

    const consumeToast = useCallback(() => {
        setToastQueue(q => q.slice(1));
    }, []);

    const applySettingsToLocalStorage = useCallback((data: UserSettings) => {
        if (data.calorie_goal > 0)
        localStorage.setItem('calsync_goal', String(data.calorie_goal));
        if (data.protein_goal >= 0)
        localStorage.setItem('calsync_goal_protein', String(data.protein_goal));
        if (data.carbs_goal >= 0)
        localStorage.setItem('calsync_goal_carbs', String(data.carbs_goal));
        if (data.fat_goal >= 0)
        localStorage.setItem('calsync_goal_fat', String(data.fat_goal));
        if (data.goal_ml >= 0) {
            localStorage.setItem('dropsync_goal', String(data.goal_ml));
        }
        if (data.weight_kg !== undefined && data.weight_kg !== null)
        localStorage.setItem('calsync_user_weight_kg', String(data.weight_kg));
        if (data.creatine_goal !== undefined && data.creatine_goal !== null)
        localStorage.setItem('calsync_creatine_goal', String(data.creatine_goal));
        if (data.magnesium_goal !== undefined && data.magnesium_goal !== null)
        localStorage.setItem('calsync_magnesium_goal', String(data.magnesium_goal));
        if (data.track_supplements !== undefined && data.track_supplements !== null)
        localStorage.setItem('calsync_track_supplements', String(data.track_supplements));
        if (data.supplements_taken)
        localStorage.setItem('calsync_supplements_taken', JSON.stringify(data.supplements_taken));
        if (data.status) {
            localStorage.setItem('healthsync_activity_status', JSON.stringify(data.status));
        }
        window.dispatchEvent(new Event('storage'));
    }, []);

    const checkAndNotifyMissingMacros = useCallback((data: UserSettings, userId: string) => {
        const hasMacros = data.protein_goal > 0 || data.carbs_goal > 0 || data.fat_goal > 0;
        if (!hasMacros) {
            setTimeout(() => {
                if (activeOwner() === userId) showToast('Set macro goals in Settings to track protein, carbs & fat!', 4000, null, 'toast-info');
            }, 3000);
        }
    }, [showToast]);

    const fetchSettings = useCallback(async (userId: string) => {
        const data = await pullSettings(userId);
        if (data && activeOwner() === userId) {
            setSettings(data);
            applySettingsToLocalStorage(data);
            checkAndNotifyMissingMacros(data, userId);
        }
    }, [applySettingsToLocalStorage, checkAndNotifyMissingMacros]);

    const refreshSettings = useCallback(async () => {
        if (!user) return;
        await fetchSettings(user.id);
    }, [user, fetchSettings]);

    const performCloudSync = useCallback(async (userId: string) => {
        const startedPathname = pathnameRef.current;
        const { data: { session } } = await supabase.auth.getSession();
        const hasValidSession = !!session && session.user?.id === userId && !isTokenExpired(session);
        if (isSyncingRef.current) {
            if (lastSyncedUserIdRef.current !== userId) queuedSyncUserRef.current = userId;
            return;
        }
        if (lastSyncedUserIdRef.current === userId) return;
        if (!hasValidSession) return;
        if (activeOwner() !== userId) return;
        invalidateSyncToast();
        isSyncingRef.current = true;
        lastSyncedUserIdRef.current = userId;
        const toastEpoch = syncToastEpochRef.current;
        const toastContextIsCurrent = () => syncToastEpochRef.current === toastEpoch &&
            pathnameRef.current === startedPathname && window.location.pathname === startedPathname &&
            SYNC_TOAST_ROUTES.has(startedPathname ?? '') &&
            document.visibilityState === 'visible' && activeOwner() === userId;
        const canShowCompletionToast = async () => {
            if (!toastContextIsCurrent()) return false;
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                return toastContextIsCurrent() && currentSession?.user?.id === userId && !isTokenExpired(currentSession);
            } catch {
                return false;
            }
        };
        if (toastContextIsCurrent()) showToast('Syncing...', 2000);

        try {
            const hasDropsyncGoal = localStorage.getItem('dropsync_goal');
            const legacyWater = localStorage.getItem('calsync_goal_ml') ?? '';
            if (!hasDropsyncGoal && legacyWater !== '' && parseInt(legacyWater, 10) > 0) {
                localStorage.setItem('dropsync_goal', legacyWater);
                localStorage.removeItem('calsync_goal_ml');
            }
        } catch {}
        try {
            await ensureSettings(userId);
            if (activeOwner() !== userId) return;
            let cloudSettings = await pullSettings(userId);
            if (activeOwner() !== userId) return;
            if (!cloudSettings) throw new Error('Unable to read cloud settings');
            const lastSync = localStorage.getItem('healthsync_last_cloud_sync');
            if (mustDiscardAfterReset(lastSync, cloudSettings.data_reset_at)) {
                clearActiveHealthData();
                // Record the reset marker immediately so a later retry does not
                // discard new entries created after this reset was processed.
                localStorage.setItem('healthsync_last_cloud_sync', cloudSettings.data_reset_at!);
            }
            let pendingSettings = JSON.parse(localStorage.getItem('healthsync_pending_settings') || '{}');
            const hadPendingSettings = Object.keys(pendingSettings).length > 0;
            while (Object.keys(pendingSettings).length) {
                if (activeOwner() !== userId) return;
                await pushSettings(userId, pendingSettings);
                if (activeOwner() !== userId) return;
                acknowledgeSettings(pendingSettings);
                pendingSettings = JSON.parse(localStorage.getItem('healthsync_pending_settings') || '{}');
            }
            if (hadPendingSettings) {
                cloudSettings = await pullSettings(userId);
                if (!cloudSettings) throw new Error('Unable to confirm cloud settings');
            }
            if (activeOwner() !== userId) return;
            setSettings(cloudSettings);
            applySettingsToLocalStorage(cloudSettings);
            await flushDeletedEntries(userId);
            await flushRestoredFood(userId);

            const cloudFood = await pullFoodFromCloud(userId);
            if (activeOwner() !== userId) return;
            if (!cloudFood) throw new Error('Unable to read food entries');
            const localFood = JSON.parse(localStorage.getItem('calsync_v1') || '[]') as FoodEntry[];
            const foodPending = pendingIds('food');
            const foodUpload = entriesToUpload(localFood, foodPending, cloudFood.deletedIds, cloudFood.entries.map(entry => entry.id));
            if (foodUpload.length) await pushFoodEntriesToCloud(foodUpload, userId);
            const finalFood = foodUpload.length ? await pullFoodFromCloud(userId) : cloudFood;
            if (activeOwner() !== userId) return;
            if (!finalFood) throw new Error('Unable to confirm food upload');
            clearPending('food', finalFood.deletedIds);
            localStorage.setItem('calsync_v1', JSON.stringify(finalFood.entries));

            const cloudDrinks = await pullDrinksFromCloud(userId);
            if (activeOwner() !== userId) return;
            if (!cloudDrinks) throw new Error('Unable to read drink entries');
            const localDrinks = JSON.parse(localStorage.getItem('dropsync_v3') || '[]') as DrinkEntry[];
            const drinkPending = pendingIds('drinks');
            const drinkUpload = entriesToUpload(localDrinks, drinkPending, cloudDrinks.deletedIds, cloudDrinks.entries.map(entry => entry.id));
            for (const entry of drinkUpload) await syncDrinkToCloud(entry, userId);
            const finalDrinks = drinkUpload.length ? await pullDrinksFromCloud(userId) : cloudDrinks;
            if (activeOwner() !== userId) return;
            if (!finalDrinks) throw new Error('Unable to confirm drink upload');
            clearPending('drinks', finalDrinks.deletedIds);
            localStorage.setItem('dropsync_v3', JSON.stringify(finalDrinks.entries));

            await syncWorkouts(userId);
            await syncWorkoutHistory(userId);
            if (activeOwner() !== userId) return;
            localStorage.setItem('healthsync_last_cloud_sync', new Date().toISOString());

            window.dispatchEvent(new Event('storage'));
            if (await canShowCompletionToast()) {
                syncToastTimerRef.current = setTimeout(() => {
                    syncToastTimerRef.current = null;
                    void canShowCompletionToast().then(allowed => {
                        if (allowed) showToast('Sync complete', 2000, null, 'toast-success');
                    });
                }, 1000);
            }
        } catch {
            console.error('[Auth] cloud sync failed. Local changes are retained for retry.');
            lastSyncedUserIdRef.current = null;
            if (await canShowCompletionToast()) {
                showToast('Cloud sync failed. Your changes remain saved on this device and will retry.', 4500, null, 'toast-error');
            }
        } finally {
            isSyncingRef.current = false;
            const queued = queuedSyncUserRef.current;
            queuedSyncUserRef.current = null;
            if (queued && activeOwner() === queued) setTimeout(() => window.dispatchEvent(new Event('online')), 0);
        }
    }, [applySettingsToLocalStorage, showToast, invalidateSyncToast]);

    const logout = useCallback(async (clearData = false) => {
        invalidateSyncToast();
        setToastQueue([]);
        if (clearData) {
            clearActiveHealthData();
        }
        await supabase.auth.signOut();
        switchWorkspace(GUEST_OWNER);
        setUser(null);
        setMfaUser(null);
        setSettings(null);
        lastSyncedUserIdRef.current = null;
        showToast(clearData ? 'Logged out · local data cleared' : 'Logged out');
        setTimeout(() => router.push('/login'), 500);
    }, [showToast, router, invalidateSyncToast]);

    const retrySync = useCallback(async () => {
        if (!user) return;
        lastSyncedUserIdRef.current = null;
        await performCloudSync(user.id);
    }, [user, performCloudSync]);

    useEffect(() => {
        let mounted = true;
        let revision = 0;
        const resolveSession = async (session: { user: User; expires_at?: number } | null) => {
            const current = ++revision;
            let authorized: User | null = null;
            let needsMfa = false;
            if (session?.user && !isTokenExpired(session)) {
                const { data: level, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
                if (!error && !factorsError && level && factors) {
                    needsMfa = needsMfaVerification(level.currentLevel, hasVerifiedMfaFactor(factors.all));
                    if (!needsMfa) authorized = session.user;
                }
            }
            if (!mounted || current !== revision) return;
            if (displayedUserIdRef.current !== (authorized?.id || null)) {
                invalidateSyncToast();
                setToastQueue([]);
            }
            switchWorkspace(authorized?.id || GUEST_OWNER);
            if (displayedUserIdRef.current !== (authorized?.id || null)) {
                setSettings(null);
                displayedUserIdRef.current = authorized?.id || null;
            }
            setUser(authorized);
            setMfaRequired(needsMfa);
            setMfaUser(needsMfa ? session?.user ?? null : null);
            setLoading(false);
            if (authorized) void performCloudSync(authorized.id);
            else lastSyncedUserIdRef.current = null;
        };
        void supabase.auth.getSession().then(({ data: { session } }) => resolveSession(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            // Supabase auth calls must run after the auth callback returns.
            setTimeout(() => { void resolveSession(session); }, 0);
        });
        return () => { mounted = false; subscription.unsubscribe(); };
    }, [performCloudSync, invalidateSyncToast]);

    useEffect(() => {
        const retry = () => {
            if (user) {
                lastSyncedUserIdRef.current = null;
                void performCloudSync(user.id);
            }
        };
        window.addEventListener('online', retry);
        return () => window.removeEventListener('online', retry);
    }, [user, performCloudSync]);

    return (
        <AuthContext.Provider value={{
            user, syncEnabled, loading, mfaRequired, mfaUser, settings,
            refreshSettings, retrySync, logout, showToast, toastQueue, consumeToast
            }}>
            {loading ? null : children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
