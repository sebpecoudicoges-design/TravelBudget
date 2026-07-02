const DEFAULT_DISPOSABLE_PATTERNS = [
  /^travelbudget_offline_snapshot_v1_/i,
  /^travelbudget_offline_snapshot_v2_/i,
  /^travelbudget_error_logs_v2$/i,
  /^travelbudget_nutrition_food_cache/i,
  /^travelbudget_sport_library/i,
  /^travelbudget_fx_/i,
  /^EUR_RATES$/i,
  /^travelbudget_assist_thread/i,
  /^travelbudget_notification_read/i,
  /(?:^|_)cache(?:_|$)/i,
];

export function isQuotaExceededError(error) {
  return !!error && (
    error.name === 'QuotaExceededError'
    || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || Number(error.code) === 22
    || Number(error.code) === 1014
  );
}

export function disposableStorageEntries(storage, options = {}) {
  const protectedKeys = new Set((options.protectedKeys || []).map(String));
  const patterns = options.patterns || DEFAULT_DISPOSABLE_PATTERNS;
  const rows = [];
  try {
    for (let index = 0; index < Number(storage?.length || 0); index += 1) {
      const key = storage.key(index);
      if (!key || protectedKeys.has(String(key))) continue;
      if (!patterns.some((pattern) => pattern.test(String(key)))) continue;
      const value = storage.getItem(key) || '';
      rows.push({ key: String(key), bytes: (String(key).length + String(value).length) * 2 });
    }
  } catch (_) {}
  return rows.sort((a, b) => b.bytes - a.bytes || a.key.localeCompare(b.key));
}

export function safeStorageSet(storage, key, value, options = {}) {
  const storageKey = String(key || '');
  const raw = String(value ?? '');
  if (!storage || !storageKey) return { ok: false, removedKeys: [], error: new Error('Storage and key are required.') };
  try {
    storage.setItem(storageKey, raw);
    return { ok: true, removedKeys: [], recovered: false };
  } catch (error) {
    if (!isQuotaExceededError(error)) return { ok: false, removedKeys: [], error };
    const removedKeys = [];
    const candidates = disposableStorageEntries(storage, {
      ...options,
      protectedKeys: [...(options.protectedKeys || []), storageKey],
    });
    let latestError = error;
    for (const candidate of candidates) {
      try {
        storage.removeItem(candidate.key);
        removedKeys.push(candidate.key);
        storage.setItem(storageKey, raw);
        return { ok: true, removedKeys, recovered: true };
      } catch (retryError) {
        latestError = retryError;
        if (!isQuotaExceededError(retryError)) break;
      }
    }
    return { ok: false, removedKeys, error: latestError };
  }
}

export const storageQuota = {
  isQuotaExceededError,
  disposableStorageEntries,
  safeSet: safeStorageSet,
};
