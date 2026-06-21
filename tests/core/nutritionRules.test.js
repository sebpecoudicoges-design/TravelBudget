import { describe, expect, it } from 'vitest';
import { alcoholForGrams, energyBalance, isAlcoholFood, normalizeFoodRow, nutritionForGrams, nutritionGoalTargets, sumNutrition } from '../../src/core/nutritionRules.js';

describe('nutrition rules core', () => {
  it('normalizes a food library row', () => {
    expect(normalizeFoodRow({
      food_key: 'rice_cooked',
      name_fr: 'Riz cuit',
      serving_grams: 150,
      kcal_per_100g: 130,
      protein_per_100g: 2.7,
      carbs_per_100g: 28,
      fat_per_100g: 0.3,
    })).toMatchObject({
      key: 'rice_cooked',
      name: 'Riz cuit',
      servingGrams: 150,
      kcalPer100g: 130,
    });
  });

  it('scales macros by grams and sums a meal', () => {
    const rice = { key: 'rice', name: 'Rice', kcalPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 };
    const chicken = { key: 'chicken', name: 'Chicken', kcalPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 };

    expect(Math.round(nutritionForGrams(rice, 200).kcal)).toBe(260);
    const total = sumNutrition([{ food: rice, grams: 200 }, { food: chicken, grams: 120 }]);
    expect(Math.round(total.kcal)).toBe(458);
    expect(Math.round(total.protein)).toBe(43);
  });

  it('computes consumed versus daily spent calories', () => {
    expect(energyBalance({ consumedKcal: 2200, sportKcal: 400, workKcal: 600, bmr: 1700 })).toEqual({
      consumedKcal: 2200,
      spentKcal: 2700,
      balanceKcal: -500,
    });
  });

  it('adapts calories and macros for a conservative bulking goal', () => {
    expect(nutritionGoalTargets({ spentKcal: 2100, weightKg: 59, mode: 'bulk', surplusKcal: 350 })).toMatchObject({
      mode: 'bulk',
      surplusKcal: 350,
      offsetKcal: 350,
      targetKcal: 2450,
      protein: 106,
      fat: 53,
    });
  });

  it('adapts calories and macros for a gentle fat loss goal', () => {
    expect(nutritionGoalTargets({ spentKcal: 2100, weightKg: 59, mode: 'cut', deficitKcal: 300 })).toMatchObject({
      mode: 'cut',
      deficitKcal: 300,
      offsetKcal: -300,
      targetKcal: 1800,
      protein: 112,
      fat: 44,
    });
  });

  it('detects alcohol and estimates French standard drinks', () => {
    const beer = { key: 'beer_blond_330', name: 'Biere blonde 33cl', servingGrams: 330, tags: ['boisson', 'alcool', 'biere'] };
    const alcoholFree = { key: 'beer_alcohol_free', name: 'Biere sans alcool', servingGrams: 330, tags: ['boisson', 'biere'] };

    expect(isAlcoholFood(beer)).toBe(true);
    expect(isAlcoholFood(alcoholFree)).toBe(false);
    expect(Math.round(alcoholForGrams(beer, 330).standardDrinks * 10) / 10).toBe(1.3);
  });
});
