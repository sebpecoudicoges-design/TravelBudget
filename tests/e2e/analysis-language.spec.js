import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

for (const lang of ['fr', 'en']) for (const width of [390, 1440]) {
  test(`Analyse filters, cadence and detail use ${lang} at ${width}px`, async ({ page, baseURL }) => {
    const en = lang === 'en';
    await page.setViewportSize({ width, height: 900 });
    const tables = {
      ...fixtureTables,
      profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
      transactions: [{ ...fixtureTables.transactions[0], subcategory: 'Fixture subcategory', label: 'Fixture expense' }],
      v_country_budget_reference_latest: [],
    };
    await installConnectedFixture(page, baseURL, { tables });
    await page.routeWebSocket(url => url.origin === baseURL.replace(/^http/, 'ws'), ws => ws.connectToServer());
    await page.addInitScript(({ lang, user }) => {
      localStorage.setItem('tb_lang_v1', lang);
      localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1');
    }, { lang, user: fixtureUser });
    await page.goto('/?freeze=1');
    await expect.poll(() => page.evaluate(() => window.__TB_BOOT_COMPLETED__ === true)).toBe(true);
    const nav = page.locator('#tb-mobile-nav-toggle');
    if (await nav.isVisible()) await nav.click();
    await page.locator('#tab-analysis').click();
    const analyse = page.locator('#view-analysis');
    await expect(analyse.locator('#analysis-period option[value=all]')).toHaveText(en ? 'Whole trip' : 'Tout le voyage');
    await expect(analyse.locator('#analysis-period option[value=active]')).toContainText(en ? 'Active period' : 'Période active');
    await expect(analyse.locator('label[for=analysis-comparison]')).toHaveText(en ? 'Comparison' : 'Comparaison');
    await expect(analyse.locator('#analysis-comparison option[value=previous]')).toHaveText(en ? 'Previous period' : 'Période précédente');
    await expect(analyse.locator('.analysis-insights-card h3')).toHaveText(en ? 'Insights' : 'Points clés');
    const manage = analyse.locator('#analysis-category-toggle');
    await expect(manage).toHaveText(en ? 'Manage' : 'Gérer');
    await expect(analyse.locator('#analysis-category-summary')).toContainText(en ? 'No category excluded' : 'Aucune catégorie exclue');
    await manage.click();
    await expect(manage).toHaveText(en ? 'Hide' : 'Masquer');
    await manage.click();
    await analyse.getByRole('button', { name: en ? 'Details' : 'Détail', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: en ? 'Matching transactions' : 'Transactions correspondantes' });
    await expect(drawer).toContainText('Fixture expense');
    await expect(drawer).toContainText(en ? 'Paid' : 'Payé');
    await expect(drawer.getByRole('button', { name: en ? 'Close' : 'Fermer' })).toBeVisible();
  });
}
