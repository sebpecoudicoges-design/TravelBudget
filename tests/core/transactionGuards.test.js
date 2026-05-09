import { describe, expect, it } from 'vitest';
import {
  getTransactionLockState,
  validateTransactionAction,
  validateTransactionMutation,
} from '../../src/core/transactionGuards.js';
import { normalizeTransactionInput } from '../../src/core/transactionRules.js';

describe('transaction guards', () => {
  it('locks wallet adjustment transactions as readonly', () => {
    const lock = getTransactionLockState({ category: 'Ajustement wallet' });
    expect(lock.locked).toBe(true);
    expect(lock.readonly).toBe(true);
    expect(lock.kind).toBe('wallet_adjustment');
  });

  it('locks trip-linked transactions as readonly', () => {
    const lock = getTransactionLockState({ tripShareLinkId: 'share-1' });
    expect(lock.locked).toBe(true);
    expect(lock.readonly).toBe(true);
    expect(lock.kind).toBe('trip_linked');
  });

  it('allows normal transaction edits when payload is valid', () => {
    const tx = normalizeTransactionInput({
      type: 'expense',
      walletId: 'wallet-1',
      amount: 12,
      cashDate: '2026-05-07',
    });

    expect(validateTransactionMutation(tx, {
      mode: 'edit',
      currentTx: { id: 'tx-1' },
      wallet: { id: 'wallet-1', currency: 'EUR' },
    }).ok).toBe(true);
  });

  it('blocks edits to locked source-of-truth transactions', () => {
    const tx = normalizeTransactionInput({
      type: 'expense',
      walletId: 'wallet-1',
      amount: 12,
      cashDate: '2026-05-07',
    });

    const out = validateTransactionMutation(tx, {
      mode: 'edit',
      currentTx: { id: 'tx-1', tripExpenseId: 'trip-expense-1' },
      wallet: { id: 'wallet-1', currency: 'EUR' },
    });

    expect(out.ok).toBe(false);
    expect(out.lock.kind).toBe('trip_linked');
  });

  it('blocks wallet/currency mismatches', () => {
    const tx = normalizeTransactionInput({
      type: 'expense',
      walletId: 'wallet-2',
      amount: 12,
      cashDate: '2026-05-07',
    });
    tx.currency = 'JPY';

    expect(validateTransactionMutation(tx, {
      mode: 'create',
      wallet: { id: 'wallet-1', currency: 'JPY' },
    }).ok).toBe(false);

    tx.walletId = 'wallet-1';
    expect(validateTransactionMutation(tx, {
      mode: 'create',
      wallet: { id: 'wallet-1', currency: 'EUR' },
    }).ok).toBe(false);
  });

  it('blocks delete and mark-paid actions on locked transactions', () => {
    const tripTx = { id: 'tx-trip', tripExpenseId: 'trip-expense-1' };
    const adjustmentTx = { id: 'tx-adjust', category: 'Ajustement wallet' };

    const deleteOut = validateTransactionAction(tripTx, 'delete');
    expect(deleteOut.ok).toBe(false);
    expect(deleteOut.lock.kind).toBe('trip_linked');

    const paidOut = validateTransactionAction(adjustmentTx, 'mark_paid');
    expect(paidOut.ok).toBe(false);
    expect(paidOut.lock.kind).toBe('wallet_adjustment');
  });
});
