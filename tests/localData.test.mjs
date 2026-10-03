import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

async function loadTypeScript(path) {
  const source = readFileSync(resolve(path), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const local = await loadTypeScript('src/app/_lib/localData.ts');
const { csvEscape } = await loadTypeScript('src/app/_lib/csv.ts');
const { entriesToUpload, mustDiscardAfterReset } = await loadTypeScript('src/app/_lib/syncPolicy.ts');
const { hasVerifiedMfaFactor, needsMfaVerification, protectedApiMayProceed } = await loadTypeScript('src/app/_lib/mfaPolicy.ts');
const changelogStorage = await loadTypeScript('src/app/_lib/changelogStorage.ts');

beforeEach(() => {
  const items = new Map();
  globalThis.localStorage = {
    getItem: key => items.has(key) ? items.get(key) : null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: key => items.delete(key),
  };
  globalThis.window = { dispatchEvent: () => {} };
});

test('legacy data stays in guest workspace across two account switches', () => {
  localStorage.setItem('calsync_v1', JSON.stringify([{ id: 'guest-meal' }]));
  local.switchWorkspace('user-A');
  assert.equal(localStorage.getItem('calsync_v1'), null);
  localStorage.setItem('calsync_v1', JSON.stringify([{ id: 'A-meal' }]));
  local.switchWorkspace('user-B');
  assert.equal(localStorage.getItem('calsync_v1'), null);
  local.switchWorkspace('user-A');
  assert.deepEqual(JSON.parse(localStorage.getItem('calsync_v1')), [{ id: 'A-meal' }]);
  local.switchWorkspace('guest');
  assert.deepEqual(JSON.parse(localStorage.getItem('calsync_v1')), [{ id: 'guest-meal' }]);
});

test('workspace switch leaves active data untouched when saving the snapshot fails', () => {
  local.switchWorkspace('user-A');
  localStorage.setItem('calsync_v1', '[{"id":"A-meal"}]');
  const setItem = localStorage.setItem;
  localStorage.setItem = (key, value) => {
    if (key === 'healthsync_workspace_user-A') throw new Error('Quota exceeded');
    setItem(key, value);
  };
  assert.throws(() => local.switchWorkspace('user-B'), /Quota exceeded/);
  assert.equal(local.activeOwner(), 'user-A');
  assert.equal(localStorage.getItem('calsync_v1'), '[{"id":"A-meal"}]');
});

test('workspace switch leaves active data untouched for invalid target JSON', () => {
  local.switchWorkspace('user-A');
  localStorage.setItem('calsync_v1', '[{"id":"A-meal"}]');
  localStorage.setItem('healthsync_workspace_user-B', '{invalid');
  assert.throws(() => local.switchWorkspace('user-B'), SyntaxError);
  assert.equal(local.activeOwner(), 'user-A');
  assert.equal(localStorage.getItem('calsync_v1'), '[{"id":"A-meal"}]');
});

test('workspace switch restores active data when loading the target fails', () => {
  local.switchWorkspace('user-A');
  localStorage.setItem('calsync_v1', '[{"id":"A-meal"}]');
  localStorage.setItem('healthsync_workspace_user-B', JSON.stringify({ calsync_v1: '[{"id":"B-meal"}]' }));
  const setItem = localStorage.setItem;
  let failed = false;
  localStorage.setItem = (key, value) => {
    if (!failed && key === 'calsync_v1' && value.includes('B-meal')) {
      failed = true;
      throw new Error('Quota exceeded');
    }
    setItem(key, value);
  };
  assert.throws(() => local.switchWorkspace('user-B'), /Quota exceeded/);
  assert.equal(local.activeOwner(), 'user-A');
  assert.equal(localStorage.getItem('calsync_v1'), '[{"id":"A-meal"}]');
  assert.equal(localStorage.getItem('healthsync_workspace_user-A') !== null, true);
});

test('guest import transfers entries, preserves preferences and deduplicates', () => {
  localStorage.setItem('dropsync_v3', JSON.stringify([{ id: 'guest-drink' }]));
  localStorage.setItem('calsync_v1', JSON.stringify([{ id: 'guest-food' }, { id: 'guest-food' }]));
  localStorage.setItem('calsync_theme', 'forest');
  localStorage.setItem('calsync_ai_api_key', 'guest-key');
  local.switchWorkspace('user-A');
  local.importGuestData('user-A');
  assert.deepEqual(JSON.parse(localStorage.getItem('dropsync_v3')), [{ id: 'guest-drink' }]);
  assert.deepEqual(JSON.parse(localStorage.getItem('calsync_v1')), [{ id: 'guest-food' }]);
  assert.deepEqual([...local.pendingIds('drinks')], ['guest-drink']);
  const guest = JSON.parse(localStorage.getItem('healthsync_workspace_guest'));
  assert.deepEqual(JSON.parse(guest.dropsync_v3), []);
  assert.deepEqual(JSON.parse(guest.calsync_v1), []);
  assert.equal(guest.calsync_theme, 'forest');
  assert.equal(guest.calsync_ai_api_key, 'guest-key');
  local.switchWorkspace('user-B');
  assert.equal(localStorage.getItem('dropsync_v3'), null);
});

test('settings acknowledgement preserves values changed while a cloud write was in flight', () => {
  local.queueSettings({ goal_ml: 2500, workout_routines: { routines: ['A'] } });
  const sent = JSON.parse(localStorage.getItem('healthsync_pending_settings'));
  local.queueSettings({ goal_ml: 3000 });
  local.acknowledgeSettings(sent);
  assert.deepEqual(JSON.parse(localStorage.getItem('healthsync_pending_settings')), { goal_ml: 3000 });
});

test('Delete All Data clears health settings, drafts, favorites and sync queues', () => {
  for (const key of ['calsync_active_draft', 'calsync_favourites', 'healthsync_rest_seconds', 'healthsync_pending_food']) {
    localStorage.setItem(key, 'fixture');
  }
  local.clearActiveHealthData();
  for (const key of ['calsync_active_draft', 'calsync_favourites', 'healthsync_rest_seconds', 'healthsync_pending_food']) {
    assert.equal(localStorage.getItem(key), null);
  }
});

test('failed writes retain pending IDs and offline deletes supersede uploads', () => {
  local.markPending('food', 'meal-1');
  assert.deepEqual([...local.pendingIds('food')], ['meal-1']);
  local.markDeleted('food', { id: 'meal-1', food: 'Lunch' });
  assert.deepEqual([...local.pendingIds('food')], []);
  assert.deepEqual(local.pendingDeleted('food'), [{ id: 'meal-1', food: 'Lunch' }]);
  local.markRestoredFood('meal-1');
  assert.deepEqual(local.pendingDeleted('food'), []);
  assert.deepEqual([...local.restoredFoodIds()], ['meal-1']);
});

test('CSV user strings cannot start a spreadsheet formula', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=HYPERLINK("x")', '\n=2']) {
    const cell = csvEscape(value);
    assert.match(cell.replace(/^"|"$/g, ''), /^'/);
  }
  assert.equal(csvEscape(42), '42');
  assert.equal(csvEscape('plain,"quoted"'), '"plain,""quoted"""');
});

test('a second device cannot reupload a cloud tombstone', () => {
  const oldDevice = [{ id: 'deleted-on-other-device' }, { id: 'offline-new' }];
  const pending = new Set(oldDevice.map(entry => entry.id));
  assert.deepEqual(entriesToUpload(oldDevice, pending, ['deleted-on-other-device'], ['already-in-cloud']), [{ id: 'offline-new' }]);
});

test('legacy local entries absent from cloud are recovered even without pending markers', () => {
  const localEntries = [{ id: 'legacy-offline' }, { id: 'legacy-offline' }, { id: 'already-in-cloud' }, { id: 'deleted-remotely' }];
  assert.deepEqual(
    entriesToUpload(localEntries, new Set(), ['deleted-remotely'], ['already-in-cloud']),
    [{ id: 'legacy-offline' }],
  );
});

test('a cloud reset invalidates an offline device queue', () => {
  assert.equal(mustDiscardAfterReset('2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z'), true);
  assert.equal(mustDiscardAfterReset('2026-09-03T00:00:00Z', '2026-09-02T00:00:00Z'), false);
  assert.equal(mustDiscardAfterReset(null, '2026-09-02T00:00:00Z'), true);
});

test('MFA is required only for verified-factor sessions below aal2', () => {
  assert.equal(hasVerifiedMfaFactor([{ status: 'unverified' }]), false);
  assert.equal(hasVerifiedMfaFactor([{ status: 'verified' }]), true);
  assert.equal(needsMfaVerification('aal1', false), false);
  assert.equal(needsMfaVerification('aal1', true), true);
  assert.equal(needsMfaVerification('aal2', true), false);
  assert.equal(protectedApiMayProceed('aal1', false), true);
  assert.equal(protectedApiMayProceed('aal1', true), false);
  assert.equal(protectedApiMayProceed('aal2', true), true);
});

test('changelog acknowledgements remain isolated across guest and two accounts', () => {
  localStorage.setItem(changelogStorage.LEGACY_LAST_SEEN_STORAGE_KEY, '9.9.9');
  assert.equal(changelogStorage.readLocalLastSeen('user-A'), null);
  assert.equal(changelogStorage.readLocalLastSeen('user-B'), null);
  assert.equal(changelogStorage.readLocalLastSeen(null), null);

  changelogStorage.writeLocalLastSeen('user-A', '4.0.0');
  changelogStorage.writeLocalLastSeen('user-B', '3.9.0');
  changelogStorage.writeLocalLastSeen(null, '3.8.0');
  assert.equal(changelogStorage.readLocalLastSeen('user-A'), '4.0.0');
  assert.equal(changelogStorage.readLocalLastSeen('user-B'), '3.9.0');
  assert.equal(changelogStorage.readLocalLastSeen(null), '3.8.0');
  assert.notEqual(changelogStorage.lastSeenStorageKey('user-A'), changelogStorage.lastSeenStorageKey('user-B'));
});
