import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { fixtureTables, fixtureUser, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

const vendor = JSON.parse(fs.readFileSync('config/vendor-libraries.json', 'utf8')).echarts.file;

test.use({ serviceWorkers: 'block' });

for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
  test(`category currency labels fit at ${width}px in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/analysis-label-fixture', (route) => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width"><main id="fixture"></main>',
    }));
    await page.goto('/analysis-label-fixture');
    await page.addScriptTag({ url: `/vendor/${vendor}` });
    const result = await page.evaluate(async ({ width, theme }) => {
      const { buildAnalysisCategoryBarsOption } = await import('/src/features/analysis/analysisChartOptions.js');
      const el = document.createElement('div');
      el.style.cssText = `width:${width === 390 ? 156 : 550}px;height:280px;background:${theme === 'dark' ? '#101827' : '#fff'}`;
      el.id = 'category-bars';
      document.getElementById('fixture').append(el);
      const chart = window.echarts.init(el, null, { renderer: 'svg' });
      const model = {
        base: 'NZD',
        categorySeries: [
          { name: 'Activités', actual: 179.95, color: '#766bd3' },
          { name: 'Repas', actual: 108.52, color: '#fa775f' },
          { name: 'Transport intercontinental', actual: 72.48, color: '#2c8296' },
        ],
      };
      chart.setOption({ ...buildAnalysisCategoryBarsOption({
        model, theme: { muted: theme === 'dark' ? '#b2bfd1' : '#4f5e74', text: theme === 'dark' ? '#fff' : '#111827' },
      }), animation: false });
      const measure = () => {
        const host = el.getBoundingClientRect();
        const boxes = [...el.querySelectorAll('svg text')]
          .filter((node) => node.textContent.endsWith(' NZD'))
          .map((node) => {
            const box = node.getBoundingClientRect();
            return { left: box.left - host.left, right: box.right - host.left };
          })
          .sort((a, b) => a.left - b.left);
        return { boxes, width: host.width };
      };
      const settled = async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return measure();
      };
      const initial = await settled();
      // The same chart instance switches back and forth across its container breakpoint.
      el.style.width = width === 390 ? '550px' : '156px';
      chart.resize();
      const resized = await settled();
      el.style.width = width === 390 ? '156px' : '550px';
      chart.resize();
      return { initial, resized, final: await settled() };
    }, { width, theme });
    await page.locator('#category-bars').screenshot({ path: `test-results/analysis-category-axis-${width}-${theme}.png` });
    for (const { boxes, width: cardWidth } of [result.initial, result.resized, result.final]) {
      expect(boxes.length, JSON.stringify({ cardWidth, boxes })).toBeGreaterThanOrEqual(cardWidth <= 300 ? 1 : 3);
      expect(boxes.every(({ left, right }) => left >= 0 && right <= cardWidth), JSON.stringify({ cardWidth, boxes })).toBe(true);
      expect(boxes.every(({ left }, i) => !i || left >= boxes[i - 1].right)).toBe(true);
    }
  });
}

for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
  test(`Analyse arranges the charts at ${width}px in ${theme} mode`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const transactions = [
      ['Activités', 179.95], ['Repas', 108.52], ['Transport intercontinental', 72.48],
    ].map(([category, amount], i) => ({ ...fixtureTables.transactions[i], category, amount }));
    await installConnectedFixture(page, baseURL, { tables: {
      ...fixtureTables,
      profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
      settings: fixtureTables.settings.map(setting => ({ ...setting, theme })),
      transactions,
    } });
    await page.routeWebSocket(url => url.origin === new URL(baseURL).origin.replace(/^http/, 'ws'), ws => ws.connectToServer());
    await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
    await page.goto('/?freeze=1');
    const menu = page.locator('#tb-mobile-nav-toggle');
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
    await page.locator('#tab-analysis').click();
    const layout = page.locator('#analysis-custom-layout');
    await expect(layout).toBeVisible();
    await expect(page.locator('#analysis-category-bars-chart canvas')).toBeVisible();
    const card = page.locator('.analysis-chart-card').filter({ has: page.locator('#analysis-category-bars-chart') });
    const columns = await layout.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width === 390 ? 1 : 2);
    if (width === 390) {
      expect((await card.boundingBox()).width).toBeGreaterThan(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await expect(page.locator('#analysis-category-drilldown option')).toHaveCount(4);
    await card.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await card.screenshot({ path: `test-results/analysis-category-card-${width}-${theme}.png` });
  });
}
