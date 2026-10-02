import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeProtectedRequest } from '../../../_lib/serverAuthorization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : '';
        const userId = typeof body?.userId === 'string' ? body.userId : '';

        if (!accessToken || !userId) {
            return NextResponse.json({ ok: false, error: 'Missing accessToken or userId' }, { status: 400 });
        }

        if (!(await authorizeProtectedRequest(accessToken, userId)))
            return NextResponse.json({ ok: false, error: 'Complete two-factor authentication' }, { status: 403 });

        const admin = createClient(supabaseUrl, serviceRoleKey);

        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) {
            console.error('[account/delete] account deletion failed.');
            return NextResponse.json({ ok: false, error: 'Failed to delete account' }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
    }
}
