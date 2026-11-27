import { test, expect } from '@playwright/test';
import { fixtureTables, fixtureUser, installConnectedFixture } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block' });

test('pending Sport workout retries with its original trip, exercises and sets', async ({ page, baseURL }) => {
  const origin = fixtureTables.travels[0].id;
  const next = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const storage = 'travelbudget_sport_history_v1::user:' + fixtureUser;
  const localId = 'local-sport-audit-workout';
  const remoteId = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const work = {
    localId, travelId: origin, localOnly: true,
    startedAt: '2026-10-23T09:00:00Z', endedAt: '2026-10-23T09:02:00Z', durationSeconds: 120,
    plan: [{ activityKey: 'strength', exerciseName: 'Synthetic resistance exercise', mode: 'reps', sets: 2 }],
    doneSets: [
      { itemIndex: 0, setIndex: 1, reps: 8, weightKg: 20 },
      { itemIndex: 0, setIndex: 2, reps: 6, weightKg: 20 },
    ],
  };
  const tables = {
    ...structuredClone(fixtureTables),
    profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
    travels: [...fixtureTables.travels, { ...fixtureTables.travels[0], id: next, name: 'Next synthetic trip' }],
    sport_session_items: [], sport_sets: [], sport_sessions: [],
  };
  await installConnectedFixture(page, baseURL, { tables });
  await page.routeWebSocket(url => url.origin === new URL(baseURL).origin.replace(/^http/, 'ws'), ws => ws.connectToServer());
  await page.addInitScript(({ user, storage, work }) => {
    localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1');
    if (localStorage.getItem(storage) === null) localStorage.setItem(storage, JSON.stringify([work]));
  }, { user: fixtureUser, storage, work });

  const calls = [];
  const seen = new Map();
  await page.route('**/rest/v1/rpc/sport_save_workout_v1', async route => {
    const request = route.request().postDataJSON();
    calls.push(request);
    if (!seen.has(request.p_key)) seen.set(request.p_key, request.p_rows);
    if (calls.length === 1) return route.abort('connectionreset');
    return route.fulfill({ json: remoteId });
  });
  const invokeSync = () => page.evaluate(async () => {
    try { await window.tbSportSyncLocalWorkouts(); return 'ok'; }
    catch { return 'pending'; }
  });
  const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storage);
  async function openSport() {
    const menu = page.locator('#tb-mobile-nav-toggle');
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
    await page.locator('#tab-sport').click();
    await expect.poll(() => page.evaluate(() => typeof window.tbSportSyncLocalWorkouts)).toBe('function');
    await expect(page.locator('#sport-root')).toBeVisible();
  }
  await page.goto('/');
  await openSport();
  await expect.poll(() => page.evaluate(() => window.state?.activeTravelId)).toBeTruthy();
  await page.evaluate(id => { window.state.activeTravelId = id; }, origin);
  expect(await invokeSync()).toBe('pending');
  expect(calls).toHaveLength(1);
  expect(await stored()).toMatchObject([{ localId, travelId: origin, localOnly: true }]);
  expect((await stored())[0].remoteId).toBeFalsy();

  await page.reload();
  await openSport();
  await page.evaluate(id => { window.state.activeTravelId = id; }, next);
  expect(await invokeSync()).toBe('ok');
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
  expect(seen.size).toBe(1);
  expect(calls[1]).toMatchObject({
    p_key: localId,
    p_rows: { session: { travel_id: origin }, items: [{ exercise_name: work.plan[0].exerciseName }],
      sets: [{ set_index: 1, reps: 8 }, { set_index: 2, reps: 6 }] },
  });
  expect(await stored()).toMatchObject([{ localId, travelId: origin, localOnly: false, remoteId }]);
  expect(await invokeSync()).toBe('ok');
  expect(calls).toHaveLength(2);
});
