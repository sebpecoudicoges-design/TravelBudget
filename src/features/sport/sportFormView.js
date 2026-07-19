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
