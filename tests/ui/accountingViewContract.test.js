import { it, expect } from 'vitest';
import fs from 'node:fs';
import { renderAccounting } from '../../src/features/accounting/accountingView.js';
import { buildAccountingReport } from '../../src/features/accounting/accountingRules.js';
import { canAccessAppView } from '../../src/core/moduleAccessRules.js';

it('uses a lazy runtime, accessible navigation and preserves validation role access', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  expect(html).toContain('id="tab-accounting" type="button"');
  expect(html).toContain('id="accounting-root"');
  expect(html).toContain('.wrap > #view-accounting,');
  expect(fs.readFileSync('src/main.js', 'utf8')).toContain("import('./features/accounting/accountingController.js')");
  expect(fs.readFileSync('public/legacy/js/10_navigation.js', 'utf8')).toContain('["accounting", "tab-accounting", "view-accounting"]');
  expect(canAccessAppView('accounting', 'user')).toBe(false);
  expect(canAccessAppView('accounting', 'admin')).toBe(true);
  expect(canAccessAppView('accounting', 'test')).toBe(true);
});
it('escapes source content and shows unknown liabilities without a fabricated balanced total', () => {
  const data = { transactions: [{ id: 'x', type: 'expense', currency: 'EUR', amount: 10, date_start: '2026-01-01', label: '<script>unsafe</script>' }] };
  const report = buildAccountingReport(data, { start: '2026-01-01', end: '2026-01-31', today: '2026-01-31', currency: 'EUR' });
  const model = { data, report, previous: report, settings: {}, currencies: ['EUR'], scopeName: '<img>', ui: { tab: 'entries' } };
  expect(renderAccounting(model)).toContain('&lt;script&gt;');
  expect(renderAccounting(model)).not.toContain('<script>');
  expect(renderAccounting({ ...model, ui: { tab: 'balance' } })).toContain('Total patrimoine net et dettes</span><strong>Non disponible');
});
