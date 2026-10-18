import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader, storageFixture, deferred } from './helpers/loadTs.mjs';

let local, syncEntries, logFoodEntry, sync, writeError, writeHook, pages, ranges;
const food = id => ({ id, food: id, kcal: 100, prot: 2, carb: 3, fat: 4, ts: 1, date: new Date().toDateString() });
const snapshot = (entries = [], deletedIds = []) => ({ entries, deletedIds });
const saved = (kind = 'food') => JSON.parse(localStorage.getItem(kind === 'food' ? 'calsync_v1' : 'dropsync_v3') || '[]');

beforeEach(() => {
  storageFixture();
  writeError = null;
  writeHook = async () => {};
  pages = [];
  ranges = [];
  globalThis.fetch = async () => ({ ok: true });
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) },
    from: table => ({
      upsert: async () => { await writeHook(); return { error: writeError }; },
      select: (_fields, options) => {
        assert.equal(options.count, 'exact');
        const query = {
          eq: (key, owner) => { assert.equal(key, 'user_id'); assert.equal(owner, 'A'); return query; },
          order: key => { assert.equal(key, 'entry_id'); return query; },
          range: async (start, end) => { ranges.push({ table, start, end }); return pages.shift(); },
        };
        return query;
      },
    }),
  };
  const load = moduleLoader({ './supabase': { supabase } });
  local = load('./localData');
  sync = load('./sync');
  ({ syncEntries } = load('./entrySync'));
  ({ logFoodEntry } = load('./foodLog'));
  local.switchWorkspace('A');
});

for (const kind of ['food', 'drinks']) for (const fails of [true, false]) {
  test(`stale final pull preserves parallel single ${kind} upload (${fails ? 'failed' : 'successful, pending cleared'})`, async () => {
    const initial = food('initial');
    localStorage.setItem(kind === 'food' ? 'calsync_v1' : 'dropsync_v3', JSON.stringify([initial]));
    local.markPending(kind, initial.id);
    const finalStarted = deferred();
    const final = deferred();
    let pulls = 0;
    const running = syncEntries(kind, 'A', async () => {
      if (++pulls === 1) return snapshot();
      finalStarted.resolve();
      return final.promise;
    }, kind === 'food' ? sync.pushFoodEntriesToCloud : async (entries, owner) => { for (const entry of entries) await sync.syncDrinkToCloud(entry, owner); });
    await finalStarted.promise;
    writeError = fails ? { code: 'offline' } : null;
    assert.equal((await logFoodEntry({ ...food('parallel'), isDrink: kind === 'drinks' }, 'A')).cloudPending, fails);
    assert.equal(local.pendingIds(kind).has('parallel'), fails);
    final.resolve(snapshot([initial]));
    await running;
    assert.deepEqual(saved(kind).map(entry => entry.id), ['initial', 'parallel']);
    assert.equal(local.pendingIds(kind).has('parallel'), fails);
  });
}

test('save, module reload, offline failure, then retry retains entry and durable pending information', async () => {
  writeError = { code: 'offline' };
  await logFoodEntry(food('offline'), 'A');
  const reloaded = moduleLoader()('./entrySync');
  await assert.rejects(reloaded.syncEntries('food', 'A', async () => snapshot(), async () => { throw new Error('offline'); }));
  assert.deepEqual(saved().map(entry => entry.id), ['offline']);
  assert.equal(local.pendingIds('food').has('offline'), true);
  writeError = null;
  let pulls = 0;
  await syncEntries('food', 'A', async () => snapshot(++pulls === 1 ? [] : [food('offline')]), sync.pushFoodEntriesToCloud);
  assert.equal(local.pendingIds('food').size, 0);
  assert.equal(saved().length, 1);
});

test('failed legacy recovery queues retry before upload', async () => {
  localStorage.setItem('calsync_v1', JSON.stringify([food('legacy')]));
  await assert.rejects(syncEntries('food', 'A', async () => snapshot(), async () => { throw new Error('offline'); }));
  assert.equal(local.pendingIds('food').has('legacy'), true);
  assert.equal(saved().length, 1);
});

for (const kind of ['food', 'drinks']) {
  test(`${kind}: local deletion completed during pull cannot be resurrected`, async () => {
    const entry = food('deleted');
    const key = kind === 'food' ? 'calsync_v1' : 'dropsync_v3';
    localStorage.setItem(key, JSON.stringify([entry]));
    const response = deferred();
    const running = syncEntries(kind, 'A', () => response.promise, async () => {});
    localStorage.setItem(key, '[]');
    local.markDeleted(kind, entry);
    local.clearDeleted(kind, [entry.id]);
    response.resolve(snapshot([entry]));
    await running;
    assert.deepEqual(saved(kind), []);
  });
}

test('remote tombstones win over old local and pending entries', async () => {
  localStorage.setItem('calsync_v1', JSON.stringify([food('remote-delete')]));
  local.markPending('food', 'remote-delete');
  await syncEntries('food', 'A', async () => snapshot([], ['remote-delete']), async () => assert.fail('must not upload tombstone'));
  assert.deepEqual(saved(), []);
  assert.equal(local.pendingIds('food').size, 0);
});

for (const fails of [true, false]) {
  test(`Undo during a stale tombstone pull survives ${fails ? 'failed' : 'successful'} restore`, async () => {
    const entry = food('undo');
    localStorage.setItem('calsync_v1', JSON.stringify([entry]));
    const response = deferred();
    const running = syncEntries('food', 'A', () => response.promise, async () => {});
    localStorage.setItem('calsync_v1', '[]');
    local.markDeleted('food', entry);
    localStorage.setItem('calsync_v1', JSON.stringify([entry, food('added-later')]));
    writeError = fails ? { code: 'offline' } : null;
    await sync.restoreFoodInCloud(entry, 'A').catch(() => {});
    response.resolve(snapshot([], ['undo']));
    await running;
    assert.deepEqual(saved().map(item => item.id), ['undo', 'added-later']);
    assert.equal(local.restoredFoodIds().has('undo'), fails);
  });
}

test('pending local deletion also blocks an upload and stale cloud row', async () => {
  const entry = food('pending-delete');
  localStorage.setItem('calsync_v1', JSON.stringify([entry]));
  local.markDeleted('food', entry);
  await syncEntries('food', 'A', async () => snapshot([entry]), async () => assert.fail('deleted entry upload'));
  assert.deepEqual(saved(), []);
  assert.equal(local.pendingDeleted('food').length, 1);
});

for (const action of ['switch', 'switch-back', 'reset']) {
  test(`pending sync rejects workspace ${action}`, async () => {
    localStorage.setItem('calsync_v1', JSON.stringify([food('A')]));
    const response = deferred();
    const running = syncEntries('food', 'A', () => response.promise, async () => {});
    if (action === 'reset') local.clearActiveHealthData();
    else {
      local.switchWorkspace('B');
      if (action === 'switch-back') local.switchWorkspace('A');
    }
    const before = localStorage.getItem('calsync_v1');
    response.resolve(snapshot([food('cloud')]));
    await assert.rejects(running, /Workspace changed/);
    assert.equal(localStorage.getItem('calsync_v1'), before);
  });
}

for (const method of ['pullFoodFromCloud', 'pullDrinksFromCloud']) {
  test(`${method} paginates below a server cap and includes tombstones`, async () => {
    pages = [
      { data: [{ entry_id: 'a', ts: 1 }], count: 3, error: null },
      { data: [{ entry_id: 'b', deleted_at: '2026-10-17' }], count: 3, error: null },
      { data: [{ entry_id: 'c', ts: 3 }], count: 3, error: null },
    ];
    const result = await sync[method]('A');
    assert.deepEqual(result.entries.map(item => item.id), ['a', 'c']);
    assert.deepEqual(result.deletedIds, ['b']);
    assert.deepEqual(ranges.map(range => range.start), [0, 1, 2]);
  });
  for (const problem of ['missing-count', 'truncated', 'changed-count', 'duplicate', 'error']) {
    test(`${method} rejects ${problem} instead of returning a complete collection`, async () => {
      pages = [
        { data: [{ entry_id: 'a' }], count: problem === 'missing-count' ? null : 2, error: null },
        { data: problem === 'duplicate' ? [{ entry_id: 'a' }] : [], count: problem === 'changed-count' ? 3 : 2, error: problem === 'error' ? {} : null },
      ];
      assert.equal(await sync[method]('A'), null);
    });
  }
}


for (const method of ['pushFoodEntriesToCloud', 'syncDrinkToCloud']) {
  test(`${method}: a response from before A -> B -> A cannot acknowledge current pending work`, async () => {
    const kind = method === 'pushFoodEntriesToCloud' ? 'food' : 'drinks';
    const started = deferred();
    const response = deferred();
    writeHook = async () => { started.resolve(); await response.promise; };
    local.markPending(kind, 'meal');
    const running = sync[method](kind === 'food' ? [food('meal')] : food('meal'), 'A');
    await started.promise;
    local.switchWorkspace('B');
    local.switchWorkspace('A');
    response.resolve();
    await assert.rejects(running, /Workspace changed/);
    assert.equal(local.pendingIds(kind).has('meal'), true);
  });
}

for (const older of ['delete', 'restore']) {
  test(`late ${older} response queues the newer opposite intent for repair`, async () => {
    const entry = food('overlap');
    localStorage.setItem('calsync_v1', older === 'delete' ? '[]' : JSON.stringify([entry]));
    const started = deferred();
    const response = deferred();
    writeHook = async () => { started.resolve(); await response.promise; };
    const running = older === 'delete' ? sync.deleteFoodFromCloud(entry, 'A') : sync.restoreFoodInCloud(entry, 'A');
    await started.promise;
    writeHook = async () => {};
    if (older === 'delete') {
      localStorage.setItem('calsync_v1', JSON.stringify([entry]));
      await sync.restoreFoodInCloud(entry, 'A');
      assert.equal(local.restoredFoodIds().size, 0);
    } else {
      localStorage.setItem('calsync_v1', '[]');
      await sync.deleteFoodFromCloud(entry, 'A');
      assert.equal(local.pendingDeleted('food').length, 0);
    }
    response.resolve();
    await running;
    if (older === 'delete') assert.equal(local.restoredFoodIds().has(entry.id), true);
    else assert.deepEqual(local.pendingDeleted('food').map(item => item.id), [entry.id]);
  });
}

test('incomplete final confirmation preserves current local entries and concurrent retry markers', async () => {
  const initial = food('initial');
  localStorage.setItem('calsync_v1', JSON.stringify([initial]));
  let reads = 0;
  const finalStarted = deferred();
  const final = deferred();
  const running = syncEntries('food', 'A', async () => {
    if (++reads === 1) return snapshot();
    finalStarted.resolve();
    return final.promise;
  }, sync.pushFoodEntriesToCloud);
  await finalStarted.promise;
  writeError = { code: 'offline' };
  await logFoodEntry(food('concurrent'), 'A');
  final.resolve(null);
  await assert.rejects(running, /complete entry history/);
  assert.deepEqual(saved().map(entry => entry.id), ['initial', 'concurrent']);
  assert.equal(local.pendingIds('food').has('concurrent'), true);
});
