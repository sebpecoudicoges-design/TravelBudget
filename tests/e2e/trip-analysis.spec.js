import { test, expect } from '@playwright/test';
import fs from 'node:fs';

for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`participant balances after settlements ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/trip-analysis-render', route => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>',
    }));
    await page.goto('/trip-analysis-render');
    for (const match of fs.readFileSync('index.html', 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      await page.addStyleTag({ content: match[1] });
    }
    await page.addStyleTag({ url: '/src/ui/shared.css' });
    await page.addStyleTag({ url: '/src/ui/premium-theme.css' });
    await page.evaluate(async theme => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.themeResolved = theme;
      document.body.classList.toggle('theme-dark', theme === 'dark');
      const { computeTripAnalysis } = await import('/src/core/tripRules.js');
      const { renderTripAnalysisBars } = await import('/src/features/trip/tripView.js');
      const data = computeTripAnalysis({
        pivot: 'EUR',
        members: [{ id: 'seb', name: 'Seb', isMe: true }, { id: 'd', name: 'Dimitri' }],
        expenses: [
          { id: 'a', amount: 138.73, currency: 'AUD', paidByMemberId: 'seb', category: 'Courses' },
          { id: 'e', amount: 96.78, currency: 'EUR', paidByMemberId: 'seb', category: 'Transport' },
        ],
        shares: [{ expenseId: 'a', memberId: 'd', shareAmount: 138.73 }, { expenseId: 'e', memberId: 'd', shareAmount: 96.78 }],
        settlementEvents: [
          { amount: 100, currency: 'AUD', fromMemberId: 'd', toMemberId: 'seb' },
          { amount: 100, currency: 'AUD', fromMemberId: 'd', toMemberId: 'seb' },
          { amount: 8.99, currency: 'EUR', fromMemberId: 'd', toMemberId: 'seb', cancelledAt: '2026-08-15' },
        ],
        convertAmount: (amount, currency) => Number(amount) * (currency === 'AUD' ? 0.61625 : 1),
      });
      document.body.innerHTML = '<main id="view-trip" style="padding:16px">' + renderTripAnalysisBars({
        data, formatMoney: (amount, currency) => `${Number(amount).toFixed(2)} ${currency}`,
      }) + '</main>';
    }, theme);
    const participants = page.locator('.trip-analysis-card').filter({ hasText: 'Analyse participant' });
    await expect(participants).toContainText('Solde après règlements');
    await expect(participants.locator('.trip-analysis-row-values').first()).toContainText('59.02 EUR');
    await expect(participants.locator('.trip-analysis-row-values').last()).toContainText('-59.02 EUR');
    await expect(page.locator('.trip-analysis-summary')).toContainText('Dimitri doit 59.02 EUR');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/trip-analysis-${width}-${theme}.png`, fullPage: true });
  });
}
