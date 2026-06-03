export function normalizeNotificationPrefs(input = {}) {
  const prefs = input && typeof input === 'object' ? input : {};
  return {
    enabled: prefs.enabled !== false,
    dailyBudget: prefs.dailyBudget === true,
    inbox: prefs.inbox !== false,
    trip: prefs.trip !== false,
    lowBudget: prefs.lowBudget !== false,
    sound: prefs.sound !== false,
    mobilePush: prefs.mobilePush !== false,
  };
}

export function notificationPrefKeyForPayload(payload = {}) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const source = String(payload.source || data.source || '').toLowerCase();
  const view = String(payload.view || data.view || '').toLowerCase();
  const kind = String(data.kind || '').toLowerCase();
  if (source.includes('daily') || kind.includes('daily')) return 'dailyBudget';
  if (source.includes('low_budget') || source.includes('low-budget') || kind.includes('low_budget')) return 'lowBudget';
  if (source.includes('trip') || kind.includes('trip') || view === 'trip') return 'trip';
  if (source.includes('inbox') || view === 'inbox') return 'inbox';
  return 'inbox';
}

export function canForceMobileNotification({ mode = 'none', isAdmin = false } = {}) {
  return mode === 'internal' || !!isAdmin;
}
