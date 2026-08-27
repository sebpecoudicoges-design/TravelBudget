function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function entries(map, limit) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function key(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isExpenseOffsetIncome(tx = {}, expenseCategories = []) {
  const category = key(tx?.category);
  return String(tx?.type || '').toLowerCase() === 'income' && Boolean(category)
    && expenseCategories.some((value) => key(value) === category);
}

export function applyBudgetOffsets({ offsets = [], allocate, category, subcategory, dailyMap, categoryMap, categoryRows, subcategoryMap, subcategoryRows } = {}) {
  let delta = 0;
  for (const tx of offsets) {
    const alloc = allocate(tx);
    if (!alloc.visibleBudgetDays.length) continue;
    const visibleAmount = -alloc.amount;
    const perDay = -alloc.perDay;
    delta += visibleAmount;
    alloc.visibleBudgetDays.forEach((day) => dailyMap[day] = num(dailyMap[day]) + perDay);
    const cat = category(tx);
    const sub = subcategory(tx);
    const detail = { tx, visibleAmount, perDay, visibleBudgetDays: alloc.visibleBudgetDays, fullBudgetDays: alloc.fullBudgetDays, cashDate: alloc.cashDate, budgetStart: alloc.budgetStart, budgetEnd: alloc.budgetEnd, expenseOffset: true };
    categoryMap.set(cat, num(categoryMap.get(cat)) + visibleAmount);
    if (!categoryRows.has(cat)) categoryRows.set(cat, []);
    categoryRows.get(cat).push(detail);
    if (sub) {
      const key = `${cat}|||${sub}`;
      subcategoryMap.set(key, num(subcategoryMap.get(key)) + visibleAmount);
      if (!subcategoryRows.has(key)) subcategoryRows.set(key, []);
      subcategoryRows.get(key).push(detail);
    }
  }
  return delta;
}

export function applyComparableOffsets({ offsets = [], days, budgetDays, cashDate, category, convert, mapping, comparableCategoryMap, unmappedCategoryMap } = {}) {
  const totals = { included: 0, mapped: 0, excluded: 0 };
  for (const tx of offsets) {
    if (!budgetDays(tx).some((day) => days.has(day))) continue;
    const amount = -num(convert(tx, cashDate(tx)));
    const raw = category(tx) || 'Autre';
    const target = mapping(raw, tx);
    if (target.mode === 'excluded') { totals.excluded += amount; continue; }
    totals.included += amount;
    if (target.mode !== 'mapped') {
      unmappedCategoryMap.set(raw, num(unmappedCategoryMap.get(raw)) + amount);
      continue;
    }
    totals.mapped += amount;
    comparableCategoryMap.set(target.bucket, num(comparableCategoryMap.get(target.bucket)) + amount);
  }
  return totals;
}

export function buildCashBreakdown({
  income = [],
  expenses = [],
  convert,
  category,
  subcategory,
  isPaid,
  scope = 'budget',
  mode = 'planned',
} = {}) {
  const incomeCategories = new Map();
  const expenseCategories = new Map();
  const incomeSubcategories = new Map();
  const expenseSubcategories = new Map();
  const add = (row, categories, subcategories) => {
    const cat = category(row) || 'Autre';
    const sub = subcategory(row) || 'Sans sous-catégorie';
    const amount = num(convert(row));
    categories.set(cat, num(categories.get(cat)) + amount);
    const key = `${cat} › ${sub}`;
    subcategories.set(key, num(subcategories.get(key)) + amount);
  };
  income.forEach((row) => add(row, incomeCategories, incomeSubcategories));
  expenses.filter((row) => isPaid(row)).forEach((row) => add(row, expenseCategories, expenseSubcategories));
  return {
    cashIncomeCategories: entries(incomeCategories, 5),
    cashExpenseCategories: entries(expenseCategories, 5),
    cashIncomeSubcategories: entries(incomeSubcategories, 8),
    cashExpenseSubcategories: entries(expenseSubcategories, 8),
    cashBreakdownBySubcategory: scope === 'budget' && mode === 'expenses',
  };
}

export function renderCashSubcategoryGrids({ model, renderRows, t, escape, formatCurrency } = {}) {
  if (!model?.cashBreakdownBySubcategory) return '';
  const card = (title, rows, tone) => `<div class="analysis-stat" style="min-height:auto;padding:14px;"><div class="analysis-stat-label" style="margin-bottom:8px;">${escape(title)}</div><div style="display:flex;flex-direction:column;gap:6px;">${renderRows(rows, tone, { formatCurrency, currency: model.base, emptyLabel: t('Aucune sous-catégorie', 'No subcategory') })}</div></div>`;
  return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px;">${card(t('Entrées par sous-catégorie', 'Income by subcategory'), model.cashIncomeSubcategories, '#10b981')}${card(t('Sorties par sous-catégorie', 'Outflows by subcategory'), model.cashExpenseSubcategories, '#f43f5e')}</div>`;
}
