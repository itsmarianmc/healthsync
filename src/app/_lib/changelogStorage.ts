// The old unscoped key is intentionally never read: its owner cannot be known.
export const LEGACY_LAST_SEEN_STORAGE_KEY = 'healthsync_last_seen_changelog_version';
const LAST_SEEN_KEY_PREFIX = 'healthsync_last_seen_changelog_version_';

export function lastSeenStorageKey(userId: string | null): string {
    return `${LAST_SEEN_KEY_PREFIX}${userId ? `user_${userId}` : 'guest'}`;
}

export function readLocalLastSeen(userId: string | null): string | null {
    try {
        return localStorage.getItem(lastSeenStorageKey(userId));
    } catch {
        return null;
    }
}

export function writeLocalLastSeen(userId: string | null, version: string): void {
    try {
        localStorage.setItem(lastSeenStorageKey(userId), version);
    } catch {
        // The update center remains usable when browser storage is unavailable.
    }
}
