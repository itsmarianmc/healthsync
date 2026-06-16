import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

async function gotoFreshOnboarding(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem(
            'cookieSettings',
            JSON.stringify({ analytics: false, preferences: false, thirdparty: false, marketing: false })
        );
    });
}

test.describe('Onboarding flow', () => {
    test.beforeEach(async ({ page }) => {
        await gotoFreshOnboarding(page);
    });

    test('redirects from /dash to /onboarding when the flag is missing', async ({ page }) => {
        await page.goto(`${BASE_URL}/dash`);
        await page.waitForURL(/\/onboarding(?:\/|\?|#|$)/);
        await expect(page.locator('#onboardingOverlay')).toBeVisible();
    });

    test('renders the first slide with the expected structure', async ({ page }) => {
        await page.goto(`${BASE_URL}/onboarding`);
        const overlay = page.locator('#onboardingOverlay');
        await expect(overlay).toBeVisible();

        await expect(overlay.locator('.onboarding-app-name')).toBeVisible();
        await expect(page.locator('#onboardingLogin')).toBeVisible();

        const dots = page.locator('#onboardingProgress .onboarding-dot');
        await expect(dots).toHaveCount(6);
        await expect(dots.nth(0)).toHaveClass(/\bactive\b/);
        await expect(dots.nth(1)).not.toHaveClass(/\bactive\b/);

        const firstSlide = page.locator('.onboarding-slide').nth(0);
        await expect(firstSlide.getByText(/Welcome to/i)).toBeVisible();

        await expect(page.locator('#onboardingBack')).toHaveClass(/\bbtn-hidden\b/);
        await expect(page.locator('#onboardingNext')).toBeVisible();
    });

    test('advances through every slide via Next/Back', async ({ page }) => {
        await page.goto(`${BASE_URL}/onboarding`);
        const dots = page.locator('#onboardingProgress .onboarding-dot');
        const next = page.locator('#onboardingNext');
        const back = page.locator('#onboardingBack');

        const totalSlides = await dots.count();
        expect(totalSlides).toBeGreaterThan(1);

        for (let i = 1; i < totalSlides; i++) {
            await next.click();
            await expect(dots.nth(i)).toHaveClass(/\bactive\b/);
        }

        await expect(next).toHaveText(/Let's go!/);

        await back.click();
        await expect(dots.nth(totalSlides - 1)).not.toHaveClass(/\bactive\b/);
        await expect(dots.nth(totalSlides - 2)).toHaveClass(/\bactive\b/);
    });

    test('completes the flow, persists the flag, and lands on /dash', async ({ page }) => {
        await page.goto(`${BASE_URL}/onboarding`);
        const dots = page.locator('#onboardingProgress .onboarding-dot');
        const next = page.locator('#onboardingNext');
        const totalSlides = await dots.count();

        for (let i = 1; i < totalSlides; i++) {
            await next.click();
        }
        await expect(next).toHaveText(/Let's go!/);

        await Promise.all([
            page.waitForURL(/\/dash(?:\/|\?|#|$)/),
            next.click(),
        ]);

        await expect(page.locator('#dashboard-view')).toBeVisible();
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('calsync_onboarding_done')))
            .toBe('1');
    });

    test('login link in the onboarding header sets the flag and routes to /login', async ({ page }) => {
        await page.goto(`${BASE_URL}/onboarding`);
        await Promise.all([
            page.waitForURL(/\/login(?:\/|\?|#|$)/),
            page.locator('#onboardingLogin').click(),
        ]);
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('calsync_onboarding_done')))
            .toBe('1');
    });
});
