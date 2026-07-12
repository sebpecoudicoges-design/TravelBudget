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
});
