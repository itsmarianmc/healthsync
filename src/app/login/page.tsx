'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../_lib/supabase';
import './styles.css';

type View = 'login' | 'register' | 'mfa' | 'setup2fa' | 'reset' | 'resetMfa' | 'confirm' | 'loggedIn';

interface AlertState { msg: string; type: 'error' | 'success' | 'info' | '' }
const EMPTY_ALERT: AlertState = { msg: '', type: '' };

function OtpInput({ id, onComplete }: { id: string; onComplete?: (code: string) => void }) {
    const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

    const getCode = () => refs.map(r => r.current?.value || '').join('');

    const handleInput = (idx: number) => {
        const val = refs[idx].current!.value.replace(/\D/g, '').slice(-1);
        refs[idx].current!.value = val;
        if (val && idx < 5) refs[idx + 1].current?.focus();
        if (getCode().length === 6 && onComplete) onComplete(getCode());
    };

    const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !refs[idx].current?.value && idx > 0) refs[idx - 1].current?.focus();
        if (e.key === 'ArrowLeft' && idx > 0) refs[idx - 1].current?.focus();
        if (e.key === 'ArrowRight' && idx < 5) refs[idx + 1].current?.focus();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (text.length === 6) {
            e.preventDefault();
            refs.forEach((r, i) => { if (r.current) r.current.value = text[i] || ''; });
            refs[5].current?.focus();
            if (onComplete) onComplete(text);
        }
    };

    return (
        <div className="otp-wrap" id={id}>
            {refs.map((ref, i) => (
                <input key={i} ref={ref} type="number" maxLength={1} min={0} max={9}
                autoComplete={i === 0 ? 'one-time-code' : undefined}
                onInput={() => handleInput(i)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                />
            ))}
        </div>
    );
}

function Alert({ alert }: { alert: AlertState }) {
    if (!alert.msg) return <div className="alert" />;
    return <div className={`alert ${alert.type} show`}>{alert.msg}</div>;
}

export default function LoginPage() {
    const [view, setView] = useState<View>('login');
    const [loading, setLoading] = useState(false);
    const [loginAlert, setLoginAlert] = useState<AlertState>(EMPTY_ALERT);
    const [registerAlert, setRegisterAlert] = useState<AlertState>(EMPTY_ALERT);
    const [mfaAlert, setMfaAlert] = useState<AlertState>(EMPTY_ALERT);
    const [setup2faAlert, setSetup2faAlert] = useState<AlertState>(EMPTY_ALERT);
    const [resetAlert, setResetAlert] = useState<AlertState>(EMPTY_ALERT);
    const [resetMfaAlert, setResetMfaAlert] = useState<AlertState>(EMPTY_ALERT);
    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

    const [pwStrength, setPwStrength] = useState<{ len: boolean; upper: boolean; num: boolean }>({ len: false, upper: false, num: false });
    const [showPwRules, setShowPwRules] = useState(false);
    const [showLoginPw, setShowLoginPw] = useState(false);
    const [showRegPw, setShowRegPw] = useState(false);
    const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);
    const [mfaRemember, setMfaRemember] = useState(false);
    const [qrUri, setQrUri] = useState<string | null>(null);
    const [totpSecret, setTotpSecret] = useState('');
    const [setup2FAMode, setSetup2FAMode] = useState<'setup' | 'test'>('setup');
    const [setupFactorId, setSetupFactorId] = useState<string | null>(null);
    const [showDisableModal, setShowDisableModal] = useState(false);
    const [disableAlert, setDisableAlert] = useState<AlertState>(EMPTY_ALERT);
    const [loggedInUser, setLoggedInUser] = useState<string>('');
    const [showChangePw, setShowChangePw] = useState(false);
    const [changePwStep, setChangePwStep] = useState<1 | 2>(1);
    const [changePwAlert, setChangePwAlert] = useState<AlertState>(EMPTY_ALERT);

    const mfaChallengeRef = useRef<string | null>(null);
    const mfaFactorRef = useRef<string | null>(null);
    const pendingEmailRef = useRef<string | null>(null);
    const resetMfaChallengeRef = useRef<string | null>(null);
    const resetMfaFactorRef = useRef<string | null>(null);
    const changePwChallengeRef = useRef<string | null>(null);
    const changePwFactorRef = useRef<string | null>(null);
    const qrRef = useRef<HTMLDivElement>(null);
    const otpMfaRef = useRef<{ getCode: () => string }>(null);
    const mfaInputRef = useRef<HTMLDivElement>(null);

    // Redirect if already logged in
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('keep_login_page') === 'true') {
            handleLoggedIn(session.user);
            } else {
            handleLoggedIn(session.user);
            }
        }
        });
    }, []);

    const getMfaTrustedEmails = () => {
        try { return JSON.parse(localStorage.getItem('mfa_trusted_emails') || '[]'); } catch { return []; }
    };
    const isMfaTrusted = (email: string) => getMfaTrustedEmails().includes(email.toLowerCase());
    const setMfaTrusted = (email: string) => {
        const list = getMfaTrustedEmails();
        const key = email.toLowerCase();
        if (!list.includes(key)) { list.push(key); localStorage.setItem('mfa_trusted_emails', JSON.stringify(list)); }
    };

    const handleLoggedIn = useCallback(async (user: { id?: string; email?: string; user_metadata?: Record<string, string> } | null) => {
        const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
        setLoggedInUser(name);
        setView('loggedIn');

        // Sync profile data (authenticated — session exists at this point)
        if (user?.id) {
            const profilePayload: Record<string, string> = { id: user.id };
            if (user.user_metadata?.display_name) profilePayload.display_name = user.user_metadata.display_name;
            if (user.user_metadata?.full_name)    profilePayload.full_name    = user.user_metadata.full_name;
            if (user.user_metadata?.avatar_url)   profilePayload.avatar_url   = user.user_metadata.avatar_url;
            supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' }).then(() => {});
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('keep_login_page') === 'true') return;

        // Redirect to app after 2.2s
        setTimeout(() => { window.location.href = '/dash?reload=true'; }, 2200);
    }, []);

    const doLogin = async () => {
        setLoginAlert(EMPTY_ALERT);
        const email = (document.getElementById('loginEmail') as HTMLInputElement).value.trim();
        const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
        if (!email || !password) return setLoginAlert({ msg: 'Please fill in all fields.', type: 'error' });

        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setLoading(false); return setLoginAlert({ msg: error.message, type: 'error' }); }

        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
        if (isMfaTrusted(email)) { setLoading(false); await handleLoggedIn(data.user); return; }
        setLoading(false);
        pendingEmailRef.current = email;
        await startMFAChallenge();
        return;
        }
        setLoading(false);
        await handleLoggedIn(data.user);
    };

    const startMFAChallenge = async () => {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (!totp) { await handleLoggedIn((await supabase.auth.getUser()).data.user); return; }
        const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (error) { setMfaAlert({ msg: error.message, type: 'error' }); return; }
        mfaChallengeRef.current = challenge.id;
        mfaFactorRef.current = totp.id;
        setView('mfa');
    };

    const doMFAVerify = async (code: string) => {
        if (code.length < 6) return setMfaAlert({ msg: 'Enter all 6 digits.', type: 'error' });
        setLoading(true);
        const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorRef.current!, challengeId: mfaChallengeRef.current!, code,
        });
        setLoading(false);
        if (error) return setMfaAlert({ msg: error.message, type: 'error' });
        if (mfaRemember && pendingEmailRef.current) setMfaTrusted(pendingEmailRef.current);
        const { data: { user } } = await supabase.auth.getUser();
        await handleLoggedIn(user);
    };

    const doRegister = async () => {
        setRegisterAlert(EMPTY_ALERT);
        const displayName = (document.getElementById('regDisplayName') as HTMLInputElement).value.trim();
        const fullName = (document.getElementById('regFullName') as HTMLInputElement).value.trim();
        const email = (document.getElementById('regEmail') as HTMLInputElement).value.trim();
        const password = (document.getElementById('regPassword') as HTMLInputElement).value;
        const confirm = (document.getElementById('regPasswordConfirm') as HTMLInputElement).value;
        const avatarRaw = (document.getElementById('regAvatar') as HTMLInputElement).value.trim();
        const avatarUrl = avatarRaw || null;
        if (avatarUrl) {
            try { new URL(avatarUrl); } catch { return setRegisterAlert({ msg: 'Please enter a valid URL for the avatar.', type: 'error' }); }
        }
        if (!displayName) return setRegisterAlert({ msg: 'Please enter a display name.', type: 'error' });
        if (!email || !email.includes('@')) return setRegisterAlert({ msg: 'Please enter a valid email.', type: 'error' });
        if (password.length < 8) return setRegisterAlert({ msg: 'Password must be at least 8 characters.', type: 'error' });
        if (!/[A-Z]/.test(password)) return setRegisterAlert({ msg: 'Password needs at least one uppercase letter.', type: 'error' });
        if (!/[0-9]/.test(password)) return setRegisterAlert({ msg: 'Password needs at least one number.', type: 'error' });
        if (password !== confirm) return setRegisterAlert({ msg: 'Passwords do not match.', type: 'error' });
        setLoading(true);
        const { data: signUpData, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName || displayName, display_name: displayName, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) } } });
        setLoading(false);
        if (error) return setRegisterAlert({ msg: error.message, type: 'error' });
        // Profile will be synced to the profiles table on first login (after email confirmation)
        setView('confirm');
    };

    const doReset = async () => {
        setResetAlert(EMPTY_ALERT);
        const email = (document.getElementById('resetEmail') as HTMLInputElement).value.trim();
        if (!email) return setResetAlert({ msg: 'Please enter your email.', type: 'error' });
        setLoading(true);
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.nextLevel === 'aal2') {
        pendingEmailRef.current = email;
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
            const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId: totp.id });
            if (!ce) { resetMfaChallengeRef.current = challenge.id; resetMfaFactorRef.current = totp.id; }
        }
        setLoading(false);
        setView('resetMfa');
        return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
        setLoading(false);
        if (error) return setResetAlert({ msg: error.message, type: 'error' });
        setResetAlert({ msg: 'Reset link sent! Check your inbox.', type: 'success' });
    };

    const doResetMFAVerify = async (code: string) => {
        if (code.length < 6) return setResetMfaAlert({ msg: 'Enter all 6 digits.', type: 'error' });
        setLoading(true);
        const { error } = await supabase.auth.mfa.verify({
        factorId: resetMfaFactorRef.current!, challengeId: resetMfaChallengeRef.current!, code,
        });
        if (error) { setLoading(false); return setResetMfaAlert({ msg: error.message, type: 'error' }); }
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(pendingEmailRef.current || '', { redirectTo: `${window.location.origin}/login` });
        setLoading(false);
        if (resetErr) return setResetMfaAlert({ msg: resetErr.message, type: 'error' });
        setResetMfaAlert({ msg: 'Reset link sent! Check your inbox.', type: 'success' });
    };

    const show2FASetupOffer = async () => {
        setSetup2faAlert(EMPTY_ALERT);
        setQrUri(null);
        setView('setup2fa');
        const { data: existingFactors } = await supabase.auth.mfa.listFactors();
        const existingTotp = existingFactors?.totp?.find(f => f.status === 'verified');
        if (existingTotp) {
        setSetupFactorId(existingTotp.id);
        setSetup2FAMode('test');
        setSetup2faAlert({ msg: '2FA is already set up. You can test your code here.', type: 'info' });
        return;
        }
        const unverified = existingFactors?.totp?.filter(f => f.status !== 'verified') || [];
        for (const f of unverified) await supabase.auth.mfa.unenroll({ factorId: f.id });
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'HealthSync' });
        if (error) { setSetup2faAlert({ msg: error.message, type: 'error' }); return; }
        setSetupFactorId(data.id);
        setSetup2FAMode('setup');
        setTotpSecret(data.totp.secret);
        setQrUri(data.totp.uri);
    };

    const doSetup2FA = async (code: string) => {
        if (code.length < 6) return setSetup2faAlert({ msg: 'Enter all 6 digits.', type: 'error' });
        setLoading(true);
        const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: setupFactorId! });
        const { error } = await supabase.auth.mfa.verify({ factorId: setupFactorId!, challengeId: challenge!.id, code });
        setLoading(false);
        if (error) { setSetup2faAlert({ msg: error.message, type: 'error' }); return; }
        setSetup2faAlert({ msg: setup2FAMode === 'test' ? 'Code correct! 2FA is working. ✅' : '2FA enabled successfully! 🎉', type: 'success' });
    };

    const confirmDisable2FA = async (code: string) => {
        if (!setupFactorId || code.length < 6) return;
        setLoading(true);
        const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId: setupFactorId });
        if (ce) { setDisableAlert({ msg: ce.message, type: 'error' }); setLoading(false); return; }
        const { error: ve } = await supabase.auth.mfa.verify({ factorId: setupFactorId, challengeId: challenge!.id, code });
        if (ve) { setDisableAlert({ msg: 'Invalid code. Please try again.', type: 'error' }); setLoading(false); return; }
        const { error: ue } = await supabase.auth.mfa.unenroll({ factorId: setupFactorId });
        setLoading(false);
        if (ue) { setDisableAlert({ msg: 'Failed to disable 2FA: ' + ue.message, type: 'error' }); return; }
        setSetupFactorId(null);
        setShowDisableModal(false);
        setSetup2faAlert({ msg: '2FA has been disabled successfully.', type: 'success' });
        setTimeout(() => show2FASetupOffer(), 2000);
    };

    const doChangePassword = async (code: string) => {
        if (code.length < 6) return setChangePwAlert({ msg: 'Enter all 6 digits.', type: 'error' });
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find(f => f.status === 'verified');
        if (!totp) { setChangePwStep(2); return; }
        setLoading(true);
        const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (ce) { setChangePwAlert({ msg: ce.message, type: 'error' }); setLoading(false); return; }
        const { error: ve } = await supabase.auth.mfa.verify({ factorId: totp.id, challengeId: challenge!.id, code });
        setLoading(false);
        if (ve) { setChangePwAlert({ msg: 'Invalid code.', type: 'error' }); return; }
        setChangePwStep(2);
        setChangePwAlert(EMPTY_ALERT);
    };

    const doChangePasswordSubmit = async () => {
        const newPw = (document.getElementById('newPassword') as HTMLInputElement)?.value;
        const confirmPw = (document.getElementById('confirmNewPassword') as HTMLInputElement)?.value;
        if (!newPw || newPw.length < 8) return setChangePwAlert({ msg: 'Password must be at least 8 characters.', type: 'error' });
        if (newPw !== confirmPw) return setChangePwAlert({ msg: 'Passwords do not match.', type: 'error' });
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password: newPw });
        setLoading(false);
        if (error) return setChangePwAlert({ msg: error.message, type: 'error' });
        setChangePwAlert({ msg: 'Password changed successfully!', type: 'success' });
        setTimeout(() => { setShowChangePw(false); setChangePwStep(1); setChangePwAlert(EMPTY_ALERT); }, 2000);
    };

    const openChangePw = async () => {
        setChangePwAlert(EMPTY_ALERT);
        setChangePwStep(1);
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find(f => f.status === 'verified');
        if (!totp) { setChangePwStep(2); }
        setShowChangePw(true);
    };

    const checkPwStrength = (val: string) => {
        setPwStrength({ len: val.length >= 8, upper: /[A-Z]/.test(val), num: /[0-9]/.test(val) });
        if (val.length > 0) setShowPwRules(true);
    };

    const pwScore = [pwStrength.len, pwStrength.upper, pwStrength.num].filter(Boolean).length;
    const pwCls = ['', 'weak', 'medium', 'strong'][pwScore] || '';

    // QR Code rendering
    useEffect(() => {
        if (qrUri && qrRef.current) {
        qrRef.current.innerHTML = '';
        // Load QRCode.js dynamically if available
        if (typeof window !== 'undefined' && (window as typeof window & { QRCode?: new (el: HTMLElement, opts: Record<string, unknown>) => void }).QRCode) {
            new (window as typeof window & { QRCode: new (el: HTMLElement, opts: Record<string, unknown>) => void }).QRCode(qrRef.current, {
            text: qrUri, width: 160, height: 160, correctLevel: 1
            });
        } else {
            // Fallback: show the URI
            const link = document.createElement('a');
            link.href = qrUri;
            link.textContent = 'Open in authenticator';
            link.style.color = 'var(--accent)';
            qrRef.current.appendChild(link);
        }
        }
    }, [qrUri]);

    const goToApp = () => { window.location.href = '/dash?reload=true'; };
    const logoutUser = async () => { await supabase.auth.signOut(); setView('login'); setActiveTab('login'); };

    const eyeIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
    );
    const eyeOffIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
    );
    const mailIcon = <svg className="field-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
    const lockIcon = <svg className="field-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    const userIcon = <svg className="field-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    const backArrow = <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>;

    const renderRuleIcon = (ok: boolean) => ok
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/></svg>;

    return (
        <div className="page">
            <div className="logo">
                <img id="logoImg" src="/favicon.png" alt="HealthSync" width="44" height="44" />
                <span className="logo-name" id="logoName">Health<span>Sync</span></span>
            </div>
        <div className="card" id="mainCard">

            {/* Auth Section (Login / Register) */}
            {(view === 'login' || view === 'register') && (
            <div id="authSection">
                <div className="tabs">
                <button className={`tab${activeTab === 'login' ? ' active' : ''}`} onClick={() => { setActiveTab('login'); setView('login'); }}>Sign in</button>
                <button className={`tab${activeTab === 'register' ? ' active' : ''}`} onClick={() => { setActiveTab('register'); setView('register'); }}>Register</button>
                </div>

                {/* Login view */}
                {view === 'login' && (
                <div className="view active" id="viewLogin">
                    <div className="view-title">Welcome back 👋</div>
                    <div className="view-subtitle">Sign in with your email and password.</div>
                    <Alert alert={loginAlert} />
                    <div className="field">
                    <label>Email</label>
                    <div className="input-wrap">{mailIcon}<input type="email" id="loginEmail" placeholder="user@itsmarian.dev" autoComplete="email" /></div>
                    </div>
                    <div className="field">
                    <label>Password</label>
                    <div className="input-wrap">{lockIcon}
                        <input type={showLoginPw ? 'text' : 'password'} id="loginPassword" placeholder="Your password" autoComplete="current-password" onKeyDown={e => e.key === 'Enter' && doLogin()} />
                        <button className="toggle-pw" type="button" onClick={() => setShowLoginPw(v => !v)}>{showLoginPw ? eyeOffIcon : eyeIcon}</button>
                    </div>
                    </div>
                    <div style={{ textAlign: 'right', marginBottom: '1rem', marginTop: '-0.4rem' }}>
                    <button className="btn-link" onClick={() => setView('reset')}>Forgot password?</button>
                    </div>
                    <button className={`btn--primary${loading ? ' loading' : ''}`} id="loginBtn" onClick={doLogin} disabled={loading}>
                    <span className="btn-text">Sign in</span><div className="btn-loader" />
                    </button>
                </div>
                )}

                {/* Register view */}
                {view === 'register' && (
                <div className="view active" id="viewRegister">
                    <div className="view-title">Create account</div>
                    <div className="view-subtitle">Join Health<span>Sync</span> and start tracking today!</div>
                    <Alert alert={registerAlert} />
                    <div className="field">
                    <label>Display name</label>
                    <div className="input-wrap">{userIcon}<input type="text" id="regDisplayName" placeholder="johndoe" autoComplete="username" /></div>
                    </div>
                    <div className="field">
                    <label>Full name <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
                    <div className="input-wrap">{userIcon}<input type="text" id="regFullName" placeholder="John Doe" autoComplete="name" /></div>
                    </div>
                    <div className="field">
                    <label>Email</label>
                    <div className="input-wrap">{mailIcon}<input type="email" id="regEmail" placeholder="user@itsmarian.dev" autoComplete="email" /></div>
                    </div>
                    <div className="field">
                    <label>Password</label>
                    <div className="input-wrap">{lockIcon}
                        <input type={showRegPw ? 'text' : 'password'} id="regPassword" placeholder="Min. 8 characters" autoComplete="new-password" onInput={e => checkPwStrength((e.target as HTMLInputElement).value)} />
                        <button className="toggle-pw" type="button" onClick={() => setShowRegPw(v => !v)}>{showRegPw ? eyeOffIcon : eyeIcon}</button>
                    </div>
                    <div className="pw-strength">
                        <div className={`pw-bar${pwScore >= 1 ? ' ' + pwCls : ''}`} id="bar1" />
                        <div className={`pw-bar${pwScore >= 2 ? ' ' + pwCls : ''}`} id="bar2" />
                        <div className={`pw-bar${pwScore >= 3 ? ' ' + pwCls : ''}`} id="bar3" />
                    </div>
                    {showPwRules && (
                        <div className="pw-rules show" id="pwRules">
                        <div className={`pw-rule${pwStrength.len ? ' ok' : ''}`} id="rule-len">{renderRuleIcon(pwStrength.len)}At least 8 characters</div>
                        <div className={`pw-rule${pwStrength.upper ? ' ok' : ''}`} id="rule-upper">{renderRuleIcon(pwStrength.upper)}One uppercase letter (A - Z)</div>
                        <div className={`pw-rule${pwStrength.num ? ' ok' : ''}`} id="rule-num">{renderRuleIcon(pwStrength.num)}One number (0 - 9)</div>
                        </div>
                    )}
                    </div>
                    <div className="field">
                    <label>Confirm password</label>
                    <div className="input-wrap">{lockIcon}
                        <input type={showRegConfirmPw ? 'text' : 'password'} id="regPasswordConfirm" placeholder="Repeat your password" autoComplete="new-password" />
                        <button className="toggle-pw" type="button" onClick={() => setShowRegConfirmPw(v => !v)}>{showRegConfirmPw ? eyeOffIcon : eyeIcon}</button>
                    </div>
                    </div>
                    <div className="field">
                    <label>Avatar URL <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
                    <div className="input-wrap">
                        <i className="fa-solid fa-image" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                        <input type="url" id="regAvatar" placeholder="https://example.com/avatar.jpg" autoComplete="photo" style={{ paddingLeft: 40 }} />
                    </div>
                    </div>
                    <button className={`btn--primary${loading ? ' loading' : ''}`} id="registerBtn" onClick={doRegister} disabled={loading}>
                    <span className="btn-text">Create account</span><div className="btn-loader" />
                    </button>
                </div>
                )}
            </div>
            )}

            {/* MFA view */}
            {view === 'mfa' && (
            <div className="view active" id="viewMFA">
                <button className="back-link" onClick={() => setView('login')}>{backArrow}Back</button>
                <div className="view-title">Two-factor authentication</div>
                <div className="view-subtitle">Enter the 6-digit code from your authenticator app.</div>
                <Alert alert={mfaAlert} />
                <OtpInput id="otpWrap" onComplete={doMFAVerify} />
                <label className="remember-me-row">
                <input type="checkbox" id="mfaRememberMe" checked={mfaRemember} onChange={e => setMfaRemember(e.target.checked)} />
                <span>Don&apos;t ask again on this device</span>
                </label>
                <button className={`btn--primary${loading ? ' loading' : ''}`} id="mfaBtn" onClick={() => {
                const inputs = document.querySelectorAll<HTMLInputElement>('#otpWrap input');
                doMFAVerify([...inputs].map(i => i.value).join(''));
                }} disabled={loading}>
                <span className="btn-text">Confirm</span><div className="btn-loader" />
                </button>
            </div>
            )}

            {/* Setup 2FA view */}
            {view === 'setup2fa' && (
            <div className="view active" id="viewSetup2FA">
                <button className="back-link" onClick={() => setView('loggedIn')}>{backArrow}Back</button>
                <div className="view-title">
                    {setup2FAMode === 'test' ? <>Manage 2FA <span className="mfa-badge">Active</span></> : <>Set up 2FA <span className="mfa-badge">Recommended</span></>}
                </div>
                <div className="view-subtitle">
                    {setup2FAMode === 'test'
                        ? '2FA is already active. Enter your current code to test it, or disable 2FA below.'
                        : 'Scan the QR code with your authenticator app (e.g. Google Authenticator, Authy).'}
                </div>
                <Alert alert={setup2faAlert} />
                {qrUri && (
                    <div id="qrCodeContainer">
                        <div className="qr-wrapper"><div className="qr-container"><div id="qrCode" ref={qrRef} /></div></div>
                        <div className="secret-key" id="totpSecret" title="Click to copy" onClick={() => navigator.clipboard.writeText(totpSecret)}>{totpSecret}</div>
                    </div>
                )}
                {qrUri && <div style={{ fontSize: '0.85rem', color: 'var(--text2)', textAlign: 'center', marginBottom: '1rem' }}>Then enter the code to confirm:</div>}
                <OtpInput id="otpSetupWrap" onComplete={doSetup2FA} />
                <button className={`btn--primary${loading ? ' loading' : ''}`} id="setup2faBtn" onClick={() => {
                    const inputs = document.querySelectorAll<HTMLInputElement>('#otpSetupWrap input');
                    doSetup2FA([...inputs].map(i => i.value).join(''));
                    }} disabled={loading}>
                    <span className="btn-text">{setup2FAMode === 'test' ? 'Test code' : 'Enable 2FA'}</span><div className="btn-loader" />
                </button>
                <button className="btn-ghost" onClick={openChangePw} style={{ marginTop: '0.5rem' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Change password
                </button>
                {setup2FAMode === 'test' && (
                <button className="btn-ghost" id="disable2faBtn" onClick={() => setShowDisableModal(true)} style={{ marginTop: '0.5rem' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Disable 2FA
                </button>
                )}
            </div>
            )}

            {/* Reset MFA view */}
            {view === 'resetMfa' && (
                <div className="view active" id="viewResetMFA">
                    <button className="back-link" onClick={() => setView('reset')}>{backArrow}Back</button>
                    <div className="view-title">Confirm your identity</div>
                    <div className="view-subtitle">Enter your 2FA code to continue with the password reset.</div>
                    <Alert alert={resetMfaAlert} />
                    <OtpInput id="otpResetWrap" onComplete={doResetMFAVerify} />
                    <button className={`btn--primary${loading ? ' loading' : ''}`} id="resetMfaBtn" onClick={() => {
                    const inputs = document.querySelectorAll<HTMLInputElement>('#otpResetWrap input');
                    doResetMFAVerify([...inputs].map(i => i.value).join(''));
                    }} disabled={loading}>
                    <span className="btn-text">Confirm &amp; send reset link</span><div className="btn-loader" />
                    </button>
                </div>
            )}

            {/* Reset view */}
            {view === 'reset' && (
                <div className="view active" id="viewReset">
                    <button className="back-link" onClick={() => setView('login')}>{backArrow}Back</button>
                    <div className="view-title">Reset password</div>
                    <div className="view-subtitle">Enter your email and we&apos;ll send you a reset link.</div>
                    <Alert alert={resetAlert} />
                    <div className="field">
                    <label>Email</label>
                    <div className="input-wrap">{mailIcon}<input type="email" id="resetEmail" placeholder="user@itsmarian.dev" autoComplete="email" /></div>
                    </div>
                    <button className={`btn--primary${loading ? ' loading' : ''}`} id="resetBtn" onClick={doReset} disabled={loading}>
                    <span className="btn-text">Send link</span><div className="btn-loader" />
                    </button>
                </div>
            )}

            {/* Confirm view */}
            {view === 'confirm' && (
                <div className="view active" id="viewConfirm">
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><i className="fas fa-mailbox" /></div>
                    <div className="view-title">Check your inbox</div>
                    <div className="view-subtitle" style={{ marginBottom: '1.5rem' }}>
                        We sent you a confirmation email. Click the link inside to activate your account.
                    </div>
                    <button className="btn--primary" onClick={() => { setView('login'); setActiveTab('login'); }}>Go to sign in</button>
                    </div>
                </div>
            )}

            {/* Logged In view */}
            {view === 'loggedIn' && (
                <div className="view active" id="viewLoggedIn">
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><i className="fas fa-home" /></div>
                    <div className="view-title" id="loggedInTitle">Welcome back to Health<span>Sync</span>!</div>
                    <div className="view-subtitle" id="loggedInMsg" style={{ margin: 0, width: '100%' }}>
                        You are successfully signed in{loggedInUser ? ` as ${loggedInUser}` : ''}.
                    </div>
                    <button className="btn--primary" onClick={goToApp} style={{ marginTop: '2rem' }}>Go back to app</button>
                    <div className="divider">or</div>
                    <button className="btn-ghost" onClick={show2FASetupOffer} style={{ marginBottom: '0.5rem' }}>
                        <i className="fa-solid fa-lock" /> Set up / manage 2FA
                    </button>
                    <button className="btn--primary" onClick={logoutUser}>Logout</button>
                    </div>
                </div>
            )}
        </div>

        <div className="card-footer" id="mainFooter">
            <a href="/" style={{ color: 'var(--text2)', fontSize: '0.88rem', textDecoration: 'none' }}>Back to app</a>
        </div>

        {/* Disable 2FA Modal */}
        {showDisableModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={e => { if (e.target === e.currentTarget) setShowDisableModal(false); }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem', width: '100%', maxWidth: 380, boxShadow: 'var(--shadow)' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>Disable 2FA</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text2)', marginBottom: '1.4rem', lineHeight: 1.5 }}>Enter your current authenticator code to confirm. This will remove 2FA from your account.</div>
                <Alert alert={disableAlert} />
                <OtpInput id="otpDisableWrap" onComplete={confirmDisable2FA} />
                <button className={`btn--primary${loading ? ' loading' : ''}`} id="confirmDisableBtn" onClick={() => {
                const inputs = document.querySelectorAll<HTMLInputElement>('#otpDisableWrap input');
                confirmDisable2FA([...inputs].map(i => i.value).join(''));
                }} style={{ background: 'linear-gradient(135deg,#ff453a,#ff6b61)', marginTop: '1.2rem' }} disabled={loading}>
                <span className="btn-text">Confirm &amp; Disable</span><div className="btn-loader" />
                </button>
                <button className="btn-ghost" onClick={() => setShowDisableModal(false)} style={{ marginTop: '0.5rem' }}>Cancel</button>
            </div>
            </div>
        )}

        {/* Change Password Modal */}
        {showChangePw && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={e => { if (e.target === e.currentTarget) setShowChangePw(false); }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem', width: '100%', maxWidth: 380 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Change Password</div>
                    <Alert alert={changePwAlert} />
                    {changePwStep === 1 && (
                    <>
                        <div className="view-subtitle" style={{ marginBottom: '1rem' }}>Enter your 2FA code first.</div>
                        <OtpInput id="otpChangePwWrap" onComplete={doChangePassword} />
                        <button className={`btn--primary${loading ? ' loading' : ''}`} onClick={() => {
                        const inputs = document.querySelectorAll<HTMLInputElement>('#otpChangePwWrap input');
                        doChangePassword([...inputs].map(i => i.value).join(''));
                        }} disabled={loading} style={{ marginTop: '1rem' }}>
                        <span className="btn-text">Verify</span><div className="btn-loader" />
                        </button>
                    </>
                    )}
                    {changePwStep === 2 && (
                    <>
                        <div className="field" style={{ marginBottom: '1rem' }}>
                        <label>New password</label>
                        <div className="input-wrap">{lockIcon}<input type="password" id="newPassword" placeholder="New password" autoComplete="new-password" /></div>
                        </div>
                        <div className="field" style={{ marginBottom: '1rem' }}>
                        <label>Confirm password</label>
                        <div className="input-wrap">{lockIcon}<input type="password" id="confirmNewPassword" placeholder="Confirm password" autoComplete="new-password" /></div>
                        </div>
                        <button className={`btn--primary${loading ? ' loading' : ''}`} onClick={doChangePasswordSubmit} disabled={loading}>
                        <span className="btn-text">Change Password</span><div className="btn-loader" />
                        </button>
                    </>
                    )}
                    <button className="btn-ghost" onClick={() => setShowChangePw(false)} style={{ marginTop: '0.5rem' }}>Cancel</button>
                </div>
            </div>
        )}
        </div>
    );
}
