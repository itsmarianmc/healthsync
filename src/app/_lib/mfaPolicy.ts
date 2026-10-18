export function needsMfaVerification(
  currentLevel: string | null | undefined,
  hasVerifiedFactor: boolean,
): boolean {
  // Supabase's nextLevel=aal2 can reflect unverified enrollment; require a verified factor.
  return hasVerifiedFactor && currentLevel !== 'aal2';
}

export function protectedApiMayProceed(
  currentLevel: string | null | undefined,
  hasVerifiedFactor: boolean,
): boolean {
  return !needsMfaVerification(currentLevel, hasVerifiedFactor);
}

export function hasVerifiedMfaFactor(
  factors: ReadonlyArray<{ status: string }> | null | undefined,
): boolean {
  return factors?.some((factor) => factor.status === 'verified') ?? false;
}
