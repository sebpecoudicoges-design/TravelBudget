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
    expect(option.legend.data).toEqual(['Dépenses cumulées', 'Cible cumulée']);
    const planned = buildAnalysisTrajectoryOption({ model, labels: { spent: 'Cumul avec prévisions', target: 'Objectif cumulé' } });
    expect(planned.series.map(({ name }) => name)).toEqual(['Objectif cumulé', 'Cumul avec prévisions']);
    expect(planned.series.map(({ data }) => data)).toEqual([model.cumTarget, model.cumSpent]);
    expect(option.xAxis.data).toEqual(['07-01', '07-02']);
    expect(option.series[0].markLine.data[0].xAxis).toBe('07-02');
    expect(option.series[1].markPoint.data[0].coord).toEqual([1, 55]);
  });

  it('computes proportional slices from all positive net categories and groups the rest', () => {
    const categorySeries = [
      ...[31, 10, 10, 10, 10, 10, 10, 5, 3, 1].map((actual, idx) => ({
        name: idx === 0 ? 'Autres' : `Cat ${idx + 1}`, actual, color: '#f97316',
      })),
      { name: 'Zero', actual: 0 },
      { name: 'Credit', actual: -20 },
    ];
    const option = buildAnalysisCategoryPieOption({ model: { base: 'AUD', categorySeries }, theme, formatCurrency });
    const { data, roseType } = option.series[0];

    expect(roseType).toBeUndefined();
    expect(data).toHaveLength(9);
    expect(data[0]).toMatchObject({ name: 'Autres', value: 31, itemStyle: { color: '#f97316' } });
    expect(data.at(-1)).toMatchObject({ grouped: true, value: 4 });
    expect(data.reduce((sum, row) => sum + row.value, 0)).toBe(100);
    expect(option.tooltip.formatter({ name: 'Autres', value: 31, percent: 31 })).toContain('31 AUD • 31%');
  });

  it('does not invent a pie slice when there are no positive net categories', () => {
    const option = buildAnalysisCategoryPieOption({
      model: { categorySeries: [{ name: 'Credit', actual: -2 }, { name: 'Zero', actual: 0 }] }, theme,
    });
    expect(option.series[0].data).toEqual([]);
  });

  it('builds horizontal bars for every category and preserves negative net amounts', () => {
    const model = {
      base: 'AUD',
      categorySeries: Array.from({ length: 13 }, (_, idx) => ({
        name: `Cat ${idx + 1}`,
        actual: idx === 12 ? -12.49 : 12 - idx + 0.49,
        color: '#2563eb',
      })),
    };

    const option = buildAnalysisCategoryBarsOption({ model, theme, formatCurrency });

    expect(option.yAxis.data).toHaveLength(13);
    expect(option.yAxis.data[0]).toBe('Cat 13');
    expect(option.yAxis.data.at(-1)).toBe('Cat 1');
    expect(option.series[0].data[0].value).toBe(-12.49);
    expect(option.tooltip.formatter([{ axisValue: 'Cat 13', value: -12.49 }])).toContain('-12 AUD');
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
    expect(velocity.legend.data).toEqual(['Dépenses du jour', 'Budget moyen/jour']);
    expect(velocity.series[1].name).toBe('Budget moyen/jour');
    expect(velocity.series[1].data).toEqual([20, 20]);
    expect(heatmap.visualMap.max).toBe(24);
    expect(heatmap.tooltip.formatter({ data: [1, 0, 24] })).toContain('2026-07-02');
  });
});
