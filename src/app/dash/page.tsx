'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Dashboard from '@/app/_components/dashboard/Dashboard';
import { useAppShell } from '@/app/_context/AppShellContext';
import { visitedRoutes } from '@/app/_lib/visitedRoutes';

function DashboardPageContent() {
    const { openSettings } = useAppShell();
    const searchParams = useSearchParams();
    const router = useRouter();
    const nfl = useRef(visitedRoutes.has('dashboard'));

    useEffect(() => {
        visitedRoutes.add('dashboard');
    }, []);

    useEffect(() => {
        if (searchParams.get('reload') === 'true') {
            setTimeout(() => {
                router.replace('/dash', { scroll: false });
            }, 2200);
        }
    }, []);

    return (
        <Dashboard
            nfl={nfl.current}
            onOpenSettings={openSettings}
            onOpenCalSync={() => {
              router.push('/food');
              window.dispatchEvent(new CustomEvent('navigate:food', { detail: { openModal: true } }));
            }}
            onOpenDropSync={() => {
              router.push('/drinks');
              window.dispatchEvent(new CustomEvent('navigate:drinks', { detail: { openModal: true } }));
            }}
        />
    );
}

export default function DashboardPage() {
    return (
        <Suspense>
            <DashboardPageContent />
        </Suspense>
    );
}
