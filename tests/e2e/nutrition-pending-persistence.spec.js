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
