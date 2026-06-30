// Pure daily-budget rules shared by the legacy adapter and future module views.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function cleanISODate(value) {
  const iso = String(value || '').slice(0, 10);
  return ISO_DATE_RE.test(iso) ? iso : null;
}

function utcDayNumber(iso) {
  if (!cleanISODate(iso)) return NaN;
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function transactionBudgetStart(tx) {
  return cleanISODate(firstDefined(
    tx?.budgetDateStart,
    tx?.budget_date_start,
    tx?.dateStart,
    tx?.date_start,
    tx?.date,
  ));
}

export function transactionBudgetEnd(tx) {
  return cleanISODate(firstDefined(
    tx?.budgetDateEnd,
    tx?.budget_date_end,
    tx?.dateEnd,
    tx?.date_end,
    transactionBudgetStart(tx),
  ));
}

export function isTripBudgetShare(tx) {
  if (String(tx?.type || '').toLowerCase() !== 'expense') return false;
  const payNow = firstDefined(tx?.payNow, tx?.pay_now, true);
  if (payNow) return false;
  if (firstDefined(tx?.affectsBudget, tx?.affects_budget, true) === false) return false;
  if (firstDefined(tx?.outOfBudget, tx?.out_of_budget, false)) return false;

  const label = String(tx?.label || '');
  return !!(
    tx?.tripShareLinkId ||
    tx?.trip_share_link_id ||
    tx?.tripExpenseId ||
    tx?.trip_expense_id ||
    (label.includes('[Trip]') && !label.includes('Avance'))
  );
}

export function isInternalMovement(tx) {
  const internal = !!firstDefined(tx?.isInternal, tx?.is_internal, false);
  return internal && !isTripBudgetShare(tx);
}

export function transactionAffectsDailyBudget(tx) {
  if (String(tx?.type || '').toLowerCase() !== 'expense') return false;
  if (isInternalMovement(tx)) return false;
  if (firstDefined(tx?.affectsBudget, tx?.affects_budget, true) === false) return false;
  return !firstDefined(tx?.outOfBudget, tx?.out_of_budget, false);
}

export function transactionAffectsCash(tx) {
  if (!tx || isInternalMovement(tx)) return false;
  return !!firstDefined(tx?.payNow, tx?.pay_now, true);
}

export function transactionMatchesTravel(tx, activeTravelId) {
  const activeId = String(activeTravelId || '');
  if (!activeId) return true;
  const txTravelId = String(firstDefined(tx?.travelId, tx?.travel_id, ''));
  return !txTravelId || txTravelId === activeId;
}

export function inclusiveDayCount(startISO, endISO) {
  const start = utcDayNumber(startISO);
  const end = utcDayNumber(endISO);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start + 1;
}

export function transactionAmountForDate(tx, dateISO) {
  const target = cleanISODate(dateISO);
  const start = transactionBudgetStart(tx);
  const end = transactionBudgetEnd(tx);
  if (!target || !start || !end || target < start || target > end) return 0;
  const days = inclusiveDayCount(start, end);
  const amount = Number(tx?.amount);
  return days > 0 && Number.isFinite(amount) ? amount / days : 0;
}

export function buildDailyBudgetAllocations(tx, options = {}) {
  if (!transactionAffectsDailyBudget(tx)) return [];

  const start = transactionBudgetStart(tx);
  const end = transactionBudgetEnd(tx);
  const days = inclusiveDayCount(start, end);
  const amount = Number(tx?.amount);
  if (!start || !end || !days || !Number.isFinite(amount) || amount === 0) return [];

  const rows = [];
  const startDay = utcDayNumber(start);
  const label = tx?.label || tx?.category || 'Autre';
  for (let offset = 0; offset < days; offset += 1) {
    const dateStr = new Date((startDay + offset) * DAY_MS).toISOString().slice(0, 10);
    if (options.includesDate && !options.includesDate(dateStr)) continue;
    const baseCurrency = String(options.baseCurrencyForDate?.(dateStr, tx) || tx?.currency || 'EUR').toUpperCase();
    const perDay = amount / days;
    const converted = options.convertAmount
      ? options.convertAmount(perDay, tx?.currency, dateStr, tx, baseCurrency)
      : perDay;
    const amountBase = Number(converted);
    if (!Number.isFinite(amountBase)) continue;
    rows.push({
      id: options.idFactory ? options.idFactory(tx, dateStr) : `${tx?.id || 'tx'}:${dateStr}`,
      txId: tx?.id || null,
      dateStr,
      amountBase,
      baseCurrency,
      label,
    });
  }
  return rows;
}

export function summarizeDailyBudget({ dailyBudget = 0, allocations = [], assetAllocations = [] } = {}) {
  const transactionRows = Array.isArray(allocations) ? allocations.filter(Boolean) : [];
  const assetRows = Array.isArray(assetAllocations) ? assetAllocations.filter(Boolean) : [];
  const transactionUsed = transactionRows.reduce((sum, row) => sum + (Number(row.amountBase) || 0), 0);
  const assetUsed = assetRows.reduce((sum, row) => sum + (Number(row.amountBase) || 0), 0);
  const daily = Number(dailyBudget) || 0;
  return {
    daily,
    used: transactionUsed + assetUsed,
    transactionUsed,
    assetUsed,
    remaining: daily - transactionUsed - assetUsed,
    rows: [...transactionRows, ...assetRows],
  };
}

