'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../_context/AuthContext';
import { pushSettings } from '../../_lib/sync';
import { supabase } from '../../_lib/supabase';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';

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

function applyTheme(theme: string) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('calsync_theme', theme);
    localStorage.setItem('dropsync_theme', theme);
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
    const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
    const [goalMode, setGoalMode] = useState<'set'|'calc'>('set');
    const [goalModalOpen, setGoalModalOpen] = useState(false);
    const sheet = useDraggableSheet({ onClose });
    const [theme, setTheme] = useState('dark');
    const [deleteWarn, setDeleteWarn] = useState(true);
    const [displayName, setDisplayName] = useState(false);
    const [splashEnabled, setSplashEnabled] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [aiEnabled, setAiEnabled] = useState(false);
    const [aiTermsAccepted, setAiTermsAccepted] = useState(false);
    const [aiApiKey, setAiApiKey] = useState('');
    const [apiKeyVisible, setApiKeyVisible] = useState(false);
    const [calGoal, setCalGoal] = useState('2000');
    const [waterGoal, setWaterGoal] = useState('2500');
    const [macroProtein, setMacroProtein] = useState('');
    const [macroCarbs, setMacroCarbs] = useState('');
    const [macroFat, setMacroFat] = useState('');

    useEffect(() => {
        setTheme(localStorage.getItem('calsync_theme') || 'dark');
        setDeleteWarn(localStorage.getItem('dropsync_delete_warning') !== 'false');
        setDisplayName(localStorage.getItem('calsync_display_name') === 'true');
        setSplashEnabled(localStorage.getItem('calsync_splash_enabled') === 'true');
        setFirstName(localStorage.getItem('calsync_first_name') || '');
        setAiEnabled(localStorage.getItem('calsync_ai_enabled') === 'true');
        setAiTermsAccepted(localStorage.getItem('calsync_ai_terms_accepted') === 'true');
        setAiApiKey(localStorage.getItem('calsync_ai_api_key') || '');
        setCalGoal(localStorage.getItem('calsync_goal') || '2000');
        setWaterGoal(localStorage.getItem('dropsync_goal') || '2500');
        setMacroProtein(localStorage.getItem('calsync_goal_protein') || '');
        setMacroCarbs(localStorage.getItem('calsync_goal_carbs') || '');
        setMacroFat(localStorage.getItem('calsync_goal_fat') || '');
    }, []);

    useEffect(() => {
        if (!user) { setProfile(null); return; }
        supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfile(data ?? null));
    }, [user?.id]);
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
        if (calcWeight && calcHeight && calcAge) {
        setCalcResult(runCalc(calcFields, parseFloat(calcWeight), parseFloat(calcHeight), parseFloat(calcAge)));
        } else { setCalcResult(null); }
    }, [calcFields, calcWeight, calcHeight, calcAge]);

    const syncSettings = async () => {
        if (!user) return;
        await pushSettings(user.id, {
            calorie_goal: parseInt(calGoal),
            protein_goal: parseInt(macroProtein) || 0,
            carbs_goal: parseInt(macroCarbs) || 0,
            fat_goal: parseInt(macroFat) || 0,
            goal_ml: parseInt(waterGoal),
        });
    };

    const setAndSaveGoal = (kcal: number) => {
        setCalGoal(String(kcal));
        localStorage.setItem('calsync_goal', String(kcal));
        window.dispatchEvent(new Event('storage'));
        syncSettings();
    };
    const setAndSaveWater = (ml: number) => {
        setWaterGoal(String(ml));
        localStorage.setItem('dropsync_goal', String(ml));
        window.dispatchEvent(new Event('storage'));
    };
    const saveMacro = (key: string, val: string) => {
        localStorage.setItem(key, val);
        window.dispatchEvent(new Event('storage'));
        syncSettings();
    };

    const handleTheme = (t: string) => { setTheme(t); applyTheme(t); };
    const handleDeleteWarn = () => { const n = !deleteWarn; setDeleteWarn(n); localStorage.setItem('dropsync_delete_warning', String(n)); };
    const handleDisplayName = () => { const n = !displayName; setDisplayName(n); localStorage.setItem('calsync_display_name', String(n)); };
    const handleSplashEnabled = () => { const n = !splashEnabled; setSplashEnabled(n); localStorage.setItem('calsync_splash_enabled', String(n)); };
    const handleSetFirstName = () => { localStorage.setItem('calsync_first_name', firstName); showToast('Changes Saved!'); };
    const handleAiToggle = () => { const n = !aiEnabled; setAiEnabled(n); localStorage.setItem('calsync_ai_enabled', String(n)); };
    const handleAiAccept = () => { setAiTermsAccepted(true); localStorage.setItem('calsync_ai_terms_accepted', 'true'); showToast('Terms accepted'); };
    const handleAiDecline = () => { setAiEnabled(false); setAiTermsAccepted(false); localStorage.setItem('calsync_ai_enabled', 'false'); showToast('AI Detection disabled'); };
    const handleSaveApiKey = () => {
        localStorage.setItem('calsync_ai_api_key', aiApiKey);
        showToast('Changes Saved!');
        setTimeout(() => location.reload(), 2222);
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
        const calEntries = JSON.parse(localStorage.getItem('calsync_v1') || '[]');
        const dsEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');

        const getDate = (entry: any): string => {
            return entry.date || entry.timestamp || entry.created_at || '';
        };

        const getAmount = (entry: any): number => {
            return entry.calories ?? entry.amount ?? entry.ml ?? 0;
        };

        const rows = [
            ...calEntries.map((entry: any) => ({
                date: getDate(entry),
                source: 'calorie',
                amount: getAmount(entry),
                notes: entry.notes || entry.foodName || ''
            })),
            ...dsEntries.map((entry: any) => ({
                date: getDate(entry),
                source: 'hydration',
                amount: getAmount(entry),
                notes: entry.notes || ''
            }))
        ];

        const validRows = rows.filter(row => row.date);

        if (validRows.length === 0) {
            showToast('No data to export.');
            return;
        }

        const headers = ['date', 'source', 'amount', 'notes'];
        const csvRows = [headers.join(',')];

        for (const row of validRows) {
            const values = headers.map(header => {
                const val = row[header as keyof typeof row];
                const escaped = String(val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        downloadFile('healthsync_export.csv', csvString, 'text/csv');
        showToast('All data exported as CSV');
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
        <div className="app-overlay" id="settingsOverlay" ref={sheet.overlayRef} onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}>
            <div className="modal" id="settingsModal" ref={sheet.modalRef}>
                <div className="modal-handle-zone" id="settingsHandleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title">Settings</div>
                </div>
                <div className="modal-body" id="settingsModalBody" style={{ overflowY: 'auto' }}>
                    <div className="modal-step active" id="settingsStep">
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
                                    <button id="accountLogoutBtn" className="settings-btn mgmnt-btn" style={{ margin: '8px 0 0', width: '100%' }} onClick={async () => { await logout(); showToast('Logged out'); sheet.close(); }}>Logout</button>
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
                            <div className="settings-section-body">
                                <div className="settings-toggle-row">
                                    <div className="settings-toggle-label">
                                        <span>Enable AI Detection</span>
                                        <span className="settings-toggle-sub">Allow HealthSync to use AI for food recognition</span>
                                    </div>
                                    <button className="app-toggle-switch" id="aiEnabledToggle" aria-pressed={String(aiEnabled) as 'true'|'false'} onClick={handleAiToggle} />
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
                                                    <li>By using this feature, you agree to <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener"><strong>Google&apos;s Gemini API Terms</strong></a>.</li>
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
                                                <button className="option-btn active" id="saveApiKeyBtn" style={{ width:'100%',borderRadius:'var(--radius-sm)',padding:'13px 16px',marginTop:'8px' }} onClick={handleSaveApiKey}><i className="fa-solid fa-floppy-disk" />Save API Key</button>
                                                {aiApiKey && <div className="ai-status-box" id="aiStatusBox"><i className="fa-solid fa-circle-check" /><span>AI Detection is active</span></div>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="settings-section">
                            <div className="settings-section-title">
                            <i className="fa-solid fa-flag-checkered"></i>
                                Calorie/Hydration Goal/s
                            </div>
                            <div className="settings-section-body">
                                <div className="goal-display-row" style={{ justifyContent: 'center', marginBottom: 4 }}>
                                    <span className="goal-display-val" id="currentGoalDisplay">{calGoal} kcal</span>
                                </div>
                                <div className="goal-display-row" style={{ justifyContent: 'center', marginBottom: 4 }}>
                                    <span className="goal-display-val" id="ds-currentGoalDisplay">
                                        {parseInt(waterGoal) >= 1000 ? (parseInt(waterGoal)/1000).toFixed(1).replace('.',',') + 'L' : waterGoal + ' ml'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <button className="option-btn" id="openSetGoalBtn" style={{ flex:1, borderRadius:'var(--radius-sm)', padding:'13px 16px' }} onClick={() => { setGoalMode('set'); setGoalModalOpen(true); }}>
                                        <i className="fa-solid fa-bullseye" style={{ marginRight:6 }} />Set Goal
                                    </button>
                                    <button className="option-btn" id="openCalcGoalBtn" style={{ flex:1, borderRadius:'var(--radius-sm)', padding:'13px 16px' }} onClick={() => { setGoalMode('calc'); setGoalModalOpen(true); }}>
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
                        <div className="settings-section-body">
                            <div className="settings-toggle-row">
                                <div className="settings-toggle-label">
                                    <span>Delete entry warning (HealthSync)</span>
                                    <span className="settings-toggle-sub">Show a confirmation before deleting entries</span>
                                </div>
                                <button className="app-toggle-switch" id="deleteWarningToggle" aria-pressed={String(deleteWarn) as 'true'|'false'} onClick={handleDeleteWarn} />
                            </div>
                            <div className="settings-toggle-row">
                                <div className="settings-toggle-label">
                                    <span>Show splash screen on startup</span>
                                    <span className="settings-toggle-sub">Display the loading screen when the app opens</span>
                                </div>
                                <button className="app-toggle-switch" id="splashScreenToggle" aria-pressed={String(splashEnabled) as 'true'|'false'} onClick={handleSplashEnabled} />
                            </div>
                            <div className="settings-toggle-row">
                                <div className="settings-toggle-label">
                                    <span>Show name on start</span>
                                    <span className="settings-toggle-sub">Displays a welcome message instead of the app name</span>
                                    <div className="form-row">
                                        <label className="form-label" htmlFor="firstName">First Name:</label>
                                        <div className="flex-container gap-10px">
                                            <input className="form-input" name="firstName" id="firstName" type="text" autoComplete="given-name"
                                            value={firstName} onChange={e => setFirstName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSetFirstName(); }} />
                                            <button className="option-btn active" id="setFirstNameBtn" style={{ borderRadius:'var(--radius-sm)', padding:'13.5px 16px' }} onClick={handleSetFirstName}>Set</button>
                                        </div>
                                    </div>
                                </div>
                                <button className="app-toggle-switch" id="displayNameOnStart" aria-pressed={String(displayName) as 'true'|'false'} onClick={handleDisplayName} />
                            </div>
                            <div className="settings-toggle-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:12 }}>
                                <div className="settings-toggle-label">
                                    <span>App Theme</span>
                                    <span className="settings-toggle-sub">Choose a color theme for the app</span>
                                </div>
                                <div className="theme-picker" id="themePicker">
                                    {THEMES.map(t => (
                                        <div key={t.id} className={`theme-option${theme === t.id ? ' active' : ''}`} data-theme={t.id} onClick={() => handleTheme(t.id)}>
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
                                        <a className="link" href="https://github.com/itsmarianmc/projects/tree/main/dropsync" target="_blank" rel="noopener">
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
                                <p><a href="https://contact.itsmarian.dev/">Contact</a> • <a href="https://itsmarian.dev/legal/cookies">Cookies</a> • <a href="https://itsmarian.dev/legal/privacy">Privacy Policy</a> • <a href="https://itsmarian.dev/legal/terms">Terms of Use</a></p>
                                <p className="change-settings">Change Cookie Preferences</p>
                                <p style={{ marginTop: 'calc(1rem - 7.5px)' }}>© 2026 itsmarian | All rights reserved!</p>
                            </footer>
                        </div>
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
                onCalGoalChange={v => { setCalGoal(v); localStorage.setItem('calsync_goal', v); window.dispatchEvent(new Event('storage')); }}
                onWaterGoalChange={v => { setWaterGoal(v); localStorage.setItem('dropsync_goal', v); window.dispatchEvent(new Event('storage')); }}
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
                            <div className="form-row"><label className="form-label"><i className="fa-solid fa-temperature-low" /> Climate (for hydration)</label><OptionGroup id="hydrationClimate" val={calcFields.hydrationClimate} opts={[{label:'Cool',v:'cool'},{label:'Mild',v:'mild'},{label:'Warm',v:'warm'},{label:'Hot',v:'hot'}]} onChange={v => onCalcFieldChange('hydrationClimate', v)} /></div>
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