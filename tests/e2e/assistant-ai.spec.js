import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createAssistantHandler } from '../../supabase/functions/assistant-help/handler.js';

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
    await page.evaluate(() => { window.tbRequestAssistantHelp = async () => ({ answer: 'Consulte la Comptabilité.', view: 'accounting', source: 'ai' }); });
    await input.fill('Où voir mon résultat ?'); await page.locator('#tb-assist-send').click();
    await page.getByRole('button', { name: 'Ouvrir Comptabilité', exact: true }).click();
    expect(await page.evaluate(() => window.lastView)).toBe('accounting');
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

for (const [language, question, navigation, distinction, limit] of [
  ['fr', 'Où voir mon compte de résultat et ses amortissements ?', 'Finances → Comptabilité', 'ne correspond pas au solde', 'sur cet appareil'],
  ['en', 'Where is the accounting balance sheet for my assets?', 'Finances → Accounting', 'is not your wallet balance', 'on this device'],
]) {
  test(`offline accounting help is relevant and searchable (${language})`, async ({ page }) => {
    await page.route('**/assistant-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body></body>' }));
    await page.goto('/assistant-test');
    await page.evaluate(lang => {
      window.state = {};
      window.tbGetLang = () => lang;
      window.tbT = key => key;
      window.tbRequestAssistantHelp = async () => { window.onlineHelpCalled = true; throw new Error('Unexpected external request'); };
      Object.defineProperty(navigator, 'onLine', { value: false });
    }, language);
    await page.addScriptTag({ url: '/legacy/js/31_help_faq.js' });
    await page.addScriptTag({ url: '/legacy/js/32_help_assistant.js' });
    await page.locator('#tb-assist-btn').click();
    await page.locator('#tb-assist-ai').check();
    await page.locator('#tb-assist-input').fill(question);
    await page.locator('#tb-assist-send').click();
    const reply = page.locator('#tb-assist-thread .bot').last();
    for (const text of [navigation, distinction, limit]) await expect(reply).toContainText(text);
    expect(await page.evaluate(() => window.onlineHelpCalled)).toBeUndefined();
    expect(await page.evaluate(q => window.tbSearchFaq(q, 8).map(item => item.id), language === 'fr' ? 'comptabilité' : 'accounting')).toContain('personal_accounting');
  });
}

for (const [language, question, answer, open, fallback, distinction] of [
  ['fr', 'Le résultat comptable est-il le solde du portefeuille ?',
    'Non. Le compte de résultat et le solde du portefeuille sont distincts.',
    'Ouvrir Comptabilité', 'IA indisponible : réponse locale.', 'ne correspond pas au solde'],
  ['en', 'Is my accounting result the same as my wallet balance?',
    'No. The income statement and the wallet balance are different.',
    'Open Accounting', 'AI unavailable: local answer.', 'is not your wallet balance'],
]) {
  test(`accounting assistance through the real handler with a simulated provider (${language})`, async ({ page, baseURL }) => {
    const received = [], providerCalls = [], quotaCalls = [];
    let providerAvailable = true;
    const handler = createAssistantHandler({
      apiKey: 'fixture-only', enabled: true, allowedUsers: ['fictional-user'],
      authenticate: async value => value === 'Bearer local-fixture' ? 'fictional-user' : null,
      reserveQuota: async id => { quotaCalls.push(id); return true; },
      fetchImpl: async (_url, init) => {
        providerCalls.push(JSON.parse(init.body));
        if (!providerAvailable) return new Response(null, { status: 503 });
        return Response.json({ status: 'completed', output: [
          { type: 'message', role: 'assistant', content: [
            { type: 'output_text', text: JSON.stringify({ answer, view: 'accounting' }) },
          ] },
        ] });
      },
    });
    await page.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin !== new URL(baseURL).origin) return route.abort();
      if (url.pathname === '/assistant-test') return route.fulfill({
        contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body></body>',
      });
      if (url.pathname !== '/assistant-local-fixture') return route.continue();
      const raw = req.postData();
      received.push(JSON.parse(raw));
      const result = await handler(new Request(url, {
        method: req.method(), body: raw, headers: await req.allHeaders(),
      }));
      return route.fulfill({ status: result.status, headers: Object.fromEntries(result.headers), body: await result.text() });
    });
    await page.goto('/assistant-test');
    await page.evaluate(async lang => {
      const { requestAssistantHelp } = await import('/src/features/assistant/assistantAiClient.js');
      window.state = { transactions: [{ label: 'fixture must stay local', amount: 7193.42 }] };
      window.activeView = 'accounting';
      window.tbGetLang = () => lang;
      window.tbT = key => key;
      window.showView = view => { window.lastView = view; };
      window.tbRequestAssistantHelp = requestAssistantHelp;
      window.sb = { functions: { invoke: async (name, { body, signal }) => {
        if (name !== 'assistant-help') throw new Error('Unexpected function');
        const response = await fetch('/assistant-local-fixture', {
          method: 'POST', headers: { Authorization: 'Bearer local-fixture', 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal,
        });
        return response.ok ? { data: await response.json() } : { error: new Error('Fixture unavailable') };
      } } };
    }, language);
    await page.addScriptTag({ url: '/legacy/js/31_help_faq.js' });
    await page.addScriptTag({ url: '/legacy/js/32_help_assistant.js' });
    await page.locator('#tb-assist-btn').click();
    await page.locator('#tb-assist-ai').check();
    const send = async () => {
      await page.locator('#tb-assist-input').fill(question);
      await page.locator('#tb-assist-send').click();
    };
    const replies = page.locator('#tb-assist-thread .bot');
    await send();
    await expect(replies.last()).toHaveText(answer);
    await page.getByRole('button', { name: open, exact: true }).click();
    expect(await page.evaluate(() => window.lastView)).toBe('accounting');

    providerAvailable = false;
    await send();
    await expect(page.locator('#tb-assist-status')).toHaveText(fallback);
    await expect(replies.last()).toContainText(distinction);
    await expect(page.locator('#tb-assist-thread [data-assist-view]')).toHaveCount(1);

    expect(quotaCalls).toEqual(['fictional-user', 'fictional-user']);
    expect(received).toEqual(Array(2).fill({ question, language, view: 'accounting' }));
    expect(providerCalls).toHaveLength(2);
    for (const call of providerCalls) {
      expect(JSON.parse(call.input)).toEqual({ question, language, view: 'accounting' });
      expect(call.instructions).toContain('result is not the wallet balance');
      expect(call.instructions).toContain('You cannot access personal balances or records');
      expect(call.store).toBe(false);
    }
  });
}
