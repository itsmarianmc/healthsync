'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DropSync from '@/app/_components/dropsync/DropSync';
import { useAppShell } from '@/app/_context/AppShellContext';
import { visitedRoutes } from '@/app/_lib/visitedRoutes';

function DrinksPageContent() {
    const { openSettings } = useAppShell();
    const searchParams = useSearchParams();
    const router = useRouter();
    const nfl = useRef(visitedRoutes.has('drinks'));

    const openModal = searchParams.get('openModal') === 'true';

    useEffect(() => {
        visitedRoutes.add('drinks');
    }, []);

    useEffect(() => {
        if (openModal) {
            router.replace('/drinks', { scroll: false });
        }
    }, []);

    return (
        <DropSync
            nfl={nfl.current}
            onOpenSettings={openSettings}
            openModal={openModal}
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
