import { describe, expect, it } from 'vitest';
import {
  createNutritionRepository,
  isDuplicateNutritionError,
  isOfflineSkipError,
  localNutritionRowKey,
  makeLocalNutritionRow,
  notesWithNutritionSyncId,
  saveLocalNutritionRowOnce,
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
      syncId: 'nutrition_fixed',
      userId: 'user-1',
      travelId: 'travel-1',
      now: () => new Date('2026-07-10T08:00:00Z'),
    });
    expect(localNutritionRowKey(row)).toBe('nutrition_fixed');
    expect(row.meal.notes).toContain('tb_sync:nutrition_fixed');

    saveLocalNutritionRowOnce({ storage, key: 'local', row });
    saveLocalNutritionRowOnce({ storage, key: 'local', row: { ...row, syncError: 'retry' } });
    const rows = repository.loadLocalNutritionRows({ storage, key: 'local' });
    expect(rows).toHaveLength(1);
    expect(rows[0].syncError).toBe('retry');
  });

  it('merges sleep rows locally with normalized values', () => {
    const storage = memoryStorage();
    const repository = createNutritionRepository(null);
    repository.mergeSleepRows({
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

  it('syncs a local meal row through the Supabase boundary once', async () => {
    const client = clientWith(({ table, operation }) => {
      if (table === 'meals' && operation === 'select') return { data: null, error: null };
      if (table === 'meals' && operation === 'upsert') return { data: { id: 'meal-1' }, error: null };
      if (table === 'items' && operation === 'select') return { data: [], error: null };
      if (table === 'items' && operation === 'insert') return { data: [], error: null };
      return { data: [], error: null };
    });
    const repository = createNutritionRepository(client);
    const row = makeLocalNutritionRow({
      food: { key: 'muesli', name: 'Muesli' },
      grams: 45,
      nut: { kcal: 164, protein: 4.5, carbs: 28, fat: 3.2, fiber: 3.6 },
      mealType: 'breakfast',
      mealDate: '2026-07-10',
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
      value: expect.objectContaining({ sync_id: 'nutrition_muesli', notes: 'tb_sync:nutrition_muesli' }),
      options: { onConflict: 'user_id,sync_id' },
    });
    expect(client.calls).toContainEqual({
      table: 'items',
      method: 'insert',
      value: expect.objectContaining({ meal_id: 'meal-1', label: 'Muesli', grams: 45 }),
    });
  });

  it('keeps sync markers idempotent and classifies common sync errors', () => {
    expect(notesWithNutritionSyncId('hello tb_sync:abc', 'abc')).toBe('hello tb_sync:abc');
    expect(isOfflineSkipError(new Error('Failed to fetch'))).toBe(true);
    expect(isDuplicateNutritionError({ code: '23505' })).toBe(true);
  });
});
