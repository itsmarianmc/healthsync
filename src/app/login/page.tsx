'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../_lib/supabase';
import './styles.css';
import { hasVerifiedMfaFactor, needsMfaVerification } from '../_lib/mfaPolicy';
import { authErrorMessage } from '../_lib/userFacingErrors';
import OtpInput from '../_components/shared/OtpInput';

type View = 'login' | 'register' | 'mfa' | 'reset' | 'resetMfa' | 'confirm' | 'loggedIn';

interface AlertState { msg: string; type: 'error' | 'success' | 'info' | '' }
const EMPTY_ALERT: AlertState = { msg: '', type: '' };

function Alert({ alert }: { alert: AlertState }) {
    if (!alert.msg) return <div className="alert" />;
    return <div className={`alert ${alert.type} show`} role={alert.type === 'error' ? 'alert' : 'status'}>{alert.msg}</div>;
}

export default function LoginPage() {
    const router = useRouter();
    const [view, setView] = useState<View>('login');
    const [loading, setLoading] = useState(false);
    const [loginAlert, setLoginAlert] = useState<AlertState>(EMPTY_ALERT);
    const [registerAlert, setRegisterAlert] = useState<AlertState>(EMPTY_ALERT);
    const [mfaAlert, setMfaAlert] = useState<AlertState>(EMPTY_ALERT);
    const [resetAlert, setResetAlert] = useState<AlertState>(EMPTY_ALERT);
    const [resetMfaAlert, setResetMfaAlert] = useState<AlertState>(EMPTY_ALERT);
    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

    const [pwStrength, setPwStrength] = useState<{ len: boolean; upper: boolean; num: boolean }>({ len: false, upper: false, num: false });
    const [showPwRules, setShowPwRules] = useState(false);
    const [showLoginPw, setShowLoginPw] = useState(false);
    const [showRegPw, setShowRegPw] = useState(false);
    const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);
    const [loggedInUser, setLoggedInUser] = useState<string>('');

    const mfaChallengeRef = useRef<string | null>(null);
    const mfaFactorRef = useRef<string | null>(null);
    const pendingEmailRef = useRef<string | null>(null);
    const resetMfaChallengeRef = useRef<string | null>(null);
    const resetMfaFactorRef = useRef<string | null>(null);
    const mfaInputRef = useRef<HTMLDivElement>(null);
    const mfaVerifyInFlightRef = useRef(false);
    const secondaryVerifyInFlightRef = useRef(false);

    const verifyOnce = async (verify: () => Promise<void>): Promise<void> => {
        if (secondaryVerifyInFlightRef.current) return;
        secondaryVerifyInFlightRef.current = true;
        try { await verify(); }
        finally { secondaryVerifyInFlightRef.current = false; }
    };

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
            const { data: level, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
            if (error || factorsError || !level || !factors) return setLoginAlert({ msg: 'Unable to verify your session. Please try again.', type: 'error' });
            if (needsMfaVerification(level.currentLevel, hasVerifiedMfaFactor(factors.all))) {
                setMfaAlert({ msg: 'Enter your authenticator code to finish signing in.', type: 'info' });
                await startMFAChallenge();
            } else await handleLoggedIn(session.user);
        }
        });
    }, []);

    const handleLoggedIn = useCallback(async (user: { id?: string; email?: string; user_metadata?: Record<string, string> } | null) => {
        const { data: level, error: levelError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (levelError || factorsError || !level || !factors) {
            setLoginAlert({ msg: 'Unable to check your authenticator status. Please try again.', type: 'error' });
            setView('login');
            return;
        }
        if (needsMfaVerification(level.currentLevel, hasVerifiedMfaFactor(factors.all))) {
            setMfaAlert({ msg: 'Complete two-factor authentication before continuing.', type: 'error' });
            setView('mfa');
            await startMFAChallenge();
            return;
        }
        const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
        setLoggedInUser(name);

        if (user?.id) {
            const profilePayload: Record<string, string> = { id: user.id };
            if (user.user_metadata?.display_name) profilePayload.display_name = user.user_metadata.display_name;
            if (user.user_metadata?.full_name)    profilePayload.full_name    = user.user_metadata.full_name;
            if (user.user_metadata?.avatar_url)   profilePayload.avatar_url   = user.user_metadata.avatar_url;
            const { error: profileError } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
            if (profileError) {
                setLoginAlert({ msg: 'Signed in, but profile setup could not finish. Your account is still signed in; try again later or contact support.', type: 'error' });
                setView('login');
                return;
            }
        }
        setView('loggedIn');

        const params = new URLSearchParams(window.location.search);
        if (params.get('keep_login_page') === 'true') return;

        // Restrict redirects to known internal destinations.
        if (params.get('next') === '/account') {
            router.replace('/account');
            return;
        }

        setTimeout(() => { router.push('/dash'); }, 2200);
    }, [router]);

    const doLogin = async () => {
        setLoginAlert(EMPTY_ALERT);
        const email = (document.getElementById('loginEmail') as HTMLInputElement).value.trim();
        const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
        if (!email || !password) return setLoginAlert({ msg: 'Please fill in all fields.', type: 'error' });

        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setLoading(false); return setLoginAlert({ msg: authErrorMessage(error, 'Sign-in failed. Check your email and password, then try again.'), type: 'error' }); }

        const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (aalError || factorsError || !aal || !factors) {
            setLoading(false);
            return setLoginAlert({ msg: 'Unable to check your authenticator status. Please try again.', type: 'error' });
        }
        if (needsMfaVerification(aal.currentLevel, hasVerifiedMfaFactor(factors.all))) {
            setLoading(false);
            pendingEmailRef.current = email;
            await startMFAChallenge();
            return;
        }
        setLoading(false);
        await handleLoggedIn(data.user);
    };

    const startMFAChallenge = async () => {
        setView('mfa');
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError || !factors) { setMfaAlert({ msg: 'Unable to load your authenticator. Please try again.', type: 'error' }); return; }
        const totp = factors?.totp?.find(factor => factor.status === 'verified');
        if (!totp) { setMfaAlert({ msg: 'No verified authenticator is available. Contact support.', type: 'error' }); setView('mfa'); return; }
        const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (error) { setMfaAlert({ msg: authErrorMessage(error, 'Could not start two-factor verification. Try again.'), type: 'error' }); return; }
        mfaChallengeRef.current = challenge.id;
        mfaFactorRef.current = totp.id;
        setView('mfa');
    };

    const doMFAVerify = async (code: string) => {
        if (mfaVerifyInFlightRef.current) return;
        if (code.length < 6) return setMfaAlert({ msg: 'Enter all 6 digits.', type: 'error' });
        if (!mfaFactorRef.current || !mfaChallengeRef.current) {
            return setMfaAlert({ msg: 'Verification is not ready. Please try again.', type: 'error' });
        }
        mfaVerifyInFlightRef.current = true;
        setLoading(true);
        setMfaAlert(EMPTY_ALERT);
        const resetCodeForRetry = () => {
            const inputs = mfaInputRef.current?.querySelectorAll<HTMLInputElement>('.otp-wrap input');
            inputs?.forEach(input => { input.value = ''; });
            requestAnimationFrame(() => inputs?.[0]?.focus());
        };
        try {
            const { error } = await supabase.auth.mfa.verify({
                factorId: mfaFactorRef.current, challengeId: mfaChallengeRef.current, code,
            });
            if (error) {
                setMfaAlert({ msg: authErrorMessage(error, 'That verification code could not be confirmed. Check the current code and try again.'), type: 'error' });
                resetCodeForRetry();
                return;
            }
            const { data: { user } } = await supabase.auth.getUser();
            await handleLoggedIn(user);
        } catch {
            setMfaAlert({ msg: 'Verification could not finish. Check your connection and try again.', type: 'error' });
            resetCodeForRetry();
        } finally {
            mfaVerifyInFlightRef.current = false;
            setLoading(false);
        }
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
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName || displayName, display_name: displayName, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) } } });
        setLoading(false);
        if (error) return setRegisterAlert({ msg: authErrorMessage(error, 'Could not create your account. Check the details and try again.'), type: 'error' });
        setView('confirm');
    };

    const doReset = async () => {
        setResetAlert(EMPTY_ALERT);
        const email = (document.getElementById('resetEmail') as HTMLInputElement).value.trim();
        if (!email) return setResetAlert({ msg: 'Please enter your email.', type: 'error' });
        setLoading(true);
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError || !factors) {
            setLoading(false);
            return setResetAlert({ msg: 'Unable to check your authenticator status. Please try again.', type: 'error' });
        }
        const verifiedTotp = factors.totp.find((factor) => factor.status === 'verified');
        if (verifiedTotp) {
            pendingEmailRef.current = email;
            const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verifiedTotp.id });
            if (challengeError) {
                setLoading(false);
                return setResetAlert({ msg: authErrorMessage(challengeError, 'Could not start verification. Try again.'), type: 'error' });
            }
            resetMfaChallengeRef.current = challenge.id;
            resetMfaFactorRef.current = verifiedTotp.id;
            setLoading(false);
            setView('resetMfa');
            return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
        setLoading(false);
        if (error) return setResetAlert({ msg: authErrorMessage(error, 'Could not send a reset link. Check your email address and try again.'), type: 'error' });
        setResetAlert({ msg: 'Reset link sent! Check your inbox.', type: 'success' });
    };

    const doResetMFAVerify = async (code: string) => {
        if (code.length < 6) return setResetMfaAlert({ msg: 'Enter all 6 digits.', type: 'error' });
        await verifyOnce(async () => {
            setLoading(true);
            try {
                const { error } = await supabase.auth.mfa.verify({
                    factorId: resetMfaFactorRef.current!, challengeId: resetMfaChallengeRef.current!, code,
                });
                if (error) return setResetMfaAlert({ msg: authErrorMessage(error, 'That verification code could not be confirmed. Check the current code and try again.'), type: 'error' });
                const { error: resetErr } = await supabase.auth.resetPasswordForEmail(pendingEmailRef.current || '', { redirectTo: `${window.location.origin}/login` });
                if (resetErr) return setResetMfaAlert({ msg: authErrorMessage(resetErr, 'Could not send a reset link. Try again shortly.'), type: 'error' });
                setResetMfaAlert({ msg: 'Reset link sent! Check your inbox.', type: 'success' });
            } finally {
                setLoading(false);
            }
        });
    };

    const checkPwStrength = (val: string) => {
        setPwStrength({ len: val.length >= 8, upper: /[A-Z]/.test(val), num: /[0-9]/.test(val) });
        if (val.length > 0) setShowPwRules(true);
    };

    const pwScore = [pwStrength.len, pwStrength.upper, pwStrength.num].filter(Boolean).length;
    const pwCls = ['', 'weak', 'medium', 'strong'][pwScore] || '';

    const goToApp = () => { router.push('/dash'); };
    const logoutUser = async () => {
        await supabase.auth.signOut();
        setView('login');
        setActiveTab('login');
    };

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

            {(view === 'login' || view === 'register') && (
                <div id="authSection">
                    <div className="tabs">
                    <button className={`tab${activeTab === 'login' ? ' active' : ''}`} onClick={() => { setActiveTab('login'); setView('login'); }}>Sign in</button>
                    <button className={`tab${activeTab === 'register' ? ' active' : ''}`} onClick={() => { setActiveTab('register'); setView('register'); }}>Register</button>
                    </div>

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

            {view === 'mfa' && (
            <div className="view active" id="viewMFA" ref={mfaInputRef}>
                <button className="back-link" onClick={() => setView('login')}>{backArrow}Back</button>
                <div className="view-title">Two-factor authentication</div>
                <div className="view-subtitle">Enter the 6-digit code from your authenticator app.</div>
                <Alert alert={mfaAlert} />
                <OtpInput id="otpWrap" onComplete={doMFAVerify} disabled={loading} />
                <button className={`btn--primary${loading ? ' loading' : ''}`} id="mfaBtn" onClick={() => {
                    const inputs = document.querySelectorAll<HTMLInputElement>('#otpWrap input');
                    doMFAVerify([...inputs].map(i => i.value).join(''));
                    }} disabled={loading}>
                    <span className="btn-text">Confirm</span><div className="btn-loader" />
                </button>
            </div>
            )}

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
                        <button className="btn-ghost" onClick={() => router.push('/account')} style={{ marginBottom: '0.5rem' }}>
                            <i className="fa-solid fa-user-gear" /> Manage Account
                        </button>
                        <button className="btn--primary" onClick={logoutUser}>Logout</button>
                    </div>
                </div>
            )}
        </div>

        {view !== 'loggedIn' && (
            <div className="card-footer" id="mainFooter">
                <Link href="/" style={{ color: 'var(--text2)', fontSize: '0.88rem', textDecoration: 'none' }}>Back to app</Link>
            </div>
        )}

        </div>
    );
}
