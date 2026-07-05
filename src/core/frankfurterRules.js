function currencyCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : '';
}

function positiveRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function buildFrankfurterV2RatesUrl({ base = 'EUR', quotes = [], from = '', to = '', date = '' } = {}) {
  const url = new URL('https://api.frankfurter.dev/v2/rates');
  const baseCode = currencyCode(base) || 'EUR';
  const quoteCodes = (Array.isArray(quotes) ? quotes : [quotes]).map(currencyCode).filter(Boolean);
  url.searchParams.set('base', baseCode);
  if (quoteCodes.length) url.searchParams.set('quotes', [...new Set(quoteCodes)].join(','));
  if (from) url.searchParams.set('from', String(from).slice(0, 10));
  if (to) url.searchParams.set('to', String(to).slice(0, 10));
  if (date) url.searchParams.set('date', String(date).slice(0, 10));
  return url.toString();
}

export function normalizeFrankfurterLatest(payload, pivotCurrency = 'EUR') {
  const pivot = currencyCode(pivotCurrency) || 'EUR';
  const rates = { [pivot]: 1 };
  const dates = {};

  if (Array.isArray(payload)) {
    payload.forEach((row) => {
      const base = currencyCode(row?.base);
      const quote = currencyCode(row?.quote);
      const rate = positiveRate(row?.rate);
      const date = String(row?.date || '').slice(0, 10);
      if (base !== pivot || !quote || rate === null) return;
      if (!dates[quote] || date >= dates[quote]) {
        rates[quote] = rate;
        dates[quote] = date;
      }
    });
  } else {
    const base = currencyCode(payload?.base) || pivot;
    if (base === pivot && payload?.rates && typeof payload.rates === 'object') {
      Object.entries(payload.rates).forEach(([quote, value]) => {
        const code = currencyCode(quote);
        const rate = positiveRate(value);
        if (!code || rate === null) return;
        rates[code] = rate;
        dates[code] = String(payload?.date || '').slice(0, 10);
      });
    }
  }

  const date = Object.values(dates).filter(Boolean).sort().at(-1) || null;
  return { base: pivot, date, rates, dates };
}

export function normalizeFrankfurterSeries(payload, { base, quote } = {}) {
  const baseCode = currencyCode(base);
  const quoteCode = currencyCode(quote);
  const byDate = new Map();

  if (Array.isArray(payload)) {
    payload.forEach((row) => {
      const rate = positiveRate(row?.rate);
      const date = String(row?.date || '').slice(0, 10);
      if (currencyCode(row?.base) !== baseCode || currencyCode(row?.quote) !== quoteCode || !date || rate === null) return;
      byDate.set(date, { date, rate });
    });
  } else if (payload?.rates && typeof payload.rates === 'object') {
    Object.entries(payload.rates).forEach(([date, row]) => {
      const rate = positiveRate(row?.[quoteCode]);
      const day = String(date || '').slice(0, 10);
      if (day && rate !== null) byDate.set(day, { date: day, rate });
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
