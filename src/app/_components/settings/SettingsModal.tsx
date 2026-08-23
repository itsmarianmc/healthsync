'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../_context/AuthContext';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import { pushSettings } from '../../_lib/sync';
import { supabase } from '../../_lib/supabase';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { calcSupplements, persistSupplementGoals } from '../../_lib/supplements';
import { reverseGeocodeLocation } from '../../_lib/location';
import { validateApiKey } from '../../_lib/gemini';
import { APP_VERSION } from '../../_lib/release';
import { writeLocalLastSeen, writePendingReloadAfterUpdate } from '../../_lib/changelog';
import { Serwist } from '@serwist/window';
import ReportBugModal from './ReportBugModal';

type SerwistWindow = Window & {
    serwist?: Serwist;
};

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenNotes: () => void;
}

type CalcFields = { gender: string; activity: string; goalType: string; hydrationClimate: string };

const EASE = 'cubic-bezier(0.34, 1.15, 0.64, 1)';

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

function runCalc(fields: CalcFields, w: number, h: number, age: number) {
    if (!w || !h || !age) return null;
    let bmr = fields.gender === 'male' ? 10*w + 6.25*h - 5*age + 5 : 10*w + 6.25*h - 5*age - 161;
    const actMap: Record<string, number> = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 };
    let tdee = bmr * (actMap[fields.activity] || 1.2);
    if (fields.goalType === 'lose') tdee -= 500; else if (fields.goalType === 'gain') tdee += 500;
    const kcal = Math.round(tdee);
    const protein = Math.round(kcal * 0.30 / 4);
    const carbs   = Math.round(kcal * 0.40 / 4);
    const fat     = Math.round(kcal * 0.30 / 9);
    let hydration = w * 24.33333333333333;
    if (fields.gender === 'male') hydration += 150;
    if (fields.gender === 'pregnant') hydration += 300;
    if (fields.gender === 'breastfeeding') hydration += 700;
    const actHyd: Record<string,number> = { light:150, moderate:300, active:700, very_active:700 };
    hydration += (actHyd[fields.activity] || 0);
    const climateAdd: Record<string,number> = { cool:0, mild:200, warm:450, hot:650 };
    hydration += (climateAdd[fields.hydrationClimate] || 0);
    return { kcal, protein, carbs, fat, hydration: Math.round(hydration) };
}

export default function SettingsModal({ isOpen, onClose, onOpenNotes }: SettingsModalProps) {
    const { user, logout, showToast, syncEnabled } = useAuth();
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
    }, [canUsePreferences]);

    useEffect(() => {
        if (!canUseThirdParty) {
            setAiEnabled(false);
            setAiTermsAccepted(false);
            setAiApiKey('');
            return;
        }
        setAiEnabled(localStorage.getItem('calsync_ai_enabled') === 'true');
        setAiTermsAccepted(localStorage.getItem('calsync_ai_terms_accepted') === 'true');
        setAiApiKey(localStorage.getItem('calsync_ai_api_key') || '');
    }, [canUseThirdParty]);

    useEffect(() => {
        try {
            setUpdateAvailable(localStorage.getItem('healthsync_update_available') === 'true');
        } catch (error) {
            console.log('[settings] localStorage read error:', error);
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
    }, [canUsePreferences]);

    useEffect(() => {
        if (!user) { setProfile(null); return; }
        supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
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
            pushSettings(user.id, {
                weight_kg: w,
                creatine_goal: goals?.creatine_g ?? null,
                magnesium_goal: goals?.magnesium_mg ?? null,
            }).catch(() => {});
        }
    }, [calcWeight, user, canUsePreferences]);

    const syncSettings = async () => {
        if (!user || !canUsePreferences) return;
        const payload: Record<string, unknown> = { user_id: user.id };
        const calorieGoal = parseInt(calGoal);
        if (!isNaN(calorieGoal)) payload.calorie_goal = calorieGoal;
        const protein = parseInt(macroProtein);
        if (!isNaN(protein)) payload.protein_goal = protein;
        const carbs = parseInt(macroCarbs);
        if (!isNaN(carbs)) payload.carbs_goal = carbs;
        const fat = parseInt(macroFat);
        if (!isNaN(fat)) payload.fat_goal = fat;
        const waterMl = parseInt(waterGoal);
        if (!isNaN(waterMl)) payload.goal_ml = waterMl;
        await pushSettings(user.id, payload);
    };

    const setAndSaveGoal = (kcal: number) => {
        setCalGoal(String(kcal));
        if (canUsePreferences) {
            localStorage.setItem('calsync_goal', String(kcal));
            window.dispatchEvent(new Event('storage'));
            syncSettings();
        }
    };
    const setAndSaveWater = (ml: number) => {
        setWaterGoal(String(ml));
        if (canUsePreferences) {
            localStorage.setItem('dropsync_goal', String(ml));
            window.dispatchEvent(new Event('storage'));
        }
    };
    const saveMacro = (key: string, val: string) => {
        if (canUsePreferences) {
            localStorage.setItem(key, val);
            window.dispatchEvent(new Event('storage'));
            syncSettings();
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
            if (user) pushSettings(user.id, { track_supplements: n }).catch(() => {});
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
        localStorage.setItem('calsync_ai_enabled', String(n));
    };
    const handleAiAccept = () => {
        if (!canUseThirdParty) return;
        setAiTermsAccepted(true);
        localStorage.setItem('calsync_ai_terms_accepted', 'true');
        showToast('Terms accepted');
    };
    const handleAiDecline = () => {
        setAiEnabled(false);
        setAiTermsAccepted(false);
        if (canUseThirdParty) {
            localStorage.setItem('calsync_ai_enabled', 'false');
        }
        showToast('AI Detection disabled');
    };
    const handleSaveApiKey = async () => {
        if (!canUseThirdParty) return;

        const trimmed = aiApiKey.trim();
        if (!trimmed) { showToast('Please enter your Gemini API key.'); return; }

        showToast('Validating API key…');
        const valid = await validateApiKey(trimmed);
        if (!valid) {
            showToast('Invalid API key – please check and try again.');
            return;
        }

        localStorage.setItem('calsync_ai_api_key', trimmed);
        window.dispatchEvent(new Event('storage'));
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

        const csvEscape = (v: unknown): string => {
            if (v === null || v === undefined) return '';
            const s = typeof v === 'string' ? v : String(v);
            if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
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
        } catch (error) {
            console.log('[settings] registration lookup error:', error);
        }

        writeLocalLastSeen(APP_VERSION);

        if (!registration?.waiting) {
            writePendingReloadAfterUpdate(false);
            setUpdateAvailable(false);
            try {
                localStorage.setItem('healthsync_update_available', 'false');
            } catch (error) {
                console.log('[settings] localStorage write error:', error);
            }
            window.dispatchEvent(new CustomEvent('healthsync:update-available-changed', { detail: false }));
            window.location.reload();
            return;
        }

        writePendingReloadAfterUpdate(true);
        globalWindow.serwist?.messageSkipWaiting();
    };

    const deleteAllData = () => {
        if (!confirm('Delete ALL data? This cannot be undone.')) return;
        localStorage.removeItem('calsync_v1');
        localStorage.removeItem('dropsync_v3');
        window.dispatchEvent(new Event('storage'));
        showToast('All data deleted');
        sheet.close();
    };

    const OptionGroup = ({ id, val, opts, onChange }: { id: string; val: string; opts: { label: string; v: string }[]; onChange: (v: string) => void }) => (
        <div className="option-group" id={id}>
            {opts.map(o => <button key={o.v} className={`option-btn${val === o.v ? ' active' : ''}`} data-val={o.v} onClick={() => onChange(o.v)}>{o.label}</button>)}
        </div>
    );

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
                                    onClick={() => { sheet.close(); window.location.href = '/login'; }}>
                                    <i className="fas fa-user" /> Manage Account
                                </button>
                            </div>
                        )}
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
                                <p>AI Detection uses Google's Gemini API to analyze food images and estimate nutrition values. This feature is experimental and requires your own API key. Important nutrition information should be verified. Results may be inaccurate or inconsistent. Use at your own risk.</p>
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
                                            {aiApiKey && <div className="ai-status-box" id="aiStatusBox"><i className="fa-solid fa-circle-check" /><span>AI Detection is active</span></div>}
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
                                            } catch (err) {
                                                console.warn('Use Location (settings) failed', err);
                                                showToast('Unable to get location');
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
                            <p style={{ marginTop: 'calc(1rem - 7.5px)' }}>© 2026 itsmarian | All rights reserved!</p>
                        </footer>
                    </div>
                </div>
            </div>
        </div>

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
                    setGoalModalOpen(false);
                }}
                onClose={() => setGoalModalOpen(false)}
                showToast={showToast}
                OptionGroup={({ id, val, opts, onChange }) => (
                    <div className="option-group" id={id}>
                    {opts.map((o: { label: string; v: string }) => (
                        <button key={o.v} className={`option-btn${val === o.v ? ' active' : ''}`} data-val={o.v} onClick={() => onChange(o.v)}>{o.label}</button>
                    ))}
                    </div>
                )}
                />
            )}
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
                        <p className="delete-account-warning">This action is permanent and cannot be undone. Deleting your account will erase everything you've built in HealthSync, including all your cloud data, every meal logged, your complete hydration history, all exercise and workout logs, your health metrics, and every progress you've made until now.</p>
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
                                    const json = await res.json();
                                    if (!json.ok) { showToast(json.error || 'Delete failed'); return; }
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
    OptionGroup: (props: { id: string; val: string; opts: { label: string; v: string }[]; onChange: (v: string) => void }) => React.ReactElement;
}

function GoalModal({ mode, onModeChange, calGoal, waterGoal, macroProtein, macroCarbs, macroFat, calcFields, calcWeight, calcHeight, calcAge, calcResult, onCalcFieldChange, onCalcWeightChange, onCalcHeightChange, onCalcAgeChange, onCalGoalChange, onWaterGoalChange, onMacroProteinChange, onMacroCarbsChange, onMacroFatChange, onSave, onClose, showToast, OptionGroup }: GoalModalProps) {
    const goalModalRef = useRef<HTMLDivElement>(null);
    const goalOverlayRef = useRef<HTMLDivElement>(null);
    const gDragStartY = useRef(0); const gDragDY = useRef(0); const gVel = useRef(0);
    const gDragLastY = useRef(0); const gLastTime = useRef(0); const gCapturing = useRef(false);

    const gSnapToClosed = useCallback(() => {
        if (!goalModalRef.current) return;
        const curH = goalModalRef.current.offsetHeight;
        goalModalRef.current.style.transition = 'none';
        goalModalRef.current.style.height = curH + 'px';
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!goalModalRef.current) return;
            goalModalRef.current.style.transition = 'transform 0.36s cubic-bezier(0.4,0,0.2,1)';
            goalModalRef.current.style.transform = 'translateY(110%)';
        }));
        if (goalOverlayRef.current) goalOverlayRef.current.classList.remove('visible');
        setTimeout(() => { onClose(); }, 400);
    }, [onClose]);

    useEffect(() => {
        if (!goalModalRef.current) return;
        goalModalRef.current.style.transition = 'none';
        goalModalRef.current.style.transform = 'translateY(100%)';
        if (goalOverlayRef.current) goalOverlayRef.current.classList.add('visible');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!goalModalRef.current) return;
            goalModalRef.current.style.transition = `transform 0.42s ${EASE}`;
            goalModalRef.current.style.transform = 'translateY(0)';
        }));
    }, []);

    const gHandlePointerDown = (e: React.PointerEvent) => {
        gDragStartY.current = e.clientY; gDragLastY.current = e.clientY;
        gVel.current = 0; gDragDY.current = 0;
        gLastTime.current = Date.now(); gCapturing.current = true;
        if (goalModalRef.current) goalModalRef.current.style.transition = 'none';
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
    const gHandlePointerMove = (e: React.PointerEvent) => {
        if (!gCapturing.current || !goalModalRef.current) return;
        const now = Date.now(); const dt = now - gLastTime.current;
        if (dt > 0) gVel.current = (e.clientY - gDragLastY.current) / dt * 1000;
        gDragLastY.current = e.clientY; gLastTime.current = now;
        const dy = e.clientY - gDragStartY.current; gDragDY.current = dy;
        if (dy > 0) goalModalRef.current.style.transform = `translateY(${dy}px)`;
    };
    const gHandlePointerUp = () => {
        if (!gCapturing.current) return; gCapturing.current = false;
        const dy = gDragDY.current; const v = gVel.current;
        if (dy > 90 || v > 700) gSnapToClosed();
        else {
            if (goalModalRef.current) {
                goalModalRef.current.style.transition = `transform 0.36s ${EASE}`;
                goalModalRef.current.style.transform = 'translateY(0)';
            }
        }
        gDragDY.current = 0;
    };

    return (
        <div className="app-overlay" id="goalModalOverlay" ref={goalOverlayRef} onClick={e => { if (e.target === goalOverlayRef.current) gSnapToClosed(); }}>
            <div className="modal" id="goalModal" ref={goalModalRef} style={{ maxHeight: 'calc(100dvh - 24px)' }}>
                <div className="modal-handle-zone" id="goalModalHandleZone" onPointerDown={gHandlePointerDown} onPointerMove={gHandlePointerMove} onPointerUp={gHandlePointerUp}><div className="modal-handle" /></div>
                <div className="modal-header">
                    <div className="modal-title" id="goalModalTitle">{mode === 'set' ? 'Set Calorie Goal' : 'Calculate Calorie Goal'}</div>
                </div>
                <div className="modal-body" id="goalModalBody" style={{ overflowY: 'auto' }}>
                    {mode === 'set' && (
                        <div id="goalViewSet">
                            <div className="form-row" style={{ marginTop:24 }}>
                                <label className="form-label" style={{ color:'#5AC8FA' }}><i className="fa-solid fa-droplet" /> Daily Hydration Goal (ml)</label>
                                <div className="goal-manual-wrap">
                                    <input className="form-input" id="dsManualGoalInput" type="number" min={500} max={6000} placeholder="e.g. 2500" inputMode="numeric" value={waterGoal} onChange={e => onWaterGoalChange(e.target.value)} />
                                    <button className="option-btn active" id="dsManualGoalBtn" onClick={() => { const v = parseInt(waterGoal); if (v>=500&&v<=6000) { onSave(undefined, v); } else showToast('Please enter a value between 500 and 6000 ml.'); }}>Set</button>
                                </div>
                            </div>
                            <div className="form-row">
                                <label className="form-label"><i className="fa-solid fa-bullseye" /> Daily Calorie Goal</label>
                                <div className="goal-manual-wrap">
                                    <input className="form-input" id="manualGoalInput" type="number" min={500} max={10000} placeholder="e.g. 2000" inputMode="numeric" value={calGoal} onChange={e => onCalGoalChange(e.target.value)} />
                                    <button className="option-btn active" id="manualGoalBtn" onClick={() => { const v = parseInt(calGoal); if (v>=500&&v<=10000) onSave(v); else showToast('Please enter a value between 500 and 10000 kcal.'); }}>Set</button>
                                </div>
                            </div>
                            {[ {label:'Protein', color:'#30D158', icon:'fa-solid fa-dumbbell', key:'protein', val:macroProtein, max:500, set:onMacroProteinChange },
                                {label:'Carbs', color:'#FFD60A', icon:'fa-solid fa-wheat-awn', key:'carbs', val:macroCarbs, max:1000, set:onMacroCarbsChange },
                                {label:'Fat', color:'#FF6B35', icon:'fa-solid fa-droplet', key:'fat', val:macroFat, max:500, set:onMacroFatChange },
                            ].map(m => (
                                <div key={m.key} className="form-row" style={{ marginTop:24 }}>
                                    <label className="form-label" style={{ color:m.color }}><i className={m.icon} /> {m.label} (g/day)</label>
                                    <div className="goal-manual-wrap">
                                        <input className="form-input" id={`macroGoalInput_${m.key}`} type="number" min={0} max={m.max} placeholder={`e.g. ${m.key === 'protein' ? 150 : m.key === 'carbs' ? 250 : 70}`} inputMode="numeric" value={m.val} onChange={e => m.set(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(m.val)||0; m.set(String(v)); showToast('Changes Saved!'); }}} />
                                        <button className="option-btn active" id={`macroGoalBtn_${m.key}`} onClick={() => { const v = parseInt(m.val)||0; m.set(String(v)); showToast('Changes Saved!'); }}>Set</button>
                                    </div>
                                </div>
                            ))}
                            <p className="form-helper" style={{ marginTop:12 }}><i className="fa-solid fa-circle-info" /> Set macros to 0 to hide progress bars on the home screen.</p>
                        </div>
                    )}
                    {mode === 'calc' && (
                        <div id="goalViewCalc">
                            <div className="form-row"><label className="form-label"><i className="fa-solid fa-weight-scale" /> Body weight (kg)</label><input className="form-input" id="calcWeight" type="number" min={20} max={300} placeholder="e.g. 70" inputMode="decimal" value={calcWeight} onChange={e => onCalcWeightChange(e.target.value)} /></div>
                            <div className="form-row"><label className="form-label"><i className="fa-solid fa-ruler" /> Height (cm)</label><input className="form-input" id="calcHeight" type="number" min={100} max={250} placeholder="e.g. 170" inputMode="numeric" value={calcHeight} onChange={e => onCalcHeightChange(e.target.value)} /></div>
                            <div className="form-row"><label className="form-label"><i className="fa-solid fa-cake-candles" /> Age</label><input className="form-input" id="calcAge" type="number" min={10} max={100} placeholder="e.g. 25" inputMode="numeric" value={calcAge} onChange={e => onCalcAgeChange(e.target.value)} /></div>
                            <div className="form-row"><label className="form-label"><i className="fa-solid fa-venus-mars" /> Gender</label><OptionGroup id="calcGender" val={calcFields.gender} opts={[{label:'Female',v:'female'},{label:'Male',v:'male'}]} onChange={v => onCalcFieldChange('gender', v)} /></div>
                            <div className="form-row"><label className="form-label"><i className="fa-solid fa-person-walking" /> Activity Level</label><OptionGroup id="calcActivity" val={calcFields.activity} opts={[{label:'Sedentary',v:'sedentary'},{label:'Light',v:'light'},{label:'Moderate',v:'moderate'},{label:'Active',v:'active'},{label:'Very Active',v:'very_active'}]} onChange={v => onCalcFieldChange('activity', v)} /></div>
                            <div className="form-row"><label className="form-label"><i className="fa-solid fa-chart-line" /> Goal</label><OptionGroup id="calcGoalType" val={calcFields.goalType} opts={[{label:'Maintain',v:'maintain'},{label:'Lose weight',v:'lose'},{label:'Gain weight',v:'gain'}]} onChange={v => onCalcFieldChange('goalType', v)} /></div>
                            <div className="form-row"><label className="form-label"><i className="fa-solid fa-temperature-low" /> Climate</label><OptionGroup id="hydrationClimate" val={calcFields.hydrationClimate} opts={[{label:'Cool',v:'cool'},{label:'Mild',v:'mild'},{label:'Warm',v:'warm'},{label:'Hot',v:'hot'}]} onChange={v => onCalcFieldChange('hydrationClimate', v)} /></div>
                            {calcResult && (
                                <>
                                    <div className="result-row" id="calcResultRow">
                                        <div className="result-label">Recommended daily calories</div>
                                        <div className="result-value" id="calcResultVal">{calcResult.kcal} kcal</div>
                                        <div className="macro-suggest-box">
                                            <div className="macro-suggest-title"><i className="fa-solid fa-chart-simple" /> Suggested macros (30 / 40 / 30 split)</div>
                                            <div className="macro-suggest-grid">
                                                <div className="macro-suggest-item"><div className="macro-suggest-value" id="calcSuggestProtein" style={{ color:'#30D158' }}>{calcResult.protein}g</div><div className="macro-suggest-label">Protein</div></div>
                                                <div className="macro-suggest-item"><div className="macro-suggest-value" id="calcSuggestCarbs" style={{ color:'#FFD60A' }}>{calcResult.carbs}g</div><div className="macro-suggest-label">Carbs</div></div>
                                                <div className="macro-suggest-item"><div className="macro-suggest-value" id="calcSuggestFat" style={{ color:'#FF6B35' }}>{calcResult.fat}g</div><div className="macro-suggest-label">Fat</div></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="result-row" id="hydrationResultRow" style={{ marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
                                        <div className="result-label"><i className="fa-solid fa-droplet" /> Recommended daily hydration</div>
                                        <div className="result-value" id="hydrationResultVal" style={{ color:'#5AC8FA' }}>{calcResult.hydration} ml</div>
                                    </div>
                                    <div style={{ display:'flex', gap:10, padding:'20px 10px', flexWrap:'wrap' }}>
                                        <button className="confirm-btn" id="applyCalorieGoalBtn" onClick={() => onSave(calcResult.kcal, undefined, calcResult.protein, calcResult.carbs, calcResult.fat)}><i className="fa-solid fa-fire-flame-curved" /></button>
                                        <button className="confirm-btn" id="applyHydrationGoalBtn" onClick={() => onSave(undefined, calcResult.hydration)}><i className="fa-solid fa-droplet" /></button>
                                        <button className="confirm-btn" id="applyBothGoalsBtn" onClick={() => onSave(calcResult.kcal, calcResult.hydration, calcResult.protein, calcResult.carbs, calcResult.fat)}><i className="fa-solid fa-fire-flame-curved" />&nbsp;+&nbsp;<i className="fa-solid fa-droplet" /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <div className="modal-footer" style={{ display:'flex', gap:8, padding:'12px 24px 24px' }}>
                    <button className="option-btn" id="goalModeSetBtn" style={{ flex:1 }} onClick={() => onModeChange('set')}>Set Manually</button>
                    <button className="option-btn" id="goalModeCalcBtn" style={{ flex:1 }} onClick={() => onModeChange('calc')}>Calculate</button>
                </div>
            </div>
        </div>
    );
}
