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

function mutationClient(resultFor = () => ({ data: null, error: null })) {
  const calls = [];
  return {
    calls,
    from(table) {
      let operation = 'select';
      let payload;
      const resolve = () => Promise.resolve(resultFor({ table, operation, payload, calls }));
      const chain = {
        select(columns) { calls.push({ table, method: 'select', value: columns }); return chain; },
        insert(value) { operation = 'insert'; payload = value; calls.push({ table, method: 'insert', value }); return chain; },
        upsert(value, options) { operation = 'upsert'; payload = value; calls.push({ table, method: 'upsert', value, options }); return chain; },
        update(value) { operation = 'update'; payload = value; calls.push({ table, method: 'update', value }); return chain; },
        delete() { operation = 'delete'; calls.push({ table, method: 'delete' }); return chain; },
        eq(column, value) { calls.push({ table, method: 'eq', column, value }); return chain; },
        in(column, value) { calls.push({ table, method: 'in', column, value }); return chain; },
        single: resolve,
        then(resolvePromise, rejectPromise) { return resolve().then(resolvePromise, rejectPromise); },
      };
      return chain;
    },
  };
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

  it('creates a Trip, its owner access and the default member', async () => {
    const client = mutationClient(({ table, operation }) => ({
      data: table === 'groups' && operation === 'insert' ? { id: 'trip-1', name: 'Road trip' } : null,
      error: null,
    }));
    const repository = createTripRepository(client);
    const result = await repository.createTrip({
      tables: { groups: 'groups', participants: 'participants', members: 'members' },
      userId: 'user-1', name: 'Road trip', baseCurrency: 'AUD', email: 'seb@example.com',
    });
    expect(result.trip).toMatchObject({ id: 'trip-1' });
    expect(client.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'participants', method: 'upsert' }),
      expect.objectContaining({ table: 'members', method: 'insert', value: [expect.objectContaining({ name: 'Moi', email: 'seb@example.com' })] }),
    ]));
  });

  it('retries a member insert without email when the schema rejects it', async () => {
    let memberAttempts = 0;
    const client = mutationClient(({ table, operation }) => {
      if (table === 'members' && operation === 'insert' && ++memberAttempts === 1) {
        return { data: null, error: new Error('email constraint') };
      }
      return { data: null, error: null };
    });
    const repository = createTripRepository(client);
    await repository.addMember({ table: 'members', tripId: 'trip-1', userId: 'user-1', name: 'Alex', email: 'alex@example.com' });
    const inserts = client.calls.filter((call) => call.table === 'members' && call.method === 'insert');
    expect(inserts).toHaveLength(2);
    expect(inserts[0].value[0]).toHaveProperty('email', 'alex@example.com');
    expect(inserts[1].value[0]).not.toHaveProperty('email');
  });

  it('renames and deletes members through scoped mutations', async () => {
    const client = mutationClient();
    const repository = createTripRepository(client);
    await repository.renameMember({ table: 'members', tripId: 'trip-1', memberId: 'member-1', name: 'Alex' });
    await repository.deleteMember({ table: 'members', tripId: 'trip-1', memberId: 'member-1' });
    expect(client.calls).toEqual(expect.arrayContaining([
      { table: 'members', method: 'update', value: { name: 'Alex' } },
      { table: 'members', method: 'delete' },
      { table: 'members', method: 'eq', column: 'trip_id', value: 'trip-1' },
      { table: 'members', method: 'eq', column: 'id', value: 'member-1' },
    ]));
  });

  it('unlinks transactions before deleting the Trip aggregate', async () => {
    const client = mutationClient(({ table, operation }) => ({
      data: table === 'expenses' && operation === 'select'
        ? [{ id: 'expense-1', transaction_id: 'tx-1' }]
        : null,
      error: null,
    }));
    const repository = createTripRepository(client);
    await repository.deleteTrip({
      tables: { groups: 'groups', members: 'members', expenses: 'expenses', shares: 'shares', transactions: 'transactions' },
      tripId: 'trip-1',
    });
    expect(client.calls).toEqual(expect.arrayContaining([
      { table: 'transactions', method: 'update', value: { trip_expense_id: null } },
      { table: 'transactions', method: 'in', column: 'id', value: ['tx-1'] },
      { table: 'expenses', method: 'update', value: { transaction_id: null } },
      { table: 'groups', method: 'delete' },
    ]));
  });
});
