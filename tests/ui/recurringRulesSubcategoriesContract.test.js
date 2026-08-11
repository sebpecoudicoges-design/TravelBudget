import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Recurring rules subcategories contract', () => {
  const source = fs.readFileSync('public/legacy/js/15_recurring_rules_ui.js', 'utf8');

  it('loads SQL subcategories before rendering the recurring rule modal', () => {
    expect(source).toContain('async function _rrFetchDbSubcategories');
    expect(source).toContain('TB_CONST.TABLES.category_subcategories');
    expect(source).toContain('async function _rrEnsureSubcategoriesLoaded');
    expect(source.indexOf('await _rrEnsureSubcategoriesLoaded();')).toBeLessThan(source.indexOf('_rrBindSubcategoryUi(defaults.subcategory || "")'));
    expect(source.indexOf('modal.open();')).toBeLessThan(source.indexOf('_rrBindSubcategoryUi(defaults.subcategory || "")'));
    expect(source.indexOf('modal.open();')).toBeLessThan(source.indexOf('_rrBindFrequencyUi();'));
  });

  it('keeps a local fallback for subcategory options when deferred data is late', () => {
    const optionsBody = source.slice(source.indexOf('function _rrSubcategoryOptions'), source.indexOf('function _rrBindSubcategoryUi'));
    expect(optionsBody).toContain('getCategorySubcategories(categoryName, { activeOnly: true })');
    expect(optionsBody).toContain('state?.categorySubcategories');
    expect(optionsBody).toContain('state?.transactions');
    expect(optionsBody).toContain('state?.recurringRules');
    expect(optionsBody).toContain('Aucune');
  });
});
