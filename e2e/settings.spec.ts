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
    await expect(page.locator('#db-openSettingsBtn')).toBeVisible();
    await expect(page.locator('.cookie-banner')).toHaveCount(0);
}

async function openSettings(page: Page) {
    await page.locator('#db-openSettingsBtn').click();
    const modal = page.locator('#settingsModal');
    await expect(modal).toBeVisible();
    return modal;
}

test.describe('Settings menu', () => {
    test.beforeEach(async ({ page }) => {
        await gotoDashboard(page);
    });

    test('opens when the gear button is clicked', async ({ page }) => {
        const modal = await openSettings(page);
        await expect(modal.locator('.modal-title')).toHaveText('Settings');
        await expect(page.locator('#settingsOverlay')).toBeVisible();
    });

    test('renders all primary sections', async ({ page }) => {
        const modal = await openSettings(page);

        await expect(modal.getByText('Cloud Sync')).toBeVisible();
        await expect(modal.getByText('AI Detection [BETA]')).toBeVisible();
        await expect(modal.getByText('Calorie/Hydration Goal/s')).toBeVisible();
        await expect(modal.getByText('Personalization')).toBeVisible();
        await expect(modal.getByText('Data', { exact: true })).toBeVisible();

        await expect(page.locator('#exportAllDataBtn')).toBeVisible();
        await expect(page.locator('#exportAllDataCSVBtn')).toBeVisible();
        await expect(page.locator('#deleteAllDataBtn')).toBeVisible();
    });

    test('shows Login/Register entry when no user is signed in', async ({ page }) => {
        await openSettings(page);
        await expect(page.locator('#accountLoginBtn')).toBeVisible();
        await expect(page.locator('#accountLogoutBtn')).toHaveCount(0);
    });

    test('closes when clicking the overlay background', async ({ page }) => {
        await openSettings(page);
        const overlay = page.locator('#settingsOverlay');
        await expect(overlay).toHaveClass(/\bvisible\b/);

        await overlay.evaluate((el) => {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        await expect(overlay).not.toHaveClass(/\bvisible\b/);
    });
});
