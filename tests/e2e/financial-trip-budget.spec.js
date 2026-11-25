import { test, expect } from '@playwright/test';
import { fixtureTables, fixtureUser, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block', timezoneId: 'UTC', locale: 'fr-FR', actionTimeout: 8000 });

const expenseStart = '2026-10-21';
const expenseEnd = '2026-10-23';
const cashDate = '2026-10-20';
const tripId = 'synthetic-trip';
const expenseId = 'trip-expense';
const seed = fixtureTables.transactions[0];
const wallet = { ...fixtureTables.wallets[0], balance: 500 };
const row = (id, amount, date, overrides) => ({
  ...seed, id, amount,
  date_start: date, date_end: date, paid_at: `${date}T12:00:00Z`,
  budget_date_start: expenseStart, budget_date_end: expenseEnd, ...overrides,
});
const tripRow = (id, fields) => ({ id, trip_id: tripId, ...fields });
const tables = {
  ...fixtureTables,
  wallets: [wallet],
  transactions: [
    row('trip-advance', 120, cashDate, {
      label: '[Trip] Avance - Avance dégustation', trip_expense_id: expenseId,
      affects_budget: false, out_of_budget: true,
    }),
    row('trip-share', 45, cashDate, {
      label: '[Trip] Avance dégustation', trip_share_link_id: 'trip-share-link',
      pay_now: false, is_internal: true, paid_at: null,
    }),
    row('merchant-refund', 15, '2026-10-22', {
      label: 'Avoir part personnelle', type: 'income',
    }),
  ],
  trip_groups: [{ id: tripId, name: 'Trip fictif', base_currency: 'EUR', user_id: fixtureUser }],
  trip_participants: [tripRow('participant-me', { auth_user_id: fixtureUser, role: 'owner' })],
  trip_members: [
    tripRow('me', { name: 'Voyageur A', auth_user_id: fixtureUser, user_id: fixtureUser, created_at: '2026-10-01' }),
    tripRow('other', { name: 'Voyageur B', created_at: '2026-10-02' }),
  ],
  trip_expenses: [tripRow(expenseId, {
    date: cashDate, label: 'Avance dégustation', kind: 'expense', amount: 120, currency: 'EUR',
    category: 'Food', paid_by_member_id: 'me', transaction_id: 'trip-advance',
    budget_date_start: expenseStart, budget_date_end: expenseEnd,
  })],
  trip_expense_shares: [
    tripRow('share-me', { expense_id: expenseId, member_id: 'me', share_amount: 45 }),
    tripRow('share-other', { expense_id: expenseId, member_id: 'other', share_amount: 75 }),
  ],
  trip_expense_budget_links: [tripRow('trip-share-link', {
    expense_id: expenseId, member_id: 'me', transaction_id: 'trip-share',
  })],
  trip_settlement_events: [],
};

async function navigate(page, tab) {
  const item = page.locator(`#tab-${tab}`);
  const menu = page.locator('#tb-mobile-nav-toggle');
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await item.click();
  await expect(page.locator(`#view-${tab}`)).toBeVisible();
}

for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`wallet → Trip → budget → Analyse (${width}px, ${theme})`, async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const scopedTables = {
      ...tables,
      profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
      settings: fixtureTables.settings.map(setting => ({ ...setting, theme })),
    };
    await installConnectedFixture(page, baseURL, { tables: scopedTables });
    await page.routeWebSocket(url => url.origin === new URL(baseURL).origin.replace(/^http/, 'ws'), ws => ws.connectToServer());
    // Represent a returning user, separate from the first-run onboarding tests.
    await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
    await page.goto('/?freeze=1');
    const account = page.locator(`#wallets-container [data-wallet-id="${wallet.id}"]`).first();
    await expect(account.locator('.tb-wallet-card-main p strong').first()).toHaveText(/^395[,.]00(?:\s*(?:EUR|€))?$/);
    await expect(page.locator('body')).toHaveClass(new RegExp(`theme-${theme}`));

    const budget = page.locator('#daily-budget-container');
    await budget.locator('#db-today').click();
    for (const date of ['2026-10-21', '2026-10-22', '2026-10-23']) {
      const day = budget.locator('.day').filter({ hasText: date });
      await expect(day.locator('.row b').first()).toHaveText('−10 EUR');
      await expect(day.locator('.details')).not.toContainText('120 EUR');
    }

    await navigate(page, 'trip');
    const trip = page.locator('.trip-analysis-summary');
    await expect(trip.getByText('Total du trip').locator('..').locator('strong')).toHaveText(/120(?:[,.]00)? EUR/);
    await expect(trip).toContainText(/Voyageur B doit 75(?:[,.]00)? EUR/);
    const traveller = page.locator('.trip-analysis-card .trip-analysis-row').filter({ hasText: 'Voyageur A' });
    await expect(traveller).toContainText(/Part due\s*45(?:[,.]00)? EUR/);

    await navigate(page, 'analysis');
    const summary = page.locator('#analysis-summary');
    await expect(summary).toContainText(/Avoirs déduits\s*:\s*15[,.]00/);
    await expect(summary.locator('.analysis-stat--glass-blue .analysis-stat-value').first()).toContainText(/^30[,.]00/);

    // Moving the cash filter past the posting day hides the payment, even while
    // its 21–23 October budget allocations are still in the selected window.
    await page.locator('#analysis-scope').selectOption('all');
    await page.locator('#analysis-period').selectOption('range');
    await page.locator('#analysis-range-start').fill('2026-10-20');
    await page.locator('#analysis-range-end').fill('2026-10-22');
    const outflow = summary.locator('.analysis-stat--cash-only').getByText('Sorties payees').locator('..');
    await expect(outflow).toHaveText(/Sorties payees\s*120[,.]00/);
    await page.locator('#analysis-range-start').fill('2026-10-21');
    await expect(outflow).toHaveText(/Sorties payees\s*0[,.]00/);
  });
}

for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`records and cancels a two-currency Trip reimbursement (${width}px, ${theme})`, async ({ page, baseURL }) => {
    test.setTimeout(75_000);
    await page.setViewportSize({ width, height: 900 });
    const audWallet = { ...wallet, id: 'wallet-aud', currency: 'AUD', name: 'Compte AUD fictif' };
    const scopedTables = {
      ...structuredClone(tables),
      profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
      settings: fixtureTables.settings.map(setting => ({ ...setting, theme })),
      wallets: [wallet, audWallet],
    };
    const requests = [];
    await installConnectedFixture(page, baseURL, { tables: scopedTables });
    await page.routeWebSocket(url => url.origin === new URL(baseURL).origin.replace(/^http/, 'ws'), ws => ws.connectToServer());
    // Simulate PostgREST responses while exercising the actual modal, repository,
    // refresh, and render paths. No live requests or real accounts.
    await page.route('**/rest/v1/rpc/trip_apply_settlement_v2', async route => {
      const data = route.request().postDataJSON();
      requests.push(data);
      const id = data.p_event_id;
      if (!scopedTables.trip_settlement_events.some(event => event.id === id)) {
        scopedTables.trip_settlement_events.push(tripRow(id, {
          amount: data.p_amount, currency: data.p_currency, from_member_id: data.p_from_member_id,
          to_member_id: data.p_to_member_id, created_by: fixtureUser, created_at: '2026-10-24T03:00:00Z',
          transaction_id: id,
        }));
        scopedTables.transactions.push(row(id, data.p_wallet_amount, data.p_date, {
          wallet_id: data.p_wallet_id, currency: data.p_wallet_currency, type: 'income',
          affects_budget: false, out_of_budget: true, category: 'Mouvement interne',
          label: `[Trip] SETTLE:${id} • Règlement reçu de Voyageur B`,
          budget_date_start: data.p_date, budget_date_end: data.p_date,
        }));
      }
      // A committed write with a lost acknowledgment must reuse the same request ID.
      if (requests.length === 1) return route.abort('connectionreset');
      return route.fulfill({ json: id });
    });
    await page.route('**/rest/v1/rpc/trip_cancel_settlement_v1', async route => {
      const { p_event_id: id } = route.request().postDataJSON();
      const event = scopedTables.trip_settlement_events.find(item => item.id === id);
      if (!event) return route.fulfill({ status: 404, json: { message: 'Unknown settlement' } });
      event.cancelled_at = '2026-10-24T03:05:00Z';
      scopedTables.transactions = scopedTables.transactions.filter(tx => tx.id !== event.transaction_id);
      event.transaction_id = null;
      return route.fulfill({ status: 204 });
    });
    await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
    await page.goto('/');
    const account = page.locator(`#wallets-container [data-wallet-id="${audWallet.id}"] .tb-wallet-card-main p strong`).first();
    await expect(account).toHaveText(/^500[,.]00/);
    await expect(page.locator('body')).toHaveClass(new RegExp(`theme-${theme}`));
    await navigate(page, 'trip');
    const trip = page.locator('.trip-analysis-summary');
    await expect(trip).toContainText(/Voyageur B doit 75(?:[,.]00)? EUR/);
    await page.getByRole('button', { name: 'Je reçois de Voyageur B' }).click();
    await page.locator('#tripSettleWallet').selectOption(wallet.id);
    await expect(page.locator('#tripSettleDebtAmount')).toBeHidden();
    await page.locator('#tripSettleWallet').selectOption(audWallet.id);
    await expect(page.locator('#tripSettleAmount')).toHaveValue('');
    await expect(page.locator('#tripSettleDebtAmount')).toBeVisible();
    await page.locator('#tripSettleAmount').fill('40');
    await page.locator('#tripSettleDebtAmount').fill('25');
    const submit = page.locator('#tripSettleConfirm');
    await submit.click();
    await expect.poll(() => requests.length).toBe(1);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[0]).toMatchObject({ p_amount: 25, p_currency: 'EUR', p_wallet_amount: 40, p_wallet_currency: 'AUD' });
    expect(requests[1]).toEqual(requests[0]);
    await expect(trip).toContainText(/Voyageur B doit 50(?:[,.]00)? EUR/);
    await navigate(page, 'dashboard');
    await expect(account).toHaveText(/^540[,.]00/);

    await page.reload();
    await expect(account).toHaveText(/^540[,.]00/);
    await navigate(page, 'trip');
    await expect(trip).toContainText(/Voyageur B doit 50(?:[,.]00)? EUR/);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-cancel-settle]').click();
    await expect(trip).toContainText(/Voyageur B doit 75(?:[,.]00)? EUR/);
    await expect(page.locator('[data-cancel-settle]')).toHaveCount(0);
    await navigate(page, 'dashboard');
    await expect(account).toHaveText(/^500[,.]00/);
  });
}

for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
  test(`Analyse masks incomplete totals and the previous comparison only when needed (${width}px, ${theme})`, async ({ page, baseURL }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const expense = (id, amount, date, currency) => row(id, amount, date, {
      currency, label: id, budget_date_start: date, budget_date_end: date,
    });
    const fxTables = {
      ...fixtureTables,
      profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
      settings: fixtureTables.settings.map(setting => ({ ...setting, theme })),
      budget_segments: [
        { ...fixtureTables.budget_segments[0], end_date: '2026-10-22' },
        { ...fixtureTables.budget_segments[0], id: 'later-aud', sort_order: 1, start_date: '2026-10-23', base_currency: 'AUD', eur_base_rate_fixed: 1.65 },
      ],
      transactions: [
        expense('Known EUR', 30, '2026-10-23', 'EUR'),
        expense('Known AUD', 33, '2026-10-24', 'AUD'),
        expense('Missing conversion fixture', 100, '2026-10-22', 'ZFX'),
      ],
    };
    await installConnectedFixture(page, baseURL, { tables: fxTables });
    await page.routeWebSocket(url => url.origin === new URL(baseURL).origin.replace(/^http/, 'ws'), ws => ws.connectToServer());
    await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
    await page.goto('/?freeze=1');
    await navigate(page, 'analysis');
    await page.locator('#analysis-scope').selectOption('all');
    await page.locator('#analysis-currency').selectOption('account');
    await page.locator('#analysis-period').selectOption('range');
    const start = page.locator('#analysis-range-start');
    const end = page.locator('#analysis-range-end');
    const summary = page.locator('#analysis-summary');
    const comparison = page.locator('#analysis-period-comparison');
    const chart = page.locator('#analysis-trajectory-chart');
    await start.fill('2026-10-23');
    await end.fill('2026-10-24');
    await expect(summary.locator('.analysis-stat--glass-blue .analysis-stat-value').first()).toContainText(/^50[,.]00/);
    await expect(chart).toBeVisible();
    await page.locator('#analysis-comparison').selectOption('previous');
    await expect(comparison.getByRole('status')).toContainText('taux de change manquant');
    await expect(summary.locator('.analysis-stat--glass-blue .analysis-stat-value').first()).toContainText(/^50[,.]00/);

    await start.fill('2026-10-22');
    await expect(summary.getByRole('status')).toContainText('ZFX → EUR');
    await expect(summary.locator('.analysis-stat-value')).toHaveCount(0);
    await expect(comparison).toBeEmpty();
    await expect(chart).toBeHidden();
    await expect(start).toBeVisible();

    await start.fill('2026-10-23');
    await expect(summary.getByRole('status')).toHaveCount(0);
    await expect(chart).toBeVisible();
    await expect(comparison.getByRole('status')).toContainText('taux de change manquant');
  });
}

for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
  test(`Analyse isolates a missing rate for the optional country reference (${width}px, ${theme})`, async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const referenceTables = {
      ...fixtureTables,
      profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
      settings: fixtureTables.settings.map(setting => ({ ...setting, theme })),
      budget_segments: [{ ...fixtureTables.budget_segments[0], id: '55555555-5555-4555-8555-555555555555' }],
      transactions: [['previous', 60, '2026-10-22'], ['current', 50, '2026-10-23']].map(([id, amount, date]) =>
        row(id, amount, date, { budget_date_start: date, budget_date_end: date })),
    };
    await installConnectedFixture(page, baseURL, { tables: referenceTables });
    await page.routeWebSocket(url => url.origin === new URL(baseURL).origin.replace(/^http/, 'ws'), ws => ws.connectToServer());
    let referenceCurrency = 'ZFX';
    await page.route('**/rest/v1/rpc/rpc_budget_reference_resolve_for_budget_segment', route => route.fulfill({
      json: [{ currency_code: referenceCurrency, recommended_daily_amount: 35, recommended_food_daily_amount: 35 }],
    }));
    await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
    // The synthetic HTTP fixture intercepts all Supabase requests; freeze blocks even read-only RPCs.
    await page.goto('/');
    await navigate(page, 'analysis');
    await page.locator('#analysis-period').selectOption('range');
    await page.locator('#analysis-range-start').fill('2026-10-23');
    await page.locator('#analysis-range-end').fill('2026-10-24');
    await page.locator('#analysis-comparison').selectOption('previous');

    const summary = page.locator('#analysis-summary');
    const reference = page.locator('#analysis-reference-summary');
    const insights = page.locator('#analysis-insights');
    await expect(reference.getByRole('status')).toContainText('ZFX → EUR');
    await expect(summary.locator('.analysis-stat--glass-blue .analysis-stat-value').first()).toContainText(/^50[,.]00/);
    await expect(summary).not.toContainText(/Rythme référence pays|Vs référence pays/);
    await expect(insights).not.toContainText(/comparable sourcé|Réel au-dessus du sourcé|Réel sous le sourcé/);
    await expect(page.locator('#analysis-trajectory-chart')).toBeVisible();
    await expect(page.locator('#analysis-period-comparison')).toContainText('COMPARAISON DE RYTHME');
    expect(await page.evaluate(() => window.tbGetBudgetAnalysisNotificationSummary())).toMatchObject({
      spentToToday: 50, deltaReferenceAmount: null, paceReferencePct: null,
    });

    referenceCurrency = 'EUR';
    await page.locator('#analysis-refresh').click();
    await expect(reference.getByRole('status')).toHaveCount(0);
    await expect(reference.getByText('Sourcé / jour')).toBeVisible();
    await expect(summary).toContainText('Vs référence pays');
    expect(await page.evaluate(() => window.tbGetBudgetAnalysisNotificationSummary())).toMatchObject({ referencePerDay: 35 });
  });
}

for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
  test(`Analyse exposes every category and its transactions (${width}px, ${theme})`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const date = '2026-10-23';
    const category = 'Remboursements fictifs';
    const label = 'Avoir catégorie 14';
    const categoryTables = {
      ...fixtureTables,
      profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
      settings: fixtureTables.settings.map(setting => ({ ...setting, theme })),
      transactions: [
        ...Array.from({ length: 13 }, (_, idx) => row(`cat-${idx}`, idx + 1, date, {
          category: `Poste fictif ${idx + 1}`, budget_date_start: date, budget_date_end: date,
        })),
        row('cat-before-refund', 1, date, { category, budget_date_start: date, budget_date_end: date }),
        row('cat-refund', 8, date, {
          type: 'income', category, label, budget_date_start: date, budget_date_end: date,
        }),
      ],
    };
    await installConnectedFixture(page, baseURL, { tables: categoryTables });
    await page.routeWebSocket(url => url.origin === new URL(baseURL).origin.replace(/^http/, 'ws'), ws => ws.connectToServer());
    await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
    await page.goto('/?freeze=1');
    await navigate(page, 'analysis');
    await page.locator('#analysis-period').selectOption('range');
    await page.locator('#analysis-scope').selectOption('all');
    await page.locator('#analysis-range-start').fill(date);
    await page.locator('#analysis-range-end').fill(date);

    const host = page.locator('#analysis-category-bars-chart');
    await expect.poll(() => host.evaluate(el =>
      window.echarts?.getInstanceByDom(el)?.getOption()?.yAxis?.[0]?.data?.length,
    )).toBe(14);
    expect(await host.evaluate(el => window.echarts.getInstanceByDom(el).getOption().series[0].data[0].value)).toBe(-7);
    const pie = page.locator('#analysis-category-chart');
    await expect(page.locator('#analysis-category-pie-note')).toContainText('dépense nette positive');
    const pieState = await pie.evaluate(el => {
      const chart = window.echarts.getInstanceByDom(el);
      const [series] = chart.getOption().series;
      return { data: series.data, largestShare: chart.getModel().getSeriesByIndex(0).getDataParams(0).percent };
    });
    expect(pieState.data).toHaveLength(9);
    expect(pieState.data.reduce((sum, row) => sum + row.value, 0)).toBe(91);
    expect(pieState.data.at(-1)).toMatchObject({ value: 15, grouped: true });
    expect(pieState.largestShare).toBeCloseTo(100 * 13 / 91, 1);
    const region = host.locator('..');
    await region.focus();
    await page.keyboard.press('End');
    await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThan(0);

    const picker = page.locator('#analysis-category-drilldown');
    await expect(picker.locator('option')).toHaveCount(15);
    await expect(picker.locator('option').last()).toContainText(/Remboursements fictifs.*-7/);
    await picker.selectOption(category);
    const open = page.locator('#analysis-category-open');
    await open.focus();
    await page.keyboard.press('Enter');
    const drilldown = page.locator('#tb-analysis-tx-drilldown');
    await expect(drilldown).toContainText(label);
    await expect(drilldown.locator('[data-close]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drilldown).toHaveCount(0);
    await expect(open).toBeFocused();
    await page.locator('#analysis-category-filter').selectOption(category);
    await expect(page.locator('#analysis-category-pie-note')).toContainText('Aucune catégorie à dépense nette positive');
    expect(await pie.evaluate(el => window.echarts.getInstanceByDom(el).getOption().series[0].data)).toEqual([]);
    await expect(picker.locator('option').last()).toContainText(/Remboursements fictifs.*-7/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
