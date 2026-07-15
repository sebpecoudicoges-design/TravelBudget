import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('KPI range picker contract', () => {
  const legacy = fs.readFileSync('public/legacy/js/11_kpi_render_micro_animation.js', 'utf8');
  const view = fs.readFileSync('src/features/kpi/kpiView.js', 'utf8');

  it('keeps date range selection stable until the user applies it', () => {
    expect(view).toContain('id="kpiRangeApply"');
    expect(view).toContain('data-kpi-range-box="1"');
    expect(legacy).toContain('box.addEventListener("pointerdown"');
    expect(legacy).toContain('if (applyEl) applyEl.addEventListener("click", () => saveRange({ apply: true }))');
    expect(legacy).toContain('if (opts.apply)');
  });

  it('does not rerender KPI immediately when switching into range mode', () => {
    expect(legacy).toContain('if (v === "range")');
    expect(legacy).toContain('return;');
    expect(legacy).toContain('try { if (typeof renderKPI === "function") renderKPI(); } catch (_) {}');
  });

  it('uses the shared activity calorie source for Sport and Work KPI totals', () => {
    expect(legacy).toContain('window.tbEnsureActivityData({ reason: "kpi" })');
    expect(legacy).toContain('window.__TB_KPI_ACTIVITY_LOADING__');
    expect(legacy).toContain('typeof window.tbActivityKcalForDay === "function"');
    expect(legacy).toContain('window.tbActivityKcalForDay(day)');
    expect(legacy).toContain('activityKcal?.sportKcal');
    expect(legacy).toContain('activityKcal?.workKcal');
  });
});
