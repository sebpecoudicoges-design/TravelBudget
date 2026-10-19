import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import * as dailyBudgetRules from '../../src/core/dailyBudgetRules.js';

const boat = { type: 'expense', amount: 226.26, currency: 'EUR', pay_now: true, affects_budget: true, out_of_budget: false, date_start: '2026-10-18', budget_date_start: '2026-12-09', budget_date_end: '2026-12-14' };
const stay = { ...boat, amount: 327.75, date_start: '2026-10-19', budget_date_end: '2026-12-11' };
const remaining = (transactions, dateISO, dailyBudget = 100) => dailyBudgetRules.remainingCashBudgetForDate({ transactions, dateISO, dailyBudget });

describe('paid future budget cash projection', () => {
  it('subtracts only the unused daily allowance and does not spread overspending over other days', () => {
    expect(remaining([boat, stay], '2026-12-09')).toBe(0);
    expect(remaining([boat, stay], '2026-12-12')).toBeCloseTo(62.29);
    expect(remaining([boat, stay], '2026-12-15')).toBe(100);
    const days = ['09','10','11','12','13','14'];
    const futureCash = days.reduce((sum, day) => sum + remaining([boat, stay], `2026-12-${day}`), 0);
    // Six days at 100, with 46.96/day overspending on the first three days.
    expect(1000 - 554.01 - futureCash).toBeCloseTo(400 - 140.88);
  });
  it('does not credit unpaid, out-of-budget, internal or non-budget movements', () => {
    const excluded = [{ ...boat, pay_now: false }, { ...boat, out_of_budget: true }, { ...boat, affects_budget: false }, { ...boat, is_internal: true }, { ...boat, type: 'income' }];
    expect(remaining(excluded, '2026-12-09')).toBe(100);
  });
  it('supports camelCase dates, overlapping payments and date-specific currency conversion', () => {
    const tx = { type: 'expense', amount: 100, currency: 'AUD', payNow: true, budgetDateStart: '2026-12-01', budgetDateEnd: '2026-12-02' };
    const result = dailyBudgetRules.remainingCashBudgetForDate({ transactions: [tx, tx], dateISO: '2026-12-02', dailyBudget: 80, convertAmount: (amount, currency, date) => amount / (currency === 'AUD' && date === '2026-12-02' ? 2 : 1) });
    expect(result).toBe(30);
  });
  it('keeps the actual KPI unchanged for an advance within budget and charges only a daily excess', () => {
    const source = fs.readFileSync('public/legacy/js/11_kpi_render_micro_animation.js', 'utf8');
    const fn = source.slice(source.indexOf('function projectedEndDisplayWithOptions('), source.indexOf('function _toBaseForDate('));
    const context = {
      state: { period: { baseCurrency: 'EUR', end: '2026-12-14', dailyBudgetBase: 100 }, wallets: [{ balance: 1000, currency: 'EUR' }], transactions: [] },
      window: { Core: { dailyBudgetRules }, getDisplayDateISO: () => '2026-12-08' },
      getDailyBudgetInfoForDate: () => ({ remaining: 100, baseCurrency: 'EUR' }),
      getBudgetSegmentForDate: () => ({ dailyBudgetBase: 100, baseCurrency: 'EUR' }),
      parseISODateOrNull: (s) => new Date(`${s}T00:00:00Z`),
      toLocalISODate: (d) => d.toISOString().slice(0, 10),
      forEachDateInclusive: (a, b, cb) => { for (let d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) cb(d); },
    };
    vm.createContext(context); vm.runInContext(fn, context);
    const project = () => context.projectedEndDisplayWithOptions({ scope: 'period' });
    expect(project()).toBe(300);
    context.state.wallets[0].balance -= boat.amount;
    context.state.transactions = [boat];
    expect(project()).toBeCloseTo(300);
    context.state.wallets[0].balance -= stay.amount;
    context.state.transactions.push(stay);
    expect(project()).toBeCloseTo(159.12);
    // A horizon before the allocated dates must still show the cash already paid.
    expect(context.projectedEndDisplayWithOptions({ rangeEndISO: '2026-12-08' })).toBeCloseTo(345.99);
  });
  it('routes both the cashflow curve and KPI through the shared rule', () => {
    for (const file of ['11_kpi_render_micro_animation.js', '27_cashflow_curve.js']) {
      expect(fs.readFileSync(`public/legacy/js/${file}`, 'utf8')).toContain('dailyBudgetRules.remainingCashBudgetForDate');
    }
  });
});
