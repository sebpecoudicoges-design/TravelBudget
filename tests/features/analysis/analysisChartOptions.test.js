import { describe, expect, it } from 'vitest';

import {
  buildAnalysisCategoryBarsOption,
  buildAnalysisCategoryPieOption,
  buildAnalysisHeatmapOption,
  buildAnalysisTrajectoryMeta,
  buildAnalysisTrajectoryOption,
  buildAnalysisVelocityOption,
} from '../../../src/features/analysis/analysisChartOptions.js';

describe('Analysis chart option builders', () => {
  const theme = {
    text: '#111827',
    muted: '#64748b',
    grid: 'rgba(148,163,184,.18)',
    accent: '#2563eb',
    good: '#16a34a',
    warn: '#f59e0b',
  };
  const formatCurrency = (value, currency) => `${Number(value).toFixed(0)} ${currency}`;

  it('builds trajectory metadata and cumulative chart options', () => {
    const model = {
      start: '2026-07-01',
      end: '2026-07-02',
      base: 'aud',
      days: ['2026-07-01', '2026-07-02'],
      cumTarget: [30, 60],
      cumSpent: [20, 55],
    };

    const meta = buildAnalysisTrajectoryMeta(model);
    const option = buildAnalysisTrajectoryOption({ model, todayLabel: '07-02', theme, formatCurrency });

    expect(meta).toEqual({ start: '2026-07-01', end: '2026-07-02', days: 2, currency: 'AUD' });
    expect(option.legend.data).toEqual(['Réel cumulé', 'Cible cumulée']);
    expect(option.xAxis.data).toEqual(['07-01', '07-02']);
    expect(option.series[0].markLine.data[0].xAxis).toBe('07-02');
    expect(option.series[1].markPoint.data[0].coord).toEqual([1, 55]);
  });

  it('builds category pie options with empty and populated states', () => {
    const model = { base: 'AUD', topCategories: [['Food', 42.12]] };
    const option = buildAnalysisCategoryPieOption({
      model,
      categoryColor: (name) => (name === 'Food' ? '#f97316' : '#2563eb'),
      theme,
      formatCurrency,
    });

    expect(option.series[0].roseType).toBe('area');
    expect(option.series[0].data[0]).toMatchObject({ name: 'Food', value: 42.12 });
    expect(option.tooltip.formatter({ name: 'Food', value: 42.12, percent: 33 })).toContain('42 AUD');

    const empty = buildAnalysisCategoryPieOption({ model: { topCategories: [] }, theme });
    expect(empty.series[0].data[0].name).toBe('Aucune dépense');
  });

  it('builds horizontal category bars from the top categories only', () => {
    const model = {
      base: 'AUD',
      categorySeries: Array.from({ length: 13 }, (_, idx) => ({
        name: `Cat ${idx + 1}`,
        actual: idx + 0.49,
        color: '#2563eb',
      })),
    };

    const option = buildAnalysisCategoryBarsOption({ model, theme, formatCurrency });

    expect(option.yAxis.data).toHaveLength(12);
    expect(option.yAxis.data[0]).toBe('Cat 12');
    expect(option.series[0].data[0].value).toBe(11.49);
    expect(option.tooltip.formatter([{ axisValue: 'Cat 12', value: 11.49 }])).toContain('11 AUD');
  });

  it('builds velocity and heatmap options from daily analysis data', () => {
    const model = {
      base: 'AUD',
      days: ['2026-07-01', '2026-07-02'],
      velocity: [12, 24],
      budgetPerDay: 20,
      heat: [[0, 0, 12], [1, 0, 24]],
    };

    const velocity = buildAnalysisVelocityOption({ model, theme, formatCurrency });
    const heatmap = buildAnalysisHeatmapOption({ model, theme, formatCurrency });

    expect(velocity.series[0].type).toBe('bar');
    expect(velocity.series[1].lineStyle.type).toBe('dashed');
    expect(velocity.series[1].data).toEqual([20, 20]);
    expect(heatmap.visualMap.max).toBe(24);
    expect(heatmap.tooltip.formatter({ data: [1, 0, 24] })).toContain('2026-07-02');
  });
});
