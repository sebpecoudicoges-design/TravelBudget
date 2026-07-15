import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

import {
  renderKpiFxCalculator,
  renderKpiHeader,
  renderKpiHealthCard,
  renderKpiMiniCard,
  renderKpiPendingDetail,
  renderKpiResponsiveStyles,
  renderKpiTodayPanel,
} from '../../../src/features/kpi/kpiView.js';

describe('KPI view helpers', () => {
  it('renders reusable KPI mini cards with values and extra controls', () => {
    const html = renderKpiMiniCard({
      title: 'Sport fait',
      valueHtml: '320 <span class="muted kpi-mini-unit">kcal</span>',
      footerHtml: '1 seance',
      extraHtml: '<label><input id="toggle" type="checkbox" /> Inclure</label>',
    });

    expect(html).toContain('kpi-mini-card');
    expect(html).toContain('Sport fait');
    expect(html).toContain('320 <span class="muted kpi-mini-unit">kcal</span>');
    expect(html).toContain('1 seance');
    expect(html).toContain('id="toggle"');
  });

  it('renders the KPI header with range controls preserved for legacy handlers', () => {
    const html = renderKpiHeader({
      title: 'KPIs',
      travelOptionHtml: '<option value="trip-1" selected>Voyage test</option>',
      scopeOptionsHtml: '<option value="segment">Periode</option><option value="range">Date a date</option>',
      scopeValue: 'range',
      helpHtml: '<button data-help>?</button>',
      dateISO: '2026-07-15',
    });

    expect(html).toContain('id="kpiPeriodSelect"');
    expect(html).toContain('id="kpiScopeSelect"');
    expect(html).toContain('id="kpiRangeBox"');
    expect(html).toContain('display:flex');
    expect(html).toContain('id="kpiRangeStart"');
    expect(html).toContain('id="kpiRangeEnd"');
    expect(html).toContain('id="kpiRangeApply"');
    expect(html).toContain('Voyage test');
    expect(html).toContain('2026-07-15');
  });

  it('renders the KPI FX calculator with stable ids for binding', () => {
    const html = renderKpiFxCalculator({ title: 'Convertisseur' });

    expect(html).toContain('kpi-mini-card');
    expect(html).toContain('Convertisseur');
    expect(html).toContain('id="kpiFxCalcAmount"');
    expect(html).toContain('id="kpiFxCalcFrom"');
    expect(html).toContain('id="kpiFxCalcSwap"');
    expect(html).toContain('id="kpiFxCalcTo"');
    expect(html).toContain('id="kpiFxCalcOut"');
  });

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
    const css = fs.readFileSync('public/legacy/css/kpi_view.css', 'utf8');

    expect(css).toContain('.kpi-health-card');
    expect(css).toContain('.kpi-mini-card');
    expect(css).toContain('.kpi-pending-detail');
    expect(css).toContain('@media(max-width:720px)');
    expect(renderKpiResponsiveStyles()).toBe('');
  });

  it('renders pending projection details with grouping count and overflow', () => {
    const html = renderKpiPendingDetail({
      items: [
        { source: 'A payer', label: 'Bus', value: -42, count: 2 },
        { source: 'A recevoir', label: 'Trip', value: 18, count: 1 },
        { source: 'A payer', label: 'Hostel', value: -55, count: 1 },
      ],
      max: 2,
      rangeLabel: '2026-07-15 -> 2026-07-20',
      detailLabel: 'Detail',
      emptyLabel: 'Vide',
      moreLabel: 'autre(s)',
      currency: 'AUD',
      amountText: (value, currency) => `${value > 0 ? '+' : ''}${value} ${currency}`,
    });

    expect(html).toContain('kpi-pending-detail');
    expect(html).toContain('2026-07-15 -&gt; 2026-07-20');
    expect(html).toContain('Bus x2');
    expect(html).toContain('-42 AUD');
    expect(html).toContain('+18 AUD');
    expect(html).toContain('+1 autre(s)');
    expect(html).not.toContain('Hostel');
  });

  it('renders today panel with steering and cash summary', () => {
    const html = renderKpiTodayPanel({
      dateISO: '2026-07-15',
      todayLabel: 'Aujourd hui',
      steeringLabel: 'Pilotage',
      dailyBudget: 42,
      base: 'AUD',
      todayPillClass: 'good',
      todayDetailsHtml: '<div data-today-details>Details</div>',
      pilot: {
        kind: 'period',
        decisionLevel: 'warn',
        decision: 'Ajuster',
        recommendedDaily: 31.5,
        base: 'AUD',
        projectedEndBalance: -12,
        zeroDate: '2026-07-20',
        daysRemaining: 5,
      },
      recommendedBudgetLabel: 'Budget recommande',
      endBalanceLabel: 'Solde fin',
      estimatedBreakLabel: 'Rupture estimee',
      daysRemainingLabel: 'Jours restants',
      cashLabel: 'Cash',
      daysLabel: 'jours',
      stockLabel: 'Stock',
      burnLabel: 'Burn',
      cashDaysText: '9',
      cashLevel: 'good',
      cashDriver: 'Depenses',
      cashTotalText: '100 AUD',
      cashBurnText: '11 AUD',
      fxNote: 'FX exclu : USD',
      moneyText: (value, currency) => `${value} ${currency}`,
      signPillClass: (value) => (value < 0 ? 'bad' : 'good'),
    });

    expect(html).toContain('kpi-mini-card');
    expect(html).toContain('2026-07-15');
    expect(html).toContain('data-today-details');
    expect(html).toContain('Budget recommande');
    expect(html).toContain('31.5 AUD/j');
    expect(html).toContain('Rupture estimee');
    expect(html).toContain('FX exclu : USD');
  });
});
