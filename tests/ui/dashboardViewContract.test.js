import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('dashboard view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/12_dashboard_render.js', 'utf8');

  it('exposes the Dashboard view module to the legacy runtime', () => {
    expect(main).toContain("import * as dashboardView from './features/dashboard/dashboardView.js'");
    expect(main).toContain('window.TBDashboardView');
    expect(main).toContain('...dashboardView');
  });

  it('keeps dashboard onboarding rendering delegated', () => {
    expect(legacy).toContain('window.TBDashboardView?.renderDashboardOnboardingPanel');
    expect(legacy).not.toContain('grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px;');
  });

  it('keeps a single wallet activity renderer in the Dashboard legacy file', () => {
    const matches = legacy.match(/function _walletRecentTransactionsHTML/g) || [];
    expect(matches).toHaveLength(1);
    expect(legacy).toContain('isPastUnpaid');
    expect(legacy).toContain('row.projectedNegative');
  });
});
