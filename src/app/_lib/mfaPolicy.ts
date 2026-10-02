export function needsMfaVerification(
  currentLevel: string | null | undefined,
  hasVerifiedFactor: boolean,
): boolean {
  // Supabase can report nextLevel=aal2 during an unverified enrollment.
  // Only a verified factor means the user has actually enabled MFA.
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
