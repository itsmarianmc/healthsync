'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../_lib/supabase';
import {
  pullSettings, ensureSettings, mergeFoodEntries, mergeDrinkEntries,
  pullFoodFromCloud, pullDrinksFromCloud, pushFoodEntriesToCloud, syncWorkouts
} from '../_lib/sync';
import type { UserSettings } from '../_lib/types';

interface AuthContextType {
  user: User | null;
  syncEnabled: boolean;
  loading: boolean;
  settings: UserSettings | null;
  refreshSettings: () => Promise<void>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [toastQueue, setToastQueue] = useState<ToastItem[]>([]);
    const isSyncingRef = React.useRef(false);
    const lastSyncedUserIdRef = React.useRef<string | null>(null);

    const syncEnabled = user !== null;

    const showToast = useCallback((msg: string, duration = 2500, undo: (() => void) | null = null, cls = '') => {
        const item: ToastItem = { id: ++toastIdCounter, msg, duration, undo, cls };
        setToastQueue(q => [...q, item]);
    }, []);

    const consumeToast = useCallback(() => {
        setToastQueue(q => q.slice(1));
    }, []);

    const applySettingsToLocalStorage = useCallback((data: UserSettings) => {
        if (data.calorie_goal > 0)
        localStorage.setItem('calsync_goal', String(data.calorie_goal));
        if (data.protein_goal > 0)
        localStorage.setItem('calsync_goal_protein', String(data.protein_goal));
        if (data.carbs_goal > 0)
        localStorage.setItem('calsync_goal_carbs', String(data.carbs_goal));
        if (data.fat_goal > 0)
        localStorage.setItem('calsync_goal_fat', String(data.fat_goal));
        if (data.goal_ml > 0) {
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

    const checkAndNotifyMissingMacros = useCallback((data: UserSettings) => {
        const hasMacros = data.protein_goal > 0 || data.carbs_goal > 0 || data.fat_goal > 0;
        if (!hasMacros) {
            setTimeout(() => showToast('Set macro goals in Settings to track protein, carbs & fat!', 4000, null, 'toast-info'), 3000);
        }
    }, [showToast]);

    const fetchSettings = useCallback(async (userId: string) => {
        const data = await pullSettings(userId);
        if (data) {
            setSettings(data);
            applySettingsToLocalStorage(data);
            checkAndNotifyMissingMacros(data);
        }
    }, [applySettingsToLocalStorage, checkAndNotifyMissingMacros]);

    const refreshSettings = useCallback(async () => {
        if (!user) return;
        await fetchSettings(user.id);
    }, [user, fetchSettings]);

    const performCloudSync = useCallback(async (userId: string) => {
        const suppressToast = pathname === '/login' || pathname === '/onboarding';
        const { data: { session } } = await supabase.auth.getSession();
        const hasValidSession = !!session && !!session.user && !isTokenExpired(session);
        if (!suppressToast && hasValidSession) showToast('Syncing...', 2000, null, undefined);
        if (isSyncingRef.current || lastSyncedUserIdRef.current === userId) return;
        if (!hasValidSession) return;
        isSyncingRef.current = true;
        lastSyncedUserIdRef.current = userId;

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
            await fetchSettings(userId);

            const cloudFood = await pullFoodFromCloud(userId);
            if (cloudFood !== null) {
                const localFood = (() => {
                    try {
                        return JSON.parse(localStorage.getItem('calsync_v1') || '[]');
                    } catch {
                        return [];
                    }
                })();
                const merged = mergeFoodEntries(cloudFood, localFood);
                localStorage.setItem('calsync_v1', JSON.stringify(merged));
                const localOnly = localFood.filter((e: { id: string }) => !cloudFood.some(c => c.id === e.id));
                if (localOnly.length > 0) await pushFoodEntriesToCloud(localOnly, userId);
            }

            const cloudDrinks = await pullDrinksFromCloud(userId);
            if (cloudDrinks !== null) {
                const localDrinks = (() => {
                    try {
                        return JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
                    } catch {
                        return [];
                    }
                })();
                const merged = mergeDrinkEntries(cloudDrinks, localDrinks);
                localStorage.setItem('dropsync_v3', JSON.stringify(merged));
            }

            await syncWorkouts(userId);

            window.dispatchEvent(new Event('storage'));
            if (!suppressToast) setTimeout(() => showToast('Sync complete', 2000, null, 'toast-success'), 1000);
        } catch (err) {
            console.error('[Auth] sync error:', err);
            lastSyncedUserIdRef.current = null;
        } finally {
            isSyncingRef.current = false;
        }
    }, [fetchSettings, showToast, pathname]);

    const logout = useCallback(async (clearData = false) => {
        if (clearData) {
            const keys = [
                'calsync_v1', 'dropsync_v3', 'calsync_goal', 'calsync_goal_protein',
                'calsync_goal_carbs', 'calsync_goal_fat', 'dropsync_goal',
                'calsync_pending', 'calsync_user_weight_kg', 'calsync_creatine_goal',
                'calsync_magnesium_goal', 'calsync_track_supplements', 'calsync_supplements_taken',
                'healthsync_activity_status', 'healthsync_workouts',
                'calsync_ai_api_key', 'calsync_ai_enabled', 'calsync_ai_terms_accepted',
                'calsync_first_name', 'calsync_theme', 'calsync_splash_enabled',
                'healthsync_weather_enabled', 'healthsync_weather_lat',
                'healthsync_weather_lon', 'healthsync_weather_name',
                'calsync_onboarding_done', 'calsync_tour_done',
            ];
            keys.forEach(k => localStorage.removeItem(k));
            window.dispatchEvent(new Event('storage'));
        }
        await supabase.auth.signOut();
        setUser(null);
        setSettings(null);
        isSyncingRef.current = false;
        lastSyncedUserIdRef.current = null;
        showToast(clearData ? 'Logged out · local data cleared' : 'Logged out');
        setTimeout(() => router.push('/login'), 500);
    }, [showToast, router]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            const u = session?.user ?? null;
            setUser(u);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const u = session?.user ?? null;
            const prevId = lastSyncedUserIdRef.current;
            setUser(u);
            if (u && u.id !== prevId) performCloudSync(u.id);
            if (!u) lastSyncedUserIdRef.current = null;
        });

        return () => subscription.unsubscribe();
    }, [performCloudSync]);

    return (
        <AuthContext.Provider value={{
            user, syncEnabled, loading, settings,
            refreshSettings, logout, showToast, toastQueue, consumeToast
            }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
