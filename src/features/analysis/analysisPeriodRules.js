const iso = (date) => date.toISOString().slice(0, 10);
const atNoon = (value) => new Date(`${value}T12:00:00`);

export function calendarPresetRange(preset, today = iso(new Date())) {
  const date = atNoon(today);
  if (!Number.isFinite(date.getTime())) return { start: '', end: '' };
  if (preset.includes('previous')) date.setDate(date.getDate() - (preset.includes('week') ? 7 : date.getDate()));
  if (preset.includes('week')) {
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    const start = iso(date);
    date.setDate(date.getDate() + 6);
    return { start, end: iso(date) };
  }
  date.setDate(1);
  const start = iso(date);
  date.setMonth(date.getMonth() + 1, 0);
  return { start, end: iso(date) };
}

export function clampRange(range = {}, bounds = {}) {
  let start = String(range.start || '');
  let end = String(range.end || '');
  if (bounds.start && start < bounds.start) start = bounds.start;
  if (bounds.end && end > bounds.end) end = bounds.end;
  return start && end && start <= end ? { start, end } : { start: '', end: '' };
}

export function previousComparableRange({ start, elapsedDays = 0 } = {}) {
  const days = Math.max(1, Number(elapsedDays) || 1);
  const end = atNoon(start);
  end.setDate(end.getDate() - 1);
  const previousEnd = iso(end);
  end.setDate(end.getDate() - days + 1);
  return { start: iso(end), end: previousEnd };
}

export function comparisonMetrics(current = {}, previous = {}) {
  const currentDaily = Number(current.avgPerDay) || 0;
  const previousDaily = Number(previous.avgPerDay) || 0;
  const delta = currentDaily - previousDaily;
  return {
    currentDaily,
    previousDaily,
    delta,
    deltaPct: previousDaily ? delta / previousDaily * 100 : null,
    favorable: delta <= 0,
  };
}
