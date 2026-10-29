import { test, expect, type Page } from '@playwright/test';
import { APP_VERSION } from '../src/app/_lib/release';

async function openSettings(page: Page) {
    await page.addInitScript((version) => {
        localStorage.setItem('calsync_onboarding_done', '1');
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem('healthsync_last_seen_changelog_version_guest', version);
        localStorage.setItem('cookieSettings', JSON.stringify({ analytics: false, preferences: true, thirdparty: false, marketing: false }));
    }, APP_VERSION);
    await page.goto('/dash');
    await page.locator('#db-openSettingsBtn').click();
    await expect(page.locator('#settingsOverlay')).toHaveClass(/\bvisible\b/);
}

async function dragHandle(page: Page, distance: number, release = true) {
    const box = await page.locator('#goalModalHandleZone').boundingBox();
    if (!box) throw new Error('GoalModal handle is unavailable');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + distance, { steps: 8 });
    if (release) {
        await page.waitForTimeout(80);
        await page.mouse.up();
    }
}

for (const viewport of [{ width: 390, height: 844 }, { width: 900, height: 900 }]) {
    test.describe(`GoalModal at ${viewport.width}px`, () => {
        test.use({ viewport });

        test('tracks handle drags, snaps between heights, and restores the Settings sheet', async ({ page }) => {
            await openSettings(page);
            await page.locator('#openSetGoalBtn').click();
            const modal = page.locator('#goalModal');
            await expect(page.locator('#goalModalTitle')).toHaveText('Set Calorie Goal');
            await expect(page.locator('#goalModalOverlay')).toHaveClass(/\bvisible\b/);
            await page.waitForTimeout(450);
            const naturalHeight = await modal.evaluate(el => el.getBoundingClientRect().height);

            await dragHandle(page, 20);
            await page.waitForTimeout(450);
            await expect.poll(() => modal.evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(naturalHeight, 0);

            await dragHandle(page, -130, false);
            const liveHeight = await modal.evaluate(el => el.getBoundingClientRect().height);
            expect(liveHeight).toBeGreaterThan(naturalHeight + 40);
            await page.mouse.up();
            await page.waitForTimeout(450);
            const expandedHeight = await modal.evaluate(el => el.getBoundingClientRect().height);
            expect(expandedHeight).toBeGreaterThan(naturalHeight + 40);

            await dragHandle(page, 120);
            await page.waitForTimeout(450);
            await expect.poll(() => modal.evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(naturalHeight, 0);

            await dragHandle(page, 120);
            await expect(page.locator('#goalModal')).toHaveCount(0);
            await expect(page.locator('#settingsOverlay')).toHaveClass(/\bvisible\b/);
            await expect(page.locator('body')).toHaveClass(/\bmodal-open\b/);

            await page.locator('#openSetGoalBtn').click();
            await page.keyboard.press('Escape');
            await expect(page.locator('#goalModal')).toHaveCount(0);
            await expect(page.locator('#settingsOverlay')).toHaveClass(/\bvisible\b/);
            await expect(page.locator('#openSetGoalBtn')).toBeFocused();

            await page.locator('#openSetGoalBtn').click();
            await page.locator('#goalModalOverlay').evaluate(el => {
                el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await expect(page.locator('#goalModal')).toHaveCount(0);
            await expect(page.locator('#settingsOverlay')).toHaveClass(/\bvisible\b/);

            await page.locator('#openSetGoalBtn').click();
            await page.locator('#manualGoalInput').fill('2050');
            await page.locator('#manualGoalBtn').click();
            await expect(page.locator('#goalModal')).toHaveCount(0);
            expect(await page.evaluate(() => localStorage.getItem('calsync_goal'))).toBe('2050');
            await page.keyboard.press('Escape');
            await expect(page.locator('#settingsOverlay')).not.toHaveClass(/\bvisible\b/);
            await expect(page.locator('body')).not.toHaveClass(/\bmodal-open\b/);
        });

        test('keeps calculator results and footer reachable while scrolling, then saves both goals', async ({ page }) => {
            await openSettings(page);
            await page.locator('#openCalcGoalBtn').click();
            await expect(page.locator('#goalModalTitle')).toHaveText('Calculate Calorie Goal');
            await expect(page.locator('#goalModeCalcBtn')).toHaveAttribute('aria-pressed', 'true');
            await page.locator('#goalModeSetBtn').click();
            await expect(page.locator('#goalViewSet')).toBeVisible();
            await page.locator('#goalModeCalcBtn').click();
            await expect(page.locator('#goalViewCalc')).toBeVisible();
            await page.waitForTimeout(450);
            const modal = page.locator('#goalModal');
            const naturalHeight = await modal.evaluate(el => el.getBoundingClientRect().height);
            await dragHandle(page, -120, false);
            expect(await modal.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(naturalHeight + 40);
            await page.mouse.up();
            await page.waitForTimeout(450);
            expect(await modal.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(naturalHeight + 40);
            await dragHandle(page, 120);
            await page.waitForTimeout(450);
            await expect.poll(() => modal.evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(naturalHeight, 0);
            await page.locator('#calcWeight').fill('70');
            await page.locator('#calcHeight').fill('170');
            await page.locator('#calcAge').fill('25');
            await expect(page.locator('#calcResultVal')).toContainText('kcal');
            await page.locator('#goalModalBody').evaluate(el => { el.scrollTop = el.scrollHeight; });
            await expect(page.locator('#applyBothGoalsBtn')).toBeVisible();
            await expect(page.locator('#goalModeSetBtn')).toBeVisible();
            const reach = await page.evaluate(() => {
                const body = document.querySelector('#goalModalBody')!.getBoundingClientRect();
                const footer = document.querySelector('#goalModal .modal-footer')!.getBoundingClientRect();
                const apply = document.querySelector('#applyBothGoalsBtn')!.getBoundingClientRect();
                return { body, footer, apply, viewportHeight: window.innerHeight };
            });
            expect(reach.footer.bottom).toBeLessThanOrEqual(reach.viewportHeight + 1);
            expect(reach.apply.top).toBeGreaterThanOrEqual(reach.body.top);
            expect(reach.apply.bottom).toBeLessThanOrEqual(reach.footer.top + 1);
            await page.locator('#applyBothGoalsBtn').click();
            await expect(page.locator('#goalModal')).toHaveCount(0);
            const saved = await page.evaluate(() => ({
                calorie: localStorage.getItem('calsync_goal'),
                water: localStorage.getItem('dropsync_goal'),
            }));
            expect(Number(saved.calorie)).toBeGreaterThan(0);
            expect(Number(saved.water)).toBeGreaterThan(0);
            await expect(page.locator('#settingsOverlay')).toHaveClass(/\bvisible\b/);
        });
    });
}
