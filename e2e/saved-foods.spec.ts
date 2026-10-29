import { test, expect, type Page } from '@playwright/test';
import { APP_VERSION } from '../src/app/_lib/release';
import { aiAppFixture } from './fixtures/ai-app';

const isolated = process.env.HEALTHSYNC_FOOD_FIXTURE === '1';
let fixture: Awaited<ReturnType<typeof aiAppFixture>>;
test.beforeAll(async () => { if (isolated) fixture = await aiAppFixture(); });
test.use({ serviceWorkers: 'block' });

const origin = new URL(process.env.BASE_URL ?? 'http://localhost:3000').origin;
const sample = { name: 'Oats', brand: 'Local Mill', kcalPer100: 380, protPer100: 13.2,
    carbPer100: 60.1, fatPer100: 7.3, defaultUnit: 'g' };

async function prepare(page: Page, thirdparty = false) {
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (!isolated) return route.continue();
        if (url.pathname === '/api/sync/verify') return route.fulfill({ json: { ok: true } });
        if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: fixture.js });
        if (url.pathname === '/fixture.css') return route.fulfill({ contentType: 'text/css', body: fixture.css });
        if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: fixture.html });
        return route.abort();
    });
    await page.addInitScript(({ version, thirdparty }) => {
        localStorage.setItem('calsync_onboarding_done', '1');
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem('healthsync_last_seen_changelog_version_guest', version);
        localStorage.setItem('cookieSettings', JSON.stringify({ analytics: false, preferences: true, thirdparty }));
    }, { version: APP_VERSION, thirdparty });
}

async function open(page: Page, action: 'create-food' | 'search-food' | 'scan-barcode') {
    await page.locator('#extraActionBtn').click();
    await page.locator(`[data-action="${action}"]`).click();
}

async function create(page: Page) {
    await open(page, 'create-food');
    await page.getByRole('button', { name: 'Create food', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('  Oats  ');
    await page.getByLabel('Brand (optional)').fill('  Local Mill  ');
    for (const [label, value] of [['Calories (kcal)', '380'], ['Protein (g)', '13.2'], ['Carbohydrates (g)', '60.1'], ['Fat (g)', '7.3']])
        await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit Oats', exact: true })).toBeVisible();
}

for (const route of ['/dash', '/food', '/drinks']) {
    test(`${route}: templates persist offline and log only on explicit confirmation`, async ({ page, context }) => {
        await prepare(page);
        await page.goto(route);
        await expect(page.locator('[data-action="log-drink"]')).toHaveCount(0);
        await create(page);
        expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
        const id = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods')!)[0].id);
        await page.getByRole('button', { name: 'Close Create Food' }).click();
        await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
        await page.reload();
        await context.setOffline(true);
        await open(page, 'search-food');
        await expect(page.locator('#savedFoodsOverlay')).toHaveClass(/visible/);
        await expect(page.locator('#barcodeSearchOverlay')).not.toHaveClass(/visible/);
        await page.getByLabel('Search name or brand').fill('local mill');
        await page.locator('#savedFoodsModal .food-library-result').click();
        await page.getByLabel('Amount (g)').fill('125');
        await expect(page.locator('#savedFoodsModal')).toContainText('475 kcal');
        expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
        await page.locator('#savedFoodsModal').getByRole('button', { name: 'Log food', exact: true }).click();
        await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
        const logged = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!));
        expect(logged).toHaveLength(1);
        expect(logged[0]).toMatchObject({ food: 'Oats', brand: 'Local Mill', amount: 125, kcal: 475, prot: 16.5, carb: 75.1, fat: 9.1 });
        await open(page, 'create-food');
        await page.getByRole('button', { name: 'Edit Oats', exact: true }).click();
        await page.getByLabel('Name', { exact: true }).fill('Updated Oats');
        await page.getByLabel('Calories (kcal)', { exact: true }).fill('10');
        await page.getByRole('button', { name: 'Save food', exact: true }).click();
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods')!)[0].id)).toBe(id);
        page.once('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: 'Delete Updated Oats' }).click();
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods')!))).toEqual([]);
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!))).toEqual(logged);
    });
}

test('local search shows empty/no-match states and keeps different favourites without network calls', async ({ page }) => {
    await prepare(page);
    await page.goto('/food');
    const foodRequests: string[] = [];
    page.on('request', request => { if (/openfoodfacts|googleapis/.test(request.url())) foodRequests.push(request.url()); });
    await open(page, 'search-food');
    await expect(page.getByRole('status').filter({ hasText: 'No saved foods yet' })).toBeVisible();
    await page.evaluate(food => {
        localStorage.setItem('calsync_favourites', JSON.stringify([food, food, { ...food, brand: 'Other Mill' }]));
        window.dispatchEvent(new Event('storage'));
    }, sample);
    await expect(page.locator('#savedFoodsModal .food-library-result')).toHaveCount(2);
    await page.getByLabel('Search name or brand').fill('missing');
    await expect(page.getByText('No matching foods. Try another name or brand.')).toBeVisible();
    await page.getByLabel('Search name or brand').fill('other');
    await expect(page.locator('#savedFoodsModal .food-library-result')).toHaveCount(1);
    await expect(page.locator('#barcodeSearchOverlay')).not.toHaveClass(/visible/);
    expect(foodRequests).toEqual([]);
});

test('per-piece templates round-trip, header back returns to search, and fractional servings log base grams', async ({ page }) => {
    await prepare(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/food');
    await open(page, 'create-food');
    await page.getByRole('button', { name: 'Create food', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Rice cake');
    await page.getByLabel('Nutrition per', { exact: true }).selectOption('pcs');
    await page.getByLabel('One piece equals').fill('5');
    for (const [label, value] of [['Calories (kcal)', '20'], ['Protein (g)', '0.4'], ['Carbohydrates (g)', '4'], ['Fat (g)', '0.2']])
        await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit Rice cake' })).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods')!)[0]);
    expect(stored).toMatchObject({ kcalPer100: 400, protPer100: 8, portion: { unit: 'pcs', amount: 5 } });
    await page.getByRole('button', { name: 'Edit Rice cake' }).click();
    await expect(page.getByLabel('Calories (kcal)', { exact: true })).toHaveValue('20');
    await expect(page.getByLabel('Nutrition per', { exact: true })).toHaveValue('pcs');
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    await page.getByRole('button', { name: 'Close Create Food' }).click();
    await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
    await open(page, 'search-food');
    await page.getByLabel('Search name or brand').fill('rice');
    await page.locator('#savedFoodsModal .food-library-result').click();
    await expect(page.getByLabel('Amount (piece)', { exact: true })).toHaveValue('1');
    const back = page.getByRole('button', { name: 'Back to saved foods' });
    await expect(page.locator('#savedFoodsModal .modal-header').getByRole('button', { name: 'Back to saved foods' })).toBeVisible();
    await back.click();
    await expect(page.getByLabel('Search name or brand')).toHaveValue('rice');
    await page.locator('#savedFoodsModal .food-library-result').click();
    await page.getByLabel('Amount (piece)', { exact: true }).fill('2.5');
    await expect(page.locator('.saved-food-macro.calories')).toContainText('50 kcal');
    await expect(page.getByText('12.5 g total', { exact: true })).toBeVisible();
    await page.getByLabel('Amount unit', { exact: true }).selectOption('g');
    await expect(page.getByLabel('Amount (g)', { exact: true })).toHaveValue('12.5');
    await expect(page.locator('.saved-food-macro.calories')).toContainText('50 kcal');
    await page.getByLabel('Amount unit', { exact: true }).selectOption('pcs');
    await expect(page.getByLabel('Amount (piece)', { exact: true })).toHaveValue('2.5');
    await page.screenshot({ path: test.info().outputPath('saved-food-piece-mobile.png') });
    await page.locator('#savedFoodsModal').getByRole('button', { name: 'Log food', exact: true }).click();
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!)[0])).toMatchObject({ amount: 12.5, unit: 'g', kcal: 50, prot: 1 });
});

test('US fluid ounce prefills volume and requires an explicit weight when switching to grams', async ({ page }) => {
    await prepare(page);
    await page.goto('/food');
    await open(page, 'create-food');
    await page.getByRole('button', { name: 'Create food', exact: true }).click();
    await page.getByLabel('Nutrition per', { exact: true }).selectOption('fl_oz');
    await expect(page.getByLabel('One US fluid ounce equals')).toHaveValue('29.5735295625');
    await expect(page.getByLabel('Portion size unit')).toHaveValue('ml');
    await page.getByLabel('Portion size unit').selectOption('g');
    await expect(page.getByLabel('One US fluid ounce equals')).toHaveValue('');
    await expect(page.getByText('Enter the actual weight for this food. Volume and weight depend on density.')).toBeVisible();
    await page.getByLabel('One US fluid ounce equals').fill('32');
    await page.getByLabel('Name', { exact: true }).fill('Cream');
    for (const label of ['Calories (kcal)', 'Protein (g)', 'Carbohydrates (g)', 'Fat (g)'])
        await page.getByLabel(label, { exact: true }).fill('10');
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods')!)[0])).toMatchObject({ defaultUnit: 'g', kcalPer100: 31.25, portion: { unit: 'fl_oz', amount: 32 } });
});

test('account settings retry survives reload; guest, A and B libraries remain isolated', async ({ page }) => {
    test.skip(!isolated, 'Controlled Auth/Supabase transport fixture only.');
    await prepare(page);
    await page.goto('/dash');
    await create(page);
    const guestId = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods')!)[0].id);
    await page.getByRole('button', { name: 'Close Create Food' }).click();
    await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
    const accountA = '11111111-1111-4111-8111-111111111111';
    const accountB = '22222222-2222-4222-8222-222222222222';
    const login = async (account: 'A' | 'B', id: string) => {
        await page.goto('/login?keep_login_page=true');
        await page.locator('#loginEmail').fill(`${account}@example.invalid`);
        await page.locator('#loginPassword').fill('FixturePassword1!');
        await page.locator('#loginBtn').click();
        await expect.poll(() => page.evaluate(() => localStorage.getItem('healthsync_active_owner'))).toBe(id);
        await page.goto('/dash');
    };
    await login('A', accountA);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods') || '[]'))).toEqual([]);
    await page.evaluate(() => sessionStorage.setItem('fixture-custom-foods-write-fails', '1'));
    await create(page);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('healthsync_pending_settings') || '{}').custom_foods?.length)).toBe(1);
    await page.reload();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods') || '[]').length)).toBe(1);
    await page.evaluate(() => {
        sessionStorage.removeItem('fixture-custom-foods-write-fails');
        window.dispatchEvent(new Event('online'));
    });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('healthsync_pending_settings'))).toBeNull();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('calsync_custom_foods_dirty'))).toBeNull();
    expect(await page.evaluate(id => JSON.parse(sessionStorage.getItem(`fixture-custom-foods-${id}`) || '[]').length, accountA)).toBe(1);
    await page.goto('/login?keep_login_page=true');
    await page.locator('#viewLoggedIn').getByRole('button', { name: 'Logout', exact: true }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('healthsync_active_owner'))).toBe('guest');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods')!)[0].id)).toBe(guestId);
    await login('B', accountB);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods') || '[]'))).toEqual([]);
});

test('mobile sheets trap/restore focus, support Escape, overlay and dragging, and reject blank names', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.goto('/dash');
    await open(page, 'create-food');
    await page.getByRole('button', { name: 'Create food', exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
    await page.getByLabel('Name', { exact: true }).fill('   ');
    for (const label of ['Calories (kcal)', 'Protein (g)', 'Carbohydrates (g)', 'Fat (g)'])
        await page.getByLabel(label, { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.locator('#customFoodsModal').getByRole('alert')).toHaveText('Enter a name and finite, non-negative nutrition values.');
    await page.screenshot({ path: test.info().outputPath('custom-food-editor-mobile.png') });
    expect(await page.evaluate(() => localStorage.getItem('calsync_custom_foods'))).toBeNull();
    await page.getByRole('button', { name: 'Save food', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close Create Food' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
    await expect(page.locator('#extraActionToggle')).toBeFocused();
    await open(page, 'search-food');
    await page.locator('#savedFoodsOverlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    await open(page, 'search-food');
    await page.locator('#savedFoodsModal .modal-handle-zone').click({ trial: true });
    const handle = await page.locator('#savedFoodsModal .modal-handle-zone').boundingBox();
    expect(handle).not.toBeNull();
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle!.x + handle!.width / 2, 840, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
    await open(page, 'create-food');
    await page.getByRole('button', { name: 'Create food', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Private unsaved draft');
    await page.evaluate(() => {
        localStorage.setItem('healthsync_active_owner', 'another-fixture-owner');
        window.dispatchEvent(new Event('storage'));
    });
    await expect(page.getByLabel('Name', { exact: true })).not.toBeVisible();
    await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('calsync_custom_foods'))).toBeNull();
});

test('barcode opens the camera, looks up only the scanned code and confirms through the shared logging path', async ({ page }) => {
    await prepare(page, true);
    await page.addInitScript(() => {
        type ScannerWindow = Window & { scanFixture?: (code: string) => void; ZXingBrowser?: unknown };
        const scannerWindow = window as ScannerWindow;
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 4;
            return canvas.captureStream(1);
        } });
        scannerWindow.ZXingBrowser = { BrowserMultiFormatReader: class {
            decodeFromStream(_stream: unknown, _video: unknown, callback: (result: { getText: () => string }) => void) {
                scannerWindow.scanFixture = code => callback({ getText: () => code });
            }
            stop() { scannerWindow.scanFixture = undefined; }
            reset() { scannerWindow.scanFixture = undefined; }
        } };
    });
    await page.route('https://world.openfoodfacts.org/api/v0/product/123456.json', route => route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { status: 1, product: { product_name: 'Barcode Oats', nutriments: { 'energy-kcal_100g': 380, proteins_100g: 13.2, carbohydrates_100g: 60.1, fat_100g: 7.3 } } },
    }));
    await page.goto('/dash');
    await open(page, 'scan-barcode');
    await expect(page.locator('#barcodeSearchModal .modal-title')).toHaveText('Scan Barcode');
    await expect(page.locator('#barcodeSearchInput')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Search by name' })).toHaveCount(0);
    await page.waitForFunction(() => {
        const scan = (window as Window & { scanFixture?: (code: string) => void }).scanFixture;
        if (!scan) return false;
        scan('123456');
        return true;
    });
    await expect(page.locator('#barcodeSearchModal .modal-title')).toHaveText('Set Amount');
    await page.getByRole('button', { name: 'Log food', exact: true }).click();
    await expect(page.locator('#barcodeSearchOverlay')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!)[0])).toMatchObject({ food: 'Barcode Oats', barcode: '123456', kcal: 380 });
});
