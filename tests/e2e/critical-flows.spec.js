import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
test.use({ serviceWorkers: 'block' });

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
  await page.route('**/vendor/supabase-*.js', supabaseStub);
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

for (const width of [1440, 390]) for (const dark of [false, true]) test(`transaction selection amounts and missing subcategory ${width} dark=${dark}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/?freeze=1');
  await expectBootShell(page);
  await page.evaluate(dark => {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-root').style.display = 'block';
    document.body.classList.toggle('theme-dark', dark);
    state.activeTravelId = 'selection-travel';
    state.travels = [{ id: 'selection-travel', name: 'Test' }];
    state.wallets = [{ id: 'selection-wallet', name: 'Banque test', currency: 'AUD', balance: 100 }];
    state.transactions = [
      { id: 's1', type: 'expense', amount: 10, currency: 'AUD', category: 'Transport', subcategory: '', label: 'Bateau', walletId: 'selection-wallet', travelId: 'selection-travel', dateStart: '2026-10-30', payNow: true, createdAt: 1 },
      { id: 's2', type: 'income', amount: 50, currency: 'AUD', category: 'Autre', subcategory: null, label: 'Remboursement', walletId: 'selection-wallet', travelId: 'selection-travel', dateStart: '2026-10-30', payNow: true, createdAt: 2 },
      { id: 's3', type: 'expense', amount: 100, currency: 'AUD', category: 'Transport', subcategory: 'Bus', label: 'Bus', walletId: 'selection-wallet', travelId: 'selection-travel', dateStart: '2026-10-30', payNow: true, createdAt: 3 },
    ];
    window.showView('transactions');
    _txSetFilters({});
    renderTransactions();
  }, dark);
  await expect(page.locator('#f-subcategory')).toBeEnabled();
  await page.locator('#f-subcategory').selectOption('__none__');
  await expect(page.locator('.tx-select')).toHaveCount(2);
  await page.locator('.tx-bulk-head input[type="checkbox"]').check();
  await expect(page.locator('#tx-bulk-count')).toHaveText('2');
  const stats = page.locator('#tx-selection-amounts');
  await expect(stats).toContainText('40');
  await expect(stats).toContainText('20');
  await page.screenshot({ path: `test-results/selection-${width}-${dark}.png` });
  await page.locator('.tx-bulk-head input[type="checkbox"]').uncheck();
  await expect(stats).toBeEmpty();
});

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

test('retries a partial legacy domain load without rerunning successful scripts', async ({ page }) => {
  let attempts = 0;
  let offline = true;
  await page.route('**/legacy/js/47_work_ui.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: 'window.__workExecutions = (window.__workExecutions || 0) + 1;\n' + await response.text() });
  });
  await page.route('**/legacy/js/50_work_career_ui.js', route => { attempts++; return offline ? route.abort() : route.continue(); });
  await page.goto('/?freeze=1');
  await expectBootShell(page);
  const failed = await page.evaluate(async () => {
    try { await window.tbLoadLegacyDomain('work'); } catch (error) { return error.message; }
  });
  expect(failed).toContain('50_work_career_ui.js');
  expect(await page.evaluate(() => window.tbIsLegacyDomainLoaded('work'))).toBe(false);
  offline = false;
  const recovered = await page.evaluate(async () => {
    const first = window.tbLoadLegacyDomain('work');
    const shared = first === window.tbLoadLegacyDomain('work');
    const pending = window.tbIsLegacyDomainLoaded('work');
    await first;
    return { shared, pending, loaded: window.tbIsLegacyDomainLoaded('work'), executions: window.__workExecutions };
  });
  expect(recovered).toEqual({ shared: true, pending: false, loaded: true, executions: 1 });
  expect(attempts).toBe(2);
  await expect(page.locator('script[src="/legacy/js/50_work_career_ui.js"]')).toHaveCount(1);
});

for (const [domain, entry] of [['analysis', 'analysisRuntime'], ['accounting', 'accountingController'], ['nutrition', 'nutritionView'], ['work', 'workView'], ['trip', 'tripRecapView']])
for (const built of [false, true]) test(`retries the ${domain} runtime import after a network failure (built=${built})`, async ({ page }) => {
  let attempts = 0;
  if (built) {
    await page.route('**/?freeze=1', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync('dist/index.html', 'utf8') }));
    await page.route('**/assets/*', route => {
      const name = path.basename(new URL(route.request().url()).pathname);
      return route.fulfill({ contentType: name.endsWith('.css') ? 'text/css' : 'application/javascript', body: fs.readFileSync(path.join('dist/assets', name)) });
    });
  }
  await page.route(`**/*${entry}*.js*`, route => ++attempts === 1 ? route.abort() : route.fallback());
  await page.goto('/?freeze=1');
  await expectBootShell(page);
  expect(await page.evaluate(async domain => {
    try { await (domain === 'accounting' ? window.tbOpenAccounting() : window.tbLoadLegacyDomain(domain)); return false; } catch { return true; }
  }, domain)).toBe(true);
  if (domain !== 'accounting') expect(await page.evaluate(domain => window.tbIsLegacyDomainLoaded(domain), domain)).toBe(false);
  await page.evaluate(domain => domain === 'accounting' ? window.tbOpenAccounting() : window.tbLoadLegacyDomain(domain), domain);
  if (domain !== 'accounting') expect(await page.evaluate(domain => window.tbIsLegacyDomainLoaded(domain), domain)).toBe(true);
  else expect(await page.evaluate(() => typeof window.renderAccounting)).toBe('function');
  expect(attempts).toBe(2);
});

for (const entry of ['assetBudgetData', 'assistantAiClient', 'sportProgressionRules'])
for (const built of [false, true]) test(`retries bridge ${entry} after a network failure (built=${built})`, async ({ page }) => {
  let attempts = 0;
  if (built) {
    await page.route('**/?freeze=1', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync('dist/index.html', 'utf8') }));
    await page.route('**/assets/*', route => {
      const name = path.basename(new URL(route.request().url()).pathname);
      return route.fulfill({ contentType: name.endsWith('.css') ? 'text/css' : 'application/javascript', body: fs.readFileSync(path.join('dist/assets', name)) });
    });
  }
  await page.route(`**/*${entry}*.js*`, route => ++attempts === 1 ? route.abort() : route.fallback());
  await page.goto('/?freeze=1');
  await expectBootShell(page);
  await page.evaluate(entry => {
    window.__bridgeTestCalls = 0;
    window.__callBridge = async () => {
      if (entry === 'assetBudgetData') {
        window.tbIsOfflineMode = () => true;
        return window.tbLoadAssetBudgetData();
      }
      if (entry === 'assistantAiClient') return window.tbRequestAssistantHelp({ question: 'Test synthétique', client: { functions: { invoke: async () => {
        window.__bridgeTestCalls++;
        return { data: { source: 'ai', answer: 'Réponse synthétique', view: null } };
      } } } });
      return window.Core.loadSportProgressionRules();
    };
  }, entry);
  expect(await page.evaluate(async () => { try { await window.__callBridge(); return false; } catch { return true; } })).toBe(true);
  expect(await page.evaluate(() => window.__bridgeTestCalls)).toBe(0);
  await page.evaluate(() => window.__callBridge());
  await page.evaluate(() => window.__callBridge());
  expect(attempts).toBe(2);
  expect(await page.evaluate(() => window.__bridgeTestCalls)).toBe(entry === 'assistantAiClient' ? 2 : 0);
});

test('opens validated modules to standard accounts while testers keep full campaign access', async ({ page }) => {
  await page.goto('/?freeze=1');
  await expectBootShell(page);

  await page.evaluate(() => {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-root').style.display = 'block';
    window.sbRole = 'user';
    window.syncTabsForRole();
    window.showView('dashboard');
  });
  await expect(page.locator('#view-dashboard')).not.toHaveClass(/hidden/);
  await expect(page.locator('#tab-dashboard')).toBeVisible();
  await expect(page.locator('#tab-transactions')).toBeVisible();
  await expect(page.locator('#tab-analysis')).toBeVisible();
  await expect(page.locator('#tab-sport')).toBeHidden();
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

test('keeps the public Project page premium and uncluttered at 1440px and 390px', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projet.html');

  await expect(page.locator('h1')).toContainText('Ton budget, tes documents et tes objectifs. Un seul cockpit.');
  await expect(page.locator('#admin-tests')).toHaveCount(0);
  await expect(page.locator('#checklist')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Pecloud', exact: true })).toHaveAttribute('href', 'https://pecloud.fr/');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tb-coral').trim())).toBe('#ff6b4a');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tb-canvas').trim())).toBe('#111e23');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: 'Ouvrir la demo' })).toBeVisible();
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
      campaign: { id: 'campaign', title: 'Stabilisation', description: 'Validation module par module', app_version: '10.5.318' },
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
