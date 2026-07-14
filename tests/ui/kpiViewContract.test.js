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
});
