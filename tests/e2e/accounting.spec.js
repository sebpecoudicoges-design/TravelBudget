import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.setTimeout(60_000);

const html = fs.readFileSync('index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const nav = html.slice(html.indexOf('<div class="tabs app-tabs">'), html.indexOf('<!-- DASHBOARD -->'));
async function setup(page, width = 1440, theme = 'light') {
  await page.setViewportSize({ width, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-01-31T12:00:00'));
  await page.route('**/accounting-test', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><style>${styles}</style></head><body><div class="wrap"><header><h1>TravelBudget</h1></header><div id="kpi"></div>${nav}<div id="view-dashboard"></div><div id="view-validation" class="hidden"></div><div id="view-accounting" class="hidden"><div id="accounting-root"></div></div></div></body></html>` }));
  await page.goto('/accounting-test');
  await page.addStyleTag({ url: '/src/ui/premium-theme.css' });
  await page.evaluate(async theme => {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeResolved = theme;
    window.activeView = 'dashboard'; window.sbUser = { id: 'user-a' }; window.sbRole = 'admin';
    window.TBModuleAccess = await import('/src/core/moduleAccessRules.js');
    const common = { user_id: 'user-a', travel_id: 'trip-a', currency: 'EUR' };
    const tx = { ...common, type: 'expense', category: 'Repas', date_start: '2026-01-05', pay_now: true, wallet_id: 'w', created_at: '2026-01-05T00:00:00Z' };
    window.fixture = {
      transactions: [{ ...tx, id: 'purchase', label: 'Ordinateur', amount: 1200 }, { ...tx, id: 'food', label: '<Repas>', amount: 500 }, { ...tx, id: 'salary', type: 'income', category: 'Salaire', label: 'Salaire', amount: 2000 }, { ...tx, id: 'gross', label: 'Repas Trip brut', amount: 99.7, trip_expense_id: 'te', out_of_budget: true }, { ...tx, id: 'share', label: '[Trip] Repas', amount: 49.85, pay_now: false, is_internal: true, affects_budget: true }],
      wallets: [{ ...common, id: 'w', name: 'Compte principal', balance: 2000 }],
      assets: [{ ...common, id: 'a', name: 'Ordinateur', purchase_value: 1200, residual_value: 0, depreciation_months: 12, purchase_date: '2026-01-01', status: 'active' }],
      asset_owners: [],
      asset_transaction_links: [{ user_id: 'user-a', id: 'l', asset_id: 'a', transaction_id: 'purchase', relation_type: 'purchase' }],
    };
    window.state = { activeTravelId: 'trip-a', user: { baseCurrency: 'EUR' }, travels: [{ id: 'trip-a', name: 'Voyage personnel' }], transactions: window.fixture.transactions };
    window.sb = { from(table) {
      let rows = window.fixture[table] || [];
      const query = {
        select() { return query; }, eq(key, value) { rows = rows.filter(r => r[key] === value); return query; },
        in(key, values) { rows = rows.filter(r => values.includes(r[key])); return query; }, order() { return query; },
        async range(from, to) { if (window.failData) return { error: new Error('offline') }; if (window.delayData) await new Promise(resolve => { (window.pendingData ||= []).push(resolve); }); return { data: rows.slice(from, to + 1) }; },
      }; return query;
    } };
    window.openTxEditModal = id => { window.openedTx = id; };
    window.tbOpenAccounting = async () => {
      const runtime = await import('/src/features/accounting/accountingController.js');
      runtime.installAccountingRuntime(window);
      if (window.activeView === 'accounting') await window.renderAccounting();
    };
    (await import('/src/app/pwa.js')).registerPwa();
  }, theme);
  await page.addScriptTag({ url: '/legacy/js/10_navigation.js' });
  if (await page.locator('#tb-mobile-nav-toggle').isVisible()) await page.locator('#tb-mobile-nav-toggle').click();
  await page.locator('#tab-accounting').click();
  await expect(page.locator('.tb-accounting-kpi').first()).toContainText('1 350,15'.replace(' ', '\u202f'));
}

for (const width of [1440, 900, 600, 390]) for (const theme of ['light', 'dark']) {
  test(`accounting drilldown, balance and settings ${width} ${theme}`, async ({ page }) => {
    await setup(page, width, theme);
    expect((await page.locator('#accounting-root').boundingBox()).width).toBeGreaterThan(width * 0.6);
    await page.screenshot({ path: `test-results/accounting-summary-${width}-${theme}.png`, fullPage: true });
    await page.locator('.tb-accounting-tabs [data-ac-tab="result"]').click();
    await page.getByText('681 · Amortissements', { exact: true }).click();
    await page.locator('[data-ac-source="depreciation:a:2026-01-31"]').click();
    await expect(page.locator('#tb-accounting-detail')).toContainText('100,00 EUR');
    await expect(page.locator('#tb-accounting-detail')).toContainText('Sans mouvement de trésorerie');
    await page.locator('[data-ac-back]').click();
    await expect(page.locator('.tb-accounting-tabs [data-ac-tab="result"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
    await expect(page.locator('.tb-accounting-content')).toContainText('Non disponible');
    await page.getByRole('button', { name: 'Renseigner les soldes' }).click();
    await page.getByLabel('Autres dettes', { exact: true }).fill('300');
    await page.getByLabel('Créances complémentaires', { exact: true }).fill('50');
    await page.locator('[data-ac-mapping]').filter({ has: page.locator('option[value="602"]') }).first().selectOption('602');
    await page.getByRole('button', { name: 'Enregistrer et recalculer' }).click();
    await expect(page.locator('.tb-accounting-status')).toContainText('enregistré');
    await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
    await expect(page.locator('.tb-accounting-content')).toContainText('3\u202f050,30 EUR');
    await page.getByText('Biens à leur valeur nette', { exact: true }).click();
    await expect(page.locator('.tb-accounting-content')).toContainText('Brut 1\u202f200,00 EUR');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (theme === 'dark') expect(await page.locator('.tb-accounting-panel').first().evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgb(255, 255, 255)');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `test-results/accounting-${width}-${theme}.png`, fullPage: true });
    await page.locator('.tb-accounting-tabs [data-ac-tab="entries"]').click();
    await page.locator('[data-ac-source="tx:food"]').click();
    await expect(page.locator('#tb-accounting-detail')).toContainText('<Repas>');
    await page.getByRole('button', { name: 'Ouvrir la transaction', exact: true }).click();
    expect(await page.evaluate(() => window.openedTx)).toBe('food');
    await page.locator('.tb-accounting-tabs [data-ac-tab="settings"]').click();
    await expect(page.getByLabel('Autres dettes', { exact: true })).toHaveValue('300');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `test-results/accounting-settings-${width}-${theme}.png`, fullPage: true });
  });
}

test('scope isolation, persistence, invalid periods and refresh failure', async ({ page }) => {
  await setup(page);
  await page.locator('.tb-accounting-tabs [data-ac-tab="settings"]').click();
  await page.getByLabel('Autres dettes', { exact: true }).fill('42');
  await page.getByRole('button', { name: 'Enregistrer et recalculer' }).click();
  await page.locator('[data-ac-refresh]').click();
  await expect(page.getByLabel('Autres dettes', { exact: true })).toHaveValue('42');
  await page.locator('[name="start"]').fill('2026-02-01');
  await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
  await expect(page.locator('.tb-accounting-status')).toContainText('antérieure');
  await page.evaluate(() => { window.failData = true; });
  await page.locator('[data-ac-refresh]').click();
  await expect(page.locator('.tb-accounting-status')).toContainText('indisponible');
  await page.evaluate(() => { window.failData = false; window.sbUser = { id: 'user-b' }; window.dispatchEvent(new Event('tb:auth_scope_changed')); });
  await expect(page.locator('#accounting-root')).toBeEmpty();
  await page.locator('#tab-accounting').click();
  await expect(page.locator('.tb-accounting-head')).toBeVisible();
  await page.locator('.tb-accounting-tabs [data-ac-tab="settings"]').click();
  await expect(page.getByLabel('Autres dettes', { exact: true })).toHaveValue('');
  await page.evaluate(() => { window.sbRole = 'user'; window.syncTabsForRole(); window.showView('accounting'); });
  await expect(page.locator('#tab-accounting')).toBeHidden();
  await expect(page.locator('#view-validation')).not.toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.activeView)).toBe('validation');
});

test('ignores in-flight data after account change and preserves explicitly dated offline snapshot', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.tbIsOfflineMode = () => true; });
  await page.locator('[data-ac-refresh]').click();
  await expect(page.locator('.tb-accounting-status')).toContainText('Hors ligne');
  await page.evaluate(() => {
    window.tbIsOfflineMode = () => false;
    window.delayData = true;
    window.inFlight = window.renderAccounting();
  });
  await expect.poll(() => page.evaluate(() => window.pendingData?.length)).toBe(4);
  await page.evaluate(async () => {
    window.sbUser = { id: 'user-b' };
    window.dispatchEvent(new Event('tb:auth_scope_changed'));
    window.delayData = false;
    window.pendingData.forEach(resolve => resolve());
    await window.inFlight;
  });
  await expect(page.locator('#accounting-root')).toBeEmpty();
});
