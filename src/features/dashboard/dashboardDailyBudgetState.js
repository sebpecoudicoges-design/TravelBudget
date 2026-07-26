const DAILY_BUDGET_VIEW_KEY = 'tb_daily_budget_view_v1';
export const DAILY_BUDGET_WINDOW_DAYS = 7;

function parseISODate(iso) {
  const date = iso ? new Date(`${iso}T00:00:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dailyBudgetStore(storage) {
  return storage || localStorage;
}

export function addDashboardDays(dateISO, delta) {
  const date = parseISODate(dateISO);
  if (!date) return dateISO;
  const next = new Date(date);
  next.setDate(next.getDate() + (Number(delta) || 0));
  return formatISODate(next);
}

export function clampDashboardISO(dateISO, minISO, maxISO) {
  if (!dateISO || !minISO || !maxISO) return dateISO;
  return dateISO < minISO ? minISO : (dateISO > maxISO ? maxISO : dateISO);
}

export function loadDailyBudgetView(storage = null) {
  try {
    const raw = dailyBudgetStore(storage)?.getItem?.(DAILY_BUDGET_VIEW_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value.startISO === 'string' ? value : null;
  } catch (_) {
    return null;
  }
}

export function saveDailyBudgetView(view, storage = null) {
  try {
    dailyBudgetStore(storage)?.setItem?.(DAILY_BUDGET_VIEW_KEY, JSON.stringify(view || {}));
  } catch (_) {}
}
