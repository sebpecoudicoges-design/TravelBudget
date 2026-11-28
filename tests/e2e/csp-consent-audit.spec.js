import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block', colorScheme: 'light' });

const pagePath = '/connect-chatgpt.html';
const projectOrigin = 'https://obznbrzarhvmlbprcfie.supabase.co';
const apiPath = '/functions/v1/travelbudget-mcp';
const assets = new Map([
  [pagePath, 'text/html'],
  ['/connect-chatgpt.css', 'text/css'],
  ['/connect-chatgpt.js', 'text/javascript'],
  ['/vendor/supabase-2.110.6.js', 'text/javascript'],
]);

function configuredPolicies() {
  return JSON.parse(execFileSync('python3', ['-c', [
    'import json, tomllib',
    'with open("netlify.toml", "rb") as config:',
    '    rules = {entry["for"]: entry["values"] for entry in tomllib.load(config)["headers"]}',
    'print(json.dumps({name: value for path in ("/*", "/connect-chatgpt.html") for name, value in rules[path].items() if name.startswith("Content-Security-Policy")}))',
  ].join('\n')], { encoding: 'utf8' }));
}

test('the built consent screen opens normally under the versioned blocking policy', async ({ page, baseURL }) => {
  const policies = configuredPolicies();
  const local = new URL(baseURL).origin;
  const configReads = [];
  const unexpected = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.name));
  await page.addInitScript(() => {
    window.auditCsp = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.auditCsp.push({ directive: event.effectiveDirective, disposition: event.disposition });
    });
  });
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const { origin, pathname } = url;
    if (req.method() === 'GET' && origin === local && assets.has(pathname)) {
      return route.fulfill({
        contentType: assets.get(pathname),
        headers: pathname === pagePath ? policies : {},
        body: await readFile(new URL('../../dist' + pathname, import.meta.url)),
      });
    }
    if (req.method() === 'GET' && origin === projectOrigin && pathname === apiPath + '/config') {
      configReads.push(pathname);
      return route.fulfill({
        headers: { 'access-control-allow-origin': local },
        json: { supabaseUrl: projectOrigin, publishableKey: 'fictional-public-key' },
      });
    }
    unexpected.push({ method: req.method(), origin, pathname });
    return route.abort();
  });

  const response = await page.goto(pagePath);
  expect(response.headers()['content-security-policy']).toBe(policies['Content-Security-Policy']);
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response.headers()['content-security-policy-report-only']).toBeTruthy();
  await expect(page.locator('#status')).toContainText('Démarre la connexion depuis ChatGPT');
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#approve')).toBeDisabled();
  await page.locator('#theme-toggle').click();
  await expect(page.locator('body')).toHaveClass(/theme-dark/);
  await expect(page.locator('body')).toHaveCSS('color-scheme', 'dark');
  expect(configReads).toHaveLength(1);
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.auditCsp)).toEqual([]);
});
