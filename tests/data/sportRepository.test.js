import { describe, expect, it } from 'vitest';
import { createSportRepository } from '../../src/data/sportRepository.js';

function clientWith(handler) {
  const calls = [];
  return {
    calls,
    from(table) {
      let operation = 'select';
      let payload;
      const resolve = () => Promise.resolve(handler({ table, operation, payload, calls }));
      const chain = {
        select(value) { calls.push({ table, method: 'select', value }); return chain; },
        insert(value) { operation = 'insert'; payload = value; calls.push({ table, method: 'insert', value }); return chain; },
        update(value) { operation = 'update'; payload = value; calls.push({ table, method: 'update', value }); return chain; },
        delete() { operation = 'delete'; calls.push({ table, method: 'delete' }); return chain; },
        eq(column, value) { calls.push({ table, method: 'eq', column, value }); return chain; },
        in(column, value) { calls.push({ table, method: 'in', column, value }); return chain; },
        order(column, options) { calls.push({ table, method: 'order', column, options }); return chain; },
        limit(value) { calls.push({ table, method: 'limit', value }); return chain; },
        single: resolve,
        then(onFulfilled, onRejected) { return resolve().then(onFulfilled, onRejected); },
      };
      return chain;
    },
  };
}

describe('sport repository', () => {
  const tables = { sessions: 'sessions', items: 'items', sets: 'sets' };

  it('loads sessions, items and sets through one history boundary', async () => {
    const rows = {
      sessions: [{ id: 'session-1' }],
      items: [{ id: 'item-1', session_id: 'session-1' }],
      sets: [{ id: 'set-1', item_id: 'item-1' }],
    };
    const client = clientWith(({ table }) => ({ data: rows[table], error: null }));
    const repository = createSportRepository(client);

    await expect(repository.loadHistory({ tables, userId: 'user-1' })).resolves.toEqual({
      sessions: rows.sessions,
      items: rows.items,
      sets: rows.sets,
    });
  });

  it('creates a complete workout and binds sets to inserted items', async () => {
    const client = clientWith(({ table, operation }) => {
      if (table === 'sessions' && operation === 'insert') return { data: { id: 'session-1' }, error: null };
      if (table === 'items' && operation === 'insert') return { data: [{ id: 'item-1', sort_order: 0 }], error: null };
      return { data: [], error: null };
    });
    const repository = createSportRepository(client);
    const result = await repository.createWorkout({
      tables,
      rows: {
        session: { user_id: 'user-1' },
        items: [{ user_id: 'user-1', sort_order: 0 }],
        sets: [{ user_id: 'user-1', itemIndex: 0, set_index: 1, reps: 12 }],
      },
    });

    expect(result.sessionId).toBe('session-1');
    expect(client.calls).toContainEqual({
      table: 'sets',
      method: 'insert',
      value: [{ user_id: 'user-1', set_index: 1, reps: 12, item_id: 'item-1' }],
    });
  });

  it('finds duplicates and deletes all workout children', async () => {
    const client = clientWith(({ table, operation }) => {
      if (table === 'sessions' && operation === 'select') return { data: [{ id: 'session-1' }], error: null };
      if (table === 'items' && operation === 'select') return { data: [{ id: 'item-1' }], error: null };
      return { data: [], error: null };
    });
    const repository = createSportRepository(client);

    await expect(repository.findExistingWorkout({
      table: 'sessions', userId: 'user-1', activityType: 'strength',
      startedAt: '2026-07-06T08:00:00Z', durationSeconds: 1200,
    })).resolves.toBe('session-1');
    await repository.deleteWorkout({ tables, sessionId: 'session-1' });
    expect(client.calls).toEqual(expect.arrayContaining([
      { table: 'sets', method: 'delete' },
      { table: 'items', method: 'delete' },
      { table: 'sessions', method: 'delete' },
    ]));
  });
});
