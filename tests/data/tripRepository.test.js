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
    });
  });

  it('propagates a Supabase read error', async () => {
    const client = { from: () => query({ data: null, error: new Error('read failed') }) };
    const repository = createTripRepository(client);
    await expect(repository.loadActiveTripData({
      tripId: 'trip-1',
      tables: { members: 'a', expenses: 'b', shares: 'c', settlementEvents: 'd' },
    })).rejects.toThrow('read failed');
  });
});
