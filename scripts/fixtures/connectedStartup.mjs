// Synthetic HTTP responses only. Never forwards requests to a Supabase project.
export const fixtureTime = '2026-10-24T02:00:00Z';
export const fixtureUser = '11111111-1111-4111-8111-111111111111';
const travel = '22222222-2222-4222-8222-222222222222';
const period = '33333333-3333-4333-8333-333333333333';
const wallet = '44444444-4444-4444-8444-444444444444';
export const transactionCount = 1200;
export const projectOrigin = 'https://obznbrzarhvmlbprcfie.supabase.co';
const common = { user_id: fixtureUser, travel_id: travel, period_id: period };
export const fixtureTables = {
  schema_version: [{ key: 'travelbudget', version: 0 }],
  profiles: [{ id: fixtureUser, email: 'startup@example.invalid', role: 'tester' }],
  settings: [{ user_id: fixtureUser, theme: 'light', base_currency: 'EUR', ui_mode: 'advanced', palette_preset: 'Ocean', notification_prefs: {} }],
  travels: [{ id: travel, user_id: fixtureUser, name: 'Synthetic startup journey', start_date: '2026-10-01', end_date: '2026-12-31', base_currency: 'EUR' }],
  periods: [{ ...common, id: period, name: 'Synthetic period', start_date: '2026-10-01', end_date: '2026-12-31', base_currency: 'EUR', eur_base_rate: 1, daily_budget_base: 50, fx_mode: 'fixed' }],
  wallets: [{ ...common, id: wallet, name: 'Synthetic EUR wallet', currency: 'EUR', balance: 10000, type: 'bank', archived: false, created_at: '2026-10-01T00:00:00Z' }],
  budget_segments: [{ ...common, id: 'synthetic-segment', start_date: '2026-10-01', end_date: '2026-12-31', base_currency: 'EUR', daily_budget_base: 50, eur_base_rate_fixed: 1, fx_mode: 'fixed', sort_order: 0 }],
  categories: [{ id: 'synthetic-category', user_id: fixtureUser, name: 'Food', color: '#123456' }],
  transactions: Array.from({ length: transactionCount }, (_, i) => {
    const date = `2026-10-${String(1 + i % 23).padStart(2, '0')}`;
    return { ...common, id: `synthetic-tx-${i}`, wallet_id: wallet, type: 'expense', amount: 1, currency: 'EUR', date_start: date, date_end: date, budget_date_start: date, budget_date_end: date, paid_at: `${date}T12:00:00Z`, label: `Synthetic expense ${i}`, category: 'Food', affects_budget: true, out_of_budget: false, pay_now: true, is_internal: false, created_at: new Date(Date.parse('2026-10-01T00:00:00Z') + i * 1000).toISOString() };
  }),
  sport_sessions: [], work_days: [], nutrition_meals: [], nutrition_sleep: [], nutrition_meal_items: [],
  assets: [], asset_owners: [], fx_manual_rates: [], recurring_rules: [], v_trip_user_net_balances: [],
  trip_invites: [], category_subcategories: [], analytic_category_mappings: [], v_transaction_analytic_mapping: [], v_analytic_mapping_audit: [],
};

export function fixtureResponse(url, method = 'GET', headers = {}) {
  const target = new URL(url);
  if (target.origin !== projectOrigin) throw new Error(`Unexpected external origin: ${target.origin}`);
  if (target.pathname === '/auth/v1/user' && method === 'GET') return { id: fixtureUser, email: 'startup@example.invalid', aud: 'authenticated', role: 'authenticated' };
  if (target.pathname === '/auth/v1/health' && method === 'GET') return { name: 'synthetic-auth' };
  if (target.pathname === '/functions/v1/fx-latest' && method === 'POST') return { base: 'EUR', date: '2026-10-24', rates: { EUR: 1, AUD: 1.6, USD: 1.1 } };
  const table = target.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
  if (!table || !Object.hasOwn(fixtureTables, table) || !['GET', 'HEAD'].includes(method)) throw new Error(`Unconfigured fixture request: ${method} ${target.pathname}`);
  let rows = fixtureTables[table];
  for (const [column, value] of target.searchParams) {
    if (value.startsWith('eq.')) rows = rows.filter(row => String(row[column]) === value.slice(3));
    else if (value.startsWith('in.(')) rows = rows.filter(row => value.slice(4, -1).split(',').includes(String(row[column])));
  }
  const range = headers.range?.match(/^(\d+)-(\d+)$/);
  const offset = Number(target.searchParams.get('offset') || range?.[1] || 0);
  const limit = Number(target.searchParams.get('limit') || (range ? Number(range[2]) - offset + 1 : rows.length));
  rows = rows.slice(offset, offset + limit);
  const columns = target.searchParams.get('select');
  if (columns && columns !== '*') rows = rows.map(row => Object.fromEntries(columns.split(',').filter(column => Object.hasOwn(row, column)).map(column => [column, row[column]])));
  return headers.accept?.includes('application/vnd.pgrst.object+json') ? (rows[0] || null) : rows;
}

export async function installConnectedFixture(page, localOrigin) {
  const calls = [];
  const failures = [];
  // Shift calendar time only; keep native performance marks and real timers.
  await page.addInitScript(time => {
    const NativeDate = Date;
    const offset = NativeDate.parse(time) - NativeDate.now();
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [NativeDate.now() + offset])); }
      static now() { return NativeDate.now() + offset; }
    };
  }, fixtureTime);
  await page.route('**/*', async route => {
    const req = route.request();
    if (new URL(req.url()).origin === localOrigin) return route.continue();
    try {
      const body = fixtureResponse(req.url(), req.method(), req.headers());
      const json = JSON.stringify(body);
      calls.push({ path: new URL(req.url()).pathname, query: new URL(req.url()).search, method: req.method(), responseBytes: Buffer.byteLength(json) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: req.method() === 'HEAD' ? '' : json });
    } catch (error) {
      failures.push(error.message);
      return route.abort();
    }
  });
  await page.routeWebSocket('**/*', ws => { failures.push('Unexpected WebSocket request'); ws.close(); });
  const payload = { sub: fixtureUser, aud: 'authenticated', role: 'authenticated', exp: 4070908800 };
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify(payload)).toString('base64url'), 'synthetic-signature'].join('.');
  await page.addInitScript(({ token, fixtureUser }) => {
    localStorage.setItem('sb-obznbrzarhvmlbprcfie-auth-token', JSON.stringify({ access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_at: 4070908800, user: { id: fixtureUser, email: 'startup@example.invalid', aud: 'authenticated', role: 'authenticated' } }));
  }, { token, fixtureUser });
  return { calls, failures };
}
