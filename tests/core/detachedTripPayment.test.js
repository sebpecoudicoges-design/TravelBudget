import { describe, it, expect } from 'vitest';
import { affectsBudgetAnalysisDataset } from '../../src/core/budgetAnalysisRules.js';
import { computeWalletBalanceRows } from '../../src/core/walletBalanceRules.js';
import { buildAccountingReport } from '../../src/features/accounting/accountingRules.js';
import { isTripCashExpense } from '../../src/features/analysis/analysisCashBreakdown.js';

describe('historical Trip payment after whole-Trip deletion', () => {
  const common = { type: 'expense', currency: 'AUD', wallet_id: 'w', date_start: '2026-01-05', category: 'Repas' };
  const payment = { ...common, id: 'payment', label: 'Restaurant', amount: 100, pay_now: true, affects_budget: false, out_of_budget: true };
  const share = { ...common, id: 'share', amount: 40, label: '[Trip] Restaurant', is_internal: true, pay_now: false, affects_budget: true };
  it.each([{ trip_expense_id: 'e' }, { detached_trip_payment: true }, { detachedTripPayment: true }])('keeps the same cash and personal amounts for %o', origin => {
    const rows = [{ ...payment, ...origin }, share];
    expect(rows.filter(affectsBudgetAnalysisDataset).map(r => r.amount)).toEqual([40]);
    expect(isTripCashExpense(rows[0])).toBe(true);
    expect(computeWalletBalanceRows([{ id: 'w', balance: 500 }], rows)[0].effective_balance).toBe(400);
    expect(buildAccountingReport({ transactions: rows }, { start:'2026-01-01', end:'2026-01-31', today:'2026-01-31', currency:'AUD' }).expenses).toBe(40);
  });
  it('retains an ordinary out-of-budget purchase and a fully personal Trip purchase', () => {
    expect(affectsBudgetAnalysisDataset(payment)).toBe(true);
    expect(affectsBudgetAnalysisDataset({ ...payment, detached_trip_payment:true, affects_budget:true, out_of_budget:false })).toBe(true);
  });
});
