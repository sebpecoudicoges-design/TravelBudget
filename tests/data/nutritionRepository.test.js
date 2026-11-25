import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import vm from 'node:vm';
import {
  createNutritionRepository,
  isDuplicateNutritionError,
  isOfflineSkipError,
  localNutritionRowKey,
  makeLocalNutritionRow,
  notesWithNutritionSyncId,
  saveLocalNutritionRowOnce,
  saveLocalNutritionRowsOnce,
} from '../../src/data/nutritionRepository.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

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
        upsert(value, options) { operation = 'upsert'; payload = value; calls.push({ table, method: 'upsert', value, options }); return chain; },
        eq(column, value) { calls.push({ table, method: 'eq', column, value }); return chain; },
        limit(value) { calls.push({ table, method: 'limit', value }); return chain; },
        single: resolve,
        maybeSingle: resolve,
        then(onFulfilled, onRejected) { return resolve().then(onFulfilled, onRejected); },
      };
      return chain;
    },
  };
}

describe('nutrition repository', () => {
  it('preserves pending meals through the legacy fallback when the repository is unavailable', () => {
    const source = fs.readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
    const fallback = source.slice(source.indexOf('  function requireNutritionWrite(ok)'), source.indexOf('  function localNutritionRowKey('));
    const storage = memoryStorage();
    const rows = Array.from({ length: 5000 }, (_, index) => ({ syncId: `pending-${index}` }));
    vm.runInNewContext(`${fallback}\nsaveLocalMeals(rows);`, { repository: () => ({}), localMealKey: () => 'pending', localStorage: storage, rows });
    expect(JSON.parse(storage.getItem('pending'))).toEqual(rows);
  });
  it.each([201, 5000])('preserves all %i pending meals through reload, edit and discard', count => {
    const storage = memoryStorage();
    const rows = Array.from({ length: count }, (_, index) => ({ syncId: `pending-${index}`, meal: { label: `Meal ${index}` } }));
    saveLocalNutritionRowsOnce({ storage, key: 'pending', rows });
    const repository = createNutritionRepository(null);
    expect(repository.loadLocalNutritionRows({ storage, key: 'pending' })).toEqual(rows);
    saveLocalNutritionRowOnce({ storage, key: 'pending', row: { ...rows[count - 1], syncError: 'retry' } });
    const reloaded = repository.loadLocalNutritionRows({ storage, key: 'pending' });
    expect(reloaded).toHaveLength(count);
    expect(reloaded[0]).toMatchObject({ syncId: `pending-${count - 1}`, syncError: 'retry' });
    repository.discardLocalNutritionRow({ storage, key: 'pending', rowKey: 'pending-0' });
    expect(repository.loadLocalNutritionRows({ storage, key: 'pending' })).toHaveLength(count - 1);
    expect(repository.loadLocalNutritionRows({ storage, key: 'pending' }).some(row => row.syncId === 'pending-0')).toBe(false);
  });
  it('stores cached foods and local rows with limits and stable keys', () => {
    const storage = memoryStorage();
    const repository = createNutritionRepository(null);
    const foods = Array.from({ length: 510 }, (_, index) => ({ key: `food-${index}` }));
    repository.saveCachedFoods({ storage, key: 'foods', rows: foods });
    expect(repository.loadCachedFoods({ storage, key: 'foods' })).toHaveLength(500);

    const row = makeLocalNutritionRow({
      food: { key: 'banana', name: 'Banane' },
      grams: 120,
      nut: { kcal: 107, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3 },
      mealType: 'morning_snack',
      mealDate: '2026-07-10',
      consumedTime: '08:15',
      syncId: 'nutrition_fixed',
      userId: 'user-1',
      travelId: 'travel-1',
      now: () => new Date('2026-07-10T08:00:00Z'),
    });
    expect(localNutritionRowKey(row)).toBe('nutrition_fixed');
    expect(row.meal.notes).toContain('tb_sync:nutrition_fixed');
    expect(row.meal.consumed_time).toBe('08:15');

    saveLocalNutritionRowOnce({ storage, key: 'local', row });
    saveLocalNutritionRowOnce({ storage, key: 'local', row: { ...row, syncError: 'retry' } });
    const rows = repository.loadLocalNutritionRows({ storage, key: 'local' });
    expect(rows).toHaveLength(1);
    expect(rows[0].syncError).toBe('retry');
  });

  it('merges sleep rows locally with normalized values', async () => {
    const storage = memoryStorage();
    const repository = createNutritionRepository(null);
    (await repository.sleepWrites()).mergeSleepRows({
      storage,
      key: 'sleep',
      rows: {
        '2026-07-09': { hours: '8.5', quality: 'good', updated_at: 'remote' },
        bad: { hours: 99 },
      },
    });
    expect(repository.loadSleepRows({ storage, key: 'sleep' })).toEqual({
      '2026-07-09': { hours: 8.5, quality: 'good', updatedAt: 'remote' },
    });
  });

  it('persists a favorite meal batch with one storage write and stable deduplication', () => {
    const storage = memoryStorage();
    let writes = 0;
    const countedStorage = {
      ...storage,
      setItem(key, value) { writes += 1; storage.setItem(key, value); },
    };
    const rows = ['a', 'b', 'c'].map(syncId => ({ syncId, meal: { sync_id: syncId } }));

    saveLocalNutritionRowsOnce({ storage: countedStorage, key: 'local', rows });
    saveLocalNutritionRowsOnce({ storage: countedStorage, key: 'local', rows: [{ ...rows[1], syncError: 'retry' }] });

    expect(writes).toBe(2);
    expect(JSON.parse(countedStorage.getItem('local'))).toEqual([
      expect.objectContaining({ syncId: 'b', syncError: 'retry' }),
      expect.objectContaining({ syncId: 'a' }),
      expect.objectContaining({ syncId: 'c' }),
    ]);
  });

  it('syncs a local meal row through the Supabase boundary once', async () => {
    const client = clientWith(({ table, operation, payload }) => {
      if (table === 'meals' && operation === 'select') return { data: null, error: null };
      if (table === 'meals' && operation === 'upsert') return { data: { ...payload, id: 'meal-1', consumed_time: '07:45:00' }, error: null };
      if (table === 'items' && operation === 'select') return { data: [], error: null };
      if (table === 'items' && operation === 'insert') return { data: null, error: null };
      return { data: [], error: null };
    });
    const repository = createNutritionRepository(client);
    const row = makeLocalNutritionRow({
      food: { key: 'muesli', name: 'Muesli' },
      grams: 45,
      nut: { kcal: 164, protein: 4.5, carbs: 28, fat: 3.2, fiber: 3.6 },
      mealType: 'breakfast',
      mealDate: '2026-07-10',
      consumedTime: '07:45',
      syncId: 'nutrition_muesli',
      userId: 'user-1',
      travelId: 'travel-1',
      now: () => new Date('2026-07-10T08:00:00Z'),
    });

    await expect(repository.syncLocalRow({
      tables: { meals: 'meals', items: 'items' },
      row,
      userId: 'user-1',
      travelId: 'travel-1',
      fallbackDate: '2026-07-10',
    })).resolves.toEqual({ mealId: 'meal-1', syncedItem: true });

    expect(client.calls).toContainEqual({
      table: 'meals',
      method: 'upsert',
      value: expect.objectContaining({ sync_id: 'nutrition_muesli', notes: 'tb_sync:nutrition_muesli', consumed_time: '07:45' }),
      options: { onConflict: 'user_id,sync_id', ignoreDuplicates: true },
    });
    expect(client.calls).toContainEqual({
      table: 'items',
      method: 'insert',
      value: expect.objectContaining({ meal_id: 'meal-1', label: 'Muesli', grams: 45 }),
    });
  });

  const replayRow = makeLocalNutritionRow({
    food: { key: 'muesli', name: 'Muesli' }, grams: 45, nut: { kcal: 164 }, mealType: 'breakfast',
    mealDate: '2026-07-10', syncId: 'nutrition_muesli', userId: 'user-1',
  });
  const meal = { ...replayRow.meal, id: 'meal-1' };
  const replay = (client, row = replayRow, extra = {}) => createNutritionRepository(client).syncLocalRow({
    tables: { meals: 'meals', items: 'items' }, row, userId: 'user-1', travelId: 'not-the-saved-travel',
    fallbackDate: '2026-07-10', ...extra,
  });

  it('confirms exact item collision only after reading the matching committed values', async () => {
    let reads = 0;
    const client = clientWith(({ table, operation }) => {
      if (table === 'meals') return { data: meal };
      if (operation === 'select') return { data: ++reads === 1 ? [] : [replayRow.item] };
      return { error: { code: '23505', message: 'nutrition_meal_items_exact_dedupe_idx' } };
    });
    await expect(replay(client)).resolves.toEqual({ mealId: 'meal-1', syncedItem: true });
    expect(reads).toBe(2);
  });

  it.each([
    ['edited grams', {}, [{ ...replayRow.item, grams: 20 }]],
    ['changed macros with the same label and amount', {}, [{ ...replayRow.item, fiber_g: 4 }]],
    ['different food with an identical label', {}, [{ ...replayRow.item, food_key: 'other' }]],
    ['ambiguous multiple items', {}, [replayRow.item, replayRow.item]],
    ['water changed in an otherwise matching meal', { water_ml: 150 }, [replayRow.item]],
    ['semantically different meal time', { consumed_time: '07:45:21' }, [replayRow.item]],
  ])('does not insert or confirm a different remote meal: %s', async (_description, header, items) => {
    const client = clientWith(({ table }) => ({ data: table === 'meals' ? { ...meal, ...header } : items }));
    await expect(replay(client)).resolves.toEqual({ mealId: 'meal-1', skippedItem: true });
    expect(client.calls.some(call => ['upsert', 'insert'].includes(call.method))).toBe(false);
  });

  it('re-reads a meal won by a competing request without overwriting its header', async () => {
    let reads = 0;
    const client = clientWith(({ table, operation }) => {
      expect(table).toBe('meals');
      return { data: operation === 'select' && ++reads > 1 ? { ...meal, water_ml: 250 } : null };
    });
    await expect(replay(client)).resolves.toEqual({ mealId: 'meal-1', skippedItem: true });
    expect(client.calls.find(call => call.method === 'upsert').options.ignoreDuplicates).toBe(true);
  });

  it('uses the real Supabase client to recover an ignored race without a replacing write', async () => {
    const requests = [];
    let mealReads = 0;
    const client = createClient('https://fixture.example', 'synthetic-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (url, init) => {
        const method = init.method;
        const path = new URL(url);
        requests.push({ method, path, prefer: new Headers(init.headers).get('prefer') });
        if (method === 'POST') return Response.json([], { status: 201 });
        if (path.pathname.endsWith('/meals')) return Response.json(++mealReads === 1 ? [] : [meal]);
        return Response.json([replayRow.item]);
      } },
    });
    await expect(replay(client)).resolves.toEqual({ mealId: 'meal-1', syncedItem: true });
    expect(requests.map(r => r.method)).toEqual(['GET', 'POST', 'GET', 'GET']);
    expect(requests[1].path.searchParams.get('on_conflict')).toBe('user_id,sync_id');
    expect(requests[1].prefer).toContain('resolution=ignore-duplicates');
    expect(requests[2].path.searchParams.get('user_id')).toBe('eq.user-1');
    expect(requests[3].path.searchParams.get('meal_id')).toBe('eq.meal-1');
  });

  it('keeps a header when only the item failed and retries without a second header', async () => {
    let committedMeal = null;
    let fail = true;
    const client = clientWith(({ table, operation, payload }) => {
      if (table === 'meals' && operation === 'select') return { data: committedMeal };
      if (table === 'meals' && operation === 'upsert') return { data: committedMeal = { ...payload, id: 'meal-1' } };
      if (operation === 'select') return { data: [] };
      return fail ? { error: new Error('offline') } : { data: null };
    });
    await expect(replay(client)).rejects.toThrow('offline');
    fail = false;
    await expect(replay(client)).resolves.toEqual({ mealId: 'meal-1', syncedItem: true });
    expect(client.calls.filter(call => call.method === 'upsert')).toHaveLength(1);
  });

  it('does not write after an account switch while loading the meal', async () => {
    let current = true;
    const client = clientWith(() => {
      current = false;
      return { data: null };
    });
    await expect(replay(client, replayRow, { isCurrent: () => current })).rejects.toThrow('entry changed');
    expect(client.calls.some(call => ['upsert', 'insert'].includes(call.method))).toBe(false);
  });

  it('keeps sync markers idempotent and classifies common sync errors', () => {
    expect(notesWithNutritionSyncId('hello tb_sync:abc', 'abc')).toBe('hello tb_sync:abc');
    expect(isOfflineSkipError(new Error('Failed to fetch'))).toBe(true);
    expect(isDuplicateNutritionError({ code: '23505' })).toBe(true);
  });
});
