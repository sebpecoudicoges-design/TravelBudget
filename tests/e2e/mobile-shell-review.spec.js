import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, projectOrigin, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

const cases = [
  { width: 1440, theme: 'light', native: false, initialTransactions: true },
  { width: 1440, theme: 'dark', native: false, initialTransactions: false },
  { width: 390, theme: 'light', native: false, initialTransactions: false },
  { width: 390, theme: 'dark', native: true, initialTransactions: true },
];

for (const { width, theme, native, initialTransactions } of cases) {
  test(`Dashboard and Transactions at ${width}px, ${theme}, native=${native}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const tables = structuredClone(fixtureTables);
    tables.profiles[0].role = 'test';
    tables.settings[0].theme = theme;
    tables.transactions = initialTransactions ? tables.transactions.slice(0, 1) : [];
    await installConnectedFixture(page, baseURL, { tables });
    await page.routeWebSocket(url => url.origin === baseURL.replace('http', 'ws'), ws => ws.connectToServer());
    await page.addInitScript(({ user, native }) => {
      localStorage.setItem('tb_lang_v1', 'fr');
      localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1');
      if (native) window.Capacitor = {};
    }, { user: fixtureUser, native });

    let finishLoad;
    const hold = new Promise(resolve => { finishLoad = resolve; });
    let loadStarted = false;
    await page.route(u => u.origin === projectOrigin && u.pathname === '/rest/v1/profiles', async route => {
      loadStarted = true;
      await hold;
      return route.fallback();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const menu = page.locator('#tb-mobile-nav-toggle');
    const nav = page.locator('#tb-app-navigation');
    try {
      await expect.poll(() => loadStarted).toBe(true);
      await expect(page.locator('#tb-boot-overlay')).toBeVisible();
      if (width === 390) {
        await expect(menu).toBeHidden();
        await expect(nav).toBeHidden();
        await menu.evaluate(el => el.click()); // Programmatic early click must not open anything either.
        await expect(menu).toHaveAttribute('aria-expanded', 'false');
      }
    } finally {
      finishLoad();
    }

    await expect(page.locator('#tb-boot-overlay')).toHaveCount(0);
    await expect(page.locator('#wallets-container [data-wallet-id]').first()).toBeVisible();
    await expect(page.locator('#daily-budget-container')).not.toBeEmpty();
    await expect(page.locator('#dashboard-hero-shell, .tb-overview-greeting')).toHaveCount(0);
    const health = page.locator('#kpi .kpi-health-card');
    await expect(health).toHaveCount(1);
    await expect(page.locator('body')).toHaveClass(new RegExp('theme-' + theme));
    if (native) await expect(page.locator('body')).toHaveClass(/tb-capacitor-app/);
    if (width === 390) {
      await expect(health).toBeHidden();
      await expect(menu).toBeVisible();
      await expect(nav).toBeHidden();
      const frames = await menu.evaluate(async el => {
        const n = document.getElementById('tb-app-navigation');
        el.click();
        const read = () => [getComputedStyle(n).display, getComputedStyle(n).position, getComputedStyle(n).gridTemplateColumns.split(' ').length];
        const states = [read()];
        for (let i = 0; i < 6; i++) {
          await new Promise(requestAnimationFrame);
          states.push(read());
        }
        return states;
      });
      expect(frames).toEqual(Array(7).fill(['grid', 'fixed', 2]));
      await expect(page.locator('#tab-dashboard')).toBeFocused();
      await expect(page.locator('#tab-members')).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await expect(nav).toBeHidden();
      await menu.click();
    } else {
      await expect(health).toBeVisible();
      await expect(menu).toBeHidden();
      await expect(nav).toBeVisible();
    }

    await page.locator('#tab-transactions').click();
    if (width === 390) {
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect(nav).toBeHidden();
    }
    const add = page.getByRole('button', { name: 'Ajouter une transaction', exact: true });
    await expect(add).toBeEnabled();
    await expect(page.locator('#tx-list [data-tx-id]')).toHaveCount(initialTransactions ? 1 : 0);
    if (initialTransactions) {
      await page.locator('#f-q').fill('résultat fictif absent');
      await expect(page.locator('#tx-list [data-tx-id]')).toHaveCount(0);
      await expect(add).toBeEnabled();
      await page.locator('#f-q').clear();
      await expect(page.locator('#tx-list [data-tx-id]')).toHaveCount(1);
    }
    await add.click();
    const dialog = page.locator('#tb-transaction-modal');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#m-type')).toHaveValue('expense');
    await dialog.locator('#m-type').selectOption('income');
    await expect(dialog.locator('#m-type')).toHaveValue('income');
    await dialog.locator('[data-tx-cancel]').click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
