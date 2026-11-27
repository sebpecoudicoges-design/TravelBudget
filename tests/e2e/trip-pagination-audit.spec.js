import { test, expect } from '@playwright/test';
import { fixtureResponse, fixtureTables, fixtureUser, installConnectedFixture, projectOrigin } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

test('Trip does not publish an incomplete page as a balance and recovers linked detail', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  const tripId = 'synthetic-paged-trip';
  const trip = (id, data) => ({ id, trip_id: tripId, ...data });
  const expenses = Array.from({ length: 7 }, (_, i) => trip('expense-' + i, {
    date: '2026-10-' + String(16 + i), amount: i === 6 ? 120 : 10,
    currency: 'EUR', kind: 'expense', label: i === 6 ? 'Dernière dépense du voyage' : 'Paiement fictif ' + i,
    paid_by_member_id: 'me', category: 'Food', transaction_id: null,
  }));
  const last = expenses.at(-1);
  const shareId = 'share-wallet-last';
  const lastTransactionId = 'transaction-wallet-last';
  const tables = {
    ...structuredClone(fixtureTables),
    profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
    transactions: [{
      ...fixtureTables.transactions[0],
      id: lastTransactionId, amount: 60, label: '[Trip] Dernière dépense du voyage',
      trip_share_link_id: shareId, pay_now: false, is_internal: true, paid_at: null,
    }],
    trip_groups: [{ id: tripId, name: 'Voyage pagination fictif', base_currency: 'EUR', user_id: fixtureUser }],
    trip_participants: [trip('part-owner', { auth_user_id: fixtureUser, role: 'owner' })],
    trip_members: [trip('me', { name: 'Voyageur A', auth_user_id: fixtureUser, user_id: fixtureUser }),
      trip('other', { name: 'Voyageur B' })],
    trip_expenses: expenses,
    trip_expense_shares: expenses.flatMap(({ id, amount }) =>
      [trip(id + '-a', { expense_id: id, member_id: 'me', share_amount: amount / 2 }),
        trip(id + '-b', { expense_id: id, member_id: 'other', share_amount: amount / 2 })]),
    trip_expense_budget_links: [trip(shareId, { expense_id: last.id, member_id: 'me', transaction_id: lastTransactionId })],
    trip_settlement_events: [trip('ignored', { amount: 500, currency: 'EUR', cancelled_at: '2026-10-22',
      from_member_id: 'other', to_member_id: 'me' })],
  };
  await installConnectedFixture(page, baseURL, { tables });
  await page.routeWebSocket(url => url.origin === new URL(baseURL).origin.replace(/^http/, 'ws'), ws => ws.connectToServer());
  const observed = [];
  let failSecondPage = true;
  const paged = new Set(['trip_members','trip_expenses','trip_expense_shares','trip_expense_budget_links','trip_settlement_events','transactions']);
  await page.route(url => url.origin === projectOrigin && url.pathname.startsWith('/rest/v1/'), async route => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').at(-1);
    if (req.method() !== 'GET' || !paged.has(table) || !url.searchParams.get('order')?.startsWith('id.asc')) {
      return route.fallback();
    }
    // PostgREST may cap a page below the requested limit. Scope the cap
    // to the actual id-keyset queries, not the app's separate startup reads.
    const cursor = url.searchParams.get('id');
    const after = cursor?.startsWith('gt.') ? cursor.slice(3) : '';
    url.searchParams.set('limit', '3');
    if (failSecondPage && table === 'trip_expense_shares' && after) {
      observed.push({ table, after, failure: true });
      return route.fulfill({ status: 503, json: { message: 'Page Trip temporairement indisponible' } });
    }
    const rows = fixtureResponse(url.href, req.method(), req.headers(), tables);
    observed.push({ table, after, ids: rows.map(r => r.id) });
    return route.fulfill({ json: rows });
  });
  await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
  const root = page.locator('#trip-root');
  async function openTrip() {
    const menu = page.locator('#tb-mobile-nav-toggle');
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
    await page.locator('#tab-trip').click();
  }
  await page.goto('/?freeze=1');
  await openTrip();
  await expect(root).toContainText('Page Trip temporairement indisponible', { timeout: 15_000 });
  await expect(root.locator('.trip-analysis-summary')).toHaveCount(0);
  expect(observed.some(row => row.failure && row.table === 'trip_expense_shares')).toBe(true);

  failSecondPage = false;
  observed.length = 0;
  await page.reload();
  await openTrip();
  const summary = root.locator('.trip-analysis-summary');
  await expect(summary.getByText('Total du trip').locator('..').locator('strong')).toHaveText(/180(?:[,.]00)? EUR/);
  await expect(summary).toContainText(/Voyageur B doit 90(?:[,.]00)? EUR/);
  expect(observed.some(row => row.table === 'trip_expenses' && row.after && row.ids?.includes(last.id))).toBe(true);
  expect(observed.some(row => row.table === 'trip_expense_shares' && row.after && row.ids?.includes(last.id + '-b'))).toBe(true);
  expect(observed.some(row => row.table === 'trip_expense_shares' && row.after && row.ids?.length === 0)).toBe(true);
  expect(observed.some(row => row.table === 'transactions' && row.ids?.includes(lastTransactionId))).toBe(true);
  await expect.poll(() => page.evaluate(id => (window.state?.tripBudgetLinks || [])
    .some(link => link.transactionId === id || link.transaction_id === id), lastTransactionId)).toBe(true);
});
