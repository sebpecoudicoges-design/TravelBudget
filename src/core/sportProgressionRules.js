import { canonicalSportExerciseKey } from './sportLibraryRules.js';

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
  RIR_TOO_LOW_AT_TOP: 'RIR_TOO_LOW_AT_TOP', CALIBRATION_REQUIRED: 'CALIBRATION_REQUIRED',
  STATIC_CORE_PROGRESS_DURATION: 'STATIC_CORE_PROGRESS_DURATION', STATIC_CORE_INCREASE_DIFFICULTY: 'STATIC_CORE_INCREASE_DIFFICULTY',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
});

export const SPORT_PROGRESSION_TYPES = Object.freeze({
  MAIN_COMPOUND: 'MAIN_COMPOUND',
  SECONDARY_COMPOUND: 'SECONDARY_COMPOUND',
  ISOLATION: 'ISOLATION',
  STATIC_CORE: 'STATIC_CORE',
});

export const SPORT_WEEK_TYPES = Object.freeze({
  FORCE: 'FORCE',
  HYPERTROPHY: 'HYPERTROPHY',
});

function normalizedProgressionType(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'MAIN_COMPOUND' || raw === 'SECONDARY_COMPOUND' || raw === 'ISOLATION' || raw === 'STATIC_CORE') return raw;
  return SPORT_PROGRESSION_TYPES.SECONDARY_COMPOUND;
}

function normalizedWeekType(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'FORCE' || raw === 'STRENGTH') return SPORT_WEEK_TYPES.FORCE;
  if (raw === 'HYPERTROPHY' || raw === 'HYPERTROPHIE' || raw === 'VOLUME') return SPORT_WEEK_TYPES.HYPERTROPHY;
  return '';
}

function setRir(set = {}) {
  const value = set.rir ?? set.repsInReserve ?? set.reps_in_reserve;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finalKnownRir(sets = []) {
  const values = sets.map(setRir).filter((value) => value !== null);
  return values.length ? values[values.length - 1] : null;
}

function isRirAcceptable(sets = [], min = 1, max = 3) {
  const value = finalKnownRir(sets);
  if (value === null) return true;
  return value >= min && value <= max;
}

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
  const progressionType = normalizedProgressionType(input.progressionType ?? input.progression_type);
  const weekType = normalizedWeekType(input.weekType ?? input.week_type);
  const repMin = Math.max(1, Math.round(num(input.repMin ?? input.rep_min, 1)));
  const repMax = Math.max(repMin, Math.round(num(input.repMax ?? input.rep_max, repMin)));
  const plannedSets = Math.max(1, Math.round(num(input.plannedSets ?? input.planned_sets, sets.length || 1)));
  const incrementKg = Math.max(0, num(input.incrementKg ?? input.increment_kg, 2.5));
  const targetRirMin = Math.max(0, num(input.targetRirMin ?? input.target_rir_min, weekType === SPORT_WEEK_TYPES.FORCE ? 1 : 1));
  const targetRirMax = Math.max(targetRirMin, num(input.targetRirMax ?? input.target_rir_max, weekType === SPORT_WEEK_TYPES.FORCE ? 2 : 3));
  const tmPercentage = Math.max(0.85, Math.min(1, num(input.trainingMaxPercentage ?? input.training_max_percentage, 0.95)));
  const validSets = sets.filter(isValidSportWorkSet).map((set) => ({ ...set, weightKg: num(set.weightKg ?? set.weight_kg), reps: Math.round(num(set.reps)) }));
  const successful = validSets.filter((set) => set.reps >= repMin);
  const totalReps = validSets.reduce((sum, set) => sum + Math.max(0, num(set.reps)), 0);
  const totalVolumeKg = validSets.reduce((sum, set) => sum + Math.max(0, num(set.reps)) * Math.max(0, num(set.weightKg)), 0);
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
  const rirOk = isRirAcceptable(atReference.slice(0, plannedSets), targetRirMin, targetRirMax);
  const currentProgramWeightKg = num(input.currentProgramWeightKg ?? input.current_program_weight_kg);
  const lastCompletedWeightKg = Math.max(0, num(input.lastCompletedWeightKg ?? input.last_completed_weight_kg));
  let recommendedWeightKg = Math.max(referenceWeightKg, currentProgramWeightKg, lastCompletedWeightKg);
  let reasonCode = SPORT_RECOMMENDATION_CODES.NO_VALID_WORK_SET;
  let reasonText = 'Aucune serie de travail valide : conserver la charge actuelle.';
  if (!recommendedWeightKg && progressionType !== SPORT_PROGRESSION_TYPES.STATIC_CORE) {
    reasonCode = SPORT_RECOMMENDATION_CODES.CALIBRATION_REQUIRED;
    reasonText = weekType === SPORT_WEEK_TYPES.HYPERTROPHY
      ? 'Pas encore de charge de reference pour cette variante : calibrer avec un RIR cible proche de 2.'
      : 'Pas encore de charge de reference : choisir une charge de depart, puis laisser le moteur apprendre sur les performances reelles.';
  }
  if (referenceWeightKg) {
    if (allAtTop && rirOk) {
      recommendedWeightKg = Math.max(recommendedWeightKg, referenceWeightKg + incrementKg); reasonCode = SPORT_RECOMMENDATION_CODES.TOP_RANGE_ALL_SETS;
      reasonText = `Haut de plage atteint sur ${plannedSets} serie(s) a ${referenceWeightKg} kg : augmenter de ${incrementKg} kg.`;
    } else if (allAtTop && !rirOk) {
      reasonCode = SPORT_RECOMMENDATION_CODES.RIR_TOO_LOW_AT_TOP;
      reasonText = `Haut de plage atteint a ${referenceWeightKg} kg, mais le RIR final est trop bas : conserver la charge avant d'augmenter.`;
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
  if (lastCompletedWeightKg > referenceWeightKg && recommendedWeightKg === lastCompletedWeightKg) {
    reasonText += ` La derniere charge validee de ${lastCompletedWeightKg} kg reste le plancher, sans baisse automatique.`;
  }
  const aggressive = trainingMaxKg > 0 && recommendedWeightKg > trainingMaxKg;
  if (exceptional || aggressive) { reasonCode = SPORT_RECOMMENDATION_CODES.EXCEPTIONAL_PERFORMANCE_CONFIRM; reasonText += ' Augmentation inhabituelle a confirmer.'; }
  return {
    progressionType, weekType, targetRirMin, targetRirMax, finalRir: finalKnownRir(atReference.slice(0, plannedSets)),
    totalReps, totalVolumeKg,
    currentProgramWeightKg, lastCompletedWeightKg, latestWeightKg: best?.weightKg || 0,
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
    if (String(item?.mode || 'reps') !== 'reps') return null;
    const exerciseKey = canonicalSportExerciseKey(item);
    const context = options?.byExerciseKey?.[exerciseKey] || {};
    return { itemIndex, exerciseKey, programExerciseId: item?.programExerciseId || item?.program_exercise_id || null,
      exerciseName: item?.exerciseName || item?.exercise_name || '', ...analyzeExerciseLoadProgression({
        sets: doneSets.filter((set) => Math.round(num(set?.itemIndex, -1)) === itemIndex), repMin: item?.repMin ?? item?.rep_min ?? item?.targetReps,
        repMax: item?.repMax ?? item?.rep_max ?? item?.targetReps, plannedSets: item?.sets ?? item?.planned_sets,
        incrementKg: item?.incrementKg ?? item?.increment_kg ?? context.incrementKg ?? options.defaultIncrementKg,
        trainingMaxPercentage: item?.trainingMaxPercentage ?? item?.training_max_percentage ?? context.trainingMaxPercentage,
        currentProgramWeightKg: item?.weightKg ?? item?.default_weight_kg, recentSessionE1rms: context.recentSessionE1rms,
        previousSmoothedE1rmKg: context.smoothedE1rmKg, lastCompletedWeightKg: context.lastCompletedWeightKg,
        progressionType: item?.progressionType ?? item?.progression_type,
        weekType: item?.weekType ?? item?.week_type ?? summary?.weekType ?? summary?.week_type,
        targetRirMin: item?.targetRirMin ?? item?.target_rir_min,
        targetRirMax: item?.targetRirMax ?? item?.target_rir_max,
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
      recommended_reps_max:r.recommendedRepsMax, recommendation_reason:r.reasonText, recommendation_status:r.autoApplied?'applied':'pending', calculated_at:at, updated_at:at })),
    history: valid.map((r) => ({ user_id:userId, exercise_id:r.exerciseKey, session_id:sessionId, weight_kg:r.latestWeightKg||null, reps:r.latestReps||null,
      estimated_1rm_kg:r.latestE1rmKg||null, smoothed_1rm_kg:r.smoothedE1rmKg||null, training_max_kg:r.trainingMaxKg||null,
      reference_weight_kg:r.referenceWeightKg||null, recommended_weight_kg:r.recommendedWeightKg||null, calculation_method:'epley', created_at:at })),
    recommendations: valid.filter((r) => num(r.recommendedWeightKg, 0) > 0).map((r) => ({ user_id:userId, exercise_id:r.exerciseKey, program_exercise_id:r.programExerciseId||null,
      source_session_id:sessionId, current_program_weight_kg:r.currentProgramWeightKg||null, heaviest_successful_weight_kg:r.referenceWeightKg||null,
      heaviest_attempted_weight_kg:r.heaviestAttemptedWeightKg||null, sets_at_heaviest_weight:r.setsAtReferenceWeight||0,
      recommended_weight_kg:r.recommendedWeightKg, increment_kg:r.incrementKg, reason_code:r.reasonCode, reason_text:r.reasonText,
      confidence:r.confidence, status:r.autoApplied?'applied':'pending', accepted_at:r.autoApplied?at:null, applied_at:r.autoApplied?at:null,
      application_scope:r.autoApplied?'next_session':null, modification_source:r.autoApplied?'automatic_non_regression':null, created_at:at, updated_at:at })),
  };
}
