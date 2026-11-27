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
    await demo.getByRole('button', { name: 'Modifier le montant' }).click();
    await expect(value('amount')).toBeFocused();
    await expect(value('amount')).toHaveValue('60');
    await demo.getByRole('button', { name: 'Vérifier les parts' }).click();
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
  await expect(rows.first().locator('.release-version')).toHaveText('27/11/2026');
  await expect(rows.first().locator('small')).toContainText('10.5.398');
  const dates = await rows.evaluateAll(els => els.map(el => el.dataset.releaseDate).filter(Boolean));
  expect(dates.length).toBeGreaterThan(10);
  expect(dates).toEqual([...dates].sort().reverse());
  await expect(page.locator('#releaseSpotlight strong').first()).toHaveText('27/11/2026');
  await expect(page.locator('.release-pulse-card').first()).toContainText('27/11/2026');
});

for (const width of [1440, 390]) {
  test(`project closed alpha requests an email before the restricted Play opt-in (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light', reducedMotion: 'reduce' });
    await page.goto('/projet.html');
    await page.locator('.hero').getByRole('link', { name: 'Test Alpha fermé' }).click();
    await expect(page).toHaveURL(/#alpha-fermee$/);
    const section = page.locator('#alpha-fermee');
    await expect(section.getByRole('heading', { name: 'Test Alpha fermé sur Google Play' })).toBeInViewport();
    await expect(section).toContainText('Le pays de ton compte Google Play doit être la France.');
    await expect(section).toContainText('Test Alpha actif');
    await expect(section).toContainText('Une fois ton compte Google autorisé');
    await expect(section).toContainText('Ce lien ne t’ajoute pas à la liste des testeurs.');
    const optIn = 'https://play.google.com/apps/testing/fr.pecloud.travelbudget';
    await expect(section.getByRole('link', { name: 'Déjà autorisé ? Rejoindre sur Google Play' })).toHaveAttribute('href', optIn);
    await expect(section.getByRole('link')).toHaveCount(2);
    const request = section.getByRole('link', { name: 'Envoyer mon adresse Google Play' });
    await expect(request).toHaveAttribute('href', /^mailto:seb\.pecoud\.icoges@gmail\.com\?subject=/);
    expect(decodeURIComponent(await request.getAttribute('href'))).toContain('My Google Play account email');
    await expect(section.locator('form, input, button')).toHaveCount(0);
    await page.locator('[data-lang="en"]:visible').click();
    await expect(section.getByRole('heading', { name: 'Google Play closed alpha test' })).toBeVisible();
    await expect(section).toContainText('Your Google Play account country must be set to France.');
    await expect(section).toContainText('Alpha test active');
    await expect(section).toContainText('Once your Google account has access');
    await expect(section.getByRole('link', { name: 'Send my Google Play email' })).toHaveAttribute('href', /^mailto:/);
    await expect(section.getByRole('link', { name: 'Already approved? Join on Google Play' })).toHaveAttribute('href', optIn);
    await expect(page.locator('#trust').getByRole('link', { name: 'Closed alpha test' })).toHaveAttribute('href', '#alpha-fermee');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const [width, colorScheme] of [[1440, 'dark'], [390, 'light']]) {
  test(`all project demos share the guided surface and keep the video together (${width}px, ${colorScheme})`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    const unsafe = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === baseURL && route.request().method() === 'GET') return route.continue();
      unsafe.push(route.request().method());
      return route.abort();
    });
    await page.goto('/projet.html#demo-fx');
    const hub = page.locator('#demo');
    await expect(page.locator('section#modules, a[href="#modules"]')).toHaveCount(0);
    await expect(hub.locator('#modules')).toHaveCount(1);
    const journeys = page.locator('#demo-journey');
    await expect(hub.locator('#video-demo video')).toHaveCount(1);
    await expect(hub.getByRole('navigation', { name: 'Démonstrations' }).getByRole('link')).toHaveCount(6);
    await expect(journeys.getByRole('heading', { name: 'Convertir sans toucher à la réserve' })).toBeVisible();
    await expect(hub.locator('#demo-trip')).toBeHidden();

    const review = () => journeys.getByRole('button', { name: 'Vérifier la saisie' }).click();
    const confirm = () => journeys.getByRole('button', { name: 'Valider la simulation' }).click();
    const open = name => hub.getByRole('link', { name, exact: true }).click();
    await review();
    await expect(journeys.getByRole('heading', { name: 'Vérifier les données' })).toBeFocused();
    await journeys.getByRole('button', { name: 'Modifier la saisie' }).click();
    await journeys.getByLabel('Solde source (EUR)').fill('400');
    await review();
    await confirm();
    await expect(journeys.locator('dd')).toHaveText(['0 EUR', '0 USD', '500 EUR']);
    await journeys.getByRole('button', { name: 'Recommencer' }).click();
    await expect(journeys.getByLabel('Solde source (EUR)')).toHaveValue('1200');
    await review();
    await confirm();
    await expect(journeys.locator('dd')).toHaveText(['700 EUR', '759,5 USD', '500 EUR']);

    await open('Transaction');
    await journeys.getByLabel('Transport (EUR)').fill('90');
    await review();
    await confirm();
    await expect(journeys.locator('dd')).toHaveText(['210 EUR', '90 EUR', '-10 EUR']);

    await open('Documents');
    await journeys.getByLabel('Justificatif').selectOption('1');
    await journeys.getByLabel('Élément associé').selectOption('1');
    await review();
    await confirm();
    await expect(journeys.locator('dd')).toHaveText(['Reçu de transport', 'Dépense Trip']);
    await page.locator('[data-lang="en"]:visible').click();
    await expect(journeys.locator('dd')).toHaveText(['Transport receipt', 'Trip expense']);
    await page.locator('[data-lang="fr"]:visible').click();

    await open('Sport');
    await review();
    await confirm();
    await expect(journeys.locator('dd')).toHaveText(['1', '8', '240 kg']);

    await open('Alimentation');
    await journeys.getByLabel('Portion (g)').fill('80');
    await review();
    await confirm();
    await expect(journeys.locator('dd')).toHaveText(['80 g', '304 kcal', '10,4 g']);
    await expect(journeys.getByRole('heading', { name: 'Voir le résultat' })).toBeFocused();
    await expect(page).toHaveURL(/#demo-nutrition$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goBack();
    await expect(journeys.locator('dd')).toHaveText(['1', '8', '240 kg']);
    await page.goto('/projet.html#lab');
    await expect(hub.locator('#demo-trip')).toBeVisible();
    await expect(hub.locator('#lab')).toHaveCount(1);
    await page.locator('.hero').getByRole('link', { name: 'Voir la vidéo' }).click();
    await expect(page).toHaveURL(/#video-demo$/);
    expect(errors).toEqual([]);
    expect(unsafe).toEqual([]);
  });
}

test('Android download and Play closed alpha are distinct in both languages', async ({ page }) => {
  await page.goto('/projet.html#app');
  await expect(page.locator('#app')).toContainText('Les deux installations sont distinctes.');
  await expect(page.locator('#trust')).toContainText('Alpha fermée active');
  await expect(page.locator('a[data-latest-apk]').first()).toHaveAttribute('href', /travelbudget-\d+\.\d+\.\d+-[^/]+debug\.apk$/);
  await page.locator('[data-lang="en"]:visible').click();
  await expect(page.locator('#app')).toContainText('They are separate installations.');
  await expect(page.locator('#trust')).toContainText('Closed alpha active');
  await expect(page.locator('main')).not.toContainText('BudgetPacker');
});
