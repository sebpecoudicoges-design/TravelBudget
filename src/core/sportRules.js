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

export function completedWorkout(plan = [], doneSets = []) {
  const sourcePlan = Array.isArray(plan) ? plan : [];
  const actualSets = (Array.isArray(doneSets) ? doneSets : []).filter((set) => set && set.estimated !== true);
  const performedIndexes = [...new Set(actualSets
    .map((set) => Math.max(0, Math.round(num(set.itemIndex, -1))))
    .filter((index) => index >= 0 && index < sourcePlan.length))];
  const nextIndex = new Map(performedIndexes.map((oldIndex, index) => [oldIndex, index]));
  const completedPlan = performedIndexes.map((oldIndex) => {
    const setCount = actualSets.filter((set) => Math.round(num(set.itemIndex, -1)) === oldIndex).length;
    return { ...sourcePlan[oldIndex], sets: setCount };
  });
  const completedSets = actualSets
    .filter((set) => nextIndex.has(Math.round(num(set.itemIndex, -1))))
    .map((set) => ({ ...set, itemIndex: nextIndex.get(Math.round(num(set.itemIndex, -1))) }));
  return { plan: completedPlan, doneSets: completedSets };
}

export function appendCircuitRound(sequence = [], plan = [], options = {}) {
  const current = Array.isArray(sequence) ? sequence.slice() : [];
  const items = Array.isArray(plan) ? plan : [];
  if (!items.length) return { sequence: current, roundIndex: 0 };

  const previousRound = current
    .filter((step) => step?.kind === 'work')
    .reduce((max, step) => Math.max(max, Math.round(num(step?.roundIndex ?? step?.setIndex, 0))), 0);
  const roundIndex = previousRound + 1;
  const roundRestSeconds = Math.max(0, Math.round(num(options?.roundRestSeconds, 0)));

  if (current.some((step) => step?.kind === 'work') && roundRestSeconds > 0) {
    current.push({ kind: 'round_rest', roundIndex: previousRound, roundTotal: roundIndex, duration: roundRestSeconds });
  }

  items.forEach((item, itemIndex) => {
    current.push({
      kind: 'work', item, itemIndex, setIndex: roundIndex, roundIndex, roundTotal: roundIndex,
      duration: item?.mode === 'time' ? Math.max(0, num(item?.targetSeconds ?? item?.target_seconds, 0)) : 0,
    });
    const restSeconds = Math.max(0, Math.round(num(item?.restSeconds ?? item?.rest_seconds, 0)));
    if (itemIndex < items.length - 1 && restSeconds > 0) {
      current.push({ kind: 'rest', item, itemIndex, setIndex: roundIndex, roundIndex, roundTotal: roundIndex, duration: restSeconds });
    }
  });

  current.forEach((step) => {
    if (step?.roundIndex) step.roundTotal = roundIndex;
  });
  return { sequence: current, roundIndex };
}
