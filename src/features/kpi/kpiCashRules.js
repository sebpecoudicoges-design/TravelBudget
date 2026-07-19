function parseDate(value) {
  const iso = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysInclusive(start, end) {
  const s = parseDate(toISODate(start));
  const e = parseDate(toISODate(end));
  if (!s || !e) return 1;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

export function getCashWallets(wallets = []) {
  return (Array.isArray(wallets) ? wallets : [])
    .filter((wallet) => String(wallet?.type || '').toLowerCase() === 'cash');
}

export function toBaseSafe(amount, currency, {
  baseCurrency = '',
  exchangeRates = {},
  fxConvert = null,
} = {}) {
  const base = String(baseCurrency || '').toUpperCase();
  const cur = String(currency || '').toUpperCase();
  const amt = Number(amount) || 0;
  if (!base || !cur) return { ok: false, v: 0 };
  if (typeof fxConvert === 'function') {
    const out = fxConvert(amt, cur, base);
    if (out === null || !Number.isFinite(Number(out))) return { ok: false, v: 0 };
    return { ok: true, v: Number(out) };
  }
  if (cur === base) return { ok: true, v: amt };
  if (cur === 'EUR') {
    const rate = Number(exchangeRates?.['EUR-BASE']) || 0;
    if (!rate) return { ok: false, v: 0 };
    return { ok: true, v: amt * rate };
  }
  return { ok: false, v: 0 };
}

export function sumCashWalletsBase(wallets = [], {
  baseCurrency = '',
  exchangeRates = {},
  fxConvert = null,
  effectiveBalance = null,
} = {}) {
  let totalBase = 0;
  const excluded = [];
  for (const wallet of getCashWallets(wallets)) {
    const currency = wallet?.currency || baseCurrency;
    const balance = typeof effectiveBalance === 'function'
      ? Number(effectiveBalance(wallet) || 0)
      : Number(wallet?.balance || 0);
    if (!balance) continue;
    const converted = toBaseSafe(balance, currency, { baseCurrency, exchangeRates, fxConvert });
    if (converted.ok) totalBase += converted.v;
    else excluded.push({ name: wallet?.name || 'Wallet', currency, balance });
  }
  return { totalBase, excluded };
}

export function cashRunwayInfo({
  wallets = [],
  transactions = [],
  period = {},
  baseCurrency = '',
  exchangeRates = {},
  fxConvert = null,
  effectiveBalance = null,
  activeTravelId = '',
  txMatchesActiveTravel = () => true,
  txAffectsCash = () => true,
  isInternalMovement = () => false,
  txCashDate = (tx) => tx?.dateStart || tx?.date_start,
  windowDays = 7,
  now = new Date(),
} = {}) {
  const cashWallets = getCashWallets(wallets);
  if (!cashWallets.length) return null;
  const totals = sumCashWalletsBase(wallets, { baseCurrency, exchangeRates, fxConvert, effectiveBalance });
  const cashWalletIds = new Set(cashWallets.map((wallet) => String(wallet?.id || '')));
  const today = parseDate(toISODate(now)) || parseDate(new Date().toISOString().slice(0, 10));
  const periodStart = parseDate(period?.start || period?.start_date);
  const start = periodStart || (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - Math.max(1, Number(windowDays) || 7) + 1);
    return parseDate(toISODate(d));
  })();
  let sumExpenseBase = 0;
  for (const tx of Array.isArray(transactions) ? transactions : []) {
    if (!tx) continue;
    if (!txMatchesActiveTravel(tx, activeTravelId)) continue;
    if (String(tx?.type || '').toLowerCase() !== 'expense') continue;
    if (isInternalMovement(tx)) continue;
    if (!txAffectsCash(tx)) continue;
    const walletId = String(tx?.walletId ?? tx?.wallet_id ?? '');
    if (cashWalletIds.size && walletId && !cashWalletIds.has(walletId)) continue;
    const txDate = parseDate(txCashDate(tx));
    if (!txDate || txDate < start || txDate > today) continue;
    const converted = toBaseSafe(Number(tx?.amount) || 0, tx?.currency || baseCurrency, { baseCurrency, exchangeRates, fxConvert });
    if (converted.ok) sumExpenseBase += converted.v;
  }
  const days = daysInclusive(start, today);
  const burnPerDay = sumExpenseBase / days;
  return {
    totalBase: totals.totalBase,
    burnPerDay,
    daysLeft: burnPerDay > 0 ? totals.totalBase / burnPerDay : Infinity,
    excluded: totals.excluded,
    windowDays: days,
  };
}

export function cashConservativeInfo({
  wallets = [],
  period = {},
  baseCurrency = '',
  exchangeRates = {},
  fxConvert = null,
  effectiveBalance = null,
  periodContains = () => true,
  getDailyBudgetForDate = () => 0,
  now = new Date(),
} = {}) {
  const cashWallets = getCashWallets(wallets);
  if (!cashWallets.length) return null;
  const totals = sumCashWalletsBase(wallets, { baseCurrency, exchangeRates, fxConvert, effectiveBalance });
  const today = parseDate(toISODate(now)) || parseDate(new Date().toISOString().slice(0, 10));
  const start = parseDate(period?.start || period?.start_date) || today;
  const end = new Date(today);
  end.setDate(end.getDate() - 1);
  const last = end >= start ? end : today;
  let sumAllocated = 0;
  let activeDays = 0;
  for (let d = new Date(start); d <= last; d.setDate(d.getDate() + 1)) {
    const iso = toISODate(d);
    if (!periodContains(iso)) continue;
    const remaining = Number(getDailyBudgetForDate(iso)) || 0;
    const allocated = (Number(period?.dailyBudgetBase || period?.daily_budget_base || 0) || 0) - remaining;
    if (allocated > 0) {
      sumAllocated += allocated;
      activeDays += 1;
    }
  }
  const burnPerDay = activeDays > 0 ? sumAllocated / activeDays : Number(period?.dailyBudgetBase || period?.daily_budget_base || 0);
  return {
    totalBase: totals.totalBase,
    burnPerDay,
    daysLeft: burnPerDay > 0 ? totals.totalBase / burnPerDay : Infinity,
    excluded: totals.excluded,
    activeDays,
  };
}
