import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

test('legacy loader distinguishes a fetch failure from partial script evaluation', async ({ page, baseURL }) => {
  const tables = structuredClone(fixtureTables);
  tables.profiles[0].role = 'test';
  tables.transactions = [];
  await installConnectedFixture(page, baseURL, { tables });
  await page.routeWebSocket(url => url.origin === baseURL.replace('http', 'ws'), ws => ws.connectToServer());
  await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
  const match = '**/legacy/js/43_documents_ui.js';
  let requests = 0;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(match, route => {
    requests++;
    if (requests === 1) return route.abort('failed');
    return route.fulfill({
      contentType: 'text/javascript',
      body: 'window.syntheticDocumentsEvaluations = (window.syntheticDocumentsEvaluations || 0) + 1; throw new Error("synthetic documents evaluation failure");',
    });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__TB_BOOT_COMPLETED__ && window.__tbBootReady);
  const attempt = () => page.evaluate(async () => {
    try { await window.tbLoadLegacyDomain('documents'); return 'loaded'; }
    catch (error) { return String(error.message); }
  });
  await expect(page.locator('#wallets-container [data-wallet-id]').first()).toBeVisible();
  expect(await attempt()).toMatch(/Failed to load legacy script/);
  expect(await attempt()).toMatch(/Failed to evaluate legacy script/);
  expect(await attempt()).toMatch(/Failed to evaluate legacy script/);
  expect(await page.evaluate(() => window.syntheticDocumentsEvaluations)).toBe(1);
  expect(await page.evaluate(() => window.tbIsLegacyDomainLoaded('documents'))).toBe(false);
  expect(errors.filter(message => message === 'synthetic documents evaluation failure')).toHaveLength(1);
  expect(requests).toBe(2);

  await page.unroute(match);
  await page.goto('/');
  await page.waitForFunction(() => window.__TB_BOOT_COMPLETED__ && window.__tbBootReady);
  expect(await attempt()).toBe('loaded');
  expect(await page.evaluate(() => window.tbIsLegacyDomainLoaded('documents'))).toBe(true);
  expect(await page.evaluate(() => typeof window.renderDocuments)).toBe('function');
});
