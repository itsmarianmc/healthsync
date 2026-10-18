import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

async function openHistory(page: Page) {
    await page.goto(`${BASE_URL}/drinks`);
    await page.locator('#ds-openHistoryBtn').click();
    await expect(page.locator('#ds-historyOverlay')).toHaveClass(/\bvisible\b/);
    await page.waitForTimeout(500);
}

async function expectAverageInsideChart(page: Page, chartSelector: string) {
    const bounds = await page.locator(chartSelector).evaluate(chart => {
        const card = chart.getBoundingClientRect();
        const average = chart.querySelector('.week-chart-avg-row')!.getBoundingClientRect();
        const next = chart.nextElementSibling?.getBoundingClientRect();
        return { cardBottom: card.bottom, averageBottom: average.bottom, nextTop: next?.top };
    });
    expect(bounds.averageBottom).toBeLessThanOrEqual(bounds.cardBottom - 1);
    if (bounds.nextTop !== undefined) expect(bounds.nextTop).toBeGreaterThanOrEqual(bounds.cardBottom);
}

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
        localStorage.setItem('calsync_onboarding_done', '1');
        localStorage.setItem('bannerAccepted', 'true');
        localStorage.setItem('cookieSettings', JSON.stringify({ analytics: false, preferences: false, thirdparty: false, marketing: false }));
    });
});

test('shows seven zero days, a neutral average and the empty state with a zero goal', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('dropsync_v3', '[]');
        localStorage.setItem('dropsync_goal', '0');
    });
    await openHistory(page);

    const chart = page.locator('#ds-historyList .ds-week-chart');
    await expect(chart.locator('.week-chart-col')).toHaveCount(7);
    await expect(chart.locator('button')).toHaveCount(0);
    await expect(chart.locator('.week-chart-val')).toHaveText(Array(7).fill('0 ml'));
    await expect(chart.locator('.week-chart-day').last()).toHaveText('Today');
    await expect(chart.locator('.week-chart-goal-line')).toHaveCount(0);
    await expect(chart.locator('.ds-week-neutral')).toHaveCount(1);
    await expect(chart.locator('.week-chart-avg-row')).toContainText('7-day avg: 0 ml');
    await expect(page.locator('#ds-historyList .empty-state')).toContainText('No entries yet.');
    await expectAverageInsideChart(page, '.ds-week-chart');

    const normalHeight = await page.locator('#ds-historyModal').evaluate(el => el.getBoundingClientRect().height);
    const handle = await page.locator('#ds-historyHandleZone').boundingBox();
    expect(handle).not.toBeNull();
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2 - 170, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => page.locator('#ds-historyModal').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(normalHeight + 100);
    await expectAverageInsideChart(page, '.ds-week-chart');
});

test('totals local days, divides the average by seven and caps color at 200%', async ({ page }) => {
    await page.addInitScript(() => {
        const amounts = [250, 500, 1000, 1500, 2000, 2500];
        const today = new Date();
        const entries = amounts.map((amount, i) => {
            const day = new Date(today);
            day.setDate(today.getDate() - (6 - i));
            return { id: `drink-${i}`, drink: 'Water', emoji: 'fa-solid fa-glass-water', amount, ts: day.getTime(), date: day.toDateString() };
        });
        localStorage.setItem('dropsync_v3', JSON.stringify(entries));
        localStorage.setItem('dropsync_goal', '1000');
    });
    await openHistory(page);

    const chart = page.locator('#ds-historyList .ds-week-chart');
    const cols = chart.locator('.week-chart-col');
    await expect(cols).toHaveCount(7);
    await expect(chart.locator('.week-chart-val')).toHaveText(['250 ml', '500 ml', '1,0 L', '1,5 L', '2,0 L', '2,5 L', '0 ml']);
    await expect(chart.locator('.week-chart-avg-row')).toContainText('7-day avg: 1,1 L');
    const colors = await cols.evaluateAll(elements => elements.map(el => getComputedStyle(el.querySelector('.week-chart-bar-fill')!).backgroundColor));
    expect(colors).toEqual(Array(7).fill('rgb(90, 200, 250)'));
    await expect(chart.locator('.week-chart-avg-row strong')).toHaveClass(/ds-week-green-dark/);
    const aboveGoalColor = await chart.locator('.week-chart-avg-row strong').evaluate(el => getComputedStyle(el).color);
    await expect(chart.locator('.week-chart-goal-line')).toHaveCount(7);
    await expect(chart.locator('.week-chart-goal-line').first()).toHaveCSS('bottom', '30px');
    await expect(chart.locator('.week-chart-goal-line').first()).toHaveCSS('border-top-style', 'dashed');
    expect(await chart.locator('.week-chart-goal-line').first().evaluate(el => getComputedStyle(el).borderTopColor)).not.toBe(colors[0]);
    const heights = await cols.evaluateAll(elements => elements.map(el => el.querySelector('.week-chart-bar-fill')!.getBoundingClientRect().height));
    expect(heights[5]).toBeGreaterThan(heights[3]);
    expect(heights[3]).toBeGreaterThan(heights[1]);
    expect(heights[1]).toBeGreaterThan(heights[6]);
    await expectAverageInsideChart(page, '.ds-week-chart');

    await page.evaluate(() => { localStorage.setItem('dropsync_goal', '2000'); window.dispatchEvent(new Event('storage')); });
    await expect(chart.locator('.week-chart-avg-row strong')).toHaveClass(/ds-week-yellow-green/);
    expect(await chart.locator('.week-chart-avg-row strong').evaluate(el => getComputedStyle(el).color)).not.toBe(aboveGoalColor);
    await page.evaluate(() => { localStorage.setItem('dropsync_goal', '500'); window.dispatchEvent(new Event('storage')); });
    await expect(chart.locator('.week-chart-avg-row strong')).toHaveCSS('--ds-week-mix', '100%');
    const cappedColor = await chart.locator('.week-chart-avg-row strong').evaluate(el => getComputedStyle(el).color);
    await page.evaluate(() => { localStorage.setItem('dropsync_goal', '200'); window.dispatchEvent(new Event('storage')); });
    await expect(chart.locator('.week-chart-avg-row strong')).toHaveCSS('--ds-week-mix', '100%');
    expect(await chart.locator('.week-chart-avg-row strong').evaluate(el => getComputedStyle(el).color)).toBe(cappedColor);
    expect(await cols.evaluateAll(elements => elements.map(el => getComputedStyle(el.querySelector('.week-chart-bar-fill')!).backgroundColor))).toEqual(colors);
    await expect(page.locator('#ds-historyList .log-date-header')).toHaveCount(6);
    await expect(page.locator('#ds-historyList .log-item')).toHaveCount(6);
    await expect(page.locator('#ds-historyList .empty-state')).toHaveCount(0);
    const scrollTop = await page.locator('#ds-historyList').evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
    expect(scrollTop).toBeGreaterThan(0);
    await page.locator('#ds-historyOverlay').dispatchEvent('click');
    await expect(page.locator('#ds-historyOverlay')).not.toHaveClass(/\bvisible\b/);
    await expect(page.locator('#ds-openHistoryBtn')).toBeVisible();
});

test('keeps the CalSync average inside its chart at the same viewport', async ({ page }) => {
    await page.goto(`${BASE_URL}/food`);
    await page.locator('#cs-openHistoryBtn').click();
    await expect(page.locator('#historyOverlay')).toHaveClass(/\bvisible\b/);
    await expectAverageInsideChart(page, '#historyList .week-chart');
});
