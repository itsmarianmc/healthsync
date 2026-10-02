'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../_context/AuthContext';
import { supabase } from '../_lib/supabase';
import AccountSecuritySettings from '../_components/account/AccountSecuritySettings';
import './account.css';

type Profile = {
    display_name: string | null;
    full_name: string | null;
    newsletter_opt_in: boolean;
    newsletter_opt_in_at: string | null;
    newsletter_opt_out_at: string | null;
};

type ProfileLoadState =
    | { userId: string; status: 'ready'; profile: Profile }
    | { userId: string; status: 'error' }
    | { userId: string; status: 'loading' };

export default function AccountPage() {
    const router = useRouter();
    const { user, loading: authLoading, mfaRequired } = useAuth();
    const [profileLoad, setProfileLoad] = useState<ProfileLoadState | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [saveError, setSaveError] = useState('');

    useEffect(() => {
        if (authLoading) return;
        if (!user || mfaRequired) {
            router.replace('/login?next=%2Faccount');
            return;
        }

        let active = true;
        void (async () => {
            try {
                const profileResult = await supabase.from('profiles')
                    .select('display_name,full_name,newsletter_opt_in,newsletter_opt_in_at,newsletter_opt_out_at')
                    .eq('id', user.id)
                    .maybeSingle();
                if (!active) return;
                if (profileResult.error || !profileResult.data) {
                    setProfileLoad({ userId: user.id, status: 'error' });
                } else {
                    setProfileLoad({ userId: user.id, status: 'ready', profile: profileResult.data as Profile });
                }
            } catch {
                if (!active) return;
                setProfileLoad({ userId: user.id, status: 'error' });
            }
        })();

        return () => { active = false; };
    }, [authLoading, user, mfaRequired, router]);

    const updateNewsletter = async (optIn: boolean) => {
        const profile = user && profileLoad?.userId === user.id && profileLoad.status === 'ready'
            ? profileLoad.profile
            : null;
        if (!user || !profile || saving || optIn === profile.newsletter_opt_in) return;
        const savedProfile = profile;
        setProfileLoad({ userId: user.id, status: 'ready', profile: { ...savedProfile, newsletter_opt_in: optIn } });
        setSaving(true);
        setSaveMessage('');
        setSaveError('');
        try {
            const { data, error } = await supabase.from('profiles')
                .update({ newsletter_opt_in: optIn })
                .eq('id', user.id)
                .select('display_name,full_name,newsletter_opt_in,newsletter_opt_in_at,newsletter_opt_out_at')
                .single();
            if (error || !data) throw error || new Error('No updated profile was returned');
            setProfileLoad({ userId: user.id, status: 'ready', profile: data as Profile });
            setSaveMessage(optIn ? 'Your preference has been saved.' : 'You have been unsubscribed.');
        } catch {
            setProfileLoad({ userId: user.id, status: 'ready', profile: savedProfile });
            setSaveError('Your change could not be saved. The previous setting has been restored. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || !user) {
        return <main className="account-page"><p className="account-loading" role="status">Loading your account …</p></main>;
    }

    const profileLoading = profileLoad?.userId !== user.id || profileLoad.status === 'loading';
    const profileError = profileLoad?.userId === user.id && profileLoad.status === 'error';
    const profile = profileLoad?.userId === user.id && profileLoad.status === 'ready'
        ? profileLoad.profile
        : null;
    const displayName = profile?.display_name || profile?.full_name ||
        (typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '') ||
        (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '') || '—';

    return (
        <main className="account-page">
            <header className="account-header">
                <a className="account-back" href="/dash"><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to app</a>
                <p className="account-eyebrow">HEALTHSYNC</p>
                <h1>My Account</h1>
                <p className="account-intro">Your account information, security, and communication preferences.</p>
            </header>

            <section className="account-card" aria-labelledby="account-overview-title">
                <div className="account-card-heading"><span className="account-icon"><i className="fa-regular fa-user" aria-hidden="true" /></span><div><h2 id="account-overview-title">Account overview</h2><p>Your current account information</p></div></div>
                {profileLoading ? <p className="account-state" role="status">Loading account details …</p> : profileError ? <p className="account-state account-state--error" role="alert">Account information could not be loaded. Please reload the page.</p> : (
                    <dl className="account-details">
                        <div><dt>Name</dt><dd>{displayName}</dd></div>
                        {profile?.full_name && profile.full_name !== displayName && <div><dt>Full name</dt><dd>{profile.full_name}</dd></div>}
                        <div><dt>Email address</dt><dd>{user.email || '—'}</dd></div>
                    </dl>
                )}
            </section>

            <AccountSecuritySettings key={user.id} />

            <section className="account-card" aria-labelledby="account-news-title">
                <div className="account-card-heading"><span className="account-icon"><i className="fa-regular fa-envelope" aria-hidden="true" /></span><div><h2 id="account-news-title">News and newsletter</h2><p>You choose whether you want to receive emails</p></div></div>
                <p className="account-note">Opting in saves your preference to receive occasional product news by email. You can withdraw your consent here at any time. No email service is connected yet, so no emails are sent.</p>
                {profile && !profileError && (
                    <label className="account-consent-row">
                        <span><strong>{profile.newsletter_opt_in ? 'Email news enabled' : 'Email news turned off'}</strong><small>{profile.newsletter_opt_in ? 'You can withdraw your consent at any time.' : 'This setting is off by default.'}</small></span>
                        <button type="button" className="account-switch" role="switch" aria-checked={profile.newsletter_opt_in} aria-label="Newsletter opt-in" disabled={saving || profileLoading} onClick={() => void updateNewsletter(!profile.newsletter_opt_in)}>
                            <span />
                        </button>
                    </label>
                )}
                {saving && <p className="account-state" role="status">Saving your preference …</p>}
                {saveMessage && <p className="account-state account-state--success" role="status">{saveMessage}</p>}
                {saveError && <p className="account-state account-state--error" role="alert">{saveError}</p>}
            </section>

            <footer className="account-footer">Your health goals and workout settings are managed in app settings.</footer>
        </main>
    );
}
