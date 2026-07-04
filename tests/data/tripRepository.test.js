import { describe, expect, it } from 'vitest';
import { createTripRepository } from '../../src/data/tripRepository.js';

function query(result) {
  const promise = Promise.resolve(result);
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => promise,
    is: () => promise,
    then: promise.then.bind(promise),
  };
  return chain;
}

describe('trip repository', () => {
  it('loads the active Trip aggregate through one data boundary', async () => {
    const rows = {
      members: [{ id: 'member-1' }], expenses: [{ id: 'expense-1' }],
      shares: [{ id: 'share-1' }], settlements: [{ id: 'settlement-1' }],
    };
    const client = { from: (table) => query({ data: rows[table], error: null }) };
    const repository = createTripRepository(client);

    await expect(repository.loadActiveTripData({
      tripId: 'trip-1',
      tables: { members: 'members', expenses: 'expenses', shares: 'shares', settlementEvents: 'settlements' },
    })).resolves.toEqual({
      members: rows.members,
      expenses: rows.expenses,
      shares: rows.shares,
      settlementEvents: rows.settlements,
      budgetLinks: [],
      budgetTransactions: [],
    });
  });

  it('loads budget links and their transactions into the same aggregate', async () => {
    const rows = {
      members: [], expenses: [{ id: 'expense-1' }], shares: [], settlements: [],
      links: [{ expense_id: 'expense-1', transaction_id: 'tx-1', member_id: 'member-1' }],
      transactions: [{ id: 'tx-1', affects_budget: true }],
    };
    const client = { from: (table) => {
      const chain = query({ data: rows[table], error: null });
      chain.in = () => Promise.resolve({ data: rows[table], error: null });
      return chain;
    } };
    const repository = createTripRepository(client);

    const result = await repository.loadActiveTripData({
      tripId: 'trip-1',
      tables: {
        members: 'members', expenses: 'expenses', shares: 'shares', settlementEvents: 'settlements',
        budgetLinks: 'links', transactions: 'transactions',
      },
    });
    expect(result.budgetLinks).toEqual(rows.links);
    expect(result.budgetTransactions).toEqual(rows.transactions);
  });

  it('propagates a Supabase read error', async () => {
    const client = { from: () => query({ data: null, error: new Error('read failed') }) };
    const repository = createTripRepository(client);
    await expect(repository.loadActiveTripData({
      tripId: 'trip-1',
      tables: { members: 'a', expenses: 'b', shares: 'c', settlementEvents: 'd' },
    })).rejects.toThrow('read failed');
  });

  it('keeps the main Trip aggregate when optional budget links fail', async () => {
    const client = { from: (table) => {
      const result = table === 'links'
        ? { data: null, error: new Error('budget links unavailable') }
        : { data: table === 'expenses' ? [{ id: 'expense-1' }] : [], error: null };
      const chain = query(result);
      chain.in = () => Promise.resolve(result);
      return chain;
    } };
    const repository = createTripRepository(client);
    const result = await repository.loadActiveTripData({
      tripId: 'trip-1',
      tables: {
        members: 'members', expenses: 'expenses', shares: 'shares', settlementEvents: 'settlements',
        budgetLinks: 'links', transactions: 'transactions',
      },
    });
    expect(result.expenses).toEqual([{ id: 'expense-1' }]);
    expect(result.budgetLinks).toEqual([]);
    expect(result.budgetLoadError).toMatchObject({ message: 'budget links unavailable' });
  });
});
