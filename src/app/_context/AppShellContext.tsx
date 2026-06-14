'use client';

import React, {
	createContext,
	useContext,
	useState,
	useRef
} from 'react';

interface AppShellContextType {
	settingsOpen: boolean;
	openSettings: () => void;
	closeSettings: () => void;
	notesOpen: boolean;
	openNotes: () => void;
	closeNotes: () => void;
	workoutOpen: boolean;
	openWorkout: () => void;
	closeWorkout: () => void;
	workoutHistoryOpen: boolean;
	openWorkoutHistory: () => void;
	closeWorkoutHistory: () => void;
	scanModalOpen: boolean;
	openScanModal: () => void;
	closeScanModal: () => void;
	calScanValue: string | null;
	setCalScanValue: (v: string | null) => void;
	extraMenuOpen: boolean;
	setExtraMenuOpen: (v: boolean) => void;
	extraBtnRef: React.RefObject < HTMLDivElement | null > ;
}

const AppShellContext = createContext < AppShellContextType | null > (null);

export function AppShellProvider({
	children
}: {
	children: React.ReactNode
}) {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [notesOpen, setNotesOpen] = useState(false);
	const [workoutOpen, setWorkoutOpen] = useState(false);
	const [workoutHistoryOpen, setWorkoutHistoryOpen] = useState(false);
	const [scanModalOpen, setScanModalOpen] = useState(false);
	const [calScanValue, setCalScanValue] = useState < string | null > (null);
	const [extraMenuOpen, setExtraMenuOpen] = useState(false);
	const extraBtnRef = useRef < HTMLDivElement | null > (null);

	return (
        <AppShellContext.Provider value = {{
			settingsOpen,
			openSettings: () => setSettingsOpen(true),
			closeSettings: () => setSettingsOpen(false),
			notesOpen,
			openNotes: () => setNotesOpen(true),
			closeNotes: () => setNotesOpen(false),
			workoutOpen,
			openWorkout: () => setWorkoutOpen(true),
			closeWorkout: () => setWorkoutOpen(false),
			workoutHistoryOpen,
			openWorkoutHistory: () => setWorkoutHistoryOpen(true),
			closeWorkoutHistory: () => setWorkoutHistoryOpen(false),
			scanModalOpen,
			openScanModal: () => setScanModalOpen(true),
			closeScanModal: () => setScanModalOpen(false),
			calScanValue,
			setCalScanValue,
			extraMenuOpen,
			setExtraMenuOpen,
			extraBtnRef,
			}} >
            {children}
        </AppShellContext.Provider>
	);
}

export function useAppShell() {
	const ctx = useContext(AppShellContext);
	if (!ctx) throw new Error('useAppShell must be used within AppShellProvider');
	return ctx;
}
