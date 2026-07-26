const DAILY_BUDGET_VIEW_KEY = 'travelbudget_daily_budget_view_v1';
export const DAILY_BUDGET_WINDOW_DAYS = 7;

function parseISODate(iso, parseISO) {
  if (typeof parseISO === 'function') return parseISO(iso);
  const date = iso ? new Date(`${iso}T00:00:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDashboardDays(dateISO, delta, {
  parseISO = null,
} = {}) {
  const date = parseISODate(dateISO, parseISO);
  if (!date) return dateISO;
  const next = new Date(date);
  next.setDate(next.getDate() + (Number(delta) || 0));
  return formatISODate(next);
}

export function clampDashboardISO(dateISO, minISO, maxISO, {
  parseISO = null,
} = {}) {
  const date = parseISODate(dateISO, parseISO);
  const min = parseISODate(minISO, parseISO);
  const max = parseISODate(maxISO, parseISO);
  if (!date || !min || !max) return dateISO;
  return date < min ? minISO : (date > max ? maxISO : dateISO);
}

export function loadDailyBudgetView(storage = null) {
  try {
    const store = storage || globalThis?.localStorage;
    const raw = store?.getItem?.(DAILY_BUDGET_VIEW_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value.startISO === 'string' ? value : null;
  } catch (_) {
    return null;
  }
}

export function saveDailyBudgetView(view, storage = null) {
  try {
    const store = storage || globalThis?.localStorage;
    store?.setItem?.(DAILY_BUDGET_VIEW_KEY, JSON.stringify(view || {}));
  } catch (_) {}
}
