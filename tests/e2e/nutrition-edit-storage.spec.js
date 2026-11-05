import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const source = fs.readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
const section = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
const functions = section('  function requireNutritionWrite(', '  function localNutritionRowKey(')
  + section('  function saveSleepRows(', '  function mergeSleepRows(')
  + section('  async function saveSleep(', '  async function deleteNutritionItem(')
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
      window.repository = () => repo;
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
