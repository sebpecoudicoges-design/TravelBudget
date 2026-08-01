import { expect, test } from '@playwright/test';

async function installThirdPartyStubs(page) {
  const supabaseStub = (route) => route.fulfill({
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
  });
  await page.route('**/npm/@supabase/supabase-js@2**', supabaseStub);
  await page.route('**/@supabase/supabase-js@2**', supabaseStub);
  await page.route('**/supabase-js@2**', supabaseStub);
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
  await page.addInitScript(() => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
      keys
        .filter((key) => /supabase|travelbudget|tb_/i.test(String(key || '')))
        .forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();
    } catch (_) {}
  });
  page.on('dialog', (dialog) => dialog.dismiss());
});

async function expectBootShell(page) {
  await expect.poll(() => page.evaluate(() => typeof window.showView), { timeout: 20_000 }).toBe('function');
  await expect(page.locator('#tab-dashboard')).toHaveClass(/active/);
  await expect(page.locator('#view-dashboard')).not.toHaveClass(/hidden/);
  if (await page.locator('#auth-overlay').isVisible()) {
    await expect(page.locator('#auth-email')).toBeVisible();
  } else {
    await expect(page.locator('button', { hasText: /Logout|Deconnexion|Déconnexion/i })).toBeVisible();
  }
}

test('boots to auth without fatal errors and keeps core navigation usable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/?freeze=1');
  await expectBootShell(page);

  await page.evaluate(() => window.showView('settings'));
  await expect(page.locator('#tab-settings')).toHaveClass(/active/);
  await expect(page.locator('#view-settings')).not.toHaveClass(/hidden/);

  expect(errors.filter((message) => !/Failed to load resource/i.test(message))).toEqual([]);
});

test('lazy-loads a domain tab and preserves mobile layout access', async ({ page }) => {
  await page.goto('/?freeze=1');
  await expectBootShell(page);

  await page.evaluate(() => {
    window.sbRole = 'test';
    window.syncTabsForRole();
    window.showView('nutrition');
  });
  await expect(page.locator('#tab-nutrition')).toHaveClass(/active/);
  await expect(page.locator('#view-nutrition')).not.toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => typeof window.renderNutrition)).toBe('function');
  await expect(page.locator('#nutrition-root')).toHaveCount(1);
  await expect.poll(() => page.locator('#nutrition-root').evaluate((node) => node.textContent.length)).toBeGreaterThan(20);
  await expect.poll(() => page.evaluate(() => window.activeView)).toBe('nutrition');
});

test('locks standard accounts while testers keep module and campaign access', async ({ page }) => {
  await page.goto('/?freeze=1');
  await expectBootShell(page);

  await page.evaluate(() => {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-root').style.display = 'block';
    window.sbRole = 'user';
    window.syncTabsForRole();
    window.showView('dashboard');
  });
  await expect(page.locator('#view-validation')).not.toHaveClass(/hidden/);
  await expect(page.locator('#tab-dashboard')).toBeHidden();
  await expect(page.locator('#tab-settings')).toBeVisible();

  await page.evaluate(() => {
    window.sbRole = 'test';
    window.syncTabsForRole();
  });
  await expect(page.locator('#tab-dashboard')).toBeVisible();
  await expect(page.locator('#tab-testing')).toBeVisible();
  await expect(page.locator('#tab-members')).toBeHidden();
});

test('keeps the Dashboard hero premium in light and dark themes at 1440px and 390px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?freeze=1');
  await expectBootShell(page);
  await page.evaluate(() => {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-root').style.display = 'block';
    window.sbRole = 'test';
    window.syncTabsForRole();
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    window.renderWallets();
    window.showView('dashboard');
  });

  const hero = page.locator('#dashboard-hero-shell .tb-premium-overview');
  await expect(hero).toBeVisible();
  const light = await hero.evaluate((node) => {
    const style = getComputedStyle(node);
    return { background: style.backgroundImage, areas: style.gridTemplateAreas, color: style.color };
  });
  expect(light.areas).toContain('copy budget');

  await page.evaluate(() => window.applyTheme('dark'));
  await expect.poll(() => hero.evaluate((node) => getComputedStyle(node).backgroundImage)).not.toBe(light.background);
  const dark = await hero.evaluate((node) => {
    const style = getComputedStyle(node);
    const budget = getComputedStyle(node.querySelector('.tb-overview-budget'));
    return { areas: style.gridTemplateAreas, color: style.color, budgetBackground: budget.backgroundColor };
  });
  expect(dark.areas).toContain('copy budget');
  expect(dark.color).not.toBe(light.color);
  expect(dark.budgetBackground).not.toBe('rgba(0, 0, 0, 0)');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => hero.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(1);
});

test('keeps the tester checklist usable at 390px in light and dark themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?freeze=1');
  await expectBootShell(page);
  await page.evaluate(async () => {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-root').style.display = 'block';
    window.sbRole = 'test';
    window.syncTabsForRole();
    window.setActiveTab('testing');
    const { renderTestCampaign } = await import('/src/features/testing/testCampaignView.js');
    document.getElementById('testing-root').innerHTML = renderTestCampaign({
      campaign: { id: 'campaign', title: 'Stabilisation', description: 'Validation module par module', app_version: '10.5.316' },
      modules: [{
        id: 'dashboard', module_key: 'dashboard', title: 'Dashboard', description: 'Wallets et KPI', instructions: 'Tester le parcours complet.',
        scenarios: [{ id: 'scenario', title: 'Mobile', instructions: 'Ouvrir et controler.', expected_result: 'Aucun debordement.', required: true, result: { status: 'pending', notes: '' } }],
        review: { status: 'in_progress', notes: '' },
      }],
    });
  });
  await expect(page.locator('[data-test-result="ok"]')).toBeVisible();
  await expect(page.locator('[data-test-result="not_ok"]')).toBeVisible();
  await expect(page.locator('[data-test-notes]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.evaluate(() => document.body.classList.add('theme-dark'));
  await expect(page.locator('.tb-test-scenario')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
