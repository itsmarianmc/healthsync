import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

async function gotoDashboard(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('calsync_onboarding_done', '1');
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem(
            'cookieSettings',
            JSON.stringify({ analytics: false, preferences: false, thirdparty: false, marketing: false })
        );
    });
    await page.goto(`${BASE_URL}/dash`);
    await expect(page.locator('#bottomNav')).toBeVisible();
    await page.waitForLoadState('networkidle');
}

test.describe('Pull-to-refresh', () => {
    test.beforeEach(async ({ page }) => {
        await gotoDashboard(page);
    });

    test('mounts the indicator on the dashboard', async ({ page }) => {
        const indicator = page.locator('#ptr-indicator');
        await expect(indicator).toHaveCount(1);
        await expect(indicator).toHaveClass(/\bptr-indicator\b/);
    });

    test('keeps the indicator collapsed by default', async ({ page }) => {
        const height = await page
            .locator('#ptr-indicator')
            .evaluate((el) => el.getBoundingClientRect().height);
        expect(height).toBe(0);
    });

    test('renders the spinner blades and refresh icon inside the indicator', async ({ page }) => {
        const indicator = page.locator('#ptr-indicator');
        await expect(indicator.locator('.r-spinner')).toHaveCount(1);
        await expect(indicator.locator('.r-spinner-blade')).toHaveCount(8);
        await expect(indicator.locator('.ptr-actions')).toHaveCount(1);
    });

    test('is mounted on every primary route', async ({ page }) => {
        await expect(page.locator('#ptr-indicator')).toHaveCount(1);

        await page.goto(`${BASE_URL}/food`);
        await expect(page.locator('#ptr-indicator')).toHaveCount(1);

        await page.goto(`${BASE_URL}/drinks`);
        await expect(page.locator('#ptr-indicator')).toHaveCount(1);
    });

    test('dispatching a storage event refreshes dashboard data without errors', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.evaluate(() => window.dispatchEvent(new Event('storage')));

        await expect(page.locator('#dashboard-view')).toBeVisible();
        await expect(page.locator('#bottomNav')).toBeVisible();
        expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    });
});
