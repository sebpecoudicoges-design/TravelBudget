function datePart(value) {
  return String(value || '').slice(0, 10);
}

function dateValue(value) {
  const [year, month, day] = datePart(value).split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? Date.UTC(year, month - 1, day)
    : NaN;
}

export function addDaysISO(value, days) {
  const timestamp = dateValue(value);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + Number(days || 0) * 86400000).toISOString().slice(0, 10);
}

export function mondayOfWeekISO(value) {
  const timestamp = dateValue(value);
  if (!Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  const weekday = date.getUTCDay() || 7;
  return addDaysISO(value, 1 - weekday);
}

export function daysBetweenISO(from, to) {
  const start = dateValue(from);
  const end = dateValue(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.floor((end - start) / 86400000);
}

export function sessionCode(row) {
  const raw = String(row?.sessionKey || row?.id || row?.name || '').toUpperCase();
  const match = raw.match(/\b([AB][123])\b|_([AB][123])\b|MASS_([AB][123])\b|SQL_([AB][123])\b/);
  return (match?.[1] || match?.[2] || match?.[3] || match?.[4] || '').toUpperCase();
}

export function programDaysFromSqlSessions(rows) {
  const byDay = {};
  (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0))
    .forEach((row) => {
      const day = Math.max(1, Math.min(7, Math.round(Number(row?.day_of_week || 0))));
      const code = sessionCode({ sessionKey: row?.session_key, id: row?.session_key, name: row?.name });
      if (!day || !code) return;
      const list = byDay[day] || [];
      if (!list.includes(code)) list.push(code);
      byDay[day] = list;
    });
  const result = {};
  Object.keys(byDay).forEach((day) => { result[day] = byDay[day].join('/'); });
  return Object.keys(result).length ? result : { 2: 'A1/B1', 4: 'A2/B2', 6: 'A3/B3' };
}

export function currentProgramWeek(program, day) {
  const cycle = String(program?.cycle || '').toUpperCase();
  if (cycle === 'A' || cycle === 'B') return cycle;
  const currentMonday = mondayOfWeekISO(day);
  const startMonday = mondayOfWeekISO(program?.startDate || program?.start_date || day);
  const weeks = Math.max(0, Math.floor(daysBetweenISO(startMonday, currentMonday) / 7));
  return weeks % 2 === 0 ? 'A' : 'B';
}

export function plannedSessionCodeForDay(program, weekday, weekLabel) {
  const parts = String(program?.days?.[weekday] || '').split('/').map((part) => part.trim().toUpperCase()).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  return parts.find((part) => part.startsWith(String(weekLabel || 'A').toUpperCase())) || parts[0] || '';
}

export function plannedSportWeekRows(rows, program, baseDay) {
  if (!program?.enabled) return [];
  const start = mondayOfWeekISO(baseDay);
  const weekLabel = currentProgramWeek(program, baseDay);
  const sessions = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const code = sessionCode(row);
    if (code && !sessions.has(code)) sessions.set(code, row);
  });
  return Array.from({ length: 7 }, (_, index) => {
    const weekday = index + 1;
    const code = plannedSessionCodeForDay(program, weekday, weekLabel);
    const session = code ? sessions.get(code) || null : null;
    return { day: addDaysISO(start, index), weekday, code, session, weekLabel, planned: Boolean(session) };
  });
}

export function nextPlannedSportRow(days, day) {
  const current = datePart(day);
  return (days || []).find((row) => row?.planned && row.day >= current)
    || (days || []).find((row) => row?.planned)
    || null;
}
