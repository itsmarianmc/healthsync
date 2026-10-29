'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../_context/AuthContext';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import { pushSettings } from '../../_lib/sync';
import { activeOwner, acknowledgeSettings, clearActiveHealthData, GUEST_OWNER, hasGuestData, importGuestData, queueSettings, workspaceGuard } from '../../_lib/localData';
import { csvEscape } from '../../_lib/csv';
import { supabase } from '../../_lib/supabase';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { calcSupplements, persistSupplementGoals } from '../../_lib/supplements';
import { reverseGeocodeLocation } from '../../_lib/location';
import { readAiConfig, saveValidatedAiKey, writeAiConfig } from '../../_lib/aiConfig';
import { validateApiKey } from '../../_lib/gemini';
import { APP_VERSION } from '../../_lib/release';
import { writeLocalLastSeen, writePendingReloadAfterUpdate } from '../../_lib/changelog';
import { runCalc, type CalcFields } from '../../_lib/goalCalculator';
import GoalCalculator from './GoalCalculator';
import Notifications from '../notifications/Notifications';
import { Serwist } from '@serwist/window';
import ReportBugModal from './ReportBugModal';

type SerwistWindow = Window & {
    serwist?: Serwist;
};

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenNotes: () => void;
    onOpenCustomSupplements: () => void;
}

function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function applyTheme(theme: string, canUsePreferences: boolean) {
    document.documentElement.setAttribute('data-theme', theme);
    if (canUsePreferences) {
        localStorage.setItem('calsync_theme', theme);
        localStorage.setItem('dropsync_theme', theme);
    }
}

function sanitizeNumericSetting(raw: string, current: string | undefined, setter: (next: string) => void, key: string, notifyStorage: () => void, showToast: (msg: string) => void): void {
    if (typeof raw !== 'string') return;

    const trimmed = raw.trim();
    if (!trimmed) { setter(''); notifyStorage(); return; }
    if (!/^(\d+\.?\d*)$/.test(trimmed)) {
        showToast(`Please enter a valid number for ${displayNameKey(key)}.`);

        if (current) setter(current);
        notifyStorage();
        return;
    }

    setter(trimmed);
    notifyStorage();
}

function displayNameKey(key: string): string {
    switch (key) {
        case 'calsync_goal': return 'calorie goal';
        case 'dropsync_goal': return 'water goal';
        default: return key;
    }
}

const THEMES = [
    { id: 'dark',     label: 'Dark',     bg: '#0F0F10', card: '#1C1C1E', s1: '#2C2C2E', s2: '#3A3A3C', accent: '#E4840F' },
    { id: 'light',    label: 'Light',    bg: '#F2F2F7', card: '#FFFFFF', s1: '#E5E5EA', s2: '#D1D1D6', accent: '#E4840F' },
    { id: 'ocean',    label: 'Ocean',    bg: '#05111F', card: '#0A2038', s1: '#103050', s2: '#1A4060', accent: '#E4840F' },
    { id: 'forest',   label: 'Forest',   bg: '#0A140C', card: '#132218', s1: '#1E3326', s2: '#284535', accent: '#E4840F' },
    { id: 'sunset',   label: 'Sunset',   bg: '#120808', card: '#221210', s1: '#351A16', s2: '#46231E', accent: '#E4840F' },
    { id: 'lavender', label: 'Lavender', bg: '#0E0A18', card: '#1A1428', s1: '#261E3C', s2: '#332850', accent: '#E4840F' },
];

export default function SettingsModal({ isOpen, onClose, onOpenNotes, onOpenCustomSupplements }: SettingsModalProps) {
    const { user, logout, showToast, retrySync } = useAuth();
    const { canUsePreferences, canUseThirdParty } = useCookieConsent();
    const hasWeatherConsent = canUsePreferences && canUseThirdParty;

    const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
    const [goalMode, setGoalMode] = useState<'set'|'calc'>('set');
    const [goalModalOpen, setGoalModalOpen] = useState(false);
    const sheet = useDraggableSheet({ onClose });
    const [theme, setTheme] = useState('dark');
    const [deleteWarn, setDeleteWarn] = useState(true);
    const [displayName, setDisplayName] = useState(false);
    const [splashEnabled, setSplashEnabled] = useState(false);
    const [modalsExpanded, setModalsExpanded] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [aiEnabled, setAiEnabled] = useState(false);
    const [aiTermsAccepted, setAiTermsAccepted] = useState(false);
    const [aiApiKey, setAiApiKey] = useState('');
    const [savedAiKey, setSavedAiKey] = useState('');
    const [apiKeyVisible, setApiKeyVisible] = useState(false);
    const [weatherEnabled, setWeatherEnabled] = useState(false);
    const [weatherLat, setWeatherLat] = useState('');
    const [weatherLon, setWeatherLon] = useState('');
    const [weatherName, setWeatherName] = useState('');
    const [calGoal, setCalGoal] = useState('2000');
    const [waterGoal, setWaterGoal] = useState('2500');
    const [macroProtein, setMacroProtein] = useState('');
    const [macroCarbs, setMacroCarbs] = useState('');
    const [macroFat, setMacroFat] = useState('');
    const [trackSupplements, setTrackSupplements] = useState(false);
    const [supplementGoals, setSupplementGoals] = useState<{ creatine_g: number; magnesium_mg: number } | null>(null);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [logoutChecked, setLogoutChecked] = useState(false);
    const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
    const [deleteAccountChecked, setDeleteAccountChecked] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [guestImportAvailable, setGuestImportAvailable] = useState(false);
    const settingsFlushRef = useRef(false);

    useEffect(() => {
        if (!isOpen || !user) return;
        const timer = setTimeout(() => setGuestImportAvailable(hasGuestData()), 0);
        return () => clearTimeout(timer);
    }, [isOpen, user]);

    useEffect(() => {
        if (!canUsePreferences) {
            setTheme('dark');
            setDeleteWarn(true);
            setDisplayName(false);
            setSplashEnabled(false);
            setModalsExpanded(false);
            setFirstName('');
            setTrackSupplements(false);
            setCalGoal('2000');
            setWaterGoal('2500');
            setMacroProtein('');
            setMacroCarbs('');
            setMacroFat('');
            setWeatherEnabled(false);
            setWeatherLat('');
            setWeatherLon('');
            setWeatherName('');
            return;
        }

        setTheme(localStorage.getItem('calsync_theme') || 'dark');
        setDeleteWarn(localStorage.getItem('dropsync_delete_warning') !== 'false');
        setDisplayName(localStorage.getItem('calsync_display_name') === 'true');
        setSplashEnabled(localStorage.getItem('calsync_splash_enabled') === 'true');
        setModalsExpanded(localStorage.getItem('healthsync_modals_expanded') === 'true');
        setFirstName(localStorage.getItem('calsync_first_name') || '');
        setTrackSupplements(localStorage.getItem('calsync_track_supplements') === 'true');
        setCalGoal(localStorage.getItem('calsync_goal') || '2000');
        setWaterGoal(localStorage.getItem('dropsync_goal') || '2500');
        setMacroProtein(localStorage.getItem('calsync_goal_protein') || '');
        setMacroCarbs(localStorage.getItem('calsync_goal_carbs') || '');
        setMacroFat(localStorage.getItem('calsync_goal_fat') || '');
        setWeatherEnabled(localStorage.getItem('healthsync_weather_enabled') === 'true');
        setWeatherLat(localStorage.getItem('healthsync_weather_lat') || '');
        setWeatherLon(localStorage.getItem('healthsync_weather_lon') || '');
        setWeatherName(localStorage.getItem('healthsync_weather_name') || '');
    }, [canUsePreferences, user?.id]);

    useEffect(() => {
        let previousOwner = activeOwner();
        let isCurrent = workspaceGuard();
        let previousKey: string | undefined;
        const read = () => {
            const config = readAiConfig();
            const owner = activeOwner();
            setAiEnabled(config.enabled);
            setAiTermsAccepted(config.termsAccepted);
            setSavedAiKey(config.apiKey);
            if (!isCurrent() || owner !== previousOwner || config.apiKey !== previousKey) {
                setAiApiKey(config.apiKey);
                setApiKeyVisible(false);
            }
            previousOwner = owner;
            isCurrent = workspaceGuard();
            previousKey = config.apiKey;
        };
        read();
        window.addEventListener('storage', read);
        return () => window.removeEventListener('storage', read);
    }, [user?.id]);

    useEffect(() => {
        try {
            setUpdateAvailable(localStorage.getItem('healthsync_update_available') === 'true');
        } catch {
            console.warn('[settings] update status could not be read.');
        }

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== 'healthsync_update_available') return;
            setUpdateAvailable(event.newValue === 'true');
        };
        const handleSameTabChange = (event: Event) => {
            const detail = (event as CustomEvent<boolean>).detail;
            setUpdateAvailable(Boolean(detail));
        };
        window.addEventListener('storage', handleStorage);
        window.addEventListener('healthsync:update-available-changed', handleSameTabChange);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('healthsync:update-available-changed', handleSameTabChange);
        };
    }, []);

    useEffect(() => {
        if (!canUsePreferences) return;
        const storedW = parseFloat(localStorage.getItem('calsync_user_weight_kg') || '0') || 0;
        setSupplementGoals(calcSupplements(storedW));
    }, [canUsePreferences, user?.id]);

    useEffect(() => {
        if (!user) { setProfile(null); return; }
        const ownerId = user.id;
        let cancelled = false;
        supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', ownerId)
        .single()
        .then(({ data }) => {
            if (cancelled || activeOwner() !== ownerId) return;
            setProfile(data ?? null);
            if (!canUsePreferences) return;
            const remoteName = (data?.display_name || '').trim();
            if (!remoteName) return;
            const stored = (localStorage.getItem('calsync_first_name') || '').trim();
            if (stored) return;
            localStorage.setItem('calsync_first_name', remoteName);
            setFirstName(remoteName);
            window.dispatchEvent(new Event('storage'));
        });
        return () => { cancelled = true; };
    }, [user?.id, canUsePreferences]);

    const [calcFields, setCalcFields] = useState<CalcFields>({ gender: 'female', activity: 'sedentary', goalType: 'maintain', hydrationClimate: 'mild' });
    const [calcWeight, setCalcWeight] = useState('');
    const [calcHeight, setCalcHeight] = useState('');
    const [calcAge, setCalcAge] = useState('');
    const [calcResult, setCalcResult] = useState<ReturnType<typeof runCalc>>(null);

    useEffect(() => {
        if (isOpen) sheet.open();
        else if (sheet.stateRef.current !== 'closed') sheet.close();
    }, [isOpen]);

    useEffect(() => {
        const overlay = sheet.overlayRef.current;
        const modal = sheet.modalRef.current;
        if (!overlay || !modal) return;

        const update = () => {
            const anotherVisible = Array.from(document.querySelectorAll('.app-overlay'))
                .some(o => o !== overlay && o.classList.contains('visible'));
            modal.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), scale 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
            void modal.offsetHeight;
            overlay.classList.toggle('has-sub-modal', anotherVisible);
        };

        update();
        const observer = new MutationObserver(update);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
        return () => observer.disconnect();
    }, [sheet.overlayRef, sheet.modalRef]);

    const deleteAccountSheet = useDraggableSheet({
        onClose: () => { setDeleteAccountConfirm(false); setDeleteAccountChecked(false); },
    });

    useEffect(() => {
        if (deleteAccountConfirm) deleteAccountSheet.open();
        else if (deleteAccountSheet.stateRef.current !== 'closed') deleteAccountSheet.close();
    }, [deleteAccountConfirm, deleteAccountSheet]);

    const logoutSheet = useDraggableSheet({
        onClose: () => { setLogoutConfirm(false); setLogoutChecked(false); },
    });

    useEffect(() => {
        if (logoutConfirm) logoutSheet.open();
        else if (logoutSheet.stateRef.current !== 'closed') logoutSheet.close();
    }, [logoutConfirm, logoutSheet]);

    useEffect(() => {
        if (calcWeight && calcHeight && calcAge) {
        setCalcResult(runCalc(calcFields, parseFloat(calcWeight), parseFloat(calcHeight), parseFloat(calcAge)));
        } else { setCalcResult(null); }
    }, [calcFields, calcWeight, calcHeight, calcAge]);

    useEffect(() => {
        if (!canUsePreferences) return;
        const w = parseFloat(calcWeight);
        if (!w || w <= 0) return;
        const goals = persistSupplementGoals(w);
        setSupplementGoals(goals);
        if (user) {
            queueSettings({
                weight_kg: w,
                creatine_goal: goals?.creatine_g ?? null,
                magnesium_goal: goals?.magnesium_mg ?? null,
            });
            void retrySync();
        }
    }, [calcWeight, user, canUsePreferences, retrySync]);

    const saveCloudSetting = (payload: Record<string, number>) => {
        if (!user) return;
        queueSettings(payload);
        if (settingsFlushRef.current) return;
        settingsFlushRef.current = true;
        void (async () => {
            try {
                while (true) {
                    if (activeOwner() !== user.id) break;
                    const queued = JSON.parse(localStorage.getItem('healthsync_pending_settings') || '{}');
                    if (!Object.keys(queued).length) break;
                    await pushSettings(user.id, queued);
                    if (activeOwner() !== user.id) break;
                    acknowledgeSettings(queued);
                }
            } catch {
                if (activeOwner() === user.id) showToast('Saved locally; cloud settings will retry');
            }
            finally { settingsFlushRef.current = false; }
        })();
    };

    const setAndSaveGoal = (kcal: number) => {
        setCalGoal(String(kcal));
        if (canUsePreferences) {
            localStorage.setItem('calsync_goal', String(kcal));
            window.dispatchEvent(new Event('storage'));
            saveCloudSetting({ calorie_goal: kcal });
        }
    };
    const setAndSaveWater = (ml: number) => {
        setWaterGoal(String(ml));
        if (canUsePreferences) {
            localStorage.setItem('dropsync_goal', String(ml));
            window.dispatchEvent(new Event('storage'));
            saveCloudSetting({ goal_ml: ml });
        }
    };
    const saveMacro = (key: string, val: string) => {
        if (canUsePreferences) {
            localStorage.setItem(key, val);
            window.dispatchEvent(new Event('storage'));
            const column = key === 'calsync_goal_protein' ? 'protein_goal' : key === 'calsync_goal_carbs' ? 'carbs_goal' : 'fat_goal';
            if (val !== '' && Number.isFinite(Number(val))) saveCloudSetting({ [column]: Number(val) });
        }
    };

    const handleTheme = (t: string) => { setTheme(t); applyTheme(t, canUsePreferences); };
    const handleDeleteWarn = () => { const n = !deleteWarn; setDeleteWarn(n); if (canUsePreferences) { localStorage.setItem('dropsync_delete_warning', String(n)); window.dispatchEvent(new Event('storage')); } };
    const handleDisplayName = () => { const n = !displayName; setDisplayName(n); if (canUsePreferences) { localStorage.setItem('calsync_display_name', String(n)); window.dispatchEvent(new Event('storage')); } };
    const handleSplashEnabled = () => { const n = !splashEnabled; setSplashEnabled(n); if (canUsePreferences) { localStorage.setItem('calsync_splash_enabled', String(n)); window.dispatchEvent(new Event('storage')); } };
    const handleModalsExpanded = () => { const n = !modalsExpanded; setModalsExpanded(n); if (canUsePreferences) { localStorage.setItem('healthsync_modals_expanded', String(n)); window.dispatchEvent(new Event('storage')); } };
    const handleTrackSupplements = () => {
        const n = !trackSupplements;
        setTrackSupplements(n);
        if (canUsePreferences) {
            localStorage.setItem('calsync_track_supplements', String(n));
            window.dispatchEvent(new Event('storage'));
            if (user) {
                queueSettings({ track_supplements: n });
                void retrySync();
            }
        }
    };
    const handleSetFirstName = () => {
        if (!canUsePreferences) return;
        localStorage.setItem('calsync_first_name', firstName);
        window.dispatchEvent(new Event('storage'));
        showToast('Changes Saved!');
    };
    const handleAiToggle = () => {
        if (!canUseThirdParty) return;
        const n = !aiEnabled;
        setAiEnabled(n);
        writeAiConfig({ enabled: n });
    };
    const handleAiAccept = () => {
        if (!canUseThirdParty) return;
        setAiTermsAccepted(true);
        writeAiConfig({ termsAccepted: true });
        showToast('Terms accepted');
    };
    const handleAiDecline = () => {
        setAiEnabled(false);
        setAiTermsAccepted(false);
        if (canUseThirdParty) {
            writeAiConfig({ enabled: false, termsAccepted: false });
        }
        showToast('AI Detection disabled');
    };
    const handleSaveApiKey = async () => {
        if (!canUseThirdParty) return;

        const trimmed = aiApiKey.trim();
        if (!trimmed) { showToast('Please enter your Gemini API key.'); return; }

        showToast('Validating API key…');
        const result = await saveValidatedAiKey(trimmed, validateApiKey);
        if (result === 'stale') return;
        if (result === 'invalid') {
            showToast('Invalid API key – please check and try again.');
            return;
        }

        showToast('API key saved and verified.');
    };

    const handleWeatherToggle = () => {
        if (!hasWeatherConsent) return;
        const n = !weatherEnabled;
        setWeatherEnabled(n);
        localStorage.setItem('healthsync_weather_enabled', String(n));
        window.dispatchEvent(new Event('storage'));
    };

    const handleSaveWeather = () => {
        if (!hasWeatherConsent) {
            showToast('Please approve Preferences and Third Party cookies to save weather.');
            return;
        }
        localStorage.setItem('healthsync_weather_lat', weatherLat);
        localStorage.setItem('healthsync_weather_lon', weatherLon);
        localStorage.setItem('healthsync_weather_name', weatherName);
        localStorage.setItem('healthsync_weather_enabled', String(weatherEnabled));
        window.dispatchEvent(new Event('storage'));
        showToast('Weather settings saved');
    };

    const exportAllData = () => {
        const calEntries = JSON.parse(localStorage.getItem('calsync_v1') || '[]');
        const dsEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
        const allData = {
            exportDate: new Date().toISOString(),
            calsyncEntries: calEntries,
            dropsyncEntries: dsEntries,
            goals: {
                calorie: localStorage.getItem('calsync_goal'),
                protein: localStorage.getItem('calsync_goal_protein'),
                carbs: localStorage.getItem('calsync_goal_carbs'),
                fat: localStorage.getItem('calsync_goal_fat'),
                water: localStorage.getItem('dropsync_goal'),
            },
        };
        downloadFile('healthsync_export.json', JSON.stringify(allData, null, 2), 'application/json');
        showToast('All data exported');
    };

    const exportAllDataAsCSV = () => {
        const calEntries = JSON.parse(localStorage.getItem('calsync_v1') || '[]') as Array<Record<string, unknown>>;
        const dsEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]') as Array<Record<string, unknown>>;
        const workoutLogs = JSON.parse(localStorage.getItem('healthsync_workout_logs') || '[]') as Array<Record<string, unknown>>;

        const buildCsv = (headers: string[], rows: Array<Record<string, unknown>>): string => {
            const out = [headers.join(',')];
            for (const r of rows) out.push(headers.map(h => csvEscape(r[h])).join(','));
            return out.join('\r\n');
        };
        const isoFromTs = (ts: unknown): string => {
            const n = typeof ts === 'number' ? ts : Number(ts);
            return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : '';
        };

        const foodHeaders = ['id', 'date', 'datetime_iso', 'food', 'brand', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'amount', 'unit', 'source', 'is_drink', 'is_barcode', 'barcode'];
        const foodRows = calEntries.map(e => ({
            id: e.id ?? '',
            date: e.date ?? '',
            datetime_iso: isoFromTs(e.ts),
            food: e.food ?? '',
            brand: e.brand ?? '',
            kcal: e.kcal ?? '',
            protein_g: e.prot ?? '',
            carbs_g: e.carb ?? '',
            fat_g: e.fat ?? '',
            amount: e.amount ?? e.weight ?? '',
            unit: e.unit ?? '',
            source: e.source ?? 'calsync',
            is_drink: e.isDrink ? 'true' : 'false',
            is_barcode: (e.isBarcode || !!e.barcode) ? 'true' : 'false',
            barcode: e.barcode ?? '',
        }));

        const drinkHeaders = ['id', 'date', 'datetime_iso', 'drink', 'amount_ml', 'source'];
        const drinkRows = dsEntries.map(e => ({
            id: e.id ?? '',
            date: e.date ?? '',
            datetime_iso: isoFromTs(e.ts),
            drink: e.drink ?? '',
            amount_ml: e.amount ?? '',
            source: e.source ?? 'dropsync',
        }));

        const workoutHeaders = ['session_id', 'routine_id', 'routine_name', 'start_iso', 'end_iso', 'duration_seconds', 'intensity', 'exercise_id', 'exercise_name', 'set_index', 'weight_kg', 'reps', 'completed'];
        const workoutRows: Array<Record<string, unknown>> = [];
        for (const log of workoutLogs) {
            const exercises = Array.isArray(log.exercises) ? log.exercises as Array<Record<string, unknown>> : [];
            for (const ex of exercises) {
                const sets = Array.isArray(ex.sets) ? ex.sets as Array<Record<string, unknown>> : [];
                sets.forEach((s, idx) => {
                    workoutRows.push({
                        session_id: log.id ?? '',
                        routine_id: log.routineId ?? '',
                        routine_name: log.routineName ?? '',
                        start_iso: isoFromTs(log.startTime),
                        end_iso: isoFromTs(log.endTime),
                        duration_seconds: log.duration ?? '',
                        intensity: log.intensity ?? ex.intensity ?? '',
                        exercise_id: ex.exerciseId ?? '',
                        exercise_name: ex.name ?? ex.exerciseName ?? '',
                        set_index: idx + 1,
                        weight_kg: s.weight ?? '',
                        reps: s.reps ?? '',
                        completed: s.completed ? 'true' : 'false',
                    });
                });
            }
        }

        const goalRows = [{
            calorie_kcal: localStorage.getItem('calsync_goal') ?? '',
            protein_g: localStorage.getItem('calsync_goal_protein') ?? '',
            carbs_g: localStorage.getItem('calsync_goal_carbs') ?? '',
            fat_g: localStorage.getItem('calsync_goal_fat') ?? '',
            water_ml: localStorage.getItem('dropsync_goal') ?? '',
            exported_at: new Date().toISOString(),
        }];
        const goalHeaders = ['calorie_kcal', 'protein_g', 'carbs_g', 'fat_g', 'water_ml', 'exported_at'];

        const files: Array<{ name: string; rows: Array<Record<string, unknown>>; headers: string[] }> = [
            { name: 'healthsync_food.csv', rows: foodRows, headers: foodHeaders },
            { name: 'healthsync_drinks.csv', rows: drinkRows, headers: drinkHeaders },
            { name: 'healthsync_workouts.csv', rows: workoutRows, headers: workoutHeaders },
            { name: 'healthsync_goals.csv', rows: goalRows, headers: goalHeaders },
        ].filter(f => f.rows.length > 0);

        if (files.length === 0) {
            showToast('No data to export.');
            return;
        }

        files.forEach((f, i) => {
            setTimeout(() => downloadFile(f.name, '\uFEFF' + buildCsv(f.headers, f.rows), 'text/csv;charset=utf-8'), i * 200);
        });
        showToast(`Exported ${files.length} CSV file${files.length === 1 ? '' : 's'}`);
    };

    const applyUpdate = async () => {
        const globalWindow = window as SerwistWindow;
        let registration: ServiceWorkerRegistration | undefined;
        try {
            registration = await navigator.serviceWorker.getRegistration();
        } catch {
            console.warn('[settings] update status could not be checked.');
        }

        writeLocalLastSeen(user?.id ?? null, APP_VERSION);

        if (!registration?.waiting) {
            writePendingReloadAfterUpdate(false);
            setUpdateAvailable(false);
            try {
                localStorage.setItem('healthsync_update_available', 'false');
            } catch {
                console.warn('[settings] update status could not be saved.');
            }
            window.dispatchEvent(new CustomEvent('healthsync:update-available-changed', { detail: false }));
            window.location.reload();
            return;
        }

        writePendingReloadAfterUpdate(true);
        globalWindow.serwist?.messageSkipWaiting();
    };

    const deleteAllData = async () => {
        const ownerId = user?.id ?? GUEST_OWNER;
        const scope = user ? 'local data and synced food, drinks, workouts, goals and settings on all devices' : 'local food, drinks, workouts, goals and settings';
        if (!confirm(`Permanently delete ${scope}? This cannot be undone.`)) return;
        try {
            if (user) {
                const { error } = await supabase.rpc('clear_healthsync_data');
                if (error) throw error;
            }
            if (activeOwner() !== ownerId) return;
            clearActiveHealthData();
            for (const key of ['calsync_ai_api_key', 'calsync_ai_enabled', 'calsync_ai_terms_accepted',
                'calsync_first_name', 'calsync_theme', 'dropsync_theme', 'calsync_splash_enabled',
                'healthsync_weather_enabled', 'healthsync_weather_lat', 'healthsync_weather_lon',
                'healthsync_weather_name', 'dropsync_delete_warning', 'calsync_display_name',
                'healthsync_modals_expanded']) localStorage.removeItem(key);
            setCalGoal('2000');
            setWaterGoal('2500');
            setMacroProtein('0');
            setMacroCarbs('0');
            setMacroFat('0');
            setTrackSupplements(false);
            setCalcWeight('');
            setCalcHeight('');
            setCalcAge('');
            setSupplementGoals(null);
            setAiEnabled(false);
            setAiTermsAccepted(false);
            setAiApiKey('');
            setTheme('dark');
            setFirstName('');
            setWeatherEnabled(false);
            setWeatherLat('');
            setWeatherLon('');
            setWeatherName('');
            localStorage.setItem('healthsync_last_cloud_sync', new Date().toISOString());
            window.dispatchEvent(new Event('storage'));
            showToast('Data deleted');
            sheet.close();
        } catch {
            console.error('[settings] cloud data deletion failed.');
            if (activeOwner() === ownerId) {
                showToast('Cloud data could not be deleted. Nothing was removed; check your connection and try again.');
            }
        }
    };

    return (
        <>
        <div className="app-overlay" id="settingsOverlay" ref={sheet.overlayRef} onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}>
            <div className="modal" id="settingsModal" ref={sheet.modalRef}>
                <div className="modal-handle-zone" id="settingsHandleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title">Settings</div>
                </div>
                <div className="modal-body" id="settingsModalBody" style={{ overflowY: 'auto' }}>
                    <div className="settings-section">
                        <div className="settings-section-title"><i className="fas fa-cloud" />Cloud Sync</div>
                        {!user ? (
                            <button id="accountLoginBtn" className="settings-btn mgmnt-btn" onClick={() => { sheet.close(); window.location.href = '/login'; }}>
                            <i className="fas fa-user" /> Login/Register
                            </button>
                        ) : (
                            <div id="loggedInSettings">
                                <div id="authUserInfo" className="auth-user-info">
                                    <div className="auth-user-container">
                                        {(() => {
                                            const avatarUrl = profile?.avatar_url || (user.user_metadata?.avatar_url as string | undefined);
                                            const displayedName = profile?.display_name || firstName || user.user_metadata?.full_name || user.email || '';
                                            return avatarUrl ? (
                                            <div className="auth-avatar" aria-label={displayedName}>
                                                <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement as HTMLElement).classList.add('auth-avatar--initial'); (e.currentTarget.parentElement as HTMLElement).textContent = String(displayedName || '?').charAt(0).toUpperCase(); }} />
                                            </div>
                                            ) : (
                                            <div className="auth-avatar auth-avatar--initial" aria-label={displayedName}>
                                                {String(displayedName || '?').charAt(0).toUpperCase()}
                                            </div>
                                            );
                                        })()}
                                        <span>{profile?.display_name || firstName || user.user_metadata?.full_name || user.email}</span>
                                    </div>
                                    <span className="sync-badge active">Synced</span>
                                </div>
                                <button id="accountLogoutBtn" className="settings-btn mgmnt-btn logout-btn" onClick={() => setLogoutConfirm(true)}>Logout</button>
                                <button id="deleteAccountBtn" className="settings-btn mgmnt-btn delete-account-btn" onClick={() => setDeleteAccountConfirm(true)}>
                                    <i className="fa-regular fa-trash-can" /> Delete Account
                                </button>
                                <div className="divider">or</div>
                                <button id="manageAccount" className="option-btn active" style={{ width: '100%', borderRadius: 'var(--radius-sm)', padding: '13px 16px' }}
                                    onClick={() => { sheet.close(); window.location.href = '/account'; }}>
                                    <i className="fas fa-user" /> Manage Account
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="settings-section" id="notificationsSettings">
                        <div className="settings-section-title"><i className="fa-solid fa-bell" />Notifications</div>
                        {isOpen && <Notifications />}
                    </div>
                    <div className="settings-section" id="aiDetection">
                        <div className="settings-section-title">
                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                            AI Detection [BETA]
                        </div>
                        <div className="settings-section-body" style={{ opacity: canUseThirdParty ? 1 : 0.5, cursor: canUseThirdParty ? '' : 'default', pointerEvents: canUseThirdParty ? 'auto' : 'none' }}>
                            <div className="settings-toggle-row">
                                <div className="settings-toggle-label">
                                    <span>Enable AI Detection</span>
                                    <span className="settings-toggle-sub">Allow HealthSync to use AI for food recognition</span>
                                </div>
                                <button
                                    className="app-toggle-switch"
                                    id="aiEnabledToggle"
                                    role="switch"
                                    aria-checked={aiEnabled}
                                    aria-label="Enable AI Detection"
                                    aria-pressed={String(aiEnabled) as 'true'|'false'}
                                    onClick={handleAiToggle}
                                    disabled={!canUseThirdParty}
                                />
                            </div>
                            <div className="ai-info-box" id="aiInfoBox">
                                <i className="fa-solid fa-circle-info" />
                                <p>AI Detection uses Google&apos;s Gemini API to analyze food images and estimate nutrition values. This feature is experimental and requires your own API key. Important nutrition information should be verified. Results may be inaccurate or inconsistent. Use at your own risk.</p>
                            </div>
                            {aiEnabled && (
                                <div id="aiSettings">
                                    {!aiTermsAccepted ? (
                                        <div className="ai-terms-box" id="aiTermsBox">
                                            <div className="ai-terms-title"><i className="fa-solid fa-file-contract" />Terms &amp; Conditions</div>
                                            <div className="ai-terms-content">
                                            <p><strong>Please read carefully before using AI Nutrition Detection:</strong></p>
                                            <ul>
                                                <li>Nutrition values generated by AI are <strong>automated estimates</strong>. Results may differ significantly from actual values.</li>
                                                <li>You are responsible for your own Gemini API key. Never share it publicly.</li>
                                                <li>By using this feature, you agree to <a href="https://healthsync.itsmarian.dev/legal/ai-guidelines" target="_blank" rel="noopener"><strong>HealthSync&apos;s AI Guidelines</strong></a> and <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener"><strong>Google&apos;s Gemini API Terms</strong></a>.</li>
                                                <li>API usage may generate costs. HealthSync assumes no responsibility for API charges.</li>
                                            </ul>
                                            <p className="ai-terms-warning"><i className="fa-solid fa-triangle-exclamation" />By accepting, you use this feature at your own risk.</p>
                                            </div>
                                            <div className="ai-terms-actions">
                                            <button className="ai-terms-btn decline" id="aiTermsDecline" onClick={handleAiDecline}><i className="fa-solid fa-xmark" />Decline</button>
                                            <button className="ai-terms-btn accept" id="aiTermsAccept" onClick={handleAiAccept}><i className="fa-solid fa-check" />Accept &amp; Continue</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div id="aiApiKeySection">
                                            <div className="form-row">
                                            <label className="form-label"><i className="fa-solid fa-key" />Gemini API Key</label>
                                            <div className="api-key-input-wrapper">
                                                <input className="form-input" id="aiApiKeyInput" type={apiKeyVisible ? 'text' : 'password'} placeholder="Enter your Gemini API key" autoComplete="off" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} />
                                                <button className="api-key-toggle" id="apiKeyToggle" type="button" onClick={() => setApiKeyVisible(v => !v)}>
                                                <i className={apiKeyVisible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} />
                                                </button>
                                            </div>
                                            <p className="form-helper"><i className="fa-solid fa-lightbulb" />Get your free API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a></p>
                                            </div>
                                            <button className="option-btn active" id="saveApiKeyBtn" style={{ width:'100%',borderRadius:'var(--radius-sm)',padding:'13px 16px',marginTop:'8px' }} onClick={handleSaveApiKey}><i className="fa-solid fa-floppy-disk" />&nbsp;Save API Key</button>
                                            {canUseThirdParty && savedAiKey && <div className="ai-status-box" id="aiStatusBox"><i className="fa-solid fa-circle-check" /><span>AI Detection is active</span></div>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="settings-section">
                        <div className="settings-section-title">
                            <i className="fa-solid fa-cloud-sun"></i>
                            Weather Widget
                        </div>
                        <div className="settings-section-body" style={{ opacity: hasWeatherConsent ? 1 : 0.5, cursor: hasWeatherConsent ? '' : 'default', pointerEvents: hasWeatherConsent ? 'auto' : 'none' }}>
                            <div className="settings-toggle-row">
                                <div className="settings-toggle-label">
                                    <span>Show weather on dashboard</span>
                                    <span className="settings-toggle-sub">Enable the small weather widget next to activity status</span>
                                </div>
                                <button
                                    className="app-toggle-switch"
                                    id="weatherEnabledToggle"
                                    role="switch"
                                    aria-checked={weatherEnabled}
                                    aria-label="Show weather on dashboard"
                                    aria-pressed={String(weatherEnabled) as 'true'|'false'}
                                    onClick={handleWeatherToggle}
                                    disabled={!hasWeatherConsent}
                                />
                            </div>
                            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                                <label className="form-row">
                                    <span className="form-label">Latitude</span>
                                    <input className="form-input" value={weatherLat} onChange={e => setWeatherLat(e.currentTarget.value)} placeholder="e.g. 40.7128" disabled={!hasWeatherConsent} />
                                </label>
                                <label className="form-row">
                                    <span className="form-label">Longitude</span>
                                    <input className="form-input" value={weatherLon} onChange={e => setWeatherLon(e.currentTarget.value)} placeholder="e.g. -74.0060" disabled={!hasWeatherConsent} />
                                </label>
                                <label className="form-row">
                                    <span className="form-label">Location name</span>
                                    <input className="form-input" value={weatherName} onChange={e => setWeatherName(e.currentTarget.value)} placeholder="Optional display name" disabled={!hasWeatherConsent} />
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        className="option-btn"
                                        style={{ flex: 1, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}
                                        onClick={async () => {
                                            if (!hasWeatherConsent) return;
                                            if (!navigator.geolocation) {
                                                showToast('Geolocation not supported');
                                                return;
                                            }
                                            try {
                                                setWeatherName('Loading...');
                                                const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                                                    navigator.geolocation.getCurrentPosition(resolve, reject)
                                                );
                                                const lat = pos.coords.latitude;
                                                const lon = pos.coords.longitude;
                                                setWeatherLat(String(lat));
                                                setWeatherLon(String(lon));
                                                const name = await reverseGeocodeLocation(lat, lon);
                                                setWeatherName(name);
                                                localStorage.setItem('healthsync_weather_lat', String(lat));
                                                localStorage.setItem('healthsync_weather_lon', String(lon));
                                                localStorage.setItem('healthsync_weather_name', name);
                                                showToast(`Location saved`);
                                            } catch {
                                                console.warn('Location permission or lookup failed.');
                                                showToast('Could not determine your location. Check location permission and try again.');
                                            }
                                        }}
                                        disabled={!hasWeatherConsent}
                                    >
                                        <i className="fa-solid fa-location-crosshairs" style={{ marginRight: 8 }} />Use Location
                                    </button>
                                    <button className="option-btn" style={{ flex: 1, borderRadius: 'var(--radius-sm)', padding: '10px 12px' }} onClick={handleSaveWeather} disabled={!hasWeatherConsent}> <i className="fa-solid fa-floppy-disk" /> Save</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="settings-section">
                        <div className="settings-section-title">
                        <i className="fa-solid fa-flag-checkered"></i>
                            Calorie/Hydration Goal/s
                        </div>
                        <div className="settings-section-body">
                            <div className="goal-display-row">
                                <span className="goal-display-val" id="currentGoalDisplay">{calGoal} kcal</span>
                            </div>
                            <div className="goal-display-row">
                                <span className="goal-display-val" id="ds-currentGoalDisplay">
                                    {parseInt(waterGoal) >= 1000 ? (parseInt(waterGoal)/1000).toFixed(1).replace('.',',') + 'L' : waterGoal + ' ml'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="option-btn" id="openSetGoalBtn" style={{ flex:1, borderRadius:'var(--radius-sm)', padding:'13px 16px' }} onClick={() => { setGoalMode('set'); setGoalModalOpen(true); }} disabled={!canUsePreferences}>
                                    <i className="fa-solid fa-bullseye" style={{ marginRight:6 }} />Set Goal
                                </button>
                                <button className="option-btn" id="openCalcGoalBtn" style={{ flex:1, borderRadius:'var(--radius-sm)', padding:'13px 16px' }} onClick={() => { setGoalMode('calc'); setGoalModalOpen(true); }} disabled={!canUsePreferences}>
                                    <i className="fa-solid fa-calculator" style={{ marginRight:6 }} />Calculate Goal
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="settings-section">
                        <div className="settings-section-title">
                        <i className="fa-regular fa-sliders"></i>
                            Personalization
                        </div>
                    <div className="settings-section-body" style={{ opacity: canUsePreferences ? 1 : 0.5, cursor: canUsePreferences ? '' : 'default', pointerEvents: canUsePreferences ? 'auto' : 'none' }}>
                        <div className="settings-toggle-row">
                            <div className="settings-toggle-label">
                                <span>Delete entry warning (HealthSync)</span>
                                <span className="settings-toggle-sub">Show a confirmation before deleting entries</span>
                            </div>
                            <button
                                className="app-toggle-switch"
                                id="deleteWarningToggle"
                                role="switch"
                                aria-checked={deleteWarn}
                                aria-label="Delete entry warning"
                                aria-pressed={String(deleteWarn) as 'true'|'false'}
                                onClick={handleDeleteWarn}
                                disabled={!canUsePreferences}
                            />
                        </div>
                        <div className="settings-toggle-row">
                            <div className="settings-toggle-label">
                                <span>Show splash screen</span>
                                <span className="settings-toggle-sub">Display the splash screen when the app opens, you return to the app, or switch tabs</span>
                            </div>
                            <button
                                className="app-toggle-switch"
                                id="splashScreenToggle"
                                role="switch"
                                aria-checked={splashEnabled}
                                aria-label="Show splash screen"
                                aria-pressed={String(splashEnabled) as 'true'|'false'}
                                onClick={handleSplashEnabled}
                                disabled={!canUsePreferences}
                            />
                        </div>
                        <div className="settings-toggle-row">
                            <div className="settings-toggle-label">
                                <span>Open every menu as expanded</span>
                                <span className="settings-toggle-sub">Menus open fullscreen by default. Swipe down to collapse back to the normal view.</span>
                            </div>
                            <button
                                className="app-toggle-switch"
                                id="modalsExpandedToggle"
                                role="switch"
                                aria-checked={modalsExpanded}
                                aria-label="Open every menu as expanded"
                                aria-pressed={String(modalsExpanded) as 'true'|'false'}
                                onClick={handleModalsExpanded}
                                disabled={!canUsePreferences}
                            />
                        </div>
                        <div className="settings-toggle-row">
                            <div className="settings-toggle-label">
                                <span>Track Supplements</span>
                                <span className="settings-toggle-sub">Show recommended daily creatine &amp; magnesium based on your body weight.</span>
                                {trackSupplements && (
                                    <div className="form-row" style={{ marginTop: 8 }}>
                                        {supplementGoals ? (
                                            <ul className="supplement-list">
                                                <li><span>Creatine</span><strong>{supplementGoals.creatine_g} g/day</strong></li>
                                                <li><span>Magnesium</span><strong>{supplementGoals.magnesium_mg} mg/day</strong></li>
                                            </ul>
                                        ) : (
                                            <p className="settings-toggle-sub" style={{ margin: 0 }}>
                                                <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />
                                                Open <em>Calculate Goal</em> and enter your weight to compute supplement targets.
                                            </p>
                                        )}
                                        {canUsePreferences && (
                                            <button
                                                type="button"
                                                className="supplement-manage-btn"
                                                id="manageCustomSupplementsBtn"
                                                onClick={() => setTimeout(onOpenCustomSupplements, 200)}
                                            >
                                                <span>Manage custom supplements</span>
                                                <i className="fas fa-chevron-right" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button
                                className="app-toggle-switch"
                                id="trackSupplementsToggle"
                                role="switch"
                                aria-checked={trackSupplements}
                                aria-label="Track supplements"
                                aria-pressed={String(trackSupplements) as 'true'|'false'}
                                onClick={handleTrackSupplements}
                                disabled={!canUsePreferences}
                            />
                        </div>
                        <div className="settings-toggle-row">
                            <div className="settings-toggle-label">
                                <span>Show name on start</span>
                                <span className="settings-toggle-sub">Displays a welcome message containing your name instead of the app name</span>
                                <div className="form-row">
                                    <label className="form-label" htmlFor="firstName">Name:</label>
                                    <div className="flex-container gap-10px">
                                        <input
                                            className="form-input"
                                            name="firstName"
                                            id="firstName"
                                            type="text"
                                            autoComplete="given-name"
                                            value={firstName}
                                            onChange={e => setFirstName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSetFirstName(); }}
                                            disabled={!canUsePreferences}
                                        />
                                        <button className="option-btn active" id="setFirstNameBtn" style={{ borderRadius:'var(--radius-sm)', padding:'13.5px 16px' }} onClick={handleSetFirstName} disabled={!canUsePreferences}>Set</button>
                                    </div>
                                </div>
                            </div>
                            <button
                                className="app-toggle-switch"
                                id="displayNameOnStart"
                                role="switch"
                                aria-checked={displayName}
                                aria-label="Display name on start"
                                aria-pressed={String(displayName) as 'true'|'false'}
                                onClick={handleDisplayName}
                                disabled={!canUsePreferences}
                            />
                        </div>
                        <div className="settings-toggle-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:12 }}>
                            <div className="settings-toggle-label">
                                <span>App Theme</span>
                                <span className="settings-toggle-sub">Choose a color theme for the app</span>
                            </div>
                            <div className="theme-picker" id="themePicker">
                                {THEMES.map(t => (
                                    <div
                                        key={t.id}
                                        className={`theme-option${theme === t.id ? ' active' : ''}`}
                                        data-theme={t.id}
                                        onClick={() => handleTheme(t.id)}
                                        style={{ opacity: canUsePreferences ? 1 : 0.5, cursor: canUsePreferences ? '' : 'default', pointerEvents: canUsePreferences ? 'auto' : 'none' }}
                                    >
                                        <div className="theme-swatch" style={{ background: t.bg }}>
                                            <div className="theme-swatch-bg" style={{ background: t.card, borderRadius:4 }} />
                                            <div className="theme-swatch-s1" style={{ background: t.s1 }} />
                                            <div className="theme-swatch-s2" style={{ background: t.s2 }} />
                                            <div className="theme-swatch-accent" style={{ background: t.accent }} />
                                        </div>
                                        <span className="theme-option-label">{t.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="settings-section">
                    <div className="settings-section-title">
                        <i className="fa-solid fa-wrench"></i>
                        System
                    </div>
                    <div className="settings-section-body" style={{ gap: 8, display: 'flex', flexDirection: 'column' }}>
                        <button className="data-btn" id="openReportBugBtn" onClick={() => setReportOpen(true)}>
                            <i className="fa-solid fa-bug" style={{ marginRight: 6 }} />
                            Report a Bug
                        </button>
                        {updateAvailable ? (
                            <button className="data-btn" id="updateNowBtn" onClick={applyUpdate} style={{ color: '#30D158', fontWeight: 600 }}>
                                <i className="fa-solid fa-arrow-up-from-bracket"></i>
                                Update Now
                            </button>
                        ) : (
                            <button className='data-btn no-action' style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text2)', fontSize: 14 }}>
                                <i className="fa-solid fa-check" style={{ marginRight: 6, color: '#30D158' }} />
                                App is up to date (v{APP_VERSION})
                            </button>
                        )}
                    </div>
                </div>

                <div className="settings-section">
                    <div className="settings-section-title">
                    <i className="fa-solid fa-database"></i>
                        Data
                    </div>
                    <div className="settings-section-body" style={{ gap:8, display:'flex', flexDirection:'column' }}>
                        {user && guestImportAvailable && <button className="data-btn" onClick={() => {
                            try {
                                importGuestData(user.id);
                                setGuestImportAvailable(false);
                                void retrySync();
                                showToast('Guest entries imported into this account');
                            } catch { showToast('Guest import failed'); }
                        }}>Import guest food, drinks and workouts into this account</button>}
                        <button className="data-btn" id="exportAllDataBtn" onClick={exportAllData}>
                            <i className="fas fa-download"></i>
                            Export All Data As JSON
                            </button>
                        <button className="data-btn" id="exportAllDataCSVBtn" onClick={exportAllDataAsCSV}>
                            <i className="fa-regular fa-table"></i>
                            Export All Data as CSV
                        </button>
                        <button className="data-btn" id="deleteAllDataBtn" onClick={deleteAllData} style={{ color: '#ef4444' }}>
                            <i className="fa-regular fa-trash-can"></i>
                            Delete All Data
                        </button>
                    </div>
                </div>
                <div className="settings-legal">
                    <div className="settings-legal-footer">
                        <table style={{ borderCollapse:'collapse', marginTop:8, tableLayout:'fixed', width:'100%' }}>
                            <tbody>
                                <tr>
                                    <td style={{ textAlign:'center', verticalAlign:'middle', width:'47.5%' }}>
                                    <a className="link" href="https://github.com/itsmarianmc/healthsync" target="_blank" rel="noopener">
                                        <img height="42.5" src="https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/available/github_vector.svg" alt="GitHub" />
                                    </a>
                                    </td>
                                    <td style={{ borderLeft:'1px solid rgba(255,255,255,0.1)', textAlign:'center', verticalAlign:'middle', width:'52.5%' }}>
                                    <a className="link" href="https://ko-fi.com/itsmarian" target="_blank" rel="noopener">
                                        <img height="42.5" src="https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/donate/kofi-singular_vector.svg" alt="Ko-fi" />
                                    </a>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <p style={{ marginTop:8 }}><a id="openNotes" onClick={e => { e.preventDefault(); setTimeout(onOpenNotes, 200); }}>About / Licenses</a></p>
                        <footer>
                            <p>
                                <a href="https://healthsync.itsmarian.dev/legal/ai-guidelines">AI Guidelines</a> • <a href="https://contact.itsmarian.dev/">Contact</a> • <a href="https://healthsync.itsmarian.dev/legal/cookies">Cookies</a> • <a href="https://healthsync.itsmarian.dev/legal/privacy">Privacy Policy</a> • <a href="https://healthsync.itsmarian.dev/legal/terms">Terms of Use</a>
                            </p>
                            <p>Running HealthSync v{APP_VERSION}</p>
                            <p className="change-settings" data-open-cookie-settings>Change Cookie Preferences</p>
                            <p style={{ marginTop: 'calc(1rem - 7.5px)' }}>© 2026 itsmarian | Original source code: MIT; other materials have separate rights.</p>
                        </footer>
                    </div>
                </div>
            </div>
        </div>
        </div>

        {logoutConfirm && (
            <div className="app-overlay logout-overlay" id="logoutOverlay" ref={logoutSheet.overlayRef} onClick={e => { if (e.target === logoutSheet.overlayRef.current) logoutSheet.close(); }}>
                <div className="modal logout-modal" id="logoutModal" ref={logoutSheet.modalRef} style={{ transform: 'translateY(100%)' }} role="dialog" aria-modal="true" aria-labelledby="logoutTitle">
                    <div className="modal-handle-zone" id="logoutHandleZone" {...logoutSheet.handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-title" id="logoutTitle">Logout</div>
                    </div>
                    <div className="modal-body" id="logoutModalBody">
                        <p className="logout-info">Choose whether to keep your locally stored data on this device or delete everything when signing out.</p>
                        <label className="custom-checkbox-label logout-checkbox-label" htmlFor="logoutDeleteDataCheckbox">
                            <input
                                type="checkbox"
                                id="logoutDeleteDataCheckbox"
                                className="custom-checkbox-input"
                                checked={logoutChecked}
                                onChange={e => setLogoutChecked(e.target.checked)}
                            />
                            <span className="custom-checkbox-box" aria-hidden="true">
                                <svg className="custom-checkbox-check" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <span>Sign out and delete data on this device</span>
                        </label>
                    </div>
                    <div className="modal-footer logout-actions">
                        <button
                            className="option-btn logout-cancel-btn"
                            id="logoutCancelBtn"
                            onClick={() => logoutSheet.close()}
                        >Cancel</button>
                        <button
                            className="option-btn logout-confirm-btn"
                            id="logoutConfirmBtn"
                            onClick={async () => {
                                const shouldClear = logoutChecked;
                                setLogoutConfirm(false);
                                setLogoutChecked(false);
                                await logout(shouldClear);
                                sheet.close();
                            }}
                        >Confirm Logout</button>
                    </div>
                </div>
            </div>
        )}

        {deleteAccountConfirm && (
            <div className="app-overlay delete-account-overlay" id="deleteAccountOverlay" ref={deleteAccountSheet.overlayRef} onClick={e => { if (e.target === deleteAccountSheet.overlayRef.current) deleteAccountSheet.close(); }}>
                <div className="modal delete-account-modal" id="deleteAccountModal" ref={deleteAccountSheet.modalRef} style={{ transform: 'translateY(100%)' }} role="dialog" aria-modal="true" aria-labelledby="deleteAccountTitle">
                    <div className="modal-handle-zone" id="deleteAccountHandleZone" {...deleteAccountSheet.handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-title" id="deleteAccountTitle">Delete HealthSync Account</div>
                    </div>
                    <div className="modal-body" id="deleteAccountModalBody">
                        <p className="delete-account-warning">This action is permanent and cannot be undone. After deletion succeeds, your account and its cloud data will be removed, including meals, hydration history, workout logs, health metrics, and progress. Health data and personal settings on this device will also be cleared.</p>
                        <label className="custom-checkbox-label delete-account-checkbox-label" htmlFor="deleteAccountCheckbox">
                            <input
                                type="checkbox"
                                id="deleteAccountCheckbox"
                                className="custom-checkbox-input"
                                checked={deleteAccountChecked}
                                onChange={e => setDeleteAccountChecked(e.target.checked)}
                            />
                            <span className="custom-checkbox-box" aria-hidden="true">
                                <svg className="custom-checkbox-check" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <span>I understand this is irreversible</span>
                        </label>
                    </div>
                    <div className="modal-footer delete-account-actions">
                        <button
                            className="option-btn delete-account-cancel-btn"
                            id="deleteAccountCancelBtn"
                            onClick={() => deleteAccountSheet.close()}
                        >Cancel</button>
                        <button
                            className="option-btn delete-account-confirm-btn"
                            id="deleteAccountConfirmBtn"
                            disabled={!deleteAccountChecked}
                            onClick={async () => {
                                if (!deleteAccountChecked) { showToast('Please confirm first'); return; }
                                try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    const token = session?.access_token;
                                    if (!token || !user) { showToast('Session expired – please log in again'); return; }
                                    setDeleteAccountConfirm(false);
                                    setDeleteAccountChecked(false);
                                    showToast('Deleting account…');
                                    const res = await fetch('/api/account/delete', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ accessToken: token, userId: user.id }),
                                    });
                                    const result = await res.json().catch(() => ({}));
                                    if (!res.ok || result?.ok !== true) {
                                        const message = res.status === 401 || res.status === 403
                                            ? 'Your session needs verification. Sign in again and retry account deletion.'
                                            : res.status >= 500
                                                ? 'Account deletion is temporarily unavailable. Your account was not deleted; try again later.'
                                                : 'Could not delete your account. Your account and data remain unchanged; try again.';
                                        showToast(message);
                                        return;
                                    }
                                    await logout(true);
                                    showToast('Account deleted');
                                    sheet.close();
                                } catch { showToast('Delete failed – try again'); }
                            }}
                        >Permanently Delete</button>
                    </div>
                </div>
            </div>
        )}

        {goalModalOpen && (
            <GoalModal
                mode={goalMode}
                onModeChange={setGoalMode}
                calGoal={calGoal}
                waterGoal={waterGoal}
                macroProtein={macroProtein}
                macroCarbs={macroCarbs}
                macroFat={macroFat}
                calcFields={calcFields}
                calcWeight={calcWeight}
                calcHeight={calcHeight}
                calcAge={calcAge}
                calcResult={calcResult}
                onCalcFieldChange={(k, v) => setCalcFields(f => ({ ...f, [k]: v }))}
                onCalcWeightChange={setCalcWeight}
                onCalcHeightChange={setCalcHeight}
                onCalcAgeChange={setCalcAge}
                onCalGoalChange={v => sanitizeNumericSetting(v, calGoal, c => setCalGoal(c), 'calsync_goal', () => window.dispatchEvent(new Event('storage')), showToast)}
                onWaterGoalChange={v => sanitizeNumericSetting(v, waterGoal, w => setWaterGoal(w), 'dropsync_goal', () => window.dispatchEvent(new Event('storage')), showToast)}
                onMacroProteinChange={v => { setMacroProtein(v); saveMacro('calsync_goal_protein', v); }}
                onMacroCarbsChange={v => { setMacroCarbs(v); saveMacro('calsync_goal_carbs', v); }}
                onMacroFatChange={v => { setMacroFat(v); saveMacro('calsync_goal_fat', v); }}
                onSave={(kcal, water, prot, carbs, fat) => {
                    if (kcal) setAndSaveGoal(kcal);
                    if (water) setAndSaveWater(water);
                    if (prot !== undefined) { setMacroProtein(String(prot)); saveMacro('calsync_goal_protein', String(prot)); }
                    if (carbs !== undefined) { setMacroCarbs(String(carbs)); saveMacro('calsync_goal_carbs', String(carbs)); }
                    if (fat !== undefined) { setMacroFat(String(fat)); saveMacro('calsync_goal_fat', String(fat)); }
                    showToast('Changes Saved!');
                }}
                onClose={() => setGoalModalOpen(false)}
                showToast={showToast}
            />
        )}

        <ReportBugModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
        </>
    );
}

interface GoalModalProps {
    mode: 'set' | 'calc';
    onModeChange: (m: 'set'|'calc') => void;
    calGoal: string; waterGoal: string;
    macroProtein: string; macroCarbs: string; macroFat: string;
    calcFields: CalcFields;
    calcWeight: string; calcHeight: string; calcAge: string;
    calcResult: ReturnType<typeof runCalc>;
    onCalcFieldChange: (k: string, v: string) => void;
    onCalcWeightChange: (v: string) => void;
    onCalcHeightChange: (v: string) => void;
    onCalcAgeChange: (v: string) => void;
    onCalGoalChange: (v: string) => void;
    onWaterGoalChange: (v: string) => void;
    onMacroProteinChange: (v: string) => void;
    onMacroCarbsChange: (v: string) => void;
    onMacroFatChange: (v: string) => void;
    onSave: (kcal?: number, water?: number, prot?: number, carbs?: number, fat?: number) => void;
    onClose: () => void;
    showToast: (msg: string) => void;
}

function GoalModal({ mode, onModeChange, calGoal, waterGoal, macroProtein, macroCarbs, macroFat, calcFields, calcWeight, calcHeight, calcAge, calcResult, onCalcFieldChange, onCalcWeightChange, onCalcHeightChange, onCalcAgeChange, onCalGoalChange, onWaterGoalChange, onMacroProteinChange, onMacroCarbsChange, onMacroFatChange, onSave, onClose, showToast }: GoalModalProps) {
    const getNaturalHeight = useCallback(
        (measured: number) => mode === 'calc' ? Math.min(measured, window.innerHeight * 0.78) : measured,
        [mode],
    );
    const sheet = useDraggableSheet({ onClose, getNaturalHeight });

    useEffect(() => { sheet.open(); }, [sheet.open]);
    useEffect(() => { sheet.refreshHeight(); }, [mode, calcResult, sheet.refreshHeight]);

    const saveAndClose = (kcal?: number, water?: number, prot?: number, carbs?: number, fat?: number) => {
        onSave(kcal, water, prot, carbs, fat);
        sheet.close();
    };

    return (
        <div className="app-overlay" id="goalModalOverlay" ref={sheet.overlayRef} onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}>
            <div className="modal" id="goalModal" ref={sheet.modalRef}>
                <div className="modal-handle-zone" id="goalModalHandleZone" {...sheet.handleProps}><div className="modal-handle" /></div>
                <div className="modal-header">
                    <div className="modal-title" id="goalModalTitle">{mode === 'set' ? 'Set Calorie Goal' : 'Calculate Calorie Goal'}</div>
                </div>
                <div className="modal-body" id="goalModalBody">
                    {mode === 'set' && (
                        <div id="goalViewSet">
                            <div className="form-row">
                                <label className="form-label" style={{ color:'#5AC8FA' }}><i className="fa-solid fa-droplet" /> Daily Hydration Goal (ml)</label>
                                <div className="goal-manual-wrap">
                                    <input className="form-input" id="dsManualGoalInput" type="number" min={500} max={6000} placeholder="e.g. 2500" inputMode="numeric" value={waterGoal} onChange={e => onWaterGoalChange(e.target.value)} />
                                    <button className="option-btn active" id="dsManualGoalBtn" onClick={() => { const v = parseInt(waterGoal); if (v>=500&&v<=6000) { saveAndClose(undefined, v); } else showToast('Please enter a value between 500 and 6000 ml.'); }}>Set</button>
                                </div>
                            </div>
                            <div className="form-row">
                                <label className="form-label"><i className="fa-solid fa-bullseye" /> Daily Calorie Goal</label>
                                <div className="goal-manual-wrap">
                                    <input className="form-input" id="manualGoalInput" type="number" min={500} max={10000} placeholder="e.g. 2000" inputMode="numeric" value={calGoal} onChange={e => onCalGoalChange(e.target.value)} />
                                    <button className="option-btn active" id="manualGoalBtn" onClick={() => { const v = parseInt(calGoal); if (v>=500&&v<=10000) saveAndClose(v); else showToast('Please enter a value between 500 and 10000 kcal.'); }}>Set</button>
                                </div>
                            </div>
                            {[ {label:'Protein', color:'#30D158', icon:'fa-solid fa-dumbbell', key:'protein', val:macroProtein, max:500, set:onMacroProteinChange },
                                {label:'Carbs', color:'#FFD60A', icon:'fa-solid fa-wheat-awn', key:'carbs', val:macroCarbs, max:1000, set:onMacroCarbsChange },
                                {label:'Fat', color:'#FF6B35', icon:'fa-solid fa-droplet', key:'fat', val:macroFat, max:500, set:onMacroFatChange },
                            ].map(m => (
                                <div key={m.key} className="form-row">
                                    <label className="form-label" style={{ color:m.color }}><i className={m.icon} /> {m.label} (g/day)</label>
                                    <div className="goal-manual-wrap">
                                        <input className="form-input" id={`macroGoalInput_${m.key}`} type="number" min={0} max={m.max} placeholder={`e.g. ${m.key === 'protein' ? 150 : m.key === 'carbs' ? 250 : 70}`} inputMode="numeric" value={m.val} onChange={e => m.set(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(m.val)||0; m.set(String(v)); showToast('Changes Saved!'); }}} />
                                        <button className="option-btn active" id={`macroGoalBtn_${m.key}`} onClick={() => { const v = parseInt(m.val)||0; m.set(String(v)); showToast('Changes Saved!'); }}>Set</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {mode === 'calc' && (
                        <div id="goalViewCalc">
                            <GoalCalculator fields={calcFields} weight={calcWeight} height={calcHeight} age={calcAge} result={calcResult}
                                onFieldChange={onCalcFieldChange} onWeightChange={onCalcWeightChange} onHeightChange={onCalcHeightChange} onAgeChange={onCalcAgeChange}
                                actions={result => <div className="goal-apply-actions">
                                    <button className="confirm-btn" id="applyCalorieGoalBtn" aria-label="Apply calorie goal" onClick={() => saveAndClose(result.kcal, undefined, result.protein, result.carbs, result.fat)}><i className="fa-solid fa-fire-flame-curved" /></button>
                                    <button className="confirm-btn" id="applyHydrationGoalBtn" aria-label="Apply hydration goal" onClick={() => saveAndClose(undefined, result.hydration)}><i className="fa-solid fa-droplet" /></button>
                                    <button className="confirm-btn" id="applyBothGoalsBtn" aria-label="Apply both goals" onClick={() => saveAndClose(result.kcal, result.hydration, result.protein, result.carbs, result.fat)}><i className="fa-solid fa-fire-flame-curved" />&nbsp;+&nbsp;<i className="fa-solid fa-droplet" /></button>
                                </div>} />
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className={`option-btn${mode === 'set' ? ' active' : ''}`} id="goalModeSetBtn" aria-pressed={mode === 'set'} onClick={() => onModeChange('set')}>Set Manually</button>
                    <button className={`option-btn${mode === 'calc' ? ' active' : ''}`} id="goalModeCalcBtn" aria-pressed={mode === 'calc'} onClick={() => onModeChange('calc')}>Calculate</button>
                </div>
            </div>
        </div>
    );
}
