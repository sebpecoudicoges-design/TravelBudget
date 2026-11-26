import { describe, expect, it } from 'vitest';
import { readSettings, saveSettings } from '../../../src/features/accounting/accountingData.js';
import { buildAccountingReport } from '../../../src/features/accounting/accountingRules.js';

const makeMemoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, raw) => values.set(key, raw) };
};
const userId = 'synthetic-user', travelId = 'synthetic-travel', today = '2026-01-31';
const settings = {
  classificationVersion: 4,
  debts: [{
    id: 'loan', name: 'Dette fictive', currency: 'EUR', openingAmount: 400,
    openingDate: '2026-01-01', originTransactionId: 'funding',
    repayments: [{ transactionId: 'repayment', principal: 100 }],
    adjustments: [{ id: 'adj', amount: 10, date: '2026-01-10', reason: 'Correction fictive' }],
  }],
  archivedDebts: [{ id: 'archived', name: 'Archive fictive', repayments: [] }],
  positions: [{ id: 'deposit', name: 'Caution fictive', currency: 'EUR', account: '275000', transactionIds: ['deposit'] }],
};
const tx = (id, type, amount, date_start) => ({ id, type, amount, date_start, pay_now: true, currency: 'EUR', travel_id: travelId });
const transactions = [tx('funding', 'income', 400, '2026-01-01'), tx('repayment', 'expense', 110, '2026-01-15'), tx('deposit', 'expense', 150, '2026-01-20')];
const report = (settings, rows = transactions) => buildAccountingReport({ transactions: rows, tripBalances: [] }, {
  start: '2026-01-01', end: today, today, currency: 'EUR', travelId, settings,
});

function fixtureCopies() {
  const first = makeMemoryStorage(), second = makeMemoryStorage();
  saveSettings(first, userId, travelId, settings, null);
  const [original] = readSettings(first, userId, travelId);
  // Simulate moving trusted fictional settings only. This is not an import API.
  const copied = JSON.parse(JSON.stringify(original));
  saveSettings(second, userId, travelId, copied, null);
  return { original, second };
}

describe('F14 restoration invariants on fictional accounting data', () => {
  it('preserves archived settings and reconstructs the same report from the same sources', () => {
    const { original, second } = fixtureCopies();
    const [restored] = readSettings(second, userId, travelId);
    expect(restored).toEqual(original);
    expect(report(restored)).toEqual(report(original));
    expect(report(restored)).toMatchObject({ trackedDebt: 310, income: 0, expenses: 10, positionRows: [{ amount: 150 }] });
    expect(readSettings(second, 'other-user', travelId)).toEqual([{}, null]);
    expect(readSettings(second, userId, 'other-trip')).toEqual([{}, null]);
  });

  it('does not invent a zero when the backup references a missing repayment', () => {
    const { second } = fixtureCopies();
    const [restored] = readSettings(second, userId, travelId);
    const partial = report(restored, transactions.filter(t => t.id !== 'repayment'));
    expect(partial.trackedDebt).toBeNull();
    expect(partial.debtRows[0].remaining).toBeNull();
    expect(partial.warnings.length).toBeGreaterThan(0);
    expect(readSettings(second, userId, travelId)[0]).toEqual(restored);
  });
});
