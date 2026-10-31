import { computeWalletBalanceRows } from '../core/walletBalanceRules.js';

const COLUMNS = {
  wallets: 'id,user_id,name,currency,balance,balance_snapshot_at,period_id,travel_id,archived',
  transactions: 'id,user_id,wallet_id,type,amount,currency,category,subcategory,label,date_start,date_end,budget_date_start,budget_date_end,paid_at,created_at,updated_at,pay_now,is_internal,affects_budget,out_of_budget,period_id,travel_id,trip_expense_id,trip_share_link_id',
  periods: 'id,user_id,travel_id,start_date,end_date,base_currency,daily_budget_base,eur_base_rate',
  budget_segments: 'id,user_id,period_id,start_date,end_date,base_currency,daily_budget_base,transport_night_budget,fx_mode,eur_base_rate_fixed,fx_rate_eur_to_base,sort_order',
  travels: 'id,user_id,name,base_currency,start_date,end_date',
  trip_groups: 'id,user_id,period_id,name,base_currency,closed_at',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ROWS = 10000;

// Internal port only: caller must supply a verified user identity and that user's
// RLS-scoped client. This module neither accepts nor authenticates bearer tokens.
export function createMcpFinanceReadRepository({ client, userId }) {
  if (!UUID.test(userId || '') || typeof client?.from !== 'function') throw new Error('Verified user context required');
  function query(table) { return client.from(table).select(COLUMNS[table]).eq('user_id', userId).order('id', { ascending: true }); }
  function checked(table, result) {
    if (result.error) throw new Error('Finance read failed; no complete result available');
    if (!Array.isArray(result.data) || result.data.some(row => row.user_id !== userId)) throw new Error('Invalid finance ownership response');
    // Project again at the boundary even if a mock or future API over-returns.
    const columns = COLUMNS[table].split(',');
    return result.data.map(row => Object.fromEntries(columns.filter(key => key !== 'user_id').map(key => [key, row[key] ?? null])));
  }
  async function all(table, configure = value => value) {
    const rows = [];
    for (let offset = 0; offset <= MAX_ROWS; offset += 500) {
      const page = checked(table, await configure(query(table)).range(offset, offset + 499));
      rows.push(...page);
      if (rows.length > MAX_ROWS) throw new Error('Finance read limit exceeded; narrow the requested scope');
      if (page.length < 500) return rows;
    }
    throw new Error('Finance read incomplete');
  }
  return {
    async accounts() {
      const [wallets, txs] = await Promise.all([all('wallets'), all('transactions')]);
      const balances = new Map(computeWalletBalanceRows(wallets, txs).map(row => [row.wallet_id, row]));
      return { accounts: wallets.map(wallet => ({ ...wallet, ...balances.get(wallet.id) })),
        balance_basis: 'Current wallet snapshot plus paid non-internal movements, using TravelBudget wallet rules.',
        currency_policy: 'Amounts retain their own currency; never sum different currencies.' };
    },
    async transactions({ offset = 0, limit = 50, wallet_id, date_from, date_to } = {}) {
      let q = query('transactions');
      if (wallet_id) q = q.eq('wallet_id', wallet_id);
      if (date_from) q = q.gte('date_start', date_from);
      if (date_to) q = q.lte('date_start', date_to);
      const rows = checked('transactions', await q.range(offset, offset + limit));
      return { transactions: rows.slice(0, limit), next_offset: rows.length > limit ? offset + limit : null,
        date_filter_basis: 'date_start (transaction date), not budget_date_start or paid_at',
        pagination: 'Stable id order; separate requests are not a database snapshot.',
        amounts: 'Raw ledger rows: includes internal Trip shares and gross cash advances. Do not sum blindly for budget spending.' };
    },
    async budgetConfiguration({ period_id } = {}) {
      const [periods, segments] = await Promise.all([
        all('periods', q => period_id ? q.eq('id', period_id) : q),
        all('budget_segments', q => period_id ? q.eq('period_id', period_id) : q),
      ]);
      const periodIds = new Set(periods.map(row => row.id));
      return { periods, segments: segments.filter(row => periodIds.has(row.period_id)),
        scope: 'Configured daily budgets and segment overrides only.',
        spending_summary_available: false,
        limitations: 'No computed remaining budget, FX conversion, asset depreciation or future cash projection. Do not add period and segment budgets together.' };
    },
    async trips() {
      const [travels, groups] = await Promise.all([all('travels'), all('trip_groups')]);
      return { travels, owned_expense_groups: groups,
        scope: 'Only journeys and expense groups owned by the connected user. Shared groups owned by other users, participant identities and expenses are not included.' };
    },
  };
}
