import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('KPI view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/11_kpi_render_micro_animation.js', 'utf8');

  it('exposes the KPI view module to the legacy runtime', () => {
    expect(main).toContain("import('./features/kpi/kpiView.js')");
    expect(main).toContain('async function ensureKpiView()');
    expect(main).toContain('await ensureKpiView();');
    expect(main).toContain('window.TBKpiView');
    expect(main).toContain('...kpiView');
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
});
