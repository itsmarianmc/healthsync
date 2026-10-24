import { NextRequest } from 'next/server';
import webpush from 'web-push';
import { pushAuthorization, pushBody, pushConfig, pushJson } from '../../../_lib/pushServer';
import { isPushEndpoint, parsePushSubscription } from '../../../_lib/pushValidation';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
    try {
        const auth = await pushAuthorization(request);
        if (!auth) return pushJson({ ok: false, error: 'authorization_required' }, 403);
        const config = pushConfig();
        if (!config) return pushJson({ ok: false, error: 'not_configured' }, 503);
        const { endpoint } = await pushBody(request);
        if (!isPushEndpoint(endpoint)) return pushJson({ ok: false, error: 'invalid_subscription' }, 400);
        const { data, error } = await auth.client.from('push_subscriptions').select('endpoint,p256dh,auth')
            .eq('user_id', auth.userId).eq('endpoint', endpoint).maybeSingle();
        if (error) return pushJson({ ok: false, error: 'storage_unavailable' }, 503);
        if (!data) return pushJson({ ok: false, error: 'subscription_missing' }, 404);
        const sub = parsePushSubscription({ endpoint: data.endpoint, keys: { p256dh: data.p256dh, auth: data.auth } });
        if (!sub) return pushJson({ ok: false, error: 'invalid_subscription' }, 400);
        // Database-backed atomic limit works across Vercel instances and cold starts.
        const limit = await auth.client.rpc('claim_push_test');
        if (limit.error) return pushJson({ ok: false, error: 'storage_unavailable' }, 503);
        if (limit.data !== true) return pushJson({ ok: false, error: 'rate_limited' }, 429);
        try {
            await webpush.sendNotification(sub, JSON.stringify({ type: 'healthsync-test' }), {
                vapidDetails: config, TTL: 60, timeout: 10_000, urgency: 'normal',
            });
        } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
                const removed = await auth.client.from('push_subscriptions').delete().eq('user_id', auth.userId).eq('endpoint', endpoint);
                if (removed.error) return pushJson({ ok: false, error: 'storage_unavailable' }, 503);
                return pushJson({ ok: false, error: 'subscription_expired' }, 410);
            }
            return pushJson({ ok: false, error: 'delivery_failed' }, 502);
        }
        return pushJson({ ok: true });
    } catch { return pushJson({ ok: false, error: 'service_unavailable' }, 503); }
}
