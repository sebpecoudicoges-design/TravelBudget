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

  it('loads Dashboard wallet rules on demand instead of booting them eagerly', () => {
    expect(main).toContain('window.TBDashboardWalletRules');
    expect(main).toContain('window.TBLoadDashboardWalletRules');
    expect(main).toContain("await import('./features/dashboard/dashboardWalletRules.js')");
    expect(main).not.toContain("import * as dashboardWalletRules from './features/dashboard/dashboardWalletRules.js'");
    expect(legacy).toContain('await window.TBLoadDashboardWalletRules();');
  });

  it('keeps dashboard onboarding rendering delegated', () => {
    const matches = legacy.match(/function renderOnboardingPanel/g) || [];
    expect(matches).toHaveLength(1);
    expect(legacy).toContain('window.TBDashboardView?.renderDashboardOnboardingPanel');
    expect(legacy).not.toContain('Crée un <b>wallet</b>');
    expect(legacy).not.toContain('steps.join("<br/>")');
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
    expect(legacy).toContain('window.TBDashboardView?.renderWalletActions');
    expect(legacy).toContain('window.TBDashboardView?.renderWalletCard');
    expect(legacy).toContain('data-wallet-archive-action');
    const renderKpiCalls = legacy.match(/renderKpis\(\)/g) || [];
    expect(renderKpiCalls).toHaveLength(1);
    expect(legacy).not.toContain('flex:1 1 520px;');
    expect(legacy).not.toContain("openTxModal('expense','${w.id}')");
    expect(legacy).not.toContain("adjustWalletBalance('${w.id}')");
    expect(legacy).not.toContain('<button class="btn primary" onclick="createWallet()">+ Wallet</button>');
    expect(legacy).not.toContain('archiveToggleBtn.onclick');
    expect(legacy).not.toContain('btn.onclick = () => openWalletTypesFix()');
  });

  it('keeps daily budget controls and day rows delegated', () => {
    expect(legacy).toContain('window.TBDashboardView?.renderDailyBudgetControls');
    expect(legacy).toContain('window.TBDashboardView?.renderDailyBudgetDay');
    expect(legacy).not.toContain('<button class="btn" id="db-prev">${T("common.previous")}</button>');
    expect(legacy).not.toContain('<div class="pill ${budgetClass(budget)}">');
    expect(legacy).not.toContain('details.map((x) =>');
  });

  it('keeps wallet dialog rendering delegated and style injection side-effect free', () => {
    expect(legacy).toContain('window.TBDashboardView?.renderWalletCreateDialog');
    expect(legacy).toContain('window.TBDashboardView?.renderWalletEditDialog');
    expect(legacy).toContain('window.TBDashboardView?.renderWalletTypesFixDialog');
    expect(legacy).toContain('window.TBDashboardWalletRules?.validateWalletCreateInput');
    expect(legacy).toContain('window.TBDashboardWalletRules?.validateWalletEditInput');
    expect(legacy).toContain('window.TBDashboardWalletRules?.inferWalletTypeFromName');
    expect(legacy).toContain('window.TBDashboardWalletRules?.buildWalletCreateRow');
    expect(legacy).toContain('window.TBDashboardWalletRules?.buildWalletEditPatch');
    expect(legacy).toContain('window.TBDashboardWalletRules?.buildWalletArchivePatch');
    expect(legacy).toContain('window.TBDashboardWalletRules?.canDeleteWallet');
    expect(legacy).toContain('window.TBDashboardWalletRules?.normalizeWalletTypeUpdates');
    expect(legacy).toContain('tbEnsureWalletDlgStyles();');
    expect(legacy).not.toContain('tbOpenWalletDialog().then(() => {});');
    expect(legacy).not.toContain('<input id="tbWName" type="text"');
    expect(legacy).not.toContain('<input id="tbWEditName" type="text"');
    expect(legacy).not.toContain('On a détecté des wallets sans type');
    expect(legacy).not.toContain('const allowed = ["cash", "bank", "card", "savings", "other"]');
    expect(legacy).not.toContain('user_id: sbUser.id');
    expect(legacy).not.toContain('.update({ name: data.name, type: data.type })');
    expect(legacy).not.toContain('.update({ archived: true, archived_at: new Date().toISOString() })');
    expect(legacy).not.toContain('.update({ archived: false, archived_at: null })');
  });

  it('keeps a single wallet activity renderer in the Dashboard legacy file', () => {
    const matches = legacy.match(/function _walletRecentTransactionsHTML/g) || [];
    expect(matches).toHaveLength(1);
    expect(legacy).toContain('window.TBDashboardView?.renderWalletRecentTransactions');
    expect(legacy).toContain('isPastUnpaid');
    expect(legacy).toContain('projectedNegative: projectedFutureBalance < 0');
    expect(legacy).not.toContain('const statusColor = row.isFutureSoon');
    expect(legacy).not.toContain('Risque de decouvert")}</span>');
  });
});
