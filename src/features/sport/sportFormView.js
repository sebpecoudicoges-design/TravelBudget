function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function renderOptionRows({
  rows,
  selected,
  language = 'fr',
  valueIndex = 0,
  labelFrIndex = 1,
  labelEnIndex = 2,
  escapeHTML = fallbackEscape,
}) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const value = String(row?.[valueIndex] ?? '');
      const label = language === 'en' ? (row?.[labelEnIndex] ?? row?.[labelFrIndex]) : row?.[labelFrIndex];
      const isSelected = value === String(selected ?? '') ? 'selected' : '';
      return `<option value="${escapeHTML(value)}" ${isSelected}>${escapeHTML(label)}</option>`;
    })
    .join('');
}

export function renderDurationOptions({
  selected,
  durations = [15, 25, 35, 45, 60, 75],
  escapeHTML = fallbackEscape,
}) {
  return durations
    .map((value) => `<option value="${escapeHTML(value)}" ${Number(selected) === Number(value) ? 'selected' : ''}>${escapeHTML(value)} min</option>`)
    .join('');
}

export function renderExerciseOptions({
  exercises,
  selected,
  emptyLabel = '',
  exerciseLabel = (exercise) => exercise?.fr || exercise?.en || exercise?.key || '',
  escapeHTML = fallbackEscape,
}) {
  const prefix = emptyLabel ? `<option value="">${escapeHTML(emptyLabel)}</option>` : '';
  const body = (Array.isArray(exercises) ? exercises : [])
    .map((exercise) => {
      const key = String(exercise?.key ?? '');
      return `<option value="${escapeHTML(key)}" ${key === String(selected ?? '') ? 'selected' : ''}>${escapeHTML(exerciseLabel(exercise))}</option>`;
    })
    .join('');
  return prefix + body;
}

export function renderFormatOptions({
  selected,
  labels = {},
  escapeHTML = fallbackEscape,
}) {
  const rows = [
    ['time', labels.time || 'Duree'],
    ['reps', labels.reps || 'Repetitions'],
    ['max_reps', labels.maxReps || 'Max reps'],
  ];
  return rows
    .map(([value, label]) => `<option value="${escapeHTML(value)}" ${value === String(selected ?? '') ? 'selected' : ''}>${escapeHTML(label)}</option>`)
    .join('');
}

export function renderEquipmentOptions({
  equipment,
  selected = 'all',
  allLabel = 'Tous les materiels',
  language = 'fr',
  escapeHTML = fallbackEscape,
}) {
  const options = [`<option value="all" ${selected === 'all' ? 'selected' : ''}>${escapeHTML(allLabel)}</option>`];
  (Array.isArray(equipment) ? equipment : []).forEach((row) => {
    const value = String(row?.[0] ?? '');
    const label = language === 'en' ? (row?.[2] ?? row?.[1]) : row?.[1];
    options.push(`<option value="${escapeHTML(value)}" ${value === String(selected ?? '') ? 'selected' : ''}>${escapeHTML(label)}</option>`);
  });
  return options.join('');
}

export function renderSportPlan({
  plan,
  labels = {},
  helpers = {},
  escapeHTML = fallbackEscape,
}) {
  const rows = Array.isArray(plan) ? plan : [];
  const text = (key, fallback) => labels[key] || fallback;
  const number = typeof helpers.n === 'function'
    ? helpers.n
    : ((value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    });
  if (!rows.length) {
    return `<div class="muted">${escapeHTML(text('emptyPlan', 'Ajoute un exercice pour lancer une seance guidee.'))}</div>`;
  }
  return rows.map((item, idx) => {
    const range = typeof helpers.progressionRepRange === 'function' ? helpers.progressionRepRange(item) : null;
    const timeRange = item?.mode === 'time' && number(item?.timeMax, 0) > number(item?.timeMin || item?.targetSeconds, 0)
      ? `${number(item?.timeMin || item?.targetSeconds, 0)}-${number(item?.timeMax, 0)} sec`
      : '';
    const activityLabel = typeof helpers.labelActivity === 'function'
      ? helpers.labelActivity(item?.activityKey)
      : String(item?.activityKey || '');
    const equipmentLabel = typeof helpers.labelEquipment === 'function'
      ? helpers.labelEquipment(item?.equipment)
      : String(item?.equipment || '');
    const supportsLoad = typeof helpers.supportsExternalLoad === 'function' ? helpers.supportsExternalLoad(item) : false;
    const restSeconds = typeof helpers.restSecondsForItem === 'function' ? helpers.restSecondsForItem(item) : number(item?.restSeconds, 0);
    const met = typeof helpers.calibratedMet === 'function' ? helpers.calibratedMet(item) : number(item?.metValue, 0);
    const exerciseName = item?.exerciseName || activityLabel;
    const loadKg = number(item?.weightKg, 0);
    const targetChip = item?.mode === 'time'
      ? `${number(item?.targetSeconds, 0)} sec`
      : (range && range.max > range.min ? `${range.min}-${range.max} reps` : `${number(item?.targetReps, 0)} reps`);
    return `<div class="tb-sport-item">
        <div>
          <div class="tb-sport-item-title">${idx + 1}. ${escapeHTML(exerciseName)}</div>
          <div class="tb-sport-meta">
            <span class="tb-sport-chip">${escapeHTML(activityLabel)}</span>
            <span class="tb-sport-chip">${escapeHTML(equipmentLabel)}</span>
            ${supportsLoad && loadKg ? `<span class="tb-sport-chip">${Math.round(loadKg * 10) / 10} kg${item?.loadLabel ? ` · ${escapeHTML(item.loadLabel)}` : ''}</span>` : item?.loadLabel ? `<span class="tb-sport-chip">${escapeHTML(item.loadLabel)}</span>` : ''}
            <span class="tb-sport-chip">${targetChip}</span>
            ${range && range.max > range.min ? `<span class="tb-sport-chip">${escapeHTML(text('progression', 'Progression'))} ${range.min}-${range.max}</span>` : ''}
            ${timeRange ? `<span class="tb-sport-chip">${escapeHTML(text('target', 'Cible'))} ${escapeHTML(timeRange)}</span>` : ''}
            <span class="tb-sport-chip">${number(item?.sets, 1)} ${escapeHTML(text('sets', 'series'))}</span>
            <span class="tb-sport-chip">${restSeconds} sec ${escapeHTML(text('rest', 'repos'))}</span>
            <span class="tb-sport-chip">${escapeHTML(text('intensity', 'Intensite'))}: ${escapeHTML(item?.intensityLabel || text('moderate', 'moderee'))}</span>
            <span class="tb-sport-chip">MET ${met.toFixed(1)}</span>
          </div>
        </div>
        <div class="tb-sport-actions">
          <button class="btn small" type="button" data-sport-edit="${idx}">${escapeHTML(text('edit', 'Modifier'))}</button>
          <button class="btn small" type="button" data-sport-move="${idx}" data-dir="-1">Up</button>
          <button class="btn small" type="button" data-sport-move="${idx}" data-dir="1">Down</button>
          <button class="btn small danger" type="button" data-sport-remove="${idx}">Del</button>
        </div>
      </div>`;
  }).join('');
}
