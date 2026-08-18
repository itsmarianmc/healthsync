'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Dashboard from '@/app/_components/dashboard/Dashboard';
import { useAppShell } from '@/app/_context/AppShellContext';
import { visitedRoutes } from '@/app/_lib/visitedRoutes';

function DashboardPageContent() {
    const { openSettings, openUpdateCenter } = useAppShell();
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
            onOpenUpdateCenter={openUpdateCenter}
            onOpenCalSync={() => {
                router.push('/food?openAiMethod=true');
            }}
            onOpenDropSync={() => router.push('/drinks?openModal=true')}
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
