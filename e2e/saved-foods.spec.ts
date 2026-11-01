import { test, expect, type Page, type CDPSession } from '@playwright/test';
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

async function chooseCreation(page: Page, kind: 'food' | 'recipe') {
    await page.getByRole('button', { name: 'Create food', exact: true }).click();
    await page.getByRole('dialog', { name: 'Create new', exact: true }).getByRole('button', { name: kind === 'food' ? 'Food' : 'Recipe', exact: true }).click();
    await expect(page.locator('#foodCreateChoiceOverlay')).toHaveCount(0);
}

async function editCreatedFood(page: Page, name: string) {
    if (!await page.locator('#savedFoodDetailOverlay').count())
        await page.getByRole('button', { name: `View ${name}`, exact: true }).click();
    await page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Edit', exact: true }).click();
}

async function closeFoodDetails(page: Page) {
    await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
    if (await page.locator('#savedFoodDetailOverlay').count()) {
        await page.locator('#savedFoodDetailModal .modal-header .modal-btn > button').click();
        await expect(page.locator('#savedFoodDetailOverlay')).toHaveCount(0);
    }
}

async function closeCustomFoods(page: Page) {
    await closeFoodDetails(page);
    await page.locator('#customFoodsModal').getByRole('button', { name: 'Close Custom Food', exact: true }).click();
    await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
}

async function closeSavedFoods(page: Page) {
    await expect(page.locator('#savedFoodsOverlay')).not.toHaveAttribute('inert', '');
    const close = page.locator('#savedFoodsModal .modal-header').getByRole('button', { name: 'Close Saved Foods', exact: true });
    if (await close.count()) await close.click();
    else await page.keyboard.press('Escape');
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
}

async function observeClosingParents(page: Page, childId: string, parentIds: string[]) {
    await page.evaluate(({ childId, parentIds }) => {
        const child = document.getElementById(childId)!;
        const parents = parentIds.map(id => document.getElementById(id)!);
        const observer = new MutationObserver(() => {
            if (child.classList.contains('visible')) return;
            observer.disconnect();
            requestAnimationFrame(() => parents[0].setAttribute('data-close-probe', JSON.stringify({
                childConnected: child.isConnected,
                parents: parents.map(parent => ({ scaled: parent.classList.contains('has-sub-modal'), inert: parent.inert })),
            })));
        });
        observer.observe(child, { attributes: true, attributeFilter: ['class'] });
    }, { childId, parentIds });
}

for (const size of [{ width: 390, height: 844 }, { width: 320, height: 480 }, { width: 844, height: 390 }]) {
    test(`Create new chooser keeps the manager, restores focus and opens both editors at ${size.width}x${size.height}`, async ({ page }) => {
        await prepare(page); await page.setViewportSize(size);
        const reduced = size.width === 320;
        await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
        await page.addInitScript(() => localStorage.setItem('healthsync_modals_expanded', 'true'));
        await page.goto('/food'); await open(page, 'create-food');
        const manager = page.locator('#customFoodsModal');
        const create = manager.getByRole('button', { name: 'Create food', exact: true });
        await expect(manager.getByRole('button', { name: 'Create recipe', exact: true })).toHaveCount(0);
        const managerNode = await manager.elementHandle();
        const contents = await manager.textContent();
        await create.click();
        const choice = page.getByRole('dialog', { name: 'Create new', exact: true });
        await expect(choice).toBeVisible();
        await expect(choice.getByRole('button', { name: 'Food', exact: true })).toBeVisible();
        await expect(choice.getByRole('button', { name: 'Recipe', exact: true })).toBeVisible();
        await expect.poll(async () => {
            const box = (await choice.boundingBox())!;
            return box.y + box.height <= size.height + 1;
        }).toBe(true);
        await expect(page.locator('#customFoodsOverlay')).toHaveAttribute('inert', '');
        await expect(page.locator('#customFoodsOverlay')).toHaveAttribute('aria-hidden', 'true');
        await expect(page.locator('#customFoodsOverlay')).toHaveClass(/has-sub-modal/);
        expect(await managerNode!.evaluate(el => el.isConnected)).toBe(true);
        expect(await manager.textContent()).toBe(contents);
        const bounds = (await choice.boundingBox())!;
        expect(bounds.height).toBeLessThan(size.height - 50);
        expect(bounds.y).toBeGreaterThan(24);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
        const transition = await manager.evaluate(el => {
            const style = getComputedStyle(el);
            return { properties: style.transitionProperty.split(', '), durations: style.transitionDuration.split(', ') };
        });
        expect(transition.properties).toEqual(expect.arrayContaining(['transform', 'scale']));
        expect(transition.durations.every(duration => duration === (reduced ? '0s' : '0.35s'))).toBe(true);
        await page.screenshot({ path: test.info().outputPath('create-new-chooser.png') });
        await observeClosingParents(page, 'foodCreateChoiceOverlay', ['customFoodsOverlay']);
        await page.keyboard.press('Escape');
        await expect(page.locator('#customFoodsOverlay')).toHaveAttribute('data-close-probe', JSON.stringify({
            childConnected: true, parents: [{ scaled: false, inert: true }],
        }));
        await expect(page.locator('#foodCreateChoiceOverlay')).toHaveCount(0);
        await expect(create).toBeFocused(); await expect(page.locator('#customFoodsOverlay')).not.toHaveAttribute('inert', '');
        await create.click();
        await page.locator('#foodCreateChoiceOverlay').click({ position: { x: 4, y: 4 } });
        await expect(page.locator('#foodCreateChoiceOverlay')).toHaveCount(0);
        await expect(create).toBeFocused();
        await create.click();
        await expect(choice.getByRole('button', { name: 'Close Create new', exact: true })).toBeFocused();
        await choice.getByRole('button', { name: 'Food', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#foodCreateChoiceOverlay')).toHaveCount(0);
        await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
        await page.getByRole('button', { name: 'Back to created foods', exact: true }).click();
        await chooseCreation(page, 'recipe');
        await expect(page.getByLabel('Recipe name', { exact: true })).toBeFocused();
        expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
    });
}

async function create(page: Page) {
    await open(page, 'create-food');
    await chooseCreation(page, 'food');
    await page.getByLabel('Name', { exact: true }).fill('  Oats  ');
    await page.getByLabel('Brand (optional)').fill('  Local Mill  ');
    for (const [label, value] of [['Calories (kcal)', '380'], ['Protein (g)', '13.2'], ['Carbohydrates (g)', '60.1'], ['Fat (g)', '7.3']])
        await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.getByRole('button', { name: 'View Oats', exact: true })).toBeVisible();
}

test('custom foods, search and favorites share details/editing and stars never save unfinished edits', async ({ page }) => {
    await prepare(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/food');
    await create(page);
    await page.getByRole('button', { name: 'View Oats', exact: true }).click();
    const details = page.locator('#savedFoodDetailModal');
    const detailNode = await details.locator('.saved-food-detail').elementHandle();
    await details.getByLabel('Amount (g)', { exact: true }).fill('125');
    const favorite = details.getByRole('button', { name: 'Favorite Oats', exact: true });
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    const libraryBeforeEdit = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!));
    const definitions = libraryBeforeEdit.changes.filter((item: { kind: string }) => item.kind === 'definition');
    expect(definitions).toHaveLength(1);
    const originalId = definitions[0].food.id;
    await details.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.locator('#editFoodModal');
    await expect(page.locator('#savedFoodDetailOverlay')).toHaveAttribute('inert', '');
    await expect(page.locator('#customFoodsOverlay')).toHaveAttribute('inert', '');
    await expect(edit.getByRole('button', { name: 'Favorite Oats', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await edit.getByLabel('Name', { exact: true }).fill('Unsaved oats');
    const editStar = edit.getByRole('button', { name: 'Favorite Unsaved oats', exact: true });
    await editStar.click(); await expect(editStar).toHaveAttribute('aria-pressed', 'false');
    await expect(details.locator('.food-detail-favorite')).toHaveAttribute('aria-pressed', 'false');
    await editStar.press('Enter'); await expect(editStar).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: test.info().outputPath('shared-custom-food-edit.png') });
    await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
    expect(await detailNode!.evaluate(el => el.isConnected)).toBe(true);
    await expect(details.getByRole('button', { name: 'Edit', exact: true })).toBeFocused();
    await expect(details.getByLabel('Amount (g)', { exact: true })).toHaveValue('125');
    const afterCancel = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!));
    expect(afterCancel.changes.filter((item: { kind: string }) => item.kind === 'definition')).toEqual(definitions);
    await page.screenshot({ path: test.info().outputPath('shared-custom-food-details.png') });
    await details.getByRole('button', { name: 'Add to selection', exact: true }).click();
    await expect(page.locator('#savedFoodDetailOverlay')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'View Oats', exact: true })).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_selection_v1')!).items[0]))
        .toMatchObject({ food: { name: 'Oats', catalogFoodId: originalId }, amount: '125', unit: 'g' });
    expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
    await closeCustomFoods(page);
    await page.reload();
    await open(page, 'search-food');
    await page.getByRole('button', { name: 'Favorites', exact: true }).click();
    await expect(page.locator('#savedFoodsModal .food-library-result')).toHaveCount(1);
    await page.locator('#savedFoodsModal .food-library-result').click();
    await expect(details).toBeVisible();
    await expect(details.getByRole('button', { name: 'Favorite Oats', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await details.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.locator('#editFoodModal')).toHaveCount(1);
    await edit.getByLabel('Name', { exact: true }).fill('Updated oats');
    await edit.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
    await closeFoodDetails(page);
    await expect(page.locator('#savedFoodsModal .food-library-result')).toContainText('Updated oats');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('#savedFoodsModal .food-library-result')).toHaveCount(1);
    await page.locator('#savedFoodsModal .food-library-result').click();
    await expect(details.getByRole('button', { name: 'Favorite Updated oats', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await closeFoodDetails(page);
    await closeSavedFoods(page);
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    await open(page, 'create-food');
    await page.getByRole('button', { name: 'View Updated oats', exact: true }).click();
    await expect(details.getByRole('button', { name: 'Favorite Updated oats', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const finalLibrary = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!));
    expect(finalLibrary.changes.filter((item: { kind: string }) => item.kind === 'definition').map((item: { foodId: string }) => item.foodId))
        .toEqual([originalId, originalId]);
});

test('adding a custom food preserves a prepared batch waiting for retry', async ({ page }) => {
    await prepare(page); await page.goto('/food'); await create(page);
    const prepared = { version: 1, items: [{ id: 'pending', food: sample, amount: '100', unit: 'g' }], ts: 123456,
        batch: [{ id: 'fixed-retry-id', food: 'Oats' }] };
    await page.evaluate(cache => localStorage.setItem('calsync_food_selection_v1', JSON.stringify(cache)), prepared);
    await page.getByRole('button', { name: 'View Oats', exact: true }).click();
    await page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Add to selection', exact: true }).click();
    await expect(page.locator('#savedFoodDetailModal').getByRole('alert')).toContainText('Finish pending food logging');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_selection_v1')!))).toEqual(prepared);
});

test('food editing limits displayed decimals while preserving untouched nutrition precision', async ({ page }) => {
    await prepare(page); await page.goto('/food');
    const nutrients = { kcalPer100: 137.735849057, protPer100: 2.60377358491,
        carbPer100: 30.9056603774, fatPer100: 0.792452830189 };
    await page.evaluate(food => {
        localStorage.setItem('calsync_custom_foods', JSON.stringify([food]));
        window.dispatchEvent(new Event('storage'));
    }, { ...sample, ...nutrients, id: 'precise' });
    await open(page, 'create-food');
    await editCreatedFood(page, 'Oats');
    const edit = page.locator('#editFoodModal');
    for (const [label, value] of [['Calories (kcal)', '137.74'], ['Protein (g)', '2.6'],
        ['Carbohydrates (g)', '30.91'], ['Fat (g)', '0.79']])
        await expect(edit.getByLabel(label, { exact: true })).toHaveValue(value);
    await edit.getByLabel('Calories (kcal)', { exact: true }).fill('12.3456');
    await edit.getByLabel('Protein (g)', { exact: true }).focus();
    await expect(edit.getByLabel('Calories (kcal)', { exact: true })).toHaveValue('12.35');
    await edit.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!).changes
        .filter((item: { kind: string; food?: unknown }) => item.kind === 'definition' && item.food).at(-1).food);
    expect(saved).toMatchObject({ ...nutrients, kcalPer100: 12.35 });
    await editCreatedFood(page, 'Oats');
    await expect(edit.getByLabel('Calories (kcal)', { exact: true })).toHaveValue('12.35');
    const handle = edit.locator('.modal-handle-zone');
    await handle.click({ trial: true });
    const box = (await handle.boundingBox())!;
    await observeClosingParents(page, 'editFoodOverlay', ['savedFoodDetailOverlay', 'customFoodsOverlay']);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('#savedFoodDetailOverlay')).toHaveAttribute('data-close-probe', JSON.stringify({
        childConnected: true, parents: [{ scaled: false, inert: true }, { scaled: true, inert: true }],
    }));
    await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
});

async function queuedReview(page: Page) {
    await page.evaluate(sample => {
        localStorage.setItem('calsync_custom_foods', JSON.stringify([
            { ...sample, id: 'oats' }, { ...sample, id: 'milk', name: 'Milk', defaultUnit: 'ml', isLiquid: true, kcalPer100: 50 },
        ]));
        window.dispatchEvent(new Event('storage'));
    }, sample);
    await open(page, 'search-food');
    await page.getByRole('button', { name: 'Add Oats to selection', exact: true }).click();
    await page.getByRole('button', { name: 'Add Milk to selection', exact: true }).click();
    await page.getByRole('button', { name: 'Review selected foods', exact: true }).click();
}

test.describe('sheet drag gestures', () => {
    test.use({ hasTouch: true });

    async function touchDrag(page: Page, x: number, y: number, dx: number, dy: number, cancel = false, inspect?: (session: CDPSession) => Promise<void>) {
        const session = await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        for (let step = 1; step <= 6; step++) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 6, y: y + dy * step / 6, id: 1 }] });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        }
        await inspect?.(session);
        await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
        await session.detach();
    }

    async function detail(page: Page, height = 844) {
        await prepare(page); await page.setViewportSize({ width: 390, height }); await page.goto('/food');
        await page.evaluate(food => {
            localStorage.setItem('calsync_custom_foods', JSON.stringify([{ ...food, id: 'oats' }]));
            window.dispatchEvent(new Event('storage'));
        }, sample);
        await open(page, 'search-food');
        await page.locator('#savedFoodsModal .food-library-result').tap();
        await expect(page.locator('#savedFoodDetailModal')).toBeVisible();
        await expect.poll(() => page.locator('#savedFoodDetailModal').evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
    }

    test('header pulls move the sheet while Back, Close and favorite taps remain available', async ({ page }) => {
        await detail(page);
        const modal = page.locator('#savedFoodDetailModal');
        await expect(modal.getByRole('button', { name: 'Close Food details', exact: true })).toHaveCount(0);
        const title = (await modal.locator('.modal-title').boundingBox())!;
        await touchDrag(page, title.x + title.width / 2, title.y + title.height / 2, 0, 40, true, async () => {
            await expect.poll(() => modal.evaluate(el => (el as HTMLElement).style.transform)).toBe('translateY(40px)');
        });
        await expect.poll(() => modal.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
        await touchDrag(page, title.x + title.width / 2, title.y + title.height / 2, 0, 8);
        await expect.poll(() => modal.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
        await modal.getByRole('button', { name: 'Favorite Oats', exact: true }).tap();
        await expect(modal.getByRole('button', { name: 'Favorite Oats', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await modal.getByRole('button', { name: 'Edit', exact: true }).tap();
        await expect(page.locator('#editFoodModal .modal-btn--right')).toHaveCount(0);
        await page.getByLabel('Name', { exact: true }).fill('Unfinished');
        await page.locator('#editFoodModal').getByRole('button', { name: 'Back to food details', exact: true }).tap();
        await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
        await modal.getByRole('button', { name: 'Back to saved foods', exact: true }).tap();
        await expect(page.locator('#savedFoodDetailOverlay')).toHaveCount(0);
        const main = page.locator('#savedFoodsModal');
        const mainTitle = (await main.locator('.modal-title').boundingBox())!;
        await page.mouse.move(mainTitle.x + mainTitle.width / 2, mainTitle.y + mainTitle.height / 2);
        await page.mouse.down();
        await page.mouse.move(mainTitle.x + mainTitle.width / 2, mainTitle.y + mainTitle.height / 2 + 8, { steps: 4 });
        await page.mouse.up();
        await expect.poll(() => main.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
        await page.locator('#savedFoodsModal').getByRole('button', { name: 'Close Saved Foods', exact: true }).tap();
        await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    });

    test('content scrolls normally, then a top-edge pull follows the finger and cancels or dismisses only the top sheet', async ({ page }) => {
        await detail(page, 480);
        const modal = page.locator('#savedFoodDetailModal');
        const body = modal.locator('.modal-body');
        const box = (await body.boundingBox())!;
        expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
        const x = box.x + 4, y = box.y + 100;
        await touchDrag(page, x, y, 0, -75);
        await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        await body.evaluate(el => { el.scrollTop = 160; });
        await touchDrag(page, x, y, 0, 35);
        expect(await body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        await expect.poll(() => modal.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
        await body.evaluate(el => { el.scrollTop = 0; });
        await touchDrag(page, x, y, 0, 40, true, async () => {
            await expect.poll(() => modal.evaluate(el => (el as HTMLElement).style.transform)).toBe('translateY(40px)');
            expect(await body.evaluate(el => el.scrollTop)).toBe(0);
        });
        await expect.poll(() => modal.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
        await touchDrag(page, x, y, 0, 120);
        await expect(page.locator('#savedFoodDetailOverlay')).toHaveCount(0);
        await expect(page.locator('#savedFoodsOverlay')).toHaveClass(/visible/);
        await expect(page.locator('body')).toHaveClass(/modal-open/);
    });

    test('full-height preference, horizontal gestures, inputs and date wheels keep their expected behavior', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('healthsync_modals_expanded', 'true'));
        await detail(page);
        const modal = page.locator('#savedFoodDetailModal');
        const title = (await modal.locator('.modal-title').boundingBox())!;
        await touchDrag(page, title.x + title.width / 2, title.y + title.height / 2, 0, 40, true, async session => {
            await expect.poll(() => modal.evaluate(el => (el as HTMLElement).style.transform)).toBe('translateY(40px)');
            await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
                { x: title.x + title.width / 2, y: title.y + title.height / 2 + 40, id: 1 },
                { x: title.x + title.width / 2 + 30, y: title.y + title.height / 2 + 40, id: 2 },
            ] });
            await expect.poll(() => modal.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
        });
        await expect.poll(() => modal.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
        const body = (await modal.locator('.modal-body').boundingBox())!;
        await touchDrag(page, body.x + 100, body.y + 20, 100, 0);
        await expect.poll(() => modal.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
        await modal.getByLabel('Amount (g)', { exact: true }).fill('125');
        await expect(modal.getByLabel('Amount (g)', { exact: true })).toHaveValue('125');
        await modal.getByRole('button', { name: 'Add to selection', exact: true }).tap();
        await expect(page.locator('#savedFoodDetailOverlay')).toHaveCount(0);
        await page.getByRole('button', { name: 'Review selected foods', exact: true }).tap();
        await page.locator('#savedFoodsModal .food-batch-date').tap();
        const wheel = page.getByRole('spinbutton', { name: 'Hour', exact: true });
        const wheelBox = (await wheel.boundingBox())!;
        await touchDrag(page, wheelBox.x + wheelBox.width / 2, wheelBox.y + wheelBox.height / 2, 0, 70, true);
        await expect(page.locator('#foodDateTimeOverlay')).toHaveClass(/visible/);
        await expect.poll(() => page.locator('#foodDateTimeModal').evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
    });
});

test('nested food details retain parent DOM, query, tab, scroll, chips and restore opener focus', async ({ page }) => {
    await prepare(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/food');
    await queuedReview(page);
    await page.getByRole('button', { name: 'Back to saved foods' }).click();
    await page.getByLabel('Search foods').fill('oat');
    const main = page.locator('#savedFoodsModal');
    const opener = main.locator('.food-library-result');
    await opener.scrollIntoViewIfNeeded();
    const node = await opener.elementHandle();
    const state = () => main.evaluate(el => ({ text: el.textContent, scroll: el.querySelector('.modal-body')!.scrollTop,
        query: el.querySelector('input')!.value, selection: localStorage.getItem('calsync_food_selection_v1') }));
    const before = await state();
    await opener.click();
    await expect(page.getByRole('dialog', { name: 'Food details', exact: true })).toBeVisible();
    await expect(page.locator('#savedFoodsOverlay')).toHaveAttribute('inert', '');
    await expect(page.locator('#savedFoodsOverlay')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#savedFoodsOverlay')).toHaveClass(/has-sub-modal/);
    await expect.poll(() => main.evaluate(el => getComputedStyle(el).scale)).toBe('0.92');
    await expect(main).toHaveClass(/food-library-modal--has-submodal/);
    expect(await node!.evaluate(el => el.isConnected)).toBe(true);
    expect(await state()).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(page.locator('#savedFoodDetailOverlay')).toHaveCount(0);
    await expect(page.locator('#savedFoodsOverlay')).not.toHaveClass(/has-sub-modal/);
    await expect(opener).toBeFocused(); expect(await state()).toEqual(before);
    await opener.click();
    await page.locator('#savedFoodDetailModal .modal-header .modal-btn > button').click();
    await expect(page.locator('#savedFoodDetailOverlay')).toHaveCount(0);
    await expect(opener).toBeFocused();
});

test('review footer totals and recycled local date/time wheels commit one shared timestamp', async ({ page }) => {
    await prepare(page); await page.setViewportSize({ width: 320, height: 480 });
    await page.clock.setFixedTime(new Date(2026, 9, 30, 23, 59)); await page.goto('/food');
    await queuedReview(page);
    const footer = page.locator('#savedFoodsModal .food-review-footer');
    await expect(footer.locator('dd')).toHaveText(['430 kcal', '26.4 g', '120.2 g', '14.6 g']);
    const complete = footer.getByRole('button', { name: 'Log selected foods', exact: true });
    await expect(complete).toHaveText(''); await expect(complete).toBeInViewport();
    const dateButton = footer.locator('.food-batch-date');
    const original = await dateButton.locator('time').getAttribute('dateTime');
    await dateButton.click();
    const hour = page.getByRole('spinbutton', { name: 'Hour', exact: true });
    const minute = page.getByRole('spinbutton', { name: 'Minute', exact: true });
    const day = page.getByRole('spinbutton', { name: 'Date', exact: true });
    await expect(hour).toHaveAttribute('aria-valuenow', '23'); await expect(minute).toHaveAttribute('aria-valuenow', '59');
    for (const [wheel, cycle] of [[hour, 24], [minute, 60], [day, 0]] as const) {
        const before = Number(await wheel.getAttribute('aria-valuenow'));
        await wheel.hover(); await page.mouse.wheel(0, 100);
        await expect(wheel).toHaveAttribute('aria-valuenow', String(cycle ? (before + 1) % cycle : before + 1));
        await page.mouse.wheel(0, -100);
        await expect(wheel).toHaveAttribute('aria-valuenow', String(before));
    }
    await hour.press('ArrowDown'); await expect(hour).toHaveAttribute('aria-valuenow', '0');
    await hour.press('ArrowUp'); await expect(hour).toHaveAttribute('aria-valuenow', '23');
    await minute.press('ArrowDown'); await expect(minute).toHaveAttribute('aria-valuenow', '0');
    await minute.press('ArrowUp'); await expect(minute).toHaveAttribute('aria-valuenow', '59');
    for (const [wheel, expected] of [[hour, '2'], [minute, '14']] as const) {
        await wheel.evaluate(el => { el.scrollTop += 75 * 44; });
        await expect(wheel).toHaveAttribute('aria-valuenow', expected);
        await expect.poll(() => wheel.evaluate(el => el.scrollTop)).toBe(4400);
        await expect(wheel).toHaveAttribute('aria-valuenow', expected);
    }
    const initialDay = Number(await day.getAttribute('aria-valuenow'));
    // Repeated long scrolls cross the recycled window in each direction.
    for (const direction of [1, -1]) for (let i = 0; i < 5; i++) {
        const before = Number(await day.getAttribute('aria-valuenow'));
        await day.evaluate((el, direction) => { el.scrollTop += direction * 44 * 75; }, direction);
        await expect(day).toHaveAttribute('aria-valuenow', String(before + direction * 75));
        await expect.poll(() => day.evaluate(el => el.scrollTop)).toBe(4400);
        expect(Number(await day.getAttribute('aria-valuenow'))).toBe(before + direction * 75);
    }
    await expect(day).toHaveAttribute('aria-valuenow', String(initialDay));
    await page.screenshot({ path: test.info().outputPath('date-time-wheel-dark.png') });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await expect(page.locator('#foodTimeInstructions')).not.toBeInViewport();
    await expect.poll(() => day.evaluate(el => getComputedStyle(el).color)).toBe('rgb(0, 0, 0)');
    await page.screenshot({ path: test.info().outputPath('date-time-wheel-light.png') });
    await day.press('ArrowUp'); await minute.press('Home');
    await page.keyboard.press('Escape');
    await expect(page.locator('#foodDateTimeOverlay')).toHaveCount(0);
    await expect(dateButton).toBeFocused(); await expect(dateButton.locator('time')).toHaveAttribute('datetime', original!);
    await dateButton.click(); await day.press('ArrowUp'); await hour.press('Home'); await minute.press('Home');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('#foodDateTimeOverlay')).toHaveCount(0);
    const ts = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_selection_v1')!).ts);
    expect(await page.evaluate(ts => [new Date(ts).getDate(), new Date(ts).getHours(), new Date(ts).getMinutes()], ts)).toEqual([29, 0, 0]);
    await page.screenshot({ path: test.info().outputPath('batch-footer-mobile.png') });
    await complete.click(); await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!));
    expect(logs.map((entry: { ts: number }) => entry.ts)).toEqual([ts, ts]);
    expect(logs.map((entry: { date: string }) => entry.date)).toEqual([new Date(ts).toDateString(), new Date(ts).toDateString()]);
});

for (const reduced of [false, true]) test(`chips keep newest first, animate removal and respect reduced motion: ${reduced}`, async ({ page }) => {
    await prepare(page); await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.setViewportSize({ width: 320, height: 640 }); await page.goto('/food'); await queuedReview(page);
    await page.getByRole('button', { name: 'Back to saved foods' }).click();
    const chips = page.locator('.food-selection-chips');
    await expect(chips.locator('button>span')).toHaveText(['Milk', 'Oats']);
    await chips.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await page.getByRole('button', { name: 'Add Oats to selection', exact: true }).click();
    await expect(chips.locator('button>span')).toHaveText(['Oats', 'Milk', 'Oats']);
    expect(await chips.evaluate(el => el.scrollLeft)).toBe(0);
    if (reduced) expect(await chips.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    // Freeze a normal exit animation at its midpoint to prove the cache retains it.
    if (!reduced) await chips.locator('button').first().evaluate(el => {
        const animate = el.animate.bind(el);
        el.animate = (...args) => {
            const animation = animate(...args), cancel = animation.cancel.bind(animation);
            animation.cancel = () => { cancel(); sessionStorage.setItem('chip-opacity-after-cancel', getComputedStyle(el).opacity); };
            animation.pause(); animation.currentTime = 90; return animation;
        };
    });
    await chips.locator('button').first().click();
    if (!reduced) {
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_selection_v1')!).items.length)).toBe(3);
        expect(await chips.locator('button').first().evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(1);
        await chips.locator('button').first().evaluate(el => el.getAnimations().forEach(animation => animation.finish()));
    }
    await expect(chips.locator('button>span')).toHaveText(['Milk', 'Oats']);
    if (!reduced) expect(await page.evaluate(() => sessionStorage.getItem('chip-opacity-after-cancel'))).toBe('0');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_selection_v1')!).items.map((item: { food: { name: string } }) => item.food.name))).toEqual(['Milk', 'Oats']);
});

test('compact add feedback, icon avatars, detail facts and tab transitions follow the shared sheet design', async ({ page }) => {
    await prepare(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/food');
    await page.evaluate(sample => {
        const food = { ...sample, id: 'oats', kind: 'food', emoji: 'fa-solid fa-bowl-food', barcode: '12345678' };
        localStorage.setItem('calsync_food_library_v1', JSON.stringify({ version: 1, changes: [
            { id: 'fixture-definition', foodId: 'oats', at: 1, kind: 'definition', food },
            { id: 'fixture-favorite', foodId: 'oats', at: 2, kind: 'favorite', favorite: true },
        ], pending: [], imported: [] }));
        window.dispatchEvent(new Event('storage'));
    }, sample);
    await open(page, 'search-food');
    const main = page.locator('#savedFoodsModal');
    await expect(main.locator('.saved-food-avatar i.fa-bowl-food')).toHaveCount(1);
    const add = main.getByRole('button', { name: 'Add Oats to selection', exact: true });
    await add.click(); await expect(add.locator('i')).toHaveClass('fa-solid fa-check');
    expect(await add.locator('.food-library-add-symbol').evaluate(el => el.getBoundingClientRect().width)).toBe(30);
    await expect.poll(() => add.locator('.food-library-add-symbol').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await expect.poll(() => add.locator('i').evaluate(el => getComputedStyle(el).color)).toBe('rgb(0, 0, 0)');
    expect(await add.evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
    await expect(add.locator('i')).toHaveClass('fa-solid fa-plus');
    await main.getByRole('button', { name: 'Favorites', exact: true }).click();
    expect(await main.locator('.food-library-results').evaluate(el => getComputedStyle(el).animationName)).toBe('food-library-view-enter');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await main.getByRole('button', { name: 'Search', exact: true }).click();
    expect(await main.locator('.food-library-results').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await main.locator('.food-library-result').click();
    const detail = page.locator('#savedFoodDetailModal');
    await expect(detail).not.toContainText(/Barcode|12345678/);
    const star = detail.locator('.food-detail-heading').getByRole('button', { name: 'Favorite Oats', exact: true });
    await expect(star).toHaveText(''); await expect(star).toHaveAttribute('aria-pressed', 'true');
    await star.click(); await expect(star).toHaveAttribute('aria-pressed', 'false');
    await expect(detail.getByRole('region', { name: 'Nutrition Facts', exact: true })).toBeVisible();
    await expect(detail.locator('.food-edit-ring')).toHaveText('380kcal');
    await detail.getByLabel('Amount (g)', { exact: true }).fill('50');
    await expect(detail.locator('.food-edit-ring')).toHaveText('190kcal');
    await page.screenshot({ path: test.info().outputPath('refined-food-details.png') });
    await detail.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.locator('#savedFoodDetailOverlay')).toHaveClass(/has-sub-modal/);
    expect(await page.locator('#editFoodModal .food-edit-body').evaluate(el => getComputedStyle(el).scrollbarWidth)).toBe('thin');
});

test('partial local failure reopens review with the same timestamp, amounts and IDs; retry never duplicates', async ({ page }) => {
    await prepare(page); await page.goto('/food'); await queuedReview(page);
    await page.getByLabel('Amount (ml)', { exact: true }).fill('250');
    const date = page.locator('.food-batch-date time');
    const before = await date.getAttribute('datetime');
    await page.evaluate(() => {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (key === 'dropsync_v3' && sessionStorage.getItem('fail-local-food') === '1') throw new DOMException('private diagnostic', 'QuotaExceededError');
            return set.call(this, key, value);
        };
        sessionStorage.setItem('fail-local-food', '1');
    });
    await page.getByRole('button', { name: 'Log selected foods', exact: true }).click();
    await expect(page.locator('#savedFoodsOverlay')).not.toHaveClass(/visible/);
    await expect(page.locator('#savedFoodsOverlay')).toHaveClass(/visible/);
    await expect(page.locator('#savedFoodsModal').getByRole('alert')).toHaveText('Could not save on this device. Free some storage and retry.');
    await expect(page.getByLabel('Amount (ml)', { exact: true })).toHaveValue('250');
    await expect(date).toHaveAttribute('datetime', before!);
    const prepared = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_selection_v1')!));
    expect(prepared.items).toHaveLength(2); expect(prepared.batch).toHaveLength(2);
    await page.evaluate(() => sessionStorage.removeItem('fail-local-food'));
    await page.getByRole('button', { name: 'Log selected foods', exact: true }).click();
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!));
    expect(logs.map((entry: { id: string }) => entry.id)).toEqual(prepared.batch.map((entry: { id: string }) => entry.id));
    expect(new Set(logs.map((entry: { ts: number }) => entry.ts)).size).toBe(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dropsync_v3')!).length)).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('calsync_food_selection_v1'))).toBeNull();
    await page.reload(); expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!).length)).toBe(2);
});

test('cloud requests can stay pending or fail after dismissal without restoring the logged selection', async ({ page }) => {
    test.skip(!isolated, 'Controlled cloud transport only.');
    await prepare(page); await page.goto('/login?keep_login_page=true');
    await page.locator('#loginEmail').fill('A@example.test'); await page.locator('#loginPassword').fill('fixture-password');
    await page.locator('#loginBtn').click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('healthsync_active_owner'))).toBe('11111111-1111-4111-8111-111111111111');
    await page.goto('/food');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('healthsync_last_cloud_sync'))).not.toBeNull();
    await queuedReview(page);
    await page.evaluate(() => sessionStorage.setItem('fixture-food-sync', 'hold'));
    await page.getByRole('button', { name: 'Log selected foods', exact: true }).click();
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!).length)).toBe(2);
    expect(await page.evaluate(() => localStorage.getItem('calsync_food_selection_v1'))).toBeNull();
    await page.evaluate(() => { sessionStorage.setItem('fixture-food-sync', 'fail'); window.dispatchEvent(new Event('fixture-food-release')); });
    await expect(page.getByText(/Foods saved locally; cloud sync will retry\.|Cloud sync failed\. Your changes remain saved on this device and will retry\./).first()).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('healthsync_pending_food')!).length)).toBe(2);
    await open(page, 'search-food'); await expect(page.locator('.food-selection-row')).toHaveText('No food selected.');
});

for (const route of ['/dash', '/food', '/drinks']) {
    test(`${route}: templates persist offline and log only on explicit confirmation`, async ({ page, context }) => {
        await prepare(page);
        await page.goto(route);
        await expect(page.locator('[data-action="log-drink"]')).toHaveCount(0);
        await expect(page.locator('[data-action="favorite-food"]')).toHaveCount(0);
        await expect(page.locator('[data-action="search-food"]')).toHaveCount(1);
        await create(page);
        expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
        const id = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!).changes.filter((item: { kind: string; food?: unknown }) => item.kind === 'definition' && item.food).at(-1).food.id);
        await closeCustomFoods(page);
        await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
        await page.reload();
        await context.setOffline(true);
        await open(page, 'search-food');
        await expect(page.locator('#savedFoodsOverlay')).toHaveClass(/visible/);
        await expect(page.locator('#barcodeSearchOverlay')).not.toHaveClass(/visible/);
        await page.getByLabel('Search foods').fill('local mill');
        await page.locator('#savedFoodsModal .food-library-result').click();
        await page.getByLabel('Amount (g)').fill('125');
        await expect(page.locator('#savedFoodDetailModal .food-edit-ring')).toHaveText('475kcal');
        expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
        await page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Add to selection', exact: true }).click();
        await page.getByRole('button', { name: 'Review selected foods', exact: true }).click();
        await page.getByRole('button', { name: 'Log selected foods', exact: true }).click();
        await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
        const logged = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!));
        expect(logged).toHaveLength(1);
        expect(logged[0]).toMatchObject({ food: 'Oats', brand: 'Local Mill', amount: 125, kcal: 475, prot: 16.5, carb: 75.1, fat: 9.1 });
        await open(page, 'create-food');
        await editCreatedFood(page, 'Oats');
        await page.getByLabel('Name', { exact: true }).fill('Updated Oats');
        await page.getByLabel('Calories (kcal)', { exact: true }).fill('10');
        await page.getByRole('button', { name: 'Save food', exact: true }).click();
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!).changes.filter((item: { kind: string; food?: unknown }) => item.kind === 'definition' && item.food).at(-1).food.id)).toBe(id);
        await closeFoodDetails(page);
        page.once('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: 'Delete Updated Oats' }).click();
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!).changes.at(-1).food)).toBeNull();
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
    await page.getByLabel('Search foods').fill('missing');
    await expect(page.getByText('No matching foods.')).toBeVisible();
    await page.getByLabel('Search foods').fill('other');
    await expect(page.locator('#savedFoodsModal .food-library-result')).toHaveCount(1);
    await expect(page.locator('#barcodeSearchOverlay')).not.toHaveClass(/visible/);
    expect(foodRequests).toEqual([]);
});

test('per-piece templates round-trip, header back returns to search, and fractional servings log base grams', async ({ page }) => {
    await prepare(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/food');
    await open(page, 'create-food');
    await chooseCreation(page, 'food');
    await page.getByLabel('Name', { exact: true }).fill('Rice cake');
    await page.getByLabel('Nutrition per', { exact: true }).selectOption('pcs');
    await page.getByLabel('One piece equals').fill('5');
    for (const [label, value] of [['Calories (kcal)', '20'], ['Protein (g)', '0.4'], ['Carbohydrates (g)', '4'], ['Fat (g)', '0.2']])
        await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.getByRole('button', { name: 'View Rice cake' })).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!).changes.filter((item: { kind: string; food?: unknown }) => item.kind === 'definition' && item.food).at(-1).food);
    expect(stored).toMatchObject({ kcalPer100: 400, protPer100: 8, portion: { unit: 'pcs', amount: 5 } });
    await editCreatedFood(page, 'Rice cake');
    await expect(page.getByLabel('Calories (kcal)', { exact: true })).toHaveValue('20');
    await expect(page.getByLabel('Nutrition per', { exact: true })).toHaveValue('pcs');
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    await closeCustomFoods(page);
    await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
    await open(page, 'search-food');
    await page.getByLabel('Search foods').fill('rice');
    await page.locator('#savedFoodsModal .food-library-result').click();
    await expect(page.getByLabel('Amount (piece)', { exact: true })).toHaveValue('1');
    const back = page.getByRole('button', { name: 'Back to saved foods' });
    await expect(page.locator('#savedFoodDetailModal .modal-header').getByRole('button', { name: 'Back to saved foods' })).toBeVisible();
    await back.click();
    await expect(page.getByLabel('Search foods')).toHaveValue('rice');
    await page.locator('#savedFoodsModal .food-library-result').click();
    await page.getByLabel('Amount (piece)', { exact: true }).fill('2.5');
    await expect(page.locator('#savedFoodDetailModal .food-edit-ring')).toHaveText('50kcal');
    await expect(page.getByText('12.5 g total', { exact: true })).toBeVisible();
    await page.getByLabel('Amount unit', { exact: true }).selectOption('g');
    await expect(page.getByLabel('Amount (g)', { exact: true })).toHaveValue('12.5');
    await expect(page.locator('#savedFoodDetailModal .food-edit-ring')).toHaveText('50kcal');
    await page.getByLabel('Amount unit', { exact: true }).selectOption('pcs');
    await expect(page.getByLabel('Amount (piece)', { exact: true })).toHaveValue('2.5');
    await page.screenshot({ path: test.info().outputPath('saved-food-piece-mobile.png') });
    await page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Add to selection', exact: true }).click();
        await page.getByRole('button', { name: 'Review selected foods', exact: true }).click();
        await page.getByRole('button', { name: 'Log selected foods', exact: true }).click();
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!)[0])).toMatchObject({ amount: 12.5, unit: 'g', kcal: 50, prot: 1 });
});

test('US fluid ounce prefills volume and requires an explicit weight when switching to grams', async ({ page }) => {
    await prepare(page);
    await page.goto('/food');
    await open(page, 'create-food');
    await chooseCreation(page, 'food');
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
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!).changes.filter((item: { kind: string; food?: unknown }) => item.kind === 'definition' && item.food).at(-1).food)).toMatchObject({ defaultUnit: 'g', kcalPer100: 31.25, portion: { unit: 'fl_oz', amount: 32 } });
});

test('account library retry survives reload; guest, A and B libraries remain isolated', async ({ page }) => {
    test.skip(!isolated, 'Controlled Auth/Supabase transport fixture only.');
    await prepare(page);
    await page.goto('/dash');
    await create(page);
    const guestId = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!).changes.filter((item: { kind: string; food?: unknown }) => item.kind === 'definition' && item.food).at(-1).food.id);
    await closeCustomFoods(page);
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
    await page.evaluate(() => sessionStorage.setItem('fixture-library-write-fails', '1'));
    await create(page);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1') || '{}').pending?.length)).toBe(1);
    await page.reload();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1') || '{"changes":[]}').changes.length)).toBe(1);
    await page.evaluate(() => {
        sessionStorage.removeItem('fixture-library-write-fails');
        window.dispatchEvent(new Event('online'));
    });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1') || '{}').pending?.length)).toBe(0);
    expect(await page.evaluate(id => JSON.parse(sessionStorage.getItem(`fixture-library-${id}`) || '[]').length, accountA)).toBe(1);
    await open(page, 'search-food');
    await page.locator('#savedFoodsModal .food-library-result').click();
    await page.getByRole('button', { name: 'Favorite Oats', exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1') || '{}').pending?.length)).toBe(0);
    await page.getByRole('button', { name: 'Back to saved foods' }).click();
    await closeSavedFoods(page);
    await page.evaluate(() => localStorage.removeItem('calsync_food_library_v1'));
    await page.reload();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1') || '{"changes":[]}').changes.length)).toBe(2);
    await page.locator('#extraActionBtn').click();
    await page.locator('[data-action="search-food"]').click();
    await page.locator('#savedFoodsModal').getByRole('button', { name: 'Favorites', exact: true }).click();
    await expect(page.locator('#savedFoodsModal .food-library-result')).toContainText('Oats');
    await closeSavedFoods(page);
    await page.goto('/login?keep_login_page=true');
    await page.locator('#viewLoggedIn').getByRole('button', { name: 'Logout', exact: true }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('healthsync_active_owner'))).toBe('guest');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_food_library_v1')!).changes.filter((item: { kind: string; food?: unknown }) => item.kind === 'definition' && item.food).at(-1).food.id)).toBe(guestId);
    await login('B', accountB);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods') || '[]'))).toEqual([]);
});

test('mobile sheets trap/restore focus, support Escape, overlay and dragging, and reject blank names', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.goto('/dash');
    await open(page, 'create-food');
    await chooseCreation(page, 'food');
    await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
    await page.getByLabel('Name', { exact: true }).fill('   ');
    for (const label of ['Calories (kcal)', 'Protein (g)', 'Carbohydrates (g)', 'Fat (g)'])
        await page.getByLabel(label, { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.locator('#customFoodsModal').getByRole('alert')).toHaveText('Enter a name, all four finite non-negative nutrition values, and a positive portion size.');
    await page.screenshot({ path: test.info().outputPath('custom-food-editor-mobile.png') });
    expect(await page.evaluate(() => localStorage.getItem('calsync_custom_foods'))).toBeNull();
    await page.getByRole('button', { name: 'Save food', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Back to created foods' })).toBeFocused();
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
    await chooseCreation(page, 'food');
    await page.getByLabel('Name', { exact: true }).fill('Private unsaved draft');
    await page.evaluate(() => {
        localStorage.setItem('healthsync_active_owner', 'another-fixture-owner');
        window.dispatchEvent(new Event('storage'));
    });
    await expect(page.getByLabel('Name', { exact: true })).not.toBeVisible();
    await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('calsync_custom_foods'))).toBeNull();
});

async function prepareScanner(page: Page) {
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
}

async function scanCode(page: Page, code: string) {
    await page.waitForFunction(code => {
        const scan = (window as Window & { scanFixture?: (code: string) => void }).scanFixture;
        if (!scan) return false;
        scan(code);
        return true;
    }, code);
}

test('barcode product data stays read-only and its inline Font Awesome star toggles favorites', async ({ page }) => {
    await prepareScanner(page);
    await page.route('https://world.openfoodfacts.org/api/v0/product/123456.json', route => route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { status: 1, product: { product_name: 'Barcode Oats', nutriments: { 'energy-kcal_100g': 380, proteins_100g: 13.2, carbohydrates_100g: 60.1, fat_100g: 7.3 } } },
    }));
    await page.goto('/dash');
    await open(page, 'scan-barcode');
    await expect(page.locator('#barcodeSearchModal .modal-title')).toHaveText('Scan Barcode');
    await expect(page.locator('#barcodeSearchInput')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Search by name' })).toHaveCount(0);
    await scanCode(page, '123456');
    await expect(page.locator('#barcodeSearchModal .modal-title')).toHaveText('Set Amount');
    await expect(page.getByRole('button', { name: 'Edit food details', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
    const star = page.locator('#barcodeSearchPreviewCard .food-preview-name').getByRole('button', { name: 'Favorite food', exact: true });
    await expect(star).toHaveText('');
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await expect(star.locator('i')).toHaveClass('fa-regular fa-star');
    expect(await star.evaluate(el => ({ background: getComputedStyle(el).backgroundColor,
        border: getComputedStyle(el).borderTopWidth, shadow: getComputedStyle(el).boxShadow })))
        .toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px', shadow: 'none' });
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(star.locator('i')).toHaveClass('fa-solid fa-star');
    await star.press(' ');
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await star.press(' ');
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
    await page.locator('#barcodeSearchAmountSection input').fill('250');
    await page.screenshot({ path: test.info().outputPath('barcode-readonly-inline-star.png') });
    await page.getByRole('button', { name: 'Log food', exact: true }).click();
    await expect(page.locator('#barcodeSearchOverlay')).not.toHaveClass(/visible/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!)[0])).toMatchObject({ food: 'Barcode Oats', barcode: '123456', kcal: 950,
        foodSnapshot: { provenance: 'barcode', isBarcode: true, kcalPer100: 380 } });
    await open(page, 'search-food');
    await page.locator('#savedFoodsModal .food-library-result').click();
    await expect(page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Favorite Barcode Oats', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Back to saved foods', exact: true }).click();
    await expect(page.locator('#savedFoodDetailOverlay')).toHaveCount(0);
    await closeSavedFoods(page);
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    await open(page, 'create-food');
    await expect(page.getByRole('button', { name: 'Edit Barcode Oats', exact: true })).toHaveCount(0);
    await page.locator('#customFoodsModal').getByRole('button', { name: 'View Barcode Oats', exact: true }).click();
    await expect(page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
});

test('incomplete scanned products stay read-only while separate manual barcode entries remain editable', async ({ page }) => {
    await prepareScanner(page);
    await page.route('https://world.openfoodfacts.org/api/v0/product/123456.json', route => route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { status: 1, product: { product_name: 'Incomplete product', nutriments: { 'energy-kcal_100g': 20 } } },
    }));
    await page.goto('/food'); await open(page, 'scan-barcode');
    await scanCode(page, '123456');
    await expect(page.getByRole('alert')).toContainText('Scan another product or create a food manually.');
    await expect(page.getByRole('button', { name: 'Edit food details', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Log food', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.locator('#barcodeSearchOverlay')).not.toHaveClass(/visible/);
    await expect(page.locator('#barcodeSearchPreviewCard')).toHaveCount(0);
    await open(page, 'scan-barcode');
    await page.getByRole('button', { name: 'Enter food manually', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Manual barcode food');
    await page.getByLabel('Barcode (optional)', { exact: true }).fill('123456');
    for (const label of ['Calories (kcal)', 'Protein (g)', 'Carbohydrates (g)', 'Fat (g)'])
        await page.getByLabel(label, { exact: true }).fill('10');
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit food details', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Log food', exact: true }).click();
    await expect(page.locator('#barcodeSearchOverlay')).not.toHaveClass(/visible/);
    await open(page, 'create-food');
    await editCreatedFood(page, 'Manual barcode food');
    await expect(page.getByLabel('Name', { exact: true })).toBeEditable();
});

test('search deduplicates latest history, expires recent-only items, scopes favorites and queues a batch until final save', async ({ page }) => {
    await prepare(page);
    await page.goto('/food');
    await page.evaluate(sample => {
        const now = Date.now();
        localStorage.setItem('calsync_custom_foods', JSON.stringify([{ ...sample, id: 'oats' }, { ...sample, id: 'milk', name: 'Milk', defaultUnit: 'ml', kcalPer100: 50 }]));
        const history = (id: string, food: string, catalogFoodId: string | undefined, ts: number) => ({ id, food, catalogFoodId, brand: 'Local Mill', amount: 100, unit: 'g', kcal: 380, prot: 13.2, carb: 60.1, fat: 7.3, ts, date: new Date(ts).toDateString() });
        localStorage.setItem('calsync_v1', JSON.stringify([history('one', 'Oats', 'oats', now - 86400000), history('two', 'Oats', 'oats', now), history('old', 'Expired', undefined, now - 15 * 86400000)]));
        window.dispatchEvent(new Event('storage'));
    }, sample);
    await page.getByRole('button', { name: 'Add food', exact: true }).click();
    await page.locator('[data-action="search-food"]').click();
    await expect(page.locator('#savedFoodsModal .food-library-result')).toHaveCount(2);
    await expect(page.locator('#savedFoodsModal time')).toHaveCount(0);
    await expect(page.locator('#savedFoodsModal .food-library-day')).toHaveText(['Today', 'Saved']);
    await page.getByRole('button', { name: 'Add Oats to selection', exact: true }).click();
    await page.getByRole('button', { name: 'Add Milk to selection', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!).length)).toBe(3);
    await page.getByRole('button', { name: 'Remove Milk from selection' }).click();
    await page.getByRole('button', { name: 'Add Milk to selection', exact: true }).click();
    await page.getByRole('button', { name: 'Review selected foods' }).click();
    const fieldsets = page.locator('#savedFoodsModal .food-review-page');
    await fieldsets.nth(1).getByLabel('Amount (g)', { exact: true }).fill('50');
    await fieldsets.nth(0).getByLabel('Amount (ml)', { exact: true }).fill('200');
    await page.getByRole('button', { name: 'Log selected foods', exact: true }).click();
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!));
    expect(logs).toHaveLength(5); expect(logs.at(-1)).toMatchObject({ food: 'Oats', amount: 50, kcal: 190 });
    expect(logs.at(-2)).toMatchObject({ food: 'Milk', amount: 200, kcal: 100 });
    await open(page, 'search-food');
    await page.getByLabel('Search foods').fill('oats');
    await page.locator('#savedFoodsModal .food-library-result').click();
    await page.getByRole('button', { name: 'Favorite Oats', exact: true }).click();
    await page.getByRole('button', { name: 'Back to saved foods' }).click();
    await page.locator('#savedFoodsModal').getByRole('button', { name: 'Favorites', exact: true }).click();
    await expect(page.locator('#savedFoodsModal .food-library-result')).toHaveCount(1);
    await page.getByLabel('Search foods').fill('milk');
    await expect(page.locator('#savedFoodsModal .food-library-result')).toHaveCount(0);
    await closeSavedFoods(page);
    await page.reload();
    await open(page, 'search-food');
    await page.locator('#savedFoodsModal').getByRole('button', { name: 'Favorites', exact: true }).click();
    await expect(page.locator('#savedFoodsModal .food-library-result')).toContainText('Oats');
});

for (const size of [{ width: 390, height: 844 }, { width: 320, height: 480 }, { width: 844, height: 390 }]) {
    test(`food review snaps, retains independent values and keeps full sheet height at ${size.width}x${size.height}`, async ({ page }) => {
        await prepare(page);
        await page.setViewportSize(size);
        await page.goto('/food');
        const longName = 'Oats with banana and honey and a very long descriptive name';
        const extraName = 'Extra food with another long descriptive name';
        await page.evaluate(({ sample, longName, extraName }) => {
            localStorage.setItem('calsync_custom_foods', JSON.stringify([
                { ...sample, id: 'oats', name: longName },
                { ...sample, id: 'milk', name: 'Milk', defaultUnit: 'ml', kcalPer100: 50 },
                { ...sample, id: 'extra', name: extraName },
            ]));
            window.dispatchEvent(new Event('storage'));
        }, { sample, longName, extraName });
        await open(page, 'search-food');
        const modal = page.locator('#savedFoodsModal');
        const checkHeight = async () => {
            await expect.poll(async () => await modal.evaluate(el => (el as HTMLElement).offsetHeight)).toBeCloseTo(size.height - 12, 0);
        };
        await checkHeight();
        await expect(modal.locator('.food-selection-row')).toHaveText('No food selected.');
        expect((await modal.locator('.food-selection-row').boundingBox())!.height).toBeCloseTo(40, 2);
        await modal.locator('.food-library-result').filter({ hasText: longName }).click();
        await checkHeight();
        await page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Edit', exact: true }).click();
        await expect(page.getByLabel('Name', { exact: true })).toHaveValue(longName);
        expect((await page.locator('#editFoodModal').boundingBox())!.height).toBeCloseTo(size.height - 12, 0);
        await page.getByRole('button', { name: 'Back to food details' }).click();
        await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
        await checkHeight();
        await page.getByRole('button', { name: 'Back to saved foods' }).click();
        for (const name of [extraName, 'Milk', longName]) {
            await page.getByRole('button', { name: `Add ${name} to selection`, exact: true }).click();
        }
        const strip = modal.locator('.food-selection-chips');
        const arrow = modal.getByRole('button', { name: 'Review selected foods', exact: true });
        await expect(arrow).toHaveText('');
        await expect(arrow.locator('i.fa-solid.fa-arrow-right')).toHaveCount(1);
        const row = await modal.locator('.food-selection-row').boundingBox();
        const before = (await arrow.boundingBox())!;
        expect(before.y).toBeGreaterThanOrEqual(row!.y);
        expect(before.y + before.height).toBeLessThanOrEqual(row!.y + row!.height + 1);
        expect(await strip.evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).flexWrap === 'nowrap')).toBe(true);
        const title = strip.locator('.quick-btn>span').first();
        expect(await title.evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === 'ellipsis')).toBe(true);
        await strip.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        expect((await arrow.boundingBox())!.x).toBe(before.x);
        await arrow.click();
        await checkHeight();
        const viewport = modal.getByRole('region', { name: 'Selected foods to review', exact: true });
        const cards = modal.locator('.food-review-page');
        await expect(cards).toHaveCount(3);
        expect(await viewport.evaluate(el => getComputedStyle(el).scrollSnapType)).toBe('y mandatory');
        const goTo = async (index: number) => {
            await viewport.evaluate((el, index) => el.scrollTo({ top: index * el.clientHeight, behavior: 'instant' }), index);
            await expect.poll(() => viewport.evaluate(el => Math.round(el.scrollTop / el.clientHeight))).toBe(index);
            const bounds = (await viewport.boundingBox())!;
            const current = (await cards.nth(index).boundingBox())!;
            expect(Math.abs(current.y - bounds.y)).toBeLessThan(2);
            expect(Math.abs(current.height - bounds.height)).toBeLessThan(2);
        };
        await goTo(0);
        await cards.nth(0).getByLabel('Amount (g)', { exact: true }).fill('50');
        await cards.nth(0).getByLabel('Amount unit', { exact: true }).selectOption('oz');
        await cards.nth(0).getByRole('button', { name: `Favorite ${longName}`, exact: true }).click();
        await expect(cards.nth(0).locator('.saved-food-macro.calories')).toContainText('190 kcal');
        await viewport.hover({ position: { x: 2, y: await viewport.evaluate(el => el.clientHeight / 2) } });
        await page.mouse.wheel(0, await viewport.evaluate(el => el.clientHeight));
        await expect.poll(() => viewport.evaluate(el => Math.round(el.scrollTop / el.clientHeight))).toBe(1);
        await goTo(1);
        await expect(cards.nth(1).getByRole('button', { name: 'Favorite Milk', exact: true })).toHaveAttribute('aria-pressed', 'false');
        await cards.nth(1).getByLabel('Amount (ml)', { exact: true }).fill('200');
        await expect(cards.nth(1).locator('.saved-food-macro.calories')).toContainText('100 kcal');
        await goTo(2);
        const remove = cards.nth(2).getByRole('button', { name: `Remove ${extraName}`, exact: true });
        await remove.scrollIntoViewIfNeeded();
        await expect(remove).toBeInViewport();
        const card = cards.nth(2).locator('.food-review-card');
        if (size.height < 600) expect(await card.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
        await remove.click();
        await expect(cards).toHaveCount(2);
        await goTo(0);
        await expect(cards.nth(0).getByRole('button', { name: `Favorite ${longName}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
        await cards.nth(0).getByLabel('Amount unit', { exact: true }).selectOption('g');
        expect(Number(await cards.nth(0).getByLabel('Amount (g)', { exact: true }).inputValue())).toBeCloseTo(50);
        await goTo(1);
        await expect(cards.nth(1).getByLabel('Amount (ml)', { exact: true })).toHaveValue('200');
        await checkHeight();
        await page.screenshot({ path: test.info().outputPath('food-review.png') });
        await expect(modal.getByRole('button', { name: 'Log selected foods', exact: true })).toBeInViewport();
        await page.setViewportSize({ width: size.height, height: size.width });
        await expect.poll(async () => (await modal.boundingBox())!.height).toBeCloseTo(size.width - 12, 0);
        await page.setViewportSize(size);
        await checkHeight();
        await page.getByRole('button', { name: 'Back to saved foods' }).click();
        await checkHeight();
        await closeSavedFoods(page);
        await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
        await open(page, 'search-food');
        await arrow.click();
        await goTo(0);
        await expect(cards.nth(0).getByLabel('Amount (g)', { exact: true })).toHaveValue('50');
        await goTo(1);
        await expect(cards.nth(1).getByLabel('Amount (ml)', { exact: true })).toHaveValue('200');
        expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
        await modal.getByRole('button', { name: 'Log selected foods', exact: true }).click();
        await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
        const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!));
        expect(logs).toHaveLength(2);
        expect(logs[0]).toMatchObject({ food: longName, amount: 50, kcal: 190 });
        expect(logs[1]).toMatchObject({ food: 'Milk', amount: 200, kcal: 100 });
        await open(page, 'create-food');
        const created = page.locator('#customFoodsModal');
        await expect.poll(async () => (await created.boundingBox())!.height).toBeCloseTo(size.height - 12, 0);
        await chooseCreation(page, 'food');
        await expect.poll(async () => (await created.boundingBox())!.height).toBeCloseTo(size.height - 12, 0);
        await page.getByRole('button', { name: 'Back to created foods' }).click();
        await expect.poll(async () => (await created.boundingBox())!.height).toBeCloseTo(size.height - 12, 0);
    });
}

test('existing food editing overlays unchanged details, previews nutrition and restores state on cancel/save', async ({ page }) => {
    await prepare(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/food');
    await page.evaluate(sample => {
        localStorage.setItem('calsync_custom_foods', JSON.stringify([{ ...sample, id: 'oats' }]));
        window.dispatchEvent(new Event('storage'));
    }, sample);
    await open(page, 'search-food');
    const main = page.locator('#savedFoodsModal');
    const empty = main.locator('.food-selection-row');
    await expect(empty).toHaveText('No food selected.');
    expect((await empty.boundingBox())!.height).toBeCloseTo(40, 2);
    expect(await empty.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('dashed');
    const add = main.getByRole('button', { name: 'Add Oats to selection', exact: true });
    expect(await add.evaluate(el => ({ width: el.getBoundingClientRect().width,
        symbol: el.querySelector('.food-library-add-symbol')!.getBoundingClientRect().width,
        border: getComputedStyle(el, '::before').content }))).toEqual({ width: 44, symbol: 30, border: 'none' });
    await add.click();
    const queueBefore = await page.evaluate(() => localStorage.getItem('calsync_food_selection_v1'));
    await page.getByLabel('Search foods').fill('oat');
    await main.locator('.food-library-result').click();
    await page.locator('#savedFoodDetailModal').getByLabel('Amount (g)', { exact: true }).fill('125');
    const editButton = page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Edit', exact: true });
    await editButton.scrollIntoViewIfNeeded();
    await editButton.focus();
    const detailNode = await page.locator('#savedFoodDetailModal .saved-food-detail').elementHandle();
    const mainState = () => page.locator('#savedFoodDetailModal').evaluate(el => ({ text: el.textContent, amount: el.querySelector('input')?.value,
        unit: el.querySelector('select')?.value, scroll: el.querySelector('.modal-body')!.scrollTop, height: (el as HTMLElement).offsetHeight }));
    const stateBefore = await mainState();
    await editButton.click();
    const edit = page.locator('#editFoodModal');
    await expect(edit).toBeVisible();
    await expect(page.locator('#savedFoodsOverlay')).toHaveAttribute('inert', '');
    expect(await mainState()).toEqual(stateBefore);
    expect(await detailNode!.evaluate(el => el.isConnected)).toBe(true);
    await expect(main.locator('.food-edit-facts')).toHaveCount(0);
    await expect(edit.locator('svg')).toHaveCount(0);
    await expect(edit.locator('.food-edit-macro dt')).toHaveText(['Fat', 'Carbs', 'Protein']);
    await expect(edit.locator('.food-edit-ring')).toHaveText('380kcal');
    await expect(edit.locator('.food-edit-macros')).not.toContainText('%');
    expect(await edit.locator('.food-edit-ring').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('conic-gradient');
    expect(await edit.locator('.food-edit-ring').evaluate(el => el.getBoundingClientRect().x)).toBeGreaterThan((await edit.locator('.food-edit-macros').boundingBox())!.x);
    await edit.getByLabel('Preview amount', { exact: true }).fill('50');
    await expect(edit.locator('.food-edit-ring')).toHaveText('190kcal');
    await edit.getByRole('button', { name: 'Increase preview portion' }).click();
    await expect(edit.getByLabel('Preview amount', { exact: true })).toHaveValue('51');
    await edit.getByRole('button', { name: 'Decrease preview portion' }).click();
    await edit.getByLabel('Preview amount unit', { exact: true }).selectOption('oz');
    await expect(edit.locator('.food-edit-ring')).toHaveText('190kcal');
    await edit.locator('.food-edit-ring').screenshot({ path: test.info().outputPath('calorie-ring.png') });
    await page.screenshot({ path: test.info().outputPath('food-edit-nutrition.png') });
    await edit.getByLabel('Name', { exact: true }).fill('Unsaved change');
    await observeClosingParents(page, 'editFoodOverlay', ['savedFoodDetailOverlay', 'savedFoodsOverlay']);
    await page.keyboard.press('Escape');
    await expect(page.locator('#savedFoodDetailOverlay')).toHaveAttribute('data-close-probe', JSON.stringify({
        childConnected: true, parents: [{ scaled: false, inert: true }, { scaled: true, inert: true }],
    }));
    await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
    await expect(editButton).toBeFocused();
    await expect(page.locator('body')).toHaveClass(/modal-open/);
    expect(await mainState()).toEqual(stateBefore);
    expect(await detailNode!.evaluate(el => el.isConnected)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('calsync_food_selection_v1'))).toBe(queueBefore);
    await editButton.click();
    await edit.getByLabel('Name', { exact: true }).fill('Updated oats');
    await edit.getByLabel('Calories (kcal)', { exact: true }).fill('400');
    await expect(edit.locator('.food-edit-ring')).toHaveText('400kcal');
    await edit.getByRole('button', { name: 'Save food', exact: true }).click();
    await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
    await expect(page.locator('body')).toHaveClass(/modal-open/);
    expect(await mainState()).toEqual(stateBefore);
    expect(await detailNode!.evaluate(el => el.isConnected)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('calsync_food_selection_v1'))).toBe(queueBefore);
    await expect(page.locator('#savedFoodDetailModal').getByLabel('Amount (g)', { exact: true })).toHaveValue('125');
    await page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Back to saved foods' }).click();
    await expect(page.getByLabel('Search foods')).toHaveValue('oat');
    await expect(main.locator('.food-library-result')).toContainText('Updated oats');
    await main.getByRole('button', { name: 'Review selected foods' }).click();
    await main.getByRole('button', { name: 'Log selected foods' }).click();
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ food: 'Oats', amount: 100, kcal: 380 });
});

test('recipe editing uses a separate sheet with calculated ingredient rows and preserves the active food', async ({ page }) => {
    await prepare(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/food');
    await create(page);
    await chooseCreation(page, 'recipe');
    await page.getByLabel('Recipe name').fill('Porridge');
    await page.getByRole('button', { name: 'Add ingredient', exact: true }).click();
    await page.getByLabel('Ingredient 1 amount').fill('100');
    await page.getByLabel('Final yield').fill('2');
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click();
    await closeCustomFoods(page);
    await expect(page.locator('#customFoodsOverlay')).toHaveCount(0);
    await open(page, 'search-food');
    const main = page.locator('#savedFoodsModal');
    await main.locator('.food-library-result').filter({ hasText: 'Porridge' }).click();
    await page.locator('#savedFoodDetailModal').getByLabel('Amount (serving)', { exact: true }).fill('1.5');
    await page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.locator('#editFoodModal');
    await expect(edit.locator('.food-edit-ring')).toHaveText('190kcal');
    const recipeStar = edit.getByRole('button', { name: 'Favorite Porridge', exact: true });
    await expect(recipeStar).toHaveAttribute('aria-pressed', 'false');
    await recipeStar.click(); await expect(recipeStar).toHaveAttribute('aria-pressed', 'true');
    const ingredient = edit.locator('.food-edit-ingredient');
    await expect(ingredient.locator('.food-edit-ingredient-copy')).toHaveText('Oats100 g');
    await ingredient.locator('summary').click();
    await expect(ingredient.locator('p')).toContainText('380 kcal');
    await edit.getByLabel('Preview amount', { exact: true }).fill('1.5');
    await expect(edit.locator('.food-edit-ring')).toHaveText('285kcal');
    await edit.getByLabel('Ingredient 1 amount').fill('50');
    await expect(edit.locator('.food-edit-ring')).toHaveText('143kcal');
    await expect(ingredient.locator('.food-edit-ingredient-copy')).toHaveText('Oats50 g');
    await edit.getByRole('button', { name: 'Save recipe', exact: true }).click();
    await expect(page.locator('#editFoodOverlay')).toHaveCount(0);
    await expect(page.locator('#savedFoodDetailModal').getByLabel('Amount (serving)', { exact: true })).toHaveValue('1.5');
    await expect(page.locator('#savedFoodDetailModal .food-edit-ring')).toHaveText('285kcal');
    await expect(page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Favorite Porridge', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
});

test.describe('compact library presentation', () => {
    test.use({ timezoneId: 'Europe/Berlin', locale: 'en-GB' });

    test('uses stored local days across DST, preserves Saved/favorites, truncates names and standardizes headers', async ({ page }) => {
        await prepare(page);
        // Shortly after local midnight, while UTC still belongs to the previous day.
        await page.clock.setFixedTime(new Date('2026-10-26T00:30:00+01:00'));
        await page.setViewportSize({ width: 320, height: 844 });
        await page.goto('/food');
        const longName = 'Chicken and Mushroom Pasta with a very long descriptive food name';
        const originalLogs = await page.evaluate(({ sample, longName }) => {
            const foods = [
                { ...sample, id: 'today', name: longName, brand: '  aI dEtEcTiOn  ' },
                { ...sample, id: 'yesterday', name: 'Yesterday oats' },
                { ...sample, id: 'earlier', name: 'Earlier oats' },
                { ...sample, id: 'unused', name: 'Never logged' },
                { ...sample, id: 'old', name: 'Old saved oats' },
            ];
            localStorage.setItem('calsync_custom_foods', JSON.stringify(foods));
            localStorage.setItem('calsync_favourites', JSON.stringify([foods[0]]));
            const history = (id: string, index: number, ts: number, date: string) => ({
                id, catalogFoodId: foods[index].id, food: foods[index].name, brand: foods[index].brand,
                amount: 100, unit: 'g', kcal: 380, prot: 13.2, carb: 60.1, fat: 7.3, ts, date,
            });
            const now = Date.now();
            const logs = [
                history('latest', 0, now, new Date(2026, 9, 26).toDateString()),
                history('duplicate', 0, now - 86400000, new Date(2026, 9, 25).toDateString()),
                // Deliberately different timestamp day: the stored date owns the heading.
                history('yesterday', 1, now - 60000, new Date(2026, 9, 25).toDateString()),
                history('earlier', 2, now - 2 * 86400000, new Date(2026, 9, 24).toDateString()),
                history('old', 4, now - 15 * 86400000, new Date(2026, 9, 11).toDateString()),
                { ...history('expired', 4, now - 15 * 86400000, new Date(2026, 9, 11).toDateString()), catalogFoodId: undefined, food: 'Expired history' },
            ];
            localStorage.setItem('calsync_v1', JSON.stringify(logs));
            window.dispatchEvent(new Event('storage'));
            return logs;
        }, { sample, longName });
        await open(page, 'search-food');
        const modal = page.locator('#savedFoodsModal');
        const earlierDate = await page.evaluate(() => new Date(2026, 9, 24).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
        await expect(modal.locator('.food-library-day')).toHaveText(['Today', 'Yesterday', earlierDate, 'Saved']);
        await expect(modal.getByRole('region', { name: 'Today', exact: true }).locator('.food-library-result')).toHaveCount(1);
        await expect(modal.getByRole('region', { name: 'Yesterday', exact: true })).toContainText('Yesterday oats');
        await expect(modal.getByRole('region', { name: 'Saved', exact: true }).locator('.food-library-result')).toHaveCount(2);
        await expect(modal.locator('.food-library-result')).toHaveCount(5);
        await expect(modal).not.toContainText(/Last used|AI Detection|Expired history/i);
        await expect(modal.locator('svg, time')).toHaveCount(0);
        await expect(page.getByLabel('Search foods')).toHaveAttribute('placeholder', 'Search…');
        await expect(page.getByText('Search foods', { exact: true })).not.toBeInViewport();
        const checkHeader = async (id: string, back = false) => {
            const header = page.locator(`#${id}Modal .modal-header`);
            const close = header.locator('.modal-btn--right > button.back-btn');
            const headerBox = (await header.boundingBox())!;
            await expect(header.locator('svg')).toHaveCount(0);
            if (back) {
                await expect(close).toHaveCount(0);
                const backButton = header.locator('.modal-btn > button.back-btn');
                await expect(backButton.locator('i.fa-solid.fa-arrow-left[aria-hidden="true"]')).toHaveCount(1);
                const backBox = (await backButton.boundingBox())!;
                expect(backBox.x).toBeLessThan(headerBox.x + headerBox.width / 2);
            } else {
                await expect(close.locator('i.fa-solid.fa-xmark[aria-hidden="true"]')).toHaveCount(1);
                const closeBox = (await close.boundingBox())!;
                expect(closeBox.x).toBeGreaterThan(headerBox.x + headerBox.width / 2);
            }
        };
        await checkHeader('savedFoods');
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            const title = modal.locator('.food-library-result strong').filter({ hasText: longName });
            const metrics = await title.evaluate(element => {
                const style = getComputedStyle(element);
                return { nowrap: style.whiteSpace, overflow: style.overflow, ellipsis: style.textOverflow,
                    width: element.clientWidth, content: element.scrollWidth, height: element.getBoundingClientRect().height, lineHeight: parseFloat(style.lineHeight) };
            });
            expect(metrics).toMatchObject({ nowrap: 'nowrap', overflow: 'hidden', ellipsis: 'ellipsis' });
            expect(metrics.content).toBeGreaterThan(metrics.width);
            expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight + 1);
            expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
            await page.screenshot({ path: test.info().outputPath(`saved-foods-${width}.png`) });
        }
        await modal.locator('.food-library-result').filter({ hasText: longName }).click();
        await expect(modal).not.toContainText(/AI Detection/i);
        await checkHeader('savedFoodDetail', true);
        await page.getByRole('button', { name: 'Back to saved foods' }).click();
        await modal.getByRole('button', { name: 'Favorites', exact: true }).click();
        await expect(modal.locator('.food-library-result')).toHaveCount(1);
        await expect(modal.locator('.food-library-day, time, svg')).toHaveCount(0);
        await expect(modal).not.toContainText(/Last used|AI Detection/i);
        await page.getByRole('button', { name: `Add ${longName} to selection`, exact: true }).click();
        await page.getByRole('button', { name: 'Review selected foods', exact: true }).click();
        await checkHeader('savedFoods', true);
        await closeSavedFoods(page);
        await open(page, 'create-food');
        await checkHeader('customFoods');
        await expect(page.locator('#customFoodsModal')).not.toContainText(/AI Detection/i);
        for (const action of ['Create food', 'Create recipe']) {
            await chooseCreation(page, action === 'Create food' ? 'food' : 'recipe');
            await checkHeader('customFoods', true);
            await page.getByRole('button', { name: 'Back to created foods' }).click();
        }
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!))).toEqual(originalLogs);
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_foods')!)[0].brand)).toBe('  aI dEtEcTiOn  ');
    });
});

test('recipes calculate yield, prevent ingredient deletion and preserve logged snapshots after editing', async ({ page }) => {
    await prepare(page);
    await page.goto('/food'); await create(page);
    await chooseCreation(page, 'recipe');
    await page.getByLabel('Recipe name').fill('Porridge');
    await page.getByRole('button', { name: 'Add ingredient', exact: true }).click();
    await page.getByLabel('Ingredient 1 amount').fill('100');
    await page.getByLabel('Final yield').fill('2');
    await expect(page.locator('#customFoodsModal').getByRole('status')).toContainText('190.0 kcal');
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete Oats', exact: true }).click();
    await expect(page.locator('#customFoodsModal').getByRole('alert')).toContainText('used by a recipe');
    await closeCustomFoods(page);
    await open(page, 'search-food'); await page.getByLabel('Search foods').fill('porridge');
    await page.locator('#savedFoodsModal .food-library-result').click();
    await expect(page.getByLabel('Amount (serving)', { exact: true })).toHaveValue('1');
    await page.getByLabel('Amount (serving)', { exact: true }).fill('1.5');
    await page.getByRole('button', { name: 'Add to selection', exact: true }).click();
    await page.getByRole('button', { name: 'Review selected foods', exact: true }).click();
    await page.getByRole('button', { name: 'Log selected foods', exact: true }).click();
    await expect(page.locator('#savedFoodsOverlay')).toHaveCount(0);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!));
    expect(before[0]).toMatchObject({ food: 'Porridge', kcal: 285, amount: 1.5, unit: 'serving' });
    expect(before[0].foodSnapshot.recipeSnapshot.ingredients[0].food.name).toBe('Oats');
    await open(page, 'create-food'); await editCreatedFood(page, 'Oats');
    await page.getByLabel('Calories (kcal)', { exact: true }).fill('100');
    await page.getByRole('button', { name: 'Save food', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!))).toEqual(before);
});

for (const recipe of [false, true]) {
    test(`AI ${recipe ? 'recipe' : 'food'} candidate stays unlogged until editable review is confirmed`, async ({ page }) => {
        await prepare(page, true);
        await page.addInitScript(({ recipe, sample }) => {
            localStorage.setItem('calsync_ai_enabled', 'true');
            localStorage.setItem('calsync_ai_terms_accepted', 'true');
            localStorage.setItem('calsync_ai_api_key', 'fixture-placeholder');
            if (recipe) localStorage.setItem('calsync_custom_foods', JSON.stringify([{ ...sample, id: 'oats' }]));
        }, { recipe, sample });
        await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({
            headers: { 'access-control-allow-origin': '*' },
            json: { candidates: [{ content: { parts: [{ text: JSON.stringify({
                kind: recipe ? 'recipe' : 'food', name: recipe ? 'AI Porridge' : 'AI Oats', brand: '', icon: 'fa-solid fa-bowl-food',
                amount: 100, unit: 'g', calories: 999, protein: 10, carbs: 10, fat: 10,
                ...(recipe ? { recipe: { name: 'AI Porridge', ingredients: [{ name: 'Oats', amount: 50, unit: 'g' }], yield: { amount: 2, unit: 'serving' } } } : {}),
            }) }] } }] },
        }));
        await page.goto('/food');
        await page.locator('#extraActionBtn').click();
        await page.locator('[data-action="describe-food"]').click();
        await page.locator('#aiTextInput').fill(recipe ? 'Create a recipe for oats porridge' : '100 g oats');
        await page.locator('#aiTextSubmitBtn').click();
        if (recipe) {
            await page.getByRole('button', { name: 'Review recipe ingredients' }).click();
            await expect(page.getByLabel('Recipe name')).toHaveValue('AI Porridge');
            await expect(page.getByLabel('Ingredient 1 food')).toHaveValue('oats');
            await page.getByRole('button', { name: 'Save recipe', exact: true }).click();
            await expect(page.locator('#calculatedCalories')).toHaveText('95');
        } else {
            await page.getByRole('button', { name: 'Edit food details' }).click();
            await page.getByLabel('Name', { exact: true }).fill('Corrected oats');
            await page.getByLabel('Calories (kcal)', { exact: true }).fill('380');
            await page.getByRole('button', { name: 'Save food', exact: true }).click();
            await expect(page.locator('#calculatedCalories')).toHaveText('380');
            const header = (await page.locator('#modal .modal-title').boundingBox())!;
            await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2);
            await page.mouse.down();
            await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2 + 8, { steps: 4 });
            await page.mouse.up();
            await expect(page.locator('#appOverlay')).toHaveClass(/visible/);
            await expect.poll(() => page.locator('#modal').evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
        }
        expect(await page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
        await page.locator('#actionBtn').click();
        await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1') || '[]').length)).toBe(1);
        const entry = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_v1')!)[0]);
        expect(entry).toMatchObject(recipe ? { food: 'AI Porridge', kcal: 95, amount: 1, unit: 'serving' } : { food: 'Corrected oats', kcal: 380 });
        expect(entry.catalogFoodId).toBeTruthy();
        expect(entry.foodSnapshot.emoji).toBe('fa-solid fa-bowl-food');
    });
}
