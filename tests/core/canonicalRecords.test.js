import { describe, expect, it } from 'vitest';
import { canonicalNutritionEntry, canonicalSportSession, canonicalTransaction } from '../../src/core/canonicalRecords.js';

describe('canonical records', () => {
  it('normalizes transaction snake_case and camelCase fields', () => {
    expect(canonicalTransaction({
      id: 'tx-1', user_id: 'u1', wallet_id: 'w1', type: 'EXPENSE', amount: '12.5', currency: 'aud',
      date_start: '2026-06-30', budget_date_start: '2026-06-29', budget_date_end: '2026-07-01', pay_now: false,
    })).toMatchObject({
      id: 'tx-1', userId: 'u1', walletId: 'w1', type: 'expense', amount: 12.5, currency: 'AUD',
      cashDate: '2026-06-30', budgetDateStart: '2026-06-29', budgetDateEnd: '2026-07-01', payNow: false,
    });
  });

  it('normalizes nutrition and sport cache records', () => {
    expect(canonicalNutritionEntry({ meal: { id: 'm1', meal_date: '2026-06-30', meal_type: 'lunch', water_ml: 250 }, item: { food_key: 'rice', grams: 100, kcal: 130 } }))
      .toMatchObject({ id: 'm1', date: '2026-06-30', mealType: 'lunch', foodKey: 'rice', grams: 100, kcal: 130, waterMl: 250 });
    expect(canonicalSportSession({ id: 's1', session_date: '2026-06-30', duration_seconds: 600, kcal_estimate: 80, items: [] }))
      .toMatchObject({ id: 's1', date: '2026-06-30', durationSeconds: 600, kcal: 80, items: [] });
  });
});

