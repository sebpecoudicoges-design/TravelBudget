import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('public/legacy/js/29_trip_v1.js', 'utf8');
const cleanup = source.slice(source.indexOf('  async function _cleanupExpenseBudgetLinksBeforeEdit('), source.indexOf('  async function _integrateExpenseBudgetSideEffects('));
const update = source.slice(source.indexOf('  async function _updateExpense('), source.indexOf('  async function _addExpense('));

function harness(failure) {
  const links = [{ id: 'l1', transaction_id: 'share1' }, { id: 'l2', transaction_id: 'share2' }, { id: 'lm', transaction_id: 'payment' }];
  const transactions = new Set(['share1', 'share2', 'payment']);
  const calls = [];
  let fail = failure;
  const client = {
    from(table) {
      let deleting = false;
      let ids;
      const run = () => {
        calls.push(`${table}:${deleting ? 'delete' : 'read'}`);
        if (fail === `${table}:${deleting ? 'delete' : 'read'}`) return { error: new Error(fail) };
        if (table === 'expenses') return { data: { id: 'e', transaction_id: 'payment' } };
        if (deleting) {
          const removed = [];
          if (fail !== 'links:empty') {
            for (let i = links.length - 1; i >= 0; i--) if (!ids || ids.includes(links[i].id)) removed.push(...links.splice(i, 1));
          }
          return { data: removed };
        }
        return { data: links.map(row => ({ ...row })) };
      };
      const q = { select: () => q, eq: () => q, in: (_, values) => { ids = values; return q; },
        delete: () => { deleting = true; return q; }, single: async () => run(),
        then: (resolve, reject) => Promise.resolve().then(run).then(resolve, reject) };
      return q;
    },
    async rpc(_, { p_tx_id: id }) {
      calls.push(`tx:${id}`);
      if (fail === `tx:${id}`) return { error: new Error(fail) };
      transactions.delete(id);
      // Actual FK: budget links cascade when their transaction is deleted.
      for (let i = links.length - 1; i >= 0; i--) if (links[i].transaction_id === id) links.splice(i, 1);
      return { data: null };
    },
  };
  const tables = { expenses: 'expenses', budgetLinks: 'links' };
  const context = vm.createContext({
    sb: client, console: { warn() {} },
    TB_CONST: { TABLES: { trip_expense_budget_links: 'links' }, RPCS: { delete_transaction: 'delete_transaction' } },
    tripState: { activeTripId: 'trip', expenses: [{ id: 'e', transactionId: 'stale-payment' }], members: [{ id: 'me' }], editingExpenseId: 'e', editingExpenseDraft: { label: 'edited' } },
    _tripRepositoryTables: () => tables,
    _ensureSession: async () => 'user', _normalizeCurrency: value => value,
    _normalizeTripExpenseForMutation: input => input, findWallet: () => ({}),
    _computeSplitParts: () => [10], _validateTripExpenseForMutation: () => {},
    _buildTripExpenseRpcPayload: () => ({}),
    _applyTripExpense: async () => { calls.push('expense:apply'); return 'e'; },
    _persistTripExpenseKind: async () => {},
    _integrateExpenseBudgetSideEffects: async () => { calls.push('budget:create'); },
    _requestPayerApprovalIfNeeded: async () => {},
  });
  vm.runInContext(cleanup + update, context);
  return { run: () => context._cleanupExpenseBudgetLinksBeforeEdit('e'),
    edit: () => context._updateExpense({ expenseId: 'e', date: '2026-11-05', amount: 10, currency: 'AUD', paidByMemberId: 'me' }),
    tripState: context.tripState, links, transactions, calls, recover: () => { fail = null; } };
}

describe('Trip edit cleanup preserves recoverable links', () => {
  it('stops before deletion when links cannot be read', async () => {
    const h = harness('links:read');
    await expect(h.run()).rejects.toThrow('links:read');
    expect(h.transactions.size).toBe(3);
    expect(h.links).toHaveLength(3);
    expect(h.calls.some(call => call.startsWith('tx:'))).toBe(false);
  });
  it('keeps the failed transaction linked and retries only the remaining shares', async () => {
    const h = harness('tx:share2');
    await expect(h.run()).rejects.toThrow('tx:share2');
    expect(h.links.map(row => row.transaction_id)).toEqual(['share2', 'payment']);
    expect(h.transactions).toEqual(new Set(['share2', 'payment']));
    h.recover();
    await h.run();
    expect(h.transactions).toEqual(new Set(['payment']));
    expect(h.calls.filter(call => call === 'tx:share1')).toHaveLength(1);
    expect(h.links).toEqual([]);
  });
  it('propagates link deletion failure and never deletes the wallet payment', async () => {
    const h = harness('links:delete');
    await expect(h.run()).rejects.toThrow('links:delete');
    expect(h.transactions.has('payment')).toBe(true);
    expect(h.links.map(row => row.transaction_id)).toEqual(['payment']);
  });
  it.each(['expenses:read', 'links:read', 'tx:share2', 'links:delete'])('stops the edit pipeline and keeps the draft on %s', async failure => {
    const h = harness(failure);
    await expect(h.edit()).rejects.toThrow(failure);
    expect(h.calls).not.toContain('expense:apply');
    expect(h.calls).not.toContain('budget:create');
    expect(h.tripState.editingExpenseId).toBe('e');
    expect(h.tripState.editingExpenseDraft).toEqual({ label: 'edited' });
  });
  it('resumes the edit after recovery using the server payment, despite stale UI state', async () => {
    const h = harness('tx:share2');
    await expect(h.edit()).rejects.toThrow();
    h.recover();
    await h.edit();
    expect(h.calls.filter(call => call === 'budget:create')).toHaveLength(1);
    expect(h.transactions).toEqual(new Set(['payment']));
    expect(h.tripState.editingExpenseId).toBeNull();
  });
  it('halts when a conditional link deletion silently matches zero rows', async () => {
    const h = harness('links:empty');
    await expect(h.edit()).rejects.toThrow('Recharge le Trip');
    expect(h.calls).not.toContain('budget:create');
    expect(h.links.map(row => row.transaction_id)).toEqual(['payment']);
  });
});
