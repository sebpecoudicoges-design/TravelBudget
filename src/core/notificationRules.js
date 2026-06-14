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
    healthMealReminders: prefs.healthMealReminders === true || prefs.nutritionReminders === true,
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
    : `Reste ${fmtMoney(remainingToday, cur)}.`;
  const budgetLineEn = evening
    ? `Budget left ${fmtMoney(remainingToday, cur)}.`
    : `Left ${fmtMoney(remainingToday, cur)}.`;
  const nudge = p.motivationalTone ? selectActivityNudge({ slot, activity, prefs: p }) : null;
  const morningSpendFr = !evening && Number(daily) > 0 ? ` Jour ${fmtMoney(spentToday, cur)} / ${fmtMoney(daily, cur)}.` : '';
  const morningSpendEn = !evening && Number(daily) > 0 ? ` Day ${fmtMoney(spentToday, cur)} / ${fmtMoney(daily, cur)}.` : '';
  return {
    tone: variant.tone,
    titleFr,
    titleEn,
    bodyFr: `${budgetLineFr}${morningSpendFr}${nudge?.fr ? ` ${nudge.fr}` : ''}`.trim(),
    bodyEn: `${budgetLineEn}${morningSpendEn}${nudge?.en ? ` ${nudge.en}` : ''}`.trim(),
  };
}

export const HEALTH_MEAL_SLOTS = Object.freeze([
  { slot: 'breakfast', mealType: 'breakfast', time: '08:00', expectedPct: 0.22, waterPct: 0.22, proteinPct: 0.20, titleFr: 'Petit dej', titleEn: 'Breakfast' },
  { slot: 'morning_snack', mealType: 'morning_snack', time: '10:00', expectedPct: 0.34, waterPct: 0.36, proteinPct: 0.30, titleFr: 'Pause 10h', titleEn: '10am snack' },
  { slot: 'lunch', mealType: 'lunch', time: '12:30', expectedPct: 0.58, waterPct: 0.56, proteinPct: 0.58, titleFr: 'Dejeuner', titleEn: 'Lunch' },
  { slot: 'afternoon_snack', mealType: 'afternoon_snack', time: '16:00', expectedPct: 0.72, waterPct: 0.75, proteinPct: 0.72, titleFr: 'Gouter', titleEn: 'Afternoon snack' },
  { slot: 'dinner', mealType: 'dinner', time: '19:30', expectedPct: 0.90, waterPct: 0.92, proteinPct: 0.92, titleFr: 'Diner', titleEn: 'Dinner' },
]);

function mealSlotMeta(slot) {
  const clean = String(slot || '').toLowerCase();
  return HEALTH_MEAL_SLOTS.find((row) => row.slot === clean || row.mealType === clean) || HEALTH_MEAL_SLOTS[0];
}

export function composeHealthMealNotification({
  slot = 'breakfast',
  consumedKcal = 0,
  needsKcal = 0,
  drinkWaterMl = 0,
  waterTargetMl = 2000,
  protein = 0,
  proteinTarget = 95,
  prefs = {},
} = {}) {
  const p = normalizeNotificationPrefs(prefs);
  const meta = mealSlotMeta(slot);
  const kcalTargetNow = Math.max(250, (Number(needsKcal) || 2000) * Number(meta.expectedPct || 0));
  const kcalGap = kcalTargetNow - (Number(consumedKcal) || 0);
  const waterTargetNow = Math.max(250, (Number(waterTargetMl) || 2000) * Number(meta.waterPct || 0));
  const waterGap = waterTargetNow - (Number(drinkWaterMl) || 0);
  const proteinTargetNow = Math.max(12, (Number(proteinTarget) || 95) * Number(meta.proteinPct || 0));
  const proteinGap = proteinTargetNow - (Number(protein) || 0);
  const kcalGapText = `${Math.abs(Math.round(kcalGap))} kcal`;
  const waterGapText = `${Math.max(0, Math.round(waterGap / 50) * 50)} ml`;
  const proteinGapText = `${Math.max(0, Math.round(proteinGap))} g`;
  const titleBaseFr = meta.titleFr || 'Repas';
  const titleBaseEn = meta.titleEn || titleBaseFr;

  if (kcalGap < -280) {
    return {
      tone: 'light',
      titleFr: withEmoji(`${titleBaseFr} leger`, '🟠', p.emojis),
      titleEn: withEmoji(`${titleBaseEn}: go light`, '🟠', p.emojis),
      bodyFr: `Tu es deja haut pour cette heure. Vise eau, legumes ou proteines legeres.`,
      bodyEn: `You are already high for this time. Aim for water, vegetables or lean protein.`,
      slot: meta.slot,
      mealType: meta.mealType,
    };
  }

  if (proteinGap > 14) {
    return {
      tone: 'protein',
      titleFr: withEmoji(`${titleBaseFr}: proteines`, '💪', p.emojis),
      titleEn: withEmoji(`${titleBaseEn}: protein`, '💪', p.emojis),
      bodyFr: `Objectif simple: ajoute environ ${proteinGapText} de proteines et garde le repas propre.`,
      bodyEn: `Simple target: add about ${proteinGapText} protein and keep the meal clean.`,
      slot: meta.slot,
      mealType: meta.mealType,
    };
  }

  if (waterGap > 300) {
    return {
      tone: 'hydration',
      titleFr: withEmoji(`${titleBaseFr}: hydratation`, '💧', p.emojis),
      titleEn: withEmoji(`${titleBaseEn}: hydration`, '💧', p.emojis),
      bodyFr: `Il manque environ ${waterGapText} d'eau bue pour rester dans le rythme.`,
      bodyEn: `About ${waterGapText} of drunk water is missing to stay on pace.`,
      slot: meta.slot,
      mealType: meta.mealType,
    };
  }

  if (kcalGap > 260) {
    return {
      tone: 'energy',
      titleFr: withEmoji(`${titleBaseFr}: energie utile`, '⚡', p.emojis),
      titleEn: withEmoji(`${titleBaseEn}: useful energy`, '⚡', p.emojis),
      bodyFr: `Il reste environ ${kcalGapText} a cette heure. Choisis simple: feculent + proteine + fruit/legumes.`,
      bodyEn: `About ${kcalGapText} left for this time. Keep it simple: carbs + protein + fruit/veg.`,
      slot: meta.slot,
      mealType: meta.mealType,
    };
  }

  return {
    tone: 'steady',
    titleFr: withEmoji(`${titleBaseFr}: bon rythme`, '✅', p.emojis),
    titleEn: withEmoji(`${titleBaseEn}: on pace`, '✅', p.emojis),
    bodyFr: `Tu es proche du bon rythme. Continue simple, eau a portee et portions propres.`,
    bodyEn: `You are close to the right pace. Keep it simple, water nearby and clean portions.`,
    slot: meta.slot,
    mealType: meta.mealType,
  };
}
