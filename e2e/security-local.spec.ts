import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { APP_VERSION } from '../src/app/_lib/release';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

test('saved true cookie consent hydrates without React mismatch', async ({ page }) => {
  const hydrationErrors: number[] = [];
  page.on('pageerror', error => {
    if (/hydration|#418/i.test(error.message)) hydrationErrors.push(1);
  });
  await page.addInitScript((appVersion) => {
    localStorage.setItem('calsync_onboarding_done', '1');
    localStorage.setItem('bannerAccepted', 'true');
    localStorage.setItem('healthsync_last_seen_changelog_version_guest', appVersion);
    localStorage.setItem('cookieSettings', JSON.stringify({ analytics: true, preferences: true, thirdparty: true }));
  }, APP_VERSION);
  await page.goto(`${BASE_URL}/dash`);
  await expect(page.locator('#db-openSettingsBtn')).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});

test('CSV export neutralizes formula-like food names', async ({ page }) => {
  await page.addInitScript((appVersion) => {
    localStorage.setItem('calsync_onboarding_done', '1');
    localStorage.setItem('bannerAccepted', 'true');
    localStorage.setItem('healthsync_last_seen_changelog_version_guest', appVersion);
    localStorage.setItem('cookieSettings', JSON.stringify({ analytics: false, preferences: true, thirdparty: false }));
    localStorage.setItem('calsync_v1', JSON.stringify([{
      id: 'csv-test', food: '=HYPERLINK("https://example.invalid")', brand: '@malicious',
      kcal: 100, prot: 0, carb: 0, fat: 0, ts: Date.now(), date: new Date().toDateString(),
    }]));
  }, APP_VERSION);
  await page.goto(`${BASE_URL}/dash`);
  await page.locator('#db-openSettingsBtn').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportAllDataCSVBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('healthsync_food.csv');
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain("'=HYPERLINK");
  expect(csv).toContain("'@malicious");
});

test('food deletion exposes a working Undo button', async ({ page }) => {
  await page.addInitScript((appVersion) => {
    localStorage.setItem('calsync_onboarding_done', '1');
    localStorage.setItem('bannerAccepted', 'true');
    localStorage.setItem('healthsync_last_seen_changelog_version_guest', appVersion);
    localStorage.setItem('dropsync_delete_warning', 'false');
    localStorage.setItem('calsync_v1', JSON.stringify([{
      id: 'undo-test', food: 'Apple', kcal: 90, prot: 0, carb: 20, fat: 0,
      ts: Date.now(), date: new Date().toDateString(),
    }]));
  }, APP_VERSION);
  await page.goto(`${BASE_URL}/food`);
  await expect(page.locator('#cs-logList .log-name').getByText('Apple', { exact: true })).toBeVisible();
  await page.locator('#cs-logList .log-delete').first().click();
  await expect(page.locator('.toast-undo')).toBeVisible();
  await page.locator('.toast-undo').click();
  await expect(page.locator('#cs-logList .log-name').getByText('Apple', { exact: true })).toBeVisible();
});

test('Delete All Data clears guest entries and goals after confirmation', async ({ page }) => {
  await page.addInitScript((appVersion) => {
    localStorage.setItem('calsync_onboarding_done', '1');
    localStorage.setItem('bannerAccepted', 'true');
    localStorage.setItem('healthsync_last_seen_changelog_version_guest', appVersion);
    localStorage.setItem('calsync_v1', JSON.stringify([{ id: 'delete-test' }]));
    localStorage.setItem('dropsync_v3', JSON.stringify([{ id: 'drink-test' }]));
    localStorage.setItem('healthsync_workout_logs', JSON.stringify([{ id: 'workout-test' }]));
    localStorage.setItem('calsync_favourites', JSON.stringify([{ id: 'favorite-test' }]));
    localStorage.setItem('calsync_active_draft', JSON.stringify({ id: 'draft-test' }));
    localStorage.setItem('calsync_goal', '2200');
    localStorage.setItem('dropsync_goal', '3000');
  }, APP_VERSION);
  await page.goto(`${BASE_URL}/dash`);
  await page.locator('#db-openSettingsBtn').click();
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#deleteAllDataBtn').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('calsync_v1'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('dropsync_v3'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('healthsync_workout_logs'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('calsync_favourites'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('calsync_active_draft'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('calsync_goal'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('dropsync_goal'))).toBeNull();
});
