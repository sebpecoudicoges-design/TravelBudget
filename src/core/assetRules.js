import { fxConvert, normalizeCurrency } from './fxRules.js';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dateValue(value) {
  const d = new Date(String(value || '').slice(0, 10) + 'T00:00:00');
  return Number.isFinite(d.getTime()) ? d : null;
}

function monthsBetween(start, end = new Date()) {
  const s = dateValue(start);
  const e = end instanceof Date ? end : dateValue(end);
  if (!s || !e) return 0;
  let m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) m -= 1;
  return Math.max(0, m);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function computeLinearAssetValue(asset, atDate) {
  const purchase = num(asset?.purchase_value, 0);
  const residual = Math.min(num(asset?.residual_value, 0), purchase);
  const months = Math.max(1, Math.round(num(asset?.depreciation_months, 1)));
  const elapsed = monthsBetween(asset?.purchase_date, atDate || new Date());
  const ratio = clamp(elapsed / months, 0, 1);
  return Math.max(residual, purchase - ((purchase - residual) * ratio));
}

export function assetOwnerPercent(asset, owners = []) {
  const id = String(asset?.id || '');
  const rows = (owners || []).filter((row) => String(row?.asset_id || '') === id);
  const own = rows.find((row) => /toi|moi/i.test(String(row?.display_name || '')) || row?.is_me);
  return clamp(num(own?.ownership_percent ?? rows[0]?.ownership_percent ?? 100, 100), 0, 100);
}

function isoDate(value) {
  const d = value instanceof Date ? value : dateValue(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthOccurrence(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(Math.max(1, day), lastDay));
}

export function assetMonthlyBudgetAmount(asset, owners = []) {
  if (!asset || asset.include_in_budget === false) return 0;
  const method = String(asset.budget_method || 'linear').toLowerCase();
  const base = method === 'manual'
    ? Math.max(0, num(asset.monthly_budget_override, 0))
    : Math.max(0, num(asset.purchase_value, 0) - num(asset.residual_value, 0))
      / Math.max(1, Math.round(num(asset.depreciation_months, 1)));
  return base * (assetOwnerPercent(asset, owners) / 100);
}

export function normalizeAssetTransactionLink(link = {}) {
  const relationType = String(link.relation_type || link.relationType || 'purchase').toLowerCase();
  const known = new Set(['purchase', 'extra_cost', 'sale', 'maintenance', 'insurance', 'financing', 'trip_expense', 'other']);
  return {
    id: link.id || null,
    user_id: link.user_id || link.userId || null,
    asset_id: link.asset_id || link.assetId || null,
    transaction_id: link.transaction_id || link.transactionId || null,
    trip_expense_id: link.trip_expense_id || link.tripExpenseId || null,
    relation_type: known.has(relationType) ? relationType : 'other',
    exclude_from_budget: !!(link.exclude_from_budget ?? link.excludeFromBudget),
    note: link.note || null,
  };
}

export function shouldExcludeAssetLinkedTransaction(link = {}) {
  const row = normalizeAssetTransactionLink(link);
  return !!row.transaction_id
    && row.exclude_from_budget
    && ['purchase', 'sale', 'financing'].includes(row.relation_type);
}

export function buildAssetLinkedTransactionBudgetPatchFromLinks(links = []) {
  return (links || []).some(shouldExcludeAssetLinkedTransaction)
    ? { out_of_budget: true, affects_budget: false }
    : { out_of_budget: false, affects_budget: true };
}

export function buildAssetLinkedTransactionBudgetPatch(link = {}) {
  return buildAssetLinkedTransactionBudgetPatchFromLinks([link]);
}

export function applyAssetTransactionLinksToBudget(transactions = [], links = []) {
  const byTx = new Map();
  for (const link of links || []) {
    const row = normalizeAssetTransactionLink(link);
    if (!row.transaction_id) continue;
    if (!byTx.has(String(row.transaction_id))) byTx.set(String(row.transaction_id), []);
    byTx.get(String(row.transaction_id)).push(row);
  }

  return (transactions || []).map((tx) => {
    const rows = byTx.get(String(tx?.id || '')) || [];
    if (!rows.some(shouldExcludeAssetLinkedTransaction)) return tx;
    return {
      ...tx,
      outOfBudget: true,
      out_of_budget: true,
      affectsBudget: false,
      affects_budget: false,
      assetBudgetExcluded: true,
      asset_budget_excluded: true,
    };
  });
}

export function buildAssetBudgetTransactions({ assets = [], owners = [], rangeStart, rangeEnd } = {}) {
  const start = dateValue(rangeStart);
  const end = dateValue(rangeEnd || rangeStart);
  if (!start || !end || end < start) return [];
  const rows = [];

  for (const asset of assets || []) {
    if (!asset || asset.include_in_budget === false) continue;
    if (['sold', 'archived'].includes(String(asset.status || '').toLowerCase())) continue;
    const amount = assetMonthlyBudgetAmount(asset, owners);
    if (!(amount > 0)) continue;

    const purchaseDate = dateValue(asset.purchase_date);
    const budgetStart = dateValue(asset.budget_start_date) || purchaseDate;
    if (!budgetStart) continue;
    const explicitEnd = dateValue(asset.budget_end_date);
    const depreciationMonths = Math.max(1, Math.round(num(asset.depreciation_months, 1)));
    const linearEnd = String(asset.budget_method || 'linear') === 'manual'
      ? null
      : new Date(budgetStart.getFullYear(), budgetStart.getMonth() + depreciationMonths - 1, 31);
    const activeEnd = explicitEnd && linearEnd
      ? (explicitEnd < linearEnd ? explicitEnd : linearEnd)
      : (explicitEnd || linearEnd);
    const day = Math.round(num(asset.budget_day, budgetStart.getDate()));

    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= lastMonth) {
      const occurrence = monthOccurrence(cursor.getFullYear(), cursor.getMonth(), day);
      if (occurrence >= start && occurrence <= end && occurrence >= budgetStart && (!activeEnd || occurrence <= activeEnd)) {
        const date = isoDate(occurrence);
        rows.push({
          id: `asset-budget:${asset.id}:${date}`,
          user_id: asset.user_id || null,
          travel_id: asset.travel_id || null,
          type: 'expense',
          label: `Patrimoine - ${asset.name || 'Actif'}`,
          amount,
          currency: normalizeCurrency(asset.currency) || 'EUR',
          category: asset.budget_category || 'Patrimoine',
          subcategory: asset.budget_subcategory || 'Amortissement',
          dateStart: date,
          dateEnd: date,
          date_start: date,
          date_end: date,
          budgetDateStart: date,
          budgetDateEnd: date,
          payNow: true,
          pay_now: true,
          outOfBudget: false,
          out_of_budget: false,
          affectsBudget: true,
          affects_budget: true,
          virtualBudgetOnly: true,
          assetBudget: true,
          assetId: asset.id,
        });
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  return rows;
}

export function convertAssetAmount(amount, fromCurrency, toCurrency, options = {}) {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  const a = num(amount, 0);
  if (!from || !to) return null;
  if (from === to) return a;
  return fxConvert(a, from, to, options.rates || {}, {
    pivotCurrency: options.pivotCurrency || 'EUR',
    fallbackCurrency: options.fallbackCurrency,
    fallbackPivotToCurrencyRate: options.fallbackPivotToCurrencyRate,
  });
}

export function summarizeAssetPortfolio(assets = [], owners = [], options = {}) {
  const baseCurrency = normalizeCurrency(options.baseCurrency) || 'EUR';
  const activeAssets = (assets || []).filter((asset) => String(asset?.status || 'active') === 'active');
  const missingCurrencies = new Set();

  let totalCurrent = 0;
  let totalOwned = 0;
  let totalDepreciation = 0;
  let convertedCount = 0;

  for (const asset of activeAssets) {
    const assetCurrency = normalizeCurrency(asset?.currency) || baseCurrency;
    const current = options.computeCurrentValue
      ? num(options.computeCurrentValue(asset), 0)
      : computeLinearAssetValue(asset, options.atDate);
    const purchase = num(asset?.purchase_value, 0);

    const currentInBase = convertAssetAmount(current, assetCurrency, baseCurrency, options);
    const purchaseInBase = convertAssetAmount(purchase, assetCurrency, baseCurrency, options);

    if (currentInBase === null || purchaseInBase === null) {
      missingCurrencies.add(assetCurrency);
      continue;
    }

    const ownPct = options.ownerPercent
      ? num(options.ownerPercent(asset, owners), 0)
      : assetOwnerPercent(asset, owners);

    totalCurrent += currentInBase;
    totalOwned += currentInBase * (clamp(ownPct, 0, 100) / 100);
    totalDepreciation += Math.max(0, purchaseInBase - currentInBase);
    convertedCount += 1;
  }

  return {
    count: activeAssets.length,
    convertedCount,
    currency: baseCurrency,
    totalCurrent,
    totalOwned,
    totalDepreciation,
    missingCurrencies: Array.from(missingCurrencies).sort(),
  };
}
