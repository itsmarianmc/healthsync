export interface ChangelogEntry {
    id: string;
    version: string;
    title: string;
    description: string;
    category: string;
    created_at?: string | null;
}

export function compareVersions(left: string, right: string): number {
    const leftParts = splitVersion(left);
    const rightParts = splitVersion(right);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
        const a = leftParts[index] ?? 0;
        const b = rightParts[index] ?? 0;
        if (a !== b) return a - b;
    }

    return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function splitVersion(version: string): number[] {
    return version
        .split(/[.-]/)
        .map((part) => Number.parseInt(part.replace(/[^0-9]/g, ''), 10) || 0);
}

function convertJsonToChangelogEntries(jsonData: Record<string, Record<string, string[]>>): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];
    let id = 0;

    for (const [version, categories] of Object.entries(jsonData)) {
        for (const [category, descriptions] of Object.entries(categories)) {
            const description = descriptions.join(' ');

            entries.push({
                id: String(id++),
                version,
                title: category,
                description,
                category: category.toLowerCase(),
                created_at: new Date().toISOString(),
            });
        }
    }

    return entries;
}

export async function fetchChangelogEntries(): Promise<ChangelogEntry[]> {
    try {
        const response = await fetch('/changelog.json');

        if (!response.ok) {
            throw new Error(`Failed to fetch changelog: ${response.status}`);
        }

        const jsonData = await response.json();
        return convertJsonToChangelogEntries(jsonData);
    } catch (error) {
        console.error('[changelog] fetch entries error:', error);
        return [];
    }
}

export async function fetchLastSeenChangelogVersion(userId: string): Promise<string | null> {
    return null;
}

export async function storeLastSeenChangelogVersion(userId: string, version: string): Promise<void> {
    return;
}

export const LAST_SEEN_STORAGE_KEY = 'healthsync_last_seen_changelog_version';
export const PENDING_RELOAD_STORAGE_KEY = 'healthsync_pending_reload_after_update';

export function readLocalLastSeen(): string | null {
    try {
        return localStorage.getItem(LAST_SEEN_STORAGE_KEY);
    } catch (error) {
        return null;
    }
}

export function writeLocalLastSeen(version: string): void {
    try {
        localStorage.setItem(LAST_SEEN_STORAGE_KEY, version);
    } catch (error) {}
}

export function readPendingReloadAfterUpdate(): boolean {
    try {
        return localStorage.getItem(PENDING_RELOAD_STORAGE_KEY) === 'true';
    } catch (error) {
        return false;
    }
}

export function writePendingReloadAfterUpdate(pending: boolean): void {
    try {
        localStorage.setItem(PENDING_RELOAD_STORAGE_KEY, String(pending));
    } catch (error) {}
}

export function pickHigherVersion(left: string | null, right: string | null): string | null {
    if (!left) return right;
    if (!right) return left;
    return compareVersions(left, right) >= 0 ? left : right;
}

export async function syncLastSeenVersion(
    userId: string,
    localVersion: string,
    supabaseVersion: string | null,
): Promise<void> {
}