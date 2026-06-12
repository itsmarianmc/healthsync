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

    const exportCalJson = () => {
        const entries = JSON.parse(localStorage.getItem('calsync_v1') || '[]');
        downloadFile('calsync_export.json', JSON.stringify(entries, null, 2), 'application/json');
        showToast('JSON exported');
    };
    const exportCalCsv = () => {
        const entries = JSON.parse(localStorage.getItem('calsync_v1') || '[]');
        const header = 'id,food,brand,kcal,amount,unit,prot,carb,fat,date,time';
        const rows = entries.map((e: { id: string; food: string; brand?: string; kcal: number; amount?: number; unit?: string; prot?: number; carb?: number; fat?: number; ts: number; date: string }) => {
            const d = new Date(e.ts);
            const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            return [e.id, `"${e.food}"`, `"${e.brand||''}"`, e.kcal, e.amount, e.unit||'g', e.prot||0, e.carb||0, e.fat||0, e.date, time].join(',');
        });
        downloadFile('calsync_export.csv', [header, ...rows].join('\n'), 'text/csv');
        showToast('CSV exported');
    };
    const exportDsJson = () => {
        const entries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
        downloadFile('dropsync_export.json', JSON.stringify(entries, null, 2), 'application/json');
        showToast('DropSync JSON exported');
    };
    const exportDsCsv = () => {
        const entries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
        const header = 'id,drink,emoji,amount,date,time';
        const rows = entries.map((e: { id: string; drink: string; emoji?: string; amount: number; ts: number; date: string }) => {
            const d = new Date(e.ts);
            return [e.id, e.drink, e.emoji, e.amount, e.date, `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`].join(',');
        });
        downloadFile('dropsync_export.csv', [header, ...rows].join('\n'), 'text/csv');
        showToast('DropSync CSV exported');
    };
    const clearCalData = () => {
        if (!confirm('Delete ALL CalSync data?')) return;
        const all = JSON.parse(localStorage.getItem('calsync_v1') || '[]');
        const kept = all.filter((e: { isDrink?: boolean }) => e.isDrink);
        localStorage.setItem('calsync_v1', JSON.stringify(kept));
        window.dispatchEvent(new Event('storage'));
        showToast('CalSync data deleted');
        sheet.close();
    };
    const clearDsData = () => {
        if (!confirm('Delete all DropSync data?')) return;
        localStorage.removeItem('dropsync_v3');
        window.dispatchEvent(new Event('storage'));
        showToast('DropSync data deleted');
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
                                <svg width="20" height="20" viewBox="0 0 382.442 382.442" fill="currentColor"><path d="M378.133,129.175l-44.828-31.047l15.69-52.227c1.06-3.525,0.097-7.346-2.507-9.949c-2.604-2.602-6.424-3.566-9.947-2.506 l-52.229,15.691L253.265,4.309c-2.096-3.026-5.687-4.661-9.341-4.244c-3.657,0.412-6.792,2.8-8.162,6.216l-20.294,50.615 l-54.406-3.677c-3.679-0.25-7.184,1.54-9.142,4.656s-2.047,7.056-0.229,10.257l26.918,47.424l-36.798,40.248 c-2.482,2.716-3.273,6.577-2.059,10.05c1.216,3.474,4.241,6,7.876,6.574l31.891,5.046L2.929,354.065 c-3.903,3.904-3.903,10.236,0,14.143l11.307,11.305c1.951,1.952,4.512,2.93,7.069,2.93c2.561,0,5.119-0.978,7.071-2.93 l176.592-176.592l5.046,31.891c0.575,3.636,3.103,6.66,6.574,7.877c3.473,1.217,7.335,0.425,10.051-2.06l40.247-36.798 l47.423,26.918c3.201,1.816,7.144,1.729,10.258-0.229c3.115-1.959,4.904-5.47,4.656-9.142l-3.676-54.407l50.614-20.294 c3.416-1.37,5.804-4.505,6.216-8.162C382.789,134.859,381.159,131.271,378.133,129.175z M296.8,141.963 c-4.021,1.613-6.548,5.632-6.256,9.956l1.851,27.401l-23.882-13.556c-3.769-2.139-8.485-1.607-11.684,1.316l-20.271,18.531 l-4.293-27.124c-0.677-4.28-4.031-7.637-8.312-8.314l-27.125-4.293l18.531-20.268c2.925-3.198,3.456-7.916,1.315-11.685 l-13.557-23.881l27.398,1.85c4.319,0.295,8.345-2.233,9.956-6.255l10.22-25.487l15.636,22.574 c2.467,3.562,6.944,5.13,11.098,3.883l26.305-7.903l-7.902,26.304c-1.246,4.15,0.32,8.631,3.884,11.099l22.573,15.634 L296.8,141.963z"/></svg>
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
                                    <p>AI Detection uses Google&apos;s Gemini API to analyze food images and estimate nutrition values. This feature is experimental and requires your own API key.</p>
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
                                <svg height="20" viewBox="0 -960 960 960" width="20" fill="#ffffff"><path d="M360-720h80v-80h-80v80Zm160 0v-80h80v80h-80ZM360-400v-80h80v80h-80Zm320-160v-80h80v80h-80Zm0 160v-80h80v80h-80Zm-160 0v-80h80v80h-80Zm160-320v-80h80v80h-80Zm-240 80v-80h80v80h-80ZM200-160v-640h80v80h80v80h-80v80h80v80h-80v320h-80Zm400-320v-80h80v80h-80Zm-160 0v-80h80v80h-80Zm-80-80v-80h80v80h-80Zm160 0v-80h80v80h-80Zm80-80v-80h80v80h-80Z"/></svg>
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
                                <svg width="20" height="20" viewBox="0 0 382.442 382.442" fill="currentColor"><path d="M378.133,129.175l-44.828-31.047l15.69-52.227c1.06-3.525,0.097-7.346-2.507-9.949c-2.604-2.602-6.424-3.566-9.947-2.506 l-52.229,15.691L253.265,4.309c-2.096-3.026-5.687-4.661-9.341-4.244c-3.657,0.412-6.792,2.8-8.162,6.216l-20.294,50.615 l-54.406-3.677c-3.679-0.25-7.184,1.54-9.142,4.656s-2.047,7.056-0.229,10.257l26.918,47.424l-36.798,40.248 c-2.482,2.716-3.273,6.577-2.059,10.05c1.216,3.474,4.241,6,7.876,6.574l31.891,5.046L2.929,354.065 c-3.903,3.904-3.903,10.236,0,14.143l11.307,11.305c1.951,1.952,4.512,2.93,7.069,2.93c2.561,0,5.119-0.978,7.071-2.93 l176.592-176.592l5.046,31.891c0.575,3.636,3.103,6.66,6.574,7.877c3.473,1.217,7.335,0.425,10.051-2.06l40.247-36.798 l47.423,26.918c3.201,1.816,7.144,1.729,10.258-0.229c3.115-1.959,4.904-5.47,4.656-9.142l-3.676-54.407l50.614-20.294 c3.416-1.37,5.804-4.505,6.216-8.162C382.789,134.859,381.159,131.271,378.133,129.175z M296.8,141.963 c-4.021,1.613-6.548,5.632-6.256,9.956l1.851,27.401l-23.882-13.556c-3.769-2.139-8.485-1.607-11.684,1.316l-20.271,18.531 l-4.293-27.124c-0.677-4.28-4.031-7.637-8.312-8.314l-27.125-4.293l18.531-20.268c2.925-3.198,3.456-7.916,1.315-11.685 l-13.557-23.881l27.398,1.85c4.319,0.295,8.345-2.233,9.956-6.255l10.22-25.487l15.636,22.574 c2.467,3.562,6.944,5.13,11.098,3.883l26.305-7.903l-7.902,26.304c-1.246,4.15,0.32,8.631,3.884,11.099l22.573,15.634 L296.8,141.963z"/></svg>
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
                            <svg height="20" viewBox="0 -960 960 960" width="20" fill="#ffffff"><path d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM565-275q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z"/></svg>
                            Data
                        </div>
                        <div className="settings-section-body" style={{ gap:8, display:'flex', flexDirection:'column' }}>
                            <button className="data-btn" id="exportJsonBtn" onClick={exportCalJson}><svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>Export Calsync data (JSON)</button>
                            <button className="data-btn" id="exportCsvBtn" onClick={exportCalCsv}><svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm240-240H200v160h240v-160Zm80 0v160h240v-160H520Zm-80-80v-160H200v160h240Zm80 0h240v-160H520v160ZM200-680h560v-80H200v80Z"/></svg>Export Calsync data (CSV)</button>
                            <button className="data-btn danger" id="clearDataBtn" onClick={clearCalData}><svg height="20" viewBox="0 -960 960 960" width="20" fill="#FF453A"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>Delete all Calsync data</button>
                            <div className="divider" />
                            <button className="data-btn" id="ds-exportJsonBtn" onClick={exportDsJson}><svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>Export Dropsync data (JSON)</button>
                            <button className="data-btn" id="ds-exportCsvBtn" onClick={exportDsCsv}><svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm240-240H200v160h240v-160Zm80 0v160h240v-160H520Zm-80-80v-160H200v160h240Zm80 0h240v-160H520v160ZM200-680h560v-80H200v80Z"/></svg>Export Dropsync data (CSV)</button>
                            <button className="data-btn danger" id="ds-clearDataBtn" onClick={clearDsData}><svg height="20" viewBox="0 -960 960 960" width="20" fill="#FF453A"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>Delete all Dropsync data</button>
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
                            <p style={{ marginTop:8 }}><a id="openNotes" onClick={e => { e.preventDefault(); sheet.close(); setTimeout(onOpenNotes, 200); }}>About / Licenses</a></p>
                            <footer />
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
                                {label:'Carbs',   color:'#FFD60A', icon:'fa-solid fa-wheat-awn', key:'carbs',   val:macroCarbs,   max:1000, set:onMacroCarbsChange },
                                {label:'Fat',     color:'#FF6B35', icon:'fa-solid fa-droplet',   key:'fat',     val:macroFat,     max:500,  set:onMacroFatChange },
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
