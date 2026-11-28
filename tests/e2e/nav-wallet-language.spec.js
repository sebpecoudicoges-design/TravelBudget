import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

for (const width of [1440, 390]) {
  test(`English-first navigation and wallet dialogs switch to French at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const tables = structuredClone(fixtureTables);
    tables.profiles[0].role = 'test';
    await installConnectedFixture(page, baseURL, { tables });
    await page.routeWebSocket(url => url.origin === baseURL.replace('http', 'ws'), ws => ws.connectToServer());
    await page.addInitScript(user => {
      localStorage.setItem('tb_lang_v1', 'en');
      localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1');
    }, fixtureUser);
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => window.__TB_BOOT_COMPLETED__ === true)).toBe(true);
    await expect(page.locator('#tb-boot-overlay')).toHaveCount(0);
    const nav = page.locator('#tb-app-navigation');
    const menu = page.locator('#tb-mobile-nav-toggle');
    const checkNav = async (groups, recurring, inbox) => {
      if (width === 390) await menu.click();
      await expect(nav.locator('.tab-group-label')).toHaveText(groups);
      await expect(nav.locator('#tab-subscriptions .tab-label')).toHaveText(recurring);
      await expect(nav.locator('#tab-inbox .tab-label')).toHaveText(inbox);
      await expect(nav.locator('#tab-inbox use')).toHaveAttribute('href', '#tb-icon-inbox');
      if (width === 390) await page.keyboard.press('Escape');
    };
    await checkNav(['Overview', 'Finance', 'Daily life', 'Resources'], 'Subscriptions', 'Inbox');

    const create = page.locator('[data-dashboard-action="create-wallet"]');
    await create.click();
    let dialog = page.getByRole('dialog', { name: 'Create a wallet' });
    await expect(dialog.getByLabel('Name', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Currency')).toBeVisible();
    await expect(dialog.getByLabel('Opening balance')).toBeVisible();
    await expect(dialog.getByRole('option', { name: 'Cash', exact: true })).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog).toContainText('Name is required.');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    const edit = page.locator('[data-wallet-action="edit"]').first();
    await edit.click();
    dialog = page.getByRole('dialog', { name: 'Edit wallet' });
    await expect(dialog.getByLabel('Currency')).toBeDisabled();
    await expect(dialog.getByRole('option', { name: 'Bank', exact: true })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await page.locator('#tbLangFr').click();
    await checkNav(['Vue d’ensemble', 'Finances', 'Quotidien', 'Ressources'], 'Abonnements', 'À traiter');
    await create.click();
    dialog = page.getByRole('dialog', { name: 'Créer un wallet' });
    await expect(dialog.getByLabel('Solde initial')).toBeVisible();
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await edit.click();
    dialog = page.getByRole('dialog', { name: 'Modifier wallet' });
    await expect(dialog.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Annuler' }).click();
  });
}
