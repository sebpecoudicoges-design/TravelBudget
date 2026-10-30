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

for (const width of [1440, 390]) for (const dark of [false, true]) {
  test(`bulk reconciliation respects filters and partial failures ${width} dark=${dark}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/journal-bulk-test', route => route.fulfill({ contentType: 'text/html', body: `<html lang="fr"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body class="${dark ? 'theme-dark' : ''}"></body></html>` }));
    await page.goto('/journal-bulk-test');
    await page.addStyleTag({ url: '/src/ui/premium-theme.css' });
    await page.evaluate(async () => {
      const { openWalletJournal } = await import('/src/features/dashboard/walletJournal.js');
      const wallet = { id: 'w', user_id: 'u', name: 'Banque test', currency: 'AUD', balance: 100 };
      const txs = [
        ['a', 'Bateau A', '2026-10-30'], ['b', 'Bateau B', '2026-10-31'],
        ['old', 'Bateau ancien', '2026-09-01'], ['other', 'Logement', '2026-10-30'],
        ['future', 'Bateau futur', '2026-12-01'], ['unpaid', 'Bateau à payer', '2026-10-30'],
      ].map(([id, label, date_start]) => ({ id, label, date_start, wallet_id: 'w', user_id: 'u', currency: 'AUD', amount: 10, type: 'expense', updated_at: '2026-10-31T00:00:00Z', pay_now: id !== 'unpaid' }));
      const marks = [];
      window.bulkCalls = [];
      window.bulkFailAt = 0;
      const client = {
        from(table) { return { select() { return this; }, eq() { return this; }, order() { return this; },
          async single() { return { data: wallet }; }, async range() { return { data: table === 'transactions' ? txs : marks }; } }; },
        async rpc(_name, args) {
          window.bulkCalls.push(args.p_transaction_id);
          if (window.pauseBulk) await new Promise(resolve => { window.resumeBulk = resolve; });
          await new Promise(resolve => setTimeout(resolve, 100));
          if (window.bulkFailAt === window.bulkCalls.length) return { error: new Error('Échec réseau simulé') };
          const index = marks.findIndex(mark => mark.transaction_id === args.p_transaction_id);
          if (index >= 0) marks.splice(index, 1);
          const data = args.p_reconciled ? { transaction_id: args.p_transaction_id, wallet_id: 'w', transaction_updated_at: args.p_expected_updated_at } : null;
          if (data) marks.push(data);
          return { data };
        },
      };
      window.bulkMarkedIds = () => marks.map(mark => mark.transaction_id).sort();
      window.reopenBulkJournal = () => openWalletJournal('w', { client, userId: 'u' });
      await window.reopenBulkJournal();
    });
    const filter = name => page.locator(`[data-journal-filter="${name}"]`);
    const commitFilter = async (name, value) => { await filter(name).fill(value); await filter(name).press('Tab'); };
    await commitFilter('from', '2026-10-01');
    await commitFilter('to', '2026-10-31');
    await commitFilter('q', 'Bateau');
    await filter('status').selectOption('unmarked');
    await expect(page.locator('[data-journal-mark]')).toHaveCount(2);
    await page.locator('[data-journal-bulk="mark"]').click();
    await expect(filter('status')).toBeDisabled();
    await expect(page.locator('[data-journal-message]')).toHaveText('2/2 opération(s) enregistrée(s)');
    expect(await page.evaluate(() => window.bulkMarkedIds())).toEqual(['a', 'b']);
    await expect(page.locator('[data-journal-mark]')).toHaveCount(0);
    await expect(page.locator('[data-journal-bulk="mark"]')).toBeDisabled();
    await filter('status').selectOption('marked');
    await page.locator('[data-journal-bulk="unmark"]').click();
    await expect(page.locator('[data-journal-message]')).toHaveText('2/2 opération(s) enregistrée(s)');
    expect(await page.evaluate(() => window.bulkMarkedIds())).toEqual([]);
    await filter('status').selectOption('unmarked');
    await page.evaluate(() => { window.bulkCalls = []; window.bulkFailAt = 2; });
    await page.locator('[data-journal-bulk="mark"]').click();
    await expect(page.locator('[data-journal-message]')).toContainText('1/2 opération(s) enregistrée(s). Traitement interrompu');
    expect(await page.evaluate(() => window.bulkMarkedIds())).toEqual(['b']);
    await expect(page.locator('[data-journal-mark]')).toHaveCount(1);
    await page.evaluate(() => { window.bulkFailAt = 0; });
    await page.locator('[data-journal-bulk="mark"]').click();
    await expect(page.locator('[data-journal-message]')).toHaveText('1/1 opération(s) enregistrée(s)');
    expect(await page.evaluate(() => window.bulkCalls)).toEqual(['b', 'a', 'a']);
    await page.locator('[data-journal-close]').click();
    await page.evaluate(() => window.reopenBulkJournal());
    await expect(page.locator('[data-journal-mark]:checked')).toHaveCount(2);
    expect(await page.locator('#tb-wallet-journal').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/journal-bulk-${width}-${dark}.png` });
    // Closing during a batch stops before the next request; the acknowledged row persists.
    await page.evaluate(() => { window.bulkCalls = []; window.pauseBulk = true; });
    await page.locator('[data-journal-bulk="unmark"]').click();
    await page.locator('[data-journal-close]').click();
    await page.evaluate(() => { window.pauseBulk = false; window.resumeBulk(); });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.bulkCalls)).toHaveLength(1);
  });
}
