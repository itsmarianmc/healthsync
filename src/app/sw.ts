/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, NetworkFirst, NetworkOnly, Serwist } from 'serwist';
import { APP_BUILD_ID } from './_lib/build';

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    precacheOptions: { cacheName: `healthsync-precache-${APP_BUILD_ID}`, cleanupOutdatedCaches: false },
    skipWaiting: false,
    clientsClaim: true,
    navigationPreload: false,
    runtimeCaching: [
        { matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/api/'), handler: new NetworkOnly() },
        { matcher: ({ sameOrigin, request }) => !sameOrigin && !['font', 'style', 'image'].includes(request.destination), handler: new NetworkOnly() },
        // Never reuse RSC payloads across deployments or authentication states.
        { matcher: ({ request, sameOrigin }) => sameOrigin && request.headers.get('RSC') === '1', handler: new NetworkOnly() },
        { matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate', handler: new NetworkFirst({
            cacheName: `healthsync-documents-${APP_BUILD_ID}`,
            plugins: [{ cacheWillUpdate: async ({ response }) =>
                response.ok && response.headers.get('X-HealthSync-Build') === APP_BUILD_ID &&
                // Only public, local-first app shells are eligible for offline use.
                ['/dash', '/food', '/drinks', '/'].includes(new URL(response.url).pathname) ? response : null }],
        }) },
        // Retain content-addressed old assets for tabs still running that build.
        { matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/_next/static/'), handler: new CacheFirst({
            cacheName: 'healthsync-immutable-assets',
            plugins: [{ cachedResponseWillBeUsed: async ({ cachedResponse, request }) => {
                if (cachedResponse) return cachedResponse;
                const url = new URL(request.url);
                url.searchParams.delete('dpl');
                for (const name of await caches.keys()) {
                    if (!name.startsWith('healthsync-precache-') && !name.startsWith('serwist-precache-')) continue;
                    const response = await (await caches.open(name)).match(url.href);
                    if (response) return response;
                }
                return undefined;
            } }],
        }) },
        ...defaultCache,
    ],
});

serwist.setCatchHandler(async ({ request }) => {
    if (request.mode === 'navigate') {
        const cached = await serwist.matchPrecache('/offline.html');
        if (cached) return cached;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'HEALTHSYNC_BUILD') event.ports[0]?.postMessage({ buildId: APP_BUILD_ID });
    if (event.data?.type === 'SKIP_WAITING') {
        void self.skipWaiting();
    }
});

self.addEventListener('push', (event) => {
    // Only recognized categories select fixed copy; payload text is never displayed.
    const copies: Record<string, string> = {
        breakfast: 'Ready to log your breakfast in HealthSync?',
        lunch: 'Ready to log your lunch in HealthSync?',
        supplements: 'Would you like to log supplements in HealthSync?',
        snack: 'Ready to log your snack in HealthSync?',
        dinner: 'Ready to log your dinner in HealthSync?',
    };
    let category: string | undefined;
    try {
        const payload = event.data?.json();
        if (payload?.type === 'healthsync-reminder' && typeof payload.category === 'string' && Object.hasOwn(copies, payload.category)) category = payload.category;
    } catch { /* Legacy and malformed test payloads keep the existing test message. */ }
    event.waitUntil(self.registration.showNotification('HealthSync', {
        body: category ? copies[category] : 'Notifications are ready. This is a test notification.',
        icon: '/favicon.png', tag: category ? `healthsync-reminder-${category}` : 'healthsync-test',
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
