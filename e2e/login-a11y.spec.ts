import { test, expect } from '@playwright/test';

test('login does not promise remembered-device trust and respects reduced motion', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('calsync_onboarding_done', '1');
    localStorage.setItem('bannerAccepted', 'true');
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login', { waitUntil: 'commit' });
  await expect(page.getByText("Don't ask again on this device")).toHaveCount(0);
  await expect(page.locator('#mfaRememberMe')).toHaveCount(0);
  await expect(page.locator('#viewLogin')).toBeVisible();
  const animation = await page.locator('#viewLogin').evaluate(element => getComputedStyle(element).animationName);
  expect(animation).toBe('none');
  await page.keyboard.press('Tab');
  const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
  expect(focusedElement).toBeTruthy();
});
