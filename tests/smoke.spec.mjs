import { test, expect, readState, logAttempt, openHistory } from './fixtures.mjs';

test('attempt persists across reload and appears in history', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(new Date('2026-09-05T19:00:00Z'));
  await page.goto('/');
  await logAttempt(page, 'QA persistence');
  await page.reload();
  const state = await readState(page);
  expect(state.log).toHaveLength(1);
  expect(state.log[0]).toMatchObject({ d: '2026-09-05', r: 'cold', n: 'QA persistence' });
  await openHistory(page, state.log[0].pid);
  await expect(page.locator('.history .hnote').filter({ hasText: 'QA persistence' })).toBeVisible();
  await page.locator('.hrow').first()[isMobile ? 'tap' : 'hover']();
  await page.locator('[data-del]').first().click();
  await page.reload();
  expect((await readState(page)).log).toEqual([]);
  expect((await readState(page)).deletedLog).toContain(`i:${state.log[0].i}`);
});

test('local development disables sync and does not expose repository files', async ({ page, request }) => {
  await page.goto('/');
  await page.locator('#syncBtn').click();
  await page.locator('[data-syncon]').click();
  await expect(page.getByText('Sync is disabled in this development server')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ncsr-sync-key'))).toBeNull();
  expect((await request.get('/backend/.env.local')).status()).toBe(404);
  expect((await request.get('/__health')).status()).toBe(200);
});

test('theme and list choice survive reload without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await page.locator('#themeBtn').click();
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.locator('[data-tab="all"]').click();
  await page.locator('[data-tier="75"]').click();
  await page.reload();
  expect((await readState(page)).tier).toBe(75);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
