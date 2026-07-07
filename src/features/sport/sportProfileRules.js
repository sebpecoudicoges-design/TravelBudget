const numberValue = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizedSportProfileText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function exerciseProfileBucket(item) {
  const text = normalizedSportProfileText(`${item?.exerciseName || ''} ${item?.activityKey || ''} ${item?.equipment || ''} ${item?.notes || ''}`);
  if (/squat|fente|bulgar|soulev|deadlift|rdl|hip|mollet|leg|jambe|lunge|terre/.test(text)) return 'lower';
  if (/gainage|abdo|core|plank|crunch|releve|raise|twist|hollow/.test(text)) return 'core';
  if (/developpe|bench|press|pompe|push|dips|militaire/.test(text)) return 'push';
  if (/triceps|extension/.test(text)) return 'push';
  if (/traction|pull|rowing|row|tirage|oiseau/.test(text)) return 'pull';
  if (/corde|jump|run|course|(^|\\s)velo(\\s|$)|bike|boxing|boxe|sac|hiit|burpee|rameur|rower|cardio|ping/.test(text)) return 'cardio';
  if (/curl|elevation/.test(text)) return 'pull';
  return String(item?.mode || '') === 'reps' ? 'upper' : 'cardio';
}

export function isExplosiveExercise(item) {
  const text = normalizedSportProfileText(`${item?.exerciseName || ''} ${item?.activityKey || ''}`);
  return /hiit|boxe|boxing|sac|corde|jump|sprint|burpee|clean|snatch|thruster|plyo/.test(text);
}

export function profileExerciseKey(item) {
  return normalizedSportProfileText(item?.libraryKey || item?.exerciseKey || item?.exerciseName || item?.activityKey || '');
}

export function profileScore(value, target) {
  return Math.max(0, Math.min(100, Math.round((numberValue(value, 0) / Math.max(1, numberValue(target, 1))) * 100)));
}

export function profileStrengthBenchmark(item, bucket) {
  const text = normalizedSportProfileText(`${item?.exerciseName || ''} ${item?.activityKey || ''} ${item?.equipment || ''}`);
  if (/traction|pullup|pull-up|chin/.test(text)) return { target: 12, unit: 'reps PDC', priority: 4, basis: 'tractions strictes 12 reps' };
  if (/soulev|deadlift|terre/.test(text)) return /roumain|romanian|rdl/.test(text)
    ? { target: 1.8, unit: 'x PDC e1RM', priority: 4, basis: 'souleve de terre roumain 1.8 x PDC' }
    : { target: 2.15, unit: 'x PDC e1RM', priority: 4, basis: 'souleve de terre 2.15 x PDC' };
  if (/squat/.test(text)) return { target: 1.75, unit: 'x PDC e1RM', priority: 4, basis: 'squat 1.75 x PDC' };
  if (/fente|bulgar|lunge/.test(text)) return { target: 1.1, unit: 'x PDC e1RM', priority: 3, basis: 'fentes 1.1 x PDC' };
  if (/developpe couche|bench/.test(text)) return { target: 1.35, unit: 'x PDC e1RM', priority: 4, basis: 'developpe couche 1.35 x PDC' };
  if (/dips|pompe|push-up|pushup/.test(text)) return { target: 15, unit: 'reps PDC', priority: 4, basis: 'poussee poids du corps 15 reps strictes' };
  if (/developpe incline/.test(text)) return { target: 1.15, unit: 'x PDC e1RM', priority: 4, basis: 'developpe incline 1.15 x PDC' };
  if (/developpe militaire|overhead|press militaire/.test(text)) return { target: 0.85, unit: 'x PDC e1RM', priority: 3, basis: 'developpe militaire 0.85 x PDC' };
  if (/rowing|row|tirage/.test(text)) return { target: 1.25, unit: 'x PDC e1RM', priority: 4, basis: 'rowing/tirage 1.25 x PDC' };
  if (/curl/.test(text)) return { target: 0.55, unit: 'x PDC e1RM', priority: 1, basis: 'curl 0.55 x PDC' };
  if (/triceps|extension|elevation|oiseau/.test(text)) return { target: 0.7, unit: 'x PDC e1RM', priority: 1, basis: 'isolation 0.7 x PDC' };
  return bucket === 'lower'
    ? { target: 1.6, unit: 'x PDC e1RM', priority: 2, basis: 'jambes 1.6 x PDC' }
    : { target: 1.1, unit: 'x PDC e1RM', priority: 2, basis: 'haut du corps 1.1 x PDC' };
}

export function profileExerciseCapacity(item, set, bucket, bodyWeightKg, api = {}) {
  const n = api.numberValue || numberValue;
  const labelActivity = api.labelActivity || ((key) => key || '');
  const reps = n(set?.reps, 0);
  const load = n(set?.weightKg || set?.weight_kg, n(item?.weightKg, 0));
  const duration = n(set?.durationSeconds || set?.duration_seconds, n(item?.targetSeconds, 0));
  const name = item?.exerciseName || labelActivity(item?.activityKey);
  if (set?.estimated) return null;
  const text = normalizedSportProfileText(`${name || ''} ${item?.activityKey || ''} ${item?.equipment || ''}`);
  if (bucket === 'core') {
    if (duration > 0) return { score: profileScore(duration, 120), raw: `${name} ${Math.round(duration)}s`, value: duration, priority: 3, basis: 'gainage 120s' };
    return { score: profileScore(reps, 35), raw: `${name} ${Math.round(reps)} reps`, value: reps, priority: 2, basis: 'core 35 reps' };
  }
  const benchmark = profileStrengthBenchmark(item, bucket);
  if (/traction|pullup|pull-up|chin/.test(text) && load <= 0) {
    return { score: profileScore(reps, benchmark.target), raw: `${name} ${Math.round(reps)} reps PDC`, value: reps, priority: benchmark.priority, basis: benchmark.basis };
  }
  if (/dips|pompe|push-up|pushup/.test(text) && load <= 0) {
    return { score: profileScore(reps, benchmark.target), raw: `${name} ${Math.round(reps)} reps PDC`, value: reps, priority: benchmark.priority, basis: benchmark.basis };
  }
  if (reps <= 0 || load <= 0 || bodyWeightKg <= 0) return null;
  const e1rm = load * (1 + Math.min(reps, 15) / 30);
  const ratio = e1rm / bodyWeightKg;
  return {
    score: profileScore(ratio, benchmark.target),
    raw: `${name} ${Math.round(e1rm)} kg e1RM`,
    value: e1rm,
    estimate: e1rm,
    load,
    reps,
    priority: benchmark.priority,
    basis: benchmark.basis,
  };
}

export function chooseBestCapacity(current, candidate) {
  if (!candidate) return current || null;
  if (!current) return candidate;
  const candidatePriority = numberValue(candidate.priority, 0);
  const currentPriority = numberValue(current.priority, 0);
  if (candidatePriority !== currentPriority) return candidatePriority > currentPriority ? candidate : current;
  return numberValue(candidate.score, 0) > numberValue(current.score, 0) ? candidate : current;
}

function setBestCapacity(map, key, candidate) {
  const best = chooseBestCapacity(map.get(key), candidate);
  if (best) map.set(key, best);
}

export function buildSportProfileRadarData({
  sessions = [],
  planForSession = () => [],
  doneSetsForSession = () => [],
  bodyWeightKg = 0,
  sleepRows = {},
  now = new Date(),
  api = {},
} = {}) {
  const n = api.numberValue || numberValue;
  const localDateISO = api.localDateISO || ((value) => String(value instanceof Date ? value.toISOString() : value || '').slice(0, 10));
  const since = new Date(now.getTime() - 28 * 86400000);
  const visibleSessions = (sessions || []).filter((session) => {
    const d = new Date(session.started_at || session.startedAt || 0);
    return Number.isFinite(d.getTime()) && d >= since && d <= now;
  });
  const bestAxis = new Map();
  const uniqueDays = new Set();
  const bestByExercise = new Map();
  let bestSessionSeconds = 0;

  visibleSessions.forEach((session) => {
    const sessionId = session.id || session.localId || session.remoteId;
    uniqueDays.add(localDateISO(session.started_at || session.startedAt));
    const sessionSeconds = n(session.duration_seconds || session.durationSeconds, 0);
    bestSessionSeconds = Math.max(bestSessionSeconds, sessionSeconds);
    const plan = planForSession(sessionId, session) || [];
    const doneSets = doneSetsForSession(sessionId, session) || [];
    const setsByItem = new Map();
    doneSets.forEach((set) => {
      const idx = Math.max(0, Math.round(n(set.itemIndex, 0)));
      const rows = setsByItem.get(idx) || [];
      rows.push(set);
      setsByItem.set(idx, rows);
    });
    const sessionKcalPerMin = sessionSeconds > 0 ? n(session.estimated_kcal || session.estimatedKcal, 0) / (sessionSeconds / 60) : 0;
    plan.forEach((item, idx) => {
      const bucket = exerciseProfileBucket(item);
      const sets = setsByItem.get(idx) || [];
      if (bucket === 'cardio' && sessionKcalPerMin > 0) {
        setBestCapacity(bestAxis, 'cardio', { score: profileScore(sessionKcalPerMin, 14), raw: `${Math.round(sessionKcalPerMin * 10) / 10} kcal/min`, value: sessionKcalPerMin, priority: 2, basis: 'cardio 14 kcal/min' });
      }
      if (isExplosiveExercise(item) && sessionKcalPerMin > 0) {
        setBestCapacity(bestAxis, 'speed', { score: profileScore(sessionKcalPerMin, 16), raw: `${Math.round(sessionKcalPerMin * 10) / 10} kcal/min`, value: sessionKcalPerMin, priority: 2, basis: 'effort explosif 16 kcal/min' });
      }
      sets.forEach((set) => {
        const reps = n(set.reps, 0);
        const load = n(set.weightKg || set.weight_kg, n(item.weightKg, 0));
        const capacity = profileExerciseCapacity(item, set, bucket, n(session.body_weight_kg || session.bodyWeightKg, bodyWeightKg), api);
        if (bucket === 'push' || bucket === 'pull' || bucket === 'upper' || bucket === 'lower' || bucket === 'core') {
          setBestCapacity(bestAxis, bucket === 'upper' ? 'push' : bucket, capacity);
        }
        if (reps <= 0 || load <= 0) return;
        const key = profileExerciseKey(item);
        const estimate = capacity?.estimate || load * (1 + Math.min(reps, 15) / 30);
        const current = bestByExercise.get(key);
        if (!current || estimate > current.estimate) {
          bestByExercise.set(key, {
            name: item.exerciseName || api.labelActivity?.(item.activityKey) || item.activityKey,
            estimate,
            load,
            reps,
            bucket,
          });
        }
      });
    });
  });

  const recentSleep = Object.keys(sleepRows || {})
    .sort()
    .slice(-7)
    .map((key) => n(sleepRows[key]?.hours, 0))
    .filter(Boolean);
  const sleepAvg = recentSleep.length ? recentSleep.reduce((sum, h) => sum + h, 0) / recentSleep.length : 0;
  setBestCapacity(bestAxis, 'recovery', {
    score: sleepAvg ? profileScore(sleepAvg, 8.5) : Math.min(100, uniqueDays.size * 12),
    raw: sleepAvg ? `${Math.round(sleepAvg * 10) / 10}h sommeil` : `${uniqueDays.size} jours actifs`,
    value: sleepAvg || uniqueDays.size,
    priority: 2,
    basis: sleepAvg ? 'sommeil moyen 8.5h' : 'regularite 8 jours actifs',
  });

  const axes = ['lower', 'push', 'pull', 'core', 'cardio', 'recovery'].map((key) => {
    const row = bestAxis.get(key) || {};
    return {
      key,
      value: n(row.score, 0),
      raw: row.raw || '-',
      basis: row.basis || '',
      priority: n(row.priority, 0),
    };
  });

  return {
    axes,
    sessions: visibleSessions,
    weakest: axes.slice().sort((a, b) => a.value - b.value)[0] || axes[0],
    bestLoads: Array.from(bestByExercise.values()).sort((a, b) => b.estimate - a.estimate).slice(0, 3),
    uniqueDays: uniqueDays.size,
    bestSessionSeconds,
  };
}
