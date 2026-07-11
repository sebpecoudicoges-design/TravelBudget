import pkg from '../package.json';
import './app/bridge.js';
import { registerPwa } from './app/pwa.js';
import * as budgetAnalysisRules from './core/budgetAnalysisRules.js';

const TB_APP_VERSION = String(pkg?.version || 'dev');
window.TB_VERSION = window.TB_VERSION || TB_APP_VERSION;
window.TB_BUILD_LABEL = window.TB_BUILD_LABEL || `V${window.TB_VERSION}`;
window.TBCore = {
  ...(window.TBCore || {}),
  budgetAnalysisRules,
};

console.log(`TB BUILD ${window.TB_VERSION}`);
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
  '/legacy/js/06_travel_context.js',
  '/legacy/js/06_allocations.js',
  '/legacy/js/07_supabase_bootstrap.js',
  '/legacy/js/09_fx.js',
  '/legacy/js/09_fx_snapshot.js',
  '/legacy/js/26_fx_crossrate.js',
  '/legacy/js/24_tx_fx_snapshot.js',
  '/legacy/js/28_data_updated_bus.js',
  '/legacy/js/27_cashflow_curve.js',
  '/legacy/js/10_navigation.js',
  '/legacy/js/31_help_faq.js',
  '/legacy/js/32_help_assistant.js',
  '/legacy/js/35_guided_tour.js',
  '/legacy/js/11_kpi_render_micro_animation.js',
  '/legacy/js/12_dashboard_render.js',
  '/legacy/js/34_fx_decision.js',
  '/legacy/js/16_modal_add_edit_via_rpc.js',
  '/legacy/js/13_transactions_view.js',
  '/legacy/js/14_settings_periods_ui.js',
  '/legacy/js/15_recurring_rules_ui.js',
  '/legacy/js/15_wallet_adjust.js',
  '/legacy/js/17_internal_transfers.js',
  '/legacy/js/17_charts.js',
  '/legacy/js/33_budget_analysis.js',
  '/legacy/js/44_inbox_ui.js',
  '/legacy/js/18_main_render.js',
  '/legacy/js/08_refresh.js',
  '/legacy/js/19_backup_export_import.js',
  '/legacy/js/25_health_check.js',
  '/legacy/js/99_doctor.js',
  '/legacy/js/20_boot.js',
  '/legacy/js/21_dashboard_drag.js',
  '/legacy/js/22_budget_consistency_audit.js',
  '/legacy/js/31_wallet_balance.js'
];

const OPTIONAL_SCRIPTS = new Set(['/legacy/js/00_perf.js']);
const LEGACY_DOMAIN_SCRIPTS = {
  assets: [
    '/legacy/js/41_assets_core.js',
    '/legacy/js/42_assets_ui.js',
  ],
  cautions: [
    '/legacy/js/46_cautions_ui.js',
  ],
  documents: [
    '/legacy/js/43_documents_ui.js',
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
const legacyDomainPromises = new Map();

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // enforce execution order
    s.onload = () => resolve(src);
    s.onerror = () => reject(new Error(`Failed to load legacy script: ${src}`));
    document.head.appendChild(s);
  });
}

async function boot() {
  // Simple marker for debugging
  window.__TB_BUILD__ = window.__TB_BUILD__ || {};
  window.__TB_BUILD__.entry = `v9-vite-legacy-loader-${window.TB_VERSION}`;
  window.__TB_BUILD__.version = window.TB_VERSION;
  window.__TB_BUILD__.loadedAt = new Date().toISOString();

  window.tbLoadLegacyDomain = function tbLoadLegacyDomain(domain) {
    const key = String(domain || '').trim();
    const scripts = LEGACY_DOMAIN_SCRIPTS[key];
    if (!scripts) return Promise.resolve(false);
    if (legacyDomainPromises.has(key)) return legacyDomainPromises.get(key);
    const promise = (async () => {
      for (const src of scripts) {
        // eslint-disable-next-line no-await-in-loop
        await loadScript(src);
      }
      return true;
    })();
    legacyDomainPromises.set(key, promise);
    return promise;
  };
  window.tbIsLegacyDomainLoaded = function tbIsLegacyDomainLoaded(domain) {
    const key = String(domain || '').trim();
    return legacyDomainPromises.has(key);
  };

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
}

boot().catch((err) => {
  console.error('[TB V9] Fatal boot error', err);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:#111;color:#fff;padding:16px;font-family:system-ui;z-index:99999;overflow:auto;';
  const title = document.createElement('h2');
  title.textContent = 'TravelBudget boot failed';
  const details = document.createElement('pre');
  details.textContent = String(err?.stack || err);
  el.append(title, details);
  document.body.appendChild(el);
});
