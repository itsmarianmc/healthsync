import { NextRequest, NextResponse } from 'next/server';
import { authorizeProtectedRequest } from '../../../_lib/serverAuthorization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });
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

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
    }
}
