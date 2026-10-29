import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { moduleLoader } from './helpers/loadTs.mjs';

const require = createRequire(import.meta.url);
function loadFile(path, mocks = {}) {
    const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', js)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports);
    return mod.exports;
}
const validation = moduleLoader()('./pushValidation');
const endpoint = 'https://fcm.googleapis.com/fcm/send/fixture';
const sub = { endpoint, keys: { p256dh: Buffer.from([4, ...Array(64).fill(1)]).toString('base64url'), auth: Buffer.alloc(16).toString('base64url') } };

test('push validation rejects arbitrary outbound destinations and malformed keys', () => {
    for (const url of ['http://fcm.googleapis.com/a', 'https://localhost/a', 'https://127.0.0.1/a', 'https://fcm.googleapis.com.evil.invalid/a', 'https://user:pass@fcm.googleapis.com/a', 'https://fcm.googleapis.com:444/a', 'https://example.invalid/']) {
        assert.equal(validation.isPushEndpoint(url), false);
    }
    for (const url of [endpoint, 'https://updates.push.services.mozilla.com/wpush/a', 'https://web.push.apple.com/a', 'https://wns2.notify.windows.com/a']) assert.equal(validation.isPushEndpoint(url), true);
    assert.deepEqual(validation.parsePushSubscription(sub), sub);
    assert.equal(validation.parsePushSubscription({ ...sub, keys: { ...sub.keys, auth: 'bad' } }), null);
});

function fixture({ authorized = true, found = true, allowed = true, sendStatus, dbError = false, limitError = false } = {}) {
    const operations = [], sends = [];
    const client = {
        from(table) {
            const op = { table, filters: [] };
            operations.push(op);
            const builder = {
                select(columns) { op.columns = columns; return builder; },
                eq(key, value) { op.filters.push([key, value]); return builder; },
                delete() { op.delete = true; return builder; },
                upsert(row) { op.row = row; return builder; },
                maybeSingle() { return Promise.resolve({ data: found ? { endpoint, ...sub.keys } : null, error: dbError }); },
                then(resolve) { resolve({ data: [{ endpoint }], error: dbError }); },
            };
            return builder;
        },
        rpc: async name => { operations.push({ rpc: name }); return { data: allowed, error: limitError }; },
    };
    const helper = {
        pushAuthorization: async () => authorized ? { client, userId: 'owner-A' } : null,
        pushBody: async request => request.json(),
        pushConfig: () => ({}),
        pushJson: (body, status = 200) => Response.json(body, { status }),
    };
    const mocks = {
        '../../../_lib/pushServer': helper,
        '../../../_lib/pushValidation': validation,
        'web-push': { sendNotification: async (...args) => { sends.push(args); if (sendStatus) throw { statusCode: sendStatus }; } },
    };
    const routes = loadFile('src/app/api/push/subscriptions/route.ts', mocks);
    const sender = loadFile('src/app/api/push/test-notification/route.ts', mocks);
    const request = (body = { endpoint }) => new Request('https://healthsync.example/api/push/test-notification', { method: 'POST', body: JSON.stringify(body) });
    return { operations, sends, routes, sender, request };
}

test('all endpoints reject unauthenticated requests before touching storage or sending', async () => {
    const f = fixture({ authorized: false });
    for (const handler of [f.routes.GET, f.routes.POST, f.routes.DELETE, f.sender.POST]) assert.equal((await handler(f.request(sub))).status, 403);
    assert.equal(f.operations.length, 0);
    assert.equal(f.sends.length, 0);
});

test('status, idempotent save, delete and test always derive the owner server-side', async () => {
    const f = fixture();
    const status = await (await f.routes.GET(f.request())).json();
    assert.deepEqual(status.endpoints, [endpoint]);
    assert.equal('keys' in status, false);
    assert.equal((await f.routes.POST(f.request({ ...sub, user_id: 'victim' }))).status, 200);
    assert.equal(f.operations[1].row.user_id, 'owner-A');
    assert.equal((await f.routes.DELETE(f.request())).status, 200);
    assert.equal((await f.sender.POST(f.request({ endpoint, userId: 'victim', payload: 'health data' }))).status, 200);
    for (const op of f.operations.filter(op => op.filters?.length)) assert.ok(op.filters.some(([key, val]) => key === 'user_id' && val === 'owner-A'));
    assert.deepEqual(JSON.parse(f.sends[0][1]), { type: 'healthsync-test' });
    assert.equal(f.sends[0][2].TTL, 60);
});

test('missing own subscription, rate limit, database and limit failures never send', async () => {
    for (const [options, expected] of [[{ found: false }, 404], [{ allowed: false }, 429], [{ dbError: true }, 503], [{ limitError: true }, 503]]) {
        const f = fixture(options);
        assert.equal((await f.sender.POST(f.request())).status, expected);
        assert.equal(f.sends.length, 0);
    }
});

test('stale service responses delete only the owned endpoint; temporary failures retain it', async () => {
    for (const status of [404, 410, 429, 500]) {
        const f = fixture({ sendStatus: status });
        assert.equal((await f.sender.POST(f.request())).status, status === 404 || status === 410 ? 410 : 502);
        const deletion = f.operations.find(op => op.delete);
        if (status === 404 || status === 410) assert.deepEqual(deletion.filters, [['user_id', 'owner-A'], ['endpoint', endpoint]]);
        else assert.equal(deletion, undefined);
    }
});

test('malformed subscription and invalid endpoint do not reach a sender', async () => {
    const f = fixture();
    assert.equal((await f.routes.POST(f.request({}))).status, 400);
    assert.equal((await f.sender.POST(f.request({ endpoint: 'https://localhost/' }))).status, 400);
    assert.equal(f.sends.length, 0);
});

test('authorization rejects a foreign Origin and checks verified identity plus MFA', async () => {
    const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon';
    let verified = false, checks = 0;
    const server = loadFile('src/app/_lib/pushServer.ts', {
        'server-only': {},
        '@supabase/supabase-js': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner-A' } }, error: null }) } }) },
        './serverAuthorization': { authorizeProtectedRequest: async (_token, id) => { checks++; assert.equal(id, 'owner-A'); return verified; } },
    });
    const request = origin => ({ headers: new Headers({ origin, authorization: 'Bearer synthetic-session' }), nextUrl: { origin: 'https://healthsync.example' } });
    try {
        assert.equal(await server.pushAuthorization(request('https://foreign.invalid')), null);
        assert.equal(checks, 0);
        assert.equal(await server.pushAuthorization(request('https://healthsync.example')), null);
        verified = true;
        assert.equal((await server.pushAuthorization(request('https://healthsync.example'))).userId, 'owner-A');
    } finally {
        if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
        if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.key;
    }
});

test('worker shows only neutral copy and keeps push status out of runtime caches', async () => {
    const listeners = {}, notifications = [];
    let config, catchHandler;
    globalThis.self = {
        location: { origin: 'https://healthsync.example' },
        __SW_MANIFEST: [],
        addEventListener: (type, handler) => { listeners[type] = handler; },
        registration: { showNotification: async (...args) => { notifications.push(args); } },
    };
    try {
        loadFile('src/app/sw.ts', {
            '@serwist/turbopack/worker': { defaultCache: ['existing-cache-rules'] },
            serwist: {
                NetworkOnly: class {},
                Serwist: class {
                    constructor(options) { config = options; }
                    setCatchHandler(handler) { catchHandler = handler; }
                    addEventListeners() {}
                },
            },
        });
        let pending;
        listeners.push({ data: { text: () => 'private food log' }, waitUntil: promise => { pending = promise; } });
        await pending;
        assert.equal(notifications[0][0], 'HealthSync');
        assert.equal(notifications[0][1].body, 'Notifications are ready. This is a test notification.');
        assert.equal(config.runtimeCaching[0].matcher({ url: new URL('https://healthsync.example/api/push/subscriptions') }), true);
        assert.equal(config.runtimeCaching[0].matcher({ url: new URL('https://healthsync.example/dash') }), false);
        assert.equal(config.runtimeCaching[1], 'existing-cache-rules');
        assert.equal(typeof catchHandler, 'function');
    } finally { delete globalThis.self; }
});

test('notification click focuses an existing app or opens the dashboard', async () => {
    const listeners = {};
    let pending, closed = 0, focused = 0, opened;
    let windows = [{ url: 'https://healthsync.example/food', focus: async () => { focused++; } }];
    globalThis.self = {
        location: { origin: 'https://healthsync.example' },
        addEventListener: (type, handler) => { listeners[type] = handler; },
        clients: { matchAll: async () => windows, openWindow: async url => { opened = url; } },
    };
    try {
        loadFile('src/app/sw.ts', {
            '@serwist/turbopack/worker': { defaultCache: [] },
            serwist: { NetworkOnly: class {}, Serwist: class { setCatchHandler() {} addEventListeners() {} } },
        });
        const event = { notification: { close: () => { closed++; } }, waitUntil: promise => { pending = promise; } };
        listeners.notificationclick(event);
        await pending;
        assert.equal(focused, 1);
        assert.equal(opened, undefined);
        windows = [];
        listeners.notificationclick(event);
        await pending;
        assert.equal(opened, '/dash');
        assert.equal(closed, 2);
    } finally { delete globalThis.self; }
});
