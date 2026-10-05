import { test, expect, type Page } from '@playwright/test';
import { APP_VERSION } from '../src/app/_lib/release';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

async function gotoDashboard(page: Page) {
    await page.addInitScript((appVersion) => {
        localStorage.setItem('calsync_onboarding_done', '1');
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem('healthsync_last_seen_changelog_version_guest', appVersion);
        localStorage.setItem(
            'cookieSettings',
            JSON.stringify({ analytics: false, preferences: false, thirdparty: false, marketing: false })
        );
    }, APP_VERSION);
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

    test('manages custom supplements in a separate sheet and preserves IDs and intake marks', async ({ page }) => {
        await page.evaluate(() => {
            const settings = JSON.parse(localStorage.getItem('cookieSettings') || '{}');
            settings.preferences = true;
            localStorage.setItem('cookieSettings', JSON.stringify(settings));
            window.dispatchEvent(new Event('cookieSettingsChanged'));
        });

        const modal = await openSettings(page);
        const trackingToggle = modal.locator('#trackSupplementsToggle');
        await expect(trackingToggle).toBeEnabled();
        await trackingToggle.click();

        const manageButton = modal.locator('#manageCustomSupplementsBtn');
        await expect(manageButton).toBeVisible();
        await manageButton.click();
        const supplementsModal = page.locator('#customSupplementsModal');
        await expect(page.locator('#settingsOverlay')).toHaveClass(/\bvisible\b/);
        await expect(supplementsModal).toBeVisible();
        await expect(supplementsModal.getByRole('heading', { name: 'Custom supplements' })).toBeVisible();
        await expect(supplementsModal.getByText('No custom supplements yet.')).toBeVisible();

        await supplementsModal.locator('#addCustomSupplementBtn').click();
        const editorModal = page.locator('#customSupplementEditorModal');
        const editorOverlay = page.locator('#customSupplementEditorOverlay');
        await expect(editorOverlay).toHaveClass(/\bvisible\b/);
        await expect(supplementsModal).toBeVisible();
        await editorModal.locator('#customSupplementName').fill('Vitamin D');
        const wednesday = editorModal.getByRole('button', { name: 'Wednesday' });
        await expect(wednesday).toHaveAttribute('aria-pressed', 'false');
        await wednesday.click();
        await expect(wednesday).toHaveAttribute('aria-pressed', 'true');
        await editorModal.locator('#customSupplementDose').fill('1 capsule');
        await editorModal.locator('#saveCustomSupplementBtn').click();
        await expect(editorOverlay).not.toHaveClass(/\bvisible\b/);
        await expect(supplementsModal).toBeVisible();

        const entry = supplementsModal.getByRole('button', { name: 'Edit Vitamin D, Wed' });
        await expect(entry).toBeVisible();
        let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_supplements') || '[]'));
        expect(saved).toHaveLength(1);
        expect(saved[0].schedule).toEqual({ mode: 'weekdays', weekdays: [3] });
        const savedId = saved[0].id as string;
        const today = await page.evaluate(() => {
            const date = new Date();
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        });
        await page.evaluate(({ id, date }) => {
            localStorage.setItem('calsync_supplements_taken', JSON.stringify({ [date]: { [id]: true } }));
        }, { id: savedId, date: today });

        await entry.click();
        await expect(editorOverlay).toHaveClass(/\bvisible\b/);
        await editorModal.getByRole('button', { name: 'Close editor' }).click();
        await expect(editorOverlay).not.toHaveClass(/\bvisible\b/);
        await expect(supplementsModal).toBeVisible();

        await entry.click();
        await expect(editorOverlay).toHaveClass(/\bvisible\b/);
        await editorModal.locator('#customSupplementName').fill('Vitamin D Plus');
        await editorModal.getByRole('button', { name: 'Interval', exact: true }).click();
        await expect(editorModal.locator('#customSupplementStartDate')).toHaveValue(today);
        await expect(editorModal.locator('#customSupplementEveryDays')).toHaveValue('2');
        await editorModal.locator('#saveCustomSupplementBtn').click();
        await expect(editorOverlay).not.toHaveClass(/\bvisible\b/);
        saved = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_custom_supplements') || '[]'));
        expect(saved).toHaveLength(1);
        expect(saved[0].id).toBe(savedId);
        expect(saved[0].name).toBe('Vitamin D Plus');
        expect(saved[0].schedule).toEqual({ mode: 'interval', everyDays: 2, startDate: today });
        await expect(supplementsModal.locator('.custom-supplement-item')).toHaveCount(1);
        const takenAfterEdit = await page.evaluate(() => JSON.parse(localStorage.getItem('calsync_supplements_taken') || '{}'));
        expect(takenAfterEdit[today][savedId]).toBe(true);
        page.once('dialog', dialog => dialog.accept());
        await supplementsModal.getByRole('button', { name: 'Remove Vitamin D Plus' }).click();
        await expect(supplementsModal.locator('.custom-supplement-item')).toHaveCount(0);
        const afterRemoval = await page.evaluate(() => ({
            definitions: JSON.parse(localStorage.getItem('calsync_custom_supplements') || '[]'),
            taken: JSON.parse(localStorage.getItem('calsync_supplements_taken') || '{}'),
        }));
        expect(afterRemoval.definitions).toEqual([]);
        expect(afterRemoval.taken[today][savedId]).toBe(true);

        await page.keyboard.press('Escape');
        await expect(page.locator('#customSupplementsOverlay')).not.toHaveClass(/\bvisible\b/);
        await expect(page.locator('#settingsOverlay')).toHaveClass(/\bvisible\b/);
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
