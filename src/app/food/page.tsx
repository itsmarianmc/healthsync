'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import CalSync from '@/app/_components/calsync/CalSync';
import { useAppShell } from '@/app/_context/AppShellContext';
import { visitedRoutes } from '@/app/_lib/visitedRoutes';

function FoodPageContent() {
    const { openSettings, calScanValue, setCalScanValue } = useAppShell();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const nfl = useRef(visitedRoutes.has('food'));
    const [externalOpenModal, setExternalOpenModal] = useState(false);
    const [externalMode, setExternalMode] = useState<'describe' | 'import' | 'capture' | null>(null);
    const [externalBarcode, setExternalBarcode] = useState<string | null>(null);

    useEffect(() => {
        visitedRoutes.add('food');
    }, []);

    useEffect(() => {
        const openModal = searchParams.get('openModal') === 'true';
        const mode = searchParams.get('mode') as 'describe' | 'import' | 'capture' | null;
        const barcode = searchParams.get('barcode');

        if (openModal) {
            setExternalOpenModal(true);
            setExternalMode(mode ?? null);
            setExternalBarcode(barcode ?? null);
        }
    }, [searchParams]);

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

    const handleExternalModalClose = useCallback(() => {
        setExternalOpenModal(false);
        setExternalMode(null);
        setExternalBarcode(null);

        if (searchParams.get('openModal') === 'true') {
            const params = new URLSearchParams(Array.from(searchParams.entries()));
            params.delete('openModal');
            params.delete('mode');
            params.delete('barcode');
            const query = params.toString();
            router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
        }
    }, [router, pathname, searchParams]);

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
