export const SPORT_REST_MET = 1.3;

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function kcalFromMet({ met, kg, minutes, seconds, loadKg = 0 }) {
  const totalMinutes = Number.isFinite(Number(minutes))
    ? num(minutes, 0)
    : num(seconds, 0) / 60;
  const effectiveKg = Math.max(1, num(kg, 70) + Math.max(0, num(loadKg, 0)));
  return Math.max(0, (Math.max(0, num(met, 1)) * 3.5 * effectiveKg / 200) * Math.max(0, totalMinutes));
}

export function estimateSportSessionKcal({ workSeconds = 0, restSeconds = 0, workMet = 5, restMet = SPORT_REST_MET, kg = 70, loadKg = 0 }) {
  return kcalFromMet({ met: workMet, kg, seconds: workSeconds, loadKg })
    + kcalFromMet({ met: restMet, kg, seconds: restSeconds, loadKg: 0 });
}

export function totalPlanWorkSeconds(items = []) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const sets = Math.max(1, Math.round(num(item?.sets, item?.planned_sets || 1)));
    const perSet = num(item?.target_seconds ?? item?.targetSeconds ?? item?.durationSeconds, 0);
    return sum + Math.max(0, perSet) * sets;
  }, 0);
}

export function totalPlanRestSeconds(items = []) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const sets = Math.max(1, Math.round(num(item?.sets, item?.planned_sets || 1)));
    return sum + Math.max(0, num(item?.rest_seconds ?? item?.restSeconds, 0)) * sets;
  }, 0);
}
