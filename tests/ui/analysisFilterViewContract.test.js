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

  it('loads the filter view before the Analysis legacy page', () => {
    expect(main.indexOf('/legacy/js/33_analysis_filter_view.js')).toBeGreaterThan(-1);
    expect(main.indexOf('/legacy/js/33_analysis_filter_view.js')).toBeLessThan(main.indexOf('/legacy/js/33_budget_analysis.js'));
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
    expect(chipHtml).toContain('data-cat="&lt;Transport&gt;"');
    expect(chipHtml).toContain('is-excluded');
    expect(api.buildCategoryExcludeSummary({ total: 4, count: 2 })).toBe('2 catégories exclues • 2 incluses');
  });

  it('keeps filter HTML out of 33_budget_analysis.js', () => {
    expect(legacy).toContain('window.TBAnalysisFilterView');
    expect(legacy).not.toContain('<option value="__income">${escapeHTML');
    expect(legacy).not.toContain('class="analysis-chip${excluded');
    expect(legacy).not.toContain('Aucune catégorie exclue • ${total}');
  });
});
