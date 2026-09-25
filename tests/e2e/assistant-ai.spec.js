import { test, expect } from '@playwright/test';
import fs from 'node:fs';

for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  test(`assistant local, AI, fallback and cancel ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/assistant-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
    await page.goto('/assistant-test');
    for (const match of fs.readFileSync('index.html', 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) await page.addStyleTag({ content: match[1] });
    await page.addStyleTag({ url: '/src/ui/premium-theme.css' });
    await page.evaluate(theme => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.themeResolved = theme;
      document.body.classList.toggle('theme-dark', theme === 'dark');
      window.state = {}; window.tbGetLang = () => 'fr'; window.tbT = k => k;
      window.showView = view => { window.lastView = view; };
      window.tbSearchFaq = () => [{ a: { fr: 'Réponse locale' } }];
      window.tbRequestAssistantHelp = async () => ({ answer: '<script>texte sans HTML</script>', view: 'assets', source: 'ai' });
    }, theme);
    await page.addScriptTag({ url: '/legacy/js/32_help_assistant.js' });
    await page.locator('#tb-assist-btn').click();
    const input = page.locator('#tb-assist-input');
    await input.fill('Bonjour'); await page.locator('#tb-assist-send').click();
    await expect(page.locator('#tb-assist-thread')).toContainText('Réponse locale');
    await page.locator('#tb-assist-ai').check();
    await input.fill('Aide'); await page.locator('#tb-assist-send').click();
    await expect(page.locator('#tb-assist-thread')).toContainText('<script>texte sans HTML</script>');
    await expect(page.locator('#tb-assist-thread script')).toHaveCount(0);
    await page.locator('#tb-assist-thread [data-assist-view="assets"]').click();
    expect(await page.evaluate(() => window.lastView)).toBe('assets');
    await page.evaluate(() => { window.tbRequestAssistantHelp = async () => { throw new Error('offline'); }; });
    await input.fill('Bonjour'); await page.locator('#tb-assist-send').click();
    await expect(page.locator('#tb-assist-status')).toContainText('réponse locale');
    await page.evaluate(() => { window.tbRequestAssistantHelp = ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('abort')))); });
    await input.fill('Aide'); await page.locator('#tb-assist-send').click();
    await expect(page.locator('#tb-assist-send')).toBeDisabled();
    await page.locator('#tb-assist-cancel').click();
    await expect(page.locator('#tb-assist-send')).toBeEnabled();
    await expect(page.locator('#tb-assist-status')).toContainText('annulée');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (theme === 'dark') expect(await page.locator('.tb-assist-ai-controls').evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgb(255, 255, 255)');
    await page.screenshot({ path: `test-results/assistant-${width}-${theme}.png` });
  });
}
