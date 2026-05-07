// Core FX rules.
// Rates are expressed as: 1 pivotCurrency = rate[currency].
// The user/business base currency is an input, not assumed to be EUR.

const ISO3_RE = /^[A-Z]{3}$/;

export function normalizeCurrency(value) {
  const c = String(value || '').trim().toUpperCase();
  return ISO3_RE.test(c) ? c : null;
}

export function normalizePivotRates(rates = {}, pivotCurrency = 'EUR') {
  const pivot = normalizeCurrency(pivotCurrency) || 'EUR';
  const out = { [pivot]: 1 };
  for (const [key, value] of Object.entries(rates || {})) {
    const c = normalizeCurrency(key);
    const n = Number(value);
    if (!c || c === pivot) continue;
    if (Number.isFinite(n) && n > 0) out[c] = n;
  }
  return out;
}

export function getPivotToCurrencyRate(currency, rates = {}, options = {}) {
  const pivot = normalizeCurrency(options.pivotCurrency || 'EUR') || 'EUR';
  const target = normalizeCurrency(currency);
  if (!target) return null;
  if (target === pivot) return 1;

  const normalized = normalizePivotRates(rates, pivot);
  const direct = Number(normalized[target]);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const fallbackCurrency = normalizeCurrency(options.fallbackCurrency);
  const fallbackRate = Number(options.fallbackPivotToCurrencyRate);
  if (fallbackCurrency && target === fallbackCurrency && Number.isFinite(fallbackRate) && fallbackRate > 0) {
    return fallbackRate;
  }

  return null;
}

export function fxRate(fromCurrency, toCurrency, rates = {}, options = {}) {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (!from || !to) return null;
  if (from === to) return 1;

  const pivot = normalizeCurrency(options.pivotCurrency || 'EUR') || 'EUR';
  const fromRate = getPivotToCurrencyRate(from, rates, {
    pivotCurrency: pivot,
    fallbackCurrency: options.fallbackCurrency,
    fallbackPivotToCurrencyRate: options.fallbackPivotToCurrencyRate,
  });
  const toRate = getPivotToCurrencyRate(to, rates, {
    pivotCurrency: pivot,
    fallbackCurrency: options.fallbackCurrency,
    fallbackPivotToCurrencyRate: options.fallbackPivotToCurrencyRate,
  });

  if (!fromRate || !toRate) return null;
  return toRate / fromRate;
}

export function fxConvert(amount, fromCurrency, toCurrency, rates = {}, options = {}) {
  const n = Number(amount);
  const a = Number.isFinite(n) ? n : 0;
  const rate = fxRate(fromCurrency, toCurrency, rates, options);
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  const out = a * rate;
  return Number.isFinite(out) ? out : null;
}

export function buildTxFxSnapshot(input = {}) {
  const txCurrency = normalizeCurrency(input.txCurrency);
  const baseCurrency = normalizeCurrency(input.baseCurrency);
  const date = String(input.date || '').slice(0, 10);
  if (!txCurrency || !baseCurrency) throw new Error('[FX] snapshot: missing currency');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('[FX] snapshot: invalid date');

  const now = input.now || new Date().toISOString();
  if (txCurrency === baseCurrency) {
    return {
      fx_rate_snapshot: 1,
      fx_source_snapshot: 'none',
      fx_snapshot_at: now,
      fx_base_currency_snapshot: baseCurrency,
      fx_tx_currency_snapshot: txCurrency,
    };
  }

  const rate = fxRate(txCurrency, baseCurrency, input.rates || {}, {
    pivotCurrency: input.pivotCurrency || 'EUR',
    fallbackCurrency: input.fallbackCurrency,
    fallbackPivotToCurrencyRate: input.fallbackPivotToCurrencyRate,
  });

  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`[FX] snapshot: cannot compute rate ${txCurrency}->${baseCurrency} for ${date}`);
  }

  return {
    fx_rate_snapshot: rate,
    fx_source_snapshot: input.source || 'fx',
    fx_snapshot_at: now,
    fx_base_currency_snapshot: baseCurrency,
    fx_tx_currency_snapshot: txCurrency,
  };
}

export function tryConvertWithSnapshot(amount, tx, targetBaseCurrency) {
  const a = Number(amount) || 0;
  if (!tx) return null;

  const snapRate = Number(tx.fx_rate_snapshot ?? tx.fxRateSnapshot);
  const snapFrom = normalizeCurrency(tx.fx_tx_currency_snapshot || tx.fxTxCurrencySnapshot);
  const snapTo = normalizeCurrency(tx.fx_base_currency_snapshot || tx.fxBaseCurrencySnapshot);
  const target = normalizeCurrency(targetBaseCurrency);
  const txCur = normalizeCurrency(tx.currency);

  if (!snapRate || !Number.isFinite(snapRate) || snapRate <= 0) return null;
  if (!snapFrom || !snapTo || !target || !txCur) return null;
  if (snapFrom !== txCur) return null;
  if (snapTo !== target) return null;

  const out = a * snapRate;
  return Number.isFinite(out) ? out : null;
}
