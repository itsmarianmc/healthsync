import { clearPending, entryChangedSince, entryMutationRevision, markPending, pendingDeleted, pendingIds, restoredFoodIds, workspaceGuard } from './localData';
import { entriesToUpload } from './syncPolicy';

type Entry = { id: string; ts: number };
export type EntrySnapshot<T> = { entries: T[]; deletedIds: string[] };

// Pull must return a verified complete collection, or null on any incomplete read.
export async function syncEntries<T extends Entry>(
  kind: 'food' | 'drinks', userId: string,
  pull: (owner: string) => Promise<EntrySnapshot<T> | null>,
  push: (entries: T[], owner: string) => Promise<void>,
): Promise<void> {
  const isCurrent = workspaceGuard(userId);
  const assertCurrent = () => { if (!isCurrent()) throw new Error('Workspace changed during entry sync'); };
  assertCurrent();
  const key = kind === 'food' ? 'calsync_v1' : 'dropsync_v3';
  const read = (): T[] => JSON.parse(localStorage.getItem(key) || '[]');
  const initialIds = new Set(read().map(entry => entry.id));
  const revision = entryMutationRevision();
  const cloud = await pull(userId);
  assertCurrent();
  if (!cloud) throw new Error('Unable to read complete entry history');
  const localDeleted = () => new Set(pendingDeleted<T>(kind).map(entry => entry.id));
  const blocked = localDeleted();
  const upload = entriesToUpload(read().filter(entry => !blocked.has(entry.id)), pendingIds(kind), cloud.deletedIds, cloud.entries.map(entry => entry.id));
  // Legacy local records need the same durable retry information as new writes.
  upload.forEach(entry => markPending(kind, entry.id, false));
  if (upload.length) await push(upload, userId);
  assertCurrent();
  const final = upload.length ? await pull(userId) : cloud;
  assertCurrent();
  if (!final) throw new Error('Unable to confirm complete entry history');

  // Read again immediately before the synchronous commit, including successful
  // single uploads whose pending marker has already been acknowledged.
  const current = read();
  const currentIds = new Set(current.map(entry => entry.id));
  const deleted = localDeleted();
  const tombstones = new Set(final.deletedIds);
  const restored = kind === 'food' ? restoredFoodIds() : new Set<string>();
  const changed = (id: string) => entryChangedSince(kind, id, revision);
  const removed = (id: string) => deleted.has(id) || (!currentIds.has(id) && (initialIds.has(id) || changed(id)));
  const pending = pendingIds(kind);
  const merged = new Map(final.entries.filter(entry => !removed(entry.id)).map(entry => [entry.id, entry]));
  for (const entry of current) {
    if (removed(entry.id)) continue;
    if (tombstones.has(entry.id) && !restored.has(entry.id) && !changed(entry.id)) continue;
    if (!merged.has(entry.id) || pending.has(entry.id) || changed(entry.id) || restored.has(entry.id)) merged.set(entry.id, entry);
  }
  clearPending(kind, final.deletedIds.filter(id => !merged.has(id)));
  localStorage.setItem(key, JSON.stringify([...merged.values()].sort((a, b) => a.ts - b.ts)));
  window.dispatchEvent(new Event('storage'));
}
