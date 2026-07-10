import { describe, expect, it } from 'vitest';

import {
  buildWeekRows,
  mealMomentSuggestion,
  mealTargetNote,
  progressPercent,
  renderFoodChip,
  renderHistoryPanel,
  renderHydrationPanel,
  renderMealFavoriteChip,
  renderMealTimeline,
  renderQuickAddPanel,
  renderSleepPanel,
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

  it('renders the quick-add panel with stable form hooks', () => {
    const html = renderQuickAddPanel({
      editingItem: { id: 'i1' },
      syncBadge: 'synchro ok',
      foodQuery: 'riz',
      foodOptionsHtml: '<option value="rice">Riz</option>',
      quickFoods: { favs: [{ key: 'banana', name: 'Banane' }], recent: [] },
      mealFavorites: [{ label: 'Bowl', items: [] }],
      activeMealType: 'lunch',
      error: 'Erreur test',
      renderMealFavoriteChip: () => '<button data-nutrition-apply-meal-fav="0">Bowl</button>',
      t,
    });
    expect(html).toContain('id="nutrition-search"');
    expect(html).toContain('id="nutrition-food"');
    expect(html).toContain('value="lunch" selected');
    expect(html).toContain('id="nutrition-edit-cancel"');
    expect(html).toContain('Erreur test');
  });

  it('renders hydration, sleep and weekly history panels', () => {
    const hydration = renderHydrationPanel({ t });
    expect(hydration).toContain('id="nutrition-water-only"');
    expect(hydration).toContain('data-nutrition-water-quick="1000"');

    const sleep = renderSleepPanel({
      sleep: { hours: 8, quality: 'good' },
      sleepLabel: '8h',
      sleepNightLabel: '09/07',
      day: '2026-07-10',
      sleepWeek: [{ day: '2026-07-10', nightDay: '2026-07-09', hours: 8, quality: 'good' }],
      t,
    });
    expect(sleep).toContain('id="nutrition-sleep-hours"');
    expect(sleep).toContain('value="good" selected');
    expect(sleep).toContain('data-nutrition-history-date="2026-07-10"');

    const history = renderHistoryPanel({
      week: [{ day: '2026-07-10', kcal: 1800, waterMl: 2000, typeRows: [{ type: 'lunch', kcal: 650 }] }],
      day: '2026-07-10',
      needsKcal: 2200,
      mealTypeLabel: () => 'Dejeuner',
      t,
    });
    expect(history).toContain('Historique');
    expect(history).toContain('Dejeuner 650 kcal');
    expect(history).toContain('data-nutrition-history-date="2026-07-10"');
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
