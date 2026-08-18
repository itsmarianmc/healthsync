import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

        const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
        });

        const { data: { user }, error: authError } = await anonClient.auth.getUser();
        if (authError || !user || user.id !== userId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const admin = createClient(supabaseUrl, serviceRoleKey);

        const tables = ['calsync_entries', 'dropsync_entries', 'user_settings', 'workout_sessions'];
        for (const table of tables) {
            const { error } = await admin.from(table).delete().eq('user_id', userId);
            if (error) console.error(`[account/delete] ${table} delete error:`, error.message);
        }

        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) {
            console.error('[account/delete] auth user delete error:', deleteError.message);
            return NextResponse.json({ ok: false, error: 'Failed to delete account' }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
    }
}
