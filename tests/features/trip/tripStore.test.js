import { describe, expect, it } from 'vitest';
import { createTripStore } from '../../../src/features/trip/tripStore.js';

describe('Trip store', () => {
  it('normalizes a complete remote aggregate and resolves the current member', () => {
    const store = createTripStore({ activeTripId: 'trip-1' });
    store.hydrateRemote({
      members: [
        { id: 'member-1', name: 'Seb', auth_user_id: 'user-1' },
        { id: 'member-2', name: 'Guest', email: 'guest@example.com' },
      ],
      expenses: [{
        id: 'expense-1', date: '2026-07-05', label: 'Ecolodge', amount: '210', currency: 'AUD',
        paid_by_member_id: 'member-1', budget_date_start: '2026-07-05', budget_date_end: '2026-07-11',
      }],
      shares: [{ id: 'share-1', expense_id: 'expense-1', member_id: 'member-1', share_amount: '105' }],
      settlementEvents: [{ id: 'settlement-1', trip_id: 'trip-1', amount: '20', currency: 'AUD' }],
      budgetLinks: [{ expense_id: 'expense-1', transaction_id: 'tx-1', member_id: 'member-1' }],
      budgetTransactions: [{ id: 'tx-1', affects_budget: true }],
    }, { userId: 'user-1', email: 'seb@example.com' });

    expect(store.state.members[0]).toMatchObject({ id: 'member-1', isMe: true, email: 'seb@example.com' });
    expect(store.state.expenses[0]).toMatchObject({ amount: 210, budgetDateEnd: '2026-07-11' });
    expect(store.state.shares[0]).toMatchObject({ expenseId: 'expense-1', shareAmount: 105 });
    expect(store.state.budgetLinks[0]).toMatchObject({ transactionId: 'tx-1' });
    expect(store.state.budgetTxById.get('tx-1')).toMatchObject({ affects_budget: true });
  });

  it('keeps its state identity while resetting account-scoped data', () => {
    const store = createTripStore({ trips: [{ id: 'trip-1' }], activeTripId: 'trip-1' });
    const reference = store.state;
    store.reset();
    expect(store.state).toBe(reference);
    expect(store.state.trips).toEqual([]);
    expect(store.state.activeTripId).toBeNull();
  });

  it('hydrates the offline snapshot and exports the legacy app shape', () => {
    const store = createTripStore();
    store.hydrateOffline({
      tripMembers: [{ id: 'member-1' }],
      tripExpenses: [{ id: 'expense-1' }],
      tripExpenseShares: [{ id: 'share-1' }],
    });
    expect(store.appSnapshot()).toMatchObject({
      tripMembers: [{ id: 'member-1' }],
      tripParticipants: [{ id: 'member-1' }],
      tripExpenses: [{ id: 'expense-1' }],
    });
  });
});
