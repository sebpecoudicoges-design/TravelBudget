import { transactionBudgetStart, transactionBudgetEnd } from '../../core/dailyBudgetRules.js';
export const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const internalAccounting = tx => !!(tx.isInternal ?? tx.is_internal) || !!(tx.internalTransferId ?? tx.internal_transfer_id);
export function budgetWindow(tx) {
  const start = transactionBudgetStart(tx), end = transactionBudgetEnd(tx);
  return validDay(start) && validDay(end) && start <= end ? { start, end } : null;
}
const day = iso => Date.parse(iso) / 86400000;
// Same inclusive day proration as Analysis; cumulative cents preserve signed totals across periods.
export function allocateBudgetAmount(amount, window, start, end) {
  if (!window || !validDay(start) || !validDay(end) || start > end) return 0;
  const from = window.start > start ? window.start : start, to = window.end < end ? window.end : end;
  if (from > to) return 0;
  if (!Number.isFinite(amount)) return null;
  const length = day(window.end) - day(window.start) + 1, sign = amount < 0 ? -1 : 1, cents = Math.round(Math.abs(amount) * 100);
  return sign * (Math.round(cents * (day(to) - day(window.start) + 1) / length) - Math.round(cents * (day(from) - day(window.start)) / length)) / 100;
}
export function accountingFxDate(tx, today) {
  const cash = String(tx.cashDate || tx.dateStart || tx.date_start || '').slice(0, 10), window = budgetWindow(tx);
  return validDay(cash) && cash <= today ? cash : window && window.start <= today ? window.start : today;
}

export function settledAt(tx, today) {
  const cash = String(tx.cashDate || tx.dateStart || tx.date_start || '').slice(0, 10);
  return (tx.payNow ?? tx.pay_now) !== false && validDay(cash) && cash <= today;
}
export function needsAccountingTransaction(tx, start, end, today) {
  if (internalAccounting(tx)) return false;
  const window = budgetWindow(tx);
  if (!window) return false;
  const until = end < today ? end : today;
  const period = window.start <= until && window.end >= start;
  const accrual = settledAt(tx, today) ? window.end > today : window.start <= today;
  return period || accrual;
}
