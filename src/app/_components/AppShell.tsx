'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppShell } from '../_context/AppShellContext';
import BottomNav from './navigation/BottomNav';
import Toast from './shared/Toast';
import PullToRefresh from './shared/PullToRefresh';
import SettingsModal from './settings/SettingsModal';
import NotesModal from './settings/NotesModal';
import WorkoutModal from './settings/WorkoutModal';
import WorkoutHistoryModal from './settings/WorkoutHistoryModal';
import SupplementsModal from './settings/SupplementsModal';
import BarcodeScanModal from './calsync/BarcodeScanModal';
import ExtraScanner from './calsync/ExtraScanner';
import { removeHeaderBtn, addHeaderBtn } from '../_lib/headerBtns';
import { consumePendingTour, startTourWhenReady } from '../_lib/tour';

const ONBOARDING_KEY = 'calsync_onboarding_done';

const KNOWN_ROUTES = new Set(['/', '/dash', '/food', '/drinks', '/login']);

export default function AppShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const {
        settingsOpen, openSettings, closeSettings,
        notesOpen, openNotes, closeNotes,
        workoutOpen, openWorkout, closeWorkout,
        workoutHistoryOpen, openWorkoutHistory, closeWorkoutHistory,
        supplementsOpen, openSupplements, closeSupplements,
        scanModalOpen, openScanModal, closeScanModal,
        calScanValue, setCalScanValue,
        extraMenuOpen, setExtraMenuOpen,
        extraBtnRef,
    } = useAppShell();

    const [onboardingDone, setOnboardingDone] = useState(true);
    const [supplementsEnabled, setSupplementsEnabled] = useState(false);

    useEffect(() => {
        setOnboardingDone(!!localStorage.getItem(ONBOARDING_KEY));
    }, []);

    useEffect(() => {
        const read = () => setSupplementsEnabled(localStorage.getItem('calsync_track_supplements') === 'true');
        read();
        window.addEventListener('storage', read);
        return () => window.removeEventListener('storage', read);
    }, []);

    useEffect(() => {
        const handler = () => setOnboardingDone(true);
        window.addEventListener('onboarding:done', handler as EventListener);
        return () => window.removeEventListener('onboarding:done', handler as EventListener);
    }, []);

    useEffect(() => {
        if (!onboardingDone && pathname !== '/onboarding') {
        router.replace('/onboarding');
        }
    }, [onboardingDone, pathname, router]);

    useEffect(() => {
        if (!onboardingDone) return;
        if (pathname !== '/dash') return;
        if (!consumePendingTour()) return;
        startTourWhenReady();
    }, [onboardingDone, pathname]);

    useEffect(() => {
        const theme = localStorage.getItem('calsync_theme');
        if (theme && theme !== 'default') document.documentElement.setAttribute('data-theme', theme);
        else document.documentElement.removeAttribute('data-theme');
    }, []);

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
        const ids = ['db-openSettingsBtn', 'cs-openSettingsBtn', 'ds-openSettingsBtn'];
        if (settingsOpen) ids.forEach(removeHeaderBtn);
        else ids.forEach(addHeaderBtn);
    }, [settingsOpen]);

    const handleExtraAction = useCallback((action: string) => {
        if (action === 'supplements' && !supplementsEnabled) return;
        setExtraMenuOpen(false);
        if (action === 'describe-food') {
            router.push('/food?openModal=true&mode=describe');
        } else if (action === 'import-food') {
            router.push('/food?openModal=true&mode=import');
        } else if (action === 'capture-food') {
            router.push('/food?openModal=true&mode=capture');
        } else if (action === 'scan-barcode') setExtraScannerOpen(true);
        else if (action === 'log-drink') {
            router.push('/drinks?openModal=true');
        } else if (action === 'training') openWorkout();
        else if (action === 'workout-history') openWorkoutHistory();
        else if (action === 'supplements') openSupplements();
    }, [router, setExtraMenuOpen, openWorkout, openWorkoutHistory, openSupplements, supplementsEnabled]);

    const [extraScannerOpen, setExtraScannerOpen] = useState(false);

    const handleScanScanned = useCallback((barcode: string) => {
        closeScanModal();
        setCalScanValue(barcode);
        router.push(`/food?openModal=true&barcode=${encodeURIComponent(barcode)}`);
    }, [closeScanModal, setCalScanValue, router]);

    const handleSettingsClose = useCallback(() => {
        closeSettings();
    }, [closeSettings]);

    const handleOpenNotesFromSettings = useCallback(() => {
        closeSettings();
        openNotes();
    }, [closeSettings, openNotes]);

    if (!KNOWN_ROUTES.has(pathname)) {
        return <>{children}</>;
    }

    const showFooter = pathname !== '/login';

    return (
        <>
            <PullToRefresh />

            {showFooter && (
                <div className="app-footer">
                    <BottomNav />
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
                            <div className="grid-item" data-action="describe-food" onClick={() => handleExtraAction('describe-food')}>
                            <i className="fa-solid fa-font" /><span>Describe Food</span>
                            </div>
                            <div className="grid-item" data-action="import-food" onClick={() => handleExtraAction('import-food')}>
                            <i className="fa-solid fa-image-circle-plus" /><span>Import Food</span>
                            </div>
                            <div className="grid-item" data-action="capture-food" onClick={() => handleExtraAction('capture-food')}>
                            <i className="fa-utility-fill fa-semibold fa-camera" /><span>Capture Food</span>
                            </div>
                            <div className="grid-item" data-action="scan-barcode" onClick={() => handleExtraAction('scan-barcode')}>
                            <i className="fa-solid fa-barcode-read" /><span>Scan Barcode</span>
                            </div>
                            <div className="grid-item" data-action="training" onClick={() => handleExtraAction('training')}>
                            <i className="fa-solid fa-dumbbell" /><span>View Templates</span>
                            </div>
                            <div className="grid-item" data-action="log-drink" onClick={() => handleExtraAction('log-drink')}>
                            <i className="fa-solid fa-droplet" /><span>Log Drink</span>
                            </div>
                            <div className="grid-item" data-action="workout-history" onClick={() => handleExtraAction('workout-history')}>
                            <i className="fa-solid fa-clock-rotate-left" /><span>View Workouts</span>
                            </div>
                            <div
                                className={`grid-item${supplementsEnabled ? '' : ' disabled'}`}
                                data-action="supplements"
                                aria-disabled={!supplementsEnabled}
                                onClick={() => handleExtraAction('supplements')}
                            >
                            <i className="fa-solid fa-capsules" /><span>Supplements</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="views">
                {children}
            </div>

            <SettingsModal
                isOpen={settingsOpen}
                onClose={handleSettingsClose}
                onOpenNotes={handleOpenNotesFromSettings}
            />

            <NotesModal isOpen={notesOpen} onClose={closeNotes} />
            <WorkoutModal isOpen={workoutOpen} onClose={closeWorkout} />
            <WorkoutHistoryModal isOpen={workoutHistoryOpen} onClose={closeWorkoutHistory} />
            <SupplementsModal isOpen={supplementsOpen} onClose={closeSupplements} />
            <BarcodeScanModal
                isOpen={scanModalOpen}
                onClose={closeScanModal}
                onScanned={handleScanScanned}
            />

            <ExtraScanner isOpen={extraScannerOpen} onClose={() => setExtraScannerOpen(false)} />

            <Toast />
        </>
    );
}
