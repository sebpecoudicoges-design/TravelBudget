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

  it('keeps dashboard help and wallet empty states delegated', () => {
    expect(legacy).toContain('window.TBDashboardView?.renderDashboardContextHelp');
    expect(legacy).toContain('window.TBDashboardView?.renderWalletEmptyState');
    expect(legacy).toContain('window.TBDashboardView?.renderWalletQuickOnboarding');
    expect(legacy).not.toContain('data-tb-help-close="dashboard_overview">${T("common.hide")}');
    expect(legacy).not.toContain('T("onboarding.step.wallet")}</div>');
  });

  it('keeps wallet card rendering delegated to the Dashboard view module', () => {
    expect(legacy).toContain('window.TBDashboardView?.renderWalletCard');
    expect(legacy).toContain('data-wallet-archive-action');
    expect(legacy).not.toContain('flex:1 1 520px;');
    expect(legacy).not.toContain("openTxModal('expense','${w.id}')");
    expect(legacy).not.toContain("adjustWalletBalance('${w.id}')");
  });

  it('keeps a single wallet activity renderer in the Dashboard legacy file', () => {
    const matches = legacy.match(/function _walletRecentTransactionsHTML/g) || [];
    expect(matches).toHaveLength(1);
    expect(legacy).toContain('isPastUnpaid');
    expect(legacy).toContain('row.projectedNegative');
  });
});
