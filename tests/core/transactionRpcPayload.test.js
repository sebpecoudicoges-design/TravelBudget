import { describe, expect, it } from 'vitest';
import {
  buildApplyTransactionV2Args,
  buildUpdateTransactionCanonicalArgs,
  buildUpdateTransactionDirectPatchArgs,
  buildUpdateTransactionLegacyArgs,
} from '../../src/core/transactionRpcPayload.js';

describe('transaction RPC payload builders', () => {
  it('builds complete apply_transaction_v2 args with explicit defaults', () => {
    const payload = buildApplyTransactionV2Args({
      walletId: 'wallet-1',
      type: 'expense',
      label: 'Bus',
      amount: 42,
      currency: 'JPY',
      cashDate: '2026-05-07',
      budgetDateStart: '2026-05-07',
      budgetDateEnd: '2026-05-08',
      category: '',
      payNow: true,
      outOfBudget: false,
      nightCovered: true,
    }, {
      fallbackCategory: 'Autre',
      userId: 'user-1',
      fxArgs: {
        p_fx_rate_snapshot: 170,
        p_fx_source_snapshot: 'test',
      },
    });

    expect(payload).toMatchObject({
      p_wallet_id: 'wallet-1',
      p_type: 'expense',
      p_label: 'Bus',
      p_amount: 42,
      p_currency: 'JPY',
      p_date_start: '2026-05-07',
      p_date_end: '2026-05-07',
      p_budget_date_start: '2026-05-07',
      p_budget_date_end: '2026-05-08',
      p_category: 'Autre',
      p_subcategory: null,
      p_pay_now: true,
      p_out_of_budget: false,
      p_night_covered: true,
      p_affects_budget: true,
      p_trip_expense_id: null,
      p_trip_share_link_id: null,
      p_fx_rate_snapshot: 170,
      p_fx_source_snapshot: 'test',
      p_user_id: 'user-1',
    });
  });

  it('preserves explicit affectsBudget=false for cashflow-only writes', () => {
    const payload = buildApplyTransactionV2Args({
      walletId: 'wallet-1',
      type: 'income',
      amount: 10,
      affectsBudget: false,
      outOfBudget: false,
    });

    expect(payload.p_affects_budget).toBe(false);
  });

  it('canonicalizes update_transaction_v2 args', () => {
    const canonical = buildUpdateTransactionCanonicalArgs({
      p_tx_id: 'tx-1',
      p_wallet_id: 'wallet-1',
      p_type: 'expense',
      p_amount: 10,
      p_currency: 'EUR',
      p_category: 'Repas',
      p_label: 'Lunch',
      p_date_start: '2026-05-07',
      p_pay_now: true,
      p_out_of_budget: false,
      p_night_covered: false,
    });

    expect(canonical.p_id).toBe('tx-1');
    expect(canonical.p_date_end).toBe('2026-05-07');
    expect(canonical.p_budget_date_start).toBe('2026-05-07');
    expect(canonical.p_budget_date_end).toBe('2026-05-07');
    expect(canonical.p_subcategory).toBeNull();
  });

  it('builds legacy update fallback without budget date fields', () => {
    const canonical = buildUpdateTransactionCanonicalArgs({
      p_id: 'tx-1',
      p_budget_date_start: '2026-05-01',
      p_budget_date_end: '2026-05-02',
      p_fx_rate_snapshot: 1.2,
    });
    const legacy = buildUpdateTransactionLegacyArgs(canonical);

    expect(legacy.p_tx_id).toBe('tx-1');
    expect(legacy.p_fx_rate_snapshot).toBe(1.2);
    expect(legacy).not.toHaveProperty('p_budget_date_start');
    expect(legacy).not.toHaveProperty('p_budget_date_end');
  });

  it('builds direct patch args for fields missed by legacy RPC fallback', () => {
    const canonical = buildUpdateTransactionCanonicalArgs({
      p_id: 'tx-1',
      p_subcategory: 'Ramen',
      p_budget_date_start: '2026-05-01',
      p_budget_date_end: '2026-05-02',
      p_wallet_id: 'wallet-1',
    });
    const patch = buildUpdateTransactionDirectPatchArgs(canonical);

    expect(patch).toMatchObject({
      p_id: 'tx-1',
      p_subcategory: 'Ramen',
      p_budget_date_start: '2026-05-01',
      p_budget_date_end: '2026-05-02',
      p_wallet_id: 'wallet-1',
    });
  });
});
