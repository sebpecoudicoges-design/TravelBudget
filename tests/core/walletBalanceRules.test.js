import { describe, expect, it } from 'vitest';
import { computeWalletBalanceRows } from '../../src/core/walletBalanceRules.js';

describe('wallet balance rules', () => {
  it('computes effective balances from baseline plus eligible transactions', () => {
    const rows = computeWalletBalanceRows([
      {
        id: 'wallet-1',
        period_id: 'period-1',
        currency: 'EUR',
        balance: 100,
        balance_snapshot_at: '2026-05-07T10:00:00.000Z',
      },
    ], [
      { id: 'old', wallet_id: 'wallet-1', type: 'income', amount: 999, pay_now: true, created_at: '2026-05-07T09:59:59.000Z' },
      { id: 'income', wallet_id: 'wallet-1', type: 'income', amount: 50, pay_now: true, created_at: '2026-05-07T10:10:00.000Z' },
      { id: 'expense', wallet_id: 'wallet-1', type: 'expense', amount: 20, pay_now: true, created_at: '2026-05-07T10:20:00.000Z' },
      { id: 'unpaid', wallet_id: 'wallet-1', type: 'expense', amount: 10, pay_now: false, created_at: '2026-05-07T10:30:00.000Z' },
      { id: 'internal', wallet_id: 'wallet-1', type: 'income', amount: 10, pay_now: true, is_internal: true, created_at: '2026-05-07T10:40:00.000Z' },
    ], 'period-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      wallet_id: 'wallet-1',
      transactions_delta: 30,
      effective_balance: 130,
      included_tx_count: 2,
      excluded_internal_count: 1,
      excluded_unpaid_count: 1,
      excluded_pre_snapshot_count: 1,
      last_tx_created_at: '2026-05-07T10:20:00.000Z',
    });
  });

  it('filters wallets by active period and supports camelCase legacy rows', () => {
    const rows = computeWalletBalanceRows([
      { id: 'active', periodId: 'period-1', currency: 'THB', balance: 10 },
      { id: 'other', periodId: 'period-2', currency: 'THB', balance: 10 },
    ], [
      { walletId: 'active', type: 'expense', amount: 4, payNow: true, createdAt: '2026-05-08T00:00:00.000Z' },
      { walletId: 'other', type: 'expense', amount: 8, payNow: true, createdAt: '2026-05-08T00:00:00.000Z' },
    ], 'period-1');

    expect(rows).toHaveLength(1);
    expect(rows[0].wallet_id).toBe('active');
    expect(rows[0].effective_balance).toBe(6);
  });
});
