// Restrict outbound requests to known browser push services (never arbitrary URLs).
export function isPushEndpoint(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
        const url = new URL(value);
        const host = url.hostname;
        return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && (
            host === 'fcm.googleapis.com' || host === 'android.googleapis.com' ||
            host === 'updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') ||
            host === 'web.push.apple.com' || host.endsWith('.push.apple.com') ||
            host.endsWith('.notify.windows.com')
        );
    } catch { return false; }
}

export function parsePushSubscription(value: unknown) {
    const sub = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
    if (!isPushEndpoint(sub?.endpoint)) return null;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;
    if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{87}=?$/.test(p256dh) ||
        typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)) return null;
    return { endpoint: sub.endpoint, keys: { p256dh, auth } };
}
