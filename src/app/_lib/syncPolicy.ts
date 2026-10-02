export function entriesToUpload<T extends { id: string }>(
  local: T[], pending: Set<string>, cloudDeletedIds: string[], cloudEntryIds: string[] = [],
): T[] {
  const deleted = new Set(cloudDeletedIds);
  const cloud = new Set(cloudEntryIds);
  // Also recover legacy/offline local entries that predate the pending queue.
  const upload = new Map<string, T>();
  for (const entry of local) {
    if (deleted.has(entry.id) || (!pending.has(entry.id) && cloud.has(entry.id))) continue;
    // A legacy browser may contain duplicate IDs. Send one row per conflict key.
    upload.set(entry.id, entry);
  }
  return [...upload.values()];
}

export function mustDiscardAfterReset(lastSync: string | null, resetAt: string | null | undefined): boolean {
  return !!resetAt && (!lastSync || new Date(lastSync).getTime() < new Date(resetAt).getTime());
}
