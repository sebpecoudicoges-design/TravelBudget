import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const legacy = fs.readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
const styles = [...fs.readFileSync('index.html', 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const recovery = legacy.slice(legacy.indexOf('  const failedNutritionWrites = new Map();'), legacy.indexOf('  async function syncLocalNutritionRows'));
for (const width of [1440, 390]) for (const dark of [false, true]) {
  test(`failed nutrition save can be exported and retried ${width} dark=${dark}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/nutrition-recovery-test', route => route.fulfill({ contentType: 'text/html', body: `<html lang="fr"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body class="${dark ? 'theme-dark' : ''}"><div id="nutrition-root"></div></body></html>` }));
    await page.goto('/nutrition-recovery-test');
    await page.addStyleTag({ url: '/src/ui/premium-theme.css' });
    await page.evaluate(async () => {
      window.repo = await import('/src/data/nutritionRepository.js');
      window.repository = () => window.repo;
      window.CACHE = {};
      window.scope = 'a'; window.blocked = true; window.synced = 0;
      window.localMealKey = () => window.scope;
      window.txt = fr => fr;
      window.mergePendingNutritionRowsIntoCache = () => {};
      window.requestNutritionSync = () => { window.synced++; };
      window.renderNutrition = () => {};
      window.tbSafeLocalStorageSet = (key, raw) => {
        if (window.blocked) return { ok: false };
        localStorage.setItem(key, raw); return { ok: true };
      };
    });
    await page.addScriptTag({ content: recovery });
    await page.evaluate(() => {
      try { saveLocalNutritionRowsOnce([{ syncId: 'new', meal: { label: 'Déjeuner', grams: 200 } }]); } catch (_) {}
    });
    await expect(page.getByRole('alert')).toContainText('Repas non sauvegardés');
    expect(await page.evaluate(() => localStorage.getItem('a'))).toBeNull();
    expect(await page.evaluate(() => window.synced)).toBe(0);
    await page.evaluate(() => { try { saveLocalNutritionRowsOnce([{ syncId: 'replacement' }]); } catch (_) {} });
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter la saisie' }).click();
    const stream = await (await downloadEvent).createReadStream();
    let data = ''; for await (const chunk of stream) data += chunk;
    expect(JSON.parse(data).rows).toEqual([{ syncId: 'new', meal: { label: 'Déjeuner', grams: 200 } }]);
    await page.evaluate(() => { window.scope = 'b'; showNutritionStorageRecovery(); });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.evaluate(() => { window.scope = 'a'; showNutritionStorageRecovery(); });
    await page.getByRole('button', { name: 'Réessayer la sauvegarde' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await page.evaluate(() => window.synced)).toBe(0);
    expect(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/nutrition-storage-${width}-${dark}.png` });
    await page.evaluate(() => { window.blocked = false; localStorage.setItem('a', JSON.stringify([{ syncId: 'other' }])); });
    await page.getByRole('button', { name: 'Réessayer la sauvegarde' }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('a')).map(row => row.syncId))).toEqual(['new', 'other']);
    expect(await page.evaluate(() => window.synced)).toBe(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
