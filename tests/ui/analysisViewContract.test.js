import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Analysis view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const runtime = fs.readFileSync('src/features/analysis/analysisRuntime.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/33_budget_analysis.js', 'utf8');
  const filterView = fs.readFileSync('public/legacy/js/33_analysis_filter_view.js', 'utf8');

  it('exposes the Analysis view module to the legacy runtime on demand', () => {
    expect(main).toContain("import('./features/analysis/analysisRuntime.js')");
    expect(main).toContain('function ensureAnalysisModules()');
    expect(runtime).toContain("import * as analysisView from './analysisView.js'");
    expect(runtime).toContain('target.TBAnalysisView');
    expect(runtime).toContain('...analysisView');
  });

  it('exposes the Analysis chart option module to the legacy runtime on demand', () => {
    expect(main).toContain("import('./features/analysis/analysisRuntime.js')");
    expect(main).toContain("if (key === 'analysis') await ensureAnalysisModules();");
    expect(runtime).toContain("import * as analysisChartOptions from './analysisChartOptions.js'");
    expect(runtime).toContain('target.TBAnalysisCharts');
    expect(runtime).toContain('...analysisChartOptions');
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

  it('keeps the Analysis progress cards delegated out of the legacy file', () => {
    expect(legacy).toContain('progressView?.renderAnalysisProgressPanels');
    expect(runtime).toContain('...analysisView');
    expect(legacy).not.toContain('const renderGlassCard');
    expect(legacy).not.toContain('const renderDeltaCard');
    expect(legacy).not.toContain('analysis-stat--glass-${escapeHTML');
  });

  it('keeps the Analysis cashflow panels delegated out of the legacy file', () => {
    expect(legacy).toContain('progressView?.renderAnalysisCashflowBlock');
    expect(legacy).toContain('progressView?.renderAnalysisCashOnlyBlock');
    expect(main).toContain("'/legacy/js/33_analysis_filter_view.js'");
    expect(filterView).toContain('renderAnalysisCashflowBlock');
    expect(filterView).toContain('renderAnalysisCashOnlyBlock');
    expect(filterView).toContain('analysis-stat--cashflow');
    expect(filterView).toContain('analysis-stat--cash-only');
    expect(legacy).not.toContain('const cashIn = _safeNum(model.incomeReal)');
    expect(legacy).not.toContain('analysis-stat--cashflow"');
    expect(legacy).not.toContain('analysis-stat--cash-only"');
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
