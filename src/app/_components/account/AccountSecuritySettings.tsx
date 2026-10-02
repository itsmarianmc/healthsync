'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../_context/AuthContext';
import { supabase } from '../../_lib/supabase';
import { authErrorMessage } from '../../_lib/userFacingErrors';
import OtpInput from '../shared/OtpInput';

type Factor = { id: string; factor_type: string; status: string };
type PanelMode = 'idle' | 'setup' | 'verify' | 'disable' | 'password-verify' | 'password-change';

function readCode(id: string) {
    return [...document.querySelectorAll<HTMLInputElement>(`#${id} input`)].map(input => input.value).join('');
}

export default function AccountSecuritySettings() {
    const { user } = useAuth();
    const [factors, setFactors] = useState<Factor[]>([]);
    const [factorLoading, setFactorLoading] = useState(true);
    const [factorError, setFactorError] = useState(false);
    const [mode, setMode] = useState<PanelMode>('idle');
    const [factorId, setFactorId] = useState<string | null>(null);
    const [qrUri, setQrUri] = useState<string | null>(null);
    const [secret, setSecret] = useState('');
    const [working, setWorking] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const inFlight = useRef(false);

    useEffect(() => {
        let active = true;
        void supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
            if (!active) return;
            if (listError || !data) setFactorError(true);
            else setFactors(data.all as Factor[]);
            setFactorLoading(false);
        }).catch(() => {
            if (!active) return;
            setFactorError(true);
            setFactorLoading(false);
        });
        return () => { active = false; };
    }, [user?.id]);

    const verifiedFactor = factors.find(factor => factor.factor_type === 'totp' && factor.status === 'verified');
    const run = async (action: () => Promise<void>) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setWorking(true);
        setError('');
        setMessage('');
        try { await action(); }
        finally {
            setWorking(false);
            inFlight.current = false;
        }
    };

    const refreshFactors = async () => {
        const { data, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError || !data) throw listError || new Error('Could not load authenticator status.');
        setFactors(data.all as Factor[]);
        setFactorError(false);
    };

    const beginTwoFactorSetup = () => run(async () => {
        setMode('setup');
        setQrUri(null);
        setSecret('');
        setFactorId(null);
        const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError || !existing) throw listError || new Error('Could not load authenticator settings.');
        const verified = existing.all.find(factor => factor.factor_type === 'totp' && factor.status === 'verified');
        if (verified) {
            setFactors(existing.all as Factor[]);
            setFactorId(verified.id);
            setMode('verify');
            setMessage('2FA is already enabled. You can test a code or remove 2FA.');
            return;
        }
        for (const pending of existing.all.filter(factor => factor.factor_type === 'totp' && factor.status === 'unverified')) {
            const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: pending.id });
            if (cleanupError) throw cleanupError;
        }
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'HealthSync',
            friendlyName: 'HealthSync Authenticator',
        });
        if (enrollError || !data) throw enrollError || new Error('Could not start authenticator setup.');
        setFactorId(data.id);
        setQrUri(data.totp.uri);
        setSecret(data.totp.secret);
    }).catch((cause: unknown) => {
        setMode('idle');
        setError(authErrorMessage(cause, 'Could not load 2FA settings. Please try again.'));
    });

    const confirmSetup = (code: string) => run(async () => {
        if (!factorId || code.length !== 6) throw new Error('Enter the complete six-digit code.');
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeError || !challenge) throw challengeError || new Error('Could not start verification.');
        const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
        if (verifyError) throw verifyError;
        setQrUri(null);
        setSecret('');
        setMode('idle');
        setMessage('2FA is now enabled.');
        await refreshFactors();
    }).catch((cause: unknown) => {
        setError(authErrorMessage(cause, 'Could not confirm the code. Check the current code and try again.'));
    });

    const testTwoFactor = (code: string) => run(async () => {
        if (!factorId || code.length !== 6) throw new Error('Enter the complete six-digit code.');
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeError || !challenge) throw challengeError || new Error('Could not start verification.');
        const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
        if (verifyError) throw verifyError;
        setMode('idle');
        setMessage('The authenticator code was confirmed.');
    }).catch((cause: unknown) => {
        setError(authErrorMessage(cause, 'Could not confirm the code. Check the current code and try again.'));
    });

    const removeTwoFactor = (code: string) => run(async () => {
        if (!factorId || code.length !== 6) throw new Error('Enter the complete six-digit code.');
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeError || !challenge) throw challengeError || new Error('Could not start verification.');
        const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
        if (verifyError) throw verifyError;
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
        if (unenrollError) throw unenrollError;
        setMode('idle');
        setFactorId(null);
        setMessage('2FA has been disabled.');
        await refreshFactors();
    }).catch((cause: unknown) => {
        setError(authErrorMessage(cause, 'Could not disable 2FA. Check the current code and try again.'));
    });

    const openPasswordChange = () => {
        setError('');
        setMessage('');
        setNewPassword('');
        setConfirmPassword('');
        setMode(verifiedFactor ? 'password-verify' : 'password-change');
    };

    const verifyForPasswordChange = (code: string) => run(async () => {
        if (!verifiedFactor || code.length !== 6) throw new Error('Enter the complete six-digit code.');
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id });
        if (challengeError || !challenge) throw challengeError || new Error('Could not start verification.');
        const { error: verifyError } = await supabase.auth.mfa.verify({
            factorId: verifiedFactor.id,
            challengeId: challenge.id,
            code,
        });
        if (verifyError) throw verifyError;
        setMode('password-change');
        setMessage('Identity confirmed. Set your new password.');
    }).catch((cause: unknown) => {
        setError(authErrorMessage(cause, 'Could not confirm the code. Check the current code and try again.'));
    });

    const savePassword = () => run(async () => {
        if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
        if (newPassword !== confirmPassword) throw new Error('Passwords do not match.');
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;
        setNewPassword('');
        setConfirmPassword('');
        setMode('idle');
        setMessage('Your password has been changed.');
    }).catch((cause: unknown) => {
        setError(authErrorMessage(cause, 'Could not change your password. Please try again.'));
    });

    const cancelSetup = () => run(async () => {
        if (factorId) {
            const { data, error: listError } = await supabase.auth.mfa.listFactors();
            if (listError || !data) throw listError || new Error('Could not check setup status.');
            const pending = data.all.find(factor => factor.id === factorId && factor.status === 'unverified');
            if (pending) {
                const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId });
                if (cleanupError) throw cleanupError;
            }
        }
        setMode('idle');
        setQrUri(null);
        setSecret('');
        setFactorId(null);
        setMessage('Setup cancelled. 2FA is not enabled.');
        await refreshFactors();
    }).catch((cause: unknown) => {
        setError(authErrorMessage(cause, 'Could not remove the unfinished setup. Please try again.'));
    });

    const beginDisable = () => {
        if (!verifiedFactor) return;
        setFactorId(verifiedFactor.id);
        setMode('disable');
        setError('');
        setMessage('Enter your current authenticator code to disable 2FA.');
    };

    const status = factorLoading ? 'Checking …' : factorError ? 'Status unavailable' : verifiedFactor ? 'Enabled' : 'Not enabled';

    return (
        <section className="account-card" aria-labelledby="account-security-title">
            <div className="account-card-heading"><span className="account-icon"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span><div><h2 id="account-security-title">Security</h2><p>Password and two-factor authentication</p></div></div>
            <div className="account-security-status">
                <span>Authenticator app (2FA)</span>
                <span className={`account-status-badge${verifiedFactor ? ' is-enabled' : ''}`} role="status">{status}</span>
            </div>
            <p className="account-note">Status is checked with Supabase Auth. Protected actions are also enforced by server-side and database security checks.</p>
            <div className="account-security-actions">
                {verifiedFactor ? (
                    <>
                        <button className="account-action-button" type="button" disabled={working || factorLoading} onClick={() => {
                            setFactorId(verifiedFactor.id); setMode('verify'); setError(''); setMessage('Enter a current code to test your authenticator.');
                        }}>Test authenticator</button>
                        <button className="account-action-button is-danger" type="button" disabled={working || factorLoading} onClick={beginDisable}>Disable 2FA</button>
                    </>
                ) : (
                    <button className="account-action-button" type="button" disabled={working || factorLoading || factorError} onClick={() => void beginTwoFactorSetup()}>
                        <i className="fa-solid fa-lock" aria-hidden="true" /> Set up 2FA
                    </button>
                )}
                <button className="account-action-button is-secondary" type="button" disabled={working || factorLoading || factorError} onClick={openPasswordChange}>
                    <i className="fa-solid fa-key" aria-hidden="true" /> Change password
                </button>
            </div>

            {mode !== 'idle' && (
                <div className="account-security-panel">
                    {mode === 'setup' && (
                        <>
                            <h3>Set up authenticator</h3>
                            {qrUri ? <>
                                <p>Scan this QR code with your authenticator app. 2FA will only be enabled after you confirm a code.</p>
                                <div className="account-qr"><QRCodeSVG value={qrUri} size={176} level="M" title="HealthSync two-factor authentication QR code" /></div>
                                <button className="account-secret" type="button" onClick={() => void navigator.clipboard.writeText(secret)} aria-label="Copy secret key">{secret}</button>
                                <label className="account-code-label">Verification code</label>
                                <OtpInput id="accountSetupOtp" onComplete={confirmSetup} disabled={working} />
                                <button className="account-action-button" type="button" disabled={working} onClick={() => void confirmSetup(readCode('accountSetupOtp'))}>{working ? 'Verifying …' : 'Enable 2FA'}</button>
                            </> : <p role="status">Preparing setup …</p>}
                            <button className="account-action-button is-secondary" type="button" disabled={working} onClick={() => void cancelSetup()}>Cancel setup</button>
                        </>
                    )}
                    {mode === 'verify' && <>
                        <h3>Test authenticator</h3>
                        <p>Enter the six-digit code from your authenticator app.</p>
                        <OtpInput id="accountTestOtp" onComplete={testTwoFactor} disabled={working} />
                        <button className="account-action-button" type="button" disabled={working} onClick={() => void testTwoFactor(readCode('accountTestOtp'))}>{working ? 'Verifying …' : 'Confirm code'}</button>
                        <button className="account-action-button is-secondary" type="button" disabled={working} onClick={() => setMode('idle')}>Cancel</button>
                    </>}
                    {mode === 'disable' && <>
                        <h3>Disable 2FA</h3>
                        <p>Confirm your identity with your current authenticator code.</p>
                        <OtpInput id="accountDisableOtp" onComplete={removeTwoFactor} disabled={working} />
                        <button className="account-action-button is-danger" type="button" disabled={working} onClick={() => void removeTwoFactor(readCode('accountDisableOtp'))}>{working ? 'Verifying …' : 'Remove 2FA'}</button>
                        <button className="account-action-button is-secondary" type="button" disabled={working} onClick={() => setMode('idle')}>Cancel</button>
                    </>}
                    {mode === 'password-verify' && <>
                        <h3>Change password</h3>
                        <p>First confirm your identity with your current authenticator code.</p>
                        <OtpInput id="accountPasswordOtp" onComplete={verifyForPasswordChange} disabled={working} />
                        <button className="account-action-button" type="button" disabled={working} onClick={() => void verifyForPasswordChange(readCode('accountPasswordOtp'))}>{working ? 'Verifying …' : 'Confirm identity'}</button>
                        <button className="account-action-button is-secondary" type="button" disabled={working} onClick={() => setMode('idle')}>Cancel</button>
                    </>}
                    {mode === 'password-change' && <>
                        <h3>New password</h3>
                        <label className="account-form-field">New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
                        <label className="account-form-field">Confirm password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
                        <button className="account-action-button" type="button" disabled={working} onClick={() => void savePassword()}>{working ? 'Saving …' : 'Save password'}</button>
                        <button className="account-action-button is-secondary" type="button" disabled={working} onClick={() => setMode('idle')}>Cancel</button>
                    </>}
                </div>
            )}
            {message && <p className="account-state account-state--success" role="status">{message}</p>}
            {error && <p className="account-state account-state--error" role="alert">{error}</p>}
        </section>
    );
}
