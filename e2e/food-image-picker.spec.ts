import { test, expect, type Page } from '@playwright/test';
import { APP_VERSION } from '../src/app/_lib/release';

type PickerWindow = Window & { pickerClicks: { capture: string | null; inClick: boolean }[] };
const appOrigin = new URL(process.env.BASE_URL ?? 'http://localhost:3000').origin;
const photo = {
    name: 'meal.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=', 'base64'),
};

async function prepare(page: Page, thirdparty = true, enabled = true) {
    // External styles/scripts are irrelevant to the native-picker contract.
    await page.route('**/*', route => new URL(route.request().url()).origin === appOrigin ? route.continue() : route.abort());
    await page.addInitScript(({ version, thirdparty, enabled }) => {
        localStorage.setItem('calsync_onboarding_done', '1');
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem('healthsync_last_seen_changelog_version_guest', version);
        localStorage.setItem('cookieSettings', JSON.stringify({ analytics: false, preferences: true, thirdparty }));
        localStorage.setItem('calsync_ai_enabled', String(enabled));
        localStorage.setItem('calsync_ai_terms_accepted', 'true');
        if (enabled) localStorage.setItem('calsync_ai_api_key', 'test-only-placeholder');
        const pickerWindow = window as unknown as PickerWindow;
        pickerWindow.pickerClicks = [];
        const click = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function () {
            if (this.type === 'file') pickerWindow.pickerClicks.push({
                capture: this.getAttribute('capture'), inClick: window.event?.isTrusted === true && window.event.type === 'click',
            });
            click.call(this);
        };
    }, { version: APP_VERSION, thirdparty, enabled });
}

for (const route of ['/dash', '/food', '/drinks']) {
    for (const mode of ['import', 'capture'] as const) {
        test(`${route}: ${mode} opens the picker in the original click`, async ({ page }) => {
            await prepare(page);
            await page.goto(route, { waitUntil: 'domcontentloaded' });
            await page.locator('#extraActionBtn').click();
            const action = page.locator(`[data-action="${mode}-food"]`);
            await expect(action).toBeEnabled();
            const chooserPromise = page.waitForEvent('filechooser');
            await action.click();
            const chooser = await chooserPromise;
            const capture = mode === 'capture' ? 'environment' : null;
            expect(await chooser.element().getAttribute('capture')).toBe(capture);
            expect(await page.evaluate(() => (window as unknown as PickerWindow).pickerClicks)).toEqual([{ capture, inClick: true }]);
            await expect(page.locator('#appOverlay')).toHaveClass(/visible/);
            await expect(page.getByRole('button', { name: /^(Choose Photo|Take Photo)$/ })).toHaveCount(0);
            await chooser.setFiles(photo);
            await expect(page.locator('.context-text-input')).toBeVisible();
            expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1') || '[]'))).toEqual([]);
        });
    }
}

for (const route of ['/dash', '/food']) {
    test(`${route}: AI method selection opens the camera and cancellation closes the empty sheet`, async ({ page }) => {
        await prepare(page);
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.locator(route === '/food' ? '#cs-openAiBtn' : '#quickAddCal').click();
        await expect(page.locator('#aiMethodTakePicture')).not.toHaveClass(/disabled/);
        const chooserPromise = page.waitForEvent('filechooser');
        await page.locator('#aiMethodTakePicture').click();
        const chooser = await chooserPromise;
        expect(await page.evaluate(() => (window as unknown as PickerWindow).pickerClicks)).toEqual([{ capture: 'environment', inClick: true }]);
        await expect(page.locator('#appOverlay')).toHaveClass(/visible/);
        await chooser.element().dispatchEvent('cancel');
        await expect(page.locator('#appOverlay')).not.toHaveClass(/visible/);
    });
}

test('a direct image link has a keyboard fallback without automatically opening a picker', async ({ page }) => {
    await prepare(page);
    await page.goto('/food?openModal=true&mode=import', { waitUntil: 'domcontentloaded' });
    const waitingArea = page.getByRole('button', { name: 'Select a photo', exact: true });
    await expect(waitingArea).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as PickerWindow).pickerClicks)).toEqual([]);
    const chooserPromise = page.waitForEvent('filechooser');
    await waitingArea.press('Enter');
    const chooser = await chooserPromise;
    await chooser.setFiles(photo);
    await expect(page.locator('.context-text-input')).toBeVisible();
});

test('missing third-party consent does not open a picker', async ({ page }) => {
    await prepare(page, false);
    await page.goto('/dash', { waitUntil: 'domcontentloaded' });
    await page.locator('#extraActionBtn').click();
    await expect(page.locator('[data-action="import-food"]')).toBeEnabled();
    await page.locator('[data-action="import-food"]').click();
    await expect(page.getByText('AI detection requires third-party consent.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as PickerWindow).pickerClicks)).toEqual([]);
});

test('missing AI configuration leaves camera and image actions disabled', async ({ page }) => {
    await prepare(page, true, false);
    await page.goto('/dash', { waitUntil: 'domcontentloaded' });
    await page.locator('#extraActionBtn').click();
    await expect(page.locator('[data-action="import-food"]')).toBeDisabled();
    await expect(page.locator('[data-action="capture-food"]')).toBeDisabled();
    expect(await page.evaluate(() => (window as unknown as PickerWindow).pickerClicks)).toEqual([]);
});
