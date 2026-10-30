import { expect, it, vi } from 'vitest';
import { journalRows, journalPages } from '../../src/features/dashboard/walletJournal.js';
import { selectionAmounts } from '../../src/features/transactions/transactionView.js';

it('keeps selection totals and averages separated by currency and flow', () => {
  expect(selectionAmounts([{ currency: 'AUD', type: 'expense', amount: 10 }, { currency: 'AUD', type: 'expense', amount: 30 },
    { currency: 'AUD', type: 'income', amount: 100 }, { currency: 'EUR', type: 'expense', amount: 5 }])).toEqual([
    { currency: 'AUD', count: 3, income: 100, expense: 40, total: 60, average: 20 },
    { currency: 'EUR', count: 1, income: 0, expense: 5, total: -5, average: -5 },
  ]);
  expect(selectionAmounts([])).toEqual([]);
});

it('excludes budget-only and unpaid rows and invalidates edited or moved reconciliations', () => {
  const rows = ['ok', 'edited', 'moved', 'new', 'unpaid', 'internal'].map(id => ({ id, wallet_id: 'w', updated_at: 'v2',
    pay_now: id !== 'unpaid', is_internal: id === 'internal' }));
  const marks = [{ transaction_id: 'ok', wallet_id: 'w', transaction_updated_at: 'v2' },
    { transaction_id: 'edited', wallet_id: 'w', transaction_updated_at: 'v1' },
    { transaction_id: 'moved', wallet_id: 'other', transaction_updated_at: 'v2' }];
  const result = journalRows(rows, marks);
  expect(result).toHaveLength(4);
  expect(result.filter(row => row.reconciled).map(row => row.id)).toEqual(['ok']);
  expect(result.filter(row => row.changed).map(row => row.id).sort()).toEqual(['edited', 'moved']);
});

it('loads more than an API page and refuses partial success after a page failure', async () => {
  const data = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const range = vi.fn(async (from, to) => ({ data: data.slice(from, to + 1), error: null }));
  expect(await journalPages(() => ({ range }))).toHaveLength(1201);
  expect(range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  range.mockReset().mockResolvedValueOnce({ data: data.slice(0, 500) }).mockResolvedValueOnce({ error: new Error('offline') });
  await expect(journalPages(() => ({ range }))).rejects.toThrow('offline');
});
