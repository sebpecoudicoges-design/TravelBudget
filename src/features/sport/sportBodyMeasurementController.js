function cleanOptionalNumber(value, min, max) {
  if (value === '' || value == null) return null;
  const out = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(out)) return null;
  return Math.max(min, Math.min(max, out));
}

export function loadBodyMeasurementsLocal(storageKey) {
  try {
    const rows = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(rows) ? rows.slice(0, 80) : [];
  } catch (_) {
    return [];
  }
}

export function saveBodyMeasurementsLocal(rows, { storageKey, cache } = {}) {
  const clean = (rows || [])
    .filter((row) => row?.measured_on)
    .sort((a, b) => String(b.measured_on || '').localeCompare(String(a.measured_on || '')))
    .slice(0, 80);
  try { localStorage.setItem(storageKey, JSON.stringify(clean)); } catch (_) {}
  if (cache) cache.bodyMeasurements = clean;
  return clean;
}

export function latestBodyMeasurement(rows = []) {
  return (rows || [])
    .slice()
    .sort((a, b) => String(b.measured_on || '').localeCompare(String(a.measured_on || '')))[0] || null;
}

export function buildBodyMeasurementEditor({ row, latest, today, weightKg } = {}) {
  const source = row || latest || {};
  return {
    measured_on: String(row?.measured_on || today || '').slice(0, 10),
    source: source.source || 'impedance_scale',
    weight_kg: source.weight_kg ?? weightKg,
    bmi: source.bmi ?? '',
    body_fat_pct: source.body_fat_pct ?? '',
    fat_mass_kg: source.fat_mass_kg ?? '',
    muscle_mass_kg: source.muscle_mass_kg ?? '',
    lean_mass_kg: source.lean_mass_kg ?? '',
    body_water_pct: source.body_water_pct ?? '',
    body_water_kg: source.body_water_kg ?? '',
    bone_mass_kg: source.bone_mass_kg ?? '',
    visceral_fat_rating: source.visceral_fat_rating ?? '',
    bmr_kcal: source.bmr_kcal ?? '',
    metabolic_age: source.metabolic_age ?? '',
    protein_pct: source.protein_pct ?? '',
    protein_mass_kg: source.protein_mass_kg ?? '',
    subcutaneous_fat_pct: source.subcutaneous_fat_pct ?? '',
    ideal_weight_kg: source.ideal_weight_kg ?? '',
    body_type: source.body_type || '',
    vma_kmh: source.vma_kmh ?? '',
    vma_source: source.vma_source || 'measured',
    measurement_time: source.measurement_time || 'morning',
    after_toilet: source.after_toilet ?? true,
    before_food: source.before_food ?? true,
    before_drink: source.before_drink ?? true,
    before_activity: source.before_activity ?? true,
    same_scale: source.same_scale ?? true,
    hard_flat_floor: source.hard_flat_floor ?? true,
    dry_feet: source.dry_feet ?? true,
    notes: source.notes || '',
  };
}

export function readBodyMeasurementFromDom({ root, today, userId, qualityFn } = {}) {
  const day = String(root.querySelector('#sport-body-date')?.value || today || '').slice(0, 10);
  const vmaValue = root.querySelector('#sport-body-vma')?.value;
  const payload = {
    user_id: userId,
    measured_on: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today,
    source: 'impedance_scale',
    weight_kg: cleanOptionalNumber(root.querySelector('#sport-body-weight')?.value, 20, 350),
    bmi: cleanOptionalNumber(root.querySelector('#sport-body-bmi')?.value, 10, 80),
    body_fat_pct: cleanOptionalNumber(root.querySelector('#sport-body-fat')?.value, 2, 70),
    fat_mass_kg: cleanOptionalNumber(root.querySelector('#sport-body-fat-mass')?.value, 0, 250),
    muscle_mass_kg: cleanOptionalNumber(root.querySelector('#sport-body-muscle')?.value, 5, 200),
    lean_mass_kg: cleanOptionalNumber(root.querySelector('#sport-body-lean')?.value, 0, 300),
    body_water_pct: cleanOptionalNumber(root.querySelector('#sport-body-water')?.value, 20, 80),
    body_water_kg: cleanOptionalNumber(root.querySelector('#sport-body-water-kg')?.value, 0, 250),
    bone_mass_kg: cleanOptionalNumber(root.querySelector('#sport-body-bone')?.value, 0.5, 20),
    visceral_fat_rating: cleanOptionalNumber(root.querySelector('#sport-body-visceral')?.value, 1, 60),
    bmr_kcal: Math.round(cleanOptionalNumber(root.querySelector('#sport-body-bmr')?.value, 600, 6000) || 0) || null,
    metabolic_age: Math.round(cleanOptionalNumber(root.querySelector('#sport-body-age')?.value, 10, 120) || 0) || null,
    protein_pct: cleanOptionalNumber(root.querySelector('#sport-body-protein-pct')?.value, 0, 40),
    protein_mass_kg: cleanOptionalNumber(root.querySelector('#sport-body-protein-mass')?.value, 0, 120),
    subcutaneous_fat_pct: cleanOptionalNumber(root.querySelector('#sport-body-subfat')?.value, 0, 70),
    ideal_weight_kg: cleanOptionalNumber(root.querySelector('#sport-body-ideal-weight')?.value, 20, 250),
    body_type: String(root.querySelector('#sport-body-type')?.value || '').trim().slice(0, 80) || null,
    vma_kmh: cleanOptionalNumber(vmaValue, 6, 30),
    vma_source: vmaValue ? 'measured' : null,
    measurement_time: String(root.querySelector('#sport-body-time')?.value || 'morning'),
    after_toilet: !!root.querySelector('#sport-body-after-toilet')?.checked,
    before_food: !!root.querySelector('#sport-body-before-food')?.checked,
    before_drink: !!root.querySelector('#sport-body-before-drink')?.checked,
    before_activity: !!root.querySelector('#sport-body-before-activity')?.checked,
    same_scale: !!root.querySelector('#sport-body-same-scale')?.checked,
    hard_flat_floor: !!root.querySelector('#sport-body-hard-flat-floor')?.checked,
    dry_feet: !!root.querySelector('#sport-body-dry-feet')?.checked,
    notes: String(root.querySelector('#sport-body-notes')?.value || '').trim().slice(0, 500) || null,
  };
  const quality = typeof qualityFn === 'function' ? qualityFn(payload) : { score: null, label: null };
  payload.protocol_quality_score = quality?.score ?? null;
  payload.protocol_quality_label = quality?.label ?? null;
  return payload;
}

export function mergeBodyMeasurementLocal({ payload, id, cache, storageKey, onWeight } = {}) {
  const nextRow = { ...payload, id: id || payload.id || `local_${payload.measured_on}_${payload.source}` };
  const rows = (cache?.bodyMeasurements || loadBodyMeasurementsLocal(storageKey))
    .filter((row) => !(String(row.measured_on) === String(nextRow.measured_on)
      && String(row.source || 'impedance_scale') === String(nextRow.source || 'impedance_scale')));
  rows.push(nextRow);
  saveBodyMeasurementsLocal(rows, { storageKey, cache });
  if (nextRow.weight_kg && typeof onWeight === 'function') onWeight(nextRow.weight_kg);
  return nextRow;
}

export async function ensureBodyMeasurementsLoaded({
  cache,
  client,
  userId,
  tableName = 'health_body_measurements',
  columns = '*',
  reason = 'render',
  storageKey,
  shouldUseOfflineMode,
  isOfflineMode,
  isOfflineError = () => false,
} = {}) {
  if (cache.bodyMeasurementsLoading || cache.bodyMeasurementsLoaded) return false;
  if (!client || !userId) {
    cache.bodyMeasurementsLoaded = true;
    return false;
  }
  const offline = typeof shouldUseOfflineMode === 'function'
    ? await shouldUseOfflineMode(`health:body_measurements:${reason}`)
    : (typeof isOfflineMode === 'function' && isOfflineMode()) || globalThis.navigator?.onLine === false;
  if (offline) {
    cache.bodyMeasurementsLoaded = true;
    return false;
  }
  cache.bodyMeasurementsLoading = true;
  try {
    const response = await client.from(tableName)
      .select(columns)
      .eq('user_id', userId)
      .order('measured_on', { ascending: false })
      .limit(40);
    if (response.error) throw response.error;
    saveBodyMeasurementsLocal(response.data || [], { storageKey, cache });
    return true;
  } catch (error) {
    if (!isOfflineError(error)) console.warn('[sport] body measurements load failed', error?.message || error);
  } finally {
    cache.bodyMeasurementsLoading = false;
    cache.bodyMeasurementsLoaded = true;
  }
  return false;
}

export async function saveBodyMeasurement({
  root,
  cache,
  client,
  userId,
  tableName = 'health_body_measurements',
  columns = '*',
  storageKey,
  today,
  qualityFn,
  isOfflineError = () => false,
  onWeight,
} = {}) {
  const payload = readBodyMeasurementFromDom({ root, today, userId, qualityFn });
  if (!payload.weight_kg && !payload.body_fat_pct && !payload.muscle_mass_kg && !payload.body_water_pct) {
    return { ok: false, reason: 'empty', payload };
  }
  if (!client || !userId) {
    const row = mergeBodyMeasurementLocal({ payload: { ...payload, user_id: userId || 'local' }, cache, storageKey, onWeight });
    return { ok: true, mode: 'local', payload, row };
  }
  try {
    const response = await client.from(tableName)
      .upsert({ ...payload, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id,measured_on,source' })
      .select(columns)
      .maybeSingle();
    if (response.error) throw response.error;
    const row = mergeBodyMeasurementLocal({ payload: response.data || payload, id: response.data?.id, cache, storageKey, onWeight });
    return { ok: true, mode: 'remote', payload, row };
  } catch (error) {
    if (!isOfflineError(error)) console.warn('[sport] body measurement save failed', error?.message || error);
    const row = mergeBodyMeasurementLocal({ payload: { ...payload, user_id: userId || 'local' }, cache, storageKey, onWeight });
    return { ok: true, mode: 'offline', payload, row, error };
  }
}
