import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const count of [201, 5000]) {
  test(`${count} pending nutrition meals survive a browser reload`, async ({ page }) => {
    await page.route('**/nutrition-persistence-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
    await page.goto('/nutrition-persistence-test');
    await page.evaluate(async count => {
      const repository = await import('/src/data/nutritionRepository.js');
      const rows = Array.from({ length: count }, (_, index) => ({ syncId: `meal-${index}`, meal: { label: `Meal ${index}` } }));
      repository.saveLocalNutritionRowsOnce({ storage: localStorage, key: 'pending-test', rows });
    }, count);
    await page.reload();
    const persisted = await page.evaluate(async () => {
      const repository = await import('/src/data/nutritionRepository.js');
      const rows = repository.loadLocalNutritionRows({ storage: localStorage, key: 'pending-test' });
      return rows.map(row => row.syncId);
    });
    expect(persisted).toEqual(Array.from({ length: count }, (_, index) => `meal-${index}`));
  });
}

test('replay reaches the 201st meal after a failed batch without losing the pending tail', async ({ page }) => {
  await page.route('**/nutrition-replay-boundary-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Nutrition replay boundary</title>' }));
  await page.goto('/nutrition-replay-boundary-test');
  const key = 'meals::synthetic';
  const rows = Array.from({ length: 201 }, (_, index) => ({
    syncId: `meal-${index}`,
    meal: { meal_date: '2026-11-24', label: `Meal ${index}` },
    syncAttempts: index >= 25 && index < 200 ? 2 : 0,
  }));
  await page.evaluate(({ key, rows }) => localStorage.setItem(key, JSON.stringify(rows)), { key, rows });
  await page.reload();

  const source = readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
  const section = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
  await page.addScriptTag({ content:
    section('  function loadLocalMeals(', '  function localNutritionRowKey(') +
    section('  async function syncLocalNutritionRows(', '  function loadFoodKeys(') +
    section('  window.tbNutritionSyncLocal =', '  window.tbNutritionRefreshAfterSync ='),
  });
  const result = await page.evaluate(async key => {
    const repo = await import('/src/data/nutritionRepository.js');
    const attempted = [];
    let discards = 0;
    Object.assign(window, {
      CACHE: {},
      client: () => ({}),
      repository: () => ({
        ...repo,
        syncLocalRow: async ({ row, isCurrent }) => {
          if (!isCurrent()) throw new Error('Replay did not read the persisted row');
          attempted.push(row.syncId);
          if (row.syncId !== 'meal-200') throw new Error('Synthetic transient failure');
          return {};
        },
      }),
      localMealKey: () => key,
      uid: () => 'synthetic',
      table: name => name,
      localDateISO: value => value,
      activeTravelId: () => null,
      publishNutrition: () => {},
      discardNutritionQueue: () => { discards++; },
      isOfflineSkipError: () => true,
      txt: (_, en) => en,
      n: value => Number(value) || 0,
    });
    const sync = async () => {
      try { await window.tbNutritionSyncLocal('offline-queue'); return null; }
      catch (error) { return error.message; }
    };
    const first = await sync();
    const afterFirst = loadLocalMeals(true);
    const second = await sync();
    return { attempted, first, second, afterFirst, afterSecond: loadLocalMeals(true), discards };
  }, key);

  expect(result.attempted.slice(0, 25)).toEqual(rows.slice(0, 25).map(row => row.syncId));
  expect(result.attempted).toHaveLength(50);
  expect(result.attempted[25]).toBe('meal-200');
  expect(result.afterFirst).toHaveLength(201);
  expect(result.afterFirst[200]).toEqual(rows[200]);
  expect(result.afterFirst[0]).toMatchObject({ syncAttempts: 1, syncError: 'Synthetic transient failure' });
  expect(result.afterSecond.map(row => row.syncId)).toEqual(rows.slice(0, 200).map(row => row.syncId));
  expect(result.afterSecond.slice(25)).toEqual(rows.slice(25, 200));
  expect(result.first).toBe('Nutrition sync incomplete: pending local rows remain');
  expect(result.second).toBe(result.first);
  expect(result.discards).toBe(0);
});

test('a real Chromium storage quota rejection preserves pending meals for an explicit retry', async ({ page }) => {
  await page.route('**/nutrition-quota-test', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Isolated Nutrition quota</title>'
  }));
  await page.goto('/nutrition-quota-test');

  const result = await page.evaluate(async () => {
    const { saveLocalNutritionRowOnce } = await import('/src/data/nutritionRepository.js');
    const storage = localStorage;
    const key = 'nutrition-quota-pending';
    const filler = 'nutrition-quota-filler';
    const rows = Array.from({ length: 201 }, (_, index) => ({
      syncId: `meal-${index}`, meal: { label: `Fictitious meal ${index}` }
    }));
    const row = { syncId: 'retry', meal: { label: 'Fictitious new meal', notes: 'x'.repeat(2048) } };
    const original = JSON.stringify(rows);
    storage.setItem(key, original);
    const fits = units => {
      try { storage.setItem(filler, 'x'.repeat(units * 1024)); return true; }
      catch (error) {
        if (error.name !== 'QuotaExceededError') throw error;
        return false;
      }
    };
    let low = 0, high = 16 * 1024;
    if (fits(high)) throw new Error('No quota boundary observed below the isolated test ceiling');
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (fits(mid)) low = mid;
      else high = mid;
    }
    if (!fits(low) || fits(high)) throw new Error('Storage quota changed during the test');

    let failure;
    try { saveLocalNutritionRowOnce({ storage, key, row }); }
    catch (error) {
      failure = { code: error.code, retained: JSON.stringify(error.pendingRows) === JSON.stringify([row, ...rows]) };
    }
    const originalPreserved = storage.getItem(key) === original;
    storage.removeItem(filler);
    saveLocalNutritionRowOnce({ storage, key, row });
    saveLocalNutritionRowOnce({ storage, key, row });
    return {
      failure, originalPreserved,
      afterRetry: JSON.stringify(JSON.parse(storage.getItem(key))) === JSON.stringify([row, ...rows])
    };
  });

  expect(result).toEqual({
    failure: { code: 'NUTRITION_STORAGE_FAILED', retained: true },
    originalPreserved: true, afterRetry: true
  });
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nutrition-quota-pending')).map(row => row.syncId)))
    .toEqual(['retry', ...Array.from({ length: 201 }, (_, index) => `meal-${index}`)]);
});

for (const interruptedReplay of [false, true]) {
  test(interruptedReplay ? 'Nutrition automatically reaches the tail, but waits after a lost response'
    : 'Nutrition drains 51 meals in bounded rounds without delaying another queued action', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-24T12:00:00.000Z'));
    await page.route('**/nutrition-multi-batch', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Isolated multi-batch replay</title>',
    }));
    const committed = new Set(), requests = [];
    const otherActionOrder = [];
    let loseResponse = interruptedReplay;
    await page.route('**/nutrition-test-ack/*', async route => {
      const key = new URL(route.request().url()).pathname.split('/').at(-1);
      requests.push(key);
      committed.add(key);
      if (key === 'synthetic-25' && loseResponse) {
        loseResponse = false;
        return route.abort('connectionreset');
      }
      return route.fulfill({ json: { key } });
    });
    await page.route('**/nutrition-other-action', route => {
      otherActionOrder.push(requests.length);
      return route.fulfill({ json: { ok: true } });
    });
    const source = readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
    const section = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
    const key = 'multi-batch-meals';
    const install = async () => {
      await page.evaluate(async key => {
        const Data = await import('/src/data/mutationQueueStore.js');
        const repo = await import('/src/data/nutritionRepository.js');
        Object.assign(window, {
          Data: { ...Data, supabaseRepository: { rpc: () => fetch('/nutrition-other-action', { method: 'POST' }) } }, CACHE: {}, sbUser: { id: 'synthetic-multi-batch' },
          client: () => ({}), localMealKey: () => key, uid: () => window.sbUser.id,
          table: name => name, localDateISO: value => value, activeTravelId: () => null,
          publishNutrition: () => {}, discardNutritionQueue: () => {},
          isOfflineSkipError: () => true, txt: (_, en) => en, n: value => Number(value) || 0,
          tbShouldUseOfflineMode: async () => false,
          repository: () => ({ ...repo, syncLocalRow: async ({ row, isCurrent }) => {
            if (!isCurrent()) throw new Error('Not the current draft');
            return fetch('/nutrition-test-ack/' + row.syncId, { method: 'POST' }).then(response => response.json());
          } }),
        });
      }, key);
      await page.addScriptTag({ content:
        section('  function loadLocalMeals(', '  function localNutritionRowKey(') +
        section('  async function syncLocalNutritionRows(', '  function loadFoodKeys(') +
        section('  window.tbNutritionSyncLocal =', '  window.tbNutritionRefreshAfterSync ='),
      });
      await page.addScriptTag({ url: '/legacy/js/00_offline_queue.js' });
    };
    await page.goto('/nutrition-multi-batch');
    await install();
    const rows = Array.from({ length: interruptedReplay ? 26 : 51 }, (_, index) => ({
      syncId: `synthetic-${index}`, meal: { meal_date: '2026-11-24', label: `Fixture ${index}` },
    }));
    const started = await page.evaluate(async ({ key, rows, interruptedReplay }) => {
      localStorage.setItem(key, JSON.stringify(rows));
      const queued = await window.tbOfflineQueueEnqueue('nutrition.sync_local', {});
      if (!interruptedReplay) await window.tbOfflineQueueEnqueue('transaction.delete', { txId: 'fictitious' });
      const result = await window.tbOfflineQueueSync('online');
      return { id: queued.id, result, pending: window.tbOfflineQueuePending(), drafts: loadLocalMeals(true) };
    }, { key, rows, interruptedReplay });
    expect(started.result).toEqual({ ok: true, synced: interruptedReplay ? 0 : 1, failed: 0 });
    expect(started.pending).toEqual([expect.objectContaining({
      id: started.id, status: 'pending', attempts: 0, error: null, nextAttemptAt: null,
    })]);
    expect(started.drafts).toEqual(rows.slice(25));

    const state = () => page.evaluate(() => ({ pending: window.tbOfflineQueuePending(), drafts: loadLocalMeals(true) }));
    if (!interruptedReplay) {
      await expect.poll(state).toEqual({ pending: [], drafts: [] });
      expect(otherActionOrder).toEqual([25]);
      expect(requests).toEqual(rows.map(row => row.syncId));
      expect(committed.size).toBe(51);
      return;
    }

    await expect.poll(state).toEqual({
      pending: [expect.objectContaining({
        id: started.id, attempts: 1, error: 'Nutrition sync incomplete: pending local rows remain',
        nextAttemptAt: '2026-11-24T12:00:05.000Z',
      })],
      drafts: [expect.objectContaining({ syncId: rows[25].syncId, syncAttempts: 1 })],
    });
    expect(await page.evaluate(() => window.tbOfflineQueueSync('online'))).toEqual({ ok: true, synced: 0 });
    expect(requests).toEqual(rows.map(row => row.syncId));
    expect(committed.size).toBe(26);

    await page.reload();
    await install();
    expect((await state()).pending).toEqual([expect.objectContaining({ id: started.id, attempts: 1 })]);
    const resumed = await page.evaluate(() => window.tbOfflineQueueSync('diagnostic'));
    expect(resumed).toEqual({ ok: true, synced: 1, failed: 0 });
    expect(await state()).toEqual({ pending: [], drafts: [] });
    expect(requests).toEqual([...rows.map(row => row.syncId), rows[25].syncId]);
    expect(committed.size).toBe(26);
  });
}
