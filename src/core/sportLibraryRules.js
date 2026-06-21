function str(value, fallback = '') {
  const out = String(value ?? '').trim();
  return out || fallback;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positiveInt(value, fallback) {
  return Math.max(0, Math.round(num(value, fallback)));
}

export function normalizeSportExerciseRow(row = {}) {
  const key = str(row.key || row.exercise_key);
  if (!key) return null;
  const mode = str(row.mode, 'time');
  const cleanMode = mode === 'reps' ? 'reps' : 'time';
  const exercise = {
    key,
    goal: str(row.goal, 'free'),
    equipment: str(row.equipment, 'mixed'),
    activityKey: str(row.activityKey || row.activity_key, 'strength'),
    fr: str(row.fr || row.name_fr || row.label_fr || row.name, key),
    en: str(row.en || row.name_en || row.label_en || row.name, row.fr || row.name_fr || key),
    mode: cleanMode,
    reps: cleanMode === 'reps' ? positiveInt(row.reps || row.default_reps, 10) : 0,
    seconds: cleanMode === 'time' ? positiveInt(row.seconds || row.default_seconds, 45) : 0,
    sets: Math.max(1, positiveInt(row.sets || row.default_sets, 1)),
    rest: positiveInt(row.rest || row.default_rest_seconds, 0),
    weightKg: num(row.weightKg ?? row.default_weight_kg, 0),
    loadLabel: str(row.loadLabel || row.load_label, ''),
    repMin: cleanMode === 'reps' ? positiveInt(row.repMin ?? row.rep_min, 0) : 0,
    repMax: cleanMode === 'reps' ? positiveInt(row.repMax ?? row.rep_max, 0) : 0,
    distanceM: positiveInt(row.distanceM || row.distance_m, 0),
    tags: Array.isArray(row.tags) ? row.tags.map((tag) => str(tag)).filter(Boolean) : [],
  };
  const met = num(row.met || row.met_value, 0);
  if (met > 0) exercise.metValue = met;
  return exercise;
}

export function mergeSportExerciseLibraries(fallback = [], remote = []) {
  const byKey = new Map();
  (Array.isArray(fallback) ? fallback : []).forEach((row) => {
    const normalized = normalizeSportExerciseRow(row);
    if (normalized) byKey.set(normalized.key, { ...row, ...normalized });
  });
  (Array.isArray(remote) ? remote : []).forEach((row) => {
    const normalized = normalizeSportExerciseRow(row);
    if (normalized) byKey.set(normalized.key, { ...byKey.get(normalized.key), ...normalized, source: str(row.source, 'sql') });
  });
  return Array.from(byKey.values()).sort((a, b) => {
    const goal = str(a.goal).localeCompare(str(b.goal), 'fr', { sensitivity: 'base' });
    if (goal) return goal;
    return str(a.fr || a.en || a.key).localeCompare(str(b.fr || b.en || b.key), 'fr', { sensitivity: 'base' });
  });
}
