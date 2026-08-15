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

function identityText(value) {
  return str(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const SPORT_EXERCISE_KEY_ALIASES = Object.freeze({
  barbell_squat: 'barbell_back_squat',
  barbell_bench: 'barbell_bench_press',
  plank_program: 'plank',
  side_plank_program: 'side_plank',
  dumbbell_reverse_fly: 'dumbbell_rear_delt_fly',
});

const SPORT_EXERCISE_NAME_ALIASES = Object.freeze({
  'squat arriere': 'barbell_back_squat',
  'back squat': 'barbell_back_squat',
  'barbell back squat': 'barbell_back_squat',
  'squat barre': 'barbell_back_squat',
  'barbell squat': 'barbell_back_squat',
  'developpe couche': 'barbell_bench_press',
  'developpe couche barre': 'barbell_bench_press',
  bench: 'barbell_bench_press',
  'bench press': 'barbell_bench_press',
  'barbell bench press': 'barbell_bench_press',
  'developpe couche prise serree': 'barbell_close_grip_bench_press',
  'close grip bench press': 'barbell_close_grip_bench_press',
  'front squat': 'barbell_front_squat',
  'souleve de terre': 'barbell_deadlift',
  deadlift: 'barbell_deadlift',
  'souleve de terre roumain': 'barbell_romanian_deadlift',
  'romanian deadlift': 'barbell_romanian_deadlift',
  'developpe militaire': 'barbell_overhead_press',
  'developpe militaire barre': 'barbell_overhead_press',
  'barbell overhead press': 'barbell_overhead_press',
  'rowing barre': 'barbell_row',
  'barbell row': 'barbell_row',
  'developpe incline halteres': 'dumbbell_incline_press',
  'incline dumbbell press': 'dumbbell_incline_press',
  'curl marteau': 'dumbbell_hammer_curl',
  'hammer curl': 'dumbbell_hammer_curl',
  'elevations laterales': 'dumbbell_lateral_raise',
  'lateral raise': 'dumbbell_lateral_raise',
  'extension triceps': 'triceps_extension',
  'oiseau halteres': 'dumbbell_rear_delt_fly',
  'dumbbell rear delt fly': 'dumbbell_rear_delt_fly',
  'dumbbell reverse fly': 'dumbbell_rear_delt_fly',
  gainage: 'plank',
  plank: 'plank',
  'gainage lateral': 'side_plank',
  'side plank': 'side_plank',
  'releves de jambes': 'lying_leg_raise_ab',
  'leg raises': 'lying_leg_raise_ab',
  'tractions pronation': 'pullup_pronation',
  'tractions pronation lestees': 'pullup_pronation',
  'pronated pull up': 'pullup_pronation',
  'tractions supination': 'pullup_supination',
  'tractions supination lestees': 'pullup_supination',
  'supinated pull up': 'pullup_supination',
});

export function canonicalSportExerciseKey(input = {}) {
  const row = typeof input === 'string' ? { exerciseName: input } : (input || {});
  const rawKey = str(row.exerciseKey || row.exercise_key || row.key);
  const normalizedKey = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (normalizedKey && SPORT_EXERCISE_KEY_ALIASES[normalizedKey]) return SPORT_EXERCISE_KEY_ALIASES[normalizedKey];
  if (normalizedKey && !['strength', 'bodyweight_strength', 'exercise'].includes(normalizedKey)) return normalizedKey;
  const name = identityText(row.exerciseName || row.exercise_name || row.fr || row.name_fr || row.en || row.name_en || row.name);
  const equipment = identityText(row.equipment);
  if (name === 'squat' && equipment === 'barbell') return 'barbell_back_squat';
  if ((name === 'developpe couche' || name === 'bench' || name === 'bench press') && equipment && equipment !== 'barbell') return '';
  return SPORT_EXERCISE_NAME_ALIASES[name] || normalizedKey;
}

export function sameSportExercise(left, right) {
  const leftKey = canonicalSportExerciseKey(left);
  const rightKey = canonicalSportExerciseKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export function latestCompletedExerciseLoad(target, items = [], sets = []) {
  const targetKey = canonicalSportExerciseKey(target);
  if (!targetKey) return null;
  const itemById = new Map((Array.isArray(items) ? items : []).map((item) => [String(item?.id || ''), item]));
  const sessions = new Map();
  (Array.isArray(sets) ? sets : []).forEach((set) => {
    const item = itemById.get(String(set?.item_id || set?.itemId || ''));
    if (!item || canonicalSportExerciseKey(item) !== targetKey) return;
    const weightKg = num(set?.weight_kg ?? set?.weightKg, 0);
    if (weightKg <= 0 || set?.completed === false || set?.estimated === true) return;
    const sessionId = str(item?.session_id || item?.sessionId || item?.id);
    const completedAt = str(set?.completed_at || set?.completedAt || item?.updated_at || item?.created_at);
    const current = sessions.get(sessionId) || { exerciseKey: targetKey, sessionId, weightKg: 0, completedAt: '' };
    current.weightKg = Math.max(current.weightKg, weightKg);
    if (completedAt > current.completedAt) current.completedAt = completedAt;
    sessions.set(sessionId, current);
  });
  return Array.from(sessions.values()).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0] || null;
}

export function normalizeSportExerciseRow(row = {}) {
  const key = canonicalSportExerciseKey(row);
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
    if (!normalized) return;
    const rawKey = str(row.key || row.exercise_key);
    const existing = byKey.get(normalized.key);
    if (!existing || rawKey === normalized.key) byKey.set(normalized.key, { ...existing, ...row, ...normalized });
  });
  (Array.isArray(remote) ? remote : []).forEach((row) => {
    const normalized = normalizeSportExerciseRow(row);
    if (!normalized) return;
    const rawKey = str(row.key || row.exercise_key);
    const existing = byKey.get(normalized.key);
    const incomingIsCanonical = rawKey === normalized.key;
    const existingIsCanonical = str(existing?.key) === str(existing?.exercise_key || existing?.key);
    if (!existing || incomingIsCanonical || !existingIsCanonical) {
      byKey.set(normalized.key, { ...existing, ...normalized, source: str(row.source, 'sql') });
    }
  });
  return Array.from(byKey.values()).sort((a, b) => {
    const goal = str(a.goal).localeCompare(str(b.goal), 'fr', { sensitivity: 'base' });
    if (goal) return goal;
    return str(a.fr || a.en || a.key).localeCompare(str(b.fr || b.en || b.key), 'fr', { sensitivity: 'base' });
  });
}
