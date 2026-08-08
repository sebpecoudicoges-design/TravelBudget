import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('shared UI feedback contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const feedback = fs.readFileSync('src/ui/feedback.js', 'utf8');
  const theme = fs.readFileSync('src/ui/premium-theme.css', 'utf8');
  const transactions = fs.readFileSync('public/legacy/js/13_transactions_view.js', 'utf8');

  it('installs feedback before the legacy domains need global toast helpers', () => {
    expect(main).toContain("import { installGlobalFeedback } from './ui/feedback.js'");
    expect(main.indexOf('installGlobalFeedback();')).toBeLessThan(main.indexOf('const BOOT_LEGACY_SCRIPTS'));
    expect(feedback).toContain('window.toastOk =');
    expect(feedback).toContain('window.toastWarn =');
    expect(feedback).toContain("kind: 'success'");
    expect(feedback).toContain("kind: 'error'");
  });

  it('uses one bottom-right accessible surface for failures and successes', () => {
    expect(feedback).toContain("item.setAttribute('role', kind === 'error' || kind === 'warning' ? 'alert' : 'status')");
    expect(theme).toContain('.tb-feedback-host');
    expect(theme).toContain('right: 18px');
    expect(theme).toContain('bottom: 18px');
    expect(theme).toContain('.tb-feedback--success');
    expect(theme).toContain('.tb-feedback--error');
    expect(theme).toContain('body.theme-dark .tb-feedback--error { border-left-color: var(--tb-danger); }');
    expect(transactions).toContain("type === 'success' && typeof toastOk === 'function'");
  });
});
