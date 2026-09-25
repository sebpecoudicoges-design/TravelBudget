import { buildFrankfurterV2RatesUrl, normalizeFrankfurterSeries } from '../../core/frankfurterRules.js';

const cache = new Map();
const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const code = value => /^[A-Z]{3}$/.test(value || '');
const age = (at, date) => (Date.parse(at) - Date.parse(date)) / 86400000;
const round = value => Math.round(value * 100) / 100;

export function convertAccountingAmount(amount, from, to, at, fx = {}) {
  const originalAmount = Number.isFinite(amount) ? amount : null;
  const base = { originalAmount, originalCurrency: from, currency: to, fxDate: null, fxRate: null, fxSource: null, amount: null };
  if (originalAmount === null || !code(from) || !code(to) || !day(at)) return base;
  if (from === to) return { ...base, amount: round(amount), fxRate: 1, fxDate: at, fxSource: 'Même devise' };
  if (amount === 0) return { ...base, amount: 0, fxSource: 'Montant nul' };
  const rows = fx.series?.[`${from}:${to}`] || [];
  const row = rows.filter(r => day(r.date) && Number.isFinite(r.rate) && r.rate > 0 && age(at, r.date) >= 0 && age(at, r.date) <= 7).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (row) return { ...base, amount: round(amount * row.rate), fxRate: row.rate, fxDate: row.date, fxSource: 'Frankfurter · FX journalier' };
  const manual = fx.manualRates || {};
  const left = from === 'EUR' ? { rate: 1, asOf: manual[to]?.asOf } : manual[from];
  const right = to === 'EUR' ? { rate: 1, asOf: manual[from]?.asOf } : manual[to];
  if (left?.asOf === right?.asOf && day(left?.asOf) && age(at, left.asOf) >= 0 && age(at, left.asOf) <= 7 && Number(left.rate) > 0 && Number(right.rate) > 0) {
    const rate = Number(right.rate) / Number(left.rate);
    if (Number.isFinite(rate)) return { ...base, amount: round(amount * rate), fxRate: rate, fxDate: left.asOf, fxSource: 'FX manuel daté · repli' };
  }
  return base;
}

// Only currency pairs and dates leave the browser. No transactions or amounts.
export async function loadAccountingFx({ currencies, target, dates, today, fetchImpl = fetch, offline = false, manualRates = {}, signal }) {
  const series = {}, errors = [];
  const years = [...new Set(dates.filter(d => day(d) && d <= today).map(d => d.slice(0, 4)))].sort();
  const tasks = [];
  for (const from of [...new Set(currencies)].filter(c => code(c) && c !== target)) {
    series[`${from}:${target}`] = [];
    for (const year of years) tasks.push({ from, year });
  }
  // Bound concurrency; a failure affects only the unavailable currency/year.
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length && !signal?.aborted) {
      const { from, year } = tasks[cursor++];
      const key = `${from}:${target}:${year}:${today}`;
      let rows = cache.get(key)?.rows;
      if (!offline && (!rows || Date.now() - cache.get(key).savedAt > 600000)) {
        const start = new Date(`${year}-01-01T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 7);
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, 12000);
        try {
          const response = await fetchImpl(buildFrankfurterV2RatesUrl({ base: from, quotes: [target], from: start.toISOString().slice(0, 10), to: `${year}-12-31` < today ? `${year}-12-31` : today }), { signal: controller.signal });
          if (!response.ok) throw new Error('FX unavailable');
          rows = normalizeFrankfurterSeries(await response.json(), { base: from, quote: target });
          if (!rows.length) throw new Error('FX missing');
          if (!signal?.aborted) { cache.set(key, { rows, savedAt: Date.now() }); if (cache.size > 100) cache.delete(cache.keys().next().value); }
        } catch { errors.push(`${from}/${target} · ${year}`); }
        finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
      }
      if (rows) series[`${from}:${target}`].push(...rows);
      else if (offline) errors.push(`${from}/${target} · ${year}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, worker));
  return { series, manualRates, errors };
}
