import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

async function openOnboarding(page: Page, preferences = false) {
    await page.addInitScript(({ preferences }) => {
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem('cookieSettings', JSON.stringify({ analytics: false, preferences, thirdparty: false, marketing: false }));
    }, { preferences });
    await page.goto(BASE_URL + '/onboarding', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#onboardingOverlay')).toBeVisible();
    await page.addStyleTag({ content: 'nextjs-portal { pointer-events: none !important; }' });
    await page.waitForFunction(() => {
        const button = document.querySelector('#onboardingNext');
        return Boolean(button && Object.keys(button).some(key => key.startsWith('__reactFiber')));
    });
}

async function goToStep(page: Page, index: number) {
    for (let i = 0; i < index; i++) await page.locator('#onboardingNext').click();
    await expect(page.locator('#onboardingProgress .onboarding-dot').nth(index)).toHaveClass(/\bactive\b/);
}

test('five-step overview, notes, setup, notifications and finish stay navigable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openOnboarding(page);
    await expect(page.locator('#onboardingProgress .onboarding-dot')).toHaveCount(5);
    const overview = page.locator('.onboarding-slide').nth(0);
    await expect(overview.locator('.onboarding-feature')).toHaveCount(7);
    for (const text of ['Search millions of foods, drinks and supplements', 'Personal calorie and hydration goals', 'AI Detection', 'Cloud sync']) {
        await expect(overview.getByText(text)).toBeVisible();
    }

    await goToStep(page, 1);
    const notes = page.locator('.onboarding-slide').nth(1);
    await expect(notes.getByRole('heading', { name: 'About Your Hydration & Calorie Goal' })).toBeVisible();
    await expect(notes.getByRole('heading', { name: 'About AI and Meal Scanning' })).toBeAttached();
    await expect(notes.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', 'https://healthsync.itsmarian.dev/legal/terms');
    await expect(notes.locator('.onboarding-legal-link', { hasText: 'Privacy Policy' })).toHaveAttribute('href', 'https://healthsync.itsmarian.dev/legal/privacy');
    await notes.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.locator('#onboardingNext')).toBeInViewport();

    await page.locator('#onboardingNext').click();
    await expect(page.locator('#onboardingProgress .onboarding-dot').nth(2)).toHaveClass(/\bactive\b/);
    await expect(page.locator('.onboarding-slide').nth(2).locator('.onboarding-slide-title')).toHaveText("Let's set up HealthSync");
    await expect(page.locator('#onboardingNext')).toHaveText('Skip for Now');
    await expect(page.locator('#onboardingSkipGoals')).toHaveCount(0);
    await page.locator('#onboardingBack').click();
    await expect(page.locator('#onboardingProgress .onboarding-dot').nth(2)).not.toHaveClass(/\bactive\b/);
    await page.locator('#onboardingNext').click();
    await page.locator('#onboardingNext').click();
    await expect(page.locator('.onboarding-slide').nth(3).locator('.onboarding-slide-title')).toHaveText('Notifications');
    await expect(page.locator('#onboardingNext')).toHaveText('Not now');
    await page.locator('#onboardingNext').click();
    await expect(page.locator('.onboarding-slide').nth(4).locator('.onboarding-slide-title')).toHaveText("You're all set!");
    const finalCards = page.locator('.onboarding-slide').nth(4).locator('.onboarding-feature');
    await expect(finalCards).toHaveCount(3);
    await expect(finalCards.nth(0)).toContainText('Start with setup?');
    await expect(finalCards.nth(1)).toContainText('Enjoying this project?');
    await expect(finalCards.nth(2)).toContainText('Thank you for using HealthSync!');
    await expect(page.locator('#onboardingSetupCheckbox')).toBeChecked();
});

test('skip without preferences leaves goal values untouched', async ({ page }) => {
    await openOnboarding(page);
    await goToStep(page, 2);
    await expect(page.locator('.onboarding-goal-consent')).toContainText('Preferences consent');
    await page.locator('#calcWeight').fill('70');
    await page.locator('#calcHeight').fill('170');
    await page.locator('#calcAge').fill('25');
    await expect(page.locator('#calcResultVal')).toBeVisible();
    await expect(page.locator('#onboardingApplyGoals')).toBeDisabled();
    await expect(page.locator('#onboardingNext')).toHaveText('Skip for Now');
    await page.locator('#onboardingNext').click();
    const stored = await page.evaluate(() => ['calsync_goal', 'dropsync_goal', 'calsync_goal_protein', 'calsync_goal_carbs', 'calsync_goal_fat', 'healthsync_pending_settings', 'calsync_user_weight_kg'].map(key => localStorage.getItem(key)));
    expect(stored).toEqual(Array(7).fill(null));
});

test('explicit apply uses the Settings calculation and stores only goals with preferences', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openOnboarding(page, true);
    await goToStep(page, 2);
    await expect(page.locator('.onboarding-goal-consent')).toHaveCount(0);
    await expect(page.locator('#onboardingNext')).toHaveText('Skip for Now');
    await expect(page.locator('#onboardingApplyGoals')).toHaveCount(0);
    await page.locator('#calcWeight').fill('70');
    await expect(page.locator('#onboardingNext')).toHaveText('Skip for Now');
    await page.locator('#calcHeight').fill('170');
    await page.locator('#calcAge').fill('25');
    await page.locator('#calcGender [data-val="male"]').click();
    await page.locator('#calcActivity [data-val="moderate"]').click();
    await page.locator('#calcGoalType [data-val="maintain"]').click();
    await page.locator('#hydrationClimate [data-val="mild"]').click();
    await expect(page.locator('#calcResultVal')).toHaveText('2546 kcal');
    await expect(page.locator('#hydrationResultVal')).toHaveText('2353 ml');
    await expect(page.locator('#calcSuggestProtein')).toHaveText('191g');
    await expect(page.locator('#calcSuggestCarbs')).toHaveText('255g');
    await expect(page.locator('#calcSuggestFat')).toHaveText('85g');
    await expect(page.locator('#onboardingNext')).toHaveText('Skip for Now');
    await page.locator('#calcAge').fill('');
    await expect(page.locator('#onboardingNext')).toHaveText('Skip for Now');
    await expect(page.locator('#onboardingApplyGoals')).toHaveCount(0);
    await page.locator('#calcAge').fill('25');
    await expect(page.locator('#onboardingNext')).toHaveText('Skip for Now');
    await page.locator('#onboardingApplyGoals').click();
    await expect(page.locator('.onboarding-slide').nth(3).locator('.onboarding-slide-title')).toHaveText('Notifications');
    const values = await page.evaluate(() => Object.fromEntries(['calsync_goal', 'dropsync_goal', 'calsync_goal_protein', 'calsync_goal_carbs', 'calsync_goal_fat', 'calsync_user_weight_kg'].map(key => [key, localStorage.getItem(key)])));
    expect(values).toEqual({ calsync_goal: '2546', dropsync_goal: '2353', calsync_goal_protein: '191', calsync_goal_carbs: '255', calsync_goal_fat: '85', calsync_user_weight_kg: null });
});

for (const enabled of [true, false]) {
    test('guided tour selection ' + (enabled ? 'on' : 'off') + ' controls pending-tour request', async ({ page }) => {
        const pendingWrites: string[] = [];
        await page.exposeFunction('__recordTourWrite', (key: string) => { if (key === 'calsync_pending_tour') pendingWrites.push(key); });
        await page.addInitScript(() => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'calsync_pending_tour') void (window as unknown as { __recordTourWrite: (key: string) => void }).__recordTourWrite(key);
                return original.call(this, key, value);
            };
        });
        await openOnboarding(page);
        await goToStep(page, 4);
        const toggle = page.locator('#onboardingSetupCheckbox');
        await expect(toggle).toBeChecked();
        if (!enabled) await toggle.uncheck();
        await Promise.all([page.waitForURL(/\/dash(?:\/|\?|#|$)/), page.locator('#onboardingNext').click()]);
        await expect(page.locator('#dashboard-view')).toBeVisible();
        expect(pendingWrites.length).toBe(enabled ? 1 : 0);
        await expect.poll(() => page.evaluate(() => localStorage.getItem('calsync_onboarding_done'))).toBe('1');
    });
}

test('filled setup can still be skipped without changing goals at a wider viewport', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await openOnboarding(page, true);
    await page.evaluate(() => localStorage.setItem('calsync_goal', '2100'));
    await goToStep(page, 2);
    await page.locator('#calcWeight').fill('70');
    await page.locator('#calcHeight').fill('170');
    await page.locator('#calcAge').fill('25');
    await page.locator('.onboarding-slide').nth(2).evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.locator('#onboardingApplyGoals')).toBeInViewport();
    await expect(page.locator('#onboardingNext')).toBeInViewport();
    await expect(page.locator('#onboardingNext')).toHaveText('Skip for Now');
    await expect(page.locator('#onboardingBack')).toBeInViewport();
    await page.locator('#onboardingNext').click();
    await expect(page.locator('.onboarding-slide').nth(3).locator('.onboarding-slide-title')).toHaveText('Notifications');
    const goals = await page.evaluate(() => ['calsync_goal', 'dropsync_goal', 'calsync_goal_protein', 'calsync_goal_carbs', 'calsync_goal_fat', 'healthsync_pending_settings'].map(key => localStorage.getItem(key)));
    expect(goals).toEqual(['2100', null, null, null, null, null]);
});
