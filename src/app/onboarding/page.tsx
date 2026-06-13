'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Onboarding from '../_components/onboarding/Onboarding';

const ONBOARDING_KEY = 'calsync_onboarding_done';

export default function OnboardingPage() {
    const router = useRouter();

    const handleDone = React.useCallback(() => {
        try {
            localStorage.setItem(ONBOARDING_KEY, '1');
        } catch {}
        try { window.dispatchEvent(new CustomEvent('onboarding:done')); } catch {}
        router.replace('/dash');
    }, [router]);

    return <Onboarding onDone={handleDone} />;
}