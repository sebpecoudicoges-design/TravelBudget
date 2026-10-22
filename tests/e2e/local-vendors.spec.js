import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const vendors = JSON.parse(fs.readFileSync('config/vendor-libraries.json', 'utf8'));

test.use({ serviceWorkers: 'block' });

for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`local libraries boot and render real charts ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const scripts = [];
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
    await page.goto('/?freeze=1');
    await page.waitForFunction(() => window.__tbBootReady);
    expect(scripts.some(url => /apexcharts|echarts/.test(url))).toBe(false);
    expect(scripts.some(url => url.includes('cdn.jsdelivr.net'))).toBe(false);
    expect(await page.evaluate(() => typeof window.supabase.createClient)).toBe('function');
    await page.evaluate(async () => {
      await Promise.all([window.tbLoadLegacyDomain('analysis'), window.tbLoadLegacyDomain('assets')]);
      await window.tbLoadLegacyDomain('cashflow');
      // Exercise actual vendor renderers after the application's domain loader has installed them.
      const host = document.createElement('div'); host.id = 'vendor-test';
      host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:white;overflow:auto';
      document.body.append(host);
      for (const name of ['ec', 'apex']) { const el = document.createElement('div'); el.id = name; el.style.cssText = 'width:100%;height:220px'; host.append(el); }
      const chart = window.echarts.init(document.getElementById('ec'), 'v5', { renderer: 'svg' });
      chart.setOption({ ...window.TBAnalysisCharts.buildAnalysisTrajectoryOption({ model: { days: ['2026-10-01', '2026-10-02'], cumTarget: [15, 30], cumSpent: [10, 20], base: 'AUD' }, todayLabel: '10-02' }), animation: false });
      const apex = new window.ApexCharts(document.getElementById('apex'), { chart: { type: 'line', height: 220, animations: { enabled: false } }, series: [{ name: 'Balance', data: [10, 20] }], xaxis: { categories: ['A', 'B'] } });
      await apex.render();
    });
    await expect(page.locator('#ec svg')).toBeVisible();
    expect(await page.locator('#ec svg').evaluate(svg => [...svg.querySelectorAll('path')].some(path => { const box = path.getBBox(); return box.width > 0 && box.height > 0; }))).toBe(true);
    await expect(page.locator('#apex .apexcharts-line')).toBeVisible();
    expect(scripts.filter(url => url.endsWith(`/vendor/${vendors.echarts.file}`))).toHaveLength(1);
    expect(scripts.filter(url => /vendor\/apexcharts-/.test(url))).toHaveLength(1);
  });
}

test('retries a failed shared chart library without duplicating script nodes', async ({ page }) => {
  let attempts = 0;
  await page.route(`**/vendor/${vendors.echarts.file}`, route => ++attempts === 1 ? route.abort() : route.continue());
  await page.goto('/?freeze=1');
  await page.waitForFunction(() => window.__tbBootReady);
  expect(await page.evaluate(async () => { try { await window.tbLoadLegacyDomain('analysis'); return false; } catch { return true; } })).toBe(true);
  expect(await page.evaluate(() => window.tbIsLegacyDomainLoaded('analysis'))).toBe(false);
  await page.evaluate(() => Promise.all([window.tbLoadLegacyDomain('analysis'), window.tbLoadLegacyDomain('assets')]));
  expect(attempts).toBe(2);
  await expect(page.locator(`script[src="/vendor/${vendors.echarts.file}"]`)).toHaveCount(1);
});

test.describe('warmed PWA', () => {
  test.use({ serviceWorkers: 'allow' });
  test('reloads and reopens charts offline after a controlled online visit', async ({ page, context }) => {
    await page.goto('/?freeze=1');
    await page.waitForFunction(() => window.__tbBootReady);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.reload();
    await page.waitForFunction(() => window.__tbBootReady);
    await page.evaluate(() => Promise.all([window.tbLoadLegacyDomain('analysis'), window.tbLoadLegacyDomain('cashflow')]));
    await expect.poll(() => page.evaluate(async files => (await Promise.all(files.map(file => caches.match(`/vendor/${file}`)))).every(Boolean), Object.values(vendors).map(v => v.file))).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.__tbBootReady);
    await page.evaluate(() => Promise.all([window.tbLoadLegacyDomain('analysis'), window.tbLoadLegacyDomain('cashflow')]));
    expect(await page.evaluate(() => typeof window.echarts.init === 'function' && typeof window.ApexCharts === 'function')).toBe(true);
  });
});
