'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
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
  logout: () => Promise<void>;
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

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
        if (data.calorie_goal) localStorage.setItem('calsync_goal', String(data.calorie_goal));
        if (data.protein_goal !== undefined && data.protein_goal !== null)
        localStorage.setItem('calsync_goal_protein', String(data.protein_goal));
        if (data.carbs_goal !== undefined && data.carbs_goal !== null)
        localStorage.setItem('calsync_goal_carbs', String(data.carbs_goal));
        if (data.fat_goal !== undefined && data.fat_goal !== null)
        localStorage.setItem('calsync_goal_fat', String(data.fat_goal));
        if (data.goal_ml !== undefined && data.goal_ml !== null) {
        localStorage.setItem('dropsync_goal', String(data.goal_ml));
        localStorage.setItem('calsync_goal_ml', String(data.goal_ml));
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
        showToast('Syncing...', 2000, null, undefined);
        if (isSyncingRef.current || lastSyncedUserIdRef.current === userId) return;
        isSyncingRef.current = true;
        lastSyncedUserIdRef.current = userId;
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
            setTimeout(() => showToast('Sync complete', 2000, null, 'toast-success'), 1000);
        } catch (err) {
            console.error('[Auth] sync error:', err);
            lastSyncedUserIdRef.current = null;
        } finally {
            isSyncingRef.current = false;
        }
    }, [fetchSettings, showToast]);

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSettings(null);
        showToast('Logged out');
        setTimeout(() => {
            window.location.href = '/login?signinginto=healthsync';
        }, 1000);
    }, [showToast]);

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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('reload') === 'true') {
                setTimeout(() => {
                window.location.replace('/');
                }, 2200);
            }
        }
    }, []);

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
