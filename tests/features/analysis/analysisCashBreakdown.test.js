import { describe, expect, it } from 'vitest';
import { applyBudgetOffsets, applyPaidBudgetOffsets, buildCashBreakdown, filterCashTransactions, isExpenseOffsetIncome, isTripBudgetIncomeShare, isTripCashExpense, isTripCashIncome } from '../../../src/features/analysis/analysisCashBreakdown.js';

describe('analysis cash breakdown', () => {
  it('recognizes an income in an expense category as a budget offset', () => {
    expect(isExpenseOffsetIncome({ type: 'income', category: 'Essence' }, ['Repas', 'Essence'])).toBe(true);
    expect(isExpenseOffsetIncome({ type: 'income', category: 'Salaire' }, ['Repas', 'Essence'])).toBe(false);
  });

  it('separates a Trip cash receipt from its personal budget share', () => {
    const cashReceipt = {
      type: 'income', label: '[Trip] Entree recue - Voiture Gabin', amount: 30,
      category: 'Transport', subcategory: 'Essence', pay_now: true, out_of_budget: true,
      affects_budget: false, is_internal: false, trip_expense_id: 'trip-expense-id',
    };
    const budgetShare = {
      type: 'income', label: '[Trip] Part entree - Voiture Gabin', amount: 15,
      category: 'Transport', subcategory: 'Essence', pay_now: false, out_of_budget: false,
      affects_budget: true, is_internal: true,
    };
    expect(isTripCashIncome(cashReceipt)).toBe(true);
    expect(isTripBudgetIncomeShare(cashReceipt)).toBe(false);
    expect(isTripBudgetIncomeShare(budgetShare)).toBe(true);
    expect(isExpenseOffsetIncome(budgetShare, [])).toBe(true);
    const filtered = filterCashTransactions({
      rows: [cashReceipt, budgetShare], scope: 'budget', paid: (row) => row.pay_now,
      internal: (row) => row.is_internal, out: (row) => row.out_of_budget,
      category: (row) => row.category, subcategory: (row) => row.subcategory, tripCash: isTripCashIncome,
    });
    expect(filtered).toEqual([cashReceipt]);
    expect(isTripCashExpense({ type: 'expense', label: '[Trip] Avance - Essence', trip_expense_id: 'expense-id' })).toBe(true);
  });
  it('keeps gross cash flows and exposes subcategories in the budget scope', () => {
    const result = buildCashBreakdown({
      income: [{ amount: 25, category: 'Essence', subcategory: 'Remboursement' }],
      expenses: [{ amount: 100, category: 'Essence', subcategory: 'Carburant', paid: true }],
      convert: (row) => row.amount,
      category: (row) => row.category,
      subcategory: (row) => row.subcategory,
      isPaid: (row) => row.paid,
      scope: 'budget',
    });
    expect(result.cashIncomeCategories).toEqual([['Essence', 25]]);
    expect(result.cashExpenseCategories).toEqual([['Essence', 100]]);
    expect(result.cashIncomeSubcategories).toEqual([['Essence › Remboursement', 25]]);
    expect(result.cashExpenseSubcategories).toEqual([['Essence › Carburant', 100]]);
    expect(result.cashBreakdownBySubcategory).toBe(true);
  });

  it('shows category and subcategory breakdowns in planned mode for the budget scope', () => {
    const result = buildCashBreakdown({
      income: [{ amount: 77, category: 'Transport', subcategory: 'Essence' }],
      expenses: [], convert: (row) => row.amount, category: (row) => row.category,
      subcategory: (row) => row.subcategory, isPaid: () => false, scope: 'budget',
    });
    expect(result.cashIncomeCategories).toEqual([['Transport', 77]]);
    expect(result.cashIncomeSubcategories).toEqual([['Transport › Essence', 77]]);
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
    const paidMap = { '2026-08-20': 100 };
    expect(applyPaidBudgetOffsets({
      offsets: [{ amount: 25 }], isReal: () => true, paidMap,
      allocate: () => ({ amount: 25, perDay: 25, visibleBudgetDays: ['2026-08-20'] }),
    })).toBe(-25);
    expect(paidMap['2026-08-20']).toBe(75);
  });
});
