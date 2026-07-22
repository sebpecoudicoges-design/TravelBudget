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
  return profilePercentile(value, target);
}

export function profilePercentile(value, target) {
  const ratio = numberValue(value, 0) / Math.max(0.0001, numberValue(target, 1));
  const points = [
    [0, 1],
    [0.5, 35],
    [0.75, 50],
    [1, 70],
    [1.2, 85],
    [1.45, 95],
    [1.7, 99],
  ];
  for (let i = 1; i < points.length; i += 1) {
    const [rx, px] = points[i];
    const [prevR, prevP] = points[i - 1];
    if (ratio <= rx) {
      const t = (ratio - prevR) / Math.max(0.0001, rx - prevR);
      return Math.max(1, Math.min(99, Math.round(prevP + (px - prevP) * t)));
    }
  }
  return 99;
}

export function percentileBand(percentile) {
  const p = numberValue(percentile, 0);
  if (p >= 99) return 'elite naturel';
  if (p >= 95) return 'tres avance';
  if (p >= 85) return 'avance';
  if (p >= 70) return 'confirme';
  if (p >= 50) return 'intermediaire';
  if (p >= 35) return 'debutant solide';
  return 'a construire';
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
    raw: `${name} ${Math.round(e1rm)} kg e1RM - ${Math.round(ratio * 100) / 100} x PDC`,
    value: e1rm,
    estimate: e1rm,
    ratio,
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

function avg(values = []) {
  const valid = values.map((value) => numberValue(value, 0)).filter((value) => value > 0);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function weightedScore(entries = []) {
  let weight = 0;
  let total = 0;
  entries.forEach(([score, w]) => {
    const s = numberValue(score, 0);
    const ww = numberValue(w, 0);
    if (s <= 0 || ww <= 0) return;
    total += s * ww;
    weight += ww;
  });
  return weight ? Math.round(total / weight) : 0;
}

function bestNamed(bestByExercise, pattern) {
  return Array.from(bestByExercise.values())
    .filter((row) => pattern.test(normalizedSportProfileText(row.name)))
    .sort((a, b) => numberValue(b.ratio, 0) - numberValue(a.ratio, 0))[0] || null;
}

export function buildAthleticProfile({ bestAxis = new Map(), bestByExercise = new Map(), bodyWeightKg = 0, uniqueDays = 0 } = {}) {
  const lower = bestAxis.get('lower') || {};
  const push = bestAxis.get('push') || {};
  const pull = bestAxis.get('pull') || {};
  const core = bestAxis.get('core') || {};
  const cardio = bestAxis.get('cardio') || {};
  const speed = bestAxis.get('speed') || {};
  const recovery = bestAxis.get('recovery') || {};
  const force = weightedScore([[lower.score, 30], [push.score, 25], [pull.score, 25], [core.score, 10]]);
  const endurance = Math.round(avg([core.score, cardio.score, uniqueDays ? Math.min(85, uniqueDays * 10) : 0]));
  const explosive = Math.round(avg([speed.score, cardio.score ? Math.max(20, cardio.score - 8) : 0]));
  const mobility = 35;
  const recoveryScore = Math.round(numberValue(recovery.score, 0));
  const athleticAxes = [
    { key: 'force', label: 'Force', value: force, raw: percentileBand(force), basis: 'squat, souleve de terre, developpes, tractions' },
    { key: 'endurance', label: 'Endurance', value: endurance, raw: percentileBand(endurance), basis: 'gainage, volume musculaire, regularite' },
    { key: 'cardio', label: 'Cardio', value: Math.round(numberValue(cardio.score, 0)), raw: cardio.raw || '-', basis: cardio.basis || 'kcal/min observe' },
    { key: 'explosive', label: 'Explosivite', value: explosive, raw: speed.raw || cardio.raw || '-', basis: speed.basis || 'corde, boxe, HIIT, efforts rapides' },
    { key: 'mobility', label: 'Mobilite', value: mobility, raw: 'tests a saisir', basis: 'chevilles, hanches, epaules, squat profond' },
    { key: 'recovery', label: 'Recup.', value: recoveryScore, raw: recovery.raw || '-', basis: recovery.basis || 'sommeil, fatigue, douleurs, charge 7 jours' },
  ];

  const pushPullGap = Math.round(((numberValue(push.score, 0) - numberValue(pull.score, 0)) / Math.max(1, avg([push.score, pull.score]))) * 100);
  const lowerPushGap = Math.round(((numberValue(lower.score, 0) - numberValue(push.score, 0)) / Math.max(1, avg([lower.score, push.score]))) * 100);
  const squat = bestNamed(bestByExercise, /squat/);
  const deadlift = bestNamed(bestByExercise, /soulev|deadlift|terre/);
  const bench = bestNamed(bestByExercise, /developpe couche|bench/);
  const pullup = bestNamed(bestByExercise, /traction|pull/);
  const ohp = bestNamed(bestByExercise, /militaire|overhead/);
  const insights = [];
  const warnings = [];
  if (force >= 75) insights.push('Tres bon niveau de force relative.');
  if (numberValue(deadlift?.ratio, 0) >= 1.9) insights.push('Chaine posterieure tres solide.');
  if (numberValue(pull.score, 0) >= numberValue(push.score, 0) + 12) insights.push('Tirage superieur a la poussee : bon signal pour les epaules.');
  if (numberValue(push.score, 0) >= numberValue(pull.score, 0) + 18) warnings.push('Poussee nettement devant le tirage : surveiller epaules et haut du dos.');
  if (ohp && numberValue(ohp.ratio, 0) < 0.65 && force >= 60) warnings.push('Developpe militaire probablement en retard par rapport au reste.');
  if (squat && deadlift && numberValue(deadlift.ratio, 0) > numberValue(squat.ratio, 0) * 1.35) warnings.push('Souleve de terre tres au-dessus du squat : technique, mobilite ou confiance au squat possiblement limitantes.');
  if (cardio.score && cardio.score < force - 15) warnings.push('Condition physique utile mais en retrait par rapport a la force.');
  if (!warnings.length) warnings.push('Profil equilibre sur les donnees disponibles ; ajouter mobilite/fatigue affinera le diagnostic.');

  const priorityAxis = athleticAxes
    .filter((axis) => axis.key !== 'mobility' || axis.value < 50)
    .slice()
    .sort((a, b) => a.value - b.value)[0] || athleticAxes[0];
  const priority = priorityAxis.key === 'mobility'
    ? 'saisir 3 tests mobilite simples pour rendre le profil actionnable'
    : `augmenter ${priorityAxis.label.toLowerCase()} de 10 a 12 points`;

  const archetypes = [
    { key: 'climber', label: 'Grimpeur', value: Math.round(avg([pull.score, core.score, recovery.score])) },
    { key: 'powerlifter', label: 'Powerlifter', value: Math.round(avg([lower.score, push.score, force])) },
    { key: 'hyrox', label: 'Hyrox', value: Math.round(avg([force, cardio.score, endurance])) },
    { key: 'endurance', label: 'Endurance', value: Math.round(avg([cardio.score, recovery.score, endurance])) },
  ].map((row) => ({ ...row, value: Math.max(0, Math.min(99, row.value || 0)) }));

  return {
    axes: athleticAxes,
    rawAxes: { lower, push, pull, core, cardio, speed, recovery },
    insights,
    warnings,
    priority,
    balances: [
      { label: 'Poussee / Tirage', value: pushPullGap, text: pushPullGap > 0 ? `Poussee +${pushPullGap}%` : `Tirage +${Math.abs(pushPullGap)}%` },
      { label: 'Jambes / Poussee', value: lowerPushGap, text: lowerPushGap > 0 ? `Jambes +${lowerPushGap}%` : `Poussee +${Math.abs(lowerPushGap)}%` },
    ],
    archetypes,
    keyMetrics: [
      squat ? { label: 'Squat', value: `${Math.round(numberValue(squat.ratio, 0) * 100) / 100} x PDC`, detail: `${Math.round(squat.estimate)} kg e1RM` } : null,
      deadlift ? { label: 'SDT', value: `${Math.round(numberValue(deadlift.ratio, 0) * 100) / 100} x PDC`, detail: `${Math.round(deadlift.estimate)} kg e1RM` } : null,
      bench ? { label: 'DC', value: `${Math.round(numberValue(bench.ratio, 0) * 100) / 100} x PDC`, detail: `${Math.round(bench.estimate)} kg e1RM` } : null,
      pullup ? { label: 'Tractions', value: `${Math.round(numberValue(pullup.reps, 0))} reps`, detail: 'poids du corps' } : null,
    ].filter(Boolean),
    bodyWeightKg,
  };
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
            ratio: n(session.body_weight_kg || session.bodyWeightKg, bodyWeightKg) > 0 ? estimate / n(session.body_weight_kg || session.bodyWeightKg, bodyWeightKg) : 0,
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

  const classicAxes = ['lower', 'push', 'pull', 'core', 'cardio', 'recovery'].map((key) => {
    const row = bestAxis.get(key) || {};
    return {
      key,
      value: n(row.score, 0),
      raw: row.raw || '-',
      basis: row.basis || '',
      priority: n(row.priority, 0),
    };
  });
  const athleticProfile = buildAthleticProfile({ bestAxis, bestByExercise, bodyWeightKg, uniqueDays: uniqueDays.size });
  const axes = athleticProfile.axes;

  return {
    axes,
    classicAxes,
    athleticProfile,
    sessions: visibleSessions,
    weakest: axes.slice().sort((a, b) => a.value - b.value)[0] || axes[0],
    bestLoads: Array.from(bestByExercise.values()).sort((a, b) => b.estimate - a.estimate).slice(0, 3),
    uniqueDays: uniqueDays.size,
    bestSessionSeconds,
  };
}

export function normalizeExerciseProgressionKey(value) {
  return normalizedSportProfileText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function estimatedProgressionOneRepMax(weightKg, reps) {
  const weight = Math.max(0, numberValue(weightKg, 0));
  const repetitions = Math.max(0, numberValue(reps, 0));
  return weight && repetitions ? weight * (1 + repetitions / 30) : 0;
}

export function exerciseProgressionPriority(exerciseId = '') {
  const key = normalizeExerciseProgressionKey(exerciseId);
  if (/squat/.test(key) && !/front|goblet/.test(key)) return 100;
  if (/developpe_couche|bench/.test(key) && !/serree|close|incline/.test(key)) return 95;
  if (/souleve_de_terre|deadlift/.test(key) && !/roumain|romanian|rdl/.test(key)) return 92;
  if (/rowing_barre|barbell_row/.test(key)) return 86;
  if (/traction|pullup|pull_up|chin/.test(key)) return 84;
  if (/developpe_militaire|overhead|military/.test(key)) return 80;
  if (/front_squat/.test(key)) return 78;
  if (/souleve_de_terre_roumain|rdl|romanian/.test(key)) return 76;
  if (/developpe_incline/.test(key)) return 74;
  return 30;
}

export function buildExerciseProgressionAnalysis(rows = [], { selectedExercise = '', limitPerExercise = 60 } = {}) {
  const selected = normalizeExerciseProgressionKey(selectedExercise);
  const grouped = new Map();
  (rows || []).forEach((row) => {
    const exerciseId = String(row?.exercise_id || row?.exerciseId || '').trim();
    const key = normalizeExerciseProgressionKey(exerciseId);
    const value = numberValue(row?.estimated_1rm_kg ?? row?.estimated1rmKg, 0);
    const date = String(row?.created_at || row?.createdAt || row?.date || '').slice(0, 10);
    if (!key || value <= 0 || !date) return;
    if (selected && key !== selected) return;
    const item = {
      ...row,
      exercise_id: exerciseId,
      key,
      date,
      estimated_1rm_kg: Math.round(value * 10) / 10,
      weight_kg: numberValue(row?.weight_kg ?? row?.weightKg, 0),
      reps: Math.round(numberValue(row?.reps, 0)),
    };
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  });

  const exercises = Array.from(grouped.entries()).map(([key, list]) => {
    const sorted = list
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created_at || '').localeCompare(String(b.created_at || '')))
      .slice(-Math.max(2, limitPerExercise));
    const first = sorted[0] || {};
    const last = sorted[sorted.length - 1] || {};
    const best = sorted.slice().sort((a, b) => numberValue(b.estimated_1rm_kg, 0) - numberValue(a.estimated_1rm_kg, 0))[0] || {};
    const delta = numberValue(last.estimated_1rm_kg, 0) - numberValue(first.estimated_1rm_kg, 0);
    return {
      key,
      exerciseId: sorted[0]?.exercise_id || key,
      label: sorted[0]?.exercise_id || key,
      priority: exerciseProgressionPriority(sorted[0]?.exercise_id || key),
      rows: sorted,
      first,
      last,
      best,
      delta: Math.round(delta * 10) / 10,
      deltaPct: first.estimated_1rm_kg ? Math.round((delta / first.estimated_1rm_kg) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.priority - a.priority || numberValue(b.best?.estimated_1rm_kg, 0) - numberValue(a.best?.estimated_1rm_kg, 0));

  return {
    exercises,
    selectedExercise: selected,
    totalRows: (rows || []).length,
    options: exercises.map((row) => ({ key: row.key, label: row.label, priority: row.priority })),
  };
}

export function buildExerciseProgressionRowsFromSessions({
  sessions = [],
  planForSession = () => [],
  doneSetsForSession = () => [],
} = {}) {
  const rows = [];
  (sessions || []).forEach((session) => {
    const sessionId = session?.id || session?.localId || session?.remoteId || '';
    const sessionDate = String(session?.started_at || session?.startedAt || session?.created_at || session?.createdAt || '').slice(0, 10);
    const plan = planForSession(sessionId, session) || [];
    const sets = doneSetsForSession(sessionId, session) || [];
    sets.forEach((set) => {
      const itemIndex = Math.max(0, Math.round(numberValue(set?.itemIndex ?? set?.item_index, 0)));
      const item = plan[itemIndex] || {};
      const exerciseId = item.exerciseKey || item.exercise_key || item.libraryKey || item.library_key || item.exerciseName || item.exercise_name || item.activityKey || item.activity_key || '';
      const weightKg = numberValue(set?.weightKg ?? set?.weight_kg, 0);
      const reps = Math.round(numberValue(set?.reps, 0));
      const estimated = estimatedProgressionOneRepMax(weightKg, reps);
      const createdAt = set?.completedAt || set?.completed_at || session?.started_at || session?.startedAt || session?.created_at || session?.createdAt || '';
      if (!exerciseId || !sessionDate || estimated <= 0) return;
      rows.push({
        id: `${sessionId || 'session'}_${itemIndex}_${set?.setIndex ?? set?.set_index ?? rows.length}`,
        exercise_id: exerciseId,
        session_id: sessionId || null,
        weight_kg: weightKg,
        reps,
        estimated_1rm_kg: Math.round(estimated * 10) / 10,
        calculation_method: 'epley_set_fallback',
        created_at: createdAt || `${sessionDate}T00:00:00.000Z`,
      });
    });
  });
  return rows;
}
