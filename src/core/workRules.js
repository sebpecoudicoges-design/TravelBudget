export const WORK_ACTIVITY_PRESETS = Object.freeze([
  { key: 'fruit_picking_moderate', labelFr: 'Fruit picking modere', labelEn: 'Fruit picking moderate', met: 3.5 },
  { key: 'fruit_picking_vigorous', labelFr: 'Fruit picking physique', labelEn: 'Fruit picking vigorous', met: 4.5 },
  { key: 'farm_harvest_moderate', labelFr: 'Travail agricole modere', labelEn: 'Farm harvest moderate', met: 4.8 },
  { key: 'manual_labor_vigorous', labelFr: 'Travail manuel tres physique', labelEn: 'Manual labor vigorous', met: 6.5 },
]);

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function kcalFromWorkMet({ met = 4.8, kg = 70, minutes = 0, restMinutes = 0, restMet = 1.3 } = {}) {
  const active = Math.max(0, num(minutes, 0));
  const weight = Math.max(1, num(kg, 70));
  const netMet = Math.max(0, num(met, 4.8) - 1);
  return Math.max(0, netMet * weight * (active / 60));
}

export function estimateWorkDayKcal({ hours = 0, breakMinutes = 0, met = 4.8, kg = 70 } = {}) {
  const totalMinutes = Math.max(0, num(hours, 0) * 60);
  const restMinutes = Math.min(totalMinutes, Math.max(0, num(breakMinutes, 0)));
  return kcalFromWorkMet({ met, kg, minutes: totalMinutes - restMinutes, restMinutes });
}

export function workPresetForKey(key) {
  return WORK_ACTIVITY_PRESETS.find((x) => x.key === key) || WORK_ACTIVITY_PRESETS[2];
}

export function workDayNetMinutes(day = {}) {
  const total = Math.max(0, num(day.duration_minutes ?? day.minutes, 0));
  return Math.max(0, total - Math.max(0, num(day.break_minutes, 0)));
}

export function summarizeWorkCareer({ engagements = [], days = [], incomes = [] } = {}) {
  const byEngagement = new Map();
  for (const engagement of engagements || []) {
    byEngagement.set(String(engagement.id), {
      engagement,
      netMinutes: 0,
      netHours: 0,
      totalReceived: 0,
      hourlyNet: null,
      workDays: 0,
      incomeEvents: 0,
    });
  }
  const unassigned = {
    engagement: null, netMinutes: 0, netHours: 0, totalReceived: 0,
    hourlyNet: null, workDays: 0, incomeEvents: 0,
  };

  const bucket = (id) => byEngagement.get(String(id || '')) || unassigned;
  const engagementForDay = (day) => {
    const explicit = byEngagement.get(String(day?.engagement_id || ''));
    if (explicit) return explicit;
    const date = String(day?.work_date || day?.date || '').slice(0, 10);
    if (!date) return unassigned;
    const matches = (engagements || []).filter((engagement) => {
      const start = String(engagement?.start_date || '').slice(0, 10);
      const end = String(engagement?.end_date || '').slice(0, 10);
      return start && date >= start && (!end || date <= end);
    });
    return matches.length === 1 ? bucket(matches[0].id) : unassigned;
  };
  for (const day of days || []) {
    const target = engagementForDay(day);
    target.netMinutes += workDayNetMinutes(day);
    target.workDays += 1;
  }
  for (const income of incomes || []) {
    const target = bucket(income.engagement_id);
    target.totalReceived += Math.max(0, num(income.net_amount, 0));
    target.incomeEvents += 1;
  }

  const all = [...byEngagement.values(), unassigned];
  for (const item of all) {
    item.netHours = item.netMinutes / 60;
    item.hourlyNet = item.netHours > 0 ? item.totalReceived / item.netHours : null;
  }
  const visible = all.filter((item) => item.engagement || item.netMinutes || item.totalReceived);
  const totals = visible.reduce((acc, item) => {
    acc.netMinutes += item.netMinutes;
    acc.totalReceived += item.totalReceived;
    acc.workDays += item.workDays;
    if (item.engagement) {
      acc.workNetMinutes += item.netMinutes;
      acc.workReceived += item.totalReceived;
    }
    return acc;
  }, { netMinutes: 0, totalReceived: 0, workDays: 0, workNetMinutes: 0, workReceived: 0 });
  totals.netHours = totals.netMinutes / 60;
  totals.workNetHours = totals.workNetMinutes / 60;
  totals.hourlyNet = totals.workNetHours > 0 ? totals.workReceived / totals.workNetHours : null;
  return { totals, engagements: visible };
}
