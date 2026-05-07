// Pure builders for transaction RPC payloads.
// Keep Supabase/window/state/FX IO outside this module.

const FX_KEYS = [
  'p_fx_rate_snapshot',
  'p_fx_source_snapshot',
  'p_fx_snapshot_at',
  'p_fx_base_currency_snapshot',
  'p_fx_tx_currency_snapshot',
];

function cleanText(value, fallback = null) {
  const s = String(value ?? '').trim();
  return s || fallback;
}

export function buildApplyTransactionV2Args(core = {}, options = {}) {
  const fallbackCategory = options.fallbackCategory || 'Autre';
  const fxArgs = options.fxArgs || {};
  const category = cleanText(core.category, fallbackCategory);
  const cashDate = core.cashDate || core.dateStart || null;
  const dateEnd = core.cashDate || core.dateEnd || core.dateStart || null;
  const budgetDateStart = core.budgetDateStart || core.dateStart || core.cashDate || null;
  const budgetDateEnd = core.budgetDateEnd || core.dateEnd || core.dateStart || core.cashDate || null;

  return {
    p_wallet_id: core.walletId,
    p_type: core.type,
    p_label: core.label,
    p_amount: core.amount,
    p_currency: core.currency,
    p_date_start: cashDate,
    p_date_end: dateEnd,
    p_budget_date_start: budgetDateStart,
    p_budget_date_end: budgetDateEnd,
    p_category: category,
    p_subcategory: core.subcategory === undefined ? null : (core.subcategory || null),
    p_pay_now: !!core.payNow,
    p_out_of_budget: !!core.outOfBudget,
    p_night_covered: !!core.nightCovered,
    p_affects_budget: core.affectsBudget === undefined ? !core.outOfBudget : !!core.affectsBudget,
    p_trip_expense_id: core.tripExpenseId || null,
    p_trip_share_link_id: core.tripShareLinkId || null,
    ...fxArgs,
    p_user_id: options.userId || null,
  };
}

export function buildUpdateTransactionCanonicalArgs(args = {}) {
  return {
    p_id: args?.p_id || args?.p_tx_id || null,
    p_wallet_id: args?.p_wallet_id || null,
    p_type: args?.p_type || null,
    p_amount: args?.p_amount,
    p_currency: args?.p_currency || null,
    p_category: args?.p_category || null,
    p_label: args?.p_label || null,
    p_date_start: args?.p_date_start || null,
    p_date_end: args?.p_date_end || args?.p_date_start || null,
    p_pay_now: !!args?.p_pay_now,
    p_out_of_budget: !!args?.p_out_of_budget,
    p_night_covered: !!args?.p_night_covered,
    p_user_id: args?.p_user_id || null,
    p_subcategory: args?.p_subcategory === undefined ? null : (args?.p_subcategory || null),
    p_trip_expense_id: args?.p_trip_expense_id || null,
    p_trip_share_link_id: args?.p_trip_share_link_id || null,
    p_fx_rate_snapshot: args?.p_fx_rate_snapshot,
    p_fx_source_snapshot: args?.p_fx_source_snapshot,
    p_fx_snapshot_at: args?.p_fx_snapshot_at,
    p_fx_base_currency_snapshot: args?.p_fx_base_currency_snapshot,
    p_fx_tx_currency_snapshot: args?.p_fx_tx_currency_snapshot,
    p_budget_date_start: args?.p_budget_date_start || args?.p_date_start || null,
    p_budget_date_end: args?.p_budget_date_end || args?.p_date_end || args?.p_date_start || null,
  };
}

export function buildUpdateTransactionLegacyArgs(canonical = {}) {
  const out = {
    p_wallet_id: canonical.p_wallet_id,
    p_tx_id: canonical.p_id,
    p_type: canonical.p_type,
    p_label: canonical.p_label,
    p_amount: canonical.p_amount,
    p_currency: canonical.p_currency,
    p_date_start: canonical.p_date_start,
    p_date_end: canonical.p_date_end,
    p_category: canonical.p_category,
    p_pay_now: canonical.p_pay_now,
    p_out_of_budget: canonical.p_out_of_budget,
    p_night_covered: canonical.p_night_covered,
    p_trip_expense_id: canonical.p_trip_expense_id,
    p_trip_share_link_id: canonical.p_trip_share_link_id,
    p_user_id: canonical.p_user_id || null,
  };

  for (const key of FX_KEYS) out[key] = canonical[key];
  return out;
}

export function buildUpdateTransactionDirectPatchArgs(canonical = {}) {
  return {
    p_id: canonical.p_id,
    p_subcategory: canonical.p_subcategory,
    p_date_start: canonical.p_date_start,
    p_date_end: canonical.p_date_end,
    p_budget_date_start: canonical.p_budget_date_start,
    p_budget_date_end: canonical.p_budget_date_end,
    p_wallet_id: canonical.p_wallet_id,
    p_type: canonical.p_type,
    p_amount: canonical.p_amount,
    p_currency: canonical.p_currency,
    p_category: canonical.p_category,
    p_label: canonical.p_label,
    p_pay_now: canonical.p_pay_now,
    p_out_of_budget: canonical.p_out_of_budget,
    p_night_covered: canonical.p_night_covered,
  };
}
