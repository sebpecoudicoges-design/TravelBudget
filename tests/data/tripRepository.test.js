import { describe, expect, it } from 'vitest';
import { createTripRepository } from '../../src/data/tripRepository.js';

function pagedClient(tables, { cap = 11, fail } = {}) {
  const batches = [];
  return { batches, from(table) {
    const filters = [];
    let after = '';
    let limit;
    const q = {
      select: () => q, order: () => q, limit: value => { limit = value; return q; },
      eq: (k, v) => { filters.push(r => r[k] === v); return q; },
      is: (k, v) => { filters.push(r => r[k] === v); return q; },
      gt: (_, v) => { after = v; return q; },
      in: (k, ids) => { batches.push(ids.length); filters.push(r => ids.includes(r[k])); return q; },
      then(resolve, reject) {
        if (fail?.(table, after)) return Promise.resolve({ error: new Error('interrupted') }).then(resolve,reject);
        const rows = (tables[table] || []).filter(r => r.id > after && filters.every(f => f(r)))
          .sort((a,b) => a.id.localeCompare(b.id)).slice(0,Math.min(limit,cap));
        return Promise.resolve({ data: rows }).then(resolve,reject);
      },
    };
    return q;
  }};
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
        order(column, options) { calls.push({ table, method: 'order', column, options }); return chain; },
        limit(value) { calls.push({ table, method: 'limit', value }); return chain; },
        maybeSingle: resolve,
        single: resolve,
        then(resolvePromise, rejectPromise) { return resolve().then(resolvePromise, rejectPromise); },
      };
      return chain;
    },
    rpc(name, args) {
      calls.push({ method: 'rpc', name, args });
      return Promise.resolve(resultFor({ table: null, operation: 'rpc', payload: args, name, calls }));
    },
  };
}

describe('trip repository', () => {
  const tables = { members:'members', expenses:'expenses', shares:'shares', settlementEvents:'events', budgetLinks:'links', transactions:'transactions' };
  const makeRows = (n, fields) => Array.from({ length:n }, (_,i) => ({ id:String(i+1).padStart(5,'0'), trip_id:'trip', ...fields(i) }));
  it('loads every page of a shared Trip even with a smaller server cap', async () => {
    const expenses = makeRows(1103, i => ({ date: i%2 ? '2026-01-01' : '2026-02-01' }));
    const data = { expenses, members: makeRows(23,i => ({ created_at:String(99-i) })),
      shares: makeRows(2206,i => ({ expense_id:expenses[Math.floor(i/2)].id })),
      events: makeRows(20,i => ({ cancelled_at:i%2 ? null : 'yesterday' })),
      links: expenses.map(e => ({ ...e, expense_id:e.id, transaction_id:e.id })),
      transactions: expenses.map(e => ({ id:e.id, trip_expense_id:e.id })) };
    const client = pagedClient(data, { cap:37 });
    const repo = createTripRepository(client);
    const result = await repo.loadActiveTripData({ tripId:'trip', tables });
    expect(result.expenses).toHaveLength(1103);
    expect(result.expenses[0].date).toBe('2026-02-01');
    expect(result.members).toHaveLength(23);
    expect(result.members[0].created_at).toBe('77');
    expect(result.shares).toHaveLength(2206);
    expect(result.settlementEvents).toHaveLength(10);
    expect(new Set(result.budgetTransactions.map(r => r.id)).size).toBe(1103);
    expect(result.budgetLinks).toHaveLength(1103);
    const ids = expenses.map(e => e.id);
    const [main,reverse] = await repo.loadLinkAuditTransactions({ table:'transactions',mainTxIds:ids,expenseIds:ids });
    expect(main).toHaveLength(1103);
    expect(reverse).toHaveLength(1103);
    expect(Math.max(...client.batches)).toBeLessThanOrEqual(64);
  });
  it.each(['shares','links','transactions'])('rejects an incomplete aggregate when page two of %s fails', async table => {
    const rows = makeRows(5, () => ({}));
    const links = rows.map(r => ({ ...r, transaction_id:r.id, expense_id:r.id }));
    const client = pagedClient({ shares:rows, links, transactions:rows }, { cap:2, fail:(t,after) => t===table && !!after });
    await expect(createTripRepository(client).loadActiveTripData({ tripId:'trip', tables })).rejects.toThrow('interrupted');
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

  it('only confirms a whole Trip deletion after the single server operation succeeds', async () => {
    let reply = { error: new Error('delete failed') };
    const client = mutationClient(() => reply);
    const repo = createTripRepository(client);
    await expect(repo.deleteTrip({ tripId:'trip' })).rejects.toThrow('delete failed');
    reply = { data:null };
    await expect(repo.deleteTrip({ tripId:'trip' })).rejects.toThrow('non confirmée');
    reply = { data:'trip' };
    await repo.deleteTrip({ tripId:'trip' });
    expect(client.calls).toEqual(Array(3).fill({ method:'rpc', name:'trip_delete_group_v1', args:{p_trip_id:'trip'} }));
  });

  it('uses atomic settlement RPCs without independent table writes', async () => {
    const client = mutationClient(() => ({ data: 'event-1', error: null }));
    const repository = createTripRepository(client);
    const args = { p_event_id: 'event-1', p_amount: 50 };
    await expect(repository.applySettlement({ args })).resolves.toBe('event-1');
    await repository.cancelSettlement({ eventId: 'event-1' });
    expect(client.calls).toEqual([
      { method: 'rpc', name: 'trip_apply_settlement_v2', args },
      { method: 'rpc', name: 'trip_cancel_settlement_v1', args: { p_event_id: 'event-1' } },
    ]);
  });

  it('propagates RPC failures without a non-atomic fallback', async () => {
    const client = mutationClient(() => ({ data: null, error: new Error('response lost') }));
    const repository = createTripRepository(client);
    await expect(repository.applySettlement({ args: {} })).rejects.toThrow('response lost');
    await expect(repository.cancelSettlement({ eventId: 'event-1' })).rejects.toThrow('response lost');
    expect(client.calls.every(call => call.method === 'rpc')).toBe(true);
    for (const retired of ['createSettlementEvent','findLatestTransaction','linkSettlementTransaction','cancelSettlementEvent','recordSettlementLog']) {
      expect(repository[retired]).toBeUndefined();
    }
  });

  it('deletes an expense fallback and every linked transaction', async () => {
    const client = mutationClient(({ table, operation }) => {
      if (operation === 'select' && table === 'links') return { data: [{ transaction_id: 'tx-share' }], error: null };
      if (operation === 'select' && table === 'transactions') return { data: [{ id: 'tx-payment' }, { id: 'tx-reference' }], error: null };
      return { data: null, error: null };
    });
    const repository = createTripRepository(client);
    await repository.deleteExpenseFallback({
      tables: { budgetLinks: 'links', expenses: 'expenses', transactions: 'transactions', shares: 'shares' },
      deleteTransactionRpc: 'delete_transaction',
      expenseId: 'expense-1',
      transactionId: 'tx-payment',
    });
    const deletedIds = client.calls
      .filter((call) => call.method === 'rpc')
      .map((call) => call.args.p_tx_id);
    expect(deletedIds).toEqual(['tx-share', 'tx-payment', 'tx-reference']);
    expect(client.calls).toEqual(expect.arrayContaining([
      { table: 'shares', method: 'delete' },
      { table: 'expenses', method: 'delete' },
    ]));
  });

  it('moves an expense and its shares even when optional budget links fail', async () => {
    const client = mutationClient(({ table, operation }) => ({
      data: null,
      error: table === 'links' && operation === 'update' ? new Error('links unavailable') : null,
    }));
    const repository = createTripRepository(client);
    const result = await repository.moveExpense({
      tables: { expenses: 'expenses', shares: 'shares', budgetLinks: 'links' },
      expenseId: 'expense-1', tripId: 'trip-2',
    });
    expect(result.budgetLinkError).toMatchObject({ message: 'links unavailable' });
    expect(client.calls).toEqual(expect.arrayContaining([
      { table: 'expenses', method: 'update', value: { trip_id: 'trip-2' } },
      { table: 'shares', method: 'update', value: { trip_id: 'trip-2' } },
    ]));
  });

  it('applies an expense atomically and returns its identifier', async () => {
    const client = mutationClient(({ operation, name }) => ({
      data: operation === 'rpc' && name === 'trip_apply_expense_v2' ? [{ expense_id: 'expense-1' }] : null,
      error: null,
    }));
    const repository = createTripRepository(client);
    await expect(repository.applyExpense({
      rpcName: 'trip_apply_expense_v2', tripId: 'trip-1', payload: { label: 'Lunch' },
    })).resolves.toBe('expense-1');
    expect(client.calls).toContainEqual({
      method: 'rpc', name: 'trip_apply_expense_v2',
      args: { p_trip_id: 'trip-1', p_payload: { label: 'Lunch' } },
    });
  });

  it('reads expenses by id and by offline fingerprint', async () => {
    const client = mutationClient(({ table, operation, calls }) => {
      if (table !== 'expenses' || operation !== 'select') return { data: null, error: null };
      const idLookup = calls.some((call) => call.table === table && call.method === 'eq' && call.column === 'id');
      return { data: idLookup ? { id: 'expense-1' } : [{ id: 'expense-2', created_at: '2026-07-05T09:00:00Z' }], error: null };
    });
    const repository = createTripRepository(client);
    await expect(repository.getExpenseById({ table: 'expenses', expenseId: 'expense-1' })).resolves.toEqual({ id: 'expense-1' });
    client.calls.length = 0;
    await expect(repository.findExpenseByFingerprint({
      table: 'expenses', tripId: 'trip-1', date: '2026-07-05', label: 'Lunch',
      amount: 20, currency: 'AUD', paidByMemberId: 'member-1', kind: 'income',
    })).resolves.toBe('expense-2');
    expect(client.calls).toContainEqual({ table: 'expenses', method: 'eq', column: 'kind', value: 'income' });
  });

  it('links and unlinks an expense transaction bidirectionally', async () => {
    const client = mutationClient(({ table, operation, calls }) => {
      if (operation !== 'select') return { data: null, error: null };
      const expenseLinked = calls.some((call) => call.table === 'expenses' && call.method === 'update' && call.value?.transaction_id === 'tx-1');
      const transactionLinked = calls.some((call) => call.table === 'transactions' && call.method === 'update' && call.value?.trip_expense_id === 'expense-1');
      if (table === 'expenses') return { data: { id: 'expense-1', transaction_id: expenseLinked ? 'tx-1' : null }, error: null };
      return { data: { id: 'tx-1', trip_expense_id: transactionLinked ? 'expense-1' : null }, error: null };
    });
    const repository = createTripRepository(client);
    await repository.linkExpenseTransaction({
      tables: { expenses: 'expenses', transactions: 'transactions' },
      expenseId: 'expense-1', transactionId: 'tx-1',
    });
    await repository.unlinkExpenseTransaction({
      tables: { expenses: 'expenses', transactions: 'transactions' },
      expenseId: 'expense-1', transactionId: 'tx-1',
    });
    expect(client.calls).toEqual(expect.arrayContaining([
      { table: 'expenses', method: 'update', value: { transaction_id: 'tx-1' } },
      { table: 'transactions', method: 'update', value: { trip_expense_id: 'expense-1' } },
      { table: 'expenses', method: 'update', value: { transaction_id: null } },
      { table: 'transactions', method: 'update', value: { trip_expense_id: null } },
    ]));
  });
});
