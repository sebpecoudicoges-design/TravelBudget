import { test, expect } from '@playwright/test';
import { installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });
for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`cashflow applies rapid filters and theme changes ${width} ${theme}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    const fixture = await installConnectedFixture(page, 'http://127.0.0.1:8000');
    // The dev server uses a local HMR socket; external sockets stay blocked.
    await page.routeWebSocket(url => url.hostname === '127.0.0.1' && url.port === '8000', ws => ws.connectToServer());
    await page.goto('/?freeze=1');
    await page.waitForFunction(() => window.__TB_BOOT_COMPLETED__ && window.state?.transactions?.length === 1200 && window.__cashflowChart);
    await page.evaluate(async (dark) => {
      document.body.classList.toggle('theme-dark', dark);
      await window.renderCashflowChart();
      // Keep actions inside the same wall-clock instant: a time guard must not drop them.
      const now = Date.now(); Date.now = () => now;
    }, theme === 'dark');
    const budgetSum = () => page.evaluate(() => window.__cashflowChart.w.config.series[3].data.reduce((sum, p) => sum + (p.y || 0), 0));
    expect(await budgetSum()).toBe(1200);
    await page.evaluate(async () => { document.getElementById('cashflowCatsNone').click(); await window.renderCashflowChart(); });
    expect(await budgetSum()).toBe(0);
    await page.evaluate(async () => { document.getElementById('cashflowCatsAll').click(); await window.renderCashflowChart(); });
    expect(await budgetSum()).toBe(1200);
    await page.evaluate(async () => {
      document.body.classList.toggle('theme-dark');
      await window.tbRequestCashflowCurveRender('test:theme');
    });
    expect(await page.evaluate(() => window.__cashflowChart.w.config.theme.mode)).toBe(theme === 'dark' ? 'light' : 'dark');
    await expect(page.locator('#cf-reset-zoom')).toBeVisible();
    await expect(page.locator('#cashflowCurve svg').first()).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('tb_cashflow_cache_v1')))).toEqual([]);
    expect(fixture.failures).toEqual([]);
  });
}
