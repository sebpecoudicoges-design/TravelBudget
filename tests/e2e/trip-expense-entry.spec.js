import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, fixtureTime, projectOrigin, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block', timezoneId: 'UTC', locale: 'fr-FR' });

test('Trip form: a 60 NZD advance debits cash once and budgets only the personal share', async ({ page, baseURL }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const base = baseURL;
  const day = fixtureTime.slice(0, 10);
  const tripId = '3e5aded3-109f-455d-af81-06a447915b2d';
  const me = '3e5aded3-109f-455d-af81-06a447915b2f';
  const friend = '3e5aded3-109f-455d-af81-06a447915b30';
  const exp = '3e5aded3-109f-455d-af81-06a447915b31';
  const wallet = { ...fixtureTables.wallets[0], name: 'Carte voyage', currency: 'NZD', balance: 300 };
  const tables = {
   ...structuredClone(fixtureTables),
   profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
   settings: [{ ...fixtureTables.settings[0], base_currency:'NZD', theme:'dark' }],
   travels: [{ ...fixtureTables.travels[0], name: 'Week-end à Taupō', base_currency:'NZD', start_date:'2026-10-23', end_date:'2026-10-25' }],
   periods: [{ ...fixtureTables.periods[0], name:'Taupō', base_currency:'NZD', eur_base_rate:1.95, daily_budget_base:150, start_date:'2026-10-23', end_date:'2026-10-25' }],
   budget_segments: [{ ...fixtureTables.budget_segments[0], base_currency:'NZD', eur_base_rate_fixed:1.95, daily_budget_base:150, start_date:'2026-10-23', end_date:'2026-10-25' }],
   categories: [{ ...fixtureTables.categories[0], name:'Repas', color:'#e77d54', icon:'🍽️' }],
   wallets:[wallet],
   fx_manual_rates:[{ user_id:fixtureUser, base_currency:'EUR', currency:'NZD', rate:1.95 }],
   transactions: [],
   trip_groups:[{ id:tripId, name:'Week-end à Taupō', base_currency:'NZD', user_id:fixtureUser }],
   trip_participants:[{ id:'participant-me', trip_id:tripId, auth_user_id:fixtureUser, role:'owner' }],
   trip_members:[
    { id:me, trip_id:tripId, name:'Camille', auth_user_id:fixtureUser, user_id:fixtureUser, created_at:'2026-10-01' },
    { id:friend, trip_id:tripId, name:'Alex', created_at:'2026-10-02' },
   ],
   trip_expenses:[], trip_expense_shares:[], trip_expense_budget_links:[],
   trip_settlement_events:[], trip_expense_documents:[], trip_settlements:[], trip_payer_approvals:[],
   v_wallet_balances:[], budget_segment_budget_reference_override:[], v_country_budget_reference_latest:[], travel_budget_reference_profile:[], v_transaction_analytic_expenses:[], fx_rates:[],
  };

  const failures = [];
  const routeFixture = await installConnectedFixture(page, base, { tables });
  await page.routeWebSocket(u => u.origin === base.replace('http', 'ws'), ws => ws.connectToServer());
  await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
  await page.route(u => u.origin === projectOrigin, async route => {
   const req = route.request(), u = new URL(req.url()), path = u.pathname, method = req.method();
   if (path === '/functions/v1/fx-latest' && method === 'POST') return route.fulfill({json:{base:'EUR', date:day, rates:{EUR:1,NZD:1.95}}});
   if (['GET','HEAD'].includes(method)) return route.fallback();
   const data = req.postDataJSON();
   if (method === 'POST' && path === '/rest/v1/rpc/trip_pending_invites_for_current_user') return route.fulfill({json:[]});
   if (method === 'POST' && ['/rest/v1/rpc/bind_trip_member_to_auth','/rest/v1/rpc/trip_bind_member_to_auth','/rest/v1/app_error_logs','/rest/v1/rpc/trip_request_payer_approval'].includes(path)) return route.fulfill({status:204});
   const put = (table,row) => tables[table].push(row);
   if (method === 'POST' && path === '/rest/v1/rpc/trip_apply_expense_v2') {
    const d = data.p_payload;
    if (data.p_trip_id !== tripId || d.amount !== 60 || d.currency !== 'NZD' || d.shares?.length !== 2 || d.shares.some(s => s.share_amount !== 30)) throw Error('unexpected trip payload');
    put('trip_expenses', { ...d, id:exp, trip_id:tripId, created_at:fixtureTime });
    d.shares.forEach((s,i)=>put('trip_expense_shares',{ ...s, id:'demo-share-'+i, trip_id:tripId, expense_id:exp }));
    return route.fulfill({json:[{expense_id:exp}]});
   }
   if (method === 'POST' && path === '/rest/v1/rpc/apply_transaction_v2') {
    const id = 'c16e6845-1f2d-4c8f-9873-c9996868c20' + tables.transactions.length;
    const mapped = Object.fromEntries(Object.entries(data).map(([k,v])=>[k.slice(2),v]));
    put('transactions', { ...mapped, id, travel_id:fixtureTables.travels[0].id, period_id:fixtureTables.periods[0].id, paid_at:data.p_pay_now ? day+'T12:00:00Z' : null, created_at:fixtureTime, is_internal:false });
    return route.fulfill({json:id});
   }
   if (method === 'PATCH' && ['/rest/v1/trip_expenses','/rest/v1/transactions'].includes(path)) {
    const row = tables[path.split('/').at(-1)].find(r=>'eq.'+r.id===u.searchParams.get('id'));
    if (!row) throw Error('unexpected patch id');
    Object.assign(row,data);
    return route.fulfill({status:204});
   }
   if (method === 'POST' && path === '/rest/v1/trip_expense_budget_links') {
    const item = { ...data[0], id:'demo-budget-link' };
    put('trip_expense_budget_links',item);
    const tx = tables.transactions.find(r=>r.id===item.transaction_id);
    if (tx) tx.trip_share_link_id=item.id;
    return route.fulfill({status:204});
   }
   failures.push([method,path]);
   return route.fallback();
  });


  await page.goto(base + '/');
  const balance = page.locator(`#wallets-container [data-wallet-id="${wallet.id}"] .tb-wallet-card-main p strong`).first();
  await expect(balance).toHaveText(/^300[,.]00/);
  const navigate = async (key) => {
    await page.locator('#tab-' + key).click();
    await expect(page.locator('#view-' + key)).toBeVisible();
  };
  await navigate('transactions');
  await expect.poll(() => routeFixture.calls.some(r => r.path === '/rest/v1/categories')).toBe(true);
  await navigate('trip');

  const label = page.locator('#trip-exp-label');
  if (!await label.isVisible()) await page.locator('[data-trip-open-add-exp]:visible').first().click();
  await label.fill('Dîner partagé');
  await page.locator('#trip-exp-amount').fill('60');
  await page.locator('#trip-exp-paidby').selectOption(me);
  await page.locator('#trip-exp-wallet').selectOption(wallet.id);
  await expect(page.locator('#trip-exp-currency')).toHaveValue('NZD');
  await page.locator('#trip-exp-category').selectOption('Repas');
  await expect(page.locator('#trip-split-mode')).toHaveValue('equal');
  await page.locator('#trip-add-exp').click();

  await expect(page.locator('.trip-analysis-summary')).toContainText(/Alex doit 30(?:[,.]00)? NZD/);
  expect(tables.trip_expenses).toHaveLength(1);
  expect(tables.trip_expense_shares).toHaveLength(2);
  expect(tables.transactions).toHaveLength(2);
  expect(tables.transactions).toEqual(expect.arrayContaining([
    expect.objectContaining({ amount: 60, currency: 'NZD', pay_now: true, out_of_budget: true }),
    expect.objectContaining({ amount: 30, currency: 'NZD', pay_now: false, affects_budget: true }),
  ]));
  expect(tables.trip_expense_budget_links).toHaveLength(1);

  await navigate('dashboard');
  await expect(balance).toHaveText(/^240[,.]00/);
  const budget = page.locator('#daily-budget-container');
  await budget.locator('#db-today').click();
  const date = budget.locator('.day').filter({ hasText: day });
  await expect(date).toContainText('120 NZD');
  await expect(date.locator('.row b').first()).toHaveText('−30 NZD');

  await navigate('analysis');
  const summary = page.locator('#analysis-summary');
  await expect(summary.locator('.analysis-stat--glass-blue .analysis-stat-value').first()).toContainText(/^30[,.]00/);
  const categories = page.locator('#analysis-category-bars-chart');
  await expect(categories).toBeVisible();
  await expect.poll(() => categories.evaluate(element => {
    const options = window.echarts?.getInstanceByDom(element)?.getOption();
    return { labels: options?.yAxis?.[0]?.data, amounts: options?.series?.[0]?.data?.map(point => point.value) };
  })).toEqual({ labels: ['Repas'], amounts: [30] });
  expect(failures).toEqual([]);
  expect(routeFixture.failures).toEqual([]);
});
