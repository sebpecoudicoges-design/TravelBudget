import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('KPI view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/11_kpi_render_micro_animation.js', 'utf8');
  const controller = fs.readFileSync('public/legacy/js/11_kpi_controller.js', 'utf8');
  const module = fs.readFileSync('src/features/kpi/kpiView.js', 'utf8');
  const healthRules = fs.readFileSync('src/features/kpi/kpiHealthRules.js', 'utf8');
  const projectionRules = fs.readFileSync('src/features/kpi/kpiProjectionRules.js', 'utf8');
  const cashRules = fs.readFileSync('src/features/kpi/kpiCashRules.js', 'utf8');

  it('exposes the KPI view module to the legacy runtime', () => {
    expect(main).toContain("import('./features/kpi/kpiView.js')");
    expect(main).toContain("import('./features/kpi/kpiHealthRules.js')");
    expect(main).toContain("import('./features/kpi/kpiProjectionRules.js')");
    expect(main).toContain("import('./features/kpi/kpiCashRules.js')");
    expect(main).toContain("'/legacy/js/11_kpi_controller.js'");
    expect(main).not.toContain("import('./features/kpi/kpiController.js')");
    expect(main).toContain('async function ensureKpiView()');
    expect(main).toContain('ensureKpiView();');
    expect(main).not.toContain('await ensureKpiView();');
    expect(main).toContain('window.TBKpiView');
    expect(main).toContain('window.TBKpiHealthRules');
    expect(main).toContain('window.TBKpiProjectionRules');
    expect(main).toContain('window.TBKpiCashRules');
    expect(main).toContain('...kpiView');
    expect(main).toContain('...kpiHealthRules');
    expect(main).toContain('...kpiProjectionRules');
    expect(main).toContain('...kpiCashRules');
  });

  it('delegates KPI health and transaction rules to a tested module', () => {
    expect(healthRules).toContain('export function healthSummaryForDate');
    expect(healthRules).toContain('export function isCashPendingProjectionTx');
    expect(legacy).toContain('window.TBKpiHealthRules?.healthSummaryForDate');
    expect(legacy).toContain('window.TBKpiHealthRules?.isCashPendingProjectionTx');
    expect(legacy).toContain('window.TBKpiHealthRules?.txAffectsBudget');
    expect(legacy).not.toContain('const kcalFreeBand = Math.max(260');
    expect(legacy).not.toContain('const alcoholScore = alcoholDrinks > 2.01');
    expect(legacy).not.toContain('const type = String(tx?.type ||');
    expect(legacy).not.toContain('const isAlcohol = tags.some');
  });

  it('delegates KPI projection, scope and pending rules to a tested module', () => {
    expect(projectionRules).toContain('export function pendingProjectionItems');
    expect(projectionRules).toContain('export function parseKpiScope');
    expect(projectionRules).toContain('export function daysPill');
    expect(legacy).toContain('window.TBKpiProjectionRules?.pendingProjectionItems');
    expect(legacy).toContain('window.TBKpiProjectionRules?.resolveKpiRange');
    expect(legacy).toContain('window.TBKpiProjectionRules?.daysPill');
    expect(legacy).not.toContain('const grouped = new Map();');
    expect(legacy).not.toContain('const thresholds = { warn: 7, urgent: 4, critical: 2 };');
    expect(legacy).not.toContain('if (s.startsWith("range:"))');
  });

  it('delegates KPI cash runway and conservative cover rules to a tested module', () => {
    expect(cashRules).toContain('export function cashRunwayInfo');
    expect(cashRules).toContain('export function cashConservativeInfo');
    expect(legacy).toContain('window.TBKpiCashRules?.cashRunwayInfo');
    expect(legacy).toContain('window.TBKpiCashRules?.cashConservativeInfo');
    expect(legacy).toContain('window.TBKpiCashRules?.sumCashWalletsBase');
    expect(legacy).not.toContain('const cashWalletIds = new Set(cashWallets.map');
    expect(legacy).not.toContain('let sumExpenseBase = 0;');
    expect(legacy).not.toContain('let sumAllocated = 0;');
  });

  it('does not let the extracted KPI view block mobile boot', () => {
    const module = fs.readFileSync('src/features/kpi/kpiView.js', 'utf8');

    expect(main).toContain('function ensureKpiStylesheet()');
    expect(main).toContain("./legacy/css/kpi_view.css");
    expect(main).toContain('.catch((error)');
    expect(main).toContain("console.error('[TB][boot] KPI view load failed'");
    expect(main).toContain('return false;');
    expect(module).not.toContain("import './kpiView.css'");
  });

  it('delegates the visual health card and responsive styles', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiResponsiveStyles');
    expect(legacy).toContain('window.TBKpiView?.renderKpiCards');
    expect(module).toContain('renderKpiHealthCard({ healthToday, healthActions');
    expect(legacy).not.toContain('nutritionGoalMode === "bulk" ?');
    expect(legacy).not.toContain('healthActions.map(row =>');
    expect(legacy).not.toContain('.kpi-health-action.good {');
  });

  it('delegates pending projection detail rendering', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiPendingDetail');
    expect(legacy).toContain('window.TBKpiView?.renderKpiCards');
    expect(module).toContain('renderKpiPendingToggle({ esc: safe');
    expect(legacy).toContain('amountText: _pendingAmountText');
    expect(legacy).not.toContain('shown.map((it)');
    expect(legacy).not.toContain('<details class="kpi-pending-detail">');
    expect(legacy).not.toContain('<input id="kpiIncludeUnpaidToggle"');
    expect(legacy).not.toContain('Math.round(pendingDisplay)');
  });

  it('delegates repeated KPI mini cards', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiCards');
    expect(module).toContain('export function renderKpiCards');
    expect(module).toContain('renderKpiMiniCard({ esc: safe, ...card })');
    expect(module).toContain('renderKpiPendingToggle({ esc: safe');
    expect(legacy).not.toContain('const renderKpiMiniCard = (opts)');
    expect(legacy).not.toContain('renderKpiMiniCard({ title: T("kpi.available_budget")');
    expect(legacy).not.toContain('<div class="muted" style="font-size:12px;">${T("kpi.available_budget")}</div>');
    expect(legacy).not.toContain('<div class="muted" style="font-size:12px;">Sport fait</div>');
    expect(legacy).not.toContain('<div class="muted" style="font-size:12px;">Travail fait</div>');
  });

  it('delegates the KPI today steering panel', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiMainLayout');
    expect(legacy).toContain('window.TBKpiView?.renderKpiTodayPanel');
    expect(legacy).toContain('todayDetailsHtml: todayDetailsHTML');
    expect(legacy).toContain('signPillClass: _signPillClass');
    expect(legacy).not.toContain('<div class="kpi-layout"');
    expect(legacy).not.toContain('<div class="kpi-mini-grid"');
    expect(legacy).not.toContain('<!-- RIGHT: Today details -->');
    expect(legacy).not.toContain('${pilot ? `');
    expect(legacy).not.toContain('<div class="muted" style="font-size:12px;">Cash</div>');
  });

  it('delegates the KPI today budget detail rendering', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiTodayDetails');
    expect(legacy).toContain('rows: details');
    expect(legacy).toContain('fallbackBase');
    expect(legacy).not.toContain('escapeHtml(x.label)');
    expect(legacy).not.toContain('details.map(x =>');
    expect(legacy).not.toContain('function escapeHtml(str)');
  });

  it('delegates the KPI header and FX calculator rendering', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiHeader');
    expect(legacy).toContain('window.TBKpiView?.renderKpiTravelOption');
    expect(legacy).toContain('window.TBKpiView?.renderKpiScopeOptions');
    expect(legacy).toContain('travelOptionHtml: travelOptionHTML');
    expect(legacy).toContain('scopeOptionsHtml: scopeOptionsHTML');
    expect(legacy).toContain('window.TBKpiView?.renderKpiCards');
    expect(module).toContain('renderKpiFxCalculator({ title: fxCalculatorTitle');
    expect(legacy).not.toContain('<select id="kpiPeriodSelect" disabled');
    expect(legacy).not.toContain('<input id="kpiFxCalcAmount"');
    expect(legacy).not.toContain('<option value="${escapeHTML(activeTravelValue)}" selected>');
    expect(legacy).not.toContain('..._segs.map((s, idx)');
    expect(legacy).not.toContain('<option value="seg:${id}">');
  });

  it('delegates KPI interaction bindings to the modular controller', () => {
    expect(legacy).toContain('window.TBKpiView?.bindKpiInteractions');
    expect(legacy).toContain('parseScope: _kpiParseScope');
    expect(legacy).toContain('resolveRange: _kpiResolveRange');
    expect(controller).toContain('function bindKpiInteractions');
    expect(controller).toContain('function bindKpiRangeControls');
    expect(controller).toContain('function bindKpiScopeSelector');
    expect(controller).toContain('function bindKpiFxCalculator');
    expect(controller).toContain('window.TBKpiView = {');
    expect(legacy).not.toContain('const saveRange = (opts = {}) =>');
    expect(legacy).not.toContain('selS.addEventListener("change"');
    expect(legacy).not.toContain('const curSet = new Set(["EUR"])');
    expect(legacy).not.toContain('sEl.addEventListener("click"');
  });
});
