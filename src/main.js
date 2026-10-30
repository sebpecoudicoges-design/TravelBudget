import './app/bridge.js';
import './ui/premium-theme.css';
import './features/testing/testCampaign.css';
import { registerPwa } from './app/pwa.js';
import { createRetryableLoader } from './app/retryableLoader.js';
import { createModuleRegistry } from './app/moduleRegistry.js';
import vendorLibraries from '../config/vendor-libraries.json';
import * as budgetAnalysisRules from './core/budgetAnalysisRules.js';
import * as moduleAccessRules from './core/moduleAccessRules.js';
import * as dashboardView from './features/dashboard/dashboardView.js';
import * as transactionView from './features/transactions/transactionView.js';
import * as settingsView from './features/settings/settingsView.js';
import { installGlobalFeedback } from './ui/feedback.js';

const deferredModules = createModuleRegistry({
  walletJournal: ['/src/features/dashboard/walletJournal.js', () => import('./features/dashboard/walletJournal.js')],
  analysisRuntime: ['/src/features/analysis/analysisRuntime.js', () => import('./features/analysis/analysisRuntime.js')],
  testCampaignController: ['/src/features/testing/testCampaignController.js', () => import('./features/testing/testCampaignController.js')],
  dashboardWalletRules: ['/src/features/dashboard/dashboardWalletRules.js', () => import('./features/dashboard/dashboardWalletRules.js')],
  dashboardDailyBudgetState: ['/src/features/dashboard/dashboardDailyBudgetState.js', () => import('./features/dashboard/dashboardDailyBudgetState.js')],
  settingsCategoriesView: ['/src/features/settings/settingsCategoriesView.js', () => import('./features/settings/settingsCategoriesView.js')],
  settingsAccountController: ['/src/features/settings/settingsAccountController.js', () => import('./features/settings/settingsAccountController.js')],
  kpiView: ['/src/features/kpi/kpiView.js', () => import('./features/kpi/kpiView.js')],
  kpiHealthRules: ['/src/features/kpi/kpiHealthRules.js', () => import('./features/kpi/kpiHealthRules.js')],
  kpiProjectionRules: ['/src/features/kpi/kpiProjectionRules.js', () => import('./features/kpi/kpiProjectionRules.js')],
  kpiCashRules: ['/src/features/kpi/kpiCashRules.js', () => import('./features/kpi/kpiCashRules.js')],
  nutritionView: ['/src/features/nutrition/nutritionView.js', () => import('./features/nutrition/nutritionView.js')],
  assetView: ['/src/features/assets/assetView.js', () => import('./features/assets/assetView.js')],
  workView: ['/src/features/work/workView.js', () => import('./features/work/workView.js')],
  subscriptionRules: ['/src/core/subscriptionRules.js', () => import('./core/subscriptionRules.js')],
  subscriptionView: ['/src/features/subscriptions/subscriptionView.js', () => import('./features/subscriptions/subscriptionView.js')],
  documentView: ['/src/features/documents/documentView.js', () => import('./features/documents/documentView.js')],
  sportRuntime: ['/src/features/sport/sportRuntime.js', () => import('./features/sport/sportRuntime.js')],
  tripDocumentView: ['/src/features/trip/tripDocumentView.js', () => import('./features/trip/tripDocumentView.js')],
  tripExpenseDetailView: ['/src/features/trip/tripExpenseDetailView.js', () => import('./features/trip/tripExpenseDetailView.js')],
  tripRecapView: ['/src/features/trip/tripRecapView.js', () => import('./features/trip/tripRecapView.js')],
  inboxView: ['/src/features/inbox/inboxView.js', () => import('./features/inbox/inboxView.js')],
  accountingController: ['/src/features/accounting/accountingController.js', () => import('./features/accounting/accountingController.js')],
}, { origin: window.location.origin });

installGlobalFeedback();

window.tbOpenWalletJournal = async (walletId, options) => {
  const module = await deferredModules.load('walletJournal');
  return module.openWalletJournal(walletId, options);
};

window.TB_VERSION = typeof __TB_VERSION__ !== 'undefined'
  ? __TB_VERSION__
  : (window.TB_VERSION || '0.0.0');

window.TBCore = {
  ...(window.TBCore || {}),
  budgetAnalysisRules,
};
window.TBDashboardView = {
  ...(window.TBDashboardView || {}),
  ...dashboardView,
};
window.TBModuleAccess = {
  ...(window.TBModuleAccess || {}),
  ...moduleAccessRules,
};
window.renderTestCampaignApp = window.renderTestCampaignApp || (async (reason = 'navigation') => {
  const mod = await deferredModules.load('testCampaignController');
  return mod.renderTestCampaignApp(reason);
});
window.TBTransactionView = {
  ...(window.TBTransactionView || {}),
  ...transactionView,
};
window.TBLoadDashboardWalletRules = window.TBLoadDashboardWalletRules || (async () => {
  const mod = await deferredModules.load('dashboardWalletRules');
  window.TBDashboardWalletRules = {
    ...(window.TBDashboardWalletRules || {}),
    ...mod,
  };
  return window.TBDashboardWalletRules;
});
window.TBLoadDashboardDailyBudgetState = window.TBLoadDashboardDailyBudgetState || (async () => (
  window.TBDashboardDailyBudgetState ||= await deferredModules.load('dashboardDailyBudgetState')
));
window.TBSettingsView = {
  ...(window.TBSettingsView || {}),
  ...settingsView,
};
window.TBLoadSettingsCategoriesView = window.TBLoadSettingsCategoriesView || (async () => {
  const mod = await deferredModules.load('settingsCategoriesView');
  window.TBSettingsCategoriesView = {
    ...(window.TBSettingsCategoriesView || {}),
    ...mod,
  };
  return window.TBSettingsCategoriesView;
});
window.TBLoadSettingsAccountController = window.TBLoadSettingsAccountController || (async () => {
  if (window.TBSettingsAccountController?.bindSettingsAccountPanel) return window.TBSettingsAccountController;
  const mod = await deferredModules.load('settingsAccountController');
  window.TBSettingsAccountController = {
    ...(window.TBSettingsAccountController || {}),
    ...mod,
  };
  return window.TBSettingsAccountController;
});

registerPwa();

// TravelBudget V9 entrypoint (Vite + deterministic legacy loader)
// This preserves the original global-script semantics while removing fragile <script> ordering in index.html.

const BOOT_LEGACY_SCRIPTS = [
  '/legacy/js/00_constants.js',
  '/legacy/js/00_offline.js',
  '/legacy/js/00_offline_queue.js',
  '/legacy/js/00_i18n.js',
  '/legacy/js/00_perf.js',
  '/legacy/js/98_error_bus.js',
  '/legacy/js/00_supabase_config.js',
  '/legacy/js/01_helpers.js',
  '/legacy/js/97_ui_errors.js',
  '/legacy/js/02_palette_local_server_sync_robuste.js',
  '/legacy/js/03_ui_auth.js',
  '/legacy/js/04_theme.js',
  '/legacy/js/05_state.js',
  '/legacy/js/06_allocations.js',
  '/legacy/js/07_supabase_bootstrap.js',
  '/legacy/js/09_fx.js',
  '/legacy/js/09_fx_snapshot.js',
  '/legacy/js/26_fx_crossrate.js',
  '/legacy/js/24_tx_fx_snapshot.js',
  '/legacy/js/28_data_updated_bus.js',
  '/legacy/js/10_navigation.js',
  '/legacy/js/32_help_assistant.js',
  '/legacy/js/35_guided_tour.js',
  '/legacy/js/11_kpi_controller.js',
  '/legacy/js/11_kpi_render_micro_animation.js',
  '/legacy/js/12_dashboard_render.js',
  '/legacy/js/16_modal_add_edit_via_rpc.js',
  '/legacy/js/13_transactions_view.js',
  '/legacy/js/14_settings_periods_ui.js',
  '/legacy/js/15_wallet_adjust.js',
  '/legacy/js/17_internal_transfers.js',
  '/legacy/js/17_charts.js',
  '/legacy/js/18_main_render.js',
  '/legacy/js/08_refresh.js',
  '/legacy/js/19_backup_export_import.js',
  '/legacy/js/99_doctor.js',
  '/legacy/js/20_boot.js',
  '/legacy/js/21_dashboard_drag.js',
];

const OPTIONAL_SCRIPTS = new Set(['/legacy/js/00_perf.js']);
const LEGACY_DOMAIN_SCRIPTS = {
  analysis: [
    '/legacy/js/33_analysis_filter_view.js',
    '/legacy/js/33_analysis_drilldown_view.js',
    '/legacy/js/33_budget_analysis.js',
    '/legacy/js/34_fx_decision.js',
  ],
  subscriptions: [
    '/legacy/js/15_recurring_rules_ui.js',
  ],
  cashflow: [
    '/legacy/js/27_cashflow_curve.js',
  ],
  assets: [
    '/legacy/js/41_assets_core.js',
    '/legacy/js/42_assets_ui.js',
  ],
  documents: [
    '/legacy/js/43_documents_ui.js',
  ],
  inbox: [
    '/legacy/js/44_inbox_ui.js',
  ],
  help: [
    '/legacy/js/31_help_faq.js',
  ],
  nutrition: [
    '/legacy/js/48_nutrition_ui.js',
  ],
  work: [
    '/legacy/js/47_work_ui.js',
    '/legacy/js/50_work_career_ui.js',
  ],
  trip: [
    '/legacy/js/29_trip_v1.js',
    '/legacy/js/30_members_admin.js',
  ],
  sport: [
    '/legacy/js/45_sport_ui.js',
  ],
  notifications: [
    '/legacy/js/49_notifications_ui.js',
  ],
};
const legacyDomainLoader = createRetryableLoader(async (key) => {
  await waitForBridgeReady();
  if (key === 'analysis' || key === 'assets') {
    await loadScript(`/vendor/${vendorLibraries.echarts.file}`);
    await loadScript(`/vendor/${vendorLibraries.echartsTheme.file}`);
  }
  if (key === 'cashflow') await loadScript(`/vendor/${vendorLibraries.apexcharts.file}`);
  if (key === 'analysis') await ensureAnalysisModules();
  await ensureDomainModules(key);
  for (const src of LEGACY_DOMAIN_SCRIPTS[key]) await loadScript(src);
  return true;
});
let bridgeReadyPromise = null;
const analysisModuleLoader = createRetryableLoader(async () => (await deferredModules.load('analysisRuntime')).installAnalysisRuntime(window));
let kpiViewPromise = null;

function ensureKpiStylesheet() {
  if (document.getElementById('tb-kpi-view-css')) return true;
  const link = document.createElement('link');
  link.id = 'tb-kpi-view-css';
  link.rel = 'stylesheet';
  link.href = './legacy/css/kpi_view.css';
  document.head.appendChild(link);
  return true;
}

async function ensureKpiView() {
  try { ensureKpiStylesheet(); } catch (_) {}
  if (window.TBKpiView?.renderKpiHealthCard) return true;
  if (!kpiViewPromise) {
    kpiViewPromise = Promise.all([
      deferredModules.load('kpiView'),
      deferredModules.load('kpiHealthRules'),
      deferredModules.load('kpiProjectionRules'),
      deferredModules.load('kpiCashRules'),
    ])
      .then(([kpiView, kpiHealthRules, kpiProjectionRules, kpiCashRules]) => {
        window.TBKpiView = {
          ...(window.TBKpiView || {}),
          ...kpiView,
        };
        window.TBKpiHealthRules = {
          ...(window.TBKpiHealthRules || {}),
          ...kpiHealthRules,
        };
        window.TBKpiProjectionRules = {
          ...(window.TBKpiProjectionRules || {}),
          ...kpiProjectionRules,
        };
        window.TBKpiCashRules = {
          ...(window.TBKpiCashRules || {}),
          ...kpiCashRules,
        };
        return true;
      })
      .catch((error) => {
        kpiViewPromise = null;
        window.TBKpiView = window.TBKpiView || {};
        try { console.error('[TB][boot] KPI view load failed', error); } catch (_) {}
        return false;
      });
  }
  return kpiViewPromise;
}

function hasRequiredBridgeGlobals() {
  return Boolean(
    window.__tbBridgeReady &&
      window.Data?.createMutationQueueStore &&
      window.Data?.createTripStore
  );
}

function waitForBridgeReady() {
  if (hasRequiredBridgeGlobals()) return Promise.resolve(true);
  if (bridgeReadyPromise) return bridgeReadyPromise;
  bridgeReadyPromise = new Promise((resolve, reject) => {
    let timer = null;
    const done = () => {
      window.removeEventListener('tb:bridge_ready', done);
      if (timer) window.clearTimeout(timer);
      if (hasRequiredBridgeGlobals()) {
        resolve(true);
        return;
      }
      reject(new Error('TravelBudget bridge indisponible avant chargement legacy'));
    };
    window.addEventListener('tb:bridge_ready', done, { once: true });
    timer = window.setTimeout(done, 2500);
  }).catch((error) => {
    bridgeReadyPromise = null;
    throw error;
  });
  return bridgeReadyPromise;
}

const scriptLoader = createRetryableLoader((src) => {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // enforce execution order
    s.onload = () => resolve(src);
    s.onerror = () => {
      s.remove();
      reject(new Error(`Failed to load legacy script: ${src}`));
    };
    document.head.appendChild(s);
  });
});

function loadScript(src) { return scriptLoader.load(src); }

async function ensureAnalysisModules() {
  if (window.TBAnalysisView && window.TBAnalysisCharts) return true;
  return analysisModuleLoader.load('analysis');
}

const domainModules = createRetryableLoader(async key => {
  window.UI = window.UI || {};
  if (key === 'nutrition') {
    const nutritionView = await deferredModules.load('nutritionView');
    window.UI.nutritionView = {
      ...(window.UI.nutritionView || {}),
      ...nutritionView,
    };
  }
  if (key === 'assets') {
    const assetView = await deferredModules.load('assetView');
    window.UI.assetView = {
      ...(window.UI.assetView || {}),
      ...assetView,
    };
  }
  if (key === 'work') {
    const workView = await deferredModules.load('workView');
    window.UI.workView = {
      ...(window.UI.workView || {}),
      ...workView,
    };
  }
  if (key === 'subscriptions') {
    const [subscriptionRules, subscriptionView] = await Promise.all([
      deferredModules.load('subscriptionRules'),
      deferredModules.load('subscriptionView'),
    ]);
    window.Core = window.Core || {};
    window.Core.subscriptionRules = subscriptionRules;
    window.UI.subscriptionView = {
      ...(window.UI.subscriptionView || {}),
      ...subscriptionView,
    };
  }
  if (key === 'documents') {
    const documentView = await deferredModules.load('documentView');
    window.UI.documentView = {
      ...(window.UI.documentView || {}),
      ...documentView,
    };
  }
  if (key === 'sport') {
    const sportRuntime = await deferredModules.load('sportRuntime');
    sportRuntime.installSportRuntime(window);
  }
  if (key === 'trip') {
    const [tripDocumentView, tripExpenseDetailView, tripRecapView] = await Promise.all([
      deferredModules.load('tripDocumentView'),
      deferredModules.load('tripExpenseDetailView'),
      deferredModules.load('tripRecapView'),
    ]);
    window.UI.tripDocumentView = {
      ...(window.UI.tripDocumentView || {}),
      ...tripDocumentView,
    };
    window.UI.tripExpenseDetailView = {
      ...(window.UI.tripExpenseDetailView || {}),
      ...tripExpenseDetailView,
    };
    window.UI.tripRecapView = {
      ...(window.UI.tripRecapView || {}),
      ...tripRecapView,
    };
  }
  if (key === 'inbox') {
    const inboxView = await deferredModules.load('inboxView');
    window.UI.inboxView = {
      ...(window.UI.inboxView || {}),
      ...inboxView,
    };
  }
  return true;
});

function ensureDomainModules(domain) {
  return domainModules.load(String(domain || '').trim());
}

async function boot() {
  ensureKpiView();
  window.tbOpenAccounting = async function tbOpenAccounting() {
    const runtime = await deferredModules.load('accountingController');
    runtime.installAccountingRuntime(window);
    if (window.activeView === 'accounting') await window.renderAccounting();
  };
  window.tbLoadLegacyDomain = function tbLoadLegacyDomain(domain) {
    const key = String(domain || '').trim();
    const scripts = LEGACY_DOMAIN_SCRIPTS[key];
    if (!scripts) return Promise.resolve(false);
    return legacyDomainLoader.load(key);
  };
  window.tbIsLegacyDomainLoaded = function tbIsLegacyDomainLoaded(domain) {
    const key = String(domain || '').trim();
    return legacyDomainLoader.isLoaded(key);
  };
  window.tbEnsureCashflowCurve = function tbEnsureCashflowCurve(reason) {
    if (!window.sbUser) return Promise.resolve(false);
    const currentView = String(window.activeView || '').trim();
    if (currentView && currentView !== 'dashboard') return Promise.resolve(false);
    if (typeof window.tbRequestCashflowCurveRender === 'function') {
      window.tbRequestCashflowCurveRender(reason || 'ensure');
      return Promise.resolve(true);
    }
    if (typeof window.renderCashflowChart === 'function') {
      window.renderCashflowChart();
      return Promise.resolve(true);
    }
    return window.tbLoadLegacyDomain('cashflow').then(() => {
      if (typeof window.tbRequestCashflowCurveRender === 'function') {
        window.tbRequestCashflowCurveRender(reason || 'ensure:lazy');
        return true;
      }
      if (typeof window.renderCashflowChart === 'function') {
        window.renderCashflowChart();
        return true;
      }
      return false;
    });
  };

  await waitForBridgeReady();
  await loadScript(`/vendor/${vendorLibraries.supabase.file}`);
  for (const src of BOOT_LEGACY_SCRIPTS) {
    // eslint-disable-next-line no-await-in-loop
    try {
      await loadScript(src);
    } catch (e) {
      if (OPTIONAL_SCRIPTS.has(src)) {
        console.warn('[TB] Optional legacy script missing:', src);
        continue;
      }
      throw e;
    }
  }
  performance.mark('tb:legacy-ready');
  window.__tbBootReady = true;
}

boot().catch((err) => {
  console.error('[TB V9] Fatal boot error', err);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:#111;color:#fff;padding:16px;font-family:system-ui;z-index:99999;overflow:auto;';
  el.textContent = `TravelBudget boot failed\n${String(err?.stack || err)}`;
  document.body.appendChild(el);
});
