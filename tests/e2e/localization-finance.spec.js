import { expect, test } from '@playwright/test';
import { fixtureTables, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

for (const width of [1440, 390]) for (const language of ['fr', 'en']) {
  test(`transaction and account labels match ${language} at ${width}px`, async ({ page, baseURL }) => {
    const en = language === 'en';
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(lang => localStorage.setItem('tb_lang_v1', lang), language);
    const tables = { ...fixtureTables, profiles: [{ ...fixtureTables.profiles[0], role: 'test' }], transactions: fixtureTables.transactions.slice(0, 3) };
    await installConnectedFixture(page, baseURL, { tables });
    await page.goto('/?freeze=1');
    const navigate = async tab => {
      if (width === 390) {
        const menu = page.locator('#tb-mobile-nav-toggle');
        await expect(menu).toBeEnabled({ timeout: 20_000 });
        if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
      }
      await page.locator('#tab-' + tab).click();
      await expect(page.locator('#view-' + tab)).toBeVisible();
    };
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await navigate('transactions');
    await expect(page.locator('.tx-list-head').getByText(en ? 'Filtered transactions' : 'Transactions filtrées')).toBeVisible();
    await expect(page.locator('label[for="f-from"]')).toHaveText(en ? 'From' : 'Du');
    await expect(page.locator('#tx-list').getByRole('button', { name: en ? 'Edit' : 'Modifier', exact: true }).first()).toBeVisible();
    await page.locator('#tb-tx-add').click();
    const modal = page.locator('#tb-transaction-modal');
    await expect(modal.locator('label[for="m-amount"]')).toHaveText(en ? 'Amount' : 'Montant');
    await expect(modal.locator('label[for="m-cash-date"]')).toHaveText(en ? 'Cash date' : 'Date de trésorerie');
    await expect(modal.locator('#m-type option[value=expense]')).toHaveText(en ? 'Expense' : 'Dépense');
    await expect(modal.locator('#m-recurring-rule option').first()).toHaveText(en ? 'No subscription' : 'Aucun abonnement');
    await expect(modal.locator('[data-tx-save]')).toHaveText(en ? 'Save' : 'Sauvegarder');
    await expect(modal).not.toContainText(/(?:transactions\.form\.|>\s*\/)/);
    await modal.locator('[data-tx-cancel]').click();
    await navigate('settings');
    const account = page.locator('#tb-account-card');
    if (!await account.locator('#tb-user-export-all').isVisible()) await account.locator('.tb-settings-panel-head').click();
    await expect(account.locator('#tb-user-export-all')).toHaveText(en ? 'Export all my data' : 'Exporter toutes mes données');
    await expect(account.getByText(en ? 'Date of birth' : 'Date de naissance', { exact: true })).toBeVisible();
  });
}
