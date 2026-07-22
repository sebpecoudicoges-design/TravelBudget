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
        gte(column, value) { calls.push({ table, method: 'gte', column, value }); return chain; },
        upsert(value, options) { operation = 'upsert'; payload = value; calls.push({ table, method: 'upsert', value, options }); return chain; },
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

  it('persists progression snapshots without changing program loads', async () => {
    const client = clientWith(() => ({ data: [], error: null }));
    const repository = createSportRepository(client);
    await repository.saveProgression({
      tables: { metrics: 'metrics', history: 'metric_history', recommendations: 'recommendations' },
      rows: {
        metrics: [{ user_id: 'user-1', exercise_id: 'barbell_back_squat' }],
        history: [{ user_id: 'user-1', exercise_id: 'barbell_back_squat' }],
        recommendations: [{ user_id: 'user-1', exercise_id: 'barbell_back_squat', recommended_weight_kg: 90 }],
      },
    });
    expect(client.calls.some((call) => call.table === 'metrics' && call.method === 'upsert')).toBe(true);
    expect(client.calls.some((call) => call.table === 'metric_history' && call.method === 'insert')).toBe(true);
    expect(client.calls.some((call) => call.table === 'recommendations' && call.method === 'upsert')).toBe(true);
    expect(client.calls.some((call) => call.table === 'sport_program_exercises')).toBe(false);
  });

  it('loads exercise metric history for progression charts', async () => {
    const rows = [{ id: 'hist-1', exercise_id: 'barbell_bench_press', estimated_1rm_kg: 76 }];
    const client = clientWith(({ table }) => ({ data: table === 'metric_history' ? rows : [], error: null }));
    const repository = createSportRepository(client);

    await expect(repository.loadExerciseMetricHistory({
      table: 'metric_history',
      userId: 'user-1',
      limit: 120,
    })).resolves.toEqual(rows);

    expect(client.calls).toEqual(expect.arrayContaining([
      { table: 'metric_history', method: 'eq', column: 'user_id', value: 'user-1' },
      { table: 'metric_history', method: 'order', column: 'created_at', options: { ascending: false } },
      { table: 'metric_history', method: 'limit', value: 120 },
    ]));
  });

  it('applies compatible load recommendations only inside the source program', async () => {
    let programSessionSelectCount = 0;
    const client = clientWith(({ table, operation, calls }) => {
      if (table === 'program_exercises' && operation === 'select') return { data: [{ id: 'exercise-row-1', session_id: 'session-a1' }], error: null };
      if (table === 'program_sessions' && operation === 'select') {
        programSessionSelectCount += 1;
        return programSessionSelectCount === 1
          ? { data: [{ id: 'session-a1', program_id: 'program-1' }], error: null }
          : { data: [{ id: 'session-a1' }, { id: 'session-b1' }], error: null };
      }
      return { data: [], error: null };
    });
    const repository = createSportRepository(client);

    await repository.applyRecommendation({
      tables: { recommendations: 'recommendations', programExercises: 'program_exercises', programSessions: 'program_sessions' },
      recommendation: {
        id: 'rec-1',
        exercise_id: 'barbell_bench_press',
        program_exercise_id: 'exercise-row-1',
        current_program_weight_kg: 60,
        recommended_weight_kg: 65,
      },
      userId: 'user-1',
      scope: 'compatible_occurrences',
    });

    expect(client.calls).toEqual(expect.arrayContaining([
      { table: 'program_exercises', method: 'eq', column: 'id', value: 'exercise-row-1' },
      { table: 'program_sessions', method: 'eq', column: 'id', value: 'session-a1' },
      { table: 'program_sessions', method: 'eq', column: 'program_id', value: 'program-1' },
      { table: 'program_exercises', method: 'eq', column: 'exercise_key', value: 'barbell_bench_press' },
      { table: 'program_exercises', method: 'in', column: 'session_id', value: ['session-a1', 'session-b1'] },
    ]));
  });
});
