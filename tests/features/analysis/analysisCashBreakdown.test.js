import { describe, expect, it } from 'vitest';
import { applyBudgetOffsets, buildCashBreakdown, isExpenseOffsetIncome } from '../../../src/features/analysis/analysisCashBreakdown.js';

describe('analysis cash breakdown', () => {
  it('recognizes an income in an expense category as a budget offset', () => {
    expect(isExpenseOffsetIncome({ type: 'income', category: 'Essence' }, ['Repas', 'Essence'])).toBe(true);
    expect(isExpenseOffsetIncome({ type: 'income', category: 'Salaire' }, ['Repas', 'Essence'])).toBe(false);
  });
  it('keeps gross cash flows and exposes subcategories only for real budget mode', () => {
    const result = buildCashBreakdown({
      income: [{ amount: 25, category: 'Essence', subcategory: 'Remboursement' }],
      expenses: [{ amount: 100, category: 'Essence', subcategory: 'Carburant', paid: true }],
      convert: (row) => row.amount,
      category: (row) => row.category,
      subcategory: (row) => row.subcategory,
      isPaid: (row) => row.paid,
      scope: 'budget',
      mode: 'expenses',
    });
    expect(result.cashIncomeCategories).toEqual([['Essence', 25]]);
    expect(result.cashExpenseCategories).toEqual([['Essence', 100]]);
    expect(result.cashIncomeSubcategories).toEqual([['Essence › Remboursement', 25]]);
    expect(result.cashExpenseSubcategories).toEqual([['Essence › Carburant', 100]]);
    expect(result.cashBreakdownBySubcategory).toBe(true);
  });

  it('subtracts a refund from its expense category and daily budget', () => {
    const dailyMap = { '2026-08-20': 100 };
    const categoryMap = new Map([['Essence', 100]]);
    const delta = applyBudgetOffsets({
      offsets: [{ type: 'income', category: 'Essence', subcategory: 'Remboursement' }],
      allocate: () => ({ amount: 25, perDay: 25, visibleBudgetDays: ['2026-08-20'], fullBudgetDays: ['2026-08-20'], cashDate: '2026-08-20', budgetStart: '2026-08-20', budgetEnd: '2026-08-20' }),
      category: (row) => row.category,
      subcategory: (row) => row.subcategory,
      dailyMap,
      categoryMap,
      categoryRows: new Map(),
      subcategoryMap: new Map(),
      subcategoryRows: new Map(),
    });
    expect(delta).toBe(-25);
    expect(dailyMap['2026-08-20']).toBe(75);
    expect(categoryMap.get('Essence')).toBe(75);
  });
});
