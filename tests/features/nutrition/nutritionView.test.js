import { describe, expect, it } from 'vitest';

import {
  buildWeekRows,
  mealMomentSuggestion,
  mealTargetNote,
  progressPercent,
  renderFoodChip,
  renderMealFavoriteChip,
  renderMealTimeline,
  renderProgressBar,
} from '../../../src/features/nutrition/nutritionView.js';

describe('Nutrition view helpers', () => {
  const t = (fr) => fr;

  it('renders progress bars with capped visual width and readable totals', () => {
    expect(progressPercent(220, 100)).toBe(160);
    const html = renderProgressBar({ label: 'Proteines', current: 80, target: 100, unit: 'g' });
    expect(html).toContain('Proteines');
    expect(html).toContain('80/100g');
    expect(html).toContain('width:80%');
  });

  it('explains adjusted meal targets and simple meal suggestions', () => {
    expect(mealTargetNote({ kcal: 520, baseKcal: 450 }, { t })).toContain('+70 kcal');
    expect(mealTargetNote({ kcal: 420, baseKcal: 450 }, { t })).toBe('Objectif standard.');
    expect(mealMomentSuggestion('lunch', { kcal: 200 }, 520, { protein: 40, waterMl: 1200 }, { protein: 95 }, { t }))
      .toContain('proteines');
  });

  it('builds a stable seven-day history window', () => {
    const rows = buildWeekRows([{ day: '2026-07-08', kcal: 1800 }], '2026-07-10', {
      offsetDateISO: (day, offset) => {
        const d = new Date(`${day}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + offset);
        return d.toISOString().slice(0, 10);
      },
    });
    expect(rows).toHaveLength(7);
    expect(rows[0].day).toBe('2026-07-04');
    expect(rows[4]).toMatchObject({ day: '2026-07-08', kcal: 1800 });
  });

  it('renders food and favorite meal chips without legacy globals', () => {
    expect(renderFoodChip({ key: 'banana', name: 'Banane', servingGrams: 120 }, 'favorite')).toContain('★');
    const fav = { label: 'Petit dej', items: [{ foodKey: 'muesli', grams: 50, label: 'Muesli' }] };
    const html = renderMealFavoriteChip(fav, 2, {
      t,
      foodByKey: () => ({ key: 'muesli' }),
      nutritionForGrams: () => ({ kcal: 190 }),
    });
    expect(html).toContain('data-nutrition-apply-meal-fav="2"');
    expect(html).toContain('190 kcal');
  });

  it('renders the meal timeline with edit/delete actions and other entries', () => {
    const items = [
      { id: 'i1', meal_id: 'm1', label: 'Poulet', grams: 120, kcal: 190, protein_g: 30, carbs_g: 0, fat_g: 5 },
      { id: 'i2', meal_id: 'm2', label: 'Libre', grams: 80, kcal: 100 },
    ];
    const html = renderMealTimeline({
      mealTargets: [{ type: 'lunch', kcal: 600, baseKcal: 600, color: '#22c55e' }],
      typeTotals: { lunch: { kcal: 190, protein: 30, carbs: 0, fat: 5 } },
      items,
      total: { kcal: 290, protein: 30, waterMl: 500 },
      drinkWaterMl: 500,
      macroTargets: { protein: 90, carbs: 250, fat: 60 },
      itemMeal: (item) => ({ meal_type: item.meal_id === 'm1' ? 'lunch' : 'snack' }),
      mealTypeLabel: () => 'Dejeuner',
      t,
    });
    expect(html).toContain('Dejeuner');
    expect(html).toContain('data-nutrition-edit="i1"');
    expect(html).toContain('data-nutrition-delete="i1"');
    expect(html).toContain('Autres ajouts');
  });
});
