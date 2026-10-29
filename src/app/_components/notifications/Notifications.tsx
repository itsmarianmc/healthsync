'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '../../_context/AuthContext';
import { pushCapability, pushRegistration, pushRequest, vapidBytes } from '../../_lib/pushClient';
import './notifications.css';

type NotificationsProps = { onEnabled?: () => void; variant?: 'settings' | 'onboarding' };

export default function Notifications({ onEnabled, variant = 'settings' }: NotificationsProps) {
    const { user } = useAuth();
    return <PushControls key={user?.id ?? 'guest'} userId={user?.id} onEnabled={onEnabled} variant={variant} />;
}

function PushControls({ userId, onEnabled, variant }: NotificationsProps & { userId?: string }) {
    const [capability, setCapability] = useState<ReturnType<typeof pushCapability> | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [saved, setSaved] = useState<boolean | null>(null);
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const alive = useRef(false);
    const locked = useRef(false);
    const revision = useRef(0);

    const refresh = useCallback(async () => {
        const current = ++revision.current;
        const capability = pushCapability();
        if (!alive.current || current !== revision.current) return;
        setCapability(capability);
        if ('Notification' in window) setPermission(Notification.permission);
        if (!userId || capability !== 'supported') return;
        try {
            const [status, registration] = await Promise.all([
                pushRequest(userId, 'subscriptions'), navigator.serviceWorker.getRegistration('/'),
            ]);
            const sub = await registration?.pushManager.getSubscription() ?? null;
            if (!alive.current || current !== revision.current) return;
            setSubscription(sub);
            setSaved(!!sub && status.endpoints.includes(sub.endpoint));
            setPublicKey(status.publicKey);
            setMessage('');
        } catch {
            if (alive.current && current === revision.current) { setSaved(null); setMessage('Could not load notification settings. Check your connection, sign-in and two-factor verification, then retry.'); }
        }
    }, [userId]);

    useEffect(() => {
        alive.current = true;
        const initialRefresh = setTimeout(() => { void refresh(); }, 0);
        const onFocus = () => { if (!locked.current) void refresh(); };
        window.addEventListener('focus', onFocus);
        return () => { alive.current = false; clearTimeout(initialRefresh); window.removeEventListener('focus', onFocus); };
    }, [refresh]);

    const errorMessage = (error: unknown) => {
        const code = error instanceof Error ? error.message : '';
        if (code === 'rate_limited') return 'Please wait one minute before sending another test.';
        if (code === 'subscription_expired' || code === 'subscription_missing') {
            setSaved(false);
            return 'This subscription has expired. Enable notifications again to set it up.';
        }
        if (code === 'authorization_required') return 'Sign in and complete two-factor verification, then retry.';
        if (code === 'worker_unavailable') return 'The app is still preparing offline support. Reload and try again.';
        return 'Could not complete this action. Check your connection and try again.';
    };

    const enable = async () => {
        if (locked.current || !userId || !publicKey || pushCapability() !== 'supported') return;
        if (Notification.permission === 'denied') { setPermission('denied'); return; }
        locked.current = true;
        revision.current++;
        setBusy(true);
        setMessage('');
        let created: PushSubscription | null = null;
        let stored = false;
        try {
            // Keep this call before any await: iOS requires direct user activation.
            const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
            if (!alive.current) return;
            setPermission(result);
            if (result !== 'granted') { setMessage('Notifications were not enabled. You can try again in Settings.'); return; }
            const registration = await pushRegistration();
            if (!alive.current) return;
            let sub = await registration.pushManager.getSubscription();
            const status = await pushRequest(userId, 'subscriptions');
            if (!alive.current) return;
            const key = vapidBytes(publicKey);
            const existingKey = sub?.options.applicationServerKey;
            const keyMatches = existingKey && Array.from(new Uint8Array(existingKey)).join() === Array.from(key).join();
            // A browser subscription must never silently move between accounts.
            if (sub && (!status.endpoints.includes(sub.endpoint) || !keyMatches)) {
                if (status.endpoints.includes(sub.endpoint)) {
                    await pushRequest(userId, 'subscriptions', 'DELETE', { endpoint: sub.endpoint });
                    if (!alive.current) return;
                }
                if (!(await sub.unsubscribe())) throw new Error('unsubscribe_failed');
                sub = null;
            }
            if (!alive.current) return;
            if (!sub) {
                sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
                created = sub;
            }
            if (!alive.current) { if (created) await created.unsubscribe(); return; }
            await pushRequest(userId, 'subscriptions', 'POST', sub.toJSON());
            stored = true;
            if (!alive.current) return;
            setSubscription(sub);
            setSaved(true);
            try {
                await pushRequest(userId, 'test-notification', 'POST', { endpoint: sub.endpoint });
                if (alive.current) { setMessage('Test sent. Check your device notifications.'); onEnabled?.(); }
            } catch (error) {
                if (alive.current) setMessage(`Notifications saved. ${errorMessage(error)}`);
            }
        } catch (error) {
            if (created && !stored) await created.unsubscribe().catch(() => false);
            if (alive.current) setMessage(errorMessage(error));
        } finally {
            locked.current = false;
            if (alive.current) setBusy(false);
        }
    };

    const action = async (remove: boolean) => {
        if (!userId || !subscription || locked.current) return;
        locked.current = true;
        revision.current++;
        setBusy(true);
        setMessage('');
        try {
            await pushRequest(userId, remove ? 'subscriptions' : 'test-notification', remove ? 'DELETE' : 'POST', { endpoint: subscription.endpoint });
            if (!alive.current) return;
            if (remove) {
                setSaved(false);
                const unsubscribed = await subscription.unsubscribe();
                if (!alive.current) return;
                if (unsubscribed) setSubscription(null);
                setMessage(unsubscribed ? 'Notifications disabled for this device. Browser permission remains unchanged.' : 'Server subscription removed. Reload to finish removing the browser subscription.');
            } else setMessage('Test sent. Check your device notifications.');
        } catch (error) { if (alive.current) setMessage(errorMessage(error)); }
        finally { locked.current = false; if (alive.current) setBusy(false); }
    };

    const onboarding = variant === 'onboarding';

    return <div className={`push-controls push-controls--${variant} settings-section-body`} aria-label="Notification settings" aria-busy={busy}>
        {onboarding ? <>
            <div className="push-preview" aria-label="Example test notification">
                <div className="push-preview-header">
                    <span className="push-preview-app"><Image src="/favicon.png" alt="" width={24} height={24} />HealthSync</span>
                    <span className="push-preview-label">Preview</span>
                </div>
                <strong>You&apos;re connected.</strong>
                <p>A simple test to make sure notifications reach you.</p>
            </div>
            <p className="push-scope-note"><i className="fa-solid fa-shield-halved" aria-hidden="true" /><span>Test notifications only. Meal and supplement reminders aren&apos;t available yet.</span></p>
        </> : <p className="push-intro">Manage notifications on this device. Only test notifications are available for now.</p>}
        {capability === 'install' ? <p role="status">On iPhone or iPad, open the Share menu, choose “Add to Home Screen”, then launch HealthSync from its icon. Sign in and enable notifications in Settings.</p>
        : capability === 'insecure' ? <p role="status">Notifications require a secure HTTPS connection. You can continue using HealthSync.</p>
        : capability === 'unsupported' ? <p role="status">This browser does not support Web Push. You can continue using HealthSync and try a supported browser later.</p>
        : capability === 'supported' && <>
            {(!onboarding || userId) && <dl className="push-status">
                <div><dt>Browser permission</dt><dd>{permission === 'default' ? 'Not requested' : permission === 'granted' ? 'Allowed' : 'Blocked'}</dd></div>
                <div><dt>Push on this device</dt><dd className={saved ? 'push-status--enabled' : ''}>{!userId ? 'Sign-in required' : saved === null ? 'Not confirmed' : saved ? 'Enabled · saved to your account' : 'Off'}</dd></div>
            </dl>}
            {permission === 'denied' && <p>Notifications are blocked. Allow notifications for HealthSync in your browser site settings or device notification settings, then return here and retry.</p>}
            {!userId ? <>
                <div className="push-notice push-notice--account"><i className="fa-regular fa-user" aria-hidden="true" /><div><strong>Set up when you&apos;re ready</strong><p>Sign in to enable notifications, or continue and set them up later in Settings.</p></div></div>
                <div className="push-actions"><button type="button" className="btn--primary" disabled><i className="fa-regular fa-bell" aria-hidden="true" />Enable notifications</button></div>
            </> : <>
                {saved === false && !publicKey && <p>Push setup is currently unavailable. Try again after the service has been configured.</p>}
                <div className="push-actions">
                    {(!saved || permission !== 'granted') && <button type="button" className="btn--primary" disabled={busy || !publicKey || permission === 'denied'} onClick={() => void enable()}><i className="fa-regular fa-bell" aria-hidden="true" />Enable notifications</button>}
                    {saved && <button type="button" className="btn--primary" disabled={busy || !publicKey || permission !== 'granted'} onClick={() => void action(false)}><i className="fa-regular fa-paper-plane" aria-hidden="true" />Send test notification</button>}
                    {saved && <button type="button" className="settings-btn" disabled={busy} onClick={() => void action(true)}>Disable notifications</button>}
                    {(!onboarding || message) && <button type="button" className="push-refresh" disabled={busy} onClick={() => void refresh()}><i className="fa-solid fa-rotate-right" aria-hidden="true" />Refresh status</button>}
                </div>
            </>}
        </>}
        {(busy || message) && <p className="push-feedback" role="status" aria-live="polite">{busy ? 'Updating notification settings…' : message}</p>}
    </div>;
}
