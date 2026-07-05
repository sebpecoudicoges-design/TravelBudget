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

function restSecondsForItem(item, fallback = 60) {
  const direct = Number(item?.restSeconds ?? item?.rest_seconds);
  return Math.max(0, Math.round(Number.isFinite(direct) ? direct : num(fallback, 60)));
}

export function buildWorkoutSequence(plan = [], options = {}) {
  const items = Array.isArray(plan) ? plan : [];
  const sequence = [];
  if (!items.length) return sequence;

  if (options?.circuitEnabled) {
    const rounds = Number(options?.amrapMinutes) > 0 ? 1 : Math.max(1, Math.round(num(options?.rounds, 4)));
    const roundRestSeconds = Math.max(0, Math.round(num(options?.roundRestSeconds, 0)));
    for (let roundIndex = 1; roundIndex <= rounds; roundIndex += 1) {
      items.forEach((item, itemIndex) => {
        sequence.push({
          kind: 'work', item, itemIndex, setIndex: roundIndex, roundIndex, roundTotal: rounds,
          duration: item?.mode === 'time' ? Math.max(0, num(item?.targetSeconds ?? item?.target_seconds, 0)) : 0,
        });
        const rest = restSecondsForItem(item, options?.defaultRestSeconds);
        if (itemIndex < items.length - 1 && rest > 0) {
          sequence.push({ kind: 'rest', item, itemIndex, setIndex: roundIndex, roundIndex, roundTotal: rounds, duration: rest });
        }
      });
      if (roundIndex < rounds && roundRestSeconds > 0) {
        sequence.push({ kind: 'round_rest', roundIndex, roundTotal: rounds, duration: roundRestSeconds });
      }
    }
    return sequence;
  }

  items.forEach((item, itemIndex) => {
    const sets = Math.max(1, Math.round(num(item?.sets ?? item?.planned_sets, 1)));
    for (let setIndex = 1; setIndex <= sets; setIndex += 1) {
      sequence.push({
        kind: 'work', item, itemIndex, setIndex,
        duration: item?.mode === 'time' ? Math.max(0, num(item?.targetSeconds ?? item?.target_seconds, 0)) : 0,
      });
      const hasNextWork = setIndex < sets || itemIndex < items.length - 1;
      const rest = restSecondsForItem(item, options?.defaultRestSeconds);
      if (hasNextWork && rest > 0) {
        sequence.push({ kind: 'rest', item, itemIndex, setIndex, duration: rest });
      }
    }
  });
  return sequence;
}

export function insertExerciseSet(sequence = [], currentIndex = 0, doneSets = [], options = {}) {
  const current = Array.isArray(sequence) ? sequence.slice() : [];
  const index = Math.max(0, Math.min(current.length - 1, Math.round(num(currentIndex, 0))));
  const step = current[index];
  if (!step?.item || (step.kind !== 'work' && step.kind !== 'rest')) {
    return { sequence: current, inserted: false, setIndex: 0, itemIndex: -1 };
  }

  const itemIndex = Math.max(0, Math.round(num(step.itemIndex, 0)));
  const existingSets = current
    .filter((row) => row?.kind === 'work' && Number(row.itemIndex) === itemIndex)
    .map((row) => Math.round(num(row.setIndex, 1)));
  const completedSets = (Array.isArray(doneSets) ? doneSets : [])
    .filter((row) => Number(row?.itemIndex) === itemIndex)
    .map((row) => Math.round(num(row?.setIndex, 1)));
  const setIndex = Math.max(Math.round(num(step.setIndex, 1)), ...existingSets, ...completedSets) + 1;
  const next = current[index + 1];
  const insertAt = step.kind === 'work' && next?.kind === 'rest' && Number(next.itemIndex) === itemIndex
    ? index + 2
    : index + 1;
  const extra = {
    kind: 'work',
    item: step.item,
    itemIndex,
    setIndex,
    roundIndex: step.roundIndex,
    roundTotal: step.roundTotal,
    duration: step.item?.mode === 'time' ? Math.max(0, num(step.item?.targetSeconds ?? step.item?.target_seconds, 0)) : 0,
  };
  const additions = [extra];
  const rest = restSecondsForItem(step.item, options?.defaultRestSeconds);
  if (rest > 0 && insertAt < current.length) {
    additions.push({
      kind: 'rest', item: step.item, itemIndex, setIndex, duration: rest,
      roundIndex: step.roundIndex, roundTotal: step.roundTotal,
    });
  }
  current.splice(insertAt, 0, ...additions);
  return { sequence: current, inserted: true, insertAt, setIndex, itemIndex };
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

export function finalizeWorkout(input = {}) {
  const startedAtMs = new Date(input.startedAt ?? Date.now()).getTime();
  const endedAtMs = new Date(input.endedAt ?? Date.now()).getTime();
  const safeStart = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
  const safeEnd = Number.isFinite(endedAtMs) ? Math.max(safeStart, endedAtMs) : safeStart;
  const completed = completedWorkout(input.plan, input.doneSets);
  const durationSeconds = Math.max(1, Math.round(num(input.durationSeconds, (safeEnd - safeStart) / 1000)));
  const estimate = typeof input.estimateKcal === 'function'
    ? input.estimateKcal({
      plan: completed.plan,
      doneSets: completed.doneSets,
      bodyWeightKg: num(input.bodyWeightKg, 70),
      durationSeconds,
    })
    : input.estimatedKcal;

  return {
    startedAt: new Date(safeStart).toISOString(),
    endedAt: new Date(safeEnd).toISOString(),
    durationSeconds,
    bodyWeightKg: num(input.bodyWeightKg, 70),
    bodyHeightCm: num(input.bodyHeightCm, 0),
    moodAfter: input.moodAfter || '',
    perceivedEffort: input.perceivedEffort ?? null,
    notes: input.notes || '',
    estimatedKcal: Math.max(1, Math.round(num(estimate, 0))),
    doneSets: completed.doneSets,
    plan: completed.plan,
  };
}

export function buildSportPersistenceRows(summary = {}, context = {}) {
  const plan = Array.isArray(summary.plan) ? summary.plan : [];
  const doneSets = Array.isArray(summary.doneSets) ? summary.doneSets : [];
  const userId = context.userId;
  const sessionId = context.sessionId;
  const startedAt = summary.startedAt || summary.started_at || new Date().toISOString();
  const endedAt = summary.endedAt || summary.ended_at || startedAt;
  const primaryActivity = plan[0]?.activityKey || plan[0]?.activity_key || summary.activity_type || 'strength';

  const session = {
    user_id: userId,
    travel_id: context.travelId || null,
    activity_type: primaryActivity,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: num(summary.durationSeconds ?? summary.duration_seconds, 0),
    mood_after: summary.moodAfter || summary.mood_after || null,
    fatigue: summary.perceivedEffort ?? summary.fatigue ?? null,
    body_weight_kg: summary.bodyWeightKg ?? summary.body_weight_kg ?? null,
    notes: summary.notes || null,
    estimated_kcal: num(summary.estimatedKcal ?? summary.estimated_kcal, 0),
  };

  const items = plan.map((item, index) => ({
    user_id: userId,
    session_id: sessionId,
    activity_key: item.activityKey || item.activity_key || primaryActivity,
    exercise_name: item.exerciseName || item.exercise_name || item.label || primaryActivity,
    equipment: item.equipment || 'mixed',
    mode: item.mode || 'time',
    target_reps: item.targetReps || item.target_reps || null,
    target_seconds: item.targetSeconds || item.target_seconds || null,
    distance_m: item.distanceM || item.distance_m || null,
    planned_sets: item.sets || item.planned_sets || 1,
    rest_seconds: item.restSeconds || item.rest_seconds || 0,
    sort_order: index,
    met_value: item.metValue || item.met_value || null,
    notes: item.notes || null,
  }));

  const sets = doneSets.map((set) => ({
    user_id: userId,
    itemIndex: Math.max(0, Math.round(num(set.itemIndex, 0))),
    set_index: Math.max(1, Math.round(num(set.setIndex ?? set.set_index, 1))),
    reps: set.reps ?? null,
    duration_seconds: num(set.durationSeconds ?? set.duration_seconds, 0),
    weight_kg: num(set.weightKg ?? set.weight_kg, 0) || null,
    distance_m: num(set.distanceM ?? set.distance_m, 0) || null,
    completed_at: set.completedAt || set.completed_at || endedAt,
  }));

  return { session, items, sets };
}

export function bindSportSetRows(sets = [], itemByIndex = new Map()) {
  return (Array.isArray(sets) ? sets : [])
    .map((set) => {
      const itemId = itemByIndex instanceof Map
        ? itemByIndex.get(Number(set.itemIndex))
        : itemByIndex?.[Number(set.itemIndex)];
      const { itemIndex, ...row } = set;
      return { ...row, item_id: itemId };
    })
    .filter((row) => row.item_id);
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
