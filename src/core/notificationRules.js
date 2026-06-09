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
    emojis: prefs.emojis !== false,
    motivationalTone: prefs.motivationalTone !== false,
    sportReminder: prefs.sportReminder !== false,
    workReminder: prefs.workReminder !== false,
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

function withEmoji(text, emoji, enabled = true) {
  return enabled ? `${emoji} ${text}` : text;
}

export function selectBudgetNotificationVariant({ remainingToday = 0, delta = 0, pct = 0, currency = 'EUR', emojis = true } = {}) {
  const remaining = Number(remainingToday) || 0;
  const gap = Number(delta) || 0;
  const trendPct = Number(pct) || 0;
  const cur = String(currency || 'EUR').toUpperCase();

  if (remaining < 0) {
    return {
      tone: 'over_today',
      titleFr: withEmoji('Budget a surveiller', '⚠️', emojis),
      titleEn: withEmoji('Budget watch', '⚠️', emojis),
      bodyFr: ({ money, pctText }) => `Aujourd'hui depasse de ${money(Math.abs(remaining), cur)}. Tendance vs budget app : ${pctText}, ${money(gap, cur)}.`,
      bodyEn: ({ money, pctText }) => `Today is over by ${money(Math.abs(remaining), cur)}. Trend vs app budget: ${pctText}, ${money(gap, cur)}.`,
    };
  }

  if (trendPct < -10 || gap < 0) {
    return {
      tone: 'ahead',
      titleFr: withEmoji('Budget en avance', '✅', emojis),
      titleEn: withEmoji('Ahead of budget', '✅', emojis),
      bodyFr: ({ money, pctText }) => `Reste aujourd'hui ${money(remaining, cur)}. Tu es mieux que le budget app : ${pctText}, ${money(gap, cur)}.`,
      bodyEn: ({ money, pctText }) => `Today left ${money(remaining, cur)}. You are ahead of app budget: ${pctText}, ${money(gap, cur)}.`,
    };
  }

  if (trendPct > 10 || gap > 0) {
    return {
      tone: 'above_trend',
      titleFr: withEmoji('Rythme budget eleve', '🟠', emojis),
      titleEn: withEmoji('Budget pace high', '🟠', emojis),
      bodyFr: ({ money, pctText }) => `Reste aujourd'hui ${money(remaining, cur)}. Tendance au-dessus du budget app : ${pctText}, ${money(gap, cur)}.`,
      bodyEn: ({ money, pctText }) => `Today left ${money(remaining, cur)}. Trend above app budget: ${pctText}, ${money(gap, cur)}.`,
    };
  }

  return {
    tone: 'steady',
    titleFr: withEmoji('Budget du matin', '🌅', emojis),
    titleEn: withEmoji('Morning budget', '🌅', emojis),
    bodyFr: ({ money, pctText }) => `Reste aujourd'hui ${money(remaining, cur)}. Ecart tendance vs budget app : ${pctText}, ${money(gap, cur)}.`,
    bodyEn: ({ money, pctText }) => `Today left ${money(remaining, cur)}. Trend gap vs app budget: ${pctText}, ${money(gap, cur)}.`,
  };
}

export function selectActivityNudge({ slot = 'morning', activity = {}, prefs = {} } = {}) {
  const p = normalizeNotificationPrefs(prefs);
  const sportCount = Number(activity.sportCount || 0);
  const sportKcal = Number(activity.sportKcal || 0);
  const workCount = Number(activity.workCount || 0);
  const workKcal = Number(activity.workKcal || 0);
  const workMinutes = Number(activity.workMinutes || 0);
  const evening = String(slot || '').toLowerCase() === 'evening';

  if (evening) {
    if (sportKcal > 0 && workKcal > 0) return { fr: `Sport ${Math.round(sportKcal)} kcal, travail ${Math.round(workKcal)} kcal. Grosse journee.`, en: `Sport ${Math.round(sportKcal)} kcal, work ${Math.round(workKcal)} kcal. Big day.` };
    if (sportKcal > 0) return { fr: `Sport note : ${Math.round(sportKcal)} kcal.`, en: `Sport logged: ${Math.round(sportKcal)} kcal.` };
    if (workKcal > 0) return { fr: `Travail note : ${Math.round(workKcal)} kcal sur ${Math.round(workMinutes / 60 * 10) / 10}h.`, en: `Work logged: ${Math.round(workKcal)} kcal over ${Math.round(workMinutes / 60 * 10) / 10}h.` };
    if (p.workReminder) return { fr: 'Tu as travaille aujourd hui ? Ajoute la journee pour garder les kcal a jour.', en: 'Did you work today? Add the day to keep kcal up to date.' };
  }

  if (!evening && p.sportReminder && sportCount <= 0) {
    return { fr: 'Envie de 15 min de marche, corde ou ping-pong aujourd hui ?', en: 'Up for 15 min of walking, jump rope or table tennis today?' };
  }
  return null;
}

export function composeDailyBudgetNotification({ slot = 'morning', remainingToday = 0, daily = 0, spentToday = 0, delta = 0, pct = 0, currency = 'EUR', activity = {}, prefs = {}, money, pctText } = {}) {
  const p = normalizeNotificationPrefs(prefs);
  const cur = String(currency || 'EUR').toUpperCase();
  const fmtMoney = money || ((value, c) => `${Math.round((Number(value) || 0) * 100) / 100} ${c || cur}`.trim());
  const fmtPct = pctText || `${Number(pct || 0) > 0 ? '+' : ''}${Math.round(Number(pct || 0))}%`;
  const evening = String(slot || '').toLowerCase() === 'evening';
  const variant = selectBudgetNotificationVariant({ remainingToday, delta, pct, currency: cur, emojis: p.emojis });
  const titleFr = evening ? withEmoji('Bilan du soir', '🌙', p.emojis) : variant.titleFr;
  const titleEn = evening ? withEmoji('Evening summary', '🌙', p.emojis) : variant.titleEn;
  const budgetLineFr = evening
    ? `Budget restant ${fmtMoney(remainingToday, cur)}.`
    : variant.bodyFr({ money: fmtMoney, pctText: fmtPct });
  const budgetLineEn = evening
    ? `Budget left ${fmtMoney(remainingToday, cur)}.`
    : variant.bodyEn({ money: fmtMoney, pctText: fmtPct });
  const nudge = p.motivationalTone ? selectActivityNudge({ slot, activity, prefs: p }) : null;
  const morningSpendFr = !evening && Number(daily) > 0 ? ` Depense du jour ${fmtMoney(spentToday, cur)} / ${fmtMoney(daily, cur)}.` : '';
  const morningSpendEn = !evening && Number(daily) > 0 ? ` Today spend ${fmtMoney(spentToday, cur)} / ${fmtMoney(daily, cur)}.` : '';
  return {
    tone: variant.tone,
    titleFr,
    titleEn,
    bodyFr: `${budgetLineFr}${morningSpendFr}${nudge?.fr ? ` ${nudge.fr}` : ''}`.trim(),
    bodyEn: `${budgetLineEn}${morningSpendEn}${nudge?.en ? ` ${nudge.en}` : ''}`.trim(),
  };
}
