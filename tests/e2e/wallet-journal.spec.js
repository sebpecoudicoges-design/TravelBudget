import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const styles = [...fs.readFileSync('index.html', 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');

for (const width of [1440, 390]) for (const dark of [false, true]) {
  test(`bank journal persists reconciliation ${width} dark=${dark}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/journal-test', route => route.fulfill({ contentType: 'text/html', body: `<html lang="fr"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body class="${dark ? 'theme-dark' : ''}"></body></html>` }));
    await page.goto('/journal-test');
    await page.addStyleTag({ url: '/src/ui/premium-theme.css' });
    await page.evaluate(async () => {
      const { openWalletJournal } = await import('/src/features/dashboard/walletJournal.js');
      const wallet = { id: 'w', user_id: 'u', name: 'Banque test', currency: 'AUD', balance: 100 };
      const tx = { id: 'expense', user_id: 'u', wallet_id: 'w', type: 'expense', amount: 20, currency: 'AUD', label: 'Bateau', date_start: '2026-10-30', updated_at: '2026-10-30T00:00:00Z', pay_now: true };
      const marks = [];
      window.failPointage = false;
      const client = {
        auth: { onAuthStateChange(cb) { window.changeJournalAccount = cb; return { data: { subscription: { unsubscribe() {} } } }; } },
        from(table) { return { select() { return this; }, eq() { return this; }, order() { return this; },
          async single() { return { data: wallet }; }, async range() { return { data: table === 'transactions' ? [tx] : marks }; } }; },
        async rpc(_name, args) {
          if (window.failPointage) return { error: new Error('Échec réseau simulé') };
          marks.splice(0);
          if (args.p_reconciled) marks.push({ transaction_id: tx.id, wallet_id: 'w', transaction_updated_at: tx.updated_at });
          return { data: marks[0] || null };
        },
      };
      window.reopenJournal = () => openWalletJournal('w', { client, userId: 'u' });
      await window.reopenJournal();
    });
    const mark = page.locator('[data-journal-mark]');
    await expect(mark).not.toBeChecked();
    await page.locator('[data-journal-statement]').fill('85');
    await expect(page.locator('[data-journal-difference]')).toContainText('5,00');
    await mark.check();
    await expect(mark).toBeChecked();
    await page.locator('[data-journal-close]').click();
    await page.evaluate(() => window.reopenJournal());
    await expect(mark).toBeChecked();
    await page.locator('[data-journal-filter="status"]').selectOption('unmarked');
    await expect(mark).toHaveCount(0);
    await page.locator('[data-journal-filter="status"]').selectOption('all');
    await page.evaluate(() => { window.failPointage = true; });
    await mark.click();
    await expect(mark).toBeChecked();
    await expect(page.locator('[data-journal-message]')).toContainText('Échec réseau');
    expect(await page.locator('#tb-wallet-journal').evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/journal-${width}-${dark}.png` });
    await page.evaluate(() => window.changeJournalAccount('SIGNED_OUT', null));
    await expect(page.locator('#tb-wallet-journal')).toHaveCount(0);
  });
}
