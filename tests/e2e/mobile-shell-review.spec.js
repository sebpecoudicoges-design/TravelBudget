import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, projectOrigin, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

const cases = [
  { width: 1440, theme: 'light', native: false, initialTransactions: true },
  { width: 1440, theme: 'dark', native: false, initialTransactions: false },
  { width: 390, theme: 'light', native: true, buildId: 'fr.pecloud.travelbudget', initialTransactions: false },
  { width: 390, theme: 'dark', native: true, buildId: 'com.travelbudget.app', initialTransactions: true },
];

for (const { width, theme, native, buildId, initialTransactions } of cases) {
  test(`Dashboard and Transactions at ${width}px, ${theme}, native=${native}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const tables = structuredClone(fixtureTables);
    tables.profiles[0].role = 'test';
    tables.settings[0].theme = theme;
    tables.transactions = initialTransactions ? tables.transactions.slice(0, 1) : [];
    await installConnectedFixture(page, baseURL, { tables });
    await page.routeWebSocket(url => url.origin === baseURL.replace('http', 'ws'), ws => ws.connectToServer());
    await page.addInitScript(({ user, native, buildId }) => {
      localStorage.setItem('tb_lang_v1', 'fr');
      localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1');
      if (native) window.Capacitor = { getPlatform: () => 'android', Plugins: { App: { getInfo: async () => ({ id: buildId, version: '10.5.399' }) } } };
    }, { user: fixtureUser, native, buildId });

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
      const bootLogo = page.locator('#tb-boot-overlay img.tb-boot-mark');
      await expect(bootLogo).toBeVisible();
      await expect.poll(() => bootLogo.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
      if (width === 390) {
        await expect(menu).toBeHidden();
        await expect(nav).toBeHidden();
        await menu.evaluate(el => el.click()); // Programmatic early click must not open anything either.
        await expect(menu).toHaveAttribute('aria-expanded', 'false');
      }
    } finally {
      finishLoad();
    }

    await expect.poll(() => page.evaluate(() => window.__TB_BOOT_COMPLETED__ === true && !window.__TB_AUTH_TRANSITION_ACTIVE__)).toBe(true);
    await expect(page.locator('#tb-boot-overlay')).toHaveCount(0);
    await expect(page.locator('#wallets-container [data-wallet-id]').first()).toBeVisible();
    await expect(page.locator('#daily-budget-container')).not.toBeEmpty();
    await expect(page.locator('#dashboard-hero-shell, .tb-overview-greeting')).toHaveCount(0);
    const channel = page.locator('#tb-direct-apk-channel');
    if (buildId === 'com.travelbudget.app') {
      await expect(channel).toBeVisible();
      await expect(channel).toHaveText('APK 10.5.399');
    } else await expect(channel).toBeHidden();
    const health = page.locator('#kpi .kpi-health-card');
    await expect(health).toHaveCount(1);
    await expect(page.locator('body')).toHaveClass(new RegExp('theme-' + theme));
    if (native) await expect(page.locator('body')).toHaveClass(/tb-capacitor-app/);
    const logo = page.locator('header img.tb-app-brand-icon');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', '/pwa-icon.svg');
    await expect.poll(() => logo.evaluate(el => el.complete && el.naturalWidth > 0 && el.getBoundingClientRect().width >= 32)).toBe(true);
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
      const colors = [];
      for (const name of ['dashboard', 'transactions', 'subscriptions', 'analysis', 'assets', 'accounting', 'sport', 'nutrition', 'work', 'documents', 'inbox', 'notifications', 'help', 'trip', 'settings', 'testing']) {
        const icon = nav.locator('#tab-' + name + ' .tab-icon');
        await expect(icon).toBeVisible();
        await expect(icon.locator('use')).toHaveAttribute('href', '#tb-icon-' + name);
        const computed = await icon.evaluate(el => {
          const style = getComputedStyle(el);
          return { background: style.backgroundColor, foreground: style.color, width: el.getBBox().width };
        });
        expect(computed.width, name).toBeGreaterThan(0);
        expect(computed.foreground, name).toBe('rgb(255, 255, 255)');
        const rgb = computed.background.match(/\d+/g).slice(0, 3).map(Number);
        const luminance = rgb.map(channel => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        expect(1.05 / (luminance + 0.05), name).toBeGreaterThanOrEqual(4.5);
        colors.push(computed.background);
      }
      expect(new Set(colors).size).toBe(colors.length);
      await expect(page.locator('#tab-members')).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await expect(nav).toBeHidden();
      await menu.click();
      await page.evaluate(() => {
        document.getElementById('view-dashboard').style.minHeight = '2400px';
        document.getElementById('view-transactions').style.minHeight = '2400px';
        window.scrollTo({top: 900, behavior: 'instant'});
      });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    } else {
      await expect(health).toBeVisible();
      await expect(menu).toBeHidden();
      await expect(nav).toBeVisible();
    }

    await page.locator('#tab-transactions').click();
    if (width === 390) {
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect(nav).toBeHidden();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
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
