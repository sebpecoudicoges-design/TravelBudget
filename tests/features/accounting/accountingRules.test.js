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
  it('excludes all internal Trip shares and gross out-of-budget payments from accounting', () => {
    const data = { transactions: [tx('cash', { amount: 99.70, trip_expense_id: 'trip-e', out_of_budget: true }), tx('share', { amount: 49.85, label: '[Trip] Repas', is_internal: true, pay_now: false, affects_budget: true }), tx('old', { label: '[Trip] Repas', is_internal: true, pay_now: false, affects_budget: false, out_of_budget: true })] };
    const report = buildAccountingReport(data, options);
    expect(report.expenses).toBe(0);
    expect(report.entries).toEqual([]);
  });
  it('retains a fully personal Trip payment if it affects the budget', () => {
    expect(buildAccountingReport({ transactions: [tx('own', { trip_expense_id: 'e', affects_budget: true, out_of_budget: false })] }, options).expenses).toBe(100);
  });
  it('ignores internal and simulated rows but accrues unpaid budgeted charges', () => {
    const data = { transactions: [tx('transfer', { internal_transfer_id: 'i' }), tx('adjust', { category: 'Ajustement wallet' }), tx('unpaid', { pay_now: false }), tx('future', { date_start: '2026-02-01' }), tx('virtual', { virtualBudgetOnly: true })] };
    expect(buildAccountingReport(data, { ...options, end: '2026-12-31' }).result).toBe(-100);
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
    const settings = { mapping: { [categoryKey(t)]: '613220' } };
    expect(buildAccountingReport({ transactions: [t] }, { ...options, settings }).entries[0].account).toBe('613220');
    settings.mapping[categoryKey(t)] = '701';
    expect(buildAccountingReport({ transactions: [t] }, { ...options, settings }).entries[0].account).toBe('625710');
    settings.mapping[categoryKey(t)] = '471';
    expect(buildAccountingReport({ transactions: [t] }, { ...options, settings }).expenses).toBe(0);
  });
  it('requires confirmed complements and independently sourced equity, never plugs a total', () => {
    expect(buildAccountingReport({ ...base(), walletBalances: [] }, { ...options, settings: {} })).toMatchObject({ debt: null, receivable: null, cash: null, netWorth: null });
    expect(buildAccountingReport(base(), { ...options, today: '2026-02-01' })).toMatchObject({ netWorth: 1900, totalAssets: 1900, totalFunding: null });
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
  expect(report.entries.map(e => e.account)).toEqual(['625710', '625710', '625710', '625710', '625710', '625710', '758900', '758900']);
});
it('balances positive wallets, overdrafts, debts and negative net worth without plugging an asset', () => {
  const report = buildAccountingReport({ wallets: [{ id: 'p', currency: 'EUR' }, { id: 'n', currency: 'EUR' }], walletBalances: [{ wallet_id: 'p', effective_balance: 100 }, { wallet_id: 'n', effective_balance: -200 }] }, { ...options, settings: { balances: { EUR: { debt: 50, receivable: 10, asOf: '2025-12-01' } } } });
  expect(report).toMatchObject({ cash: -100, netWorth: -140, totalAssets: 110, liabilities: 250, totalFunding: null });
  expect(report.unconfirmed.length).toBeGreaterThan(0);
});
it('calculates performance using elapsed days and keeps undefined ratios null', () => {
  const data = { transactions: [tx('salary', { type: 'income', amount: 2000 }), tx('food', { amount: 1000 })], wallets: [{ id: 'w', currency: 'EUR' }], walletBalances: [{ wallet_id: 'w', effective_balance: 3000 }] };
  const report = buildAccountingReport(data, { ...options, end: '2026-12-31' });
  expect(report).toMatchObject({ savingRate: 50, autonomyMonths: 3.06, debtRatio: 0, totalAssets: 3000, totalFunding: null });
  expect(buildAccountingReport({}, { ...options, settings: {} })).toMatchObject({ netWorth: null, totalAssets: null, totalFunding: null, savingRate: null, debtRatio: null, autonomyMonths: null });
});

it('does not mistake missing transaction amounts for signed zero', () => {
  const report = buildAccountingReport({ transactions: [tx('missing', { amount: null }), tx('blank', { amount: '' }), tx('zero', { amount: 0 })] }, options);
  expect(report.entries.map(e => e.sourceId)).toEqual(['zero']);
  expect(report.excluded.map(e => e.reason)).toEqual(['Montant invalide', 'Montant invalide']);
});

it('attaches results to budget dates even when cash dates lie outside the selected period', () => {
  const report=buildAccountingReport({transactions:[tx('rent',{amount:310,cashDate:'2025-12-15',budget_date_start:'2026-01-01',budget_date_end:'2026-01-31'})]}, {...options,start:'2026-01-11',end:'2026-01-20'});
  expect(report.expenses).toBe(100);
  expect(report.entries[0]).toMatchObject({amount:100,sourceAmount:310,cashDate:'2025-12-15',budgetStart:'2026-01-01',budgetEnd:'2026-01-31'});
});
it('creates prepaid charges and accrued liabilities from budget recognition without counting them twice', () => {
  const data={transactions:[tx('prepaid',{amount:590,date_start:'2026-01-01',budget_date_start:'2026-01-01',budget_date_end:'2026-02-28'}),tx('unpaid',{amount:100,pay_now:false})],wallets:[{id:'w',currency:'EUR'}],walletBalances:[{wallet_id:'w',effective_balance:410}]};
  const settings={balances:{EUR:{debt:0,receivable:0,equity:590,evidence:'Situation vérifiée',asOf:options.today}}};
  const report=buildAccountingReport(data,{...options,settings});
  expect(report).toMatchObject({expenses:410,accrualAssets:280,accrualLiabilities:100,totalAssets:690,totalFunding:690,balanceGap:0,balanceStatus:'balanced'});
  expect(report.accrualRows.map(r=>r.account).sort()).toEqual(['401000','486000']);
  const wrong=buildAccountingReport(data,{...options,settings:{balances:{EUR:{...settings.balances.EUR,equity:500}}}});
  expect(wrong).toMatchObject({balanceGap:90,balanceStatus:'unbalanced'});
});
it('accrues unpaid income and defers prepaid income on budget dates', () => {
  const data={transactions:[tx('unpaidIncome',{type:'income',category:'Salaire',amount:200,pay_now:false}),tx('advance',{type:'income',category:'Salaire',amount:590,budget_date_start:'2026-01-01',budget_date_end:'2026-02-28'})]};
  const report=buildAccountingReport(data,options);
  expect(report).toMatchObject({income:510,accrualAssets:200,accrualLiabilities:280});
  expect(report.accrualRows.map(r=>r.account).sort()).toEqual(['411000','487000']);
});
it('records a categorized refund as negative expense and preserves cash direction', () => {
  const data={transactions:[tx('pharmacy',{amount:10,category:'Santé',subcategory:'Pharmacie'}),tx('refund',{type:'income',amount:10,category:'Remboursement',subcategory:'Pharmacie'})]};
  const report=buildAccountingReport(data,options);
  expect(report).toMatchObject({income:0,expenses:0,result:0});
  expect(report.entries.every(e=>e.account==='606330')).toBe(true);
});
it('uses budget start of an asset for its depreciation period', () => {
  const report=buildAccountingReport({...base(),assets:[{...asset,budget_start_date:'2026-02-01'}]},options);
  expect(report).toMatchObject({depreciation:0,netAssets:1200});
});
