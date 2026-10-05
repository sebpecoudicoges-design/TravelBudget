import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.setTimeout(60_000);

const html = fs.readFileSync('index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const nav = html.slice(html.indexOf('<div class="tabs app-tabs">'), html.indexOf('<!-- DASHBOARD -->'));
async function setup(page, width = 1440, theme = 'light') {
  await page.setViewportSize({ width, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-01-31T12:00:00'));
  await page.route('**/accounting-test', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><div class="wrap"><header><h1>TravelBudget</h1></header><div id="kpi"></div>${nav}<div id="view-dashboard"></div><div id="view-validation" class="hidden"></div><div id="view-accounting" class="hidden"><div id="accounting-root"></div></div></div></body></html>` }));
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
  await expect(page.locator('.tb-accounting-kpi').first()).toContainText('1 400,00'.replace(' ', '\u202f'));
}

async function openComplements(page) {
 if (!(await page.locator('#ac-complements').isVisible())) await page.locator('[data-ac-dialog="ac-complements"]').click();
}
async function saveAccountingSettings(page) {
 if (await page.locator('#ac-complements').isVisible()) await page.locator('#ac-complements [data-ac-dialog-close]').click();
 await page.getByRole('button',{name:'Enregistrer et recalculer',exact:true}).click();
}

async function openAccountDetails(page) {
  for (const detail of await page.locator('.tb-accounting-content details').all()) {
    if (await detail.getAttribute('open') === null) await detail.locator(':scope > summary').click();
  }
}

for (const width of [1440, 900, 600, 390]) for (const theme of ['light', 'dark']) {
  test(`accounting drilldown, balance and settings ${width} ${theme}`, async ({ page }) => {
    await setup(page, width, theme);
    expect((await page.locator('#accounting-root').boundingBox()).width).toBeGreaterThan(width * 0.6);
    await page.screenshot({ path: `test-results/accounting-summary-${width}-${theme}.png`, fullPage: true });
    await page.locator('.tb-accounting-tabs [data-ac-tab="result"]').click();
    await page.getByText('681120 · Dotations aux amortissements', { exact: true }).click();
    await page.locator('.tb-accounting-account[open] .tb-accounting-account > summary').click();
    await page.locator('[data-ac-source="depreciation:a:2026-01-31"]').click();
    await expect(page.locator('#tb-accounting-detail')).toContainText('100,00 EUR');
    await expect(page.locator('#tb-accounting-detail')).toContainText('Sans mouvement de trésorerie');
    await page.locator('[data-ac-back]').click();
    await expect(page.locator('.tb-accounting-tabs [data-ac-tab="result"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
    await expect(page.locator('.tb-accounting-content')).toContainText('Écart actif − passif');
    await expect(page.locator('[data-ac-balance-status]')).toHaveAttribute('data-ac-balance-status','calculated');
    await page.getByRole('button', { name: 'Renseigner les soldes' }).click();
    await openComplements(page);
  await page.getByLabel('Autres dettes', { exact: true }).fill('300');
    await page.getByLabel('Créances complémentaires', { exact: true }).fill('50');
    await openComplements(page);
  await page.locator('[name="equityMode"]').selectOption('declared');
  await page.getByLabel('Capital de référence (facultatif)', { exact: true }).fill('3050.30');
    await page.getByLabel('Justificatif ou note (facultatif)', { exact: true }).fill('Inventaire et relevés vérifiés');
    await page.locator('#ac-complements [data-ac-dialog-close]').click();
    await page.locator('[data-ac-mapping]').filter({ has: page.locator('option[value="613220"]') }).first().selectOption('613220');
    await saveAccountingSettings(page);
    await expect(page.locator('.tb-accounting-status')).toContainText('enregistré');
    await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
    await expect(page.locator('.tb-accounting-content')).toContainText('3\u202f050,30 EUR');
    await page.getByText('218310 · Ordinateurs', { exact: true }).click();
    await expect(page.locator('.tb-accounting-content')).toContainText('brut 1\u202f200,00 EUR');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (theme === 'dark') expect(await page.locator('.tb-accounting-panel').first().evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgb(255, 255, 255)');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `test-results/accounting-${width}-${theme}.png`, fullPage: true });
    await page.locator('.tb-accounting-tabs [data-ac-tab="result"]').click();
    await openAccountDetails(page);
    await page.locator('[data-ac-source="tx:food"]').click();
    await expect(page.locator('#tb-accounting-detail')).toContainText('<Repas>');
    await page.getByRole('button', { name: 'Ouvrir la transaction', exact: true }).click();
    expect(await page.evaluate(() => window.openedTx)).toBe('food');
    await page.locator('.tb-accounting-tabs [data-ac-tab="settings"]').click();
    await expect(page.getByLabel('Autres dettes', { exact: true })).toHaveValue('300');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `test-results/accounting-settings-${width}-${theme}.png`, fullPage: true });
    await page.locator('.tb-accounting-tabs [data-ac-tab="chart"]').click();
    await expect(page.locator('.tb-accounting-content')).toContainText('118 comptes');
    await page.locator('.tb-accounting-content details').first().locator(':scope > summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/accounting-chart-${width}-${theme}.png`, fullPage: true });
  });
}

test('scope isolation, persistence, invalid periods and refresh failure', async ({ page }) => {
  await setup(page);
  await page.locator('.tb-accounting-tabs [data-ac-tab="settings"]').click();
  await openComplements(page);
  await page.getByLabel('Autres dettes', { exact: true }).fill('42');
  await saveAccountingSettings(page);
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
  await expect.poll(() => page.evaluate(() => window.pendingData?.length)).toBe(5);
  await page.evaluate(async () => {
    window.sbUser = { id: 'user-b' };
    window.dispatchEvent(new Event('tb:auth_scope_changed'));
    window.delayData = false;
    window.pendingData.forEach(resolve => resolve());
    await window.inFlight;
  });
  await expect(page.locator('#accounting-root')).toBeEmpty();
});

for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`daily FX consolidation and subcategory inference ${width} ${theme}`, async ({ page }) => {
    await setup(page, width, theme);
    await page.route('https://api.frankfurter.dev/v2/rates?**', async route => {
      const url = new URL(route.request().url());
      expect([...url.searchParams.keys()].sort()).toEqual(['base', 'from', 'quotes', 'to']);
      await route.fulfill({ json: [
        { base: 'AUD', quote: 'EUR', date: '2026-01-05', rate: 0.5 },
        { base: 'AUD', quote: 'EUR', date: '2026-01-30', rate: 0.6 },
      ] });
    });
    await page.evaluate(() => {
      window.fixture.transactions.push({ ...window.fixture.transactions[1], id: 'insurance', currency: 'AUD', amount: 100, category: 'Santé', subcategory: 'Assurance santé', label: 'Assurance voyage', wallet_id: 'aud' });
      window.fixture.wallets.push({ ...window.fixture.wallets[0], id: 'aud', name: 'Compte AUD', currency: 'AUD', balance: 1000 });
    });
    await page.locator('[data-ac-refresh]').click();
    await expect(page.locator('.tb-accounting-kpi').first()).toContainText('1\u202f350,00 EUR');
    await expect(page.locator('.tb-accounting-kpi').nth(1)).toContainText('2\u202f740,30 EUR');
    await page.locator('.tb-accounting-tabs [data-ac-tab="result"]').click();
    await page.getByText('616130 · Assurance santé', { exact: true }).click();
    await page.locator('.tb-accounting-account[open] .tb-accounting-account > summary').click();
    await page.locator('[data-ac-source="tx:insurance"]').click();
    await expect(page.locator('#tb-accounting-detail')).toContainText('50,00 EUR');
    await expect(page.locator('#tb-accounting-detail')).toContainText('100,00 AUD');
    await expect(page.locator('#tb-accounting-detail')).toContainText('taux du 2026-01-05');
    await expect(page.locator('#tb-accounting-detail')).toContainText('sous-catégorie');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `test-results/accounting-fx-${width}-${theme}.png`, fullPage: true });
    await page.locator('.tb-accounting-tabs [data-ac-tab="settings"]').click();
    const mapping = page.locator('select[data-ac-mapping*="Assurance santé"]');
    await expect(mapping).toHaveValue('auto');
    await expect(mapping.locator('option:checked')).toContainText('616130');
    await mapping.selectOption('622610');
    await saveAccountingSettings(page);
    await expect(mapping).toHaveValue('622610');
    await page.locator('[data-ac-refresh]').click();
    await expect(mapping).toHaveValue('622610');
    await mapping.selectOption('auto');
    await saveAccountingSettings(page);
    await expect(mapping).toHaveValue('auto');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[name="mode"]').selectOption('native');
    await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
    await page.locator('.tb-accounting-tabs [data-ac-tab="summary"]').click();
    await expect(page.locator('.tb-accounting-kpi').first()).toContainText('1\u202f400,00 EUR');
  });
}

test('missing FX never displays an incomplete sum as a complete result', async ({ page }) => {
  await setup(page);
  await page.route('https://api.frankfurter.dev/v2/rates?**', route => route.fulfill({ status: 422, json: { message: 'Missing currency' } }));
  await page.evaluate(() => window.fixture.transactions.push({ ...window.fixture.transactions[1], id: 'missing', currency: 'XXX', amount: 100 }));
  await page.locator('[data-ac-refresh]').click();
  await expect(page.locator('.tb-accounting-kpi').first()).toContainText('Non disponible');
  await page.locator('.tb-accounting-tabs [data-ac-tab="result"]').click();
    await openAccountDetails(page);
  await page.locator('[data-ac-source="tx:missing"]').click();
  await expect(page.locator('#tb-accounting-detail')).toContainText('100,00 XXX');
  await expect(page.locator('#tb-accounting-detail')).toContainText('Taux FX indisponible');
});

test('one-time enrichment preserves user classification and shows signed subtotals and performance', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const key = 'tb-accounting-v1:user-a:trip-a';
    localStorage.setItem(key, JSON.stringify({ mapping: { '["expense","Repas"]': '602' } }));
    window.fixture.transactions.push({ ...window.fixture.transactions[1], id: 'refund', amount: -500 });
  });
  await page.locator('[data-ac-refresh]').click();
  await expect(page.getByRole('region', { name: 'Indicateurs de performance' })).toBeVisible();
  await expect(page.locator('.tb-accounting-kpi').nth(2)).not.toContainText('Non disponible');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tb-accounting-v1:user-a:trip-a')));
  expect(saved.classificationVersion).toBe(2);
  expect(saved.mapping['["expense","Repas"]']).toBe('602');
  expect(saved.mapping['["income","Salaire",""]']).toBe('758110');
  await page.locator('.tb-accounting-tabs [data-ac-tab="result"]').click();
  await page.getByText('625710 · Restaurants et repas', { exact: true }).click();
  await expect(page.locator('.tb-accounting-account[open] > strong')).toHaveCount(0);
  await expect(page.locator('.tb-accounting-account[open] > summary')).toContainText('0,00 EUR');
  await page.locator('[data-ac-refresh]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tb-accounting-v1:user-a:trip-a')))).toEqual(saved);
});

test('budget dates, real balance reconciliation and removal of internal amounts', async ({ page }) => {
  await setup(page, 390, 'dark');
  await expect(page.locator('[data-ac-tab="entries"]')).toHaveCount(0);
  await page.evaluate(() => {
    window.fixture.transactions.push({ ...window.fixture.transactions[1], id:'budget-rent', category:'Logement', subcategory:'Loyer', label:'Loyer janvier', amount:310, date_start:'2025-12-15', budget_date_start:'2026-01-01', budget_date_end:'2026-01-31' });
  });
  await page.locator('[data-ac-refresh]').click();
  await expect(page.locator('.tb-accounting-kpi').first()).toContainText('1\u202f090,00 EUR');
  await page.locator('.tb-accounting-tabs [data-ac-tab="result"]').click();
  await openAccountDetails(page);
  await expect(page.locator('[data-ac-source="tx:share"]')).toHaveCount(0);
  await page.locator('[data-ac-source="tx:budget-rent"]').click();
  await expect(page.locator('#tb-accounting-detail')).toContainText('2026-01-01 → 2026-01-31');
  await expect(page.locator('#tb-accounting-detail')).toContainText('2025-12-15');
  await page.locator('.tb-accounting-tabs [data-ac-tab="settings"]').click();
  await openComplements(page);
  await page.getByLabel('Autres dettes',{exact:true}).fill('0');
  await page.getByLabel('Créances complémentaires',{exact:true}).fill('0');
  await openComplements(page);
  await page.locator('[name="equityMode"]').selectOption('declared');
  await page.getByLabel('Capital de référence (facultatif)',{exact:true}).fill('2990.30');
  await page.getByLabel('Justificatif ou note (facultatif)',{exact:true}).fill('Inventaire confirmé');
  await saveAccountingSettings(page);
  await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
  await expect(page.locator('[data-ac-balance-status]')).toHaveAttribute('data-ac-balance-status','balanced');
  await expect(page.locator('[data-ac-balance-status]')).toContainText('0,00 EUR');
  await page.locator('.tb-accounting-tabs [data-ac-tab="settings"]').click();
  await openComplements(page);
  await page.locator('[name="equityMode"]').selectOption('declared');
  await page.getByLabel('Capital de référence (facultatif)',{exact:true}).fill('2900');
  await saveAccountingSettings(page);
  await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
  await expect(page.locator('[data-ac-balance-status]')).toHaveAttribute('data-ac-balance-status','unbalanced');
  await expect(page.locator('[data-ac-balance-status]')).toContainText('90,30 EUR');
  await page.locator('.tb-accounting-tabs [data-ac-tab="chart"]').click();
  await expect(page.locator('.tb-accounting-content')).toContainText('118 comptes');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [1440,390]) for (const theme of ['light','dark']) test(`dated debts, funding, repayments and adjustments ${width} ${theme}`, async ({page}) => {
  await setup(page,width,theme);
  await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
  await page.getByRole('button',{name:'Ajouter une dette',exact:true}).click();
  const create=page.locator('#tb-accounting-debts');
  await create.getByLabel('Nom de la dette / créancier').fill('Prêt <famille>');
  await create.getByLabel('Capital dû à la date de départ').fill('2000');
  await create.getByLabel('Date de départ du suivi').fill('2026-01-05');
  await create.getByLabel('Bien lié').selectOption('a');
  await create.locator('[name="originTransactionId"]').selectOption('salary');
  await create.getByRole('button',{name:'Ajouter la dette'}).click();
  const debt=page.locator('[data-ac-debt-id]');
  await expect(debt).toContainText('2\u202f000,00 EUR');
  await expect(debt).toContainText('Prêt <famille>');
  await expect(debt).toContainText('Ordinateur');
  await debt.getByRole('button',{name:'Rembourser',exact:true}).click();
  await debt.locator('[data-ac-repayment] select').selectOption('food');
  await debt.getByLabel('Capital remboursé (EUR)').fill('400');
  await debt.getByRole('button',{name:'Rattacher le remboursement'}).click();
  await expect(debt).toContainText('1\u202f600,00 EUR');
  await debt.getByRole('button',{name:'Ajuster',exact:true}).click();
  await debt.getByLabel('Date de l’ajustement').fill('2026-01-06');
  await debt.getByLabel('Variation signée').fill('-100');
  await debt.getByLabel('Motif de l’ajustement').fill('Remise familiale');
  await debt.getByRole('button',{name:'Enregistrer l’ajustement'}).click();
  await expect(debt).toContainText('1\u202f500,00 EUR');
  await debt.getByRole('button',{name:'Ajuster',exact:true}).click();
  await debt.getByLabel('Date de l’ajustement').fill('2026-01-07');
  await debt.getByLabel('Variation signée').fill('50');
  await debt.getByLabel('Motif de l’ajustement').fill('Correction du relevé');
  await debt.getByRole('button',{name:'Enregistrer l’ajustement'}).click();
  await expect(debt).toContainText('1\u202f550,00 EUR');
  await debt.getByText('Historique daté (3)',{exact:true}).click();
  await expect(debt).toContainText('2026-01-06 · Ajustement manuel : Remise familiale');
  await expect(debt).toContainText('2026-01-07 · Ajustement manuel : Correction du relevé');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`test-results/accounting-debts-${width}-${theme}.png`,fullPage:true});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tb-accounting-v1:user-a:trip-a')));
  expect(saved.debts[0].adjustments).toHaveLength(2);
  expect(saved.debts[0].repayments).toEqual([{transactionId:'food',principal:400}]);
  await page.getByRole('button',{name:'Actualiser',exact:true}).click();
  await expect(debt).toContainText('1\u202f550,00 EUR');
  await page.locator('.tb-accounting-tabs [data-ac-tab="result"]').click();
  await expect(page.locator('.tb-accounting-content')).toContainText('-200,00 EUR');
  await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
  await debt.getByRole('button',{name:'Ajuster',exact:true}).click();
  await debt.getByLabel('Variation signée').fill('-9999');
  await debt.getByLabel('Motif de l’ajustement').fill('Erreur');
  await debt.getByRole('button',{name:'Enregistrer l’ajustement'}).click();
  await expect(page.locator('dialog[open] [data-ac-dialog-status]')).toContainText('Opération refusée');
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await debt.getByText('Historique daté (3)',{exact:true}).click();
  await debt.getByRole('button',{name:'Détacher ce remboursement'}).click();
  await expect(debt).toContainText('1\u202f950,00 EUR');
  await debt.getByText('Corriger cette dette',{exact:true}).click();
  await debt.getByRole('button',{name:'Retirer cette dette du suivi'}).click();
  await expect(debt).toHaveCount(0);
  await expect(page.getByText('Dettes retirées du suivi (1)',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tb-accounting-v1:user-a:trip-a')).archivedDebts[0].adjustments.length)).toBe(2);
});

test('debt storage failure preserves previous state and account change hides its history',async({page})=>{
 await setup(page);
 await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
 await page.getByRole('button',{name:'Ajouter une dette',exact:true}).click();
 const form=page.locator('#tb-accounting-debts');
 await form.getByLabel('Nom de la dette / créancier').fill('Dette privée');
 await form.getByLabel('Capital dû à la date de départ').fill('100');
 await page.evaluate(()=>{window.originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('quota');};});
 await form.getByRole('button',{name:'Ajouter la dette'}).click();
 await expect(page.locator('.tb-accounting-status')).toContainText('Enregistrement local impossible');
 await expect(page.locator('[data-ac-debt-id]')).toHaveCount(0);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalStorageSet;});
 await form.getByRole('button',{name:'Ajouter la dette'}).click();
 await expect(page.locator('[data-ac-debt-id]')).toHaveCount(1);
 await page.evaluate(()=>{window.sbUser={id:'user-b'};window.dispatchEvent(new Event('tb:auth_scope_changed'));});
 await expect(page.locator('#accounting-root')).toBeEmpty();
});

for(const width of [1440,390]) for(const theme of ['light','dark']) test(`operation search and clear balance confirmations ${width} ${theme}`,async({page})=>{
 await setup(page,width,theme);
 await page.evaluate(async()=>{localStorage.setItem('tb-accounting-v1:user-a:trip-a',JSON.stringify({balances:{EUR:{debt:10,receivable:20,equity:30,asOf:'2026-01-30',evidence:'Relevé'}}}));await window.renderAccounting();});
 await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
 await expect(page.locator('.tb-accounting-balance-checks')).toHaveCount(0);
 await expect(page.locator('[data-ac-balance-status]')).toContainText('Capital personnel net');
 await page.getByRole('button',{name:'Ajouter une dette',exact:true}).click();
 const search=page.getByRole('searchbox',{name:'Rechercher : Opération d’origine (facultative)',exact:true});
 const select=page.locator('[name="originTransactionId"]');
 await search.fill('2 000 salaire 05/01/2026');
 await expect(select.locator('option')).toHaveCount(2);
 await select.selectOption('salary');
 await search.fill('aucun résultat possible');
 await expect(select).toHaveValue('salary');
 await expect(page.locator('[data-ac-search-count]')).toContainText('0 résultat(s) · sélection actuelle conservée');
 await select.selectOption('');
 await search.fill('repas 500');
 await expect(select.locator('option')).toHaveCount(2);
 await search.fill('');
 await expect(select.locator('option')).toHaveCount(6);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:`test-results/accounting-search-${width}-${theme}.png`,fullPage:true});
});

test('Trip sources feed net worth once, bank codes classify internals, modal escapes retain focus',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{window.fixture.v_trip_user_net_balances=[{trip_id:'g1',trip_name:'Paris',currency:'EUR',net:120},{trip_id:'g2',trip_name:'Berlin',currency:'EUR',net:-50}];});
 await page.locator('[data-ac-refresh]').click();
 await page.locator('.tb-accounting-tabs [data-ac-tab="balance"]').click();
 await expect(page.locator('[data-ac-balance-status]')).toContainText('3\u202f420,30 EUR');
 await expect(page.locator('.tb-accounting-content')).toContainText('3\u202f370,30 EUR');
 await page.getByRole('button',{name:'Ajouter une dette',exact:true}).click();
 await expect(page.locator('#ac-debt-create')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('#ac-debt-create')).not.toBeVisible();
 await expect(page.getByRole('button',{name:'Ajouter une dette',exact:true})).toBeFocused();
 await page.locator('.tb-accounting-tabs [data-ac-tab="settings"]').click();
 const mapping=page.locator('.tb-accounting-mapping').filter({hasText:'interne · hors résultat'}).locator('select');
 await expect(mapping).toHaveCount(1);await expect(mapping).toHaveValue('auto');
 await expect(mapping.locator('option[value="218310"]')).toHaveCount(1);
 await expect(mapping.locator('option[value="512001"]')).toHaveCount(1);
 await page.locator('.tb-accounting-tabs [data-ac-tab="chart"]').click();
 await expect(page.locator('.tb-accounting-content')).toContainText('512001 · Compte principal');
});
