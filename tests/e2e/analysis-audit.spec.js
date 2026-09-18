import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// Render the real component and app styles without logging in or mutating live data.
for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`audit cards ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/audit-render', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
    await page.goto('/audit-render');
    await page.addStyleTag({ url: '/src/ui/premium-theme.css' });
    for (const match of fs.readFileSync('index.html', 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      await page.addStyleTag({ content: match[1] });
    }
    await page.addScriptTag({ url: '/legacy/js/33_analysis_filter_view.js' });
    await page.evaluate(async theme => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.themeResolved = theme;
      document.body.classList.toggle('theme-dark', theme === 'dark');
      const view = await import('/src/features/analysis/analysisView.js');
      const rules = await import('/src/features/analysis/analysisCashBreakdown.js');
      const planned = rules.splitPlannedDetails([{ tx: { type: 'expense', label: 'Mouvement interne — frais estimés', internal_transfer_id: 't', affects_budget: true, pay_now: false, currency: 'AUD', amount: 42.25 }, visibleAmount: 42.25, budgetStart: '2026-05-15' }, { tx: { label: 'Google One', currency: 'AUD', amount: 260.5 }, visibleAmount: 260.5, budgetStart: '2026-09-18' }]);
      const unpaidBlock = window.TBAnalysisView.renderAnalysisUnpaidBlock({ model: { ...planned, base: 'AUD' }, formatCurrency: n => `${n.toFixed(2)} AUD` });
      const net = 5305.56 + 26.10;
      const projection = rules.projectBudgetConsumption({ spent: net, spentToToday: net, targetToToday: 5492.4, totalBudget: 6097.86, start: '2026-05-15', end: '2026-10-02', today: '2026-09-18' });
      document.body.innerHTML = '<main id="view-analysis" style="padding:18px;max-width:100%"><section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">'
        + view.renderAnalysisProgressPanels({ progressCards: [{ label: 'Budget net vs projection', title: 'Net vs final', hint: 'Avoirs déduits : 79,05 EUR', value: `${net.toFixed(2)} EUR / ${projection.toFixed(2)} EUR`, footer: 'Rythme net extrapolé, dépenses connues incluses', pct: net / projection * 100, tint: 'blue', liquid: 'var(--tb-lagoon)', glow: 'transparent', shell: 'var(--tb-line)', haze: 'transparent' }], delta: { atDateAmount: net - 5492.4, deltaBudgetPct: (projection / 6097.86 - 1) * 100, deltaBudgetAmount: projection - 6097.86, deltaReferencePct: (projection / 8844.93 - 1) * 100, deltaReferenceAmount: projection - 8844.93 }, currency: 'EUR' }) + '</section></main>';
      document.querySelector('section').insertAdjacentHTML('beforeend', unpaidBlock);
    }, theme);
    await expect(page.locator('.analysis-stat--unpaid')).toContainText('260.50 AUD');
    await expect(page.locator('.analysis-stat--unpaid')).not.toContainText('Mouvement interne');
    await expect(page.locator('.analysis-stat--estimated')).toContainText('42.25 AUD');
    await expect(page.locator('.analysis-stat--estimated')).toContainText('pas une dette');
    if (theme === 'dark') expect(await page.locator('.analysis-stat--estimated').evaluate(el => getComputedStyle(el).color)).toBe('rgb(248, 250, 252)');
    await expect(page.locator('.analysis-stat--delta')).toContainText('Écart à date');
    await expect(page.locator('.analysis-stat--delta')).toContainText('Économie projetée');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const content of await page.locator('.analysis-stat-value, .analysis-stat-label, .analysis-stat-meta').all()) {
      expect(await content.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: `test-results/analysis-audit-${width}-${theme}.png`, fullPage: true });
  });
}
