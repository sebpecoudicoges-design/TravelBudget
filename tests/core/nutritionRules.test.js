import { describe, expect, it } from 'vitest';
import {
  alcoholForGrams,
  buildDailyNutritionSummaries,
  buildTypeTotalsForDay,
  energyBalance,
  filterCatalogFoods,
  foodCategory,
  isAlcoholFood,
  mealMomentTargets,
  mealTypeFromHour,
  normalizeFoodRow,
  nutritionForGrams,
  nutritionGoalTargets,
  sumNutrition,
} from '../../src/core/nutritionRules.js';

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

  it('builds daily nutrition summaries by meal type with alcohol totals', () => {
    const meals = [
      { id: 'm1', meal_date: '2026-07-08', meal_type: 'lunch', water_ml: 250 },
      { id: 'm2', meal_date: '2026-07-08', meal_type: 'dinner', water_ml: 500 },
    ];
    const items = [
      { meal_id: 'm1', food_key: 'rice', label: 'Riz', grams: 200, kcal: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6 },
      { meal_id: 'm2', food_key: 'beer_blond_330', label: 'Biere', grams: 330, kcal: 142, protein_g: 1.6, carbs_g: 12, fat_g: 0 },
    ];
    const foods = [
      { key: 'rice', name: 'Riz', servingGrams: 150, kcalPer100g: 130 },
      { key: 'beer_blond_330', name: 'Biere blonde 33cl', servingGrams: 330, tags: ['boisson', 'alcool', 'biere'] },
    ];

    const rows = buildDailyNutritionSummaries({ meals, items, foods });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: '2026-07-08', waterMl: 750, kcal: 402 });
    expect(rows[0].typeRows.map((row) => row.type)).toEqual(['lunch', 'dinner']);
    expect(Math.round(rows[0].alcoholDrinks * 10) / 10).toBe(1.3);
  });

  it('builds type totals and adapts future meal targets from previous meals', () => {
    const meals = [
      { id: 'breakfast', meal_type: 'breakfast' },
      { id: 'lunch', meal_type: 'lunch' },
    ];
    const items = [
      { meal_id: 'breakfast', kcal: 250, protein_g: 20, carbs_g: 30, fat_g: 5 },
      { meal_id: 'lunch', kcal: 700, protein_g: 35, carbs_g: 80, fat_g: 20 },
    ];
    const totals = buildTypeTotalsForDay(meals, items);
    const targets = mealMomentTargets({ needsKcal: 2400, typeTotals: totals, currentType: 'lunch' });
    const lunch = targets.find((row) => row.type === 'lunch');
    const dinner = targets.find((row) => row.type === 'dinner');

    expect(totals.breakfast.kcal).toBe(250);
    expect(lunch.kcal).toBeGreaterThan(lunch.baseKcal);
    expect(dinner.kcal).toBeGreaterThan(dinner.baseKcal);
  });

  it('classifies and filters catalog foods', () => {
    const foods = [
      { key: 'banana', name: 'Banane', servingGrams: 120 },
      { key: 'yogurt_hipro', name: 'Yaourt HiPRO', servingGrams: 160 },
      { key: 'rice_salmon_bowl', name: 'Riz saumon', servingGrams: 380, tags: ['plat'] },
    ];

    expect(mealTypeFromHour(11)).toBe('morning_snack');
    expect(foodCategory(foods[0])).toBe('fruits');
    expect(foodCategory(foods[1])).toBe('dairy');
    expect(filterCatalogFoods({ foods, query: 'riz', category: 'dishes' }).map((food) => food.key)).toEqual(['rice_salmon_bowl']);
  });
});
