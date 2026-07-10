import { describe, expect, it, vi } from 'vitest';
import { createEntityStore } from '../../../src/data/entityStore.js';
import { createNutritionStore } from '../../../src/features/nutrition/nutritionStore.js';

describe('Nutrition store', () => {
  it('keeps Nutrition state in entityStore and notifies domain subscribers', () => {
    const entityStore = createEntityStore();
    const store = createNutritionStore({}, { entityStore });
    const listener = vi.fn();
    store.subscribe(listener);

    store.hydrateFoods([{ key: 'banana' }]);

    expect(store.state.foods).toEqual([{ key: 'banana' }]);
    expect(entityStore.get('nutrition').foods).toEqual([{ key: 'banana' }]);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ foods: [{ key: 'banana' }] }), 'nutrition');
  });

  it('hydrates remote meals, items and sleep then exports the legacy app shape', () => {
    const store = createNutritionStore();
    store.hydrateRemote({
      meals: [{ id: 'meal-1', meal_date: '2026-07-10' }],
      items: [{ id: 'item-1', meal_id: 'meal-1', kcal: 120 }],
      sleep: { '2026-07-09': { hours: 8, quality: 'good' } },
    });
    store.hydrateFoods([{ key: 'muesli' }]);

    expect(store.appSnapshot()).toEqual({
      nutritionMeals: [{ id: 'meal-1', meal_date: '2026-07-10' }],
      nutritionMealItems: [{ id: 'item-1', meal_id: 'meal-1', kcal: 120 }],
      nutritionFoods: [{ key: 'muesli' }],
      nutritionSleep: { '2026-07-09': { hours: 8, quality: 'good' } },
    });
  });

  it('hydrates local rows and selects rows for the active day', () => {
    const store = createNutritionStore();
    store.hydrateLocal([
      {
        syncId: 'nutrition-1',
        meal: { id: 'meal-1', meal_date: '2026-07-10', meal_type: 'breakfast' },
        item: { id: 'item-1', meal_id: 'meal-1', kcal: 220 },
      },
      {
        syncId: 'nutrition-2',
        meal: { id: 'meal-2', meal_date: '2026-07-09', meal_type: 'dinner' },
        item: { id: 'item-2', meal_id: 'meal-2', kcal: 420 },
      },
    ]);

    expect(store.selectedRows('2026-07-10')).toEqual({
      meals: [{ id: 'meal-1', meal_date: '2026-07-10', meal_type: 'breakfast' }],
      items: [{ id: 'item-1', meal_id: 'meal-1', kcal: 220 }],
    });
  });

  it('merges optimistic rows and confirms them without keeping local duplicates', () => {
    const store = createNutritionStore({
      meals: [{ id: 'remote-old', sync_id: 'nutrition-1' }],
      items: [{ id: 'remote-item-old', meal_id: 'remote-old' }],
    });
    const localRow = {
      syncId: 'nutrition-1',
      meal: { id: 'local-meal', sync_id: 'nutrition-1', label: 'Banane' },
      item: { id: 'local-item', meal_id: 'local-meal', label: 'Banane' },
    };

    store.mergeOptimisticRow(localRow);
    expect(store.state.meals[0]).toMatchObject({ id: 'local-meal', localOnly: true, offlinePending: true });

    store.confirmLocalRow(localRow, { id: 'remote-meal', sync_id: 'nutrition-1' }, { id: 'remote-item', meal_id: 'remote-meal' });
    expect(store.state.meals).toEqual([{ id: 'remote-meal', sync_id: 'nutrition-1', label: 'Banane', localOnly: false, offlinePending: false }]);
    expect(store.state.items).toEqual([{ id: 'remote-item', meal_id: 'remote-meal', label: 'Banane', localOnly: false, offlinePending: false }]);
  });

  it('resets account scoped data without dropping default UI filters', () => {
    const store = createNutritionStore({
      loaded: true,
      meals: [{ id: 'meal-1' }],
      foodCategory: 'snacks',
    });

    store.resetAccountScope();

    expect(store.state.loaded).toBe(false);
    expect(store.state.meals).toEqual([]);
    expect(store.state.foodCategory).toBe('all');
  });
});
