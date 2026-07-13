import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

describe('Analysis transaction drilldown view contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const drilldownView = fs.readFileSync('public/legacy/js/33_analysis_drilldown_view.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/33_budget_analysis.js', 'utf8');

  function loadApi() {
    const sandbox = { window: {} };
    vm.runInNewContext(drilldownView, sandbox);
    return sandbox.window.TBAnalysisDrilldownView;
  }

  it('loads the drilldown view before the Analysis legacy page', () => {
    expect(main.indexOf('/legacy/js/33_analysis_drilldown_view.js')).toBeGreaterThan(-1);
    expect(main.indexOf('/legacy/js/33_analysis_drilldown_view.js')).toBeLessThan(main.indexOf('/legacy/js/33_budget_analysis.js'));
  });

  it('renders escaped transaction drawer rows', () => {
    const api = loadApi();
    const html = api.renderTransactionDrilldown({
      title: '<Transport>',
      total: '42 AUD',
      start: '2026-07-01',
      end: '2026-07-02',
      rows: [{
        id: 'tx-1',
        label: '<Bus>',
        budgetRange: '2026-07-01',
        visibleRange: '2026-07-01',
        cashDate: '2026-07-01',
        paidLabel: 'Payé',
        budgetLabel: 'Budget',
        tripLabel: 'Trip',
        visibleAmount: '12 AUD',
        originalAmount: '12 AUD',
      }],
    });

    expect(html).toContain('&lt;Transport&gt;');
    expect(html).toContain('&lt;Bus&gt;');
    expect(html).toContain('data-tx-row="tx-1"');
    expect(html).toContain('Total visible');
    expect(html).not.toContain('<Transport>');
    expect(api.buildTransactionDrilldownTitle('subcategory', 'Food|||Cafe')).toBe('Cafe · Food');
    expect(api.getTransactionDrilldownStyles()).toContain('.tb-analysis-tx-overlay');
  });

  it('keeps transaction drawer HTML out of 33_budget_analysis.js', () => {
    expect(legacy).toContain('window.TBAnalysisDrilldownView');
    expect(legacy).not.toContain('role="dialog" aria-modal="true" aria-label="Transactions correspondantes"');
    expect(legacy).not.toContain('.tb-analysis-tx-overlay{position:fixed');
    expect(legacy).not.toContain('Aucune transaction correspondante dans le modèle courant');
  });
});
