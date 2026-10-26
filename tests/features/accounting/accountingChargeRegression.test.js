import { it, expect } from 'vitest';
import { completeInitialMapping, mappingKey, resolveAccount } from '../../../src/features/accounting/accountingMapping.js';
import { buildAccountingReport } from '../../../src/features/accounting/accountingRules.js';

const ordinary = { id: 'ordinary', type: 'expense', category: 'Course', subcategory: 'Supermarché', amount: 100, currency: 'EUR', date_start: '2026-10-01', pay_now: true };
const share = { ...ordinary, id: 'share', amount: 40, is_internal: true, pay_now: false, affects_budget: true, out_of_budget: false, label: '[Trip] Courses' };
const options = { start: '2026-01-01', end: '2026-10-26', today: '2026-10-26', currency: 'EUR', travelId: 't' };
const report = (transactions, settings = {}, extra = {}) => buildAccountingReport({ transactions, ...extra }, { ...options, settings });

it('recognizes ordinary and Trip charges regardless of source order without duplicating Trip debt', () => {
  for (const transactions of [[share, ordinary], [ordinary, share]]) {
    const settings = completeInitialMapping(transactions);
    const r = report(transactions, settings, { tripBalances: [{ trip_id: 'trip', currency: 'EUR', net: -40 }] });
    expect(r.cashExpenses).toBe(140); expect(r.result).toBe(-140);
    expect(r.accrualRows).toEqual([]); expect(r.tripDebt).toBe(40);
    expect(resolveAccount(ordinary, settings).account).toBe('606310');
  }
});
it('never seeds shared category mappings from a genuine cash transfer', () => {
  const transfer = { ...ordinary, id: 'transfer', is_internal: true, internal_transfer_id: 'transfer-id' };
  for (const transactions of [[transfer, ordinary], [ordinary, transfer]]) {
    expect(report(transactions, completeInitialMapping(transactions)).cashExpenses).toBe(100);
  }
});
it('repairs only proven automatic bank mappings from version 3 and is idempotent', () => {
  const key = mappingKey(ordinary);
  const settings = { classificationVersion: 3, mapping: { [key]: '512100' }, inferredMapping: { [key]: '512100' }, balances: { EUR: { debt: 5 } } };
  const fixed = completeInitialMapping([share, ordinary], settings);
  expect(fixed.mapping[key]).toBe('606310'); expect(fixed.balances).toEqual(settings.balances);
  expect(settings.mapping[key]).toBe('512100');
  expect(completeInitialMapping([share, ordinary], fixed)).toBe(fixed);
  expect(report([share, ordinary], fixed).cashExpenses).toBe(140);
});
it('preserves manual bank choices, explicit auto and unrelated inferred accounts', () => {
  const key = mappingKey(ordinary);
  for (const [code, inferred] of [['512100', undefined], ['512100', '606310'], ['auto', undefined], ['613220', '613220']]) {
    const settings = { classificationVersion: 3, mapping: { [key]: code }, inferredMapping: inferred ? { [key]: inferred } : {} };
    expect(completeInitialMapping([ordinary, share], settings).mapping[key]).toBe(code);
  }
});
it('prorates Trip charges over budget dates and leaves future shares outside the result', () => {
  const tx = { ...share, budget_date_start: '2026-10-25', budget_date_end: '2026-10-28' };
  const r = report([tx, { ...share, id: 'future', budget_date_start: '2026-12-01', budget_date_end: '2026-12-01' }]);
  expect(r.cashExpenses).toBe(20); expect(r.accrualRows).toEqual([]);
});
it('includes Trip income shares once while ordinary unpaid charges retain their accrual', () => {
  const income = { ...share, type: 'income', category: 'Revenu', subcategory: 'Autre revenu', label: '[Trip] Part entrée - test', trip_share_link_id: 'link' };
  const r = report([income, { ...ordinary, pay_now: false }]);
  expect(r.income).toBe(40); expect(r.cashExpenses).toBe(100); expect(r.result).toBe(-60);
  expect(r.accrualRows).toHaveLength(1); expect(r.accrualRows[0].sourceId).toBe('ordinary');
});
