export function normalizeNotificationPrefs(input = {}) {
  const prefs = input && typeof input === 'object' ? input : {};
  return {
    enabled: prefs.enabled !== false,
    dailyBudget: prefs.dailyBudget === true || prefs.morningBudget === true || prefs.eveningSummary === true,
    morningBudget: prefs.morningBudget === true || prefs.dailyBudget === true,
    eveningSummary: prefs.eveningSummary === true,
    serverPush: prefs.serverPush !== false,
    inbox: prefs.inbox !== false,
    trip: prefs.trip !== false,
    lowBudget: prefs.lowBudget !== false,
    sound: prefs.sound !== false,
    mobilePush: prefs.mobilePush !== false,
    localDevice: prefs.localDevice === true,
    timezone: typeof prefs.timezone === 'string' && prefs.timezone.trim() ? prefs.timezone.trim() : '',
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

export function selectBudgetNotificationVariant({ remainingToday = 0, delta = 0, pct = 0, currency = 'EUR' } = {}) {
  const remaining = Number(remainingToday) || 0;
  const gap = Number(delta) || 0;
  const trendPct = Number(pct) || 0;
  const cur = String(currency || 'EUR').toUpperCase();

  if (remaining < 0) {
    return {
      tone: 'over_today',
      titleFr: 'Budget a surveiller',
      titleEn: 'Budget watch',
      bodyFr: ({ money, pctText }) => `Aujourd'hui depasse de ${money(Math.abs(remaining), cur)}. Tendance vs budget app : ${pctText}, ${money(gap, cur)}.`,
      bodyEn: ({ money, pctText }) => `Today is over by ${money(Math.abs(remaining), cur)}. Trend vs app budget: ${pctText}, ${money(gap, cur)}.`,
    };
  }

  if (trendPct < -10 || gap < 0) {
    return {
      tone: 'ahead',
      titleFr: 'Budget en avance',
      titleEn: 'Ahead of budget',
      bodyFr: ({ money, pctText }) => `Reste aujourd'hui ${money(remaining, cur)}. Tu es mieux que le budget app : ${pctText}, ${money(gap, cur)}.`,
      bodyEn: ({ money, pctText }) => `Today left ${money(remaining, cur)}. You are ahead of app budget: ${pctText}, ${money(gap, cur)}.`,
    };
  }

  if (trendPct > 10 || gap > 0) {
    return {
      tone: 'above_trend',
      titleFr: 'Rythme budget eleve',
      titleEn: 'Budget pace high',
      bodyFr: ({ money, pctText }) => `Reste aujourd'hui ${money(remaining, cur)}. Tendance au-dessus du budget app : ${pctText}, ${money(gap, cur)}.`,
      bodyEn: ({ money, pctText }) => `Today left ${money(remaining, cur)}. Trend above app budget: ${pctText}, ${money(gap, cur)}.`,
    };
  }

  return {
    tone: 'steady',
    titleFr: 'Budget du matin',
    titleEn: 'Morning budget',
    bodyFr: ({ money, pctText }) => `Reste aujourd'hui ${money(remaining, cur)}. Ecart tendance vs budget app : ${pctText}, ${money(gap, cur)}.`,
    bodyEn: ({ money, pctText }) => `Today left ${money(remaining, cur)}. Trend gap vs app budget: ${pctText}, ${money(gap, cur)}.`,
  };
}
