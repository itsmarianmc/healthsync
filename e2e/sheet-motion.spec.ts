import { test, expect, type Page } from '@playwright/test';
import { aiAppFixture } from './fixtures/ai-app';
import { APP_VERSION } from '../src/app/_lib/release';
import { readFileSync } from 'node:fs';

let fixture: Awaited<ReturnType<typeof aiAppFixture>>;
test.beforeAll(async () => { fixture = await aiAppFixture({ includeGlobalOverlays: true }); });
test.use({ serviceWorkers: 'block' });
test.setTimeout(90_000);

async function prepare(page: Page, path = '/dash', thirdparty = false) {
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/exercises.json') return route.fulfill({ contentType: 'application/json', body: readFileSync('public/exercises.json', 'utf8') });
        if (url.pathname === '/api/sync/verify') return route.fulfill({ json: { ok: true } });
        if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'text/javascript', body: fixture.js });
        if (url.pathname === '/fixture.css') return route.fulfill({ contentType: 'text/css', body: fixture.css });
        if (url.pathname === '/changelog.json') return route.fulfill({ json: [{ version: APP_VERSION, date: '2026-11-02', changes: ['Motion test'] }] });
        if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: fixture.html });
        return route.abort();
    });
    await page.addInitScript(({ version, thirdparty }) => {
        localStorage.setItem('calsync_onboarding_done', '1');
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem('healthsync_last_seen_changelog_version_guest', version);
        localStorage.setItem('cookieSettings', JSON.stringify({ preferences: true, analytics: false, thirdparty }));
        localStorage.setItem('calsync_track_supplements', 'true');
        localStorage.setItem('calsync_ai_enabled', 'true');
        localStorage.setItem('calsync_ai_terms_accepted', 'true');
        localStorage.setItem('calsync_ai_api_key', 'fixture-placeholder');
    }, { version: APP_VERSION, thirdparty });
    await page.goto(path);
}

async function recordMotion(page: Page, selector: string) {
    await page.evaluate(selector => {
        delete (window as unknown as { sheetSamples?: unknown }).sheetSamples;
        const samples: { y: number; h: number; time: number }[] = [];
        const start = performance.now();
        const sample = () => {
            const element = document.querySelector<HTMLElement>(selector);
            if (element?.closest('.visible')) {
                const style = getComputedStyle(element);
                samples.push({ y: new DOMMatrix(style.transform).m42, h: element.offsetHeight, time: performance.now() - start });
            }
            if (performance.now() - start < 1100) requestAnimationFrame(sample);
            else (window as unknown as { sheetSamples: typeof samples }).sheetSamples = samples;
        };
        requestAnimationFrame(sample);
    }, selector);
}

async function assertMotion(page: Page) {
    await expect.poll(() => page.evaluate(() => (window as unknown as { sheetSamples?: unknown }).sheetSamples)).toBeTruthy();
    const samples = await page.evaluate(() => (window as unknown as { sheetSamples: { y: number; h: number; time: number }[] }).sheetSamples);
    const positive = samples.filter(sample => sample.y > 2 && sample.y < sample.h - 2);
    expect(samples[0].y).toBeGreaterThan(samples[0].h * .5);
    expect(new Set(positive.map(s => Math.round(s.y))).size).toBeGreaterThan(4);
    expect(Math.abs(samples.at(-1)!.y)).toBeLessThan(1);
}

async function enter(page: Page, selector: string, action: () => Promise<unknown>) {
    await recordMotion(page, selector);
    await action();
    await assertMotion(page);
    await expect(page.locator(selector)).toBeInViewport();
    await test.info().attach(`motion-${selector.replace(/\W/g, '')}`, {
        body: JSON.stringify(await page.evaluate(() => (window as unknown as { sheetSamples: unknown }).sheetSamples)), contentType: 'application/json',
    });
}

async function dismiss(page: Page, selector: string) {
    await page.evaluate(selector => {
        const samples: number[] = [];
        const probe = window as unknown as { sheetExit?: number[] };
        delete probe.sheetExit;
        const sample = () => {
            const element = document.querySelector<HTMLElement>(selector);
            const phase = element?.closest('[data-sheet-phase]')?.getAttribute('data-sheet-phase');
            if (!element || phase === 'closed') { probe.sheetExit = samples; return; }
            samples.push(new DOMMatrix(getComputedStyle(element).transform).m42);
            requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
    }, selector);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.locator(selector).evaluateAll(nodes => nodes.every(node => {
        const overlay = node.closest('[data-sheet-phase]');
        return !overlay || overlay.getAttribute('data-sheet-phase') === 'closed';
    }))).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as unknown as { sheetExit?: number[] }).sheetExit)).toBeTruthy();
    if (!await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        const positions = await page.evaluate(() => (window as unknown as { sheetExit: number[] }).sheetExit);
        expect(new Set(positions.filter(y => y > 2).map(Math.round)).size).toBeGreaterThan(3);
    }
}

async function extra(page: Page, action: string) {
    await page.locator('#extraActionToggle').click();
    await page.locator(`[data-action="${action}"]`).click();
}

test('Update Center first open and reopen move through intermediate positions', async ({ page }) => {
    await prepare(page);
    for (let attempt = 0; attempt < 2; attempt++) {
        await recordMotion(page, '#whatsNewModal');
        await page.locator('#db-openUpdateCenterBtn').click();
        await assertMotion(page);
        await page.keyboard.press('Escape');
        await expect(page.locator('.whats-new-overlay')).not.toHaveClass(/visible/);
        await expect(page.locator('body')).not.toHaveClass(/modal-open/);
    }
});

test('all food library sheets animate, while review navigation keeps the same entrance', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('calsync_custom_foods', JSON.stringify([{ id: 'motion-oats', name: 'Motion oats', brand: '', kcalPer100: 380, protPer100: 10, carbPer100: 50, fatPer100: 5, defaultUnit: 'g' }])));
    await prepare(page, '/food');
    await enter(page, '#customFoodsModal', () => extra(page, 'create-food'));
    for (const kind of ['Food', 'Recipe']) {
        await enter(page, '#foodCreateChoiceModal', () => page.getByRole('button', { name: 'Create food', exact: true }).click());
        await enter(page, '#createFoodModal', () => page.locator('#foodCreateChoiceModal').getByRole('button', { name: kind, exact: true }).click());
        await expect(page.getByLabel(kind === 'Food' ? 'Name' : 'Recipe name', { exact: true })).toBeFocused();
        await dismiss(page, '#createFoodModal');
    }
    await enter(page, '#savedFoodDetailModal', () => page.getByRole('button', { name: 'View Motion oats', exact: true }).click());
    await enter(page, '#editFoodModal', () => page.locator('#savedFoodDetailModal').getByRole('button', { name: 'Edit', exact: true }).click());
    await dismiss(page, '#editFoodModal'); await dismiss(page, '#savedFoodDetailModal'); await dismiss(page, '#customFoodsModal');
    await enter(page, '#savedFoodsModal', () => extra(page, 'search-food'));
    await page.getByRole('button', { name: 'Add Motion oats to selection', exact: true }).click();
    await page.getByRole('button', { name: /Review.*selected/ }).click();
    await expect(page.locator('#savedFoodsOverlay')).toHaveAttribute('data-sheet-phase', 'open');
    await enter(page, '#foodDateTimeModal', () => page.locator('.food-batch-date').click());
    await dismiss(page, '#foodDateTimeModal'); await dismiss(page, '#savedFoodsModal');
    await enter(page, '#savedFoodsModal', () => extra(page, 'search-food'));
});

test('AI method, description and committed result animate without replay on internal review', async ({ page }) => {
    await prepare(page, '/food', true);
    let release: () => void = () => {};
    const response = new Promise<void>(resolve => { release = resolve; });
    await page.route('https://generativelanguage.googleapis.com/**', async route => {
        await response;
        return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { candidates: [{ content: { parts: [{ text: JSON.stringify({ name: 'Motion meal', amount: 100, unit: 'g', calories: 300, protein: 10, carbs: 30, fat: 5 }) }] } }] } });
    });
    await enter(page, '#aiMethodModal', () => page.locator('#cs-openAiBtn').click());
    await enter(page, '#aiTextModal', () => page.locator('#aiMethodDescribeText').click());
    await page.locator('#aiTextInput').fill('100 g oats');
    await page.locator('#aiTextSubmitBtn').click();
    await expect(page.locator('#aiTextOverlay')).toHaveAttribute('data-sheet-phase', 'closed');
    // Analysis/results must reuse the outer sheet that already entered behind the input child.
    const node = await page.locator('#modal').elementHandle();
    release();
    await expect(page.getByRole('button', { name: 'Edit food details' })).toBeVisible();
    expect(await node!.evaluate(el => el.isConnected)).toBe(true);
    await expect(page.locator('#appOverlay')).toHaveAttribute('data-sheet-phase', 'open');
    await dismiss(page, '#modal');
    await enter(page, '#modal', () => page.locator('.pending-draft-item, .pending-item').first().click());
});

for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 480 }]) {
    test(`shared entrance survives delayed content, viewport changes and interruption at ${size.width}x${size.height}`, async ({ page }) => {
        await page.addInitScript(theme => localStorage.setItem('calsync_theme', theme), size.width < 500 ? 'light' : 'dark');
        await page.setViewportSize(size);
        await prepare(page);
        await enter(page, '#whatsNewModal', () => page.locator('#db-openUpdateCenterBtn').click());
        await page.locator('#whatsNewModal').evaluate(el => { const paragraph = document.createElement('p'); paragraph.textContent = 'Delayed content '.repeat(300); el.querySelector('.modal-body')!.append(paragraph); });
        await expect(page.locator('.whats-new-overlay')).toHaveAttribute('data-sheet-phase', 'open');
        await page.setViewportSize({ width: size.height, height: size.width });
        await expect(page.locator('#whatsNewModal .modal-header')).toBeInViewport();
        await dismiss(page, '#whatsNewModal');
        // Reopening during exit must invalidate the old close callback and retain the page lock.
        await page.locator('#db-openUpdateCenterBtn').click();
        await expect(page.locator('.whats-new-overlay')).toHaveAttribute('data-sheet-phase', 'opening');
        await page.keyboard.press('Escape');
        await page.locator('#db-openUpdateCenterBtn').evaluate((button: HTMLButtonElement) => button.click());
        await expect(page.locator('.whats-new-overlay')).toHaveAttribute('data-sheet-phase', 'open');
        await expect(page.locator('body')).toHaveClass(/modal-open/);
        await dismiss(page, '#whatsNewModal');
    });
}

test('reduced motion completes the same lifecycle with compact and expanded settings', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await prepare(page);
    await page.evaluate(() => localStorage.setItem('healthsync_modals_expanded', 'true'));
    await page.locator('#db-openUpdateCenterBtn').click();
    await expect(page.locator('.whats-new-overlay')).toHaveAttribute('data-sheet-phase', 'open');
    expect(await page.locator('#whatsNewModal').evaluate(el => el.getAnimations().length)).toBe(0);
    await dismiss(page, '#whatsNewModal');
    await extra(page, 'create-food');
    await page.getByRole('button', { name: 'Create food', exact: true }).click();
    await expect(page.locator('#foodCreateChoiceOverlay')).toHaveAttribute('data-sheet-phase', 'open');
    expect((await page.locator('#foodCreateChoiceModal').boundingBox())!.height).toBeLessThan(400);
    await dismiss(page, '#foodCreateChoiceModal');
    await dismiss(page, '#customFoodsModal');
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});

test('barcode camera entrance and delayed confirmation retain one sizing lifecycle', async ({ page }) => {
    await page.addInitScript(() => {
        const scanner = window as Window & { scanFixture?: (code: string) => void; ZXingBrowser?: unknown };
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4;
            return canvas.captureStream(1);
        } });
        scanner.ZXingBrowser = { BrowserMultiFormatReader: class {
            decodeFromStream(_stream: unknown, _video: unknown, callback: (result: { getText: () => string }) => void) { scanner.scanFixture = code => callback({ getText: () => code }); }
            stop() { scanner.scanFixture = undefined; }
            reset() { scanner.scanFixture = undefined; }
        } };
    });
    await prepare(page, '/food', true);
    let release: () => void = () => {};
    const response = new Promise<void>(resolve => { release = resolve; });
    await page.route('https://world.openfoodfacts.org/api/v0/product/123456.json', async route => {
        await response;
        await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { status: 1, product: { product_name: 'Long product name '.repeat(12), quantity: '500 g', serving_size: '2 pieces (30 g)', serving_quantity: 30, nutriments: { 'energy-kcal_100g': 400, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 8 } } } });
    });
    await enter(page, '#barcodeSearchModal', () => extra(page, 'scan-barcode'));
    const node = await page.locator('#barcodeSearchModal').elementHandle();
    await page.waitForFunction(() => { const scan = (window as Window & { scanFixture?: (code: string) => void }).scanFixture; if (!scan) return false; scan('123456'); return true; });
    release();
    await expect(page.locator('#barcodeSearchModal .modal-title')).toHaveText('Set Amount');
    await expect(page.locator('#barcodeSearchOverlay')).toHaveAttribute('data-sheet-phase', 'open');
    expect(await node!.evaluate(el => el.isConnected)).toBe(true);
    await expect(page.getByRole('button', { name: 'Log food', exact: true })).toBeInViewport();
    await dismiss(page, '#barcodeSearchModal');
    await enter(page, '#barcodeSearchModal', () => extra(page, 'scan-barcode'));
});

test('intentional centered consent/link dialogs and anchored tour retain their distinct presentation', async ({ page }) => {
    await prepare(page, '/legal/terms');
    await page.locator('a[href="https://ai.google.dev/gemini-api/terms"]').click();
    await expect(page.getByRole('dialog', { name: 'You are about to leave itsmarian.dev' })).toBeVisible();
    await page.getByRole('button', { name: 'Go Back', exact: true }).click();
    await expect(page.locator('#linkout-overlay')).toHaveCount(0);
    await page.addInitScript(() => localStorage.removeItem('bannerAccepted'));
    await page.reload();
    await page.getByRole('button', { name: 'Change settings', exact: true }).click();
    await expect(page.locator('.settings-panel.active')).toBeVisible();
    await page.locator('.settings-panel .close-btn').click();
    await expect(page.locator('.settings-panel')).toHaveCount(0);
    await page.addInitScript(() => { localStorage.setItem('bannerAccepted', 'true'); localStorage.removeItem('calsync_pending_tour'); });
    await page.goto('/dash');
    await page.waitForFunction(() => typeof (window as Window & { showToolTip?: unknown }).showToolTip === 'function');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('__showTooltip', { detail: { elementId: 'bottomNav', message: 'The bottom navigation bar', progress: '1/8', buttonText: 'Next' } })));
    await expect(page.getByRole('tooltip')).toBeVisible();
    await expect(page.getByRole('tooltip')).toContainText('bottom navigation bar');
    await page.locator('.hs-tooltip-overlay').click({ position: { x: 4, y: 4 } });
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.goto('/onboarding');
    await expect(page.locator('#onboardingOverlay')).toBeVisible();
    await page.locator('#onboardingNext').click();
    await expect(page.locator('.onboarding-slide[aria-hidden="false"]')).toContainText('Additional');
});

test('dormant standalone scanner branch uses shared motion in a component harness', async ({ page }) => {
    await prepare(page, '/fixture/scanner');
    for (let i = 0; i < 2; i++) {
        await enter(page, '#cameraModal', () => page.locator('#fixture-open-scanner').click());
        await dismiss(page, '#cameraModal');
        await expect(page.locator('body')).not.toHaveClass(/modal-open/);
    }
});

test('React effect replay and route unmount cancel obsolete sheet completion', async ({ page }) => {
    const strictFixture = await aiAppFixture({ strict: true });
    await prepare(page);
    await page.route('**/fixture.js', route => route.fulfill({ contentType: 'text/javascript', body: strictFixture.js }));
    await page.reload();
    await enter(page, '#whatsNewModal', () => page.locator('#db-openUpdateCenterBtn').click());
    await dismiss(page, '#whatsNewModal');
    await page.locator('#db-openSettingsBtn').click();
    await expect(page.locator('#settingsOverlay')).toHaveAttribute('data-sheet-phase', 'opening');
    await page.evaluate(() => { history.pushState({}, '', '/legal/terms'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await expect(page.locator('#settingsOverlay')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});

test('centered cookie preferences cover Settings and retain its scroll lock until the final exit', async ({ page }) => {
    await prepare(page);
    await page.locator('#db-openSettingsBtn').click();
    await expect(page.locator('#settingsOverlay')).toHaveAttribute('data-sheet-phase', 'open');
    await page.locator('#settingsModal .change-settings').click();
    await expect(page.getByRole('dialog', { name: 'Cookie settings' })).toBeVisible();
    await expect(page.locator('#settingsOverlay')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Cookie settings' })).toHaveCount(0);
    await expect(page.locator('#settingsOverlay')).toHaveAttribute('data-sheet-phase', 'open');
    await expect(page.locator('body')).toHaveClass(/modal-open/);
    await dismiss(page, '#settingsModal');
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});

test('an exiting sheet retains focus containment until animation completion', async ({ page }) => {
    await prepare(page);
    await page.locator('#db-openSettingsBtn').click();
    await expect(page.locator('#settingsOverlay')).toHaveAttribute('data-sheet-phase', 'open');
    await page.keyboard.press('Escape');
    await expect(page.locator('#settingsOverlay')).toHaveAttribute('data-sheet-phase', 'closing');
    await page.keyboard.press('Tab');
    expect(await page.locator('#settingsModal').evaluate(el => el.contains(document.activeElement))).toBe(true);
    await expect(page.locator('body')).toHaveClass(/modal-open/);
    await expect(page.locator('#settingsOverlay')).toHaveAttribute('data-sheet-phase', 'closed');
    await expect(page.locator('#db-openSettingsBtn')).toBeFocused();
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});

test('closing during entrance leaves the Update Center entry point available', async ({ page }) => {
    await prepare(page);
    for (let i = 0; i < 3; i++) {
        await page.locator('#db-openUpdateCenterBtn').click();
        await expect(page.locator('.whats-new-overlay')).toHaveAttribute('data-sheet-phase', 'opening');
        await page.keyboard.press('Escape');
        await expect(page.locator('.whats-new-overlay')).toHaveAttribute('data-sheet-phase', 'closed');
        await expect(page.locator('#db-openUpdateCenterBtn')).toBeVisible();
    }
});

test('settings and every nested settings sheet animate from their real entry points', async ({ page }) => {
    await prepare(page);
    await enter(page, '#settingsModal', () => page.locator('#db-openSettingsBtn').click());
    for (const [selector, trigger] of [
        ['#goalModal', '#openSetGoalBtn'], ['#goalModal', '#openCalcGoalBtn'],
        ['#reportBugModal', '#openReportBugBtn'], ['#notesModal', '#openNotes'],
    ]) {
        await enter(page, selector, () => page.locator(trigger).click());
        await expect(page.locator('#settingsOverlay')).toHaveAttribute('inert', '');
        await dismiss(page, selector);
        await expect(page.locator('#settingsOverlay')).not.toHaveAttribute('inert', '');
    }
    await enter(page, '#customSupplementsModal', () => page.locator('#manageCustomSupplementsBtn').click());
    for (let i = 0; i < 2; i++) {
        await enter(page, '#customSupplementEditorModal', () => page.locator('#addCustomSupplementBtn').click());
        await expect(page.locator('#customSupplementsOverlay')).toHaveAttribute('inert', '');
        await dismiss(page, '#customSupplementEditorModal');
    }
    await enter(page, '#customSupplementEditorModal', () => page.locator('#addCustomSupplementBtn').click());
    await page.locator('#customSupplementName').fill('Motion supplement');
    await page.getByRole('button', { name: 'Monday', exact: true }).click();
    await page.locator('#saveCustomSupplementBtn').click();
    await expect(page.locator('#customSupplementEditorOverlay')).toHaveCount(0);
    await enter(page, '#customSupplementEditorModal', () => page.getByRole('button', { name: /^Edit Motion supplement/ }).click());
    await dismiss(page, '#customSupplementEditorModal');
    await dismiss(page, '#customSupplementsModal');
    await dismiss(page, '#settingsModal');
    await enter(page, '#settingsModal', () => page.locator('#db-openSettingsBtn').click());
});

test('Settings scales smoothly behind the report sheet on open and return', async ({ page }) => {
    await prepare(page);
    await page.route('https://itsmarian.dev/report?**', route => route.fulfill({ contentType: 'text/html', body: '<p>Report form</p>' }));
    await enter(page, '#settingsModal', () => page.locator('#db-openSettingsBtn').click());
    for (let attempt = 0; attempt < 2; attempt++) {
        for (const opening of [true, false]) {
            await page.evaluate(() => {
                const samples: number[] = [];
                const start = performance.now();
                delete (window as unknown as { parentScales?: number[] }).parentScales;
                const sample = () => {
                    samples.push(parseFloat(getComputedStyle(document.querySelector('#settingsModal')!).scale) || 1);
                    if (performance.now() - start < 900) requestAnimationFrame(sample);
                    else (window as unknown as { parentScales: number[] }).parentScales = samples;
                };
                requestAnimationFrame(sample);
            });
            if (opening) await page.locator('#openReportBugBtn').click();
            else await page.keyboard.press('Escape');
            await expect.poll(() => page.evaluate(() => (window as unknown as { parentScales?: number[] }).parentScales)).toBeTruthy();
            const scales = await page.evaluate(() => (window as unknown as { parentScales: number[] }).parentScales);
            expect(new Set(scales.filter(scale => scale > .921 && scale < .999).map(scale => scale.toFixed(3))).size).toBeGreaterThan(4);
            expect(scales.at(-1)).toBeCloseTo(opening ? .92 : 1, 2);
        }
        await expect(page.locator('#settingsOverlay')).not.toHaveAttribute('inert', '');
        await expect(page.locator('#openReportBugBtn')).toBeFocused();
    }
});

test('account confirmation sheets animate without performing destructive actions', async ({ page }) => {
    await page.addInitScript(() => {
        sessionStorage.setItem('fixture-session', JSON.stringify({ access_token: 'fixture', expires_at: Date.now()/1000 + 3600,
            user: { id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.invalid', user_metadata: {} } }));
    });
    await prepare(page);
    await enter(page, '#settingsModal', () => page.locator('#db-openSettingsBtn').click());
    for (const [selector, trigger] of [['#logoutModal', '#accountLogoutBtn'], ['#deleteAccountModal', '#deleteAccountBtn']]) {
        for (let i = 0; i < 2; i++) {
            await enter(page, selector, () => page.locator(trigger).click());
            await dismiss(page, selector);
        }
    }
});

test('dashboard status, duration and custom dates animate as separate nested sheets', async ({ page }) => {
    await prepare(page);
    await enter(page, '#activityStatusModal', () => page.locator('.activity-status-trigger').click());
    await enter(page, '#activityStatusKeepModal', () => page.locator('.activity-status-keep-row').click());
    await enter(page, '#activityStatusCustomDateModal', () => page.getByRole('button', { name: /Custom/ }).click());
    for (const selector of ['#activityStatusCustomDateModal', '#activityStatusKeepModal', '#activityStatusModal']) await dismiss(page, selector);
});

test('step changes retain outgoing content and animate height in both directions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1100 });
    await prepare(page, '/drinks');
    await enter(page, '#ds-modal', () => page.locator('#ds-openModalBtn').click());
    for (const forward of [true, false]) {
        const samples = await page.evaluate(async forward => {
            const track = document.querySelector<HTMLElement>('#ds-modal .sheet-step-track')!;
            const outgoing = track.children[forward ? 0 : 1] as HTMLElement;
            const samples: { height: number; outgoing: number; x: number; inert: boolean }[] = [];
            const start = performance.now();
            return new Promise<typeof samples>(resolve => {
                const sample = () => {
                    samples.push({ height: document.querySelector('#ds-modal')!.getBoundingClientRect().height,
                        outgoing: outgoing.offsetHeight, x: new DOMMatrix(getComputedStyle(track).transform).m41, inert: outgoing.inert });
                    if (performance.now() - start < 800) requestAnimationFrame(sample); else resolve(samples);
                };
                sample();
                (document.querySelector(forward ? '.drink-option' : '#ds-backBtn') as HTMLElement).click();
            });
        }, forward);
        const moving = samples.filter(sample => Math.abs(sample.x) > 2 && Math.abs(sample.x) < 350);
        expect(moving.length).toBeGreaterThan(4);
        expect(moving.every(sample => sample.outgoing > 0 && sample.inert)).toBe(true);
        expect(new Set(samples.map(sample => Math.round(sample.height))).size).toBeGreaterThan(4);
        await expect(page.locator('#ds-modal .sheet-step-track')).toHaveAttribute('data-content-changing', 'false');
    }
    await page.evaluate(async () => {
        const frames = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        (document.querySelector('.drink-option') as HTMLElement).click(); await frames();
        (document.querySelector('#ds-backBtn') as HTMLElement).click(); await frames();
        (document.querySelector('.drink-option') as HTMLElement).click();
    });
    await expect(page.locator('#ds-modal .sheet-step-track')).toHaveAttribute('data-content-changing', 'false');
    await expect(page.locator('#ds-actionBtn')).toBeEnabled();
    await expect(page.locator('#ds-addOverlay')).toHaveAttribute('data-sheet-phase', 'open');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Back to drinks' }).click();
    await expect(page.locator('#ds-modal .sheet-step-track')).toHaveAttribute('data-content-changing', 'false');
    expect(await page.locator('#ds-modal .sheet-step-track').evaluate(el => el.getAnimations().length)).toBe(0);
});

test('content growth and shrink animate the compact sheet height', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1100 });
    await prepare(page, '/drinks');
    await enter(page, '#ds-historyModal', () => page.locator('#ds-openHistoryBtn').click());
    for (const grow of [true, false]) {
        const heights = await page.evaluate(async grow => {
            const modal = document.querySelector('#ds-historyModal')!;
            const heights: number[] = [];
            const start = performance.now();
            return new Promise<number[]>(resolve => {
                const sample = () => {
                    heights.push(modal.getBoundingClientRect().height);
                    if (performance.now() - start < 850) requestAnimationFrame(sample); else resolve(heights);
                };
                sample();
                if (grow) {
                    const content = document.createElement('div'); content.id = 'resizing-content'; content.style.height = '220px';
                    modal.querySelector('.modal-body')!.append(content);
                } else modal.querySelector('#resizing-content')!.remove();
            });
        }, grow);
        expect(Math.abs(heights.at(-1)! - heights[0])).toBeGreaterThan(100);
        expect(new Set(heights.map(Math.round)).size).toBeGreaterThan(5);
    }
});

test('hydration entry, internal amount step, history and food history share motion', async ({ page }) => {
    await prepare(page, '/drinks');
    for (let i = 0; i < 2; i++) {
        await enter(page, '#ds-modal', () => page.locator('#ds-openModalBtn').click());
        await page.locator('.drink-option').first().click();
        await expect(page.locator('#ds-modal').locator('..')).toHaveAttribute('data-sheet-phase', 'open');
        await expect(page.locator('#ds-actionBtn')).toBeEnabled();
        await dismiss(page, '#ds-modal');
        await enter(page, '#ds-historyModal', () => page.locator('#ds-openHistoryBtn').click());
        await dismiss(page, '#ds-historyModal');
    }
    await page.locator('a[href="/food"]').click();
    await enter(page, '#historyModal', () => page.locator('#cs-openHistoryBtn').click());
});

test('routines, creation, exercise picker/details, sorting, active workout and history animate', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('healthsync_workouts', JSON.stringify({ routines: [{ id: 'motion-routine', name: 'Motion routine', created_at: new Date().toISOString(),
            exercises: [{ exerciseId: 'motion-exercise', name: 'Motion exercise', image: '', gif: '/fixture.mp4', instructions: 'Controlled movement.', instruction_steps: ['Start', 'Finish'], sets: [{ reps: 10, weight: 5 }] }] }] }));
    });
    await prepare(page);
    await enter(page, '#workoutModal', () => extra(page, 'training'));
    await enter(page, '[aria-label="Create workout"] .modal', () => page.locator('#newRoutineBtn').click());
    await enter(page, '[aria-label="Add exercises"] .modal', () => page.locator('#workoutCreateModalBody .add-workout').click());
    await dismiss(page, '[aria-label="Add exercises"] .modal');
    await dismiss(page, '[aria-label="Create workout"] .modal');
    await page.locator('.routine-menu-btn').click();
    await expect(page.getByRole('menu', { name: 'Routine actions' })).toBeVisible();
    await enter(page, '[aria-label="Sort exercises"] .modal', () => page.getByRole('menuitem', { name: 'Sort exercises' }).click());
    await dismiss(page, '[aria-label="Sort exercises"] .modal');
    await page.locator('.routine-menu-btn').click();
    await enter(page, '[aria-label="Edit workout"] .modal', () => page.getByRole('menuitem', { name: 'Edit Routine' }).click());
    await enter(page, '[aria-label="Motion exercise exercise details"] .modal', () => page.locator('[aria-label="Edit workout"] .exercise-card-header').click());
    await dismiss(page, '[aria-label="Motion exercise exercise details"] .modal');
    await dismiss(page, '[aria-label="Edit workout"] .modal');
    await enter(page, '#activeWorkoutModal', () => page.getByTitle('Start workout', { exact: true }).click());
    await dismiss(page, '#activeWorkoutModal');
    await expect(page.locator('#miniWorkoutBar')).toBeVisible();
    await enter(page, '#activeWorkoutModal', () => page.locator('.mini-workout-info').click());
    await dismiss(page, '#activeWorkoutModal');
    await enter(page, '#workoutHistoryModal', () => extra(page, 'workout-history'));
});

test('supplement tracking sheet animates on first open and reopen', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('calsync_track_supplements', 'true'));
    await prepare(page);
    for (let i = 0; i < 2; i++) {
        await enter(page, '#supplementsModal', () => extra(page, 'supplements'));
        await dismiss(page, '#supplementsModal');
    }
});

