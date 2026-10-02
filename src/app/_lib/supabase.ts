'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
    },
});
