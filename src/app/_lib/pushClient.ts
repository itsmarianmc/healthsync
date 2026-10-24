'use client';

import { supabase } from './supabase';

export function pushCapability(): 'supported' | 'install' | 'unsupported' | 'insecure' {
    if (!window.isSecureContext) return 'insecure';
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (ios && !standalone) return 'install';
    return 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator ? 'supported' : 'unsupported';
}

export async function pushRequest(userId: string, path: string, method = 'GET', body?: object) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== userId) throw new Error('authorization_required');
    const response = await fetch(`/api/push/${path}`, {
        method, cache: 'no-store', signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'service_unavailable');
    return result as { ok: true; endpoints: string[]; publicKey: string | null };
}

export function vapidBytes(key: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

export async function pushRegistration() {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('worker_unavailable')), 10_000); }),
        ]);
    } finally { clearTimeout(timeout); }
}
