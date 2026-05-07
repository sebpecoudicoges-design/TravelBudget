import { describe, it, expect } from 'vitest';
import {
  buildTripExpenseRpcPayload,
  computeTripSplitParts,
  normalizeTripExpenseInput,
  shouldAutoCashflowOnly,
  validateOneToOneLink,
  validateSplitTotal,
  validateTripExpenseMutation,
} from '../../src/core/tripRules.js';

describe('trip rules core', () => {
  it('auto cashflow-only only when linked + payment total + shared', () => {
    expect(shouldAutoCashflowOnly({ linked: true, isPaymentTotal: true, total: 100, myShare: 10 })).toBe(true);
    expect(shouldAutoCashflowOnly({ linked: true, isPaymentTotal: true, total: 100, myShare: 100 })).toBe(false);
    expect(shouldAutoCashflowOnly({ linked: true, isPaymentTotal: false, total: 100, myShare: 10 })).toBe(false);
    expect(shouldAutoCashflowOnly({ linked: false, isPaymentTotal: true, total: 100, myShare: 10 })).toBe(false);
  });

  it('enforces 1:1 link', () => {
    expect(validateOneToOneLink({ txTripExpenseId: 'x', expenseLinkedTxId: null }).ok).toBe(false);
    expect(validateOneToOneLink({ txTripExpenseId: null, expenseLinkedTxId: 'y' }).ok).toBe(false);
    expect(validateOneToOneLink({ txTripExpenseId: null, expenseLinkedTxId: null }).ok).toBe(true);
  });

  it('validates split totals', () => {
    expect(validateSplitTotal({ total: 100, shares: [10, 90] }).ok).toBe(true);
    expect(validateSplitTotal({ total: 100, shares: [10, 80] }).ok).toBe(false);
  });

  it('normalizes required Trip expense input', () => {
    expect(normalizeTripExpenseInput({
      date: '2026-05-07',
      label: 'Taxi',
      amount: '12.50',
      currency: 'thb',
      paidByMemberId: 'm1',
    })).toMatchObject({
      label: 'Taxi',
      amount: 12.5,
      currency: 'THB',
      category: 'Autre',
      budgetDateStart: '2026-05-07',
    });

    expect(() => normalizeTripExpenseInput({
      date: '2026-05-07',
      amount: 10,
      paidByMemberId: 'm1',
    })).toThrow(/Libelle requis/);
  });

  it('computes equal split with cent-safe rounding and selected participants', () => {
    const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(computeTripSplitParts(10, members, { mode: 'equal' })).toEqual([3.34, 3.33, 3.33]);
    expect(computeTripSplitParts(10, members, { mode: 'equal', selectedMemberIds: ['b', 'c'] })).toEqual([0, 5, 5]);
  });

  it('computes percent and amount splits that sum to total', () => {
    const members = [{ id: 'a' }, { id: 'b' }];
    expect(computeTripSplitParts(100, members, { mode: 'percent', percents: { a: 25, b: 75 } })).toEqual([25, 75]);
    expect(computeTripSplitParts(100, members, { mode: 'amount', amounts: { a: 40, b: 60 } })).toEqual([40, 60]);
    expect(() => computeTripSplitParts(100, members, { mode: 'amount', amounts: { a: 40, b: 50 } })).toThrow(/somme/);
  });

  it('validates paid-by-me wallet consistency', () => {
    const input = normalizeTripExpenseInput({
      date: '2026-05-07',
      label: 'Taxi',
      amount: 10,
      currency: 'THB',
      paidByMemberId: 'me',
      walletId: 'w1',
    });
    const members = [{ id: 'me', isMe: true }, { id: 'other' }];

    expect(validateTripExpenseMutation({
      input,
      members,
      shares: [5, 5],
      payer: members[0],
      wallet: { id: 'w1', currency: 'THB' },
    }).ok).toBe(true);

    expect(validateTripExpenseMutation({
      input,
      members,
      shares: [5, 5],
      payer: members[0],
      wallet: { id: 'w1', currency: 'EUR' },
    }).ok).toBe(false);
  });

  it('builds Trip expense RPC payload with shares', () => {
    const input = normalizeTripExpenseInput({
      expenseId: 'ex1',
      date: '2026-05-07',
      label: 'Dinner',
      amount: 30,
      currency: 'JPY',
      paidByMemberId: 'a',
      category: 'Food',
      subcategory: 'Restaurant',
    });
    const payload = buildTripExpenseRpcPayload({
      input,
      members: [{ id: 'a' }, { id: 'b' }],
      shares: [20, 10],
    });

    expect(payload).toMatchObject({
      expense_id: 'ex1',
      date: '2026-05-07',
      currency: 'JPY',
      paid_by_member_id: 'a',
      category: 'Food',
      subcategory: 'Restaurant',
      shares: [
        { member_id: 'a', share_amount: 20 },
        { member_id: 'b', share_amount: 10 },
      ],
      wallet_tx: { enabled: false },
    });
  });
});
