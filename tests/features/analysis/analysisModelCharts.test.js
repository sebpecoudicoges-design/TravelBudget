import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import * as rules from '../../../src/core/budgetAnalysisRules.js';
import * as cash from '../../../src/features/analysis/analysisCashBreakdown.js';

const legacy = fs.readFileSync(new URL('../../../public/legacy/js/33_budget_analysis.js', import.meta.url), 'utf8');

function computeAnalysis({ transactions, mode = 'planned', convert }) {
  const first = '2026-08-10';
  const last = '2026-08-12';
  const window = {
    TBCore: { budgetAnalysisRules: rules },
    TBAnalysisCashBreakdown: cash,
    tbFxConvertForDateCached: convert,
    TB_CONST: { ANALYSIS: { SOURCED_CATEGORY_MAPPING: { transport: { mode: 'mapped', bucket: 'Transport' } } } },
  };
  const filters = {
    'analysis-period': 'range', 'analysis-mode': mode,
    'analysis-range-start': first, 'analysis-range-end': last,
  };
  const state = {
    user: { baseCurrency: 'EUR' },
    activeTravelId: 'travel-fixture',
    period: { start: first, end: last, dailyBudgetBase: 25 },
    budgetSegments: [{ id: 'ref-day', travelId: 'travel-fixture', start: first, end: first, baseCurrency: 'EUR' }],
    transactions,
  };
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-08-14T12:00:00'])); }
  }
  const context = vm.createContext({
    window, state, Map, Date: FixtureDate,
    document: { getElementById: (id) => filters[id] ? { value: filters[id] } : null, addEventListener() {} },
    toLocalISODate: (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
      .map((part, i) => String(part).padStart(i === 0 ? 4 : 2, '0')).join('-'),
  });
  vm.runInContext(legacy.replace('  function _computeModel(){', '  window.__fixtureModel = _computeModel; window.__fixtureReference = referenceCache;\n  function _computeModel(){'), context);
  window.__fixtureReference.bySegment['ref-day'] = {
    currency_code: 'EUR', recommended_daily_amount: 35, recommended_transport_daily_amount: 35,
  };
  return window.__fixtureModel();
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
  expect(model.velocity).toEqual([15, 15, 15]);
  expect(model.comparablePerDay).toBe(15);
  expect(converted.length).toBeGreaterThan(0);
  expect(converted).toEqual(converted.map(() => ({ from: 'NZD', base: 'EUR', date: '2026-08-12' })));
});
