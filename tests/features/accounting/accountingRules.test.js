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
    expect(buildAccountingReport({ transactions: rows }, { ...options, mode: 'native' }).expenses).toBe(100);
  });
  it('does not treat out-of-budget as an accounting exclusion', () => {
    expect(buildAccountingReport({ transactions: [tx('one', { out_of_budget: true, affects_budget: false })] }, options).expenses).toBe(100);
  });
  it('supports classification and manual capital exclusions without reversing income/expense', () => {
    const t = tx('x');
    const settings = { mapping: { [categoryKey(t)]: '602' } };
    expect(buildAccountingReport({ transactions: [t] }, { ...options, settings }).entries[0].account).toBe('602');
    settings.mapping[categoryKey(t)] = '701';
    expect(buildAccountingReport({ transactions: [t] }, { ...options, settings }).entries[0].account).toBe('601');
    settings.mapping[categoryKey(t)] = '471';
    expect(buildAccountingReport({ transactions: [t] }, { ...options, settings }).expenses).toBe(0);
  });
  it('uses disclosed provisional zero complements, preserves dated values and never invents wallet balances', () => {
    expect(buildAccountingReport({ ...base(), walletBalances: [] }, { ...options, settings: {} })).toMatchObject({ debt: 0, receivable: 0, cash: null, netWorth: null });
    expect(buildAccountingReport(base(), { ...options, today: '2026-02-01' })).toMatchObject({ netWorth: 1900, totalAssets: 1900, totalFunding: 1900 });
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
  it('consolidates daily flows, closing cash and historical asset cost at distinct rates', () => {
    const data = { ...base(), assets: [{ ...asset, currency: 'AUD' }], transactions: [tx('eur'), tx('aud1', { currency: 'AUD' }), tx('aud2', { currency: 'AUD', date_start: '2026-01-06' })], wallets: [{ id: 'w', currency: 'AUD' }], walletBalances: [{ wallet_id: 'w', effective_balance: 100 }], fx: { series: { 'AUD:EUR': [{ date: '2026-01-01', rate: 0.5 }, { date: '2026-01-05', rate: 0.5 }, { date: '2026-01-06', rate: 0.6 }, { date: '2026-01-30', rate: 0.7 }] } } };
    const settings = { balances: { EUR: { debt: 0, receivable: 0, asOf: options.today }, AUD: { debt: 10, receivable: 20, asOf: options.today } } };
    const report = buildAccountingReport(data, { ...options, settings });
    expect(report).toMatchObject({ expenses: 260, depreciation: 50, cash: 70, netAssets: 550, debt: 7, receivable: 14, netWorth: 627 });
    expect(report.entries.find(e => e.sourceId === 'aud2')).toMatchObject({ originalAmount: 100, originalCurrency: 'AUD', amount: 60, fxDate: '2026-01-06' });
    expect(report.assetRows[0]).toMatchObject({ gross: 600, accumulated: 50, fxDate: '2026-01-01' });
  });
  it('keeps missing-rate movements visible and invalidates affected totals', () => {
    const report = buildAccountingReport({ ...base(), transactions: [tx('foreign', { currency: 'AUD' })] }, options);
    expect(report).toMatchObject({ expenses: null, result: null, savingRate: null });
    expect(report.entries.find(e => e.sourceId === 'foreign')).toMatchObject({ originalAmount: 100, originalCurrency: 'AUD', amount: null });
    expect(report.warnings.join(' ')).toContain('sans taux FX');
  });
});

it('nets signed reversals in cents and sorts accounts, categories and dates ascending', () => {
  const report = buildAccountingReport({ transactions: [tx('b', { amount: -1 }), tx('a', { amount: 1 }), tx('c', { amount: 0.1 }), tx('d', { amount: 0.2 }), tx('e', { amount: -0.3 }), tx('salary', { type: 'income', amount: 1 }), tx('reversal', { type: 'income', amount: -1 }), tx('zero', { amount: 0 })] }, options);
  expect(report).toMatchObject({ income: 0, expenses: 0, result: 0 });
  expect(report.entries).toHaveLength(8);
  expect(report.excluded).toHaveLength(0);
  expect(report.entries.map(e => e.account)).toEqual(['601', '601', '601', '601', '601', '601', '708', '708']);
});
it('balances positive wallets, overdrafts, debts and negative net worth without plugging an asset', () => {
  const report = buildAccountingReport({ wallets: [{ id: 'p', currency: 'EUR' }, { id: 'n', currency: 'EUR' }], walletBalances: [{ wallet_id: 'p', effective_balance: 100 }, { wallet_id: 'n', effective_balance: -200 }] }, { ...options, settings: { balances: { EUR: { debt: 50, receivable: 10, asOf: '2025-12-01' } } } });
  expect(report).toMatchObject({ cash: -100, netWorth: -140, totalAssets: 110, liabilities: 250, totalFunding: 110 });
  expect(report.unconfirmed.length).toBeGreaterThan(0);
});
it('calculates performance using elapsed days and keeps undefined ratios null', () => {
  const data = { transactions: [tx('salary', { type: 'income', amount: 2000 }), tx('food', { amount: 1000 })], wallets: [{ id: 'w', currency: 'EUR' }], walletBalances: [{ wallet_id: 'w', effective_balance: 3000 }] };
  const report = buildAccountingReport(data, { ...options, end: '2026-12-31' });
  expect(report).toMatchObject({ savingRate: 50, autonomyMonths: 3.06, debtRatio: 0, totalAssets: 3000, totalFunding: 3000 });
  expect(buildAccountingReport({}, { ...options, settings: {} })).toMatchObject({ netWorth: 0, totalAssets: 0, totalFunding: 0, savingRate: null, debtRatio: null, autonomyMonths: null });
});

it('does not mistake missing transaction amounts for signed zero', () => {
  const report = buildAccountingReport({ transactions: [tx('missing', { amount: null }), tx('blank', { amount: '' }), tx('zero', { amount: 0 })] }, options);
  expect(report.entries.map(e => e.sourceId)).toEqual(['zero']);
  expect(report.excluded.map(e => e.reason)).toEqual(['Montant invalide', 'Montant invalide']);
});
