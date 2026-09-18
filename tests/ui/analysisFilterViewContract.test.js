import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

describe('Analysis filter view contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const filterView = fs.readFileSync('public/legacy/js/33_analysis_filter_view.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/33_budget_analysis.js', 'utf8');

  function loadApi() {
    const sandbox = { window: {} };
    vm.runInNewContext(filterView, sandbox);
    return sandbox.window.TBAnalysisFilterView;
  }

  it('renders separately totaled payable expenses and estimates, including estimates-only states', () => {
    const sandbox = { window: {} };
    vm.runInNewContext(filterView, sandbox);
    const render = sandbox.window.TBAnalysisView.renderAnalysisUnpaidBlock;
    const model = { base: 'AUD', expensePlanned: 302.75, unpaidTxDetails: [{ tx: { label: 'Google One' }, visibleAmount: 260.5 }], estimatedTxDetails: [{ tx: { label: '<Frais estimés>' }, visibleAmount: 42.25 }] };
    const html = render({ model, formatCurrency: n => `${n} AUD` });
    const [payable, estimated] = html.split('analysis-stat--estimated');
    expect(payable).toContain('260.5 AUD');
    expect(payable).not.toContain('42.25 AUD');
    expect(estimated).toContain('42.25 AUD');
    expect(estimated).toContain('&lt;Frais estimés&gt;');
    expect(html).not.toContain('302.75 AUD');
    expect(render({ model: { ...model, unpaidTxDetails: [] } })).not.toContain('analysis-stat--unpaid');
    expect(render({ model: { ...model, estimatedTxDetails: [] }, isEn: true })).not.toContain('analysis-stat--estimated');
    expect(legacy).toContain('splitPlannedDetails(unpaidTxDetails)');
  });

  it('loads the filter view before the Analysis legacy page', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));
    expect(bootList).not.toContain('/legacy/js/33_analysis_filter_view.js');
    expect(domains.indexOf('/legacy/js/33_analysis_filter_view.js')).toBeGreaterThan(-1);
    expect(domains.indexOf('/legacy/js/33_analysis_filter_view.js')).toBeLessThan(domains.indexOf('/legacy/js/33_budget_analysis.js'));
  });

  it('renders escaped filter options and exclusion chips', () => {
    const api = loadApi();
    const t = (key) => ({
      'common.all': 'Tous',
      'analysis.filter.income': 'Revenus',
      'analysis.filter.no_subcategory': 'Sans sous-catégorie',
    }[key] || key);
    const normalizeKey = (value) => String(value || '').trim().toLowerCase();

    const categoryHtml = api.renderCategoryFilterOptions({
      categories: ['Revenu', '<Food>', 'Transport'],
      normalizeKey,
      t,
    });
    const subcategoryHtml = api.renderSubcategoryFilterOptions({
      subcategories: ['<Cafe>', 'Bus'],
      t,
    });
    const periodHtml = api.renderPeriodFilterOptions({
      activeLabel: 'Active <now>',
      periods: [{ id: 'p<1>', start: '2026-07-01', end: '2026-07-05', base: 'aud' }],
    });
    const chipHtml = api.renderCategoryExcludeChips({
      categories: ['Food', '<Transport>'],
      excluded: ['<Transport>'],
    });

    expect(categoryHtml).toContain('<option value="all">Tous</option>');
    expect(categoryHtml).toContain('<option value="__income">Revenus</option>');
    expect(categoryHtml).not.toContain('value="Revenu"');
    expect(categoryHtml).toContain('value="&lt;Food&gt;"');
    expect(subcategoryHtml).toContain('<option value="__none__">Sans sous-catégorie</option>');
    expect(subcategoryHtml).toContain('value="&lt;Cafe&gt;"');
    expect(periodHtml).toContain('<option value="active">Active &lt;now&gt;</option>');
    expect(periodHtml).toContain('value="p&lt;1&gt;"');
    expect(periodHtml).toContain('Période 1 • 2026-07-01 → 2026-07-05 • AUD');
    expect(periodHtml).toContain('<option value="range">Date à date</option>');
    expect(chipHtml).toContain('data-cat="&lt;Transport&gt;"');
    expect(chipHtml).toContain('is-excluded');
    expect(api.buildCategoryExcludeSummary({ total: 4, count: 2 })).toBe('2 catégories exclues • 2 incluses');
  });

  it('keeps filter HTML out of 33_budget_analysis.js', () => {
    expect(legacy).toContain('window.TBAnalysisFilterView');
    expect(legacy).not.toContain('<option value="__income">${escapeHTML');
    expect(legacy).not.toContain('<option value="active">${escapeHTML(activeLabel)');
    expect(legacy).not.toContain("Période ${idx+1}");
    expect(legacy).not.toContain('class="analysis-chip${excluded');
    expect(legacy).not.toContain('Aucune catégorie exclue • ${total}');
  });
});
