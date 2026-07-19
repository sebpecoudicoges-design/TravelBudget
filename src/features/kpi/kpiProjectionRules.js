export function fmtKpiCompact(value, formatter = Intl.NumberFormat) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1e7) {
    try {
      return new formatter(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
    } catch (_) {}
  }
  return String(Math.round(n));
}

export function datesOverlap(aStartISO, aEndISO, bStartISO, bEndISO) {
  const parse = (value) => {
    const iso = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const as = parse(aStartISO);
  const ae = parse(aEndISO || aStartISO);
  const bs = parse(bStartISO);
  const be = parse(bEndISO || bStartISO);
  if (!as || !ae || !bs || !be) return true;
  return !(ae < bs || as > be);
}

export function tripNetRowInRange(row, rangeStartISO, rangeEndISO, periods = []) {
  const periodId = String(row?.periodId || row?.period_id || '');
  if (!periodId) return true;
  const period = (Array.isArray(periods) ? periods : []).find((item) => String(item?.id || '') === periodId);
  if (!period) return true;
  return datesOverlap(
    period.start || period.start_date,
    period.end || period.end_date,
    rangeStartISO,
    rangeEndISO,
  );
}

export function pendingTxOverlaps(tx, rangeStartISO, rangeEndISO) {
  const start = String(tx?.dateStart || tx?.date_start || tx?.date || '').slice(0, 10);
  const end = String(tx?.dateEnd || tx?.date_end || start || '').slice(0, 10);
  return datesOverlap(start, end, rangeStartISO, rangeEndISO);
}

export function addDaysISO(dateISO, days, toISO = null) {
  const iso = String(dateISO || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateISO;
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime())) return dateISO;
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
  if (typeof toISO === 'function') return toISO(d);
  return d.toISOString().slice(0, 10);
}

export function sumRemainingDailyBudget({
  startISO = '',
  endISO = '',
  getDailyBudgetForDate = () => 0,
  toISO = null,
} = {}) {
  const parseUTC = (value) => {
    const iso = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [year, month, day] = iso.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const start = parseUTC(startISO);
  const end = parseUTC(endISO);
  if (!start || !end || start > end) return 0;
  let sum = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const ds = typeof toISO === 'function' ? toISO(cursor) : cursor.toISOString().slice(0, 10);
    sum += Math.max(0, Number(getDailyBudgetForDate(ds)) || 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return sum;
}

export function projectedEndAmount({
  currentTotal = 0,
  remainingBudget = 0,
  convertRemainingBudget = (value) => Number(value) || 0,
} = {}) {
  return (Number(currentTotal) || 0) - (Number(convertRemainingBudget(remainingBudget)) || 0);
}

export function netPendingAmount({
  transactions = [],
  rangeStartISO = '',
  rangeEndISO = '',
  isPendingTransaction = () => false,
  convertAmount = (amount) => Number(amount) || 0,
} = {}) {
  let net = 0;
  for (const tx of Array.isArray(transactions) ? transactions : []) {
    if (!isPendingTransaction(tx)) continue;
    if (!pendingTxOverlaps(tx, rangeStartISO, rangeEndISO)) continue;
    const value = Number(convertAmount(Number(tx?.amount) || 0, tx?.currency || 'EUR', tx?.dateStart || tx?.date_start || rangeStartISO)) || 0;
    const type = String(tx?.type || '').toLowerCase();
    if (type === 'income') net += value;
    else if (type === 'expense') net -= value;
  }
  return net;
}

export function tripNetBalancesAmount({
  rows = [],
  periods = [],
  rangeStartISO = '',
  rangeEndISO = '',
  baseCurrency = 'EUR',
  convertAmount = (amount) => Number(amount) || 0,
  minAbs = 1,
} = {}) {
  const byTrip = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const net = Number(row?.net || 0);
    if (!Number.isFinite(net) || Math.abs(net) < 0.000001) continue;
    if (!tripNetRowInRange(row, rangeStartISO, rangeEndISO, periods)) continue;
    const currency = String(row?.currency || baseCurrency || 'EUR').toUpperCase();
    const converted = convertAmount(net, currency, rangeStartISO);
    if (!Number.isFinite(Number(converted))) continue;
    const key = String(row?.tripId || row?.trip_id || row?.tripName || row?.trip_name || 'trip');
    byTrip.set(key, (byTrip.get(key) || 0) + (Number(converted) || 0));
  }
  let total = 0;
  for (const value of byTrip.values()) {
    if (Math.abs(Number(value) || 0) >= minAbs) total += value;
  }
  return total;
}

export function sumWalletsDisplay({
  wallets = [],
  dateISO = '',
  baseCurrency = 'EUR',
  effectiveBalance = null,
  amountToDisplayForDate = null,
  amountToBase = (amount) => Number(amount) || 0,
} = {}) {
  let total = 0;
  for (const wallet of Array.isArray(wallets) ? wallets : []) {
    const balance = typeof effectiveBalance === 'function'
      ? Number(effectiveBalance(wallet) || 0)
      : (Number(wallet?.balance) || 0);
    const currency = wallet?.currency || baseCurrency;
    if (typeof amountToDisplayForDate === 'function') {
      total += Number(amountToDisplayForDate(balance, currency, dateISO)) || 0;
    } else {
      total += Number(amountToBase(balance, currency)) || 0;
    }
  }
  return total;
}

export function pendingAmountText(value, currency = '', formatter = Intl.NumberFormat) {
  const n = Number(value) || 0;
  const sign = n >= 0 ? '+' : '-';
  let amount = String(Math.round(Math.abs(n)));
  try {
    amount = new formatter(undefined, { maximumFractionDigits: 0 }).format(Math.abs(n));
  } catch (_) {}
  return `${sign} ${amount} ${currency}`.trim();
}

export function parseKpiScope(raw = 'segment') {
  const value = String(raw || 'segment');
  const low = value.toLowerCase();
  if (low === 'segment' || low === 'period') return { kind: low, raw: value };
  if (value.startsWith('seg:')) return { kind: 'seg', segId: value.slice(4), raw: value };
  if (value.startsWith('range:')) {
    const parts = value.split(':');
    return { kind: 'range', startISO: parts[1] || '', endISO: parts[2] || '', raw: value };
  }
  if (low === 'range') return { kind: 'range', startISO: '', endISO: '', raw: value };
  return { kind: 'segment', raw: value };
}

export function resolveKpiRange(parsed = {}, refISO = '', {
  period = {},
  getBudgetSegmentForDate = null,
} = {}) {
  let startISO = String(parsed?.startISO || '');
  let endISO = String(parsed?.endISO || '');
  if (startISO && endISO) return { startISO, endISO };
  try {
    if (typeof getBudgetSegmentForDate === 'function') {
      const seg = getBudgetSegmentForDate(refISO);
      if (seg) {
        startISO = String(seg.start || seg.start_date || '').slice(0, 10);
        endISO = String(seg.end || seg.end_date || '').slice(0, 10);
      }
    }
  } catch (_) {}
  if (!startISO) startISO = String(period?.start || '').slice(0, 10);
  if (!endISO) endISO = String(period?.end || '').slice(0, 10);
  return { startISO, endISO };
}

export function resolveKpiHorizonEnd(scope = 'segment', todayISO = '', {
  period = {},
  getBudgetSegmentForDate = null,
} = {}) {
  let endISO = period?.end;
  try {
    if (String(scope || 'segment').toLowerCase() !== 'period' && typeof getBudgetSegmentForDate === 'function') {
      const seg = getBudgetSegmentForDate(todayISO);
      if (seg && (seg.end || seg.end_date)) endISO = String(seg.end || seg.end_date);
    }
  } catch (_) {}
  return endISO;
}

export function daysPill(daysLeft, labelPrefix, thresholds = { warn: 7, urgent: 4, critical: 2 }) {
  if (!Number.isFinite(Number(daysLeft))) return { level: 'good', text: `${labelPrefix}: ∞` };
  const days = Math.max(0, Number(daysLeft) || 0);
  const rounded = Math.ceil(days);
  if (days <= thresholds.critical) return { level: 'bad', text: `${labelPrefix}: J-${rounded} (URGENT)` };
  if (days <= thresholds.urgent) return { level: 'warn', text: `${labelPrefix}: J-${rounded} (bientôt)` };
  if (days <= thresholds.warn) return { level: 'warn', text: `${labelPrefix}: J-${rounded}` };
  return { level: 'good', text: `${labelPrefix}: ~${Math.floor(days)} j` };
}

export function signPillClass(value, dailyBudgetBase = 1) {
  const n = Number(value) || 0;
  if (n >= 0) return 'good';
  const limit = (Number(dailyBudgetBase) || 1) * 3;
  return Math.abs(n) < limit ? 'warn' : 'bad';
}

export function pendingProjectionItems({
  transactions = [],
  tripRows = [],
  periods = [],
  rangeStartISO = '',
  rangeEndISO = '',
  displayDateISO = '',
  baseCurrency = 'EUR',
  lang = 'fr',
  isPendingTransaction = () => false,
  toPivot = (amount) => Number(amount) || 0,
  toPivotStrict = (amount) => Number(amount) || 0,
  normalizeText = (value) => String(value || '').toLowerCase().trim(),
} = {}) {
  const items = [];
  const isEn = String(lang || 'fr').toLowerCase() === 'en';
  for (const tx of Array.isArray(transactions) ? transactions : []) {
    if (!isPendingTransaction(tx)) continue;
    if (!pendingTxOverlaps(tx, rangeStartISO, rangeEndISO)) continue;
    const type = String(tx?.type || '').toLowerCase();
    const label = String(tx?.label || tx?.subcategory || tx?.category || (type === 'income' ? 'Entrée prévue' : 'Dépense prévue'));
    const dateISO = String(tx?.dateStart || tx?.date_start || rangeStartISO || displayDateISO).slice(0, 10);
    const amount = toPivot(Number(tx?.amount) || 0, tx?.currency || 'EUR', dateISO);
    items.push({
      kind: type === 'income' ? 'receive' : 'pay',
      source: type === 'income' ? (isEn ? 'Receivable' : 'À recevoir') : (isEn ? 'Payable' : 'À payer'),
      label,
      value: type === 'income' ? amount : -amount,
    });
  }

  const byTrip = new Map();
  for (const row of Array.isArray(tripRows) ? tripRows : []) {
    const net = Number(row?.net || 0);
    if (!Number.isFinite(net) || Math.abs(net) < 0.000001) continue;
    if (!tripNetRowInRange(row, rangeStartISO, rangeEndISO, periods)) continue;
    const value = toPivotStrict(net, row?.currency || baseCurrency || 'EUR', rangeStartISO || displayDateISO);
    if (value === null || !Number.isFinite(Number(value))) continue;
    const tripName = String(row?.tripName || row?.trip_name || 'Trip');
    const key = String(row?.tripId || row?.trip_id || tripName);
    const previous = byTrip.get(key) || { label: tripName, value: 0 };
    previous.value += Number(value) || 0;
    byTrip.set(key, previous);
  }
  for (const item of byTrip.values()) {
    if (Math.abs(Number(item.value) || 0) < 1) continue;
    items.push({
      kind: item.value >= 0 ? 'receive' : 'pay',
      source: item.value >= 0 ? (isEn ? 'Trip receivable' : 'À recevoir Trip') : (isEn ? 'Trip payable' : 'À payer Trip'),
      label: item.label,
      value: item.value,
    });
  }

  const grouped = new Map();
  for (const item of items) {
    const key = [item.kind, normalizeText(item.source), normalizeText(item.label)].join('|');
    const previous = grouped.get(key);
    if (previous) {
      previous.value += Number(item.value || 0);
      previous.count += 1;
    } else {
      grouped.set(key, { count: 1, ...item });
    }
  }
  return Array.from(grouped.values())
    .filter((item) => Math.abs(Number(item.value || 0)) >= 1)
    .sort((a, b) => Math.abs(Number(b.value || 0)) - Math.abs(Number(a.value || 0)));
}
