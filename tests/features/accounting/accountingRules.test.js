import { describe, it, expect } from 'vitest';
import { buildAccountingReport, depreciationSchedule, categoryKey, validDate } from '../../../src/features/accounting/accountingRules.js';

const options = { start: '2026-01-01', end: '2026-01-31', today: '2026-01-31', currency: 'EUR', travelId: 't', settings: { balances: { EUR: { debt: 0, receivable: 0, asOf: '2026-01-31' } } } };
const tx = (id, patch = {}) => ({ id, travel_id: 't', date_start: '2026-01-05', type: 'expense', amount: 100, currency: 'EUR', pay_now: true, category: 'Repas', ...patch });
const asset = { id: 'a', travel_id: 't', currency: 'EUR', purchase_date: '2026-01-01', purchase_value: 1200, residual_value: 0, depreciation_months: 12, status: 'active' };
const base = () => ({ transactions: [tx('purchase', { amount: 1200 })], assets: [asset], owners: [], links: [{ asset_id: 'a', transaction_id: 'purchase', relation_type: 'purchase' }], wallets: [{ id: 'w', currency: 'EUR', travel_id: 't' }], walletBalances: [{ wallet_id: 'w', effective_balance: 800 }] });

describe('personal accounting statements', () => {
  it('reconciles acquisition versus depreciation without double expense', () => {
    const report = buildAccountingReport(base(), options);
    expect(report).toMatchObject({ cash: 800, result: -100, netAssets: 1100, netWorth: 1900, depreciation: 100 });
    expect(report.entries).toHaveLength(1);
    expect(report.assetRows[0]).toMatchObject({ gross: 1200, accumulated: 100, amount: 1100 });
    expect(report.excluded[0].reason).toContain('Achat immobilisé');
  });
  it('keeps only unpaid personal Trip share, not gross cash or neutralized shadow', () => {
    const data = { transactions: [tx('cash', { amount: 99.70, trip_expense_id: 'trip-e', out_of_budget: true }), tx('share', { amount: 49.85, label: '[Trip] Repas', is_internal: true, pay_now: false, affects_budget: true }), tx('old', { label: '[Trip] Repas', is_internal: true, pay_now: false, affects_budget: false, out_of_budget: true })] };
    const report = buildAccountingReport(data, options);
    expect(report.expenses).toBe(49.85);
    expect(report.entries.map(e => e.sourceId)).toEqual(['share']);
  });
  it('retains a fully personal Trip payment if it affects the budget', () => {
    expect(buildAccountingReport({ transactions: [tx('own', { trip_expense_id: 'e', affects_budget: true, out_of_budget: false })] }, options).expenses).toBe(100);
  });
  it('ignores transfers, adjustments, future or unpaid ordinary expenses and simulation rows', () => {
    const data = { transactions: [tx('transfer', { internal_transfer_id: 'i' }), tx('adjust', { category: 'Ajustement wallet' }), tx('unpaid', { pay_now: false }), tx('future', { date_start: '2026-02-01' }), tx('virtual', { virtualBudgetOnly: true })] };
    expect(buildAccountingReport(data, { ...options, end: '2026-12-31' }).result).toBe(0);
  });
  it('filters travel and currency and deduplicates source IDs', () => {
    const rows = [tx('yes'), tx('yes'), tx('other', { travel_id: 'other' }), tx('foreign', { currency: 'AUD' })];
    expect(buildAccountingReport({ transactions: rows }, options).expenses).toBe(100);
  });
  it('does not treat out-of-budget as an accounting exclusion', () => {
    expect(buildAccountingReport({ transactions: [tx('one', { out_of_budget: true, affects_budget: false })] }, options).expenses).toBe(100);
  });
  it('supports classification and manual capital exclusions without reversing income/expense', () => {
    const t = tx('x');
    const settings = { mapping: { [categoryKey(t)]: '602' } };
    expect(buildAccountingReport({ transactions: [t] }, { ...options, settings }).entries[0].account).toBe('602');
    settings.mapping[categoryKey(t)] = '701';
    expect(buildAccountingReport({ transactions: [t] }, { ...options, settings }).entries[0].account).toBe('606');
    settings.mapping[categoryKey(t)] = '471';
    expect(buildAccountingReport({ transactions: [t] }, { ...options, settings }).expenses).toBe(0);
  });
  it('does not invent zero debts, receivables or wallet balances', () => {
    expect(buildAccountingReport({ ...base(), walletBalances: [] }, { ...options, settings: {} })).toMatchObject({ debt: null, receivable: null, cash: null, netWorth: null });
    expect(buildAccountingReport(base(), { ...options, today: '2026-02-01' }).netWorth).toBeNull();
  });
  it('preserves residual value, ownership and rounding over a full schedule', () => {
    const schedule = depreciationSchedule({ ...asset, purchase_value: 100, residual_value: 1, depreciation_months: 7 }, 0.5);
    expect(schedule.reduce((n, r) => n + Math.round(r.amount * 100), 0)).toBe(4950);
    expect(schedule.at(-1).date).toBe('2026-07-31');
    expect(depreciationSchedule({ ...asset, purchase_date: '2024-01-31' })[1].date).toBe('2024-02-29');
  });
  it('does not confuse budget opt-out or manual budget with accounting depreciation', () => {
    const data = { ...base(), assets: [{ ...asset, include_in_budget: false, budget_method: 'manual', monthly_budget_override: 1 }], owners: [{ asset_id: 'a', is_me: true, ownership_percent: 50 }] };
    expect(buildAccountingReport(data, options)).toMatchObject({ depreciation: 50, netAssets: 550 });
  });
  it('signals unknown ownership and invalid depreciation rather than assuming the first owner is me', () => {
    const data = { ...base(), owners: [{ asset_id: 'a', display_name: 'Autre personne', ownership_percent: 80 }] };
    const report = buildAccountingReport(data, options);
    expect(report.assetRows).toEqual([]);
    expect(report.warnings.join(' ')).toContain('Quote-part');
    expect(depreciationSchedule({ ...asset, depreciation_months: 0 })).toBeNull();
    expect(validDate('2026-02-31')).toBe(false);
  });
  it('computes saving rate before depreciation and refuses division by zero', () => {
    const data = { ...base(), transactions: [...base().transactions, tx('salary', { type: 'income', amount: 2000 }), tx('food', { amount: 500 })] };
    expect(buildAccountingReport(data, options)).toMatchObject({ income: 2000, expenses: 600, result: 1400, savingRate: 75 });
    expect(buildAccountingReport(base(), options).savingRate).toBeNull();
  });
  it('flags unsupported disposals and does not count sale proceeds as full income', () => {
    const data = { ...base(), assets: [{ ...asset, status: 'sold' }], transactions: [tx('sale', { type: 'income' })], links: [{ asset_id: 'a', transaction_id: 'sale', relation_type: 'sale' }] };
    const report = buildAccountingReport(data, options);
    expect(report.income).toBe(0);
    expect(report.warnings.join(' ')).toContain('rapprocher');
  });
});
