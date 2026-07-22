function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const SPORT_RECOMMENDATION_CODES = Object.freeze({
  TOP_RANGE_ALL_SETS: 'TOP_RANGE_ALL_SETS', TOP_RANGE_SINGLE_HEAVY_SET: 'TOP_RANGE_SINGLE_HEAVY_SET',
  HEAVIEST_SET_VALIDATED: 'HEAVIEST_SET_VALIDATED', HEAVIEST_SET_BELOW_MIN_REPS: 'HEAVIEST_SET_BELOW_MIN_REPS',
  KEEP_WEIGHT_BUILD_REPS: 'KEEP_WEIGHT_BUILD_REPS', INCREASE_WEIGHT: 'INCREASE_WEIGHT',
  DECREASE_AFTER_FAILURES: 'DECREASE_AFTER_FAILURES', DELOAD_RECOMMENDED: 'DELOAD_RECOMMENDED',
  EXCEPTIONAL_PERFORMANCE_CONFIRM: 'EXCEPTIONAL_PERFORMANCE_CONFIRM', NO_VALID_WORK_SET: 'NO_VALID_WORK_SET',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
});

export function estimatedOneRepMax(weightKg, reps) {
  const weight = Math.max(0, num(weightKg));
  const repetitions = Math.max(0, num(reps));
  return weight && repetitions ? weight * (1 + repetitions / 30) : 0;
}

export function isValidSportWorkSet(set = {}) {
  if ((set.completed ?? set.isCompleted ?? set.is_completed) === false || set.estimated === true) return false;
  const excluded = ['warmup','isWarmup','is_warmup','failed','isFailed','is_failed','partial','isPartial','is_partial','invalid','isInvalid','is_invalid','technicalInvalid','technical_invalid'];
  return !excluded.some((key) => set[key] === true) && num(set.reps) > 0 && num(set.weightKg ?? set.weight_kg) > 0;
}

export function smoothedEstimatedOneRepMax(sessionE1rms = [], limit = 4) {
  const values = sessionE1rms.map(Number).filter((value) => value > 0).slice(0, Math.max(1, Math.min(5, Math.round(num(limit, 4)))));
  if (!values.length) return 0;
  const weights = [0.4, 0.3, 0.2, 0.1, 0.05].slice(0, values.length);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / total;
}

export function analyzeExerciseLoadProgression(input = {}) {
  const sets = Array.isArray(input.sets) ? input.sets : [];
  const repMin = Math.max(1, Math.round(num(input.repMin ?? input.rep_min, 1)));
  const repMax = Math.max(repMin, Math.round(num(input.repMax ?? input.rep_max, repMin)));
  const plannedSets = Math.max(1, Math.round(num(input.plannedSets ?? input.planned_sets, sets.length || 1)));
  const incrementKg = Math.max(0, num(input.incrementKg ?? input.increment_kg, 2.5));
  const tmPercentage = Math.max(0.85, Math.min(1, num(input.trainingMaxPercentage ?? input.training_max_percentage, 0.95)));
  const validSets = sets.filter(isValidSportWorkSet).map((set) => ({ ...set, weightKg: num(set.weightKg ?? set.weight_kg), reps: Math.round(num(set.reps)) }));
  const successful = validSets.filter((set) => set.reps >= repMin);
  const heaviestAttemptedWeightKg = validSets.length ? Math.max(...validSets.map((set) => set.weightKg)) : 0;
  const referenceWeightKg = successful.length ? Math.max(...successful.map((set) => set.weightKg)) : 0;
  const atReference = successful.filter((set) => set.weightKg === referenceWeightKg);
  const best = validSets.reduce((current, set) => {
    const e1rmKg = estimatedOneRepMax(set.weightKg, set.reps);
    return !current || e1rmKg > current.e1rmKg ? { ...set, e1rmKg } : current;
  }, null);
  const latestE1rmKg = best?.e1rmKg || 0;
  const prior = Array.isArray(input.recentSessionE1rms) ? input.recentSessionE1rms : [];
  const smoothedE1rmKg = smoothedEstimatedOneRepMax([latestE1rmKg, ...prior]);
  const previousSmoothed = num(input.previousSmoothedE1rmKg ?? input.previous_smoothed_e1rm_kg, prior[0] || 0);
  const exceptional = previousSmoothed > 0 && latestE1rmKg > previousSmoothed * 1.10;
  const trainingMaxKg = (smoothedE1rmKg || latestE1rmKg) * tmPercentage;
  const allAtReference = successful.length >= plannedSets && successful.every((set) => set.weightKg === referenceWeightKg);
  const allAtTop = allAtReference && atReference.slice(0, plannedSets).every((set) => set.reps >= repMax);
  let recommendedWeightKg = referenceWeightKg || num(input.currentProgramWeightKg ?? input.current_program_weight_kg);
  let reasonCode = SPORT_RECOMMENDATION_CODES.NO_VALID_WORK_SET;
  let reasonText = 'Aucune serie de travail valide : conserver la charge actuelle.';
  if (referenceWeightKg) {
    if (allAtTop) {
      recommendedWeightKg += incrementKg; reasonCode = SPORT_RECOMMENDATION_CODES.TOP_RANGE_ALL_SETS;
      reasonText = `Haut de plage atteint sur ${plannedSets} serie(s) a ${referenceWeightKg} kg : augmenter de ${incrementKg} kg.`;
    } else if (atReference.length === 1 && atReference[0].reps >= repMax) {
      reasonCode = SPORT_RECOMMENDATION_CODES.TOP_RANGE_SINGLE_HEAVY_SET;
      reasonText = `Charge maximale validee sur une seule serie : confirmer ${referenceWeightKg} kg sur plusieurs series.`;
    } else {
      reasonCode = SPORT_RECOMMENDATION_CODES.KEEP_WEIGHT_BUILD_REPS;
      reasonText = `Charge validee a ${referenceWeightKg} kg, mais haut de plage non atteint sur toutes les series.`;
    }
    const highestAttempt = validSets.find((set) => set.weightKg === heaviestAttemptedWeightKg);
    if (heaviestAttemptedWeightKg > referenceWeightKg && highestAttempt?.reps < repMin) {
      reasonCode = SPORT_RECOMMENDATION_CODES.HEAVIEST_SET_BELOW_MIN_REPS;
      reasonText = `${heaviestAttemptedWeightKg} kg essaye, mais sous le minimum de ${repMin} repetitions ; conserver ${referenceWeightKg} kg.`;
    }
  }
  const aggressive = trainingMaxKg > 0 && recommendedWeightKg > trainingMaxKg;
  if (exceptional || aggressive) { reasonCode = SPORT_RECOMMENDATION_CODES.EXCEPTIONAL_PERFORMANCE_CONFIRM; reasonText += ' Augmentation inhabituelle a confirmer.'; }
  return {
    currentProgramWeightKg: num(input.currentProgramWeightKg ?? input.current_program_weight_kg), latestWeightKg: best?.weightKg || 0,
    latestReps: best?.reps || 0, latestE1rmKg, bestRecentWeightKg: best?.weightKg || 0, bestRecentReps: best?.reps || 0,
    bestRecentE1rmKg: Math.max(latestE1rmKg, ...prior.map((value) => num(value))),
    smoothedE1rmKg, trainingMaxPercentage: tmPercentage, trainingMaxKg, heaviestAttemptedWeightKg, referenceWeightKg,
    setsAtReferenceWeight: atReference.length, recommendedWeightKg, recommendedRepsMin: repMin, recommendedRepsMax: repMax,
    incrementKg, reasonCode, reasonText, confidence: exceptional || aggressive ? 'low' : (allAtTop || atReference.length > 1 ? 'high' : 'medium'),
    recommendationStatus: 'pending', exceptionalPerformance: exceptional,
  };
}

export function analyzeWorkoutLoadProgression(summary = {}, options = {}) {
  const plan = Array.isArray(summary.plan) ? summary.plan : [];
  const doneSets = Array.isArray(summary.doneSets) ? summary.doneSets : [];
  return plan.map((item, itemIndex) => {
    if (String(item?.mode || 'reps') !== 'reps' || num(item?.weightKg ?? item?.default_weight_kg) <= 0) return null;
    const exerciseKey = item?.exerciseKey || item?.exercise_key || '';
    const context = options?.byExerciseKey?.[exerciseKey] || {};
    return { itemIndex, exerciseKey, programExerciseId: item?.programExerciseId || item?.program_exercise_id || null,
      exerciseName: item?.exerciseName || item?.exercise_name || '', ...analyzeExerciseLoadProgression({
        sets: doneSets.filter((set) => Math.round(num(set?.itemIndex, -1)) === itemIndex), repMin: item?.repMin ?? item?.rep_min ?? item?.targetReps,
        repMax: item?.repMax ?? item?.rep_max ?? item?.targetReps, plannedSets: item?.sets ?? item?.planned_sets,
        incrementKg: item?.incrementKg ?? item?.increment_kg ?? context.incrementKg ?? options.defaultIncrementKg,
        trainingMaxPercentage: item?.trainingMaxPercentage ?? item?.training_max_percentage ?? context.trainingMaxPercentage,
        currentProgramWeightKg: item?.weightKg ?? item?.default_weight_kg, recentSessionE1rms: context.recentSessionE1rms,
        previousSmoothedE1rmKg: context.smoothedE1rmKg,
      }) };
  }).filter(Boolean);
}

export function buildLoadProgressionPersistenceRows(analyses = [], context = {}) {
  const userId = context.userId, sessionId = context.sessionId || null, at = context.calculatedAt || new Date().toISOString();
  const valid = analyses.filter((row) => row?.exerciseKey);
  return {
    metrics: valid.map((r) => ({ user_id:userId, exercise_id:r.exerciseKey, latest_weight_kg:r.latestWeightKg||null, latest_reps:r.latestReps||null,
      latest_e1rm_kg:r.latestE1rmKg||null, best_recent_weight_kg:r.bestRecentWeightKg||r.latestWeightKg||null, best_recent_reps:r.bestRecentReps||r.latestReps||null,
      best_recent_e1rm_kg:r.bestRecentE1rmKg||null, best_all_time_e1rm_kg:Math.max(num(r.bestAllTimeE1rmKg),num(r.latestE1rmKg))||null,
      smoothed_e1rm_kg:r.smoothedE1rmKg||null, training_max_percentage:r.trainingMaxPercentage, training_max_kg:r.trainingMaxKg||null,
      reference_weight_kg:r.referenceWeightKg||null, recommended_weight_kg:r.recommendedWeightKg||null, recommended_reps_min:r.recommendedRepsMin,
      recommended_reps_max:r.recommendedRepsMax, recommendation_reason:r.reasonText, recommendation_status:'pending', calculated_at:at, updated_at:at })),
    history: valid.map((r) => ({ user_id:userId, exercise_id:r.exerciseKey, session_id:sessionId, weight_kg:r.latestWeightKg||null, reps:r.latestReps||null,
      estimated_1rm_kg:r.latestE1rmKg||null, smoothed_1rm_kg:r.smoothedE1rmKg||null, training_max_kg:r.trainingMaxKg||null,
      reference_weight_kg:r.referenceWeightKg||null, recommended_weight_kg:r.recommendedWeightKg||null, calculation_method:'epley', created_at:at })),
    recommendations: valid.map((r) => ({ user_id:userId, exercise_id:r.exerciseKey, program_exercise_id:r.programExerciseId||null,
      source_session_id:sessionId, current_program_weight_kg:r.currentProgramWeightKg||null, heaviest_successful_weight_kg:r.referenceWeightKg||null,
      heaviest_attempted_weight_kg:r.heaviestAttemptedWeightKg||null, sets_at_heaviest_weight:r.setsAtReferenceWeight||0,
      recommended_weight_kg:r.recommendedWeightKg, increment_kg:r.incrementKg, reason_code:r.reasonCode, reason_text:r.reasonText,
      confidence:r.confidence, status:'pending', created_at:at, updated_at:at })),
  };
}
