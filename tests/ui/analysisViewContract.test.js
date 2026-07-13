import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Analysis view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/33_budget_analysis.js', 'utf8');

  it('exposes the Analysis view module to the legacy runtime', () => {
    expect(main).toContain("import * as analysisView from './features/analysis/analysisView.js'");
    expect(main).toContain('window.TBAnalysisView');
    expect(main).toContain('...analysisView');
  });

  it('exposes the Analysis chart option module to the legacy runtime', () => {
    expect(main).toContain("import * as analysisChartOptions from './features/analysis/analysisChartOptions.js'");
    expect(main).toContain('window.TBAnalysisCharts');
    expect(main).toContain('...analysisChartOptions');
  });

  it('keeps the Analysis overview strip delegated out of the legacy file', () => {
    expect(legacy).toContain('window.TBAnalysisView?.renderAnalysisOverviewStrip');
    expect(legacy).not.toContain('const rangeText = `${model.start');
    expect(legacy).not.toContain('analysis-overview-card--${escapeHTML(card.accent)}');
  });

  it('keeps the Analysis insights delegated out of the legacy file', () => {
    expect(legacy).toContain('analysisView?.renderAnalysisInsights');
    expect(legacy).toContain('analysisView?.buildAnalysisInsights');
    expect(legacy).not.toContain('const sourcedGap = model.comparablePerDay - model.referencePerDay');
    expect(legacy).not.toContain('analysis-insight-title');
  });

  it('keeps the Analysis night transport panel delegated out of the legacy file', () => {
    expect(legacy).toContain('window.TBAnalysisView?.renderAnalysisNightCovered');
    expect(legacy).not.toContain('Transports concernés');
    expect(legacy).not.toContain('Signal analytique uniquement');
  });

  it('keeps the Analysis subcategory breakdown delegated out of the legacy file', () => {
    expect(legacy).toContain('window.TBAnalysisView?.renderAnalysisSubcategoryBreakdown');
    expect(legacy).not.toContain('rows.map((row, idx)');
    expect(legacy).not.toContain('data-subkey="${escapeHTML(row.key)}"');
  });

  it('keeps the Analysis reference panel delegated out of the legacy file', () => {
    expect(legacy).toContain('analysisView?.renderAnalysisReferenceSummary');
    expect(legacy).toContain('analysisView?.renderAnalysisReferenceMix');
    expect(legacy).not.toContain('referenceContextLabel');
    expect(legacy).not.toContain('analysis-reference-metal--${tone}');
  });

  it('keeps the Analysis ECharts option builders delegated out of the legacy file', () => {
    expect(legacy).toContain('window.TBAnalysisCharts?.buildAnalysisTrajectoryOption');
    expect(legacy).toContain('window.TBAnalysisCharts?.buildAnalysisCategoryPieOption');
    expect(legacy).toContain('window.TBAnalysisCharts?.buildAnalysisCategoryBarsOption');
    expect(legacy).toContain('window.TBAnalysisCharts?.buildAnalysisVelocityOption');
    expect(legacy).toContain('window.TBAnalysisCharts?.buildAnalysisHeatmapOption');
    expect(legacy).not.toContain("legend: { top: 6");
    expect(legacy).not.toContain("roseType: 'area'");
    expect(legacy).not.toContain('visualMap: { min: 0');
  });
});
