import { describe, it, expect } from 'vitest';
import {
  buildTripDeleteExpenseRpcArgs,
  buildTripExpenseRpcPayload,
  buildTripSettlementRpcArgs,
  canUseTripWalletForExpense,
  computeTripAnalysis,
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

    expect(validateTripExpenseMutation({
      input,
      members,
      shares: [5, 5],
      payer: members[0],
      wallet: { id: 'w1', user_id: 'other', travel_id: 'travel1', currency: 'THB' },
      userId: 'u1',
      travelId: 'travel1',
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

  it('builds Trip delete RPC args safely', () => {
    expect(buildTripDeleteExpenseRpcArgs({ tripId: 't1', expenseId: 'e1' })).toEqual({
      p_trip_id: 't1',
      p_expense_id: 'e1',
    });
    expect(() => buildTripDeleteExpenseRpcArgs({ tripId: '', expenseId: 'e1' })).toThrow(/Suppression/);
  });

  it('builds Trip settlement RPC args with normalized currency and rounded amount', () => {
    expect(buildTripSettlementRpcArgs({
      tripId: 't1',
      currency: 'eur',
      amount: 12.345,
      fromMemberId: 'a',
      toMemberId: 'b',
    })).toEqual({
      p_trip_id: 't1',
      p_currency: 'EUR',
      p_amount: 12.35,
      p_from_member_id: 'a',
      p_to_member_id: 'b',
    });
    expect(() => buildTripSettlementRpcArgs({ tripId: 't1', currency: 'EUR', amount: 1, fromMemberId: 'a', toMemberId: 'a' })).toThrow(/differents/);
  });

  it('validates Trip wallet ownership, trip and currency', () => {
    expect(canUseTripWalletForExpense({
      wallet: { id: 'w1', user_id: 'u1', travel_id: 't1', currency: 'AUD' },
      userId: 'u1',
      travelId: 't1',
      currency: 'AUD',
    }).ok).toBe(true);

    expect(canUseTripWalletForExpense({
      wallet: { id: 'w1', user_id: 'u1', currency: 'AUD' },
      userId: 'u1',
      travelId: 't1',
      currency: 'AUD',
    }).ok).toBe(true);

    expect(canUseTripWalletForExpense({
      wallet: { id: 'w1', user_id: 'u1', travel_id: 'other', currency: 'AUD' },
      userId: 'u1',
      tripId: 't1',
      currency: 'AUD',
    }).ok).toBe(false);

    expect(canUseTripWalletForExpense({
      wallet: { id: 'w1', user_id: 'u1', travel_id: 't1', currency: 'EUR' },
      userId: 'u1',
      tripId: 't1',
      currency: 'AUD',
    }).ok).toBe(false);
  });

  it('computes Trip analysis totals by category and participant', () => {
    const data = computeTripAnalysis({
      pivot: 'EUR',
      members: [
        { id: 'me', name: 'Moi', isMe: true },
        { id: 'b', name: 'Ben' },
      ],
      expenses: [
        { id: 'e1', amount: 100, currency: 'EUR', paidByMemberId: 'me', category: 'Food' },
        { id: 'e2', amount: 1000, currency: 'JPY', paidByMemberId: 'b', category: 'Transport' },
      ],
      shares: [
        { expenseId: 'e1', memberId: 'me', shareAmount: 50 },
        { expenseId: 'e1', memberId: 'b', shareAmount: 50 },
        { expenseId: 'e2', memberId: 'me', shareAmount: 500 },
        { expenseId: 'e2', memberId: 'b', shareAmount: 500 },
      ],
      convertAmount: (amount, currency) => currency === 'JPY' ? Number(amount) / 100 : Number(amount),
    });

    expect(data.categories).toEqual([
      { name: 'Food', amount: 100 },
      { name: 'Transport', amount: 10 },
    ]);
    expect(data.participants).toEqual([
      { id: 'me', name: 'Moi', isMe: true, paid: 100, owed: 55, net: 45, expenseCount: 1 },
      { id: 'b', name: 'Ben', isMe: false, paid: 10, owed: 55, net: -45, expenseCount: 1 },
    ]);
  });
});
