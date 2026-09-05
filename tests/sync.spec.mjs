// Browser integration with a controlled transport, NOT a Convex runtime test.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import { test, expect, readState, logAttempt, openHistory } from './fixtures.mjs';
import { startDevServer } from '../scripts/lib/dev-server.mjs';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)][0][1];
const names = new Set(['PROBLEMS', 'TIER_INFO', 'lkey', 'kkey', 'validTime', 'normalizePrefTs', 'migrate', 'canonical', 'mergeStates']);
const parts = parse(inline, { ecmaVersion: 'latest' }).body.filter(s =>
  s.type === 'FunctionDeclaration' ? names.has(s.id.name) :
  s.type === 'VariableDeclaration' && s.declarations.some(d => names.has(d.id.name)));
if (parts.length !== names.size) throw new Error('Could not extract client merge helper');
const sandbox = {};
vm.runInNewContext(parts.map(s => inline.slice(s.start, s.end)).join('\n') + '\nthis.merge = mergeStates;', sandbox);

test('two devices converge after offline edits and preserve deletions', async ({ context, isMobile, viewport }) => {
  const app = await startDevServer({ syncUrl: 'http://127.0.0.1:1/sync' });
  const second = await context.browser().newContext({ isMobile, hasTouch: isMobile, viewport, timezoneId: 'America/Los_Angeles' });
  const remote = new Map();
  const key = 'a'.repeat(32);
  let offline = false;
  async function transport(route) {
    if (offline) return route.abort();
    const body = route.request().postDataJSON();
    const merged = sandbox.merge(remote.get(body.key) || {}, body.state);
    remote.set(body.key, JSON.parse(JSON.stringify(merged)));
    await route.fulfill({ json: { state: merged } });
  }
  await context.route('**/sync', transport);
  await second.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await second.route('**/sync', transport);
  try {
    const a = await context.newPage(), b = await second.newPage();
    for (const page of [a, b]) {
      await page.clock.setFixedTime(new Date('2026-09-05T19:00:00Z'));
      await page.goto(`${app.url}/#k=${key}`);
      await expect(page.locator('#syncBtn')).toHaveText('Sync ✓');
    }
    offline = true;
    await logAttempt(a, 'device A');
    await logAttempt(b, 'device B');
    for (const page of [a, b]) {
      await page.locator('#syncBtn').click();
      await page.locator('[data-syncnow]').click();
      await expect(page.locator('#syncBtn')).toHaveText('Sync ⚠');
    }
    offline = false;
    for (const [page, count] of [[a, 1], [b, 2], [a, 2]]) {
      await page.locator('[data-syncnow]').click();
      await expect.poll(async () => (await readState(page)).log.length).toBe(count);
      await expect(page.locator('#syncBtn')).toHaveText('Sync ✓');
    }
    for (const page of [a, b]) expect((await readState(page)).log.map(x => x.n).sort()).toEqual(['device A', 'device B']);
    await openHistory(a, (await readState(a)).log[0].pid);
    await a.locator('.hrow').first()[isMobile ? 'tap' : 'hover']();
    await a.locator('[data-del]').first().click();
    await expect.poll(() => remote.get(key).log.length).toBe(1);
    await b.locator('[data-syncnow]').click();
    await expect.poll(async () => (await readState(b)).log.length).toBe(1);
    expect((await readState(a)).deletedLog).toEqual((await readState(b)).deletedLog);
  } finally { await second.close(); await app.close(); }
});
