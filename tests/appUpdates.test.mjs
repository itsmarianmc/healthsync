import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader, storageFixture } from './helpers/loadTs.mjs';
let AppUpdates, manager, container, registration, waiting, reloads;
beforeEach(() => {
    storageFixture(); process.env.NODE_ENV = 'production'; reloads = 0;
    waiting = Object.assign(new EventTarget(), { state: 'installed', postMessage() {} });
    registration = Object.assign(new EventTarget(), { waiting, update: async () => {} });
    container = Object.assign(new EventTarget(), { controller: {}, register: async () => registration, getRegistration: async () => registration });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: container } });
    globalThis.document = Object.assign(new EventTarget(), { querySelector: () => null, visibilityState: 'visible' });
    globalThis.CustomEvent = class extends Event { constructor(name, options) { super(name); this.detail = options.detail; } };
    window.location = { reload: () => reloads++ }; window.confirm = () => true;
    AppUpdates = moduleLoader()('./appUpdates').AppUpdates;
    manager = new AppUpdates();
});

test('background registration, waiting and foreign controller changes cannot reload even with stale markers', async () => {
    localStorage.setItem('healthsync_pending_reload_after_update', 'true');
    await manager.start();
    container.dispatchEvent(new Event('controllerchange'));
    assert.equal(reloads, 0); assert.equal(localStorage.getItem('healthsync_pending_reload_after_update'), null);
    manager.later(); assert.equal(manager.isDeferred(), true);
    await manager.check(); assert.equal(reloads, 0);
});

test('consent targets a specific worker in this client and reloads once after control changes', async () => {
    await manager.start();
    let messages = 0; waiting.postMessage = () => messages++;
    const action = manager.apply(); await Promise.resolve();
    await manager.apply(); assert.equal(messages, 1);
    container.controller = Object.assign(new EventTarget(), { state: 'activated' });
    container.dispatchEvent(new Event('controllerchange')); assert.equal(reloads, 0);
    container.controller = waiting; waiting.state = 'activated';
    container.dispatchEvent(new Event('controllerchange')); await action;
    assert.equal(reloads, 1);
    container.dispatchEvent(new Event('controllerchange')); assert.equal(reloads, 1);
});

test('activation failure clears consent and a later controllerchange stays quiet; retry is possible', async () => {
    await manager.start(); waiting.postMessage = () => { throw new Error('transport'); };
    await manager.apply(); assert.equal(manager.snapshot().phase, 'error');
    waiting.state = 'activated'; container.controller = waiting;
    container.dispatchEvent(new Event('controllerchange')); assert.equal(reloads, 0);
    registration.waiting = null; await manager.apply(); assert.equal(reloads, 0);
});

test('ordinary reload flushes supported drafts and leaves saved data, auth, preferences and queues intact', () => {
    for (const key of ['calsync_v1', 'healthsync_pending_food', 'cookieSettings', 'auth-fixture']) localStorage.setItem(key, key);
    window.addEventListener('healthsync:before-reload', () => localStorage.setItem('calsync_pending', '[{"id":"draft"}]'));
    manager.reload(); manager.reload(); assert.equal(reloads, 1);
    for (const key of ['calsync_v1', 'healthsync_pending_food', 'cookieSettings', 'auth-fixture']) assert.equal(localStorage.getItem(key), key);
    assert.match(localStorage.getItem('calsync_pending'), /draft/);
});

test('failed draft save or declined warning cancels activation and reload', async () => {
    await manager.start();
    window.addEventListener('healthsync:before-reload', event => event.preventDefault());
    await manager.apply(); assert.equal(manager.snapshot().phase, 'error'); assert.equal(reloads, 0);
    manager.reload(); assert.equal(reloads, 0);
    document.querySelector = () => ({}); window.confirm = () => false;
    manager.reload(); assert.equal(reloads, 0);
});

test('a timed out activation revokes consent before any later control change', async context => {
    await manager.start(); context.mock.timers.enable({ apis: ['setTimeout'] });
    const action = manager.apply(); await Promise.resolve();
    context.mock.timers.tick(15001); await action;
    assert.equal(manager.snapshot().phase, 'error');
    container.controller = waiting; waiting.state = 'activated';
    container.dispatchEvent(new Event('controllerchange')); assert.equal(reloads, 0);
});
