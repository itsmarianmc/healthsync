/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: false,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        { matcher: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/push/'), handler: new NetworkOnly() },
        ...defaultCache,
    ],
});

serwist.setCatchHandler(async ({ request }) => {
    if (request.mode === 'navigate') {
        const cached = await caches.match('/offline.html');
        if (cached) return cached;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        void self.skipWaiting();
    }
});

self.addEventListener('push', (event) => {
    // Deliberately fixed copy: never display health data or untrusted payload text.
    event.waitUntil(self.registration.showNotification('HealthSync', {
        body: 'Notifications are ready. This is a test notification.',
        icon: '/favicon.png', tag: 'healthsync-test',
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
        if (existing) await existing.focus();
        else await self.clients.openWindow('/dash');
    })());
});

serwist.addEventListeners();
