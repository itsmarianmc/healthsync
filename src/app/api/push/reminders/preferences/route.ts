import { NextRequest } from 'next/server';
import { pushAuthorization, pushBody, pushJson } from '../../../../_lib/pushServer';
import { defaultReminderPreferences, parseReminderPreferences } from '../../../../_lib/reminderPreferences';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const auth = await pushAuthorization(request);
        if (!auth) return pushJson({ ok: false, error: 'authorization_required' }, 403);
        const { data, error } = await auth.client.from('push_reminder_preferences').select('enabled,categories,consent_at,consent_version').eq('user_id', auth.userId).maybeSingle();
        if (error) return pushJson({ ok: false, error: 'storage_unavailable' }, 503);
        if (!data) return pushJson({ ok: true, preferences: defaultReminderPreferences(), consentAt: null, consentVersion: null });
        const preferences = parseReminderPreferences({ enabled: data.enabled, categories: data.categories });
        if (!preferences) return pushJson({ ok: false, error: 'storage_unavailable' }, 503);
        return pushJson({ ok: true, preferences, consentAt: data.consent_at, consentVersion: data.consent_version });
    } catch { return pushJson({ ok: false, error: 'service_unavailable' }, 503); }
}

export async function PUT(request: NextRequest) {
    try {
        const auth = await pushAuthorization(request);
        if (!auth) return pushJson({ ok: false, error: 'authorization_required' }, 403);
        const preferences = parseReminderPreferences(await pushBody(request));
        if (!preferences) return pushJson({ ok: false, error: 'invalid_preferences' }, 400);
        const { error } = await auth.client.from('push_reminder_preferences').upsert({ user_id: auth.userId, ...preferences,
            consent_at: preferences.enabled ? new Date().toISOString() : null, consent_version: preferences.enabled ? 1 : null,
        }, { onConflict: 'user_id' });
        if (error) return pushJson({ ok: false, error: 'storage_unavailable' }, 503);
        return pushJson({ ok: true });
    } catch { return pushJson({ ok: false, error: 'service_unavailable' }, 503); }
}
