import { describe, expect, it } from 'vitest';

import {
  buildAnalysisInsights,
  buildAnalysisNightCoveredRows,
  buildAnalysisOverviewCards,
  buildAnalysisReferenceContext,
  buildAnalysisReferenceRows,
  buildAnalysisSubcategoryRows,
  renderAnalysisInsights,
  renderAnalysisNightCovered,
  renderAnalysisOverviewStrip,
  renderAnalysisReferenceMix,
  renderAnalysisReferenceSummary,
  renderAnalysisSubcategoryBreakdown,
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

  it('renders the empty night transport panel state', () => {
    const html = renderAnalysisNightCovered({ model: { nightCoveredCount: 0 } });

    expect(html).toContain('Aucun transport marqué comme remplaçant une nuit');
  });

  it('sorts, limits and escapes night transport rows', () => {
    const rows = [
      { label: 'Old bus', date: '2026-07-01', category: 'Transport', saving: 40, spent: 12 },
      { label: '<Night train>', date: '2026-07-08', category: '<Train>', saving: 90, spent: 35 },
      { label: 'Ferry', date: '2026-07-07', category: 'Transport', saving: 70, spent: 28 },
      { label: 'Coach', date: '2026-07-06', category: 'Transport', saving: 65, spent: 20 },
      { label: 'Bus', date: '2026-07-05', category: 'Transport', saving: 55, spent: 18 },
      { label: 'Rail', date: '2026-07-04', category: 'Transport', saving: 50, spent: 16 },
      { label: 'Late flight', date: '2026-07-03', category: 'Transport', saving: 45, spent: 25 },
    ];

    expect(buildAnalysisNightCoveredRows({ nightCoveredRows: rows })).toHaveLength(6);

    const html = renderAnalysisNightCovered({
      model: {
        base: 'AUD',
        nightCoveredCount: 7,
        nightCoveredPotentialSavings: 415,
        nightCoveredAverageSaving: 59.29,
        nightCoveredRows: rows,
      },
      formatCurrency: (value, currency) => `${Number(value).toFixed(0)} ${currency}`,
    });

    expect(html).toContain('Transports concernés');
    expect(html).toContain('415 AUD');
    expect(html).toContain('&lt;Night train&gt;');
    expect(html).toContain('&lt;Train&gt;');
    expect(html).not.toContain('Old bus');
    expect(html.indexOf('&lt;Night train&gt;')).toBeLessThan(html.indexOf('Ferry'));
  });

  it('renders escaped clickable subcategory rows for the legacy drilldown host', () => {
    const rows = [
      { key: '<food>', subcategoryName: '<Cafe>', categoryName: 'Food', actual: 42, color: '#123456' },
      { key: 'transport', subcategoryName: 'Bus', categoryName: 'Transport', actual: 12 },
      { key: 'hidden', subcategoryName: 'Hidden', categoryName: 'Other', actual: 1 },
      { key: 'hidden2', subcategoryName: 'Hidden2', categoryName: 'Other', actual: 1 },
      { key: 'hidden3', subcategoryName: 'Hidden3', categoryName: 'Other', actual: 1 },
      { key: 'hidden4', subcategoryName: 'Hidden4', categoryName: 'Other', actual: 1 },
      { key: 'hidden5', subcategoryName: 'Hidden5', categoryName: 'Other', actual: 1 },
      { key: 'hidden6', subcategoryName: 'Hidden6', categoryName: 'Other', actual: 1 },
      { key: 'hidden7', subcategoryName: 'Hidden7', categoryName: 'Other', actual: 1 },
      { key: 'hidden8', subcategoryName: 'Hidden8', categoryName: 'Other', actual: 1 },
      { key: 'overflow', subcategoryName: 'Overflow', categoryName: 'Other', actual: 1 },
    ];

    expect(buildAnalysisSubcategoryRows({ subcategorySeries: rows })).toHaveLength(10);

    const html = renderAnalysisSubcategoryBreakdown({
      model: { base: 'AUD', subcategorySeries: rows },
      formatCurrency: (value, currency) => `${Number(value).toFixed(0)} ${currency}`,
      accent: '#abcdef',
    });

    expect(html).toContain('data-subkey="&lt;food&gt;"');
    expect(html).toContain('&lt;Cafe&gt;');
    expect(html).toContain('42 AUD');
    expect(html).toContain('tb-analysis-detail-btn');
    expect(html).not.toContain('Overflow');
  });

  it('renders the empty subcategory state', () => {
    const html = renderAnalysisSubcategoryBreakdown({ model: { subcategorySeries: [] } });

    expect(html).toContain('Aucune sous-catégorie exploitée');
  });

  it('renders the reference summary with coverage, delta and context', () => {
    const model = {
      base: 'AUD',
      days: [{}, {}, {}, {}],
      referenceCoverageDays: 3,
      referencePerDay: 30,
      comparablePerDay: 42,
      referenceContext: {
        countryLabel: '<Australie>',
        profileLabel: 'Solo',
        styleLabel: 'Simple',
        adultsLabel: '1 ad.',
        childrenLabel: '0 enf.',
      },
    };

    expect(buildAnalysisReferenceContext(model)).toContain('<Australie>');

    const html = renderAnalysisReferenceSummary({
      model,
      formatCurrency: (value, currency) => `${Number(value).toFixed(0)} ${currency}`,
    });

    expect(html).toContain('Sourcé / jour');
    expect(html).toContain('3/4 jours couverts');
    expect(html).toContain('12 AUD');
    expect(html).toContain('Au-dessus de la référence');
    expect(html).toContain('&lt;Australie&gt;');
    expect(html).toContain('1 adulte(s)');
  });

  it('renders reference comparison cards and empty state', () => {
    const model = {
      base: 'AUD',
      referenceComparisonSeries: [
        { name: '<Repas>', actualPerDay: 45, referencePerDay: 30 },
        { name: 'Logement', actualPerDay: 10, referencePerDay: 25 },
        { name: 'Ignored', actualPerDay: 0, referencePerDay: 0 },
      ],
      unmappedPerDay: 8,
      excludedPerDay: 4,
    };

    expect(buildAnalysisReferenceRows(model)).toHaveLength(2);

    const html = renderAnalysisReferenceMix({
      model,
      formatCurrency: (value, currency) => `${Number(value).toFixed(0)} ${currency}`,
    });

    expect(html).toContain('&lt;Repas&gt;');
    expect(html).toContain('analysis-reference-metal--warn');
    expect(html).toContain('analysis-reference-metal--good');
    expect(html).toContain('Non référencé');
    expect(html).toContain('Exclu du comparatif');
    expect(html).not.toContain('Ignored');

    expect(renderAnalysisReferenceMix({ model: { referenceComparisonSeries: [] } })).toContain('Aucune référence pays active');
  });
});
