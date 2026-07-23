export function loadMobilityAssessmentsLocal(storageKey) {
  try {
    const rows = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(rows) ? rows.slice(0, 160) : [];
  } catch (_) {
    return [];
  }
}

export function saveMobilityAssessmentsLocal(rows, { storageKey, cache } = {}) {
  const clean = (rows || [])
    .filter((row) => row?.test_code && row?.performed_at)
    .sort((a, b) => String(b.performed_at).localeCompare(String(a.performed_at)))
    .slice(0, 160);
  try { localStorage.setItem(storageKey, JSON.stringify(clean)); } catch (_) {}
  if (cache) cache.mobilityAssessments = clean;
  return clean;
}

export async function ensureMobilityAssessmentsLoaded({
  cache,
  client,
  userId,
  tableName = 'mobility_assessments',
  reason = 'render',
  storageKey,
  shouldUseOfflineMode,
  isOfflineMode,
  isOfflineError = () => false,
} = {}) {
  if (cache.mobilityAssessmentsLoading || cache.mobilityAssessmentsLoaded) return false;
  if (!client || !userId) {
    cache.mobilityAssessmentsLoaded = true;
    return false;
  }
  const offline = typeof shouldUseOfflineMode === 'function'
    ? await shouldUseOfflineMode(`sport:mobility:${reason}`)
    : (typeof isOfflineMode === 'function' && isOfflineMode()) || globalThis.navigator?.onLine === false;
  if (offline) {
    cache.mobilityAssessmentsLoaded = true;
    return false;
  }
  cache.mobilityAssessmentsLoading = true;
  try {
    const response = await client.from(tableName)
      .select('id,user_id,performed_at,test_code,body_region,central_value,unit,central_pain,warmup_completed,notes,created_at')
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
      .limit(160);
    if (response.error) throw response.error;
    saveMobilityAssessmentsLocal(response.data || [], { storageKey, cache });
    return true;
  } catch (error) {
    if (!isOfflineError(error)) console.warn('[sport] mobility load failed', error?.message || error);
  } finally {
    cache.mobilityAssessmentsLoading = false;
    cache.mobilityAssessmentsLoaded = true;
  }
  return false;
}

export async function saveMobilityAssessment({
  root,
  cache,
  client,
  userId,
  tableName = 'mobility_assessments',
  storageKey,
  numberValue = Number,
  isOfflineError = () => false,
} = {}) {
  const performedAt = new Date().toISOString();
  const day = performedAt.slice(0, 10);
  const tests = {
    toe_touch: 'hamstrings',
    deep_squat: 'hips_ankles',
    shoulder_reach: 'shoulders',
    trunk_rotation: 'thoracic_spine',
    ankle_wall: 'ankles',
  };
  const rows = Object.entries(tests).map(([testCode, bodyRegion]) => {
    const rawLevel = String(root.querySelector(`[data-sport-mobility-level="${testCode}"]`)?.value ?? '');
    if (rawLevel === '') return null;
    return {
      user_id: userId || 'local',
      performed_at: performedAt,
      test_code: testCode,
      body_region: bodyRegion,
      central_value: Math.max(0, Math.min(2, Math.round(numberValue(rawLevel, 0)))),
      unit: 'level',
      central_pain: Math.max(0, Math.min(10, Math.round(numberValue(root.querySelector(`[data-sport-mobility-pain="${testCode}"]`)?.value, 0)))),
      warmup_completed: false,
    };
  }).filter(Boolean);
  if (rows.length !== 5) return { ok: false, reason: 'incomplete', rows };

  const retained = (cache.mobilityAssessments || []).filter((row) => String(row.performed_at || '').slice(0, 10) !== day);
  saveMobilityAssessmentsLocal(rows.concat(retained), { storageKey, cache });
  if (client && userId) {
    try {
      const nextDay = new Date(`${day}T00:00:00.000Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const removed = await client.from(tableName).delete()
        .eq('user_id', userId)
        .gte('performed_at', `${day}T00:00:00.000Z`)
        .lt('performed_at', nextDay.toISOString());
      if (removed.error) throw removed.error;
      const inserted = await client.from(tableName).insert(rows.map((row) => ({ ...row, user_id: userId })));
      if (inserted.error) throw inserted.error;
    } catch (error) {
      if (!isOfflineError(error)) console.warn('[sport] mobility save failed', error?.message || error);
    }
  }
  return {
    ok: true,
    rows,
    score10: rows.reduce((sum, row) => sum + numberValue(row.central_value, 0), 0),
  };
}
