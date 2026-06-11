'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppShell } from '../_context/AppShellContext';
import BottomNav from './navigation/BottomNav';
import Toast from './shared/Toast';
import SplashScreen from './shared/SplashScreen';
import PullToRefresh from './shared/PullToRefresh';
import SettingsModal from './settings/SettingsModal';
import NotesModal from './settings/NotesModal';
import WorkoutModal from './settings/WorkoutModal';
import WorkoutHistoryModal from './settings/WorkoutHistoryModal';
import BarcodeScanModal from './calsync/BarcodeScanModal';
import Onboarding from './onboarding/Onboarding';
import { removeHeaderBtn, addHeaderBtn } from '../_lib/headerBtns';

const ONBOARDING_KEY = 'calsync_onboarding_done';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    settingsOpen, openSettings, closeSettings,
    notesOpen, openNotes, closeNotes,
    workoutOpen, openWorkout, closeWorkout,
    workoutHistoryOpen, openWorkoutHistory, closeWorkoutHistory,
    scanModalOpen, openScanModal, closeScanModal,
    calScanValue, setCalScanValue,
    extraMenuOpen, setExtraMenuOpen,
    extraBtnRef,
  } = useAppShell();

  const [onboardingDone, setOnboardingDone] = useState(true);

  useEffect(() => {
    setOnboardingDone(!!localStorage.getItem(ONBOARDING_KEY));
  }, []);

  useEffect(() => {
    const theme = localStorage.getItem('calsync_theme');
    if (theme && theme !== 'default') document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }, []);

  // Close extra menu on outside click
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

  // Hide/show settings buttons when settings is open
  useEffect(() => {
    const ids = ['db-openSettingsBtn', 'cs-openSettingsBtn', 'ds-openSettingsBtn'];
    if (settingsOpen) ids.forEach(removeHeaderBtn);
    else ids.forEach(addHeaderBtn);
  }, [settingsOpen]);

  const handleExtraAction = useCallback((action: string) => {
    setExtraMenuOpen(false);
    if (action === 'describe-food') router.push('/food?openModal=true&mode=describe');
    else if (action === 'import-food') router.push('/food?openModal=true&mode=import');
    else if (action === 'capture-food') router.push('/food?openModal=true&mode=capture');
    else if (action === 'scan-barcode') openScanModal();
    else if (action === 'log-drink') router.push('/drinks?openModal=true');
    else if (action === 'training') openWorkout();
    else if (action === 'workout-history') openWorkoutHistory();
  }, [router, setExtraMenuOpen, openScanModal, openWorkout, openWorkoutHistory]);

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

  return (
    <>
      {!onboardingDone && <Onboarding onDone={() => setOnboardingDone(true)} />}

      <SplashScreen />
      <PullToRefresh />

      <div className="app-footer">
        <BottomNav />
        <div
          className={`extra-btn${extraMenuOpen ? ' open' : ''}`}
          id="extraActionBtn"
          ref={extraBtnRef}
          onClick={() => setExtraMenuOpen(v => !v)}
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
          </div>
        </div>
      </div>

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
      <BarcodeScanModal
        isOpen={scanModalOpen}
        onClose={closeScanModal}
        onScanned={handleScanScanned}
      />

      <Toast />
    </>
  );
}
