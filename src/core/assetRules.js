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
