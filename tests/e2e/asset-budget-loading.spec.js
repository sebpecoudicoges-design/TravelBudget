import { test, expect } from '@playwright/test';

test('analysis budget data works before visiting Assets, survives offline, clears on account change', async ({ page }) => {
  await page.route('**/asset-budget-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('/asset-budget-test');
  const result = await page.evaluate(async () => {
    await import('/src/app/bridge.js');
    window.state = { activeTravelId: 'trip-a' };
    const base = { purchase_value: 1200, residual_value: 0, depreciation_months: 12, purchase_date: '2026-01-01', currency: 'EUR' };
    window.sb = { from: table => ({ select: () => table === 'assets'
      ? { neq: async () => ({ data: [{ ...base, id: 'a', travel_id: 'trip-a' }, { ...base, id: 'b', travel_id: 'trip-b' }] }) }
      : { in: async () => ({ data: [{ asset_id: 'a', is_me: true, ownership_percent: 50 }] }) } }) };
    await window.tbLoadAssetBudgetData();
    const first = window.tbAssetBudgetTransactionsForRange('2026-09-01', '2026-09-30');
    const other = window.tbAssetBudgetTransactionsForRange('2026-09-01', '2026-09-30', 'trip-b');
    window.tbIsOfflineMode = () => true;
    window.sb.from = () => { throw new Error('Must stay offline'); };
    await window.tbLoadAssetBudgetData();
    const offline = window.tbAssetBudgetTransactionsForRange('2026-09-01', '2026-09-30');
    window.dispatchEvent(new Event('tb:auth_scope_changed'));
    const cleared = window.tbAssetBudgetTransactionsForRange('2026-09-01', '2026-09-30');
    return { first, other, offline, cleared, assetsUiLoaded: typeof window.renderAssets === 'function' };
  });
  expect(result.assetsUiLoaded).toBe(false);
  expect(result.first).toHaveLength(1);
  expect(result.first[0]).toMatchObject({ amount: 50, assetId: 'a', virtualBudgetOnly: true });
  expect(result.other).toHaveLength(1);
  expect(result.other[0]).toMatchObject({ amount: 100, assetId: 'b' });
  expect(result.offline).toEqual(result.first);
  expect(result.cleared).toEqual([]);
});
