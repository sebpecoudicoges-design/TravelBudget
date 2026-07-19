import { describe, expect, it } from 'vitest';

import {
  activitySummaryForDate,
  ageFromBirthDate,
  healthActionRows,
  healthSummaryForDate,
  isCashPendingProjectionTx,
  nutritionSummaryForDate,
  txAffectsBudget,
  txAffectsCash,
} from '../../../src/features/kpi/kpiHealthRules.js';

describe('KPI health rules', () => {
  it('classifies budget, cash and pending projection transactions', () => {
    expect(txAffectsBudget({ type: 'expense', affectsBudget: true })).toBe(true);
    expect(txAffectsBudget({ type: 'income', affectsBudget: true })).toBe(false);
    expect(txAffectsBudget({ type: 'expense', out_of_budget: true })).toBe(false);
    expect(txAffectsCash({ pay_now: false })).toBe(false);
    expect(txAffectsCash({})).toBe(true);
    expect(isCashPendingProjectionTx({
      type: 'expense',
      payNow: false,
      walletId: 'wallet-1',
      travelId: 'travel-1',
    }, { activeTravelId: 'travel-1' })).toBe(true);
    expect(isCashPendingProjectionTx({
      type: 'expense',
      payNow: false,
      walletId: 'wallet-1',
      trip_expense_id: 'trip-expense',
    }, { activeTravelId: 'travel-1' })).toBe(false);
  });

  it('summarizes nutrition, water and alcohol with realistic food matching', () => {
    const state = {
      nutritionMeals: [
        { id: 'm1', meal_date: '2026-07-19', label: 'Petit dej' },
        { id: 'w1', meal_date: '2026-07-19', label: 'Eau', water_ml: 750 },
      ],
      nutritionMealItems: [
        { meal_id: 'm1', food_key: 'beer', label: 'Biere', grams: 330, kcal: 145, protein_g: 1, carbs_g: 12, fat_g: 0 },
        { meal_id: 'm1', food_key: 'skyr', label: 'Skyr', grams: 150, kcal: 90, protein_g: 15, carbs_g: 6, fat_g: 0 },
      ],
    };

    const summary = nutritionSummaryForDate('2026-07-19', {
      state,
      foods: [
        { key: 'beer', name: 'Biere blonde', tags: ['alcool'], servingGrams: 330 },
        { key: 'skyr', name: 'Skyr', tags: ['laitage'], servingGrams: 150 },
      ],
    });

    expect(summary.mealCount).toBe(2);
    expect(summary.kcal).toBe(235);
    expect(summary.protein).toBe(16);
    expect(summary.drinkWaterMl).toBe(750);
    expect(summary.foodWaterMl).toBe(0);
    expect(summary.alcoholDrinks).toBeGreaterThan(1.2);
  });

  it('computes health score from kcal timing, activity, sleep and goal', () => {
    const state = {
      nutritionMeals: [{ id: 'm1', meal_date: '2026-07-19', label: 'Repas' }],
      nutritionMealItems: [{ meal_id: 'm1', food_key: 'rice', kcal: 1600, protein_g: 80, carbs_g: 220, fat_g: 40 }],
      sportSessions: [{ started_at: '2026-07-19T08:00:00', estimated_kcal: 320 }],
      workDays: [{ work_date: '2026-07-19', estimated_kcal: 180, duration_minutes: 240 }],
    };

    const activity = activitySummaryForDate('2026-07-19', { state });
    const health = healthSummaryForDate('2026-07-19', {
      activity,
      state,
      sleepRows: { '2026-07-18': { hours: 8, quality: 'good' } },
      readBodyMetric: (key, fallback) => ({ weight: 59, height: 162, birthdate: '1997-06-22', sex: 'male' }[key] ?? fallback),
      nutritionGoal: { mode: 'bulk', surplusKcal: 350 },
      todayISO: '2026-07-19',
      now: new Date('2026-07-19T20:00:00'),
    });

    expect(ageFromBirthDate('1997-06-22', new Date('2026-07-19T12:00:00'))).toBe(29);
    expect(activity.sportKcal).toBe(320);
    expect(activity.workKcal).toBe(180);
    expect(health.baseline).toBeGreaterThanOrEqual(1400);
    expect(health.needsKcal).toBeGreaterThan(2200);
    expect(health.sleepNightDay).toBe('2026-07-18');
    expect(health.score).toBeGreaterThan(40);
    expect(healthActionRows(health).length).toBeGreaterThan(0);
  });
});
