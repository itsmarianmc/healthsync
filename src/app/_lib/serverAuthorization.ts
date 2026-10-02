import { createClient } from '@supabase/supabase-js';
import { hasVerifiedMfaFactor, protectedApiMayProceed } from './mfaPolicy';

export async function authorizeProtectedRequest(accessToken: string, userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !accessToken || !userId) return false;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await client.auth.getUser(accessToken);
  if (error || user?.id !== userId) return false;
  const { data: level, error: levelError } = await client.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
  return !levelError && !!level && protectedApiMayProceed(
    level.currentLevel,
    hasVerifiedMfaFactor(user.factors),
  );
}
