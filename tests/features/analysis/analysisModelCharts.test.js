import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import * as rules from '../../../src/core/budgetAnalysisRules.js';
import { renderPreviousPeriodComparison } from '../../../src/features/analysis/analysisPeriodComparison.js';
import * as cash from '../../../src/features/analysis/analysisCashBreakdown.js';

const legacy = fs.readFileSync(new URL('../../../public/legacy/js/33_budget_analysis.js', import.meta.url), 'utf8');

function computeAnalysis({ transactions, mode = 'planned', convert, forcedBase, currency = 'account',
  first = '2026-08-10', last = '2026-08-12', segments, legacyFallback, rawConvert,
  withSummary = false, referenceCurrency = 'EUR',
}) {
  const window = {
    TBCore: { budgetAnalysisRules: rules },
    TBAnalysisCashBreakdown: cash,
    tbFxConvertForDateCached: convert,
    fxConvert: rawConvert,
    amountToBudgetBaseForDate: legacyFallback,
    TB_CONST: { ANALYSIS: { SOURCED_CATEGORY_MAPPING: { transport: { mode: 'mapped', bucket: 'Transport' } } } },
  };
  const filters = {
    'analysis-period': 'range', 'analysis-mode': mode, 'analysis-currency': currency,
    'analysis-range-start': first, 'analysis-range-end': last,
  };
  const state = {
    user: { baseCurrency: 'EUR' },
    activeTravelId: 'travel-fixture',
    period: { start: first, end: last, dailyBudgetBase: 25 },
    budgetSegments: segments || [{ id: 'ref-day', travelId: 'travel-fixture', start: first, end: first, baseCurrency: 'EUR' }],
    transactions,
  };
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-08-14T12:00:00'])); }
  }
  const context = vm.createContext({
    window, state, Map, Date: FixtureDate, getBudgetSegmentForDate(date) { return state.budgetSegments.find(seg => seg.start <= date && date <= seg.end); },
    document: { getElementById: (id) => filters[id] ? { value: filters[id] } : null, addEventListener() {} },
    toLocalISODate: (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
      .map((part, i) => String(part).padStart(i === 0 ? 4 : 2, '0')).join('-'),
  });
  vm.runInContext(legacy.replace('  function _computeModel(', '  window.__fixtureModel = _computeModel; window.__fixtureSummary = _analysisNotificationSummaryFromModel; window.__fixtureReference = referenceCache;\n  function _computeModel('), context);
  window.__fixtureReference.bySegment['ref-day'] = {
    currency_code: referenceCurrency, recommended_daily_amount: 35, recommended_transport_daily_amount: 35,
  };
  const model = window.__fixtureModel(forcedBase);
  return withSummary ? { model, notification: window.__fixtureSummary(model) } : model;
}

const transaction = (overrides) => ({
  travelId: 'travel-fixture', type: 'expense', currency: 'EUR', category: 'Transport',
  pay_now: true, affects_budget: true, date: '2026-08-10', ...overrides,
});

it('compares only the covered share of a spread expense and its refund', () => {
  const sharedWindow = { budgetDateStart: '2026-08-10', budgetDateEnd: '2026-08-12' };
  const model = computeAnalysis({ transactions: [
    transaction({ ...sharedWindow, amount: 90 }),
    transaction({ ...sharedWindow, type: 'income', amount: 30 }),
  ] });
  expect(model.spent).toBe(60);
  expect(model.referenceCoverageDays).toBe(1);
  expect(model.comparablePerDay).toBe(20);
  expect(model.referenceComparisonSeries.find((row) => row.name === 'Transport')).toMatchObject({
    actualPerDay: 20, referencePerDay: 35, deltaPerDay: -15,
  });
});

it.each([['planned', 70], ['expenses', 40]])('shows the same day totals in cadence and heatmap in %s mode', (mode, expected) => {
  const model = computeAnalysis({ mode, transactions: [
    transaction({ amount: 40 }),
    transaction({ amount: 30, pay_now: false }),
  ] });
  expect(model.velocity).toEqual([expected, 0, 0]);
  expect(model.heat.map((point) => point[2])).toEqual(model.velocity);
});


it('converts at the cash date before allocating the visible budget share', () => {
  const converted = [];
  const model = computeAnalysis({
    transactions: [transaction({
      amount: 90, currency: 'NZD', date: '2026-08-12',
      budgetDateStart: '2026-08-10', budgetDateEnd: '2026-08-12',
    })],
    convert(amount, from, base, date) {
      converted.push({ from, base, date });
      return amount / 2;
    },
  });
  expect(model.base).toBe('EUR');
  expect(model.usesExchangeRates).toBe(true);
  expect(model.velocity).toEqual([15, 15, 15]);
  expect(model.comparablePerDay).toBe(15);
  expect(converted.length).toBeGreaterThan(0);
  expect(converted).toEqual(converted.map(() => ({ from: 'NZD', base: 'EUR', date: '2026-08-12' })));
});

const segment = (id, start, end, baseCurrency) => ({
  id, travelId: 'travel-fixture', start, end, baseCurrency, dailyBudgetBase: 0,
});
const segments = [
  segment('aud-first', '2026-08-07', '2026-08-09', 'AUD'),
  segment('eur-after', '2026-08-10', '2026-08-12', 'EUR'),
  segment('nzd-after', '2026-08-13', '2026-08-14', 'NZD'),
];
const rates = (value, source, target) => source === 'AUD' && target === 'EUR' ? value * 0.5 : null;

it.each([null, 0, undefined])('flags a missing nonzero conversion (%s) without accepting a legacy face-value fallback', badValue => {
  const { model, notification } = computeAnalysis({
    first: '2026-08-10', last: '2026-08-14', currency: 'period', segments, withSummary: true,
    transactions: [
      transaction({ amount: 30, currency: 'EUR' }),
      transaction({ amount: 100, currency: 'AUD' }),
      transaction({ amount: 200, date: '2026-08-14', currency: 'NZD' }),
    ],
    convert: (value, source, target) => rates(value, source, target) ?? badValue,
    legacyFallback: (amount) => amount,
  });
  expect(model.base).toBe('EUR');
  expect(model.missingFx).toEqual(['NZD → EUR']);
  expect(notification).toBeNull();
});

it('uses a valid segment-aware raw conversion when the cache returned a legacy zero', () => {
  const model = computeAnalysis({
    transactions: [transaction({ amount: 90, currency: 'NZD' }), transaction({ amount: 0, currency: 'ZZZ' })],
    convert: () => 0, rawConvert: (value) => value / 2,
  });
  expect(model.spent).toBe(45);
  expect(model.missingFx).toEqual([]);
});

it('keeps an excluded foreign-currency expense from blocking the visible subset', () => {
  const model = computeAnalysis({ mode: 'expenses', transactions: [
    transaction({ amount: 30, currency: 'EUR' }),
    transaction({ amount: 200, currency: 'NZD', pay_now: false }),
    transaction({ amount: 0, currency: 'ZZZ' }),
  ] });
  expect(model.spent).toBe(30);
  expect(model.usesExchangeRates).toBe(false);
  expect(model.missingFx).toEqual([]);
});

it('recomputes the comparison in the current period currency before subtracting', () => {
  const transactions = [
    transaction({ date: '2026-08-08', amount: 100, currency: 'AUD' }),
    transaction({ date: '2026-08-11', amount: 30, currency: 'EUR' }),
  ];
  const common = { transactions, currency: 'period', segments, convert: rates };
  const current = computeAnalysis(common);
  const host = { innerHTML: '' };
  const previousFor = (range, forcedBase) => computeAnalysis({ ...common, first: range.start, last: range.end, forcedBase });
  const mismatch = renderPreviousPeriodComparison({ host, current, computeForRange: range => previousFor(range) });
  expect(mismatch.previous.base).toBe('AUD');
  expect(mismatch.metrics).toBeNull();
  const comparison = renderPreviousPeriodComparison({ host, current, computeForRange: range => previousFor(range, current.base) });
  expect(comparison.previous.base).toBe('EUR');
  expect(comparison.previous.spent).toBe(50);
  expect(comparison.metrics.delta).toBeCloseTo((30 - 50) / 3);
});

it('distinguishes a prior-period conversion failure from an empty prior-period comparison', () => {
  const host = { innerHTML: '' };
  const result = renderPreviousPeriodComparison({
    host, current: { base: 'EUR', start: '2026-08-10', elapsedDays: 3 },
    computeForRange: () => ({ base: 'EUR', missingFx: ['AUD → EUR'] }),
  });
  expect(result.metrics).toBeNull();
  expect(host.innerHTML).toContain('taux de change manquant');
  expect(host.innerHTML).not.toContain('Nouvelle référence');
});


it('keeps the paid total and comparison when only the optional country reference lacks an exchange rate', () => {
  const { model, notification } = computeAnalysis({
    transactions: [transaction({ amount: 45 })], referenceCurrency: 'ABC', convert: () => null,
    withSummary: true,
  });
  expect(model.missingFx).toEqual([]);
  expect(model.referenceStatus).toBe('fx');
  expect(model.missingReferenceFx).toEqual(['ABC → EUR']);
  expect(model.spentToToday).toBe(45);
  expect(notification).toMatchObject({ spentToToday: 45, deltaReferenceAmount: null, deltaReferencePct: null,
    paceReferencePct: null, referenceToToday: null, referencePerDay: null });
  const host = { innerHTML: '' };
  expect(renderPreviousPeriodComparison({host, current: model, computeForRange: () => ({
    ...model, avgPerDay: 10, spentToToday: 30,
  })}).metrics).toMatchObject({ delta: 5 });
});

it('distinguishes no reference from a real zero gap against an available reference', () => {
  const available = computeAnalysis({ transactions: [transaction({ amount: 35 })], withSummary: true });
  expect(available.model.referenceStatus).toBe('available');
  expect(available.notification).toMatchObject({ deltaReferenceAmount: 0, paceReferencePct: 100 });
  const none = computeAnalysis({ transactions: [transaction({ amount: 35 })], segments, withSummary: true });
  expect(none.model.referenceStatus).toBe('none');
  expect(none.notification).toMatchObject({ spentToToday: 35, deltaReferenceAmount: null, paceReferencePct: null });
});

it('separates proven exchange-rate origins for app totals and country references', () => {
  const traceHits = [];
  const { model } = computeAnalysis({
    withSummary: true, referenceCurrency: 'CAD', mode: 'expenses',
    transactions: [
      transaction({ amount: 60, currency: 'AUD' }),
      transaction({ amount: 60, currency: 'AUD' }),
      transaction({ amount: 20, currency: 'NZD' }),
      transaction({ amount: 40, currency: 'JPY', pay_now: false }),
      transaction({ amount: 0, currency: 'XPF' }),
    ],
    convert(amount, from, to, date, legs) {
      traceHits.push([amount, from, to, date]);
      if (from === 'AUD') legs?.push({ currency: 'AUD', kind: 'automatic', asOf: '2026-08-07' }, { currency: 'EUR', kind: 'pivot' });
      if (from === 'CAD') legs?.push({ currency: 'CAD', kind: 'manual', asOf: '2026-08-09' }, { currency: 'EUR', kind: 'pivot' });
      return amount / 2;
    },
  });
  expect(model.spent).toBe(70);
  expect(model.fxSources).toEqual({
    totals: { legs: [{ currency: 'AUD', kind: 'automatic', asOf: '2026-08-07' }], hasUnattributed: true },
    reference: { legs: [{ currency: 'CAD', kind: 'manual', asOf: '2026-08-09' }], hasUnattributed: false },
  });
  expect(traceHits.filter(([, from]) => from === 'AUD')).toHaveLength(1);
  expect(traceHits.some(([, from]) => from === 'XPF' || from === 'JPY')).toBe(false);
});

it('keeps distinct rate dates and does not give an origin to failed FX', () => {
  const model = computeAnalysis({
    transactions: [
      transaction({ amount: 60, currency: 'AUD' }),
      transaction({ amount: 60, currency: 'AUD', date: '2026-08-11' }),
      transaction({ amount: 10, currency: 'NZD' }),
    ],
    convert(amount, from, _to, date, legs) {
      if (from === 'NZD') return 0;
      legs?.push({ currency: 'AUD', kind: 'automatic', asOf: date === '2026-08-10' ? '2026-08-07' : '2026-08-08' });
      return amount / 2;
    },
  });
  expect(model.missingFx).toEqual(['NZD → EUR']);
  expect(model.fxSources.totals).toEqual({ legs: [
    { currency: 'AUD', kind: 'automatic', asOf: '2026-08-07' },
    { currency: 'AUD', kind: 'automatic', asOf: '2026-08-08' },
  ], hasUnattributed: false });
});

it.each(['fr', 'en'])('labels distinct rate dates and scopes in %s', lang => {
  const element = tag => ({
    tag, dataset: {}, style: {}, children: [], textContent: '',
    appendChild(node) { this.children.push(node); },
  });
  const window = {};
  const context = vm.createContext({
    window, document: { createElement: element, addEventListener() {} },
  });
  vm.runInContext(legacy.replace('  function _renderFxSources(', '  window.renderFixture = _renderFxSources;\n  function _renderFxSources('), context);
  const host = element('div');
  const totals = {
    legs: [
      { currency: 'AUD', kind: 'automatic', asOf: '2026-08-10' },
      { currency: 'AUD', kind: 'automatic', asOf: '2026-08-11' },
      { currency: 'NZD', kind: 'manual', asOf: '2026-08-12' },
    ],
    hasUnattributed: true,
  };
  const reference = { legs: [{ currency: 'XPF', kind: 'period' }] };
  const previous = { fxSources: { totals: { legs: [{ currency: 'CAD', kind: 'automatic' }] } } };
  const model = { referenceStatus: 'available', fxSources: { totals, reference } };
  window.renderFixture(host, model, previous, lang === 'en');
  const [toggle, current, earlier, country] = host.children[0].children;
  expect(toggle.tag).toBe('summary');
  const lines = section => section.children[1].children.map(node => node.textContent);
  expect(current.children[0].textContent).toBe(lang === 'en' ? 'Displayed period' : 'Période affichée');
  expect(lines(current)).toEqual(lang === 'en' ? [
    'AUD : cached automatic rate (value date : 2026-08-10)',
    'AUD : cached automatic rate (value date : 2026-08-11)',
    'NZD : manual rate (setting date : 2026-08-12)',
    'The source of some rates is not available.',
  ] : [
    'AUD : taux automatique en cache (date de valeur : 2026-08-10)',
    'AUD : taux automatique en cache (date de valeur : 2026-08-11)',
    'NZD : taux manuel (date associée au réglage : 2026-08-12)',
    'Origine non renseignée pour certains taux.',
  ]);
  expect(earlier.children[0].textContent).toBe(lang === 'en' ? 'Previous period' : 'Période précédente');
  expect(lines(earlier)[0]).toContain(lang === 'en' ? 'date not available' : 'date non renseignée');
  expect(country.children[0].textContent).toBe(lang === 'en' ? 'Country benchmark' : 'Référence pays');
  expect(lines(country)[0]).toContain(lang === 'en' ? 'period rate fallback' : 'repli sur le taux de la période');

  const unavailable = element('div');
  window.renderFixture(unavailable, { ...model, referenceStatus: 'fx' }, undefined, lang === 'en');
  expect(unavailable.children[0].children).toHaveLength(2);
});
