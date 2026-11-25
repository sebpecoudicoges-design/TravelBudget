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
