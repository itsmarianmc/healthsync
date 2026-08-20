'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import WorkoutModal from './settings/WorkoutModal';
import WorkoutHistoryModal from './settings/WorkoutHistoryModal';
import SupplementsModal from './settings/SupplementsModal';
import BarcodeSearchPopup from './calsync/BarcodeSearchPopup';
import UpdateCenter from './update/UpdateCenter';
import AiDetectionIndicator from './calsync/AiDetectionIndicator';
import { removeHeaderBtn, addHeaderBtn } from '../_lib/headerBtns';
import { consumePendingTour, startTourWhenReady } from '../_lib/tour';

const ONBOARDING_KEY = 'calsync_onboarding_done';
const KNOWN_ROUTES = new Set(['/', '/dash', '/food', '/drinks', '/login']);
const LEGAL_ROUTES_PREFIX = '/legal/';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const {
        settingsOpen, openSettings, closeSettings,
        updateCenterOpen,
        notesOpen, openNotes, closeNotes,
        workoutOpen, openWorkout, closeWorkout,
        workoutHistoryOpen, openWorkoutHistory, closeWorkoutHistory,
        supplementsOpen, openSupplements, closeSupplements,
        extraMenuOpen, setExtraMenuOpen,
        extraBtnRef,
        barcodeSearchOpen, setBarcodeSearchOpen,
    } = useAppShell();

    const { canUsePreferences } = useCookieConsent();
    const { user } = useAuth();

    const [onboardingDone, setOnboardingDone] = useState(true);
    const [supplementsEnabled, setSupplementsEnabled] = useState(false);
    const [aiDetectionUsable, setAiDetectionUsable] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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
    }, [canUsePreferences]);

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
            setDeferredPrompt(e);
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
            router.push('/food?openModal=true&mode=describe');
        } else if (action === 'import-food') {
            router.push('/food?openModal=true&mode=import');
        } else if (action === 'capture-food') {
            router.push('/food?openModal=true&mode=capture');
        } else if (action === 'search-food') setSearchPopupOpen(true);
        else if (action === 'scan-barcode') setSearchPopupOpen(true);
        else if (action === 'log-drink') {
            router.push('/drinks?openModal=true');
        } else if (action === 'training') openWorkout();
        else if (action === 'workout-history') openWorkoutHistory();
        else if (action === 'supplements') openSupplements();
    }, [router, setExtraMenuOpen, openWorkout, openWorkoutHistory, openSupplements, supplementsEnabled, aiDetectionUsable]);

    const [searchPopupOpen, setSearchPopupOpen] = useState(false);
    const [searchPopupMode, setSearchPopupMode] = useState<'search' | 'camera'>('search');

    useEffect(() => {
        setBarcodeSearchOpen(searchPopupOpen);
        return () => { if (searchPopupOpen) setBarcodeSearchOpen(false); };
    }, [searchPopupOpen, setBarcodeSearchOpen]);

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
    if (!KNOWN_ROUTES.has(pathname)) {
        return <>{children}</>;
    }

    const showFooter = pathname !== '/login';

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
                />

                <NotesModal isOpen={notesOpen} onClose={closeNotes} />
                <WorkoutModal isOpen={workoutOpen} onClose={closeWorkout} />
                <WorkoutHistoryModal isOpen={workoutHistoryOpen} onClose={closeWorkoutHistory} />
                <SupplementsModal isOpen={supplementsOpen} onClose={closeSupplements} />

                <BarcodeSearchPopup
                    isOpen={searchPopupOpen}
                    onClose={() => setSearchPopupOpen(false)}
                    initialMode={searchPopupMode}
                />

                <Toast />

                {deferredPrompt && (
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