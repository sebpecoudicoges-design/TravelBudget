import { expect, test } from '@playwright/test';

async function openReview(page, locale, width) {
  await page.setViewportSize({ width, height: 850 });
  await page.route('**/f4-audit-review', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/scripts/audit-nutrition/meal-conflict-review.css"><main data-meal-conflict-audit></main>',
  }));
  await page.goto('/f4-audit-review');
  await page.evaluate(async locale => {
    const ui = await import('/scripts/audit-nutrition/meal-conflict-review.mjs');
    const protocol = await import('/scripts/audit-nutrition/atomic-meal-conflict.mjs');
    const userId = '00000000-0000-4000-8000-000000000001';
    const mealId = '00000000-0000-4000-8000-000000000002';
    const syncId = 'meal-review-audit';
    const pending = { userId, syncId, revision: 'local-r1' };
    const replay = { mealId, status: 'conflict', disposition: 'pending' };
    const snapshot = (grams, label) => ({
      header: { label: 'Dinner', meal_date: '2026-11-27', consumed_time: '18:15', water_ml: 200 },
      items: [{ label, grams, kcal: 90 }],
    });
    let remote = { userId, mealId, syncId, revision: 'remote-r1', snapshot: snapshot(85, 'Rice') };
    window.auditReview = {
      buttons: [], removes: 0, fail: false,
      edit() { remote = { ...remote, revision: 'remote-r2', snapshot: snapshot(105, 'Rice') }; },
    };
    await ui.mountMealConflictReview(document.querySelector('main'), {
      locale,
      load: async () => ({ preview: protocol.prepareMealConflict({ pending, remote, replay }),
        local: snapshot(80, '<img alt="text fixture"> ' + 'Rice'.repeat(40)), remote: remote.snapshot }),
      resolve: (preview, choice) => {
        window.auditReview.buttons.push(choice);
        return protocol.resolveMealConflict({
          preview, choice, contextCurrent: () => true,
          readRemote: async () => {
            if (window.auditReview.fail) throw new Error('Synthetic read error');
            return remote;
          },
          removeLocalIfCurrent: async () => { window.auditReview.removes += 1; return true; },
        });
      },
    });
  }, locale);
}

test('French narrow layout and a keyboard confirmation keep the draft by default', async ({ page }) => {
  await openReview(page, 'fr', 320);
  await expect(page.getByRole('heading', { name: 'Comparer les versions du repas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Saisie sur cet appareil' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Version synchronisée' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Laisser ma saisie en attente' })).toBeChecked();
  await expect(page.getByRole('listitem').first()).toContainText('80 g');
  await expect(page.getByRole('listitem').last()).toContainText('85 g');
  await expect(page.locator('main img')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('button', { name: 'Confirmer le choix' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Ta saisie reste en attente.');
  await expect(page.getByRole('status')).toBeFocused();
  expect(await page.evaluate(() => auditReview.removes)).toBe(0);
});

test('changed remote asks to refresh and resets the selection instead of accepting automatically', async ({ page }) => {
  await openReview(page, 'en', 1280);
  await page.getByRole('radio', { name: 'Keep the synced version' }).check();
  await page.evaluate(() => auditReview.edit());
  await page.getByRole('button', { name: 'Confirm choice' }).click();
  await expect(page.getByRole('status')).toContainText('Refresh the comparison');
  await expect(page.getByRole('button', { name: 'Confirm choice' })).toBeHidden();
  await page.getByRole('button', { name: 'Refresh comparison' }).click();
  await expect(page.getByRole('heading', { name: 'Compare meal versions' })).toBeFocused();
  await expect(page.getByRole('listitem').last()).toContainText('105 g');
  await expect(page.getByRole('radio', { name: 'Leave my draft pending' })).toBeChecked();
  expect(await page.evaluate(() => auditReview.removes)).toBe(0);
  await page.getByRole('radio', { name: 'Keep the synced version' }).check();
  await page.getByRole('button', { name: 'Confirm choice' }).click();
  await expect(page.getByRole('status')).toHaveText('Synced version kept. Local draft removed.');
  expect(await page.evaluate(() => auditReview.removes)).toBe(1);
});

test('a failed re-read does not claim deletion', async ({ page }) => {
  await openReview(page, 'en', 390);
  await page.evaluate(() => { auditReview.fail = true; });
  await page.getByRole('radio', { name: 'Keep the synced version' }).check();
  await page.getByRole('button', { name: 'Confirm choice' }).click();
  await expect(page.getByRole('status')).toContainText('No removal was confirmed');
  await expect(page.getByRole('button', { name: 'Refresh comparison' })).toBeVisible();
  expect(await page.evaluate(() => auditReview.removes)).toBe(0);
});
