import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, projectOrigin, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

const wording = {
  fr: { quickIncome: '+ Entrée partagée', mine: '(moi)', split: 'Répartition', equal: 'À parts égales', no: 'Non', yes: 'Oui',
    start: 'Début du budget', end: 'Fin du budget', add: 'Ajouter la dépense', recap: 'Récap', received: 'Reçu par', addIncome: 'Ajouter l’entrée' },
  en: { quickIncome: '+ Shared income', mine: '(me)', split: 'Split', equal: 'Equal split', no: 'No', yes: 'Yes',
    start: 'Budget start', end: 'Budget end', add: 'Add expense', recap: 'Recap', received: 'Received by', addIncome: 'Add income' },
};

const scenarios = ['fr', 'en'].flatMap(lang => [false, true].map(native => ({ lang, native })));
scenarios.push({ lang: 'en', native: false, empty: true });
for (const { lang, native, empty } of scenarios) {
  test(`Trip labels follow ${lang} on ${native ? 'Android shell' : 'desktop'}${empty ? ' without a group' : ''}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width: native ? 390 : 1440, height: 920 });
    const tripId = '3e5aded3-109f-455d-af81-06a447915b2d';
    const memberId = '3e5aded3-109f-455d-af81-06a447915b2f';
    const tables = {
      ...structuredClone(fixtureTables),
      profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
      transactions: [],
      trip_groups: [{ id: tripId, name: 'Test trip', base_currency: 'EUR', user_id: fixtureUser }],
      trip_participants: [{ id: 'participant-me', trip_id: tripId, auth_user_id: fixtureUser, role: 'owner' }],
      trip_members: [{ id: memberId, trip_id: tripId, name: 'Camille', auth_user_id: fixtureUser, user_id: fixtureUser }],
      trip_expenses: [], trip_expense_shares: [], trip_expense_budget_links: [],
      trip_settlement_events: [], trip_expense_documents: [], trip_settlements: [], trip_payer_approvals: [],
      v_wallet_balances: [], budget_segment_budget_reference_override: [], v_country_budget_reference_latest: [],
      travel_budget_reference_profile: [], v_transaction_analytic_expenses: [], fx_rates: [],
    };
    if (empty) for (const name of ['trip_groups', 'trip_participants', 'trip_members']) tables[name] = [];
    await installConnectedFixture(page, baseURL, { tables });
    await page.routeWebSocket(u => u.origin === baseURL.replace('http', 'ws'), ws => ws.connectToServer());
    await page.addInitScript(({ user, lang, native }) => {
      if (native) window.Capacitor = {};
      localStorage.setItem('tb_lang_v1', lang);
      localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1');
    }, { user: fixtureUser, lang, native });
    await page.route(u => u.origin === projectOrigin, route => {
      if (route.request().method() !== 'POST') return route.fallback();
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/trip_pending_invites_for_current_user')) return route.fulfill({ json: [] });
      if (['bind_trip_member_to_auth', 'trip_bind_member_to_auth', 'app_error_logs'].some(name => path.endsWith('/' + name))) return route.fulfill({ status: 204 });
      return route.fallback();
    });
    await page.goto('/');
    await expect(page.locator('#tb-boot-overlay')).toHaveCount(0);
    await expect.poll(() => page.evaluate(code => !!window.TB_I18N?.[code], lang)).toBe(true);
    if (native) await page.locator('#tb-mobile-nav-toggle').click();
    await page.locator('#tab-trip').click();

    const t = wording[lang];
    await expect(page.locator('#trip-tab-recap')).toHaveText(t.recap);
    await expect(page.locator('[data-trip-open-add-income]:visible').first()).toHaveText(t.quickIncome);
    if (empty) {
      await expect(page.locator('#trip-create')).toBeEnabled();
      await expect(page.locator('[data-trip-open-add-income]:visible').first()).toBeDisabled();
      return;
    }
    if (native) await page.locator('[data-trip-open-add-exp]:visible').first().click();
    await expect(page.locator('#trip-exp-paidby option:checked')).toContainText(`Camille ${t.mine}`);
    await expect(page.locator('#trip-split-participants-box')).toContainText(`Camille ${t.mine}`);
    await expect(page.locator('label[for="trip-split-mode"]')).toHaveText(t.split);
    await expect(page.locator('#trip-split-mode option[value="equal"]')).toHaveText(t.equal);
    const details = page.locator('.trip-expense-advanced:visible');
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
    await expect(page.getByLabel(t.start, { exact: true })).toBeVisible();
    await expect(page.getByLabel(t.end, { exact: true })).toBeVisible();
    await expect(page.locator('#trip-exp-out option')).toHaveText([t.no, t.yes]);
    await expect(page.locator('#trip-add-exp')).toHaveText(t.add);
    await page.locator('#trip-exp-kind').selectOption('income');
    await expect(page.locator('#trip-exp-paidby-label')).toHaveText(t.received);
    await expect(page.locator('#trip-add-exp')).toHaveText(t.addIncome);

    if (lang === 'en') {
      await page.locator('#trip-split-mode').selectOption('percent');
      await expect(page.locator('#trip-split-box')).toContainText('Total: 100%');
      await expect(page.locator('#trip-split-box')).toContainText('Camille (me)');
      await page.locator('#trip-split-mode').selectOption('amount');
      await expect(page.locator('#trip-split-box th').last()).toHaveText('Amount');
      await expect(page.locator('#trip-exp-currency-help')).toContainText('The selected wallet determines the currency');
    }
  });
}
