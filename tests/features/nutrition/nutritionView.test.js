import { describe, expect, it } from 'vitest';

import {
  buildWeekRows,
  goalSevenDayInsight,
  macroSummaryText,
  mealMomentSuggestion,
  mealTargetNote,
  progressPercent,
  renderActiveWeekDashboard,
  renderAlcoholPanel,
  renderFoodChip,
  renderGoalCockpit,
  renderHistoryPanel,
  renderHydrationPanel,
  renderMealFavoriteChip,
  renderMealTimeline,
  renderNutritionShell,
  renderNutritionSyncPanel,
  renderQuickAddPanel,
  renderSleepPanel,
  renderProgressBar,
  summarizeActiveWeek,
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

  it('renders the pending sync panel with stable actions and discard hooks', () => {
    const html = renderNutritionSyncPanel({
      rows: [
        {
          meal: { meal_date: '2026-07-19', meal_type: 'lunch' },
          item: { label: '<Riz>', kcal: 420 },
          syncError: 'Failed to fetch',
        },
        {
          meal: { meal_date: '2026-07-19', meal_type: 'snack', water_ml: 250 },
          item: {},
        },
      ],
      globalPendingCount: 1,
      syncStatus: 'Hors ligne',
      selectedDate: '2026-07-19',
      localNutritionRowKey: (_row, index) => `local-${index}`,
      mealTypeLabel: (type) => ({ lunch: 'Dejeuner', snack: 'Snack' }[type] || type),
      t,
    });

    expect(html).toContain('Synchro alimentation en attente');
    expect(html).toContain('2 ajout(s) local(aux) · 1 action(s) file offline · Hors ligne');
    expect(html).toContain('id="nutrition-sync-pending"');
    expect(html).toContain('id="nutrition-clear-pending"');
    expect(html).toContain('&lt;Riz&gt;');
    expect(html).toContain('Dejeuner · 420 kcal');
    expect(html).toContain('Snack · 250 ml');
    expect(html).toContain('data-nutrition-discard-local="local-0"');
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

  it('renders goal cockpit and seven-day insight without legacy globals', () => {
    expect(macroSummaryText({ protein: 95, carbs: 260, fat: 62 })).toBe('95g P · 260g G · 62g L');
    expect(goalSevenDayInsight(
      { mode: 'bulk' },
      { targetKcal: 2400 },
      [{ day: '2026-07-08', kcal: 2450 }, { day: '2026-07-09', kcal: 2520 }],
      { t },
    )).toContain('Rythme propre');

    const html = renderGoalCockpit({
      goal: { mode: 'bulk', targetWeightKg: 62, weeklyRateKg: 0.25 },
      targets: { targetKcal: 2450, protein: 105, proteinPerKg: 1.8, carbs: 310, fat: 58, fatPerKg: 1 },
      week: [{ day: '2026-07-10', kcal: 2300 }],
      total: { kcal: 1900 },
      sportKcal: 300,
      workKcal: 150,
      currentWeight: 59,
      goalLabel: 'Prise de masse douce',
      t,
    });
    expect(html).toContain('Cockpit objectif');
    expect(html).toContain('Prise de masse douce');
    expect(html).toContain('+550');
    expect(html).toContain('450');
  });

  it('renders alcohol panel with standard-drink details and history hooks', () => {
    const html = renderAlcoholPanel({
      alcoholJudge: { color: '#f59e0b', label: 'Dans les reperes', note: 'Reste sous les reperes.' },
      alcoholToday: {
        standardDrinks: 1.4,
        entries: [{ label: 'Biere', grams: 330, standardDrinks: 1.3 }],
      },
      alcoholWeekTotal: 5.2,
      alcoholDrinkingDays: 2,
      week: [{ day: '2026-07-10', alcoholDrinks: 1.4 }],
      day: '2026-07-10',
      t,
    });
    expect(html).toContain('Alcool');
    expect(html).toContain('Biere');
    expect(html).toContain('data-nutrition-history-date="2026-07-10"');
    expect(html).toContain('1.3 verres');
  });

  it('renders the active week dashboard without the legacy health page', () => {
    const rows = [
      {
        row: { day: '2026-07-09' },
        plan: { planned: true, code: 'A1', sessionName: 'Full body' },
        kcal: 2100,
        need: 2400,
        water: 2000,
        sleep: 8,
        protein: 95,
        sport: 300,
        work: 150,
        alcohol: 1,
        score: 82,
      },
      {
        row: { day: '2026-07-10' },
        plan: { planned: false },
        kcal: 1800,
        need: 2300,
        water: 1500,
        sleep: 7,
        protein: 80,
        sport: 0,
        work: 500,
        alcohol: 0,
        score: 70,
      },
    ];
    expect(Math.round(summarizeActiveWeek(rows).avgScore)).toBe(76);
    const html = renderActiveWeekDashboard({ rows, selectedDay: '2026-07-10', bodyWeight: 59, t });
    expect(html).toContain('Semaine active');
    expect(html).toContain('A1 Full body');
    expect(html).toContain('data-health-date="2026-07-10"');
    expect(html).toContain('650 kcal');
  });

  it('renders the main Nutrition shell with stable hooks and delegated slots', () => {
    const html = renderNutritionShell({
      day: '2026-07-19',
      base: { bmr: 1624 },
      goalLabel: 'Prise de masse douce',
      goalTargets: { mode: 'bulk', offsetKcal: 350, surplusKcal: 350, deficitKcal: 300 },
      goalSettings: { targetWeightKg: 62, weeklyRateKg: 0.25 },
      syncPanelHtml: '<div id="nutrition-sync-pending">sync</div>',
      consumedKcal: 1089,
      needsKcal: 2400,
      kcalTargetLabel: 'Reste',
      kcalDelta: -1311,
      drinkWaterMl: 1200,
      foodWaterMl: 416,
      proteinTarget: 95,
      carbsTarget: 300,
      fatTarget: 70,
      total: { kcal: 1089, protein: 43, carbs: 130, fat: 35 },
      sportKcal: 250,
      workKcal: 120,
      goalCockpitHtml: '<div id="goal-cockpit">objectif</div>',
      quickAdd: {
        syncBadge: 'A jour',
        foodOptionsHtml: '<option value="water">Eau</option>',
        quickFoods: { favs: [], recent: [] },
        mealFavorites: [],
        activeMealType: 'lunch',
      },
      hydrationPanelHtml: '<section id="hydration-panel">eau</section>',
      sleepPanelHtml: '<section id="sleep-panel">sommeil</section>',
      historyPanelHtml: '<section id="history-panel">historique</section>',
      alcoholPanelHtml: '<section id="alcohol-panel">alcool</section>',
      sleepLabel: '8h',
      spentKcal: 1994,
      objectiveBalanceKcal: -561,
      balanceLabel: 'sous objectif de',
      mealTimelineHtml: '<div data-nutrition-pick-type="lunch">timeline</div>',
      t,
    });
    expect(html).toContain('id="nutrition-date"');
    expect(html).toContain('id="nutrition-refresh"');
    expect(html).toContain('id="nutrition-goal-mode"');
    expect(html).toContain('id="nutrition-search"');
    expect(html).toContain('id="nutrition-sync-pending"');
    expect(html).toContain('data-nutrition-pick-type="lunch"');
    expect(html).toContain('1089 / 2400 kcal');
  });
});
