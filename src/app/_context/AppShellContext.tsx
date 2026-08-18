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
	updateCenterOpen: boolean;
	openUpdateCenter: () => void;
	closeUpdateCenter: () => void;
	notesOpen: boolean;
	openNotes: () => void;
	closeNotes: () => void;
	workoutOpen: boolean;
	openWorkout: () => void;
	closeWorkout: () => void;
	workoutHistoryOpen: boolean;
	openWorkoutHistory: () => void;
	closeWorkoutHistory: () => void;
	supplementsOpen: boolean;
	openSupplements: () => void;
	closeSupplements: () => void;
	extraMenuOpen: boolean;
	setExtraMenuOpen: (v: boolean) => void;
	extraBtnRef: React.RefObject < HTMLDivElement | null > ;
	barcodeSearchOpen: boolean;
	setBarcodeSearchOpen: (v: boolean) => void;
}

const AppShellContext = createContext < AppShellContextType | null > (null);

export function AppShellProvider({
	children
}: {
	children: React.ReactNode
}) {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [updateCenterOpen, setUpdateCenterOpen] = useState(false);
	const [notesOpen, setNotesOpen] = useState(false);
	const [workoutOpen, setWorkoutOpen] = useState(false);
	const [workoutHistoryOpen, setWorkoutHistoryOpen] = useState(false);
	const [supplementsOpen, setSupplementsOpen] = useState(false);
	const [extraMenuOpen, setExtraMenuOpen] = useState(false);
	const [barcodeSearchOpen, setBarcodeSearchOpen] = useState(false);
	const extraBtnRef = useRef < HTMLDivElement | null > (null);

	return (
        <AppShellContext.Provider value = {{
			settingsOpen,
			openSettings: () => setSettingsOpen(true),
			closeSettings: () => setSettingsOpen(false),
			updateCenterOpen,
			openUpdateCenter: () => setUpdateCenterOpen(true),
			closeUpdateCenter: () => setUpdateCenterOpen(false),
			notesOpen,
			openNotes: () => setNotesOpen(true),
			closeNotes: () => setNotesOpen(false),
			workoutOpen,
			openWorkout: () => setWorkoutOpen(true),
			closeWorkout: () => setWorkoutOpen(false),
			workoutHistoryOpen,
			openWorkoutHistory: () => setWorkoutHistoryOpen(true),
			closeWorkoutHistory: () => setWorkoutHistoryOpen(false),
			supplementsOpen,
			openSupplements: () => setSupplementsOpen(true),
			closeSupplements: () => setSupplementsOpen(false),
			extraMenuOpen,
			setExtraMenuOpen,
			extraBtnRef,
			barcodeSearchOpen,
			setBarcodeSearchOpen,
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