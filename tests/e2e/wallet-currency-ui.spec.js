import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, projectOrigin, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

for (const { lang, width, theme, deleteLabel } of [
  { lang: 'fr', width: 1440, theme: 'light', deleteLabel: 'Supprimer la sélection' },
  { lang: 'en', width: 390, theme: 'dark', deleteLabel: 'Delete selected transactions' },
]) test(`Wallet currency list and bulk-delete label in ${lang} at ${width}px`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width, height: 900 });
  const tables = structuredClone(fixtureTables);
  tables.profiles[0].role = 'test';
  Object.assign(tables.settings[0], { theme, base_currency: 'CHF' });
  tables.transactions = tables.transactions.slice(0, 1);
  const fx = await installConnectedFixture(page, baseURL, { tables });
  await page.routeWebSocket(u => u.origin === baseURL.replace('http', 'ws'), ws => ws.connectToServer());
  await page.addInitScript(({ lang, user }) => {
    localStorage.setItem('tb_lang_v1', lang);
    localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1');
  }, { lang, user: fixtureUser });
  const mutations = [];
  await page.route(u => u.origin === projectOrigin, async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() === 'POST' && path === '/rest/v1/wallets') {
      const [row] = req.postDataJSON();
      mutations.push(row);
      tables.wallets.push({ ...row, id: 'synthetic-xpf-wallet' });
      return route.fulfill({ status: 201 });
    }
    return route.fallback();
  });
  await page.goto('/');
  await page.locator('#wallets-container [data-dashboard-action="create-wallet"]').click();
  const dialog = page.locator('.tb-dlg[role=dialog]');
  const currency = dialog.getByLabel('Devise', { exact: true });
  await expect(currency).toHaveJSProperty('tagName', 'SELECT');
  await expect(currency).toHaveValue('CHF');
  await dialog.locator('#tbWName').fill('Voyage Pacifique');
  await currency.selectOption('XPF');
  await currency.press('Enter');
  await expect(dialog).toBeVisible();
  expect(mutations).toHaveLength(0);
  await dialog.locator('#tbWBal').fill('150');
  await dialog.locator('#tbWCreate').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => mutations).toEqual([expect.objectContaining({ name: 'Voyage Pacifique', currency: 'XPF', balance: 150 })]);
  await expect(page.locator('[data-wallet-id="synthetic-xpf-wallet"]').first()).toBeVisible();
  if (width < 600) await page.locator('#tb-mobile-nav-toggle').click();
  await page.locator('#tab-transactions').click();
  const del = page.getByRole('button', { name: deleteLabel, exact: true });
  await expect(del).toBeVisible();
  await expect(del).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(fx.failures.filter(m => !m.includes('/rest/v1/'))).toEqual([]);
});
