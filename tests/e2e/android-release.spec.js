import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`Android release link stays accessible ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/projet.html');
    const download = page.locator('[data-latest-apk]');
    await expect(download).toHaveAttribute('href', /\/app-downloads\/apk\/travelbudget-\d+\.\d+\.\d+-\d{8}-\d{6}-debug\.apk$/);
    await expect(download).toContainText(`APK ${version}`);
    await expect(download).toBeVisible();
    await expect(page.locator('.hero-status-item').first()).toContainText(version);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(download).toContainText(`APK ${version}`);
    await expect(page.locator('[data-i18n^="app.cta.body."]')).toContainText('security fix');
  });
}
