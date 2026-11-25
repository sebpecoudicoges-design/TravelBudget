import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import * as dailyBudgetRules from '../../src/core/dailyBudgetRules.js';
import * as budgetAnalysisRules from '../../src/core/budgetAnalysisRules.js';
import * as analysisCash from '../../src/features/analysis/analysisCashBreakdown.js';
import { computeWalletBalanceRows } from '../../src/core/walletBalanceRules.js';
import { buildTripAdvanceTransactionArgs, buildTripPersonalShareTransactionArgs, computeTripAnalysis } from '../../src/core/tripRules.js';

const readLegacy = (name) => fs.readFileSync(new URL(`../../public/legacy/js/${name}.js`, import.meta.url), 'utf8');
const first = '2026-10-20';
const last = '2026-10-23';
const wallet = { id: 'wallet-fixture', currency: 'EUR', balance: 500 };
const tripInput = {
  walletId: wallet.id, currency: wallet.currency, category: 'Food', label: 'Avance dégustation',
  date: first, budgetDateStart: '2026-10-21', budgetDateEnd: last,
};
const asRow = (payload) => Object.fromEntries(Object.entries(payload).map(([key, value]) => [key.slice(2), value]));
const transactions = [
  { ...asRow(buildTripAdvanceTransactionArgs({ ...tripInput, amount: 120 })), id: 'advance', trip_expense_id: 'trip-expense' },
  { ...asRow(buildTripPersonalShareTransactionArgs({ ...tripInput, myShare: 45 })), id: 'share',
    trip_share_link_id: 'trip-share', is_internal: true },
  { ...asRow(buildTripPersonalShareTransactionArgs({ ...tripInput, myShare: 15 })), id: 'refund', label: 'Avoir vendeur',
    type: 'income', date_start: '2026-10-22', date_end: '2026-10-22', pay_now: true },
];

function runLegacy(finances, rangeStart = first, rangeEnd = last) {
  const state = {
    user: { baseCurrency: 'EUR' }, period: { start: first, end: last, baseCurrency: 'EUR', dailyBudgetBase: 50 },
    transactions: finances, wallets: [wallet], activeTravelId: 'fixture',
  };
  const filters = {
    'analysis-period': 'range', 'analysis-mode': 'expenses',
    'analysis-range-start': rangeStart, 'analysis-range-end': rangeEnd,
  };
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-23T12:00:00'])); }
  }
  const context = vm.createContext({
    state, Date: FixtureDate, Map, addEventListener() {}, setTimeout() {}, localStorage: { getItem() { return null; } },
    document: { getElementById: (id) => filters[id] ? { value: filters[id] } : null, addEventListener() {}, readyState: 'loading' },
    periodContains: (date) => date >= first && date <= last,
    amountToBase: (amount) => amount,
  });
  // Match the legacy runtime: globals are window properties.
  context.window = context;
  Object.assign(context, {
    Core: { dailyBudgetRules }, TBCore: { budgetAnalysisRules }, TBAnalysisCashBreakdown: analysisCash,
    tbGetWalletEffectiveBalance: () => computeWalletBalanceRows([wallet], finances)[0].effective_balance,
  });
  vm.runInContext(readLegacy('01_helpers'), context);
  vm.runInContext(readLegacy('06_allocations'), context);
  vm.runInContext(readLegacy('27_cashflow_curve').replace(
    'function buildSeries() {', 'window.fixtureCurve = buildSeries;\nfunction buildSeries() {',
  ), context);
  vm.runInContext(readLegacy('33_budget_analysis').replace(
    'function _computeModel(){', 'window.fixtureAnalysis = _computeModel;\nfunction _computeModel(){',
  ), context);
  context.recomputeAllocations();
  return { context, curve: context.fixtureCurve(), analysis: context.fixtureAnalysis() };
}

it('separates the Trip group cost, wallet debit and allocated personal net budget', () => {
  const trip = computeTripAnalysis({
    pivot: 'EUR',
    members: [{ id: 'me', name: 'Moi', isMe: true }, { id: 'other', name: 'Autre' }],
    expenses: [{ id: 'trip-expense', kind: 'expense', category: 'Food', amount: 120, currency: 'EUR', paidByMemberId: 'me' }],
    shares: [{ expenseId: 'trip-expense', memberId: 'me', shareAmount: 45 },
      { expenseId: 'trip-expense', memberId: 'other', shareAmount: 75 }],
  });
  expect(trip.categories).toEqual([{ name: 'Food', amount: 120 }]);
  expect(trip.participants).toMatchObject([{ id: 'me', paid: 120, owed: 45, net: 75 }, { id: 'other', paid: 0, owed: 75, net: -75 }]);
  expect(computeWalletBalanceRows([wallet], transactions)[0]).toMatchObject({ effective_balance: 395, transactions_delta: -105, included_tx_count: 2 });

  const { context, curve, analysis } = runLegacy(transactions);
  const used = (date) => context.state.allocations.filter(row => row.dateStr === date).reduce((sum, row) => sum + row.amountBase, 0);
  expect([first, '2026-10-21', '2026-10-22', last].map(used)).toEqual([0, 10, 10, 10]);
  expect(analysis).toMatchObject({ expenseReal: 120, incomeReal: 15, deltaReal: -105, spent: 30, credits: 15, velocity: [0, 10, 10, 10] });

  expect(curve.ok).toBe(true);
  expect(curve.actual.map(point => point.y)).toEqual([380, 380, 395, 395]);
  expect(curve.forecast.at(-1).y).toBe(395);
  // The dashboard expense bars show committed expense share, independently of cash timing.
  expect(curve.budgetUsedVal.map(point => point.y)).toEqual([0, 15, 15, 15]);
});

it('filters Analyse cash by operation date, and budget by allocation date', () => {
  const cashDay = runLegacy(transactions, first, first).analysis;
  expect(cashDay).toMatchObject({ expenseReal: 120, incomeReal: 0, spent: 0 });
  const budgetDays = runLegacy(transactions, '2026-10-21', '2026-10-22').analysis;
  expect(budgetDays).toMatchObject({ expenseReal: 0, incomeReal: 15, spent: 20, credits: 10 });
});
