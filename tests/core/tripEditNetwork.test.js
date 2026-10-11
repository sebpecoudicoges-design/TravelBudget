import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildDailyBudgetAllocations } from '../../src/core/dailyBudgetRules.js';

const source = fs.readFileSync('public/legacy/js/29_trip_v1.js', 'utf8');
const functions = source.slice(source.indexOf('  async function _buildEditDraftForExpense('), source.indexOf('  async function _cancelEditExpense('));

function harness({ cached = true, out = false, auditFails = true, fullShare = false, offline = false } = {}) {
  const share = { id: 'share', type: 'expense', label: '[Trip] Aldi', amount: 70, currency: 'AUD', payNow: false, outOfBudget: out, affectsBudget: !out, isInternal: true, dateStart: '2026-10-02', dateEnd: '2026-10-02' };
  const payment = { id: 'payment', amount: 123.11, payNow: true, outOfBudget: true };
  const tripState = {
    expenses: [{ id: 'aldi', amount: 123.11, date: '2026-10-02', paidByMemberId: 'me', transactionId: 'payment' }],
    shares: [{ expenseId: 'aldi', memberId: 'me', shareAmount: fullShare ? 123.11 : 70 }],
    members: [{ id: 'me', isMe: true }],
    budgetLinks: fullShare ? [] : [{ expenseId: 'aldi', memberId: 'me', transactionId: 'share' }],
  };
  const context = vm.createContext({
    tripState, state: { transactions: [payment, ...(cached && !fullShare ? [share] : [])] },
    window: { tbIsOfflineMode: () => offline }, navigator: { onLine: !offline },
    _fetchExpenseAuditDetails: async () => {
      if (auditFails) throw new Error('Failed to fetch');
      // Simulate the audit swallowing a failed share query but loading the payment.
      return { walletTransaction: payment, myShareLink: null, budgetTransactionsById: new Map() };
    },
    _normalizeTripEntryKind: () => 'expense', _normalizeTripIncomeSource: () => 'external',
    _tripIncomeDueBack: () => true, _renderUI: async () => {},
  });
  vm.runInContext(functions, context);
  return { context, share, tripState };
}

describe('Trip edit under network failure', () => {
  it.each([true, false])('preserves the cached personal budget choice (out=%s)', async out => {
    const { context } = harness({ out });
    expect((await context._buildEditDraftForExpense('aldi')).outOfBudget).toBe(out);
  });

  it.each([true, false])('does not copy the advance exclusion when the share cannot be read (throw=%s)', async auditFails => {
    const { context, tripState } = harness({ cached: false, auditFails });
    await expect(context._beginEditExpense('aldi')).rejects.toThrow('Impossible de vérifier ta part Budget');
    expect(tripState.editingExpenseId).toBeUndefined();
    expect(tripState.editingExpenseDraft).toBeUndefined();
  });

  it('preserves a full personal payment exclusion using the local snapshot', async () => {
    const { context } = harness({ fullShare: true, cached: false });
    expect((await context._buildEditDraftForExpense('aldi')).outOfBudget).toBe(true);
  });

  it('uses the personal share while offline', async () => {
    const { context } = harness({ offline: true });
    expect((await context._buildEditDraftForExpense('aldi')).outOfBudget).toBe(false);
  });

  it('prefers the server share over an older cached budget choice', async () => {
    const { context, share } = harness({ out: true });
    context._fetchExpenseAuditDetails = async () => ({
      myShareLink: { transactionId: 'share' },
      budgetTransactionsById: new Map([['share', { ...share, outOfBudget: false }]]),
    });
    expect((await context._buildEditDraftForExpense('aldi')).outOfBudget).toBe(false);
  });

  it('allocates the corrected Aldi share to October 2 without charging the advance', () => {
    const { share } = harness();
    expect(buildDailyBudgetAllocations(share)).toEqual([expect.objectContaining({ dateStr: '2026-10-02', amountBase: 70 })]);
    expect(buildDailyBudgetAllocations({ ...share, amount: 123.11, payNow: true, outOfBudget: true, affectsBudget: false })).toEqual([]);
  });
});
