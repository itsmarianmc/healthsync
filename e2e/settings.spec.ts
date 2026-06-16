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

    test('toggles the delete-entry warning and persists to localStorage', async ({ page }) => {
        await openSettings(page);
        const toggle = page.locator('#deleteWarningToggle');

        await expect(toggle).toHaveAttribute('aria-pressed', 'true');

        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('dropsync_delete_warning')))
            .toBe('false');

        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    test('switches the active app theme', async ({ page }) => {
        await openSettings(page);

        const lightOption = page.locator('.theme-option[data-theme="light"]');
        await lightOption.click();

        await expect(lightOption).toHaveClass(/\bactive\b/);
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('calsync_theme')))
            .toBe('light');
    });

    test('reveals AI settings after enabling the toggle', async ({ page }) => {
        await openSettings(page);
        const aiToggle = page.locator('#aiEnabledToggle');

        await expect(aiToggle).toHaveAttribute('aria-pressed', 'false');
        await aiToggle.click();
        await expect(aiToggle).toHaveAttribute('aria-pressed', 'true');

        await expect(page.locator('#aiTermsBox')).toBeVisible();
        await page.locator('#aiTermsAccept').click();
        await expect(page.locator('#aiApiKeySection')).toBeVisible();
        await expect(page.locator('#aiApiKeyInput')).toHaveAttribute('type', 'password');

        await page.locator('#apiKeyToggle').click();
        await expect(page.locator('#aiApiKeyInput')).toHaveAttribute('type', 'text');
    });

    test('opens the goal modal from "Set Goal" and "Calculate Goal"', async ({ page }) => {
        await openSettings(page);

        await page.locator('#openSetGoalBtn').click();
        const goalModal = page.locator('#goalModal');
        await expect(goalModal).toBeVisible();
        await expect(page.locator('#goalModalTitle')).toHaveText('Set Calorie Goal');
        await expect(page.locator('#goalViewSet')).toBeVisible();

        const calcBtn = page.locator('#goalModeCalcBtn');
        await expect(calcBtn).toBeVisible();
        await calcBtn.click();

        await expect(page.locator('#goalModalTitle')).toHaveText('Calculate Calorie Goal');
        await expect(page.locator('#goalViewCalc .option-group').first()).toBeVisible();
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
