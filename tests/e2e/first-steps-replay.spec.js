import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block', locale: 'fr-FR' });

for (const [width, theme] of [[1440, 'light'], [390, 'dark'], [320, 'light']]) {
  test(`first steps demo resumes without touching account data (${width}px ${theme})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const requests = [];
    page.on('request', request => requests.push([request.method(), new URL(request.url()).pathname]));
    await page.goto(`/premiers-pas/index.html?theme=${theme}`);
    const action = name => page.locator(`[data-action="${name}"]`);
    const submit = name => page.locator(`#${name} button[type=submit]`).click();
    await expect(page.getByText('Exercice · données fictives')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('tb-test-normal-app-sentinel', 'keep'));
    await action('start').click();
    await submit('journey');
    await expect(page.getByLabel('Devise du moyen de paiement')).toHaveJSProperty('tagName', 'SELECT');
    await submit('wallet');
    await submit('personal');
    await submit('group');
    const currency = page.getByLabel('Devise du wallet');
    await page.getByLabel('Wallet du paiement').selectOption('local');
    await expect(currency).toHaveAttribute('readonly', '');
    await expect(currency).toHaveValue('NZD');
    await action('pause').click();
    await page.reload();
    await action('start').click();
    await expect(currency).toHaveValue('NZD');
    await submit('share');
    await action('setup').click();
    await expect(page.getByLabel(/E-mail de connexion/)).toHaveValue('voyageur@example.test');
    await page.getByLabel(/WhatsApp/).fill('+00012345678');
    await submit('profile');
    await expect(page.getByRole('heading', { name: 'Prépare ton premier voyage' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(await page.evaluate(() => ({
      app: localStorage.getItem('tb-test-normal-app-sentinel'),
      stored: localStorage.getItem('travelbudget-first-steps-demo-v1')
    }))).toMatchObject({ app: 'keep', stored: expect.not.stringContaining('00012345678') });
    expect(requests.every(([method, path]) => method === 'GET' && (/^\/premiers-pas\//.test(path) || path === '/pwa-icon.svg'))).toBe(true);
  });
}

test('a connected French account can replay from Help without resetting the profile', async ({ page, baseURL }) => {
  await installConnectedFixture(page, baseURL);
  await page.goto('/?freeze=1');
  await expect(page.locator('#tab-help')).toBeVisible({ timeout: 20_000 });
  await page.locator('#tab-help').click();
  await page.getByRole('button', { name: 'Ouvrir le tutoriel Premiers pas' }).click();
  await expect(page).toHaveURL(/\/premiers-pas\/index\.html/);
  await expect(page.getByText('Exercice · données fictives')).toBeVisible();
});

test('leaving the exercise saves real Settings only after explicit confirmation', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  const settings = { ...fixtureTables.settings[0], birth_date: '1990-01-01' };
  const profile = { ...fixtureTables.profiles[0], role: 'test', whatsapp_phone_e164: null };
  const updates = [];
  let rejectNext = true;
  await installConnectedFixture(page, baseURL, { tables: { ...fixtureTables, settings: [settings], profiles: [profile] } });
  await page.route('**/rest/v1/{settings,profiles}?*', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').at(-1);
    const draft = route.request().postDataJSON();
    expect(url.searchParams.get(table === 'settings' ? 'user_id' : 'id')).toBe('eq.' + fixtureUser);
    if (rejectNext) {
      rejectNext = false;
      return route.fulfill({ status: 503, json: { message: 'Synthetic temporary failure' } });
    }
    updates.push([table, draft]);
    const target = table === 'settings' ? settings : profile;
    Object.assign(target, draft);
    return route.fulfill({ json: target });
  });
  await page.goto('/premiers-pas/index.html');
  await page.locator('[data-action="start"]').click();
  for (const id of ['journey', 'wallet', 'personal']) await page.locator(`#${id} button[type=submit]`).click();
  await page.locator('[data-action="finish"]').click();
  await page.locator('[data-action="setup"]').click();
  await page.locator('#profile button[type=submit]').click();
  const journey = page.locator('#journey');
  await journey.locator('[name="name"]').fill('Voyage fictif');
  await journey.locator('[name="country"]').selectOption('NZ');
  await journey.locator('[name="start"]').fill('2027-01-01');
  await journey.locator('[name="end"]').fill('2027-01-15');
  await journey.locator('[name="goal"]').fill('60');
  await journey.locator('button[type=submit]').click();
  await page.getByRole('link', { name: 'Démarrer le vrai paramétrage guidé' }).click();
  await expect(page.locator('#view-settings')).toBeVisible({ timeout: 20_000 });
  const dialog = page.getByRole('dialog', { name: '1 sur 2 · Ton compte' });
  await expect(dialog.getByLabel('E-mail de connexion')).toHaveValue('startup@example.invalid');
  await expect(dialog.getByLabel('Devise de base du compte')).toHaveValue('EUR');
  await expect(dialog.getByLabel('Date de naissance (facultatif)')).toHaveValue('1990-01-01');
  expect(updates).toEqual([]);
  await dialog.getByLabel('Devise de base du compte').selectOption('AUD');
  await dialog.getByRole('button', { name: 'Enregistrer sur mon compte' }).click();
  await expect(dialog.getByRole('status')).toContainText('n’ont pas pu être confirmées');
  expect(updates).toEqual([]);
  await dialog.getByRole('button', { name: 'Enregistrer sur mon compte' }).click();
  await expect(page.getByRole('dialog', { name: '2 sur 2 · Tes voyages' })).toBeVisible();
  expect(updates).toEqual([['settings', { base_currency: 'AUD' }]]);
  await page.getByRole('button', { name: 'Voir voyages et périodes' }).click();
  await expect(page.locator('#tb-travel-card')).toBeVisible();
  await expect(page).not.toHaveURL(/premiers-pas=configuration/);
  const replay = page.getByRole('button', { name: 'Relancer le paramétrage guidé' });
  if (!await replay.isVisible()) await page.locator('#tb-account-card .tb-settings-panel-head').click();
  await replay.click();
  await expect(page.getByRole('dialog').getByLabel('Devise de base du compte')).toHaveValue('AUD');
  expect(updates).toHaveLength(1);
});
