import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadSync({ session, readError = null, row = null }) {
  const source = readFileSync('src/app/_lib/sync.ts', 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const supabase = {
    auth: { getSession: async () => ({ data: { session } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: readError }) }) }),
    }),
  };
  const requireMock = path => {
    if (path === './supabase') return { supabase };
    if (path === './localData') return { activeOwner: () => 'user-A' };
    throw new Error(`Unexpected module: ${path}`);
  };
  new Function('require', 'module', 'exports', js)(requireMock, loaded, loaded.exports);
  return loaded.exports.syncWorkouts;
}

test('workout sync rejects missing authorization', async () => {
  await assert.rejects(loadSync({ session: null })('user-A'), /authorization/i);
});

test('workout sync rejects a settings read failure', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true });
  try {
    const syncWorkouts = loadSync({ session: { access_token: 'test-token' }, readError: { code: 'read_failed' } });
    await assert.rejects(syncWorkouts('user-A'), /read workout routines/i);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('workout sync accepts an account with no routines', async () => {
  const previousFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  globalThis.fetch = async () => ({ ok: true });
  globalThis.localStorage = { getItem: () => null };
  try {
    const syncWorkouts = loadSync({ session: { access_token: 'test-token' }, row: { workout_routines: null } });
    assert.equal(await syncWorkouts('user-A'), null);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousStorage;
  }
});
