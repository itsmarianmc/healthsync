import { NextRequest } from 'next/server';
import { pushAuthorization, pushBody, pushConfig, pushJson } from '../../../_lib/pushServer';
import { isPushEndpoint, parsePushSubscription } from '../../../_lib/pushValidation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const auth = await pushAuthorization(request);
        if (!auth) return pushJson({ ok: false, error: 'authorization_required' }, 403);
        const { data, error } = await auth.client.from('push_subscriptions').select('endpoint').eq('user_id', auth.userId);
        if (error) return pushJson({ ok: false, error: 'storage_unavailable' }, 503);
        const config = pushConfig();
        return pushJson({ ok: true, endpoints: data.map(row => row.endpoint), publicKey: config?.publicKey ?? null });
    } catch { return pushJson({ ok: false, error: 'service_unavailable' }, 503); }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await pushAuthorization(request);
        if (!auth) return pushJson({ ok: false, error: 'authorization_required' }, 403);
        if (!pushConfig()) return pushJson({ ok: false, error: 'not_configured' }, 503);
        const sub = parsePushSubscription(await pushBody(request));
        if (!sub) return pushJson({ ok: false, error: 'invalid_subscription' }, 400);
        const { error } = await auth.client.from('push_subscriptions').upsert({
            user_id: auth.userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
        }, { onConflict: 'endpoint' });
        if (error) return pushJson({ ok: false, error: 'storage_unavailable' }, 503);
        return pushJson({ ok: true });
    } catch { return pushJson({ ok: false, error: 'invalid_request' }, 400); }
}

export async function DELETE(request: NextRequest) {
    try {
        const auth = await pushAuthorization(request);
        if (!auth) return pushJson({ ok: false, error: 'authorization_required' }, 403);
        const { endpoint } = await pushBody(request);
        if (!isPushEndpoint(endpoint)) return pushJson({ ok: false, error: 'invalid_subscription' }, 400);
        const { error } = await auth.client.from('push_subscriptions').delete().eq('user_id', auth.userId).eq('endpoint', endpoint);
        if (error) return pushJson({ ok: false, error: 'storage_unavailable' }, 503);
        return pushJson({ ok: true });
    } catch { return pushJson({ ok: false, error: 'invalid_request' }, 400); }
}
