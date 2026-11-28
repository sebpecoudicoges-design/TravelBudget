import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

for (const { lang, width, theme, beta, note } of [
  { lang: 'fr', width: 1440, theme: 'light', beta: 'BÊTA', note: 'Module en cours de test' },
  { lang: 'en', width: 390, theme: 'dark', beta: 'BETA', note: 'Module in testing' },
]) test(`Only daily modules are marked beta in the nav and on their screens: ${lang} ${width}px`, async ({ page, baseURL }) => {
  const tables = structuredClone(fixtureTables);
  tables.profiles[0].role = 'test';
  tables.settings[0].theme = theme;
  tables.transactions = [];
  await page.setViewportSize({ width, height: 900 });
  await installConnectedFixture(page, baseURL, { tables });
  await page.routeWebSocket(url => url.origin === baseURL.replace('http', 'ws'), ws => ws.connectToServer());
  await page.addInitScript(({ user, lang }) => {
    localStorage.setItem('tb_lang_v1', lang);
    localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1');
  }, { user: fixtureUser, lang });
  await page.goto('/');
  await expect(page.locator('#tb-boot-overlay')).toHaveCount(0);

  const nav = page.locator('#tb-app-navigation');
  const menu = page.locator('#tb-mobile-nav-toggle');
  await expect(nav.locator('.tb-beta-badge')).toHaveCount(3);
  for (const key of ['sport', 'nutrition', 'work']) {
    if (width === 390) await menu.click();
    const tab = nav.locator('#tab-' + key);
    const badge = tab.locator('.tb-beta-badge');
    await expect(badge).toHaveText(beta);
    const contained = await badge.evaluate(el => {
      const { right, left } = el.getBoundingClientRect();
      const button = el.closest('button').getBoundingClientRect();
      return left >= button.left && right <= button.right;
    });
    expect(contained).toBe(true);
    await tab.click();
    const screen = page.locator('#view-' + key + ' .tb-beta-badge');
    await expect(screen).toHaveText(beta);
    await expect(screen).toBeVisible();
    await expect(page.locator('#view-' + key + ' .tb-module-maturity')).toContainText(note);
  }
});
