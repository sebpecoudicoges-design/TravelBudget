import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('dashboard view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/12_dashboard_render.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const cashflow = fs.readFileSync('public/legacy/js/27_cashflow_curve.js', 'utf8');
  const kpiView = fs.readFileSync('src/features/kpi/kpiView.js', 'utf8');
  const kpiLegacy = fs.readFileSync('public/legacy/js/11_kpi_render_micro_animation.js', 'utf8');
  const dashboardView = fs.readFileSync('src/features/dashboard/dashboardView.js', 'utf8');
  const premiumTheme = fs.readFileSync('src/ui/premium-theme.css', 'utf8');

  it('keeps a clear colored emoji for every dashboard module tab', () => {
    const moduleIcons = {
      dashboard: '🧭', transactions: '💳', analysis: '📊', assets: '💎', cautions: '🛡️',
      sport: '🏋️', nutrition: '🍎', work: '💼', documents: '📁', inbox: '📥',
      notifications: '🔔', help: '❓', trip: '✈️', settings: '⚙️', members: '👥',
    };
    Object.entries(moduleIcons).forEach(([id, icon]) => {
      expect(index).toContain(`id="tab-${id}"`);
      expect(index).toContain(`data-icon="${icon}"`);
    });
    expect(index).toContain('<span class="tab-label" data-t="nav.dashboard">Dashboard</span>');
  });

  it('removes the redundant dashboard analysis banner while preserving projection and converter controls', () => {
    expect(index).not.toContain('<div class="dashboard-analysis-row"');
    expect(index).not.toContain('Lire les écarts, pas seulement les soldes');
    expect(index).toContain('id="solde-projection-container"');
    expect(cashflow).toContain('id="cf-pending-exp"');
    expect(cashflow).toContain('id="cf-pending-inc"');
    expect(cashflow).toContain('id="cf-reset-zoom"');
    expect(cashflow).toContain('class="cashflow-cats"');
    expect(kpiView).toContain('id="kpiFxCalcAmount"');
    expect(kpiView).toContain('id="kpiFxCalcSwap"');
    expect(kpiView).toContain('id="kpiFxCalcFrom"');
    expect(kpiView).toContain('id="kpiFxCalcTo"');
  });

  it('exposes the Dashboard view module to the legacy runtime', () => {
    expect(main).toContain("import * as dashboardView from './features/dashboard/dashboardView.js'");
    expect(main).toContain('window.TBDashboardView');
    expect(main).toContain('...dashboardView');
  });

  it('keeps currency swipe on the converter, weekly navigation and the three finance KPIs explicit', () => {
    expect(legacy).not.toContain('currency-prev');
    expect(legacy).not.toContain('select-currency');
    expect(kpiView).toContain('id="kpiFxSwipeArea"');
    expect(kpiView).toContain('Glissez ↔ pour intervertir');
    expect(kpiLegacy).toContain('bindKpiInteractions');
    expect(kpiLegacy).toContain('const accountBaseCurrency');
    expect(kpiLegacy).toContain('Total wallets fin de période');
    expect(kpiLegacy).toContain('FX période / compte');
    expect(kpiLegacy).toContain('window.fxConvert(1, accountBaseCurrency, base, rates)');
  });

  it('preserves every useful dashboard action while the visual layout changes', () => {
    const dashboardView = fs.readFileSync('src/features/dashboard/dashboardView.js', 'utf8');
    [
      'create-wallet', 'internal-transfer', 'toggle-archived-wallets', 'fix-wallet-types',
      'tx-expense', 'tx-income', 'edit', 'adjust', 'delete',
    ].forEach((action) => expect(dashboardView).toContain(`data-${action.startsWith('tx-') || ['edit', 'adjust', 'delete'].includes(action) ? 'wallet' : 'dashboard'}-action="${action}"`));
    expect(dashboardView).toContain('data-wallet-archive-action="archive"');
    expect(dashboardView).toContain('data-wallet-archive-action="unarchive"');
    ['db-prev', 'db-today', 'db-next', 'db-mode'].forEach((id) => expect(dashboardView).toContain(`id="${id}"`));
    ['kpiPeriodSelect', 'kpiScopeSelect', 'kpiRangeApply', 'kpiIncludeUnpaidToggle', 'kpiFxCalcSwap'].forEach((id) => expect(kpiView).toContain(`id="${id}"`));
    ['cf-pending-exp', 'cf-pending-inc', 'cf-reset-zoom'].forEach((id) => expect(cashflow).toContain(`id="${id}"`));
    expect(cashflow).toContain('class="cashflow-cats"');
  });

  it('loads Dashboard daily budget state on demand instead of booting it eagerly', () => {
    expect(main).toContain('window.TBLoadDashboardDailyBudgetState');
    expect(main).toContain("await import('./features/dashboard/dashboardDailyBudgetState.js')");
    expect(main).not.toContain("import * as dashboardDailyBudgetState from './features/dashboard/dashboardDailyBudgetState.js'");
    expect(legacy).toContain('window.TBLoadDashboardDailyBudgetState');
    expect(legacy).toContain('window.TBDashboardDailyBudgetState');
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
    expect(legacy).toContain('function _bindDashboardActions');
    expect(legacy).toContain('actionKey: "open-settings"');
    expect(legacy).toContain('actionKey: "add-transaction"');
    expect(legacy).not.toContain('Crée un <b>wallet</b>');
    expect(legacy).not.toContain('steps.join("<br/>")');
    expect(legacy).not.toContain('grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px;');
  });

  it('keeps dashboard onboarding visuals in the premium theme instead of inline styles', () => {
    expect(dashboardView).toContain('class="tb-ob-head"');
    expect(dashboardView).toContain('class="tb-ob-grid"');
    expect(dashboardView).toContain('tb-ob-mini');
    expect(dashboardView).not.toContain('display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px;');
    expect(dashboardView).not.toContain('border:1px solid ${isOk');
    expect(dashboardView).not.toContain('style="margin-top:10px;padding:7px 10px;font-size:12px;"');
    expect(premiumTheme).toContain('.tb-ob-grid');
    expect(premiumTheme).toContain('.tb-ob-step.is-ok');
    expect(premiumTheme).toContain('.tb-ob-head');
  });

  it('keeps dead dashboard help removed while wallet empty states stay delegated', () => {
    expect(legacy).not.toContain('function renderDashboardContextHelp');
    expect(legacy).not.toContain('window.TBDashboardView?.renderDashboardContextHelp');
    expect(main).not.toContain('renderDashboardContextHelp');
    expect(legacy).toContain('window.TBDashboardView?.renderWalletEmptyState');
    expect(legacy).toContain('window.TBDashboardView?.renderWalletQuickOnboarding');
    expect(legacy).toContain('window.tbUxDismiss = window.tbUxDismiss || _tbUxDismiss');
    expect(legacy).not.toContain('data-tb-help-close="dashboard_overview">${T("common.hide")}');
    expect(legacy).not.toContain('T("onboarding.step.wallet")}</div>');
  });

  it('keeps obsolete dashboard hero remount helpers removed', () => {
    expect(legacy).not.toContain('function tbMoveDashboardHeroToTop');
    expect(legacy).not.toContain('function tbMountExistingKpisIntoHero');
    expect(legacy).not.toContain('dashboard-kpi-embed-slot');
    expect(legacy).not.toContain('oldParent.style.display = "none"');
  });

  it('keeps wallet card rendering delegated to the Dashboard view module', () => {
    expect(legacy).toContain('window.TBDashboardView?.renderWalletActions');
    expect(legacy).toContain('window.TBDashboardView?.renderWalletCard');
    expect(legacy).toContain('[data-dashboard-action]');
    expect(legacy).toContain('[data-wallet-action]');
    expect(legacy).toContain('data-wallet-archive-action');
    const renderKpiCalls = legacy.match(/renderKpis\(\)/g) || [];
    expect(renderKpiCalls).toHaveLength(1);
    expect(legacy).not.toContain('flex:1 1 520px;');
    expect(legacy).not.toContain("openTxModal('expense','${w.id}')");
    expect(legacy).not.toContain("adjustWalletBalance('${w.id}')");
    expect(legacy).not.toContain('<button class="btn primary" onclick="createWallet()">+ Wallet</button>');
    expect(legacy).not.toContain('archiveToggleBtn.onclick');
    expect(legacy).not.toContain('btn.onclick = () => openWalletTypesFix()');
    const view = fs.readFileSync('src/features/dashboard/dashboardView.js', 'utf8');
    expect(view).toContain('data-dashboard-action="create-wallet"');
    expect(view).toContain('data-dashboard-action="guided-tour"');
    expect(view).toContain('data-dashboard-action="open-settings"');
    expect(view).toContain('data-wallet-action="tx-expense"');
    expect(view).not.toContain('onclick=');
    expect(view).not.toContain('onclick="createWallet()"');
    expect(view).not.toContain("onclick=\"openTxModal('expense'");
    expect(view).not.toContain('onclick="adjustWalletBalance');
  });

  it('keeps daily budget controls and day rows delegated', () => {
    expect(legacy).toContain('window.TBDashboardView?.renderDailyBudgetControls');
    expect(legacy).toContain('window.TBDashboardView?.renderDailyBudgetDay');
    expect(legacy).toContain('dailyState?.loadDailyBudgetView');
    expect(legacy).toContain('dailyState?.addDashboardDays');
    expect(legacy).toContain('dailyState?.clampDashboardISO');
    expect(legacy).toContain('dailyState?.saveDailyBudgetView');
    expect(legacy).not.toContain('<button class="btn" id="db-prev">${T("common.previous")}</button>');
    expect(legacy).not.toContain('<div class="pill ${budgetClass(budget)}">');
    expect(legacy).not.toContain('details.map((x) =>');
    expect(legacy).not.toContain('function _dbAddDays');
    expect(legacy).not.toContain('function _dbClampISO');
    expect(legacy).not.toContain('function _dbLoadView');
    expect(legacy).not.toContain('travelbudget_daily_budget_view_v1');
  });

  it('keeps wallet dialog rendering delegated and style injection side-effect free', () => {
    expect(legacy).toContain('window.TBDashboardView?.getWalletDialogStyles');
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
    expect(legacy).toContain('async function _loadDashboardWalletRules()');
    expect(legacy.match(/await window\.TBLoadDashboardWalletRules\(\);/g) || []).toHaveLength(1);
    expect(legacy).not.toContain('tbOpenWalletDialog().then(() => {});');
    expect(legacy).not.toContain('.tb-dlg-backdrop{position:fixed');
    expect(legacy).not.toContain('<input id="tbWName" type="text"');
    expect(legacy).not.toContain('<input id="tbWEditName" type="text"');
    expect(legacy).not.toContain('On a détecté des wallets sans type');
    expect(legacy).not.toContain('function tbEscHTML');
    expect(legacy).not.toContain('function tbInferWalletTypeFromName');
    expect(legacy).not.toContain('function tbWalletTypeLabel');
    expect(legacy).not.toContain('const allowed = ["cash", "bank", "card", "savings", "other"]');
    expect(legacy).not.toContain('user_id: sbUser.id');
    expect(legacy).not.toContain('.update({ name: data.name, type: data.type })');
    expect(legacy).not.toContain('.update({ archived: true, archived_at: new Date().toISOString() })');
    expect(legacy).not.toContain('.update({ archived: false, archived_at: null })');
  });

  it('keeps a single wallet activity renderer in the Dashboard legacy file', () => {
    const matches = legacy.match(/function _walletRecentTransactionsHTML/g) || [];
    expect(matches).toHaveLength(1);
    expect(legacy).toContain('window.TBDashboardView?.prepareWalletRecentTransactions');
    expect(legacy).toContain('window.TBDashboardView?.renderWalletRecentTransactions');
    expect(legacy).not.toContain('function _walletRecentTxDate');
    expect(legacy).not.toContain('function _walletRecentTxTouchesWallet');
    expect(legacy).not.toContain('function _walletRecentAddDaysISO');
    expect(legacy).not.toContain('projectedNegative: projectedFutureBalance < 0');
    expect(legacy).not.toContain('isPastUnpaid');
    expect(legacy).not.toContain('const statusColor = row.isFutureSoon');
    expect(legacy).not.toContain('Risque de decouvert")}</span>');
  });
});
