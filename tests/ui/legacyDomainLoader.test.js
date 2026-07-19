import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('legacy domain loader', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const navigation = fs.readFileSync('public/legacy/js/10_navigation.js', 'utf8');
  const offlineQueue = fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8');
  const assetsUi = fs.readFileSync('public/legacy/js/42_assets_ui.js', 'utf8');
  const inboxUi = fs.readFileSync('public/legacy/js/44_inbox_ui.js', 'utf8');
  const analysis = fs.readFileSync('public/legacy/js/33_budget_analysis.js', 'utf8');
  const bootstrap = fs.readFileSync('public/legacy/js/07_supabase_bootstrap.js', 'utf8');
  const bridge = fs.readFileSync('src/app/bridge.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');

  it('keeps startup focused on global shell, Dashboard and Settings while deferring heavy domains', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    for (const startupScript of [
      '/legacy/js/10_navigation.js',
      '/legacy/js/11_kpi_render_micro_animation.js',
      '/legacy/js/12_dashboard_render.js',
      '/legacy/js/14_settings_periods_ui.js',
      '/legacy/js/18_main_render.js',
      '/legacy/js/20_boot.js',
    ]) {
      expect(bootList).toContain(startupScript);
      expect(domains).not.toContain(startupScript);
    }

    for (const deferredScript of [
      '/legacy/js/29_trip_v1.js',
      '/legacy/js/30_members_admin.js',
      '/legacy/js/34_fx_decision.js',
      '/legacy/js/45_sport_ui.js',
      '/legacy/js/47_work_ui.js',
      '/legacy/js/48_nutrition_ui.js',
      '/legacy/js/50_work_career_ui.js',
    ]) {
      expect(bootList).not.toContain(deferredScript);
      expect(domains).toContain(deferredScript);
    }
  });

  it('keeps Assets out of the boot legacy list and registers it as a deferred domain', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/41_assets_core.js');
    expect(bootList).not.toContain('/legacy/js/42_assets_ui.js');
    expect(domains).toContain('assets:');
    expect(domains).toContain('/legacy/js/41_assets_core.js');
    expect(domains).toContain('/legacy/js/42_assets_ui.js');
    expect(main).toContain('window.tbLoadLegacyDomain');
  });

  it('keeps Cashflow out of boot and lazy-loads it when Dashboard needs the curve', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/27_cashflow_curve.js');
    expect(domains).toContain('cashflow:');
    expect(domains).toContain('/legacy/js/27_cashflow_curve.js');
    expect(main).toContain('window.tbEnsureCashflowCurve');
    expect(main).toContain("window.tbLoadLegacyDomain('cashflow')");
    expect(navigation).toContain('window.tbEnsureCashflowCurve("navigation:dashboard")');
  });

  it('keeps FX decision out of boot and loads it with the Analysis domain', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/34_fx_decision.js');
    expect(domains).toContain('analysis:');
    expect(domains).toContain('/legacy/js/34_fx_decision.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("analysis")');
    expect(navigation).toContain('window.renderFxDecision(false)');
  });

  it('waits for the Vite bridge before loading boot or deferred legacy scripts', () => {
    expect(bridge).toContain('window.__tbBridgeReady = true');
    expect(bridge).toContain("new CustomEvent('tb:bridge_ready')");
    expect(main).toContain('function waitForBridgeReady()');
    expect(main).toContain('window.Data?.createMutationQueueStore');
    expect(main).toContain('window.Data?.createTripStore');
    expect(main).toContain('window.Core?.sportCatalog');

    const domainLoader = main.slice(main.indexOf('window.tbLoadLegacyDomain'), main.indexOf('window.tbIsLegacyDomainLoaded'));
    expect(domainLoader).toContain('await waitForBridgeReady();');

    const bootLoader = main.slice(main.indexOf('await waitForBridgeReady();'), main.indexOf('boot().catch'));
    expect(bootLoader).toContain('for (const src of BOOT_LEGACY_SCRIPTS)');
    expect(bootLoader.indexOf('await waitForBridgeReady();')).toBeLessThan(bootLoader.indexOf('for (const src of BOOT_LEGACY_SCRIPTS)'));
  });

  it('loads the Assets domain before rendering the Assets view when needed', () => {
    expect(navigation).toContain('window.tbLoadLegacyDomain("assets")');
    expect(navigation).toContain('renderAssets("navigation:lazy")');
  });

  it('keeps Cautions out of boot and lazy-loads it before rendering the Cautions view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/46_cautions_ui.js');
    expect(domains).toContain('cautions:');
    expect(domains).toContain('/legacy/js/46_cautions_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("cautions")');
    expect(navigation).toContain('renderCautions("navigation:lazy")');
    expect(index).toContain('id="tab-cautions"');
    expect(index).toContain('id="view-cautions"');
    expect(index).toContain('id="cautions-root"');
  });

  it('keeps Documents out of boot and lazy-loads it before rendering the Documents view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/43_documents_ui.js');
    expect(domains).toContain('documents:');
    expect(domains).toContain('/legacy/js/43_documents_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("documents")');
    expect(navigation).toContain('renderDocuments("navigation:lazy")');
    expect(index).toContain('id="tab-documents"');
    expect(index).toContain('id="view-documents"');
    expect(index).toContain('id="documents-root"');
    expect(assetsUi).toContain("await window.tbLoadLegacyDomain('documents')");
    expect(assetsUi).toContain('window.tbDocumentsPreview?.(docId)');
    expect(inboxUi).toContain("await window.tbLoadLegacyDomain('documents')");
    expect(inboxUi).toContain("window.renderDocuments('inbox-classified')");
  });

  it('keeps Help FAQ out of boot while preserving the global assistant and guide at startup', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/31_help_faq.js');
    expect(bootList).toContain('/legacy/js/32_help_assistant.js');
    expect(bootList).toContain('/legacy/js/35_guided_tour.js');
    expect(domains).toContain('help:');
    expect(domains).toContain('/legacy/js/31_help_faq.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("help")');
    expect(navigation).toContain('window.renderHelpFaq("navigation:lazy")');
    expect(index).toContain('id="tab-help"');
    expect(index).toContain('id="view-help"');
    expect(index).toContain('id="help-root"');
  });

  it('keeps Nutrition out of boot and lazy-loads it before rendering the Nutrition view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/48_nutrition_ui.js');
    expect(domains).toContain('nutrition:');
    expect(domains).toContain('/legacy/js/48_nutrition_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("nutrition")');
    expect(navigation).toContain('renderNutrition("navigation:lazy")');
    expect(index).toContain('id="tab-nutrition"');
    expect(index).toContain('id="view-nutrition"');
    expect(index).toContain('id="nutrition-root"');
  });

  it('keeps Work out of boot and lazy-loads it before rendering the Work view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/47_work_ui.js');
    expect(bootList).not.toContain('/legacy/js/50_work_career_ui.js');
    expect(domains).toContain('work:');
    expect(domains).toContain('/legacy/js/47_work_ui.js');
    expect(domains).toContain('/legacy/js/50_work_career_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("work")');
    expect(navigation).toContain('renderWork("navigation:lazy")');
    expect(index).toContain('id="tab-work"');
    expect(index).toContain('id="view-work"');
    expect(index).toContain('id="work-root"');
  });

  it('keeps Trip and Members out of boot and lazy-loads them before rendering related views', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/29_trip_v1.js');
    expect(bootList).not.toContain('/legacy/js/30_members_admin.js');
    expect(domains).toContain('trip:');
    expect(domains).toContain('/legacy/js/29_trip_v1.js');
    expect(domains).toContain('/legacy/js/30_members_admin.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("trip")');
    expect(navigation).toContain('window.renderTrip("navigation:lazy")');
    expect(navigation).toContain('window.renderMembersAdmin("navigation:lazy")');
    expect(index).toContain('id="tab-trip"');
    expect(index).toContain('id="view-trip"');
    expect(index).toContain('id="trip-root"');
    expect(index).toContain('id="tab-members"');
    expect(index).toContain('id="view-members"');
    expect(index).toContain('id="members-root"');
  });

  it('keeps Sport out of boot and lazy-loads it before rendering or replaying local sync', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/45_sport_ui.js');
    expect(domains).toContain('sport:');
    expect(domains).toContain('/legacy/js/45_sport_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("sport")');
    expect(navigation).toContain('renderSport("navigation:lazy")');
    expect(offlineQueue).toContain('await window.tbLoadLegacyDomain("sport")');
    expect(offlineQueue).toContain('await window.tbSportSyncLocalWorkouts()');
    expect(index).toContain('id="tab-sport"');
    expect(index).toContain('id="view-sport"');
    expect(index).toContain('id="sport-root"');
  });

  it('keeps Notifications settings out of boot and lazy-loads them before rendering the Notifications view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/49_notifications_ui.js');
    expect(domains).toContain('notifications:');
    expect(domains).toContain('/legacy/js/49_notifications_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("notifications")');
    expect(navigation).toContain('renderNotifications("navigation:lazy")');
    expect(index).toContain('id="tab-notifications"');
    expect(index).toContain('id="view-notifications"');
    expect(index).toContain('id="notifications-root"');
  });

  it('keeps Analysis out of boot and lazy-loads it with its Vite view modules', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/33_analysis_filter_view.js');
    expect(bootList).not.toContain('/legacy/js/33_analysis_drilldown_view.js');
    expect(bootList).not.toContain('/legacy/js/33_budget_analysis.js');
    expect(domains).toContain('analysis:');
    expect(domains).toContain('/legacy/js/33_analysis_filter_view.js');
    expect(domains).toContain('/legacy/js/33_analysis_drilldown_view.js');
    expect(domains).toContain('/legacy/js/33_budget_analysis.js');
    expect(main).toContain('function ensureAnalysisModules()');
    expect(main).toContain("if (key === 'analysis') await ensureAnalysisModules();");
    expect(navigation).toContain('window.tbLoadLegacyDomain("analysis")');
    expect(navigation).toContain('await window.tbEnsureDeferredData("analysis")');
    expect(navigation).toContain('if (typeof window.renderBudgetAnalysis === "function")');
    expect(navigation).not.toContain('typeof window.renderBudgetAnalysis === "function" || typeof window.tbRequestAnalysisRender === "function"');
    expect(fs.readFileSync('public/legacy/js/00_constants.js', 'utf8')).toContain('console.info(`TB BUILD ${window.TB_VERSION}`)');
    expect(fs.readFileSync('public/legacy/js/00_constants.js', 'utf8')).toContain('window.__tbBuildLogged');
    expect(index).toContain('console.warn("TB BUILD/TB VERSION " + window.TB_VERSION)');
    expect(fs.readFileSync('public/legacy/js/08_refresh.js', 'utf8')).toContain('state.transactions.some((tx) => String(tx?.travel_id || tx?.travelId || "") === tid)');
    expect(navigation).toContain('window.tbRequestAnalysisRender("navigation")');
    expect(analysis).toContain('window.tbRequestAnalysisRender = function tbRequestAnalysisRender');
    expect(analysis).toContain("window.tbRequestAnalysisRender?.('data-loaded')");
    expect(analysis).toContain("window.tbRequestAnalysisRender?.('dom-retry')");
  });

  it('keeps a direct transaction hydration fallback for Analysis', () => {
    const refresh = fs.readFileSync('public/legacy/js/08_refresh.js', 'utf8');
    expect(refresh).toContain('window.tbEnsureActiveTravelTransactions = async function tbEnsureActiveTravelTransactions');
    expect(refresh).toContain('travelId || window.state?.activeTravelId');
    expect(refresh).toContain('String(reason || "").startsWith("analysis")');
    expect(refresh).toContain('__tbAnalysisTransactionsHydratedForTravel');
    expect(refresh).toContain('if (reason !== "analysis") await window.tbEnsureActiveTravelTransactions');
    expect(refresh).toContain('__tbActiveTravelTransactionsInFlight');
    expect(refresh).toContain('return await window.__tbActiveTravelTransactionsInFlight[tid]');
    expect(refresh).toContain('window.sbUser || window.__tbUser');
    expect(refresh).toContain('sbc.from(TB_CONST.TABLES.transactions)');
    expect(refresh).toContain('window.state.transactions = (window.state.transactions || []).filter');
    expect(refresh).toContain('active travel transactions loaded');
    expect(analysis).toContain('await window.tbEnsureActiveTravelTransactions?.("analysis", travelSel.value');
  });

  it('keeps Sport program edits in SQL and Analysis on a usable trip context', () => {
    const sport = fs.readFileSync('public/legacy/js/45_sport_ui.js', 'utf8');
    expect(sport).toContain('async function saveProgramSessionEditorToSql');
    expect(sport).toContain('.from(table("sport_program_sessions")).upsert');
    expect(sport).toContain('.from(table("sport_program_exercises")).delete().eq("session_id", sessionId)');
    expect(sport).toContain('syncLocalProgramOverridesToSql("program-load")');
    expect(analysis).toContain('for (const r of [].concat(state?.wallets || [], state?.transactions || []))');
    expect(bootstrap).toContain('const containsToday = (t) =>');
    expect(bootstrap).toContain('A manual Settings switch must stay active');
    expect(bootstrap).toContain('if (stored && travels.some((t) => t.id === stored)) return stored;');
    expect(bootstrap).toContain('if (current?.id) return current.id;');
  });
});
