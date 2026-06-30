import { supabase } from './supabase';

export interface ChangelogEntry {
    id: string;
    version: string;
    title: string;
    description: string;
    category: string;
    created_at?: string | null;
}

interface ProfileChangelogState {
    last_seen_changelog_version: string | null;
}

function splitVersion(version: string): number[] {
    return version
        .split(/[.-]/)
        .map((part) => Number.parseInt(part.replace(/[^0-9]/g, ''), 10) || 0);
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

export async function fetchChangelogEntries(): Promise<ChangelogEntry[]> {
    const { data, error } = await supabase
        .from('changelog_entries')
        .select('id, version, title, description, category, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[changelog] fetch entries error:', error.message);
        return [];
    }

    return (data ?? []) as ChangelogEntry[];
}

export async function fetchLastSeenChangelogVersion(userId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('last_seen_changelog_version')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('[changelog] fetch last seen error:', error.message);
        return null;
    }

    return (data as ProfileChangelogState | null)?.last_seen_changelog_version ?? null;
}

export async function storeLastSeenChangelogVersion(userId: string, version: string): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .update({ last_seen_changelog_version: version })
        .eq('id', userId);

    if (error) {
        console.error('[changelog] store last seen error:', error.message);
    }
}