import { appendCircuitRound, insertExerciseSet } from '../../core/sportRules.js';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cloneTimer(timer = {}) {
  return {
    ...timer,
    sequence: Array.isArray(timer.sequence) ? timer.sequence.slice() : [],
    doneSets: Array.isArray(timer.doneSets) ? timer.doneSets.slice() : [],
  };
}

export function currentTimerStep(timer = {}) {
  const sequence = Array.isArray(timer.sequence) ? timer.sequence : [];
  const index = Math.max(0, Math.round(num(timer.index, 0)));
  return sequence[index] || null;
}

export function defaultStepValues(step = {}, options = {}) {
  const item = step?.item || {};
  const bodyWeightKg = num(options.bodyWeightKg, 70);
  const effectiveLoadKg = typeof options.effectiveLoadKg === 'function'
    ? options.effectiveLoadKg(item, bodyWeightKg)
    : num(item.weightKg ?? item.weight_kg, 0);
  const load = typeof options.lastLoadForExercise === 'function'
    ? options.lastLoadForExercise(item, effectiveLoadKg)
    : effectiveLoadKg;
  return {
    stepLoadKg: step?.kind === 'work' ? num(load, effectiveLoadKg) : 0,
    stepReps: step?.kind === 'work' && item.mode === 'reps'
      ? Math.max(0, Math.round(num(item.targetReps ?? item.target_reps, 0)))
      : null,
  };
}

export function createTimerState(input = {}) {
  const sequence = Array.isArray(input.sequence) ? input.sequence : [];
  const now = Math.max(0, num(input.now, Date.now()));
  const first = sequence[0] || null;
  const defaults = defaultStepValues(first, {
    bodyWeightKg: input.bodyWeightKg,
    effectiveLoadKg: input.effectiveLoadKg,
    lastLoadForExercise: input.lastLoadForExercise,
  });
  return {
    sequence,
    index: 0,
    startedAt: now,
    stepStartedAt: now,
    stepEndAt: first?.duration ? now + (num(first.duration, 0) * 1000) : null,
    paused: false,
    pauseStartedAt: null,
    doneSets: [],
    roundsCompleted: 0,
    timeCapEndAt: input.timeCapMinutes > 0 ? now + num(input.timeCapMinutes, 0) * 60000 : null,
    bodyWeightKg: num(input.bodyWeightKg, 70),
    bodyHeightCm: num(input.bodyHeightCm, 0),
    ...defaults,
  };
}

export function applyStepDefaults(timer = {}, step = {}, options = {}) {
  const next = cloneTimer(timer);
  const defaults = defaultStepValues(step, {
    bodyWeightKg: next.bodyWeightKg,
    effectiveLoadKg: options.effectiveLoadKg,
    lastLoadForExercise: options.lastLoadForExercise,
  });
  next.stepLoadKg = defaults.stepLoadKg;
  next.stepReps = defaults.stepReps;
  return next;
}

export function buildDoneSetForStep(timer = {}, step = {}, options = {}) {
  if (!step || step.kind !== 'work') return null;
  const item = step.item || {};
  const now = Math.max(0, num(options.now, Date.now()));
  const elapsedSeconds = Math.max(1, Math.round(num(options.elapsedSeconds, (now - num(timer.stepStartedAt, now)) / 1000)));
  const targetSeconds = num(item.targetSeconds ?? item.target_seconds ?? step.duration, 0);
  const durationSeconds = Math.max(1, Math.round(num(
    options.durationSeconds,
    item.mode === 'time' && targetSeconds > 0 ? targetSeconds : elapsedSeconds,
  )));
  const supportsExternalLoad = typeof options.supportsExternalLoad === 'function'
    ? options.supportsExternalLoad(item)
    : true;
  const bodyWeightKg = num(timer.bodyWeightKg, 70);
  const effectiveLoadKg = typeof options.effectiveLoadKg === 'function'
    ? options.effectiveLoadKg(item, bodyWeightKg)
    : num(item.weightKg ?? item.weight_kg, 0);
  const fallbackLoad = typeof options.lastLoadForExercise === 'function'
    ? options.lastLoadForExercise(item, effectiveLoadKg)
    : effectiveLoadKg;
  return {
    itemIndex: Math.max(0, Math.round(num(step.itemIndex, 0))),
    setIndex: Math.max(1, Math.round(num(step.setIndex, 1))),
    reps: item.mode === 'reps' ? Math.max(0, Math.round(num(options.reps, item.targetReps ?? item.target_reps ?? 0))) : null,
    durationSeconds,
    weightKg: supportsExternalLoad ? num(options.loadKg, fallbackLoad) : 0,
    distanceM: num(item.distanceM ?? item.distance_m, 0),
    completedAt: new Date(now).toISOString(),
  };
}

export function recordWorkStep(timer = {}, step = {}, options = {}) {
  const next = cloneTimer(timer);
  if (!step || step.kind !== 'work') return { timer: next, addedSet: null };
  const itemIndex = Math.max(0, Math.round(num(step.itemIndex, 0)));
  const setIndex = Math.max(1, Math.round(num(step.setIndex, 1)));
  const exists = next.doneSets.some((done) =>
    Number(done?.itemIndex) === itemIndex && Number(done?.setIndex) === setIndex
  );
  if (exists) return { timer: next, addedSet: null };
  const doneSet = buildDoneSetForStep(next, step, options);
  next.doneSets.push(doneSet);
  const defaults = defaultStepValues(step, {
    bodyWeightKg: next.bodyWeightKg,
    effectiveLoadKg: options.effectiveLoadKg,
    lastLoadForExercise: options.lastLoadForExercise,
  });
  next.stepLoadKg = defaults.stepLoadKg;
  return { timer: next, addedSet: doneSet };
}

export function completeTimerStep(timer = {}, options = {}) {
  const now = Math.max(0, num(options.now, Date.now()));
  let nextTimer = cloneTimer(timer);
  const step = currentTimerStep(nextTimer);
  let addedSet = null;
  if (!step) return { timer: nextTimer, step: null, nextStep: null, addedSet, finished: true, looped: false };
  if (options.recordCurrent !== false && step.kind === 'work') {
    const recorded = recordWorkStep(nextTimer, step, { ...options, now });
    nextTimer = recorded.timer;
    addedSet = recorded.addedSet;
  }
  nextTimer.index = Math.max(0, Math.round(num(nextTimer.index, 0))) + 1;
  let nextStep = currentTimerStep(nextTimer);

  if (!nextStep && nextTimer.timeCapEndAt && now < nextTimer.timeCapEndAt) {
    const nextRound = Math.max(0, Math.round(num(nextTimer.roundsCompleted, 0))) + 1;
    nextTimer.roundsCompleted = nextRound;
    const nextRoundIndex = nextRound + 1;
    nextTimer.sequence = nextTimer.sequence.map((row) => {
      if (!row || (row.kind !== 'work' && row.kind !== 'rest' && row.kind !== 'round_rest')) return row;
      return {
        ...row,
        setIndex: row.kind === 'round_rest' ? row.setIndex : nextRoundIndex,
        roundIndex: nextRoundIndex,
      };
    });
    nextTimer.index = 0;
    nextStep = currentTimerStep(nextTimer);
    nextTimer = applyStepDefaults(nextTimer, nextStep, options);
    nextTimer.stepStartedAt = now;
    nextTimer.stepEndAt = nextStep?.duration ? now + (num(nextStep.duration, 0) * 1000) : null;
    return { timer: nextTimer, step, nextStep, addedSet, finished: false, looped: true };
  }

  if (!nextStep) return { timer: nextTimer, step, nextStep: null, addedSet, finished: true, looped: false };
  nextTimer = applyStepDefaults(nextTimer, nextStep, options);
  nextTimer.stepStartedAt = now;
  nextTimer.stepEndAt = nextStep?.duration ? now + (num(nextStep.duration, 0) * 1000) : null;
  return { timer: nextTimer, step, nextStep, addedSet, finished: false, looped: false };
}

export function skipRestStep(timer = {}, options = {}) {
  const now = Math.max(0, num(options.now, Date.now()));
  let nextTimer = cloneTimer(timer);
  const step = currentTimerStep(nextTimer);
  if (!step || (step.kind !== 'rest' && step.kind !== 'round_rest')) {
    return { timer: nextTimer, step, nextStep: step || null, skipped: false, finished: false };
  }
  nextTimer.index = Math.max(0, Math.round(num(nextTimer.index, 0))) + 1;
  const nextStep = currentTimerStep(nextTimer);
  if (!nextStep) return { timer: nextTimer, step, nextStep: null, skipped: true, finished: true };
  nextTimer = applyStepDefaults(nextTimer, nextStep, options);
  nextTimer.stepStartedAt = now;
  nextTimer.stepEndAt = nextStep?.duration ? now + (num(nextStep.duration, 0) * 1000) : null;
  return { timer: nextTimer, step, nextStep, skipped: true, finished: false };
}

export function adjustCurrentStepSeconds(timer = {}, deltaSeconds = 0, options = {}) {
  const now = Math.max(0, num(options.now, Date.now()));
  const next = cloneTimer(timer);
  const step = currentTimerStep(next);
  if (!step || !step.duration || next.paused) return { timer: next, adjusted: false };
  const nextEnd = Math.max(now + 1000, num(next.stepEndAt, now) + (num(deltaSeconds, 0) * 1000));
  next.stepEndAt = nextEnd;
  next.sequence[next.index] = {
    ...step,
    duration: Math.max(1, Math.round((nextEnd - num(next.stepStartedAt, now)) / 1000)),
  };
  return { timer: next, adjusted: true };
}

export function addSetForCurrentExercise(timer = {}, plan = [], options = {}) {
  const next = cloneTimer(timer);
  const step = currentTimerStep(next);
  if (!step?.item) return { timer: next, plan: Array.isArray(plan) ? plan.slice() : [], inserted: false };
  const result = insertExerciseSet(next.sequence, next.index, next.doneSets, options);
  if (!result.inserted) return { timer: next, plan: Array.isArray(plan) ? plan.slice() : [], inserted: false };
  const nextPlan = (Array.isArray(plan) ? plan : []).map((item, index) => {
    if (index !== result.itemIndex) return item;
    return { ...item, sets: Math.max(Math.round(num(item?.sets, 1)), result.setIndex) };
  });
  next.sequence = result.sequence;
  return { timer: next, plan: nextPlan, inserted: true, itemIndex: result.itemIndex, setIndex: result.setIndex, item: step.item };
}

export function addCircuitRound(timer = {}, plan = [], circuit = {}) {
  const next = cloneTimer(timer);
  const result = appendCircuitRound(next.sequence, plan, { roundRestSeconds: circuit.roundRestSeconds });
  const roundIndex = Math.max(0, Math.round(num(result.roundIndex, 0)));
  const nextPlan = (Array.isArray(plan) ? plan : []).map((item) => ({
    ...item,
    sets: Math.max(Math.round(num(item?.sets, 1)), roundIndex),
  }));
  next.sequence = result.sequence;
  return {
    timer: next,
    plan: nextPlan,
    circuit: { ...circuit, rounds: Math.max(Math.round(num(circuit.rounds, 1)), roundIndex) },
    roundIndex,
  };
}

export function togglePause(timer = {}, options = {}) {
  const now = Math.max(0, num(options.now, Date.now()));
  const next = cloneTimer(timer);
  if (!next.paused) {
    next.paused = true;
    next.pauseStartedAt = now;
    return { timer: next, paused: true };
  }
  const delta = now - num(next.pauseStartedAt, now);
  next.paused = false;
  next.pauseStartedAt = null;
  if (next.stepEndAt) next.stepEndAt += delta;
  if (next.timeCapEndAt) next.timeCapEndAt += delta;
  return { timer: next, paused: false, deltaMs: delta };
}
