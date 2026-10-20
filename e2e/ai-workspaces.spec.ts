import { test, expect, type Page } from '@playwright/test';

import { aiAppFixture } from './fixtures/ai-app';

let fixture: Awaited<ReturnType<typeof aiAppFixture>>;
test.beforeAll(async () => { fixture = await aiAppFixture(); });
test.use({ serviceWorkers: 'block' });

const origin = new URL(process.env.BASE_URL ?? 'http://localhost:3000').origin;
const accounts = { A: '11111111-1111-4111-8111-111111111111', B: '22222222-2222-4222-8222-222222222222' };

async function prepare(page: Page, accountA?: { enabled: string; terms?: string; key?: string }) {
  let releaseValidation: (() => void) | undefined;
  let validationStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { validationStarted = resolve; });
  const release = new Promise<void>(resolve => { releaseValidation = resolve; });
  let holdValidation = false;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'generativelanguage.googleapis.com') {
      validationStarted?.();
      if (holdValidation) await release;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    }
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/sync/verify') return route.fulfill({ json: { ok: true } });
    if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: fixture.js });
    if (url.pathname === '/fixture.css') return route.fulfill({ contentType: 'text/css', body: fixture.css });
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: fixture.html });
    return route.abort();
  });
  await page.addInitScript(({ accountA, accountB, accountAId }) => {
    if (localStorage.getItem('ai_fixture_initialized')) return;
    localStorage.clear();
    localStorage.setItem('ai_fixture_initialized', 'true');
    localStorage.setItem('calsync_onboarding_done', '1');
    localStorage.setItem('bannerAccepted', 'true');
    localStorage.setItem('cookieSettings', JSON.stringify({ analytics: false, preferences: true, thirdparty: true }));
    localStorage.setItem('calsync_ai_enabled', 'true');
    localStorage.setItem('calsync_ai_terms_accepted', 'true');
    localStorage.setItem('calsync_ai_api_key', 'guest-fixture');
    if (accountA) localStorage.setItem(`healthsync_workspace_${accountAId}`, JSON.stringify({
      calsync_ai_enabled: accountA.enabled,
      ...(accountA.terms === undefined ? {} : { calsync_ai_terms_accepted: accountA.terms }),
      ...(accountA.key === undefined ? {} : { calsync_ai_api_key: accountA.key }),
    }));
    localStorage.setItem(`healthsync_workspace_${accountB}`, JSON.stringify({
      calsync_ai_enabled: 'false', calsync_ai_terms_accepted: 'true', calsync_ai_api_key: 'B-fixture',
    }));
  }, { accountA, accountB: accounts.B, accountAId: accounts.A });
  return { hold: () => { holdValidation = true; }, started, release: () => releaseValidation?.() };
}

async function login(page: Page, account: 'A' | 'B', navigate = true) {
  if (navigate) await page.goto('/login?keep_login_page=true');
  await page.locator('#loginEmail').fill(`${account}@example.invalid`);
  await page.locator('#loginPassword').fill('FixturePassword1!');
  await page.locator('#loginBtn').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('healthsync_active_owner'))).toBe(accounts[account]);
  // Navigate through the real login UI (client navigation also preserves pending requests).
  await page.getByRole('button', { name: 'Go back to app', exact: true }).click();
  await expect(page.locator('#db-openSettingsBtn')).toBeVisible();
}

async function settings(page: Page) {
  await page.locator('#db-openSettingsBtn').click();
  await expect(page.locator('#settingsOverlay')).toHaveClass(/visible/);
}

async function logout(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#settingsOverlay')).not.toHaveClass(/visible/);
  // Navigate within the fixture router so an outstanding validation stays alive.
  await page.evaluate(() => {
    history.pushState({}, '', '/login?keep_login_page=true');
    window.dispatchEvent(new Event('popstate'));
  });
  await page.locator('#viewLoggedIn').getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.locator('#loginBtn')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('healthsync_active_owner'))).toBe('guest');
}

async function shellAvailability(page: Page, enabled: boolean) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#settingsOverlay')).not.toHaveClass(/visible/);
  await page.locator('#extraActionBtn').click();
  if (enabled) await expect(page.locator('[data-action="import-food"]')).toBeEnabled();
  else await expect(page.locator('[data-action="import-food"]')).toBeDisabled();
  // The expanded grid covers its trigger; close via the normal outside-click handler.
  await page.mouse.click(5, 5);
  await expect(page.locator('#extraActionBtn')).not.toHaveClass(/open/);
}


async function providerAvailability(page: Page, enabled: boolean) {
  await page.getByRole('link', { name: 'Food', exact: true }).click();
  await page.locator('#cs-openAiBtn').click();
  await expect(page.locator('#aiMethodDescribeText')).toHaveAttribute('aria-disabled', String(!enabled));
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
}

test('own A configuration, toggle refresh, own B and guest remain separate', async ({ page }) => {
  await prepare(page, { enabled: 'true', terms: 'true', key: 'A-fixture' });
  await login(page, 'A');
  await settings(page);
  await expect(page.locator('#aiApiKeyInput')).toHaveValue('A-fixture');
  await expect(page.locator('#aiEnabledToggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#aiStatusBox')).toBeVisible();
  await shellAvailability(page, true);
  await providerAvailability(page, true);
  await settings(page);
  await page.locator('#aiEnabledToggle').click();
  await shellAvailability(page, false);
  await providerAvailability(page, false);
  await settings(page);
  await page.locator('#aiEnabledToggle').click();
  await logout(page);
  await login(page, 'B', false);
  await settings(page);
  await expect(page.locator('#aiEnabledToggle')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#guestAiConfigOffer')).toHaveCount(0);
  await page.locator('#aiEnabledToggle').click();
  await expect(page.locator('#aiApiKeyInput')).toHaveValue('B-fixture');
  await logout(page);
  await page.goto('/food');
  await page.locator('#cs-openAiBtn').click();
  await expect(page.locator('#aiMethodDescribeText')).toHaveAttribute('aria-disabled', 'false');
  await page.keyboard.press('Escape');
  await page.locator('#cs-openSettingsBtn').click();
  await expect(page.locator('#aiApiKeyInput')).toHaveValue('guest-fixture');
});

test('empty account keeps the standard disabled view across reload without copying guest values', async ({ page }) => {
  await prepare(page);
  await login(page, 'A');
  for (let visit = 0; visit < 2; visit++) {
    if (visit) await page.reload();
    await settings(page);
    await expect(page.locator('#guestAiConfigOffer')).toHaveCount(0);
    await expect(page.locator('#aiDetection .settings-section-title')).toContainText('AI Detection');
    await expect(page.locator('#aiEnabledToggle')).toBeVisible();
    await expect(page.locator('#aiEnabledToggle')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#aiInfoBox')).toBeVisible();
    await expect(page.locator('#aiInfoBox')).toContainText('Gemini API');
    await expect(page.locator('#aiSettings')).toHaveCount(0);
    expect(await page.evaluate(() => ['calsync_ai_enabled', 'calsync_ai_terms_accepted', 'calsync_ai_api_key'].map(key => localStorage.getItem(key)))).toEqual([null, null, null]);
    expect(await page.evaluate(() => {
      const guest = JSON.parse(localStorage.getItem('healthsync_workspace_guest') || '{}');
      return [guest.calsync_ai_enabled, guest.calsync_ai_terms_accepted, guest.calsync_ai_api_key];
    })).toEqual(['true', 'true', 'guest-fixture']);
    await shellAvailability(page, false);
    await providerAvailability(page, false);
  }
  await settings(page);
  await page.locator('#aiEnabledToggle').click();
  await expect(page.locator('#aiTermsBox')).toBeVisible();
  await page.locator('#aiTermsAccept').click();
  await expect(page.locator('#aiApiKeyInput')).toHaveValue('');
  await page.locator('#aiApiKeyInput').fill('A-fixture');
  await page.locator('#saveApiKeyBtn').click();
  await expect(page.locator('#aiStatusBox')).toBeVisible();
  await shellAvailability(page, true);
  await providerAvailability(page, true);
});

for (const missing of ['key', 'terms'] as const) {
  test(`account settings keep missing ${missing} distinct from stored activation`, async ({ page }) => {
    await prepare(page, { enabled: 'true', ...(missing === 'terms' ? { key: 'A-fixture' } : { terms: 'true' }) });
    await login(page, 'A');
    await settings(page);
    await expect(page.locator('#aiEnabledToggle')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#aiStatusBox')).toHaveCount(0);
    if (missing === 'terms') await expect(page.locator('#aiTermsBox')).toBeVisible();
    else await expect(page.locator('#aiApiKeyInput')).toHaveValue('');
    await shellAvailability(page, false);
    await providerAvailability(page, false);
  });
}

test('late key validation after logout and login into B cannot change B settings', async ({ page }) => {
  const validation = await prepare(page, { enabled: 'true', terms: 'true', key: 'A-fixture' });
  await login(page, 'A');
  await settings(page);
  validation.hold();
  await page.locator('#aiApiKeyInput').fill('late-fixture');
  await page.locator('#saveApiKeyBtn').click();
  await validation.started;
  await logout(page);
  await login(page, 'B', false);
  const response = page.waitForResponse(response => new URL(response.url()).hostname === 'generativelanguage.googleapis.com');
  validation.release();
  await (await response).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await settings(page);
  await page.locator('#aiEnabledToggle').click();
  await expect(page.locator('#aiApiKeyInput')).toHaveValue('B-fixture');
  expect(await page.evaluate(() => localStorage.getItem('calsync_ai_api_key'))).toBe('B-fixture');
});



test('revoked service consent disables shell and provider without changing the saved opt-in', async ({ page }) => {
  await prepare(page);
  await page.goto('/dash');
  await settings(page);
  await page.evaluate(() => {
    const settings = { analytics: false, preferences: true, thirdparty: false };
    localStorage.setItem('cookieSettings', JSON.stringify(settings));
    window.dispatchEvent(new StorageEvent('storage', { key: 'cookieSettings' }));
  });
  await expect(page.locator('#aiEnabledToggle')).toBeDisabled();
  await expect(page.locator('#aiEnabledToggle')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#aiStatusBox')).toHaveCount(0);
  await shellAvailability(page, false);
  await providerAvailability(page, false);
});


test('a newer explicit cloud reset clears account AI configuration and food without touching guest values', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(account => {
    if (sessionStorage.getItem('reset-fixture-initialized')) return;
    sessionStorage.setItem('reset-fixture-initialized', 'true');
    sessionStorage.setItem('fixture-reset', '2026-10-16T00:00:00Z');
    localStorage.setItem(`healthsync_workspace_${account}`, JSON.stringify({
      calsync_ai_enabled: 'true', calsync_ai_terms_accepted: 'true', calsync_ai_api_key: 'account-fixture',
      calsync_v1: JSON.stringify([{ id: 'pre-reset', food: 'Old meal', ts: 1 }]),
      healthsync_last_cloud_sync: '2026-10-15T00:00:00Z',
    }));
  }, accounts.A);
  await login(page, 'A');
  await settings(page);
  await expect(page.locator('#aiEnabledToggle')).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('calsync_ai_api_key'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1') || '[]'))).toEqual([]);
  await expect(page.locator('#guestAiConfigOffer')).toHaveCount(0);
  await logout(page);
  await page.goto('/dash');
  await settings(page);
  await expect(page.locator('#aiApiKeyInput')).toHaveValue('guest-fixture');
});

