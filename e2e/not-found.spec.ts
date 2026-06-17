import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

async function setAppFlags(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('calsync_onboarding_done', '1');
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem(
            'cookieSettings',
            JSON.stringify({ analytics: false, preferences: false, thirdparty: false, marketing: false })
        );
    });
}

test.describe('404 / unknown routes', () => {
    test.beforeEach(async ({ page }) => {
        await setAppFlags(page);
    });

    test('renders the not-found page for an unknown path', async ({ page }) => {
        const response = await page.goto(`${BASE_URL}/this-route-does-not-exist`);
        expect(response?.status()).toBe(404);

        await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
        await expect(page.getByText('This page could not be found.')).toBeVisible();
    });

    test('does not render the AppShell chrome on unknown routes', async ({ page }) => {
        await page.goto(`${BASE_URL}/totally-missing-page`);

        await expect(page.locator('#bottomNav')).toHaveCount(0);
        await expect(page.locator('#extraActionBtn')).toHaveCount(0);
        await expect(page.locator('#dashboard-view')).toHaveCount(0);
        await expect(page.locator('#calsync-view')).toHaveCount(0);
        await expect(page.locator('#dropsync-view')).toHaveCount(0);
    });

    test('does not show the cookie banner on the 404 page', async ({ page }) => {
        await page.goto(`${BASE_URL}/no-such-page`);
        await expect(page.locator('.cookie-banner')).toHaveCount(0);
    });

    test('handles nested unknown paths', async ({ page }) => {
        const response = await page.goto(`${BASE_URL}/foo/bar/baz`);
        expect(response?.status()).toBe(404);
        await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    });
});
