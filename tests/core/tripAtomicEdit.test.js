import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = fs.readFileSync('public/legacy/js/29_trip_v1.js', 'utf8');
const update = source.slice(source.indexOf('  async function _updateExpense('), source.indexOf('  async function _addExpense('));
function harness(reply) {
  const state = { activeTripId: 'trip', expenses: [{ id: 'e' }], members: [{ id: 'me', isMe: true }, { id: 'other' }],
    editingExpenseId: 'e', editingExpenseDraft: { amount: 100 } };
  const wallet = { id: 'wallet', currency: 'AUD' };
  const rpc = vi.fn(async () => reply);
  const approval = vi.fn();
  const context = vm.createContext({ tripState: state, sb: { rpc }, _ensureSession: async () => 'user',
    _normalizeTripExpenseForMutation: input => input, findWallet: () => wallet, _activeWallets: () => [wallet],
    _computeSplitParts: () => [40, 60], _validateTripExpenseForMutation() {},
    _buildTripExpenseRpcPayload: ({ input, parts }) => ({ expense_id: input.expenseId, shares: parts }),
    _rpcFxSnapshotArgs: () => ({ p_fx_rate_snapshot: 1 }), _requestPayerApprovalIfNeeded: approval });
  vm.runInContext(update, context);
  return { rpc, state, approval, edit: (extra = {}) => context._updateExpense({ expenseId: 'e', kind: 'expense',
    amount: 100, date: '2026-11-06', currency: 'AUD', paidByMemberId: 'me', walletId: 'wallet', ...extra }) };
}

describe('Trip atomic edit', () => {
  it('sends cash and personal budget choices together and clears a confirmed draft', async () => {
    const h = harness({ data: 'e' });
    await h.edit({ outOfBudget: true });
    expect(h.rpc).toHaveBeenCalledExactlyOnceWith('trip_edit_expense_atomic_v1', {
      p_trip_id: 'trip', p_member_id: 'me', p_wallet_id: 'wallet', p_payload: { expense_id: 'e', shares: [40, 60] },
      p_out_of_budget: true, p_fx: { p_fx_rate_snapshot: 1 } });
    expect(h.approval).toHaveBeenCalledWith('e', 'me');
    expect(h.state.editingExpenseDraft).toBeNull();
  });
  it.each([{ error: new Error('RPC refused') }, { data: 'different-id' }])('keeps the draft and stops after an unconfirmed edit', async reply => {
    const h = harness(reply);
    await expect(h.edit()).rejects.toThrow();
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.state.editingExpenseId).toBe('e');
    expect(h.state.editingExpenseDraft).toEqual({ amount: 100 });
    expect(h.approval).not.toHaveBeenCalled();
  });
  it('uses a matching wallet for the personal share when another member pays', async () => {
    const h = harness({ data: 'e' });
    await h.edit({ paidByMemberId: 'other', walletId: null, kind: 'income' });
    expect(h.rpc.mock.calls[0][1].p_wallet_id).toBe('wallet');
    expect(h.approval).not.toHaveBeenCalled();
  });
});
