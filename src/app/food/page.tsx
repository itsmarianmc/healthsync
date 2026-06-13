'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import CalSync from '@/app/_components/calsync/CalSync';
import { useAppShell } from '@/app/_context/AppShellContext';
import { visitedRoutes } from '@/app/_lib/visitedRoutes';

function FoodPageContent() {
    const { openSettings, calScanValue, setCalScanValue } = useAppShell();
    const nfl = useRef(visitedRoutes.has('food'));
    const [externalOpenModal, setExternalOpenModal] = useState(false);
    const [externalMode, setExternalMode] = useState<'describe' | 'import' | 'capture' | null>(null);
    const [externalBarcode, setExternalBarcode] = useState<string | null>(null);

    useEffect(() => {
        visitedRoutes.add('food');
    }, []);

    useEffect(() => {
        if (!calScanValue) return;
        setExternalOpenModal(true);
        setExternalBarcode(calScanValue);
        setCalScanValue(null);
    }, [calScanValue, setCalScanValue]);

    useEffect(() => {
        const handleNavigateFood = (event: Event) => {
            const detail = (event as CustomEvent).detail as { openModal?: boolean; mode?: 'describe' | 'import' | 'capture'; barcode?: string };
            if (!detail?.openModal) return;
            setExternalOpenModal(true);
            setExternalMode(detail.mode ?? null);
            setExternalBarcode(detail.barcode ?? null);
        };

        window.addEventListener('navigate:food', handleNavigateFood as EventListener);
        return () => window.removeEventListener('navigate:food', handleNavigateFood as EventListener);
    }, []);

    const handleExternalModalClose = () => {
        setExternalOpenModal(false);
        setExternalMode(null);
        setExternalBarcode(null);
    };

    return (
        <CalSync
            nfl={nfl.current}
            onOpenSettings={openSettings}
            openModal={externalOpenModal}
            openWithAi={externalMode}
            openWithBarcodeValue={externalBarcode}
            onModalClose={handleExternalModalClose}
        />
    );
}

export default function FoodPage() {
    return (
        <Suspense>
        <FoodPageContent />
        </Suspense>
    );
}
