import './app/bridge.js';

// TravelBudget V5 entrypoint (Vite + deterministic legacy loader)
// This preserves the original global-script semantics while removing fragile <script> ordering in index.html.

const LEGACY_SCRIPTS = [
  '/legacy/js/00_constants.js',
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
  '/legacy/js/27_cashflow_curve.js',
  '/legacy/js/10_navigation.js',
  '/legacy/js/11_kpi_render_micro_animation.js',
  '/legacy/js/12_dashboard_render.js',
  '/legacy/js/16_modal_add_edit_via_rpc.js',
  '/legacy/js/13_transactions_view.js',
  '/legacy/js/14_settings_periods_ui.js',
  '/legacy/js/15_wallet_adjust.js',
  '/legacy/js/17_charts.js',
  '/legacy/js/18_main_render.js',
  '/legacy/js/08_refresh.js',
  '/legacy/js/19_backup_export_import.js',
  '/legacy/js/25_health_check.js',
  '/legacy/js/99_doctor.js',
  '/legacy/js/20_boot.js',
  '/legacy/js/21_dashboard_drag.js',
  '/legacy/js/22_budget_consistency_audit.js',
  '/legacy/js/29_trip_v1.js',
  '/legacy/js/30_members_admin.js'
];

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
  window.__TB_BUILD__.entry = 'v5-vite-legacy-loader';
  window.__TB_BUILD__.loadedAt = new Date().toISOString();

  for (const src of LEGACY_SCRIPTS) {
    // eslint-disable-next-line no-await-in-loop
    await loadScript(src);
  }
}

boot().catch((err) => {
  console.error('[TB V5] Fatal boot error', err);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:#111;color:#fff;padding:16px;font-family:system-ui;z-index:99999;overflow:auto;';
  el.innerHTML = `<h2>TravelBudget boot failed</h2><pre>${String(err?.stack || err)}</pre>`;
  document.body.appendChild(el);
});
