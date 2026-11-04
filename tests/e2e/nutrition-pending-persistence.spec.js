import { test, expect } from '@playwright/test';

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
