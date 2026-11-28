import { expect, test } from '@playwright/test';
import { installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

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

test('leaving the exercise opens the real Settings for the existing account', async ({ page, baseURL }) => {
  await installConnectedFixture(page, baseURL);
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
  await page.getByRole('link', { name: 'Ouvrir les vrais réglages' }).click();
  await expect(page.locator('#view-settings')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#tb-account-email')).toHaveValue('startup@example.invalid');
  await expect(page).not.toHaveURL(/premiers-pas=reglages/);
});
