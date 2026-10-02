type ErrorShape = {
    message?: unknown;
    code?: unknown;
    status?: unknown;
};

function getErrorText(error: unknown): { message: string; code: string; status: number | null } {
    if (!error || typeof error !== 'object') return { message: String(error ?? ''), code: '', status: null };
    const value = error as ErrorShape;
    return {
        message: typeof value.message === 'string' ? value.message.toLowerCase() : '',
        code: typeof value.code === 'string' ? value.code.toLowerCase() : '',
        status: typeof value.status === 'number' ? value.status : null,
    };
}

/** Convert provider errors to short, actionable copy without exposing their raw text. */
export function authErrorMessage(error: unknown, fallback: string): string {
    const { message, code, status } = getErrorText(error);
    const text = `${code} ${message}`;

    if (/invalid_credentials|invalid login credentials|email or password/.test(text)) {
        return 'Email or password is incorrect. Check both and try again.';
    }
    if (/email_not_confirmed|email not confirmed|confirm your email/.test(text)) {
        return 'Please confirm your email address before signing in.';
    }
    if (/user_already_exists|already registered|user already registered/.test(text)) {
        return 'An account with this email already exists. Try signing in instead.';
    }
    if (/weak_password|password should be|password is too weak/.test(text)) {
        return 'Choose a stronger password that meets the requirements shown above.';
    }
    if (/invalid_otp|otp_expired|invalid.*(code|token)|expired.*(code|token)/.test(text)) {
        return 'That code is invalid or expired. Check the current code and try again.';
    }
    if (/factor.*already|already.*factor|friendly name.*already exists/.test(text)) {
        return 'An authenticator is already registered. Open 2FA settings to use or replace it.';
    }
    if (/rate.?limit|too many requests|too many attempts/.test(text) || status === 429) {
        return 'Too many attempts. Wait a few minutes, then try again.';
    }
    if (/failed to fetch|network|connection/.test(text)) {
        return 'Connection problem. Check your internet connection and try again.';
    }
    return fallback;
}

