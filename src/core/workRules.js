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
  const rest = Math.max(0, num(restMinutes, 0));
  const weight = Math.max(1, num(kg, 70));
  const activeKcal = (Math.max(0, num(met, 4.8)) * 3.5 * weight / 200) * active;
  const restKcal = (Math.max(0, num(restMet, 1.3)) * 3.5 * weight / 200) * rest;
  return Math.max(0, activeKcal + restKcal);
}

export function estimateWorkDayKcal({ hours = 0, breakMinutes = 0, met = 4.8, kg = 70 } = {}) {
  const totalMinutes = Math.max(0, num(hours, 0) * 60);
  const restMinutes = Math.min(totalMinutes, Math.max(0, num(breakMinutes, 0)));
  return kcalFromWorkMet({ met, kg, minutes: totalMinutes - restMinutes, restMinutes });
}

export function workPresetForKey(key) {
  return WORK_ACTIVITY_PRESETS.find((x) => x.key === key) || WORK_ACTIVITY_PRESETS[2];
}
