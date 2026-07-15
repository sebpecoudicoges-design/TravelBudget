import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('KPI view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/11_kpi_render_micro_animation.js', 'utf8');

  it('exposes the KPI view module to the legacy runtime', () => {
    expect(main).toContain("import('./features/kpi/kpiView.js')");
    expect(main).toContain('async function ensureKpiView()');
    expect(main).toContain('ensureKpiView();');
    expect(main).not.toContain('await ensureKpiView();');
    expect(main).toContain('window.TBKpiView');
    expect(main).toContain('...kpiView');
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
    expect(legacy).toContain('window.TBKpiView?.renderKpiHealthCard');
    expect(legacy).not.toContain('nutritionGoalMode === "bulk" ?');
    expect(legacy).not.toContain('healthActions.map(row =>');
    expect(legacy).not.toContain('.kpi-health-action.good {');
  });

  it('delegates pending projection detail rendering', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiPendingDetail');
    expect(legacy).toContain('amountText: _pendingAmountText');
    expect(legacy).not.toContain('shown.map((it)');
    expect(legacy).not.toContain('<details class="kpi-pending-detail">');
  });

  it('delegates repeated KPI mini cards', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiMiniCard');
    expect(legacy).toContain('renderKpiMiniCard({ title: T("kpi.available_budget")');
    expect(legacy).not.toContain('<div class="muted" style="font-size:12px;">${T("kpi.available_budget")}</div>');
    expect(legacy).not.toContain('<div class="muted" style="font-size:12px;">Sport fait</div>');
    expect(legacy).not.toContain('<div class="muted" style="font-size:12px;">Travail fait</div>');
  });

  it('delegates the KPI today steering panel', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiTodayPanel');
    expect(legacy).toContain('todayDetailsHtml: todayDetailsHTML');
    expect(legacy).toContain('signPillClass: _signPillClass');
    expect(legacy).not.toContain('<!-- RIGHT: Today details -->');
    expect(legacy).not.toContain('${pilot ? `');
    expect(legacy).not.toContain('<div class="muted" style="font-size:12px;">Cash</div>');
  });

  it('delegates the KPI header and FX calculator rendering', () => {
    expect(legacy).toContain('window.TBKpiView?.renderKpiHeader');
    expect(legacy).toContain('travelOptionHtml: travelOptionHTML');
    expect(legacy).toContain('scopeOptionsHtml: scopeOptionsHTML');
    expect(legacy).toContain('window.TBKpiView?.renderKpiFxCalculator');
    expect(legacy).not.toContain('<select id="kpiPeriodSelect" disabled');
    expect(legacy).not.toContain('<input id="kpiFxCalcAmount"');
  });
});
