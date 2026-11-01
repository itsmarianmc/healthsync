import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader } from './helpers/loadTs.mjs';
const { defaultReminderPreferences, parseReminderPreferences } = moduleLoader()('./reminderPreferences');

test('reminders and all categories default off, independently of device state', () => {
    const prefs = defaultReminderPreferences();
    assert.equal(prefs.enabled, false);
    assert.deepEqual(Object.values(prefs.categories), [false, false, false, false, false]);
    assert.deepEqual(parseReminderPreferences(prefs), prefs);
});

test('preference schema requires explicit booleans and at least one category when enabled', () => {
    const prefs = defaultReminderPreferences();
    assert.equal(parseReminderPreferences({ ...prefs, enabled: true }), null);
    assert.deepEqual(parseReminderPreferences({ ...prefs, enabled: true, categories: { ...prefs.categories, lunch: true } }), { ...prefs, enabled: true, categories: { ...prefs.categories, lunch: true } });
    assert.equal(parseReminderPreferences({ ...prefs, user_id: 'other' }), null);
    assert.equal(parseReminderPreferences({ ...prefs, categories: { ...prefs.categories, lunch: 'true' } }), null);
    assert.equal(parseReminderPreferences({ ...prefs, categories: { ...prefs.categories, extra: true } }), null);
});

import { readFileSync } from 'node:fs';
import ts from 'typescript';
function routeFixture({ authorized = true, data = null, failure = false } = {}) {
    const operations = [];
    const builder = { select() { return this; }, eq(key, value) { operations.push([key, value]); return this; },
        async maybeSingle() { return { data, error: failure }; },
        async upsert(row) { operations.push(row); return { error: failure }; } };
    const helper = { pushAuthorization: async () => authorized ? { userId: 'owner', client: { from: () => builder } } : null,
        pushBody: async req => req.json(), pushJson: (body, status = 200) => Response.json(body, { status }) };
    const js = ts.transpileModule(readFileSync('src/app/api/push/reminders/preferences/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', js)(name => name.endsWith('pushServer') ? helper : { defaultReminderPreferences, parseReminderPreferences }, mod, mod.exports);
    return { handlers: mod.exports, operations };
}
const request = body => new Request('https://healthsync.example/', { method: 'PUT', body: JSON.stringify(body) });

test('preferences require authorization and are always scoped to the verified owner', async () => {
    let f = routeFixture({ authorized: false });
    assert.equal((await f.handlers.GET(request({}))).status, 403);
    assert.equal((await f.handlers.PUT(request(defaultReminderPreferences()))).status, 403);
    assert.equal(f.operations.length, 0);
    f = routeFixture();
    const result = await (await f.handlers.GET(request({}))).json();
    assert.deepEqual(result.preferences, defaultReminderPreferences());
    assert.deepEqual(f.operations[0], ['user_id', 'owner']);
    const prefs = defaultReminderPreferences(); prefs.enabled = true; prefs.categories.dinner = true;
    assert.equal((await f.handlers.PUT(request(prefs))).status, 200);
    assert.equal(f.operations[1].user_id, 'owner');
    assert.equal(f.operations[1].consent_version, 1);
    assert.ok(f.operations[1].consent_at);
    assert.equal((await f.handlers.PUT(request({ ...prefs, user_id: 'victim' }))).status, 400);
});

test('storage failures remain errors and never appear as default preferences', async () => {
    const f = routeFixture({ failure: true });
    assert.equal((await f.handlers.GET(request({}))).status, 503);
    assert.equal((await f.handlers.PUT(request(defaultReminderPreferences()))).status, 503);
});
