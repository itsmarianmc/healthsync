import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { moduleLoader, storageFixture, deferred } from './helpers/loadTs.mjs';

let local, ai;
const consent = enabled => localStorage.setItem('cookieSettings', JSON.stringify({ thirdparty: enabled }));
const configure = (enabled = true, termsAccepted = true, key = 'fixture-key') => {
  ai.writeAiConfig({ enabled, termsAccepted });
  if (key) localStorage.setItem('calsync_ai_api_key', key);
};
beforeEach(() => {
  storageFixture();
  const load = moduleLoader();
  local = load('./localData');
  ai = load('./aiConfig');
  consent(true);
});

test('guest -> A -> B -> guest restores independent configurations without automatic transfer', () => {
  configure();
  local.switchWorkspace('A');
  assert.equal(ai.readAiConfig().configured, false);
  assert.equal(ai.isAiUsable(), false);
  assert.equal(ai.canOfferGuestAiConfig(), true);
  configure(true, false, 'A-fixture');
  local.switchWorkspace('B');
  assert.equal(ai.readAiConfig().configured, false);
  configure(false, true, 'B-fixture');
  local.switchWorkspace('A');
  assert.deepEqual(ai.readAiConfig(), { configured: true, enabled: true, termsAccepted: false, apiKey: 'A-fixture' });
  assert.equal(ai.canOfferGuestAiConfig(), false);
  local.switchWorkspace('B');
  assert.equal(ai.readAiConfig().enabled, false);
  local.switchWorkspace('guest');
  assert.equal(ai.isAiUsable(), true);
  assert.equal(ai.readAiConfig().apiKey, 'fixture-key');
});

test('explicit adoption copies only guest AI values into the active empty account and signals storage', () => {
  configure();
  localStorage.setItem('calsync_v1', '[{"id":"guest-food"}]');
  local.switchWorkspace('A');
  let events = 0;
  window.addEventListener('storage', () => { events++; });
  assert.equal(ai.adoptGuestAiConfig('A'), true);
  assert.equal(events, 1);
  assert.equal(ai.isAiUsable(), true);
  assert.equal(localStorage.getItem('calsync_v1'), null);
  assert.equal(localStorage.getItem('healthsync_pending_settings'), null);
  local.switchWorkspace('B');
  assert.equal(ai.readAiConfig().configured, false);
  assert.equal(ai.adoptGuestAiConfig('A'), false);
  local.switchWorkspace('guest');
  assert.equal(ai.isAiUsable(), true);
});

for (const existing of ['disabled', 'own-key', 'declined-terms']) {
  test(`adoption cannot override account ${existing}`, () => {
    configure();
    local.switchWorkspace('A');
    if (existing === 'disabled') ai.writeAiConfig({ enabled: false });
    if (existing === 'own-key') localStorage.setItem('calsync_ai_api_key', 'own-fixture');
    if (existing === 'declined-terms') ai.writeAiConfig({ termsAccepted: false });
    const before = ai.readAiConfig();
    assert.equal(ai.canOfferGuestAiConfig(), false);
    assert.equal(ai.adoptGuestAiConfig('A'), false);
    assert.deepEqual(ai.readAiConfig(), before);
  });
}

test('declining adoption explicitly keeps AI disabled across subsequent login', () => {
  configure();
  local.switchWorkspace('A');
  ai.writeAiConfig({ enabled: false });
  local.switchWorkspace('guest');
  local.switchWorkspace('A');
  assert.equal(ai.canOfferGuestAiConfig(), false);
  assert.equal(ai.isAiUsable(), false);
  assert.equal(ai.readAiConfig().apiKey, '');
});

for (const missing of ['key', 'terms', 'service-consent', 'activation']) {
  test(`activation never implies missing ${missing}`, () => {
    configure(missing !== 'activation', missing !== 'terms', missing === 'key' ? '' : 'fixture');
    if (missing === 'service-consent') consent(false);
    assert.equal(ai.isAiUsable(), false);
    local.switchWorkspace('A');
    assert.equal(ai.adoptGuestAiConfig('A'), missing !== 'service-consent');
    assert.equal(ai.isAiUsable(), false);
    if (missing === 'key') assert.equal(ai.readAiConfig().apiKey, '');
    if (missing === 'terms') assert.equal(ai.readAiConfig().termsAccepted, false);
  });
}

test('explicit cloud reset still clears AI config and tracked records; other workspaces survive', () => {
  configure();
  local.switchWorkspace('A');
  configure(true, true, 'account-fixture');
  localStorage.setItem('calsync_v1', '[{"id":"meal"}]');
  local.clearActiveHealthData();
  assert.equal(ai.readAiConfig().configured, false);
  assert.equal(localStorage.getItem('calsync_v1'), null);
  local.switchWorkspace('guest');
  assert.equal(ai.isAiUsable(), true);
});

for (const action of ['login', 'logout', 'switch-back', 'reset', 'consent-revoked', 'disabled']) {
  test(`late key validation cannot write after ${action}`, async () => {
    local.switchWorkspace('A');
    configure();
    const response = deferred();
    const running = ai.saveValidatedAiKey('late-fixture', () => response.promise);
    if (action === 'login') local.switchWorkspace('B');
    if (action === 'logout') local.switchWorkspace('guest');
    if (action === 'switch-back') { local.switchWorkspace('B'); local.switchWorkspace('A'); }
    if (action === 'reset') local.clearActiveHealthData();
    if (action === 'consent-revoked') consent(false);
    if (action === 'disabled') ai.writeAiConfig({ enabled: false });
    const before = ai.readAiConfig();
    response.resolve(true);
    assert.equal(await running, 'stale');
    assert.deepEqual(ai.readAiConfig(), before);
  });
}

test('only the latest valid key request is saved and invalid validation leaves stored key alone', async () => {
  configure();
  assert.equal(await ai.saveValidatedAiKey('invalid-fixture', async () => false), 'invalid');
  assert.equal(ai.readAiConfig().apiKey, 'fixture-key');
  const first = deferred();
  const old = ai.saveValidatedAiKey('old-fixture', () => first.promise);
  assert.equal(await ai.saveValidatedAiKey('new-fixture', async () => true), 'saved');
  first.resolve(true);
  assert.equal(await old, 'stale');
  assert.equal(ai.readAiConfig().apiKey, 'new-fixture');
});
