import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
const builds = JSON.parse(readFileSync('.update-test/builds.json', 'utf8')) as { id: string }[];
const origin = 'http://127.0.0.1:3210';

async function setup(context: BrowserContext) {
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(() => {
        if (!localStorage.getItem('update_test_seeded')) {
            localStorage.setItem('update_test_seeded', '1');
            localStorage.setItem('healthsync_pending_reload_after_update', 'true');
            localStorage.setItem('calsync_onboarding_done', '1');
            localStorage.setItem('bannerAccepted', 'true');
            localStorage.setItem('cookieSettings', JSON.stringify({ preferences: true, thirdparty: false, analytics: false }));
            localStorage.setItem('calsync_theme', 'ocean');
            localStorage.setItem('healthsync_pending_food', JSON.stringify(['saved-food']));
            const food = { id: 'saved-food', food: 'Saved oats', amount: 100, unit: 'g', kcal: 380, prot: 10, carb: 60, fat: 8, ts: Date.now(), date: new Date().toDateString() };
            localStorage.setItem('calsync_v1', JSON.stringify([food]));
            const draft = { id: 'draft-one', food: { name: 'Unlogged draft', kcalPer100: 400, protPer100: 10, carbPer100: 60, fatPer100: 8, defaultUnit: 'g' }, amount: 125, unit: 'g', ts: Date.now() };
            localStorage.setItem('calsync_pending', JSON.stringify([draft]));
            localStorage.setItem('calsync_food_selection_v1', JSON.stringify({ version: 1, items: [{ ...draft, id: 'selection-one', amount: '125' }] }));
        }
    });
    await context.addCookies([{ name: 'healthsync_auth_preservation_fixture', value: 'cookie-stays', url: origin }]);
}
async function select(page: Page, build: 'a' | 'b') { await page.request.get(`${origin}/__update_test/${build}`); }
async function ready(page: Page, build: number) {
    await expect(page.locator('script[src*="/_next/static/"]').first()).toHaveAttribute('src', new RegExp(`dpl=${builds[build].id}`));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await expect(page.locator('#extraActionToggle')).toBeVisible();
}
async function waiting(page: Page) {
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
    await expect(page.locator('.update-banner')).toBeVisible();
}
async function workerBuild(page: Page) {
    return page.evaluate(() => new Promise<string>((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Worker identity timeout')); }, 5000);
        channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data.buildId); };
        navigator.serviceWorker.controller!.postMessage({ type: 'HEALTHSYNC_BUILD' }, [channel.port2]);
    }));
}
async function openCenter(page: Page) {
    await page.bringToFront();
    await page.evaluate(() => {
        const positions: number[] = [];
        const start = performance.now();
        const sample = () => {
            const modal = document.getElementById('whatsNewModal');
            if (modal?.closest('.visible')) {
                const y = new DOMMatrix(getComputedStyle(modal).transform).m42;
                if (y > 2 && y < modal.offsetHeight - 2) positions.push(Math.round(y));
            }
            if (performance.now() - start < 1200) requestAnimationFrame(sample);
            else (window as unknown as { productionSheetMotion: number[] }).productionSheetMotion = positions;
        };
        delete (window as unknown as { productionSheetMotion?: number[] }).productionSheetMotion;
        requestAnimationFrame(sample);
    });
    await page.locator('#db-openUpdateCenterBtn').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { productionSheetMotion?: number[] }).productionSheetMotion)).toBeTruthy();
    expect(await page.evaluate(() => new Set((window as unknown as { productionSheetMotion: number[] }).productionSheetMotion).size)).toBeGreaterThan(4);
    await expect(page.locator('.whats-new-overlay')).toHaveAttribute('data-sheet-phase', 'open');
}
async function saved(page: Page) {
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!)[0].food)).toBe('Saved oats');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_pending')!)[0].amount)).toBe(125);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_selection_v1')!).items[0].amount)).toBe('125');
    expect(await page.evaluate(() => localStorage.getItem('calsync_theme'))).toBe('ocean');
    expect(await page.evaluate(() => localStorage.getItem('healthsync_pending_food'))).toContain('saved-food');
    expect((await page.context().cookies()).find(cookie => cookie.name === 'healthsync_auth_preservation_fixture')?.value).toBe('cookie-stays');
}

test('Later, changelog reading and continued use do not activate or reload; only initiating tab reloads on explicit update', async ({ browser }) => {
    const context = await browser.newContext(); await setup(context);
    const page = await context.newPage(); await select(page, 'a'); await page.goto('/dash'); await ready(page, 0);
    expect((await page.request.get('/serwist/sw.js')).headers()['cache-control']).toMatch(/no-cache|no-store/);
    const other = await context.newPage(); await other.goto('/dash'); await ready(other, 0);
    expect(await workerBuild(page)).toBe(builds[0].id);
    await page.evaluate(() => { localStorage.setItem('healthsync_pending_reload_after_update', 'true'); (window as unknown as { updateSentinel: string }).updateSentinel = 'keep'; });
    await other.evaluate(() => { (window as unknown as { updateSentinel: string }).updateSentinel = 'other'; });
    await select(page, 'b'); await waiting(page);
    await page.locator('.update-banner').getByRole('button', { name: 'Later', exact: true }).click();
    await expect(page.locator('.update-banner')).toHaveCount(0);
    await openCenter(page);
    await expect(page.locator('#whatsNewModal').getByRole('button', { name: 'Update now', exact: true })).toBeEnabled();
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { updateSentinel: string }).updateSentinel)).toBe('keep');
    await page.getByRole('button', { name: 'Close Update Center', exact: true }).click();
    await expect(page.locator('.whats-new-overlay')).toHaveAttribute('data-sheet-phase', 'closed');
    await page.locator('#db-openSettingsBtn').click(); await expect(page.locator('#settingsOverlay')).toHaveAttribute('data-sheet-phase', 'open'); await page.keyboard.press('Escape');
    await expect(page.locator('#settingsOverlay')).toHaveAttribute('data-sheet-phase', 'closed');
    expect(await page.evaluate(() => (window as unknown as { updateSentinel: string }).updateSentinel)).toBe('keep');
    await openCenter(page);
    await page.locator('#whatsNewModal').getByRole('button', { name: 'Update now', exact: true }).click();
    await ready(page, 1); await saved(page);
    expect(await workerBuild(page)).toBe(builds[1].id);
    expect(await workerBuild(other)).toBe(builds[1].id);
    expect(await other.evaluate(() => (window as unknown as { updateSentinel: string }).updateSentinel)).toBe('other');
    await expect(other.locator('script[src*="/_next/static/"]').first()).toHaveAttribute('src', new RegExp(`dpl=${builds[0].id}`));
    await other.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
    expect(await other.evaluate(() => (window as unknown as { updateSentinel: string }).updateSentinel)).toBe('other');
    await context.close();
});

test('ordinary Reload app is available without an update and never clears local data or cookies', async ({ browser }) => {
    const context = await browser.newContext(); await setup(context);
    const page = await context.newPage(); await select(page, 'a'); await page.goto('/dash'); await ready(page, 0);
    await openCenter(page); await expect(page.locator('#whatsNewModal').getByRole('button', { name: 'Update now', exact: true })).toHaveCount(0);
    await select(page, 'b');
    await page.locator('#whatsNewModal').getByRole('button', { name: 'Reload app', exact: true }).click();
    await ready(page, 1); await saved(page);
    await expect(page.locator('.whats-new-overlay')).not.toHaveClass(/visible/);
    await context.close();
});

test('full close/reopen may activate a waiting worker naturally; offline startup remains coherent', async ({ browser }) => {
    const context = await browser.newContext(); await setup(context);
    let page = await context.newPage(); await select(page, 'a'); await page.goto('/dash'); await ready(page, 0);
    await select(page, 'b'); await waiting(page);
    await page.locator('.update-banner').getByRole('button', { name: 'Later', exact: true }).click();
    await page.close();
    page = await context.newPage(); await page.goto('/dash'); await ready(page, 1); await saved(page);
    await expect.poll(() => workerBuild(page)).toBe(builds[1].id);
    await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration())?.waiting);
    await page.reload(); await ready(page, 1); // Prime build B's offline shell after it controls the document.
    await context.setOffline(true);
    await page.reload(); await ready(page, 1); await saved(page);
    await context.setOffline(false); await context.close();
});

test('failed update restores controls; stale flags and later controller events cannot reload', async ({ browser }) => {
    const context = await browser.newContext(); await setup(context);
    const page = await context.newPage(); await select(page, 'a'); await page.goto('/dash'); await ready(page, 0);
    await select(page, 'b'); await waiting(page); await openCenter(page);
    await page.evaluate(() => {
        (window as unknown as { updateSentinel: string }).updateSentinel = 'still-here';
        localStorage.setItem('healthsync_pending_reload_after_update', 'true');
        ServiceWorker.prototype.postMessage = () => { throw new Error('simulated message failure'); };
    });
    const action = page.locator('#whatsNewModal').getByRole('button', { name: 'Update now', exact: true });
    await action.click(); await expect(page.locator('#whatsNewModal [role="alert"]')).toContainText('could not finish');
    await expect(action).toBeEnabled();
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
    expect(await page.evaluate(() => (window as unknown as { updateSentinel: string }).updateSentinel)).toBe('still-here');
    await saved(page); await context.close();
});


test('deployment skew navigates to coherent fresh HTML and old hashed assets remain readable', async ({ browser }) => {
    const context = await browser.newContext(); await setup(context);
    await context.route('**/*', route => {
        const headers = route.request().headers();
        return headers['next-router-prefetch'] || headers['next-router-segment-prefetch'] ? route.abort() : route.fallback();
    });
    const page = await context.newPage(); await select(page, 'a'); await page.goto('/dash'); await ready(page, 0);
    const oldAsset = await page.locator('script[src*="/_next/static/"]').last().getAttribute('src');
    await select(page, 'b'); await waiting(page);
    await page.locator('.update-banner').getByRole('button', { name: 'Later', exact: true }).click();
    await page.locator('#bottomNav a[href="/food"]').click();
    await ready(page, 1); // Next's deployment mismatch causes a full, coherent navigation.
    expect(await page.evaluate(async asset => (await fetch(asset!)).ok, oldAsset)).toBe(true);
    await saved(page); await context.close();
});

test('supported pending-food edits flush before intentional reload and survive the production update', async ({ browser }) => {
    const context = await browser.newContext(); await setup(context);
    const page = await context.newPage(); await select(page, 'a'); await page.goto('/food'); await ready(page, 0);
    await page.locator('.pending-item[data-id="draft-one"]').click();
    await page.locator('#modal .amount-big-input').fill('250');
    expect(await page.evaluate(() => window.dispatchEvent(new Event('healthsync:before-reload', { cancelable: true })))).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_pending')!)[0].amount)).toBe(250);
    await page.locator('#appOverlay').click({ position: { x: 2, y: 2 } });
    await expect(page.locator('#appOverlay')).not.toHaveClass(/visible/);
    await page.locator('#bottomNav a[href="/dash"]').click();
    await select(page, 'b'); await waiting(page);
    await page.locator('.update-banner').getByRole('button', { name: 'Update now', exact: true }).click();
    await ready(page, 1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_pending')!)[0])).toMatchObject({ id: 'draft-one', amount: 250 });
    await context.close();
});
