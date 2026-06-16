import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const TOTAL_SLIDES = 6;

test.describe.configure({ mode: 'serial' });

async function waitForHydration(page: Page, selector: string) {
    await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return Object.keys(el).some(k => k.startsWith('__reactFiber'));
    }, selector);
}

async function gotoOnboarding(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem(
            'cookieSettings',
            JSON.stringify({ analytics: false, preferences: false, thirdparty: false, marketing: false })
        );
    });
    await page.goto(`${BASE_URL}/onboarding`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#onboardingOverlay')).toBeVisible();
    await waitForHydration(page, '#onboardingNext');
}

async function goToSlide(page: Page, index: number) {
    const dots = page.locator('#onboardingProgress .onboarding-dot');
    const next = page.locator('#onboardingNext');
    for (let i = 0; i < index; i++) {
        await next.click();
    }
    await expect(dots.nth(index)).toHaveClass(/\bactive\b/);
}

test.describe('Onboarding · structure', () => {
    test.beforeEach(async ({ page }) => {
        await gotoOnboarding(page);
    });

    test('renders the brand header with logo, name and login button', async ({ page }) => {
        const overlay = page.locator('#onboardingOverlay');
        await expect(overlay.locator('.onboarding-logo img')).toHaveAttribute('alt', 'HealthSync');
        await expect(overlay.locator('.onboarding-app-name')).toHaveText('HealthSync');
        await expect(page.locator('#onboardingLogin')).toBeVisible();
    });

    test('progress dots match the slide count', async ({ page }) => {
        const dots = page.locator('#onboardingProgress .onboarding-dot');
        await expect(dots).toHaveCount(TOTAL_SLIDES);
        await expect(dots.nth(0)).toHaveClass(/\bactive\b/);
        for (let i = 1; i < TOTAL_SLIDES; i++) {
            await expect(dots.nth(i)).not.toHaveClass(/\bactive\b/);
        }
    });

    test('hides the back button on the first slide', async ({ page }) => {
        await expect(page.locator('#onboardingBack')).toHaveClass(/\bbtn-hidden\b/);
    });

    test('renders one element per slide inside the slides track', async ({ page }) => {
        await expect(page.locator('#onboardingSlides .onboarding-slide')).toHaveCount(TOTAL_SLIDES);
    });
});

test.describe('Onboarding · slide 1 (Welcome)', () => {
    test.beforeEach(async ({ page }) => { await gotoOnboarding(page); });

    test('shows the welcome heading and feature list', async ({ page }) => {
        const slide = page.locator('.onboarding-slide').nth(0);
        await expect(slide.locator('.onboarding-slide-title')).toContainText('Welcome to');
        await expect(slide.locator('.onboarding-slide-title span')).toHaveText('HealthSync');

        const features = slide.locator('.onboarding-feature');
        await expect(features).toHaveCount(7);
        await expect(features.nth(0)).toContainText('Search millions of foods');
        await expect(features.nth(1)).toContainText('Personal calorie and hydration goals');
        await expect(features.nth(2)).toContainText('AI Detection');
        await expect(features.nth(3)).toContainText('Everything in one place');
        await expect(features.nth(4)).toContainText('Cloud sync');
        await expect(features.nth(5)).toContainText('Customization');
        await expect(features.nth(6)).toContainText('Install as app');
    });
});

test.describe('Onboarding · slide 2 (Log Food)', () => {
    test.beforeEach(async ({ page }) => {
        await gotoOnboarding(page);
        await goToSlide(page, 1);
    });

    test('shows the four food-logging steps', async ({ page }) => {
        const slide = page.locator('.onboarding-slide').nth(1);
        await expect(slide.locator('.onboarding-slide-title')).toContainText('Log');
        await expect(slide.locator('.onboarding-slide-title span')).toHaveText('Food');

        const features = slide.locator('.onboarding-feature');
        await expect(features).toHaveCount(4);
        await expect(features.nth(0)).toContainText('Step 1 - Set your food type');
        await expect(features.nth(1)).toContainText('Step 2 - Search, Enter or Scan');
        await expect(features.nth(2)).toContainText('Step 3 - Set amount');
        await expect(features.nth(3)).toContainText('Step 4 - Confirm');
    });
});

test.describe('Onboarding · slide 3 (Log Drink)', () => {
    test.beforeEach(async ({ page }) => {
        await gotoOnboarding(page);
        await goToSlide(page, 2);
    });

    test('shows the three drink-logging steps', async ({ page }) => {
        const slide = page.locator('.onboarding-slide').nth(2);
        await expect(slide.locator('.onboarding-slide-title')).toContainText('Log a');
        await expect(slide.locator('.onboarding-slide-title span')).toHaveText('Drink');

        const features = slide.locator('.onboarding-feature');
        await expect(features).toHaveCount(3);
        await expect(features.nth(0)).toContainText('Step 1 - Pick a drink');
        await expect(features.nth(1)).toContainText('Step 2 - Set the amount');
        await expect(features.nth(2)).toContainText('Step 3 - Confirm');
    });
});

test.describe('Onboarding · slide 4 (Daily Goal)', () => {
    test.beforeEach(async ({ page }) => {
        await gotoOnboarding(page);
        await goToSlide(page, 3);
    });

    test('shows all four goal/tracking features', async ({ page }) => {
        const slide = page.locator('.onboarding-slide').nth(3);
        await expect(slide.locator('.onboarding-slide-title')).toContainText('Your Daily');
        await expect(slide.locator('.onboarding-slide-title span')).toHaveText('Goal');

        const features = slide.locator('.onboarding-feature');
        await expect(features).toHaveCount(4);
        await expect(features.nth(0)).toContainText('Goal calculator');
        await expect(features.nth(1)).toContainText('Hydration tracking');
        await expect(features.nth(2)).toContainText('Macro tracking');
        await expect(features.nth(3)).toContainText('Full history');
    });
});

test.describe('Onboarding · slide 5 (Additional Notes & legal links)', () => {
    test.beforeEach(async ({ page }) => {
        await gotoOnboarding(page);
        await goToSlide(page, 4);
    });

    test('renders the legal sections and agreement copy', async ({ page }) => {
        const slide = page.locator('.onboarding-slide').nth(4);
        await expect(slide.locator('.onboarding-slide-title')).toContainText('Additional');
        await expect(slide.locator('.onboarding-slide-title span')).toHaveText('Notes');

        await expect(slide.getByRole('heading', { name: 'About Your Hydration & Calorie Goal' })).toBeVisible();
        await expect(slide.getByRole('heading', { name: 'About AI and Meal Scanning' })).toBeVisible();
        await expect(slide.locator('.onboarding-legal-agree')).toContainText("Let's go!");
    });

    test('Terms of Service link points to itsmarian.dev and opens in a new tab', async ({ page }) => {
        const link = page.locator('.onboarding-legal-link', { hasText: 'Terms of Service' });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', 'https://itsmarian.dev/legal/terms');
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    });

    test('Privacy Policy link points to itsmarian.dev and opens in a new tab', async ({ page }) => {
        const link = page.locator('.onboarding-legal-link', { hasText: 'Privacy Policy' });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', 'https://itsmarian.dev/legal/privacy');
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    });

    test('inline Privacy Policy link inside the legal text targets the same URL', async ({ page }) => {
        const inline = page.locator('.onboarding-legal-text a[href*="legal/privacy"]');
        await expect(inline.first()).toHaveAttribute('href', 'https://itsmarian.dev/legal/privacy');
        await expect(inline.first()).toHaveAttribute('target', '_blank');
    });
});

test.describe('Onboarding · slide 6 (All set & support links)', () => {
    test.beforeEach(async ({ page }) => {
        await gotoOnboarding(page);
        await goToSlide(page, 5);
    });

    test('shows the final slide with the start-tour checkbox checked by default', async ({ page }) => {
        const slide = page.locator('.onboarding-slide').nth(5);
        await expect(slide.locator('.onboarding-slide-title')).toContainText("You're all");
        await expect(slide.locator('.onboarding-slide-title span')).toHaveText('set!');

        const checkbox = page.locator('#onboardingSetupCheckbox');
        await expect(checkbox).toBeChecked();
    });

    test('toggling the start-tour checkbox flips its state', async ({ page }) => {
        const checkbox = page.locator('#onboardingSetupCheckbox');
        await checkbox.click();
        await expect(checkbox).not.toBeChecked();
        await checkbox.click();
        await expect(checkbox).toBeChecked();
    });

    test('Ko-fi support link points to ko-fi.com/itsmarian', async ({ page }) => {
        const link = page.locator('.onboarding-slide').nth(5).locator('a[href*="ko-fi.com"]');
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', 'https://ko-fi.com/itsmarian');
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    });

    test('GitHub issues link points to the repo issue tracker', async ({ page }) => {
        const link = page.locator('.onboarding-slide').nth(5).locator('a[href*="github.com"]');
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', 'https://github.com/itsmarianmc/projects/issues');
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    });

    test('the Next button text becomes "Let\'s go!" on the last slide', async ({ page }) => {
        await expect(page.locator('#onboardingNext')).toHaveText(/Let's go!/);
    });
});

test.describe('Onboarding · navigation', () => {
    test.beforeEach(async ({ page }) => { await gotoOnboarding(page); });

    test('progress dots fill in cumulatively as the user advances', async ({ page }) => {
        const dots = page.locator('#onboardingProgress .onboarding-dot');
        const next = page.locator('#onboardingNext');
        for (let i = 1; i < TOTAL_SLIDES; i++) {
            await next.click();
            for (let j = 0; j <= i; j++) {
                await expect(dots.nth(j)).toHaveClass(/\bactive\b/);
            }
        }
    });

    test('the back button reveals after leaving slide 0 and reverses the slide', async ({ page }) => {
        const back = page.locator('#onboardingBack');
        const next = page.locator('#onboardingNext');
        const dots = page.locator('#onboardingProgress .onboarding-dot');

        await next.click();
        await expect(back).not.toHaveClass(/\bbtn-hidden\b/);
        await expect(dots.nth(1)).toHaveClass(/\bactive\b/);

        await back.click();
        await expect(dots.nth(1)).not.toHaveClass(/\bactive\b/);
        await expect(dots.nth(0)).toHaveClass(/\bactive\b/);
        await expect(back).toHaveClass(/\bbtn-hidden\b/);
    });

    test('login button in the header sets the onboarding flag and navigates to /login', async ({ page }) => {
        await Promise.all([
            page.waitForURL(/\/login(?:\/|\?|#|$)/),
            page.locator('#onboardingLogin').click(),
        ]);
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('calsync_onboarding_done')))
            .toBe('1');
    });

    test('completing the flow with the tour disabled does not queue a pending tour', async ({ page }) => {
        const setItemCalls: Array<{ key: string; value: string }> = [];
        await page.exposeFunction('__recordSet', (key: string, value: string) => {
            setItemCalls.push({ key, value });
        });
        await page.addInitScript(() => {
            const orig = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key: string, value: string) {
                (window as unknown as { __recordSet: (k: string, v: string) => void }).__recordSet(key, value);
                return orig.call(this, key, value);
            };
        });
        await page.goto(`${BASE_URL}/onboarding`);
        await goToSlide(page, 5);
        await page.locator('#onboardingSetupCheckbox').click();
        await expect(page.locator('#onboardingSetupCheckbox')).not.toBeChecked();

        await Promise.all([
            page.waitForURL(/\/dash(?:\/|\?|#|$)/),
            page.locator('#onboardingNext').click(),
        ]);

        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('calsync_onboarding_done')))
            .toBe('1');
        expect(setItemCalls.some(c => c.key === 'calsync_pending_tour' && c.value === '1')).toBe(false);
    });

    test('completing the flow with the tour enabled queues a pending tour', async ({ page }) => {
        const setItemCalls: Array<{ key: string; value: string }> = [];
        await page.exposeFunction('__recordSet', (key: string, value: string) => {
            setItemCalls.push({ key, value });
        });
        await page.addInitScript(() => {
            const orig = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key: string, value: string) {
                (window as unknown as { __recordSet: (k: string, v: string) => void }).__recordSet(key, value);
                return orig.call(this, key, value);
            };
        });
        await page.goto(`${BASE_URL}/onboarding`);
        await goToSlide(page, 5);
        await expect(page.locator('#onboardingSetupCheckbox')).toBeChecked();

        await Promise.all([
            page.waitForURL(/\/dash(?:\/|\?|#|$)/),
            page.locator('#onboardingNext').click(),
        ]);

        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('calsync_onboarding_done')))
            .toBe('1');
        expect(setItemCalls.some(c => c.key === 'calsync_pending_tour' && c.value === '1')).toBe(true);
    });
});
