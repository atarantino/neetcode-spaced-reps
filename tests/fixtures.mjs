import { test as base, expect } from '@playwright/test';
import { startDevServer } from '../scripts/lib/dev-server.mjs';
export const test = base.extend({
  app: [async ({}, use) => {
    const app = await startDevServer();
    try { await use(app); } finally { await app.close(); }
  }, { scope: 'worker' }],
  baseURL: async ({ app }, use) => use(app.url),
  diagnostics: [async ({ context }, use, testInfo) => {
    const messages = [], errors = [], external = [];
    // No accidental production calls; optional CDNs are unavailable in this smoke suite.
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      if (url.hostname.endsWith('.convex.site')) external.push(url.origin);
      return route.abort();
    });
    context.on('page', page => {
      page.on('console', msg => messages.push(`${msg.type()}: ${msg.text()}`));
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', req => messages.push(`request failed: ${new URL(req.url()).origin}${new URL(req.url()).pathname}`));
    });
    await use();
    await testInfo.attach('browser-log', { body: messages.join('\n'), contentType: 'text/plain' });
    expect(errors, 'Uncaught browser errors').toEqual([]);
    expect(external, 'Production sync requests').toEqual([]);
  }, { auto: true }],
});
export { expect };
export const readState = page => page.evaluate(() => JSON.parse(localStorage.getItem('ncsr-v1')));
export async function logAttempt(page, note) {
  await page.locator('[data-toggle]').first().click();
  const form = page.locator('[data-form]').filter({ has: page.locator('[data-save]') }).first();
  await form.locator('[data-res="cold"]').click();
  await form.locator('[data-notes]').fill(note);
  await form.locator('[data-save]').click();
}

export async function openHistory(page, pid) {
  await page.locator('[data-tab="all"]').click();
  const name = await page.evaluate(id => PROBLEMS.find(p => p.id === id).name, pid);
  await page.locator('#searchBox').fill(name);
  await page.locator(`[data-row="${pid}"]`).click();
  await page.getByText(/^History \(/).click();
}
