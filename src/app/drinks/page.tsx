'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import DropSync from '@/app/_components/dropsync/DropSync';
import { useAppShell } from '@/app/_context/AppShellContext';
import { visitedRoutes } from '@/app/_lib/visitedRoutes';

function DrinksPageContent() {
    const { openSettings } = useAppShell();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const nfl = useRef(visitedRoutes.has('drinks'));
    const [externalOpenModal, setExternalOpenModal] = useState(false);

    useEffect(() => {
        visitedRoutes.add('drinks');
    }, []);

    useEffect(() => {
        if (searchParams.get('openModal') === 'true') {
            setExternalOpenModal(true);
            const params = new URLSearchParams(Array.from(searchParams.entries()));
            params.delete('openModal');
            const query = params.toString();
            router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
        }
    }, [searchParams, router, pathname]);

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
