import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/legacy/js/27_cashflow_curve.js', 'utf8');
function harness(transactions) {
  const parse = vi.fn((s) => s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
  const context = {
    window: { state: { transactions }, parseISODateOrNull: parse, toLocalISODate: (d) => d.toISOString().slice(0, 10) },
    excludedCats: new Set(['excluded']), safeNum: (n) => Number(n) || 0,
    toRenderForDate: vi.fn((amount, currency, date) => amount * (currency === 'AUD' ? (date.endsWith('02') ? 0.6 : 0.5) : 1)),
  };
  context.window.tbShouldHideFromBudgetViews = (t) => !!t.is_internal || !!t.hidden;
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function prepareBudgetExpenses('), source.indexOf('  function toBase(')) + source.slice(source.indexOf('  function txBudgetDateRange('), source.indexOf('  function addDistributed(')), context);
  const calculate = () => {
    const rows = context.prepareBudgetExpenses();
    return (date) => context.budgetSpentForDateInRenderCurrency(date, 'EUR', rows);
  };
  return { context, parse, calculate };
}
const expense = { type: 'expense', amount: 60, currency: 'EUR', date_start: '2026-10-01', budget_date_start: '2026-12-01', budget_date_end: '2026-12-03', pay_now: true };

describe('cashflow budget preparation', () => {
  it('keeps prepaid allocation on budget dates and converts at each allocated date', () => {
    const { calculate } = harness([expense, { ...expense, currency: 'AUD' }]);
    const spent = calculate();
    expect(spent('2026-10-01')).toBe(0);
    expect(spent('2026-12-01')).toBe(30);
    expect(spent('2026-12-02')).toBe(32);
    expect(spent('2026-12-03')).toBe(30);
    expect(spent('2026-12-04')).toBe(0);
  });
  it('preserves exclusions, unpaid cash expenses and budget-only Trip shares', () => {
    const excluded = [{ hidden: true }, { is_internal: true }, { type: 'income' }, { category: 'excluded' }, { affectsBudget: false }, { outOfBudget: true }, { out_of_budget: true }, { pay_now: false }, { pay_now: false, label: '[Trip] Avance' }];
    const { calculate } = harness([...excluded.map((flags) => ({ ...expense, ...flags })), { ...expense, pay_now: false, label: '[Trip] quote-part' }, { ...expense, pay_now: false, affectsCash: false }]);
    expect(calculate()('2026-12-02')).toBe(40);
  });
  it('supports camelCase ranges, cash date fallback, invalid dates and negative expense amounts', () => {
    const { calculate } = harness([
      { type: 'expense', amount: 20, budgetDateStart: '2026-12-01', budgetDateEnd: '2026-12-02' },
      { type: 'expense', amount: -4, date: '2026-12-02' },
      { ...expense, budget_date_start: 'invalid' },
      { ...expense, budget_date_start: '2026-12-03', budget_date_end: '2026-12-01' },
    ]);
    expect(calculate()('2026-12-02')).toBe(6);
  });
  it('reads dates once per calculation, then refreshes after edits, account and category changes', () => {
    const { context, parse, calculate } = harness(Array.from({ length: 1200 }, () => ({ ...expense })));
    const spent = calculate();
    const parsed = parse.mock.calls.length;
    for (let day = 1; day <= 31; day++) spent(`2026-12-${String(day).padStart(2, '0')}`);
    expect(parsed).toBe(2400);
    expect(parse).toHaveBeenCalledTimes(parsed);
    context.window.state.transactions = [{ ...expense, amount: 30, category: 'food' }];
    expect(calculate()('2026-12-02')).toBe(10);
    context.excludedCats.add('food');
    expect(calculate()('2026-12-02')).toBe(0);
    context.window.state = { transactions: [] };
    expect(calculate()('2026-12-02')).toBe(0);
  });
  it('does not restore the unused chart wrapper or prepare transactions inside the daily loop', () => {
    expect(source).not.toContain('ensureCashflowChartAlias');
    expect(source).toContain('budgetSpentForDateInRenderCurrency(k, barCurrency, budgetExpenses)');
    expect(source.indexOf('const budgetExpenses = prepareBudgetExpenses();')).toBeLessThan(source.indexOf('let bal = startBalance;'));
  });
});
