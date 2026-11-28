import { expect, test } from '@playwright/test';
import { fixtureTables, fixtureUser, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

for (const { lang, width, title, settlement } of [
  {
    lang: 'fr', width: 1440, title: 'Bien utiliser Partage',
    settlement: 'Le règlement solde les comptes entre participants. Si tu choisis un wallet, il enregistre aussi un mouvement dans ce wallet.',
  },
  {
    lang: 'en', width: 390, title: 'Using Split well',
    settlement: 'A settlement clears what participants owe each other. If you select a wallet, it also records a movement in that wallet.',
  },
]) {
  test(`Trip explains settlements in ${lang} at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 940 });
    const tripId = 'synthetic-help-trip';
    await installConnectedFixture(page, baseURL, {
      tables: {
        ...structuredClone(fixtureTables),
        profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
        trip_groups: [{ id: tripId, name: 'Sample trip', base_currency: 'EUR', user_id: fixtureUser }],
        trip_participants: [{ id: 'sample-owner', trip_id: tripId, auth_user_id: fixtureUser, role: 'owner' }],
        trip_members: [{ id: 'sample-member', trip_id: tripId, name: 'Camille', auth_user_id: fixtureUser }],
        trip_expenses: [], trip_expense_shares: [], trip_expense_budget_links: [], trip_settlement_events: [],
      },
    });
    await page.routeWebSocket(url => url.origin === new URL(baseURL).origin.replace(/^http/, 'ws'), ws => ws.connectToServer());
    await page.addInitScript(({ lang, user }) => {
      localStorage.setItem('tb_lang_v1', lang);
      localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1');
    }, { lang, user: fixtureUser });
    await page.goto('/?freeze=1');
    const menu = page.locator('#tb-mobile-nav-toggle');
    if (width < 600) {
      await expect(menu).toBeVisible();
      if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
    }
    await page.locator('#tab-trip').click();
    const help = page.locator('#trip-root [data-tb-help="trip-overview"]');
    await expect(help.getByText(title, { exact: true })).toBeVisible();
    await expect(help.getByText("• " + settlement, { exact: true })).toBeVisible();
  });
}
