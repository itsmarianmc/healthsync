'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import CalSync from '@/app/_components/calsync/CalSync';
import { useAppShell } from '@/app/_context/AppShellContext';
import { visitedRoutes } from '@/app/_lib/visitedRoutes';

function FoodPageContent() {
    const { openSettings } = useAppShell();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const nfl = useRef(visitedRoutes.has('food'));
    const [externalOpenModal, setExternalOpenModal] = useState(false);
    const [externalMode, setExternalMode] = useState<'describe' | 'import' | 'capture' | null>(null);
    const [externalOpenAiMethod, setExternalOpenAiMethod] = useState(false);

    useEffect(() => {
        visitedRoutes.add('food');
    }, []);

    useEffect(() => {
        const openModal = searchParams.get('openModal') === 'true';
        const mode = searchParams.get('mode') as 'describe' | 'import' | 'capture' | null;
        const openAiMethod = searchParams.get('openAiMethod') === 'true';

        if (openModal) {
            setExternalOpenModal(true);
            setExternalMode(mode ?? null);
        }
        if (openAiMethod) {
            setExternalOpenAiMethod(true);
        }
    }, [searchParams]);

    useEffect(() => {
        const handleNavigateFood = (event: Event) => {
            const detail = (event as CustomEvent).detail as { openModal?: boolean; mode?: 'describe' | 'import' | 'capture' };
            if (!detail?.openModal) return;
            setExternalOpenModal(true);
            setExternalMode(detail.mode ?? null);
        };

        window.addEventListener('navigate:food', handleNavigateFood as EventListener);
        return () => window.removeEventListener('navigate:food', handleNavigateFood as EventListener);
    }, []);

    const clearSearchParam = useCallback((name: string) => {
        if (searchParams.get(name) !== null) {
            const params = new URLSearchParams(Array.from(searchParams.entries()));
            params.delete(name);
            const query = params.toString();
            router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
        }
    }, [router, pathname, searchParams]);

    const handleExternalModalClose = useCallback(() => {
        setExternalOpenModal(false);
        setExternalMode(null);
        clearSearchParam('openModal');
        clearSearchParam('mode');
    }, [clearSearchParam]);

    const handleExternalAiMethodClose = useCallback(() => {
        setExternalOpenAiMethod(false);
        clearSearchParam('openAiMethod');
    }, [clearSearchParam]);

    return (
        <CalSync
            nfl={nfl.current}
            onOpenSettings={openSettings}
            openModal={externalOpenModal}
            openWithAi={externalMode}
            onModalClose={handleExternalModalClose}
            openAiMethod={externalOpenAiMethod}
            onAiMethodClose={handleExternalAiMethodClose}
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
