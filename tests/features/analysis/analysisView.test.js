import { describe, expect, it } from 'vitest';

import {
  buildAnalysisInsights,
  buildAnalysisOverviewCards,
  renderAnalysisInsights,
  renderAnalysisOverviewStrip,
} from '../../../src/features/analysis/analysisView.js';

describe('Analysis view helpers', () => {
  const t = (key, vars = {}) => {
    const dict = {
      'analysis.filter.travel': 'Voyage',
      'analysis.trip.active': 'Voyage actif',
      'analysis.period.active': 'Période active',
      'analysis.period.all_trip': 'Tout le voyage',
      'analysis.period.targeted': 'Période ciblée',
      'analysis.filter.range': 'Plage',
      'analysis.scope.budget': 'Budget',
      'analysis.scope.out': 'Hors budget',
      'analysis.scope.budget_out': 'Budget + hors budget',
      'analysis.mode.expenses': 'Dépenses réelles',
      'analysis.mode.planned': 'Prévisionnel',
      'analysis.days_analyzed': `${vars.count} jours`,
      'analysis.filter.currency': 'Devise',
      'analysis.currency.account_pivot': 'Pivot compte',
      'analysis.currency.period_segment': 'Segment période',
      'analysis.overview.reading': 'Lecture',
      'analysis.overview.coverage': 'Couverture',
      'analysis.expenses_count': `${vars.count} dépenses`,
      'analysis.reference.comparable_days': `${vars.count} jours comparables`,
      'analysis.reference.missing_range': 'Référence absente',
    };
    return dict[key] || key;
  };

  it('builds the four overview cards from current filters and model', () => {
    const cards = buildAnalysisOverviewCards({
      model: {
        start: '2026-07-01',
        end: '2026-07-12',
        base: 'aud',
        days: ['2026-07-01', '2026-07-02'],
        txs: [{ id: 1 }, { id: 2 }, { id: 3 }],
        comparableDays: 7,
      },
      travel: { name: 'BudgetTravel' },
      periodId: 'range',
      scope: 'all',
      mode: 'expenses',
      currencyMode: 'period',
      t,
    });

    expect(cards).toHaveLength(4);
    expect(cards[0]).toMatchObject({ label: 'Voyage', value: 'BudgetTravel', accent: 'travel' });
    expect(cards[0].meta).toContain('Plage');
    expect(cards[1]).toMatchObject({ value: 'Budget + hors budget', meta: 'Dépenses réelles - 2 jours' });
    expect(cards[2]).toMatchObject({ value: 'AUD', meta: 'Segment période' });
    expect(cards[3]).toMatchObject({ value: '3 dépenses', meta: '7 jours comparables' });
  });

  it('renders escaped overview HTML for the legacy Analysis host', () => {
    const html = renderAnalysisOverviewStrip({
      model: { base: 'eur', days: [], txs: [], comparableDays: 0 },
      travel: { name: '<BudgetTravel>' },
      t,
    });

    expect(html).toContain('analysis-overview-card--travel');
    expect(html).toContain('&lt;BudgetTravel&gt;');
    expect(html).toContain('Référence absente');
  });

  it('builds actionable insights from the analysis model', () => {
    const model = {
      base: 'AUD',
      projection: 1400,
      totalBudget: 1200,
      comparablePerDay: 42,
      referencePerDay: 35,
      avgPerDay: 58,
      budgetPerDay: 50,
      spent: 580,
      outAmount: 20,
      excludedPerDay: 0,
      nightCoveredCount: 1,
      nightCoveredPotentialSavings: 80,
      topCategories: [['Transport', 250]],
      unmappedCategorySeries: [{ name: 'Divers', actual: 45 }],
      txs: [{}, {}],
      days: [{}, {}, {}],
    };
    const formatCurrency = (value, currency) => `${Number(value).toFixed(0)} ${currency}`;

    const result = buildAnalysisInsights({ model, isEn: true, formatCurrency });

    expect(result.livePill).toBe('2 expenses • 3 days • AUD');
    expect(result.insights[0].title).toBe('Night transports: 1 case(s)');
    expect(result.insights.some((item) => item.title === 'Actual above reference')).toBe(true);
    expect(result.insights.some((item) => item.title === 'Pace above target')).toBe(true);
    expect(result.insights.some((item) => item.title === 'Dominant category : Transport')).toBe(true);
    expect(result.insights.some((item) => item.title === 'Projection above cap')).toBe(true);
    expect(result.insights.some((item) => item.title === 'Map next : Divers')).toBe(true);
  });

  it('renders escaped insight HTML for the legacy Analysis host', () => {
    const html = renderAnalysisInsights({
      model: {
        base: 'EUR',
        projection: 800,
        totalBudget: 1000,
        comparablePerDay: 20,
        referencePerDay: 30,
        avgPerDay: 25,
        budgetPerDay: 40,
        spent: 100,
        topCategories: [['<Food>', 50]],
        txs: [],
        days: [],
      },
      isEn: true,
      formatCurrency: (value, currency) => `${Number(value).toFixed(0)} ${currency}`,
    });

    expect(html).toContain('analysis-insight');
    expect(html).toContain('&lt;Food&gt;');
    expect(html).toContain('Projection on track');
  });
});
