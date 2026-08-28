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
    && (isTripBudgetIncomeShare(tx) || expenseCategories.some((value) => key(value) === category));
}

export function isTripBudgetIncomeShare(tx = {}) {
  if (String(tx?.type || '').toLowerCase() !== 'income') return false;
  const affectsBudget = tx?.affectsBudget ?? tx?.affects_budget;
  const outOfBudget = tx?.outOfBudget ?? tx?.out_of_budget;
  const internal = tx?.isInternal ?? tx?.is_internal;
  const label = String(tx?.label || '').trim();
  return affectsBudget !== false && outOfBudget !== true && internal === true
    && /^\[trip\]\s*part entree\s*-/i.test(label.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

export function isTripCashIncome(tx = {}) {
  if (String(tx?.type || '').toLowerCase() !== 'income') return false;
  const linked = tx?.tripExpenseId || tx?.trip_expense_id || tx?.tripShareLinkId || tx?.trip_share_link_id;
  const label = String(tx?.label || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return Boolean(linked) || /^\[trip\]\s*entree recue\s*-/i.test(label);
}

export function isTripCashExpense(tx = {}) {
  if (String(tx?.type || '').toLowerCase() !== 'expense') return false;
  const linked = tx?.tripExpenseId || tx?.trip_expense_id || tx?.tripShareLinkId || tx?.trip_share_link_id;
  return Boolean(linked) || /^\[trip\]\s*avance\s*-/i.test(String(tx?.label || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

export function filterCashTransactions({ rows = [], scope = 'budget', paid, internal, out, category, subcategory, tripCash, excluded = new Set(), categoryFilter = 'all', subcategoryFilter = 'all' } = {}) {
  return rows.filter((tx) => {
    const cat = category(tx);
    const sub = subcategory(tx);
    if (!paid(tx) || internal(tx)) return false;
    if ((scope === 'budget' && out(tx) && !tripCash(tx)) || (scope === 'out' && !out(tx))) return false;
    if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== '__income' && cat !== categoryFilter) return false;
    if ((subcategoryFilter === '__none__' && sub) || (subcategoryFilter && subcategoryFilter !== 'all' && subcategoryFilter !== '__none__' && sub !== subcategoryFilter)) return false;
    return !(excluded.size && excluded.has(cat));
  });
}

export function filterTransactionsInRange({ rows = [], type, travelId, start, end, rowType, rowTravelId, budgetStart, budgetEnd } = {}) {
  return rows.filter((tx) => {
    const txTravelId = String(rowTravelId(tx) || '');
    if (travelId && txTravelId && txTravelId !== String(travelId)) return false;
    if (rowType(tx) !== type) return false;
    const from = budgetStart(tx);
    const to = budgetEnd(tx);
    return Boolean(from && to && (!start || to >= start) && (!end || from <= end));
  });
}

export function selectCashFlows(options = {}) {
  const ranged = (type) => filterTransactionsInRange({ ...options, type });
  const common = {
    scope: options.scope, paid: options.paid, internal: options.internal, out: options.out,
    category: options.category, subcategory: options.subcategory, excluded: options.excluded,
    categoryFilter: options.categoryFilter, subcategoryFilter: options.subcategoryFilter,
  };
  return {
    income: filterCashTransactions({ ...common, rows: ranged('income'), tripCash: isTripCashIncome }),
    expenses: filterCashTransactions({ ...common, rows: ranged('expense'), tripCash: isTripCashExpense }),
  };
}

export function applyPaidBudgetOffsets({ offsets = [], allocate, paidMap, isReal } = {}) {
  let delta = 0;
  for (const tx of offsets) {
    if (!isReal(tx)) continue;
    const alloc = allocate(tx);
    if (!alloc.visibleBudgetDays.length) continue;
    delta -= alloc.amount;
    alloc.visibleBudgetDays.forEach((day) => paidMap[day] = num(paidMap[day]) - alloc.perDay);
  }
  return delta;
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
    cashBreakdownBySubcategory: scope === 'budget',
  };
}

export function renderCashBreakdownGrids({ model, renderRows, t, escape, formatCurrency } = {}) {
  const card = (title, rows, tone, emptyLabel) => `<div class="analysis-stat" style="min-height:auto;padding:14px;"><div class="analysis-stat-label" style="margin-bottom:8px;">${escape(title)}</div><div style="display:flex;flex-direction:column;gap:6px;">${renderRows(rows, tone, { formatCurrency, currency: model.base, emptyLabel })}</div></div>`;
  const noData = t('Aucune donnée', 'No data');
  const noSubcategory = t('Aucune sous-catégorie', 'No subcategory');
  const blocks = [
    card(t('Entrées par catégorie', 'Income by category'), model.cashIncomeCategories, '#10b981', noData),
    model?.cashBreakdownBySubcategory ? card(t('Entrées par sous-catégorie', 'Income by subcategory'), model.cashIncomeSubcategories, '#10b981', noSubcategory) : '',
    card(t('Sorties par catégorie', 'Outflows by category'), model.cashExpenseCategories, '#f43f5e', noData),
    model?.cashBreakdownBySubcategory ? card(t('Sorties par sous-catégorie', 'Outflows by subcategory'), model.cashExpenseSubcategories, '#f43f5e', noSubcategory) : '',
  ].filter(Boolean);
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:12px;">${blocks.join('')}</div>`;
}
