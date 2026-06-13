'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import DropSync from '@/app/_components/dropsync/DropSync';
import { useAppShell } from '@/app/_context/AppShellContext';
import { visitedRoutes } from '@/app/_lib/visitedRoutes';

function DrinksPageContent() {
    const { openSettings } = useAppShell();
    const nfl = useRef(visitedRoutes.has('drinks'));
    const [externalOpenModal, setExternalOpenModal] = useState(false);

    useEffect(() => {
        visitedRoutes.add('drinks');
    }, []);

    useEffect(() => {
        const handleNavigateDrinks = (event: Event) => {
            const detail = (event as CustomEvent).detail as { openModal?: boolean };
            if (!detail?.openModal) return;
            setExternalOpenModal(true);
        };

        window.addEventListener('navigate:drinks', handleNavigateDrinks as EventListener);
        return () => window.removeEventListener('navigate:drinks', handleNavigateDrinks as EventListener);
    }, []);

    const handleExternalModalClose = () => {
        setExternalOpenModal(false);
    };

    return (
        <DropSync
            nfl={nfl.current}
            onOpenSettings={openSettings}
            openModal={externalOpenModal}
            onModalClose={handleExternalModalClose}
        />
    );
}

export default function DrinksPage() {
    return (
        <Suspense>
            <DrinksPageContent />
        </Suspense>
    );
}
