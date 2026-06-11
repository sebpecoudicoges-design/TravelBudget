import { describe, expect, it } from 'vitest';
import { energyBalance, normalizeFoodRow, nutritionForGrams, sumNutrition } from '../../src/core/nutritionRules.js';

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
});
