/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

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
    runtimeCaching: defaultCache,
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

serwist.addEventListeners();