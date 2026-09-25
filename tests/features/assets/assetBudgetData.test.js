import { it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { loadAssetBudgetData } from '../../../src/features/assets/assetBudgetData.js';
import { buildAssetBudgetTransactions } from '../../../src/core/assetRules.js';
import { filterCashTransactions } from '../../../src/features/analysis/analysisCashBreakdown.js';

const asset = { id: 'van', purchase_value: 1200, residual_value: 0, depreciation_months: 12, purchase_date: '2026-01-01', currency: 'EUR' };
function client(ownersError = null) {
  return { from: vi.fn(table => ({ select: () => table === 'assets'
    ? { neq: async () => ({ data: [asset] }) }
    : { in: async () => ({ data: [{ asset_id: 'van', is_me: true, ownership_percent: 50 }], error: ownersError }) } })) };
}
it('loads depreciation before the Patrimoine UI has ever been opened', async () => {
  const state = {};
  await loadAssetBudgetData({ client: client(), state });
  const rows = buildAssetBudgetTransactions({ assets: state.assets, owners: state.assetOwners, rangeStart: '2026-09-01', rangeEnd: '2026-09-30' });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ amount: 50, virtualBudgetOnly: true, assetBudget: true });
  expect(filterCashTransactions({ rows, paid: row => row.payNow, internal: () => false,
    out: () => false, category: row => row.category, subcategory: row => row.subcategory, tripCash: () => false })).toEqual([]);
  const analysis = fs.readFileSync('public/legacy/js/33_budget_analysis.js', 'utf8');
  expect(analysis).toContain('await window.tbLoadAssetBudgetData()');
  expect(analysis).not.toContain('await window.tbLoadAssets()');
  expect(fs.readFileSync('public/legacy/js/42_assets_ui.js', 'utf8')).not.toContain('function assetBudgetRows(');
});
it('retains real offline rows and never substitutes demo data', async () => {
  const state = { assets: [asset] }, db = client();
  await loadAssetBudgetData({ client: db, state, offline: true });
  expect(db.from).not.toHaveBeenCalled();
  expect(state.assets).toEqual([asset]);
});
it('does not overwrite another auth scope with an obsolete request', async () => {
  const state = { assets: [] };
  expect(await loadAssetBudgetData({ client: client(), state, isCurrent: () => false })).toBe(false);
  expect(state.assets).toEqual([]);
});
it('does not silently calculate full ownership when owner loading fails', async () => {
  const state = { assets: [] };
  await expect(loadAssetBudgetData({ client: client(new Error('network')), state })).rejects.toThrow();
  expect(state.assets).toEqual([]);
});
it('stops at the last day of a short final month, without an extra instalment', () => {
  const rows = buildAssetBudgetTransactions({ assets: [{ ...asset, depreciation_months: 2 }], rangeStart: '2026-01-01', rangeEnd: '2026-03-31' });
  expect(rows.map(row => row.dateStart)).toEqual(['2026-01-01', '2026-02-01']);
  expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(1200);
});
