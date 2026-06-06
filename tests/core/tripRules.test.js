import { describe, it, expect } from 'vitest';
import {
  buildTripDeleteExpenseRpcArgs,
  buildTripAdvanceTransactionArgs,
  buildTripExpenseRpcPayload,
  buildTripFullShareTransactionArgs,
  buildTripPersonalShareTransactionArgs,
  buildTripSettlementRpcArgs,
  buildTripTransactionRpcPayload,
  canUseTripWalletForExpense,
  computeTripAnalysis,
  computeTripSplitParts,
  decideTripExpenseBudgetFlow,
  matchesTripHistoryFilter,
  normalizeTripHistoryFilters,
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

  it('decides Trip budget flow for paid-by-me expenses', () => {
    const members = [{ id: 'me', isMe: true }, { id: 'b' }];

    expect(decideTripExpenseBudgetFlow({ amount: 100, members, shares: [100, 0] })).toMatchObject({
      mode: 'single',
      myIdx: 0,
      myShare: 100,
      hasMyShare: true,
      isFullShare: true,
      missingMe: false,
    });

    expect(decideTripExpenseBudgetFlow({ amount: 100, members, shares: [40, 60] })).toMatchObject({
      mode: 'advance_and_share',
      myIdx: 0,
      myShare: 40,
      hasMyShare: true,
      isFullShare: false,
      missingMe: false,
    });

    expect(decideTripExpenseBudgetFlow({ amount: 100, members: [{ id: 'b' }], shares: [100] })).toMatchObject({
      mode: 'advance_and_share',
      meId: null,
      myIdx: -1,
      hasMyShare: false,
      isFullShare: false,
      missingMe: true,
    });
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

  it('builds full Trip transaction RPC payload with explicit defaults', () => {
    expect(buildTripTransactionRpcPayload({
      p_wallet_id: 'w1',
      p_type: 'expense',
      p_label: '[Trip] Dinner',
      p_amount: 42,
      p_currency: 'EUR',
      p_date_start: '2026-06-03',
      p_pay_now: true,
      p_out_of_budget: false,
      p_affects_budget: true,
    }, { userId: 'u1', today: '2026-06-06' })).toMatchObject({
      p_wallet_id: 'w1',
      p_type: 'expense',
      p_label: '[Trip] Dinner',
      p_amount: 42,
      p_currency: 'EUR',
      p_date_start: '2026-06-03',
      p_date_end: '2026-06-03',
      p_budget_date_start: '2026-06-03',
      p_budget_date_end: '2026-06-03',
      p_category: null,
      p_subcategory: null,
      p_pay_now: true,
      p_out_of_budget: false,
      p_night_covered: false,
      p_affects_budget: true,
      p_trip_expense_id: null,
      p_trip_share_link_id: null,
      p_user_id: 'u1',
    });

    expect(buildTripTransactionRpcPayload({
      currency: 'AUD',
      date_start: '2026-06-01',
      date_end: '2026-06-02',
    }, { today: '2026-06-06' })).toMatchObject({
      p_currency: 'AUD',
      p_date_start: '2026-06-01',
      p_date_end: '2026-06-02',
      p_budget_date_start: '2026-06-01',
      p_budget_date_end: '2026-06-02',
    });
  });

  it('builds specialized Trip expense transaction args', () => {
    const base = {
      userId: 'u1',
      walletId: 'w1',
      label: 'Dinner',
      amount: 100,
      myShare: 40,
      currency: 'EUR',
      date: '2026-06-03',
      budgetDateStart: '2026-06-01',
      budgetDateEnd: '2026-06-30',
      category: 'Food',
      subcategory: 'Restaurant',
    };

    expect(buildTripFullShareTransactionArgs({ ...base, outOfBudget: false })).toMatchObject({
      p_label: '[Trip] Dinner',
      p_amount: 100,
      p_pay_now: true,
      p_out_of_budget: false,
      p_affects_budget: true,
    });

    expect(buildTripAdvanceTransactionArgs(base)).toMatchObject({
      p_label: '[Trip] Avance - Dinner',
      p_amount: 100,
      p_pay_now: true,
      p_out_of_budget: true,
      p_affects_budget: false,
    });

    expect(buildTripPersonalShareTransactionArgs({ ...base, outOfBudget: true })).toMatchObject({
      p_label: '[Trip] Dinner',
      p_amount: 40,
      p_pay_now: false,
      p_out_of_budget: true,
      p_affects_budget: false,
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

  it('normalizes and matches Trip history filters', () => {
    const membersById = new Map([
      ['me', { id: 'me', name: 'Moi' }],
      ['b', { id: 'b', name: 'Ben' }],
    ]);
    const expense = {
      id: 'e1',
      date: '2026-06-03',
      label: 'Dinner ramen',
      amount: 42,
      currency: 'EUR',
      paidByMemberId: 'me',
    };
    const shares = [
      { expenseId: 'e1', memberId: 'me', shareAmount: 21 },
      { expenseId: 'e1', memberId: 'b', shareAmount: 21 },
    ];

    expect(normalizeTripHistoryFilters({ amountMin: 40, q: ' ben ' })).toMatchObject({
      amountMin: '40',
      q: ' ben ',
    });
    expect(matchesTripHistoryFilter({
      expense,
      category: 'Food',
      membersById,
      sharesByExpense: shares,
      filters: { participant: 'b', q: 'ben', dateFrom: '2026-06-01', amountMax: '50' },
    })).toBe(true);
    expect(matchesTripHistoryFilter({
      expense,
      category: 'Food',
      membersById,
      sharesByExpense: shares,
      filters: { category: 'Transport' },
    })).toBe(false);
    expect(matchesTripHistoryFilter({
      expense,
      category: 'Food',
      membersById,
      sharesByExpense: shares,
      filters: { amountMin: '50' },
    })).toBe(false);
  });
});
