import { supabase } from './supabase';
import { readLocalLastSeen, writeLocalLastSeen } from './changelogStorage';

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
            throw new Error('changelog_unavailable');
        }

        const jsonData = await response.json();
        return convertJsonToChangelogEntries(jsonData);
    } catch {
        console.error('[changelog] could not load update notes.');
        return [];
    }
}

export async function fetchLastSeenChangelogVersion(userId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('latest_version')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        throw new Error('Could not read the account update version.');
    }

    if (!data) throw new Error('The account profile is unavailable.');
    return data.latest_version ?? null;
}

export async function storeLastSeenChangelogVersion(userId: string, version: string): Promise<void> {
    const { data, error } = await supabase
        .from('profiles')
        .update({ latest_version: version })
        .eq('id', userId)
        .select('id')
        .maybeSingle();

    if (error || data?.id !== userId) {
        throw new Error('Could not save the account update version.');
    }
}

export const PENDING_RELOAD_STORAGE_KEY = 'healthsync_pending_reload_after_update';
export { readLocalLastSeen, writeLocalLastSeen } from './changelogStorage';

export function readPendingReloadAfterUpdate(): boolean {
    try {
        return localStorage.getItem(PENDING_RELOAD_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function writePendingReloadAfterUpdate(pending: boolean): void {
    try {
        localStorage.setItem(PENDING_RELOAD_STORAGE_KEY, String(pending));
    } catch {}
}

export function pickHigherVersion(left: string | null, right: string | null): string | null {
    if (!left) return right;
    if (!right) return left;
    return compareVersions(left, right) >= 0 ? left : right;
}

export async function syncLastSeenVersion(
    userId: string,
    supabaseVersion: string | null,
): Promise<string | null> {
    const localVersion = readLocalLastSeen(userId);
    const latestSeenVersion = pickHigherVersion(localVersion, supabaseVersion);
    if (!latestSeenVersion) return null;

    if (supabaseVersion !== latestSeenVersion) {
        await storeLastSeenChangelogVersion(userId, latestSeenVersion);
    }
    if (localVersion !== latestSeenVersion) writeLocalLastSeen(userId, latestSeenVersion);

    return latestSeenVersion;
}
