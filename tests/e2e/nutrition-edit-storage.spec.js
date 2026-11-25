import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const source = fs.readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
const section = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
const functions = section('  function requireNutritionWrite(', '  function localNutritionRowKey(')
  + section('  async function flushPendingSleep(', '  function sleepForDay(')
  + section('  function bindSleepControls(', '  async function deleteNutritionItem(')
  + section('  async function deleteNutritionItem(', '  window.renderNutrition =')
  + section('  async function saveNutritionMeal(', '  function applyMealFavorite(');
const styles = [...fs.readFileSync('index.html', 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
for (const width of [1440, 390]) for (const dark of [false, true]) {
  test(`failed sleep/edit/delete preserves stored data and input ${width} dark=${dark}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/nutrition-edit-test', route => route.fulfill({ contentType: 'text/html', body: `<html lang="fr"><head><style>${styles}</style></head><body class="${dark ? 'theme-dark' : ''}"><main id="nutrition-root" class="card"><label>Sommeil<input id="nutrition-sleep-hours" value="8"></label><select id="nutrition-sleep-quality"><option>ok</option></select><input id="nutrition-grams" value="200"><button id="nutrition-save">Enregistrer</button></main></body></html>` }));
    await page.goto('/nutrition-edit-test');
    await page.addStyleTag({ url: '/src/ui/premium-theme.css' });
    await page.evaluate(async () => {
      const repo = await import('/src/data/nutritionRepository.js');
      window.repository = () => repo.createNutritionRepository(null);
      window.blocked = true; window.remoteCalls = 0; window.renders = [];
      window.CACHE = { items: [{ id: 'local_item_one' }], editingItemId: 'local_item_one' };
      localStorage.setItem('meals', JSON.stringify([{ syncId: 'stable', syncAttempts: 2, meal: { id: 'local_meal_one' }, item: { id: 'local_item_one', grams: 100 } }]));
      localStorage.setItem('sleep', JSON.stringify({ '2026-11-03': { hours: 7 } }));
      window.tbSafeLocalStorageSet = (key, raw) => { if (window.blocked) return { ok: false }; localStorage.setItem(key, raw); return { ok: true }; };
      window.localMealKey = () => 'meals'; window.sleepKey = () => 'sleep';
      window.loadLocalMeals = () => repo.loadLocalNutritionRows({ storage: localStorage, key: 'meals' });
      window.loadSleepRows = () => repo.loadSleepRows({ storage: localStorage, key: 'sleep' });
      window.txt = fr => fr; window.n = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
      window.offsetDateISO = () => '2026-11-03'; window.selectedDateISO = () => '2026-11-04';
      window.client = () => ({ from() { window.remoteCalls++; throw new Error('Unexpected remote write'); } });
      window.uid = () => 'user'; window.publishNutrition = () => {};
      window.renderNutrition = reason => { window.renders.push(reason); };
      window.selectedFood = () => ({ key: 'food', name: 'Aliment' });
      window.rememberFoodRecent = window.syncNutritionAmount = () => {};
      window.nutritionForGrams = () => ({ kcal: 200 }); window.selectedMealType = () => 'meal';
      window.makeLocalNutritionRow = () => ({}); window.isOfflineSkipError = () => false;
      window.scheduleNutritionRender = () => {}; window.loadNutrition = async () => {};
    });
    await page.addScriptTag({ content: functions });
    await page.evaluate(() => saveSleep(document.getElementById('nutrition-root')));
    await expect(page.getByRole('alert')).toContainText('Enregistrement impossible');
    await expect(page.locator('#nutrition-sleep-hours')).toHaveValue('8');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sleep'))['2026-11-03'].hours)).toBe(7);
    expect(await page.evaluate(() => window.remoteCalls)).toBe(0);
    await page.evaluate(() => saveNutritionMeal(document.getElementById('nutrition-root')));
    await expect(page.locator('#nutrition-grams')).toHaveValue('200');
    await expect(page.locator('#nutrition-save')).toBeEnabled();
    expect(await page.evaluate(() => window.CACHE.editingItemId)).toBe('local_item_one');
    expect(await page.evaluate(() => window.remoteCalls)).toBe(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meals'))[0].item.grams)).toBe(100);
    await page.evaluate(() => deleteNutritionItem('local_item_one'));
    expect(await page.evaluate(() => window.CACHE.items.map(item => item.id))).toEqual(['local_item_one']);
    expect(await page.evaluate(() => window.renders.includes('delete'))).toBe(false);
    await page.screenshot({ path: `test-results/nutrition-edit-${width}-${dark}.png` });
    await page.evaluate(() => { window.blocked = false; });
    await page.evaluate(() => saveNutritionMeal(document.getElementById('nutrition-root')));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meals'))[0])).toMatchObject({ syncId: 'stable', syncAttempts: 2, item: { grams: 200 } });
    await page.evaluate(() => { window.client = () => null; });
    await page.evaluate(() => saveSleep(document.getElementById('nutrition-root')));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sleep'))['2026-11-03'].hours)).toBe(8);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.evaluate(() => deleteNutritionItem('local_item_one'));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meals')))).toEqual([]);
  });
}

test('two browser tabs keep an offline night deletion and the other tab’s edit', async ({ page, context }) => {
  await context.route('**/nutrition-two-tab-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local sleep test</title>' }));
  const other = await context.newPage();
  await Promise.all([page.goto('/nutrition-two-tab-test'), other.goto('/nutrition-two-tab-test')]);
  const firstDay = '2026-11-23';
  const secondDay = '2026-11-24';
  await page.evaluate(({ firstDay, secondDay }) => {
    localStorage.setItem('sleep::test', JSON.stringify({
      [firstDay]: { hours: 7, quality: 'ok', updatedAt: '2026-11-23T08:00:00Z' },
      [secondDay]: { hours: 8, quality: 'good', updatedAt: '2026-11-24T08:00:00Z' },
    }));
  }, { firstDay, secondDay });
  const save = (tab, day, hours) => tab.evaluate(async ({ day, hours }) => {
    const { saveSleepDraft } = await import('/src/data/nutritionSleepRepository.js');
    await saveSleepDraft({ storage: localStorage, key: 'sleep::test', day, hours, quality: 'ok' });
  }, { day, hours });
  expect(await page.evaluate(() => typeof navigator.locks?.request)).toBe('function');
  await Promise.all([save(page, firstDay, 0), save(other, secondDay, 9)]);
  const remaining = await other.evaluate(async ({ firstDay, secondDay }) => {
    const { visibleSleepRows, loadSleepRows } = await import('/src/data/nutritionRepository.js');
    const { mergeSleepSnapshot } = await import('/src/data/nutritionSleepRepository.js');
    await mergeSleepSnapshot({ storage: localStorage, key: 'sleep::test', rows: {
      [firstDay]: { hours: 7, updatedAt: '2026-11-23T08:00:00Z' },
      [secondDay]: { hours: 8, updatedAt: '2026-11-24T08:00:00Z' },
    } });
    return visibleSleepRows(loadSleepRows({ storage: localStorage, key: 'sleep::test' }));
  }, { firstDay, secondDay });
  expect(remaining[firstDay]).toBeUndefined();
  expect(remaining[secondDay]).toMatchObject({ hours: 9, pending: true });
  await other.close();
});

for (const [width, choose] of [[390, 'local'], [1440, 'remote']]) {
  test(`sleep conflict shows both versions and applies the selected one at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/sleep-conflict-test', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><html lang="fr"><main id="nutrition-root"></main></html>',
    }));
    await page.goto('/sleep-conflict-test');
    await page.evaluate(async () => {
      const { createNutritionRepository } = await import('/src/data/nutritionRepository.js');
      const { renderSleepPanel } = await import('/src/features/nutrition/nutritionView.js');
      window.repository = () => createNutritionRepository(null);
      window.CACHE = {};
      window.key = 'sleep::fixture';
      window.day = '2026-11-24';
      window.remote = { hours: 9, quality: 'good', updated_at: '2026-11-25T08:00:00Z' };
      window.writes = [];
      localStorage.setItem(window.key, JSON.stringify({
        [window.day]: { hours: 7, quality: 'ok', updatedAt: '2026-11-24T08:00:00Z' },
      }));
      window.client = () => ({
        from() {
          let patch;
          let match;
          const builder = {
            select: () => builder,
            eq(field, value) { if (field === 'updated_at') match = value; return builder; },
            update(value) { patch = value; return builder; },
            async maybeSingle() {
              if (!patch) return { data: window.remote };
              if (match !== window.remote.updated_at) return { data: null };
              window.writes.push(patch);
              window.remote = patch;
              return { data: { updated_at: patch.updated_at } };
            },
          };
          return builder;
        },
      });
      window.uid = () => 'fixture';
      window.table = key => key;
      window.sleepKey = () => window.key;
      window.txt = fr => fr;
      window.publishNutrition = () => {};
      window.renderNutrition = () => {
        const root = document.querySelector('#nutrition-root');
        const sleep = JSON.parse(localStorage.getItem(window.key))[window.day];
        root.innerHTML = renderSleepPanel({
          sleep: { ...sleep, nightDay: window.day }, sleepLabel: `${sleep.hours}h`, day: '2026-11-25', t: window.txt,
        });
        window.bindSleepControls(root);
      };
      await (await window.repository().sleepWrites()).saveSleepDraft({
        storage: localStorage, key: window.key, day: window.day, hours: 8, quality: 'ok',
      });
    });
    await page.addScriptTag({ content: functions });
    await page.evaluate(async () => {
      try { await flushPendingSleep(client(), uid(), sleepKey()); }
      catch (error) { if (error.code !== 'NUTRITION_SLEEP_CONFLICT') throw error; }
      renderNutrition();
    });
    await expect(page.getByRole('status')).toContainText('Sur cet appareil : 8 h');
    await expect(page.getByRole('status')).toContainText('Synchronisée : 9 h');
    await expect(page.locator('#nutrition-sleep-hours')).toBeDisabled();
    await page.reload();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sleep::fixture'))['2026-11-24']);
    expect(saved).toMatchObject({ pending: true, hours: 8, conflict: { remote: { hours: 9 } } });
    // State survived a reload. Re-open the panel on that persisted state and apply the real handler.
    await page.addScriptTag({ content: functions });
    await page.evaluate(async () => {
      const { createNutritionRepository } = await import('/src/data/nutritionRepository.js');
      const { renderSleepPanel } = await import('/src/features/nutrition/nutritionView.js');
      window.repository = () => createNutritionRepository(null);
      window.CACHE = {};
      window.uid = () => 'fixture';
      window.sleepKey = () => 'sleep::fixture';
      window.txt = fr => fr;
      window.publishNutrition = () => {};
      window.client = () => null; // Choosing while offline must be durable, even with no network.
      window.renderNutrition = () => {
        const root = document.querySelector('#nutrition-root');
        const day = '2026-11-24';
        const sleep = JSON.parse(localStorage.getItem(window.sleepKey()))[day];
        root.innerHTML = renderSleepPanel({ sleep: { ...sleep, nightDay: day }, day: '2026-11-25', t: window.txt });
        window.bindSleepControls(root);
      };
      window.renderNutrition();
    });
    await page.getByRole('button', { name: choose === 'local' ? 'Garder ma saisie' : 'Garder la version synchronisée' }).click();
    await expect(page.locator('#nutrition-sleep-hours')).toHaveValue(choose === 'local' ? '8' : '9');
    await expect(page.getByRole('button', { name: 'Garder ma saisie' })).toHaveCount(0);
    if (choose === 'local') await expect(page.getByRole('status')).toContainText('En attente de synchronisation');
    else await expect(page.getByRole('status')).toHaveCount(0);
  });
}
