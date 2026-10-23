import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`KPI requests stay isolated across accounts ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.route('**/*.supabase.co/**', route => route.abort());
    await page.goto('/?freeze=1');
    await page.waitForFunction(() => window.__tbBootReady && window.__TB_BOOT_COMPLETED__);
    await page.evaluate(() => {
      window.__scopeRequests = [];
      window.__scopeSnapshots = [];
      window.tbShouldUseOfflineMode = async () => false;
      window.tbEnsureCashflowCurve = async () => false;
      window.tbSaveOfflineSnapshot = reason => window.__scopeSnapshots.push({ reason, state: JSON.stringify(window.state) });
      window.sb = {
        from(table) {
          const user = window.sbUser.id;
          const query = {};
          for (const method of ['select', 'eq', 'gte', 'order', 'limit', 'in']) query[method] = () => query;
          query.then = (resolve, reject) => new Promise(done => window.__scopeRequests.push({ table, user, done })).then(resolve, reject);
          return query;
        },
      };
      window.sbUser = { id: 'account-a' };
      window.dispatchEvent(new CustomEvent('tb:auth_scope_changed'));
      window.renderKPI();
    });
    await expect.poll(() => page.evaluate(() => window.__scopeRequests.length)).toBe(4);
    await page.evaluate(() => {
      window.__oldKpiLoads = [window.__TB_KPI_ACTIVITY_LOADING__, window.__TB_KPI_NUTRITION_LOADING__];
      window.sbUser = { id: 'account-b' };
      window.dispatchEvent(new CustomEvent('tb:auth_scope_changed'));
      window.tbResetClientSessionState('test:account-switch');
      window.renderKPI();
      window.__newKpiLoads = [window.__TB_KPI_ACTIVITY_LOADING__, window.__TB_KPI_NUTRITION_LOADING__];
    });
    await expect.poll(() => page.evaluate(() => window.__scopeRequests.length)).toBe(8);
    const stale = await page.evaluate(async () => {
      window.__scopeRequests.filter(r => r.user === 'account-a').forEach(r => r.done({ data: [{ label: 'private-account-a' }], error: null }));
      const results = await Promise.all(window.__oldKpiLoads);
      await Promise.resolve();
      return { results, activityPending: window.__TB_KPI_ACTIVITY_LOADING__ === window.__newKpiLoads[0], nutritionPending: window.__TB_KPI_NUTRITION_LOADING__ === window.__newKpiLoads[1], snapshots: window.__scopeSnapshots };
    });
    expect(stale.results).toEqual([expect.objectContaining({ reason: 'stale-scope' }), expect.objectContaining({ reason: 'stale-scope' })]);
    expect(stale.activityPending).toBe(true);
    expect(stale.nutritionPending).toBe(true);
    expect(stale.snapshots).toEqual([]);
    await page.evaluate(async () => {
      window.__scopeRequests.filter(r => r.user === 'account-b').forEach(r => r.done({ data: [], error: null }));
      await Promise.all(window.__newKpiLoads);
    });
    await expect.poll(() => page.evaluate(() => Boolean(window.state.activityDataLoaded && window.state.nutritionKpiDataLoaded && !window.__TB_KPI_ACTIVITY_LOADING__ && !window.__TB_KPI_NUTRITION_LOADING__))).toBe(true);
    expect(await page.evaluate(() => JSON.stringify({ state: window.state, snapshots: window.__scopeSnapshots }))).not.toContain('private-account-a');
    expect(await page.evaluate(() => window.__scopeRequests.length)).toBe(8);
  });
}
