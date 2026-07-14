import { describe, expect, it } from 'vitest';

import {
  renderKpiHealthCard,
  renderKpiResponsiveStyles,
} from '../../../src/features/kpi/kpiView.js';

describe('KPI view helpers', () => {
  it('renders the health card with score, goals and actions', () => {
    const html = renderKpiHealthCard({
      healthToday: {
        score: 76,
        color: '#16a34a',
        level: 'good',
        label: 'OK',
        kcal: 1200,
        expectedKcalNow: 1100,
        currentBalance: 100,
        drinkWaterMl: 1500,
        sleepHours: 8.5,
        advice: 'Journee stable',
        activityKcal: 320,
        foodWaterMl: 420,
        needsKcal: 2500,
        dayProgress: 0.52,
        kcalScore: 32,
        hydrationScore: 18,
        proteinScore: 14,
        sleepScore: 18,
        alcoholScore: 9,
        alcoholDrinks: 1,
        alcoholWeeklyDrinks: 4,
        baseline: 1600,
        nutritionGoalMode: 'bulk',
        nutritionSurplusKcal: 350,
        protein: 82,
        proteinTarget: 95,
        sleepQuality: 'good',
        sleepNightDay: '2026-07-13',
      },
      healthActions: [
        { tone: 'good', title: 'Hydratation', body: 'Rythme correct' },
      ],
    });

    expect(html).toContain('kpi-health-card');
    expect(html).toContain('76');
    expect(html).toContain('1200 / 1100 kcal');
    expect(html).toContain('prise de masse +350 kcal');
    expect(html).toContain('Hydratation');
    expect(html).toContain('8.5h · good · nuit du 07/13');
  });

  it('keeps KPI responsive styles outside the legacy file', () => {
    const css = renderKpiResponsiveStyles();

    expect(css).toContain('.kpi-health-card');
    expect(css).toContain('.kpi-pending-detail');
    expect(css).toContain('@media (max-width: 720px)');
  });
});
