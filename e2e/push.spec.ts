import { test, expect, type Page } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { APP_VERSION } from '../src/app/_lib/release';

loadEnvConfig(process.cwd());
const owner = '11111111-1111-4111-8111-111111111111';
const endpoint = 'https://fcm.googleapis.com/fcm/send/fixture';
const publicKey = Buffer.from([4, ...Array(64).fill(1)]).toString('base64url');

async function fixture(page: Page, options: { permission?: NotificationPermission; decision?: NotificationPermission; unsupported?: boolean; ios?: boolean; guest?: boolean; failSave?: boolean; failRead?: boolean } = {}) {
    const counts = { saves: 0, deletes: 0, tests: 0 };
    let saved = false;
    if (!options.guest) {
        const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
        const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'push@example.invalid', factors: [], app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
        const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, aal: 'aal1', amr: [] })).toString('base64url'), 'fixture'].join('.');
        const session = { access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user };
        await page.context().addCookies([{ name: `sb-${url.hostname.split('.')[0]}-auth-token`, value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), url: process.env.BASE_URL ?? 'http://localhost:3000', sameSite: 'Lax' }]);
        await page.route(`${url.origin}/**`, async route => {
            const path = new URL(route.request().url()).pathname;
            if (path.startsWith('/auth/')) return route.fulfill({ json: path.endsWith('/token') ? session : user });
            return route.fulfill({ status: 200, json: [], headers: { 'content-range': '0-0/0' } });
        });
        await page.route('**/api/sync/verify', route => route.fulfill({ json: { ok: true } }));
    }
    await page.route('**/api/push/**', async route => {
        const request = route.request();
        if (request.url().endsWith('/test-notification')) { counts.tests++; return route.fulfill({ json: { ok: true } }); }
        if (request.method() === 'POST') {
            if (options.failSave) return route.fulfill({ status: 503, json: { ok: false } });
            counts.saves++; saved = true;
        }
        if (request.method() === 'DELETE') { counts.deletes++; saved = false; }
        if (request.method() === 'GET' && options.failRead) return route.fulfill({ status: 503, json: { ok: false } });
        return route.fulfill({ json: { ok: true, endpoints: saved ? [endpoint] : [], publicKey } });
    });
    await page.addInitScript(({ options, publicKey, endpoint, version, owner }) => {
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem('cookieSettings', JSON.stringify({ analytics: false, preferences: true, thirdparty: false }));
        localStorage.setItem('healthsync_last_seen_changelog_version_guest', version);
        localStorage.setItem(`healthsync_last_seen_changelog_version_user_${owner}`, version);
        const state = { permission: options.permission ?? 'default', requests: 0, subscribes: 0, unsubscribes: 0, activeAtRequest: false };
        Object.assign(window, { __push: state });
        if (options.ios) {
            Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
        }
        if (options.unsupported) { Object.defineProperty(window, 'PushManager', { value: undefined }); delete (window as unknown as { PushManager?: unknown }).PushManager; return; }
        const notification = function() {};
        Object.defineProperty(notification, 'permission', { get: () => state.permission });
        Object.assign(notification, { requestPermission: async () => { state.requests++; state.activeAtRequest = navigator.userActivation.isActive; state.permission = options.decision ?? 'granted'; return state.permission; } });
        Object.defineProperty(window, 'Notification', { value: notification });
        let sub: object | null = null;
        const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const manager = {
            getSubscription: async () => sub,
            subscribe: async () => {
                state.subscribes++;
                sub = { endpoint, options: { applicationServerKey: key.buffer },
                    toJSON: () => ({ endpoint, keys: { p256dh: publicKey, auth: 'AAAAAAAAAAAAAAAAAAAAAA' } }),
                    unsubscribe: async () => { state.unsubscribes++; sub = null; return true; } };
                return sub;
            },
        };
        const worker = Object.assign(new EventTarget(), { scriptURL: location.origin + '/serwist/sw.js', state: 'activated', postMessage: () => {} });
        const registration = Object.assign(new EventTarget(), { scope: location.origin + '/', active: worker, installing: null, waiting: null, pushManager: manager, update: async () => {} });
        Object.defineProperty(navigator, 'serviceWorker', { value: Object.assign(new EventTarget(), {
            ready: Promise.resolve(registration), controller: worker, register: async () => registration, getRegistration: async () => registration,
        }) });
        Object.defineProperty(window, 'PushManager', { value: function() {} });
    }, { options, publicKey, endpoint, version: APP_VERSION, owner });
    return counts;
}

async function notificationsStep(page: Page) {
    await page.goto('/onboarding');
    await page.waitForFunction(() => Object.keys(document.querySelector('#onboardingNext') ?? {}).some(key => key.startsWith('__reactFiber')));
    for (let i = 0; i < 3; i++) await page.locator('#onboardingNext').click();
    await expect(page.locator('.onboarding-slide').nth(3).locator('.onboarding-slide-title')).toHaveText('Notifications');
}

const browserState = (page: Page) => page.evaluate(() => (window as unknown as { __push: { requests: number; subscribes: number; unsubscribes: number; activeAtRequest: boolean } }).__push);

test('Not now leaves permission and subscriptions untouched; later Settings activation and deletion work', async ({ page }) => {
    const counts = await fixture(page);
    await notificationsStep(page);
    await expect(page.getByRole('button', { name: 'Enable notifications', exact: true })).toBeEnabled();
    expect((await browserState(page)).requests).toBe(0);
    await page.getByRole('button', { name: 'Not now', exact: true }).click();
    expect(counts).toEqual({ saves: 0, deletes: 0, tests: 0 });
    expect((await browserState(page)).subscribes).toBe(0);
    await page.locator('#onboardingSetupCheckbox').uncheck();
    await page.locator('#onboardingNext').click();
    await page.waitForURL('**/dash');
    await page.locator('#db-openSettingsBtn').click();
    const settings = page.locator('#notificationsSettings');
    await expect(settings.getByRole('button', { name: 'Enable notifications', exact: true })).toBeEnabled();
    expect((await browserState(page)).requests).toBe(0);
    await settings.getByRole('button', { name: 'Enable notifications', exact: true }).click();
    await expect(settings).toContainText('Enabled · saved to your account');
    expect((await browserState(page)).activeAtRequest).toBe(true);
    expect((await browserState(page)).requests).toBe(1);
    expect(counts.tests).toBe(1);
    await settings.getByRole('button', { name: 'Send test notification' }).click();
    await expect(settings).toContainText('Test sent.');
    expect(counts.tests).toBe(2);
    await settings.getByRole('button', { name: 'Disable notifications' }).click();
    await expect(settings).toContainText('Notifications disabled for this device.');
    expect(counts.deletes).toBe(1);
    expect((await browserState(page)).unsubscribes).toBe(1);
    await settings.getByRole('button', { name: 'Refresh status' }).click();
    await expect(settings).toContainText('Allowed');
    await expect(settings).not.toContainText('Enabled · saved');
});

test('dismissed permission can be requested again later; no subscription before grant', async ({ page }) => {
    const counts = await fixture(page, { decision: 'default' });
    await notificationsStep(page);
    await page.getByRole('button', { name: 'Enable notifications', exact: true }).click();
    await expect(page.locator('.push-controls')).toContainText('Notifications were not enabled');
    expect(counts.saves).toBe(0);
    expect((await browserState(page)).subscribes).toBe(0);
    await page.getByRole('button', { name: 'Not now', exact: true }).click();
    await page.locator('#onboardingSetupCheckbox').uncheck();
    await page.locator('#onboardingNext').click();
    await page.waitForURL('**/dash');
    await page.locator('#db-openSettingsBtn').click();
    await page.locator('#notificationsSettings').getByRole('button', { name: 'Enable notifications', exact: true }).click();
    await expect(page.locator('#notificationsSettings')).toContainText('Notifications were not enabled');
    expect((await browserState(page)).requests).toBe(2);
    expect(counts.saves).toBe(0);
});

test('mobile notification controls scroll while navigation stays visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fixture(page);
    await notificationsStep(page);
    const enable = page.getByRole('button', { name: 'Enable notifications', exact: true });
    await expect(enable).toBeEnabled();
    await enable.scrollIntoViewIfNeeded();
    await expect(enable).toBeInViewport();
    expect((await enable.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#onboardingNext')).toBeInViewport();
    await expect(page.locator('#onboardingBack')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/push-mobile.png' });
});

for (const permission of ['default', 'granted'] as const) {
    test(`onboarding enables with ${permission} permission and advances after test`, async ({ page }) => {
        const counts = await fixture(page, { permission });
        await notificationsStep(page);
        const enable = page.getByRole('button', { name: 'Enable notifications', exact: true });
        await expect(enable).toBeEnabled();
        expect((await browserState(page)).requests).toBe(0);
        await enable.click();
        await expect(page.locator('.onboarding-slide').nth(4)).toHaveAttribute('aria-hidden', 'false');
        expect(counts).toEqual({ saves: 1, deletes: 0, tests: 1 });
        expect((await browserState(page)).requests).toBe(permission === 'default' ? 1 : 0);
        await page.locator('#onboardingBack').click();
        await expect(page.getByRole('button', { name: 'Send test notification' })).toBeEnabled();
        expect((await browserState(page)).subscribes).toBe(1);
    });
}

for (const variant of ['denied', 'unsupported', 'ios', 'guest', 'failRead', 'failSave'] as const) {
    test(`${variant} state stays usable without unsolicited permission`, async ({ page }) => {
        const options = variant === 'denied' ? { permission: 'denied' as const } : { [variant]: true };
        const counts = await fixture(page, options);
        await notificationsStep(page);
        const controls = page.locator('.onboarding-slide').nth(3);
        if (variant === 'denied') { await expect(controls).toContainText('Notifications are blocked'); await expect(controls.getByRole('button', { name: 'Enable notifications', exact: true })).toBeDisabled(); }
        if (variant === 'unsupported') await expect(controls).toContainText('does not support Web Push');
        if (variant === 'ios') await expect(controls).toContainText('Add to Home Screen');
        if (variant === 'guest') await expect(controls).toContainText('Sign in to enable');
        if (variant === 'failRead') await expect(controls).toContainText('Could not load notification settings');
        if (variant === 'failSave') {
            await controls.getByRole('button', { name: 'Enable notifications', exact: true }).click();
            await expect(controls).toContainText('Could not complete this action');
            expect((await browserState(page)).unsubscribes).toBe(1);
        } else expect((await browserState(page)).requests).toBe(0);
        expect(counts.saves).toBe(0);
        expect(counts.tests).toBe(0);
        await page.getByRole('button', { name: 'Not now', exact: true }).click();
        await expect(page.locator('.onboarding-slide').nth(4)).toHaveAttribute('aria-hidden', 'false');
    });
}
