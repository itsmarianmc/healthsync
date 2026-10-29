import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { authorizeProtectedRequest } from './serverAuthorization';

export function pushJson(body: object, status = 200) {
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function pushAuthorization(request: NextRequest) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) return null;
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !url || !key) return null;
    const client = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user || !(await authorizeProtectedRequest(token, user.id))) return null;
    return { client, userId: user.id };
}

export function pushConfig() {
    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
    const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    const subject = process.env.WEB_PUSH_VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) return null;
    try {
        // Library validation also catches malformed deployment configuration.
        webpush.setVapidDetails(subject, publicKey, privateKey);
        return { subject, publicKey, privateKey };
    } catch { return null; }
}

export async function pushBody(request: NextRequest) {
    const body = await request.text();
    if (body.length > 8192) throw new Error('Invalid push request');
    return JSON.parse(body);
}
