'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppShell } from '../_context/AppShellContext';
import { AiDetectionProvider } from '../_context/AiDetectionContext';
import { useAuth } from '../_context/AuthContext';
import { useCookieConsent } from '../_lib/useCookieConsent';
import BottomNav from './navigation/BottomNav';
import Toast from './shared/Toast';
import PullToRefresh from './shared/PullToRefresh';
import SettingsModal from './settings/SettingsModal';
import NotesModal from './settings/NotesModal';
import CustomSupplementsModal from './settings/CustomSupplementsModal';
import WorkoutModal from './settings/WorkoutModal';
import WorkoutHistoryModal from './settings/WorkoutHistoryModal';
import SupplementsModal from './settings/SupplementsModal';
import BarcodeSearchPopup from './calsync/BarcodeSearchPopup';
import UpdateCenter from './update/UpdateCenter';
import AiDetectionIndicator from './calsync/AiDetectionIndicator';
import GlobalFoodActions from './calsync/GlobalFoodActions';
import { logFoodEntry } from '../_lib/foodLog';
import { openFoodImagePicker } from '../_lib/foodImagePicker';
import type { FoodEntry } from '../_lib/types';
import { removeHeaderBtn, addHeaderBtn } from '../_lib/headerBtns';
import { consumePendingTour, startTourWhenReady } from '../_lib/tour';

const ONBOARDING_KEY = 'calsync_onboarding_done';
const KNOWN_ROUTES = new Set(['/', '/dash', '/food', '/drinks', '/login', '/account']);
const MAIN_APP_ROUTES = new Set(['/dash', '/food', '/drinks']);
const LEGAL_ROUTES_PREFIX = '/legal/';

type InstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function AppShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const {
        settingsOpen, closeSettings,
        updateCenterOpen,
        notesOpen, openNotes, closeNotes,
        workoutOpen, openWorkout, closeWorkout,
        workoutHistoryOpen, openWorkoutHistory, closeWorkoutHistory,
        supplementsOpen, openSupplements, closeSupplements,
        extraMenuOpen, setExtraMenuOpen,
        extraBtnRef,
        setBarcodeSearchOpen,
        openFoodAction, closeFoodAction,
    } = useAppShell();

    const { canUsePreferences, canUseThirdParty } = useCookieConsent();
    const { user, mfaRequired, mfaUser, logout, showToast } = useAuth();

    const [onboardingDone, setOnboardingDone] = useState(true);
    const [supplementsEnabled, setSupplementsEnabled] = useState(false);
    const [aiDetectionUsable, setAiDetectionUsable] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
    const [searchPopupOpen, setSearchPopupOpen] = useState(false);
    const [searchPopupMode, setSearchPopupMode] = useState<'search' | 'camera'>('search');
    const [customSupplementsOpen, setCustomSupplementsOpen] = useState(false);
    const foodOwnerRef = useRef(user?.id ?? 'guest');

    useEffect(() => {
        const owner = user?.id ?? 'guest';
        if (foodOwnerRef.current === owner && !mfaRequired) return;
        foodOwnerRef.current = owner;
        queueMicrotask(() => {
            closeFoodAction();
            setSearchPopupOpen(false);
        });
    }, [user?.id, mfaRequired, closeFoodAction]);

    useEffect(() => {
        setOnboardingDone(!!localStorage.getItem(ONBOARDING_KEY));
    }, []);

    useEffect(() => {
        const read = () => {
            setSupplementsEnabled(localStorage.getItem('calsync_track_supplements') === 'true');
            setAiDetectionUsable(
                localStorage.getItem('calsync_ai_enabled') === 'true'
                && !!localStorage.getItem('calsync_ai_api_key'),
            );
        };
        if (canUsePreferences) {
            read();
            window.addEventListener('storage', read);
        }
        return () => window.removeEventListener('storage', read);
    }, [canUsePreferences, user?.id]);

    useEffect(() => {
        const handler = () => setOnboardingDone(true);
        window.addEventListener('onboarding:done', handler as EventListener);
        return () => window.removeEventListener('onboarding:done', handler as EventListener);
    }, []);

    useEffect(() => {
        const hasValidSession = !!user;
        const shouldRedirect = !onboardingDone && !hasValidSession;
        if (shouldRedirect && pathname !== '/onboarding' && !pathname.startsWith(LEGAL_ROUTES_PREFIX)) {
            router.replace('/onboarding');
        }
    }, [onboardingDone, pathname, router, user]);

    useEffect(() => {
        if (!onboardingDone) return;
        if (pathname !== '/dash') return;
        if (!consumePendingTour()) return;
        startTourWhenReady();
    }, [onboardingDone, pathname]);

    useEffect(() => {
        if (!canUsePreferences) {
            document.documentElement.removeAttribute('data-theme');
            return;
        }
        const theme = localStorage.getItem('calsync_theme');
        if (theme && theme !== 'default') document.documentElement.setAttribute('data-theme', theme);
        else document.documentElement.removeAttribute('data-theme');
    }, [canUsePreferences]);

    useEffect(() => {
        if (!extraMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (extraBtnRef.current && !extraBtnRef.current.contains(e.target as Node)) {
                setExtraMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [extraMenuOpen, extraBtnRef, setExtraMenuOpen]);

    useEffect(() => {
        const dismissed = localStorage.getItem('hs_install_dismissed');
        if (dismissed) return;
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as InstallPromptEvent);
        };
        const installed = () => setDeferredPrompt(null);
        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', installed);
        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installed);
        };
    }, []);

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    }, [deferredPrompt]);

    useEffect(() => {
        const ids = ['db-openSettingsBtn', 'cs-openSettingsBtn', 'ds-openSettingsBtn'];
        if (settingsOpen) ids.forEach(removeHeaderBtn);
        else ids.forEach(addHeaderBtn);
    }, [settingsOpen]);

    useEffect(() => {
        const ids = ['db-openUpdateCenterBtn'];
        if (updateCenterOpen) ids.forEach(removeHeaderBtn);
        else ids.forEach(addHeaderBtn);
    }, [updateCenterOpen]);

    const handleExtraAction = useCallback((action: string) => {
        if (action === 'supplements' && !supplementsEnabled) return;
        if ((action === 'describe-food' || action === 'import-food' || action === 'capture-food') && !aiDetectionUsable) return;
        setExtraMenuOpen(false);
        if (action === 'describe-food') {
            if (pathname === '/food') router.push('/food?openModal=true&mode=describe');
            else openFoodAction('describe');
        } else if (action === 'import-food' || action === 'capture-food') {
            if (!canUseThirdParty) { showToast('AI detection requires third-party consent.'); return; }
            const mode = action === 'import-food' ? 'import' : 'capture';
            openFoodImagePicker(mode, () => {
                if (pathname === '/food') window.dispatchEvent(new CustomEvent('navigate:food', { detail: { openModal: true, mode } }));
                else openFoodAction(mode);
            });
        } else if (action === 'search-food') setSearchPopupOpen(true);
        else if (action === 'scan-barcode') setSearchPopupOpen(true);
        else if (action === 'log-drink') {
            router.push('/drinks?openModal=true');
        } else if (action === 'training') openWorkout();
        else if (action === 'workout-history') openWorkoutHistory();
        else if (action === 'supplements') openSupplements();
    }, [router, pathname, openFoodAction, setExtraMenuOpen, openWorkout, openWorkoutHistory, openSupplements, supplementsEnabled, aiDetectionUsable, canUseThirdParty, showToast]);

    const handleFoodLog = useCallback(async (entry: FoodEntry) => {
        const { cloudPending } = await logFoodEntry(entry, user?.id);
        showToast(cloudPending ? 'Saved locally; cloud sync will retry when online' : `${entry.kcal} kcal logged`);
    }, [user?.id, showToast]);

    useEffect(() => {
        setBarcodeSearchOpen(searchPopupOpen);
        return () => { if (searchPopupOpen) setBarcodeSearchOpen(false); };
    }, [searchPopupOpen, setBarcodeSearchOpen]);

    useEffect(() => {
        if (pathname === '/food') closeFoodAction();
    }, [pathname, closeFoodAction]);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { mode?: 'search' | 'camera' } | undefined;
            setSearchPopupMode(detail?.mode === 'camera' ? 'camera' : 'search');
            setSearchPopupOpen(true);
        };
        window.addEventListener('extra:openBarcodeSearch', handler as EventListener);
        return () => window.removeEventListener('extra:openBarcodeSearch', handler as EventListener);
    }, []);

    const handleSettingsClose = useCallback(() => {
        closeSettings();
    }, [closeSettings]);

    const handleOpenNotesFromSettings = useCallback(() => {
        openNotes();
    }, [openNotes]);
    const handleOpenCustomSupplements = useCallback(() => {
        setCustomSupplementsOpen(true);
    }, []);
    const handleCloseCustomSupplements = useCallback(() => {
        setCustomSupplementsOpen(false);
    }, []);
    if (mfaRequired && pathname !== '/login' && !pathname.startsWith(LEGAL_ROUTES_PREFIX)) {
        return <main className="mfa-gate">
            <div className="mfa-gate__content">
                <div className="mfa-gate__brand" aria-label="HealthSync">
                    <span className="mfa-gate__brand-mark" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 21s-8-4.7-8-11a4.5 4.5 0 0 1 8-2.9A4.5 4.5 0 0 1 20 10c0 6.3-8 11-8 11Z" fill="currentColor" />
                            <path d="M12 7v8m-4-4h8" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </span>
                    <span>Health<span className="mfa-gate__brand-accent">Sync</span></span>
                </div>

                <section className="mfa-gate__card" aria-labelledby="mfa-gate-title">
                    <div className="mfa-gate__eyebrow">
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M10 2.2 16 4.5v4.7c0 4.1-2.5 6.8-6 8.6-3.5-1.8-6-4.5-6-8.6V4.5l6-2.3Z" stroke="currentColor" strokeWidth="1.5" />
                            <path d="m7.4 9.8 1.7 1.7 3.6-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Additional verification</span>
                    </div>
                    <h1 id="mfa-gate-title">Confirm it&apos;s you</h1>
                    <p className="mfa-gate__description">Enter the current code from your authenticator app to securely access your HealthSync data.</p>

                    <div className="mfa-gate__account">
                        <span className="mfa-gate__account-label">Signed in as</span>
                        <span className="mfa-gate__account-value">{mfaUser?.email || 'Your HealthSync account'}</span>
                    </div>

                    <button className="mfa-gate__primary" type="button" onClick={() => router.push(pathname === '/account' ? '/login?next=%2Faccount' : '/login')}>
                        Enter verification code
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button className="mfa-gate__secondary" type="button" onClick={() => void logout()}>
                        Sign out of this account
                    </button>
                </section>

                <p className="mfa-gate__footer">Your account stays protected until verification is complete.</p>
            </div>
        </main>;
    }
    if (!KNOWN_ROUTES.has(pathname)) {
        return <>{children}</>;
    }

    const showFooter = MAIN_APP_ROUTES.has(pathname);
    const showInstallBanner = deferredPrompt && pathname !== '/onboarding' && pathname !== '/login';

    return (
        <>
            <AiDetectionProvider>
                <PullToRefresh />

                {showFooter && (
                    <div className="app-footer">
                        <BottomNav />
                        <AiDetectionIndicator />
                        <div
                            className={`extra-btn${extraMenuOpen ? ' open' : ''}`}
                            id="extraActionBtn"
                            ref={extraBtnRef}
                            onClick={() => setExtraMenuOpen(!extraMenuOpen)}
                            >
                            <div className="extra-icon">
                                <i className="fa-solid fa-plus" />
                            </div>
                            <div className="extra-menu-grid" id="extraMenuGrid" onClick={e => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className={`grid-item${aiDetectionUsable ? '' : ' disabled'}`}
                                    data-action="describe-food"
                                    disabled={!aiDetectionUsable}
                                    onClick={() => handleExtraAction('describe-food')}
                                >
                                <i className="fa-solid fa-font" /><span>Describe Food</span>
                                </button>
                                <button
                                    type="button"
                                    className={`grid-item${aiDetectionUsable ? '' : ' disabled'}`}
                                    data-action="import-food"
                                    disabled={!aiDetectionUsable}
                                    onClick={() => handleExtraAction('import-food')}
                                >
                                <i className="fa-solid fa-image-circle-plus" /><span>Import Food</span>
                                </button>
                                <button
                                    type="button"
                                    className={`grid-item${aiDetectionUsable ? '' : ' disabled'}`}
                                    data-action="capture-food"
                                    disabled={!aiDetectionUsable}
                                    onClick={() => handleExtraAction('capture-food')}
                                >
                                <i className="fa-utility-fill fa-semibold fa-camera" /><span>Capture Food</span>
                                </button>
                                <button type="button" className="grid-item" data-action="scan-barcode" onClick={() => { setSearchPopupMode('camera'); handleExtraAction('scan-barcode'); }}>
                                <i className="fa-solid fa-barcode" /><span>Scan Barcode</span>
                                </button>
                                <button type="button" className="grid-item" data-action="search-food" onClick={() => { setSearchPopupMode('search'); handleExtraAction('search-food'); }}>
                                <i className="fa-solid fa-magnifying-glass" /><span>Search</span>
                                </button>
                                <button type="button" className="grid-item" data-action="log-drink" onClick={() => handleExtraAction('log-drink')}>
                                <i className="fa-solid fa-droplet" /><span>Log Drink</span>
                                </button>
                                <button type="button" className="grid-item" data-action="workout-history" onClick={() => handleExtraAction('workout-history')}>
                                <i className="fa-solid fa-clock-rotate-left" /><span>View Workouts</span>
                                </button>
                                <button type="button" className="grid-item" data-action="training" onClick={() => handleExtraAction('training')}>
                                <i className="fa-solid fa-dumbbell" /><span>View Templates</span>
                                </button>
                                <button
                                    type="button"
                                    className={`grid-item${supplementsEnabled ? '' : ' disabled'}`}
                                    data-action="supplements"
                                    disabled={!supplementsEnabled}
                                    onClick={() => handleExtraAction('supplements')}
                                >
                                <i className="fa-solid fa-capsules" /><span>Supplements</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="views">
                    {children}
                </div>

                <UpdateCenter />

                <SettingsModal
                    isOpen={settingsOpen}
                    onClose={handleSettingsClose}
                    onOpenNotes={handleOpenNotesFromSettings}
                    onOpenCustomSupplements={handleOpenCustomSupplements}
                />

                <NotesModal isOpen={notesOpen} onClose={closeNotes} />
                <CustomSupplementsModal
                    isOpen={customSupplementsOpen}
                    onClose={handleCloseCustomSupplements}
                />
                <WorkoutModal isOpen={workoutOpen} onClose={closeWorkout} />
                <WorkoutHistoryModal isOpen={workoutHistoryOpen} onClose={closeWorkoutHistory} />
                <SupplementsModal isOpen={supplementsOpen} onClose={closeSupplements} />

                <BarcodeSearchPopup
                    isOpen={searchPopupOpen}
                    onClose={() => setSearchPopupOpen(false)}
                    initialMode={searchPopupMode}
                    onLog={handleFoodLog}
                />

                {pathname !== '/food' && showFooter && <GlobalFoodActions key={user?.id ?? 'guest'} />}

                <Toast />

                {showInstallBanner && (
                    <div className="install-banner" role="status" aria-label="Install HealthSync">
                        <div className="install-banner-icon">
                            <img src="/favicon.png" alt="" />
                        </div>
                        <div className="install-banner-text">
                            <div className="install-banner-title">Install HealthSync</div>
                            <div className="install-banner-subtitle">Add HealthSync to your home screen for quick access</div>
                        </div>
                        <div className="install-banner-actions">
                            <button className="install-banner-btn" type="button" onClick={handleInstall}>Install</button>
                            <button className="install-banner-dismiss" type="button" onClick={() => { localStorage.setItem('hs_install_dismissed', '1'); setDeferredPrompt(null); }} aria-label="Dismiss install prompt">&times;</button>
                        </div>
                    </div>
                )}
            </AiDetectionProvider>
        </>
    );
}
