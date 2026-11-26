import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

for (const [width, colorScheme] of [[1440, 'light'], [390, 'dark']]) {
  test(`public demo: one expense, two shares, no network writes, reset (${width} px, ${colorScheme})`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    const unsafe = [];
    await page.route('**/*', route => {
      const req = route.request();
      if (new URL(req.url()).origin === baseURL && req.method() === 'GET') return route.continue();
      unsafe.push(req.method() + ' ' + req.url());
      return route.abort();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/projet.html');
    await expect(page.locator('#video-demo video')).toHaveAttribute('controls', '');
    await expect(page.locator('#video-demo')).toBeVisible();
    await page.getByRole('link', { name: 'Ouvrir la démo', exact: true }).click();
    const demo = page.locator('#demo');
    const value = name => demo.locator(`#demo-${name}`);
    await expect(value('amount')).toHaveValue('60');
    await expect(value('balance')).toHaveText('300 NZD');
    await demo.getByRole('button', { name: 'Vérifier les parts' }).click();
    await expect(value('share-title')).toBeFocused();
    await expect(value('balance')).toHaveText('300 NZD');
    await expect(value('paid')).toHaveText('—');
    await expect(value('preview-personal')).toHaveText('30 NZD');
    await expect(value('preview-alex')).toHaveText('30 NZD');
    await expect(value('owed')).toHaveText('—');
    await demo.getByRole('button', { name: 'Enregistrer la dépense' }).click();
    await expect(value('review-title')).toBeFocused();
    await expect(value('balance')).toHaveText('240 NZD');
    await expect(value('paid')).toHaveText('60 NZD');
    await expect(value('owed')).toHaveText('30 NZD');
    await expect(value('personal')).toHaveText('30 NZD');
    await expect(value('left')).toHaveText('120 NZD');

    await page.locator('[data-lang="en"]:visible').click();
    await expect(demo.getByRole('heading', { name: 'Dinner in Taupō, two budgets.' })).toBeVisible();
    await expect(value('left')).toHaveText('120 NZD');
    await demo.getByRole('button', { name: 'Start over' }).click();
    await expect(value('amount')).toBeFocused();
    await expect(value('balance')).toHaveText('300 NZD');
    await expect(value('left')).toHaveText('150 NZD');

    await value('amount').fill('301');
    await demo.getByRole('button', { name: 'Check shares' }).click();
    await expect(value('amount')).toBeVisible();
    await expect(value('balance')).toHaveText('300 NZD');

    await value('amount').fill('61');
    await demo.getByRole('button', { name: 'Check shares' }).click();
    await demo.getByRole('button', { name: 'Save expense' }).click();
    await expect(value('balance')).toHaveText('239 NZD');
    await expect(value('personal')).toHaveText('30.5 NZD');
    await expect(value('left')).toHaveText('119.5 NZD');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    expect(unsafe).toEqual([]);
  });
}

test('project timeline leads with verified dates and keeps version as secondary information', async ({ page }) => {
  await page.goto('/projet.html');
  const rows = page.locator('#releaseTimeline [data-release-entry]');
  await expect(rows.first().locator('.release-version')).toHaveText('26/11/2026');
  await expect(rows.first().locator('small')).toContainText('10.5.397');
  const dates = await rows.evaluateAll(els => els.map(el => el.dataset.releaseDate).filter(Boolean));
  expect(dates.length).toBeGreaterThan(10);
  expect(dates).toEqual([...dates].sort().reverse());
  await expect(page.locator('#releaseSpotlight strong').first()).toHaveText('26/11/2026');
  await expect(page.locator('.release-pulse-card').first()).toContainText('26/11/2026');
});

for (const width of [1440, 390]) {
  test(`project closed alpha points only to the official, restricted Play opt-in (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light', reducedMotion: 'reduce' });
    await page.goto('/projet.html');
    await page.locator('.hero').getByRole('link', { name: 'Test Alpha fermé' }).click();
    await expect(page).toHaveURL(/#alpha-fermee$/);
    const section = page.locator('#alpha-fermee');
    await expect(section.getByRole('heading', { name: 'Test Alpha fermé sur Google Play' })).toBeInViewport();
    await expect(section).toContainText('Le pays de ton compte Google Play doit être la France.');
    await expect(section).toContainText('Test Alpha actif');
    await expect(section).toContainText('un compte Google déjà autorisé');
    await expect(section).toContainText('Le lien n’ajoute pas ton compte à la liste des testeurs.');
    const optIn = 'https://play.google.com/apps/testing/fr.pecloud.travelbudget';
    await expect(section.getByRole('link', { name: 'Rejoindre le test sur Google Play' })).toHaveAttribute('href', optIn);
    await expect(section.getByRole('link')).toHaveCount(1);
    await expect(section.locator('form, input, button')).toHaveCount(0);
    await page.locator('[data-lang="en"]:visible').click();
    await expect(section.getByRole('heading', { name: 'Google Play closed alpha test' })).toBeVisible();
    await expect(section).toContainText('Your Google Play account country must be set to France.');
    await expect(section).toContainText('Alpha test active');
    await expect(section).toContainText('a Google account that already has access');
    await expect(section.getByRole('link', { name: 'Join the test on Google Play' })).toHaveAttribute('href', optIn);
    await expect(page.locator('#trust').getByRole('link', { name: 'Closed alpha test' })).toHaveAttribute('href', '#alpha-fermee');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
