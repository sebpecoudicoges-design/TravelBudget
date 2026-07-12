import { expect, test } from '@playwright/test';

async function installThirdPartyStubs(page) {
  await page.route('**/npm/@supabase/supabase-js@2**', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      window.supabase = {
        createClient() {
          const empty = Promise.resolve({ data: null, error: null });
          const chain = new Proxy({}, { get: () => () => chain });
          chain.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve);
          return {
            auth: {
              onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
              getSession() { return Promise.resolve({ data: { session: null }, error: null }); },
              getUser() { return Promise.resolve({ data: { user: null }, error: null }); },
              signInWithPassword() { return empty; },
              signUp() { return empty; },
              signOut() { return empty; },
              resetPasswordForEmail() { return empty; },
            },
            from() { return chain; },
            rpc() { return Promise.resolve({ data: null, error: null }); },
            storage: { from() { return chain; } },
          };
        },
      };
    `,
  }));
  await page.route('**/npm/apexcharts**', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.ApexCharts = class { render(){ return Promise.resolve(); } updateOptions(){} destroy(){} };',
  }));
  await page.route('**/npm/echarts@5/**', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.echarts = { init(){ return { setOption(){}, resize(){}, dispose(){} }; } };',
  }));
}

test.beforeEach(async ({ page }) => {
  await installThirdPartyStubs(page);
  page.on('dialog', (dialog) => dialog.dismiss());
});

test('boots to auth without fatal errors and keeps core navigation usable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/?freeze=1');
  await expect(page.locator('#auth-overlay')).toBeVisible();
  await expect(page.locator('#auth-email')).toBeVisible();
  await expect(page.locator('#tab-dashboard')).toHaveClass(/active/);
  await expect(page.locator('#view-dashboard')).not.toHaveClass(/hidden/);

  await page.evaluate(() => window.showView('settings'));
  await expect(page.locator('#tab-settings')).toHaveClass(/active/);
  await expect(page.locator('#view-settings')).not.toHaveClass(/hidden/);

  expect(errors.filter((message) => !/Failed to load resource/i.test(message))).toEqual([]);
});

test('lazy-loads a domain tab and preserves mobile layout access', async ({ page }) => {
  await page.goto('/?freeze=1');
  await expect(page.locator('#auth-overlay')).toBeVisible();

  await page.evaluate(() => window.showView('nutrition'));
  await expect(page.locator('#tab-nutrition')).toHaveClass(/active/);
  await expect(page.locator('#view-nutrition')).not.toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => typeof window.renderNutrition)).toBe('function');
  await expect(page.locator('#nutrition-root')).toHaveCount(1);
  await expect.poll(() => page.locator('#nutrition-root').evaluate((node) => node.textContent.length)).toBeGreaterThan(20);
  await expect.poll(() => page.evaluate(() => window.activeView)).toBe('nutrition');
});
