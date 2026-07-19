export function normText(value) {
  try {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  } catch (_) {
    return String(value || '').toLowerCase().trim();
  }
}

export function txMatchesActiveTravel(tx, activeTravelId = '') {
  const id = String(activeTravelId || '');
  if (!id) return true;
  const txTravelId = String(tx?.travelId || tx?.travel_id || '');
  return !txTravelId || txTravelId === id;
}

export function txAffectsBudget(tx) {
  const type = String(tx?.type || '').toLowerCase();
  if (type !== 'expense') return false;
  const affectsBudget = (tx?.affectsBudget === undefined || tx?.affectsBudget === null) ? true : !!tx?.affectsBudget;
  const outOfBudget = !!tx?.outOfBudget || !!tx?.out_of_budget;
  return affectsBudget && !outOfBudget;
}

export function txAffectsCash(tx) {
  const payNow = tx?.payNow ?? tx?.pay_now;
  return payNow === undefined ? true : !!payNow;
}

export function isInternalMovementTx(tx) {
  if (!tx) return false;
  if (tx.internalTransferId || tx.internal_transfer_id) return true;
  if (tx.isInternal || tx.is_internal) return true;
  const cat = normText(tx.category);
  const label = normText(tx.label);
  return cat === 'mouvement interne'
    || cat === 'internal movement'
    || label.includes('[internal]')
    || label.includes('mouvement interne');
}

export function isTripLinkedTx(tx) {
  return !!(tx?.tripExpenseId || tx?.trip_expense_id || tx?.tripShareLinkId || tx?.trip_share_link_id);
}

export function isCashPendingProjectionTx(tx, { activeTravelId = '' } = {}) {
  if (!tx) return false;
  if (!txMatchesActiveTravel(tx, activeTravelId)) return false;
  if (isInternalMovementTx(tx)) return false;
  if (isTripLinkedTx(tx)) return false;
  if (txAffectsCash(tx)) return false;
  const type = String(tx.type || '').toLowerCase();
  if (type !== 'income' && type !== 'expense') return false;
  if (!String(tx.walletId || tx.wallet_id || '').trim()) return false;
  return true;
}

export function alcoholForFood(food = {}, grams = 0, alcoholForGrams = null) {
  if (typeof alcoholForGrams === 'function') return alcoholForGrams(food, grams);
  const tags = Array.isArray(food?.tags) ? food.tags : [];
  const text = normText(`${food?.key || ''} ${food?.name || ''} ${tags.join(' ')}`);
  if (/sans alcool|alcohol[-_ ]?free|0\s?%/.test(text)) return { gramsAlcohol: 0, standardDrinks: 0 };
  const isAlcohol = tags.some((tag) => ['alcool', 'alcohol'].includes(normText(tag)))
    || /\b(biere|beer|ipa|pinte|vin|wine|cidre|cider|whisky|vodka|rhum|rum|gin|cocktail)\b/.test(text);
  if (!isAlcohol) return { gramsAlcohol: 0, standardDrinks: 0 };
  const abv = /vin|wine/.test(text) ? 0.125 : (/whisky|vodka|rhum|rum|gin|spiritueux/.test(text) ? 0.40 : (/ipa/.test(text) ? 0.06 : 0.05));
  const gramsAlcohol = Math.max(0, Number(grams) || Number(food?.servingGrams || food?.serving_grams) || 0) * abv * 0.789;
  return { gramsAlcohol, standardDrinks: gramsAlcohol / 10 };
}

export function ageFromBirthDate(value, now = new Date()) {
  const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  let age = now.getFullYear() - Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const currentMonth = now.getMonth() + 1;
  if (currentMonth < month || (currentMonth === month && now.getDate() < day)) age -= 1;
  return age > 0 && age < 130 ? age : 0;
}

export function baselineKcal({ readBodyMetric = () => null, now = new Date() } = {}) {
  const custom = Number(readBodyMetric('bmr', 0));
  if (Number.isFinite(custom) && custom > 900) return custom;
  const weight = Number(readBodyMetric('weight', 70));
  const height = Number(readBodyMetric('height', 175));
  const age = ageFromBirthDate(readBodyMetric('birthdate', ''), now) || Number(readBodyMetric('age', 35));
  const sex = String(readBodyMetric('sex', 'male')).toLowerCase();
  const offset = sex === 'female' || sex === 'f' ? -161 : 5;
  const bmr = 10 * (Number.isFinite(weight) ? weight : 70)
    + 6.25 * (Number.isFinite(height) ? height : 175)
    - 5 * (Number.isFinite(age) ? age : 35)
    + offset;
  return Math.max(1200, Math.round(bmr));
}

export function normalizeNutritionGoal(raw = {}) {
  const modeRaw = String(raw.mode || 'bulk');
  return {
    mode: ['bulk', 'maintenance', 'cut'].includes(modeRaw) ? modeRaw : 'maintenance',
    surplusKcal: Math.max(300, Math.min(500, Math.round(Number(raw.surplusKcal) || 350))),
    deficitKcal: Math.max(250, Math.min(500, Math.round(Number(raw.deficitKcal) || 300))),
  };
}

export function nutritionSummaryForDate(dateISO, {
  state = {},
  foods = [],
  alcoholForGrams = null,
} = {}) {
  const day = String(dateISO || '').slice(0, 10);
  const sameDay = (value) => String(value || '').slice(0, 10) === day;
  const meals = (Array.isArray(state?.nutritionMeals) ? state.nutritionMeals : [])
    .filter((meal) => sameDay(meal.meal_date || meal.mealDate));
  const mealIds = new Set(meals.map((meal) => String(meal.id || '')));
  const items = (Array.isArray(state?.nutritionMealItems) ? state.nutritionMealItems : [])
    .filter((item) => mealIds.has(String(item.meal_id || item.mealId || '')));
  const foodForItem = (item) => {
    const key = String(item?.food_key || item?.foodKey || '');
    return foods.find((food) => String(food?.key || '') === key) || { key, name: item?.label || key, tags: [] };
  };
  const hasItem = (meal) => items.some((item) => String(item.meal_id || item.mealId || '') === String(meal.id || ''));
  const isWaterOnly = (meal) => {
    const label = normText(meal?.label);
    return !hasItem(meal) && (label === 'eau' || label === 'water');
  };
  const sum = (keyA, keyB) => items.reduce((acc, item) => acc + (Number(item?.[keyA] ?? item?.[keyB]) || 0), 0);
  const alcoholEntries = items.map((item) => {
    const food = foodForItem(item);
    const alcohol = alcoholForFood(food, Number(item?.grams) || Number(food?.servingGrams || food?.serving_grams) || 0, alcoholForGrams);
    if (!Number(alcohol.standardDrinks || 0)) return null;
    return {
      label: item?.label || food?.name || food?.key || 'Alcool',
      grams: Number(item?.grams) || 0,
      gramsAlcohol: Number(alcohol.gramsAlcohol) || 0,
      standardDrinks: Number(alcohol.standardDrinks) || 0,
    };
  }).filter(Boolean);
  return {
    mealCount: meals.length,
    itemCount: items.length,
    kcal: sum('kcal', 'kcal'),
    protein: sum('protein_g', 'proteinG'),
    carbs: sum('carbs_g', 'carbsG'),
    fat: sum('fat_g', 'fatG'),
    drinkWaterMl: meals.reduce((acc, meal) => acc + (isWaterOnly(meal) ? (Number(meal?.water_ml ?? meal?.waterMl) || 0) : 0), 0),
    foodWaterMl: meals.reduce((acc, meal) => acc + (!isWaterOnly(meal) ? (Number(meal?.water_ml ?? meal?.waterMl) || 0) : 0), 0),
    alcoholDrinks: alcoholEntries.reduce((acc, row) => acc + row.standardDrinks, 0),
    alcoholGrams: alcoholEntries.reduce((acc, row) => acc + row.gramsAlcohol, 0),
    alcoholEntries,
  };
}

export function offsetDateISO(day, offsetDays = 0, todayISO = '') {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) ? String(day) : String(todayISO || new Date().toISOString().slice(0, 10));
  const [y, m, d0] = base.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, d0 || 1));
  d.setUTCDate(d.getUTCDate() + (Number(offsetDays) || 0));
  return d.toISOString().slice(0, 10);
}

export function sleepSummaryForDate(dateISO, {
  rows = {},
  todayISO = '',
} = {}) {
  const day = String(dateISO || '').slice(0, 10);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : String(todayISO || new Date().toISOString().slice(0, 10));
  const nightDay = offsetDateISO(base, -1, todayISO);
  const row = rows[nightDay] || rows[day] || {};
  return { hours: Number(row.hours) || 0, quality: String(row.quality || 'ok'), nightDay };
}

export function alcoholWeekSummaryForDate(dateISO, context = {}) {
  const rows = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = offsetDateISO(dateISO, -i, context.todayISO || '');
    const nutrition = nutritionSummaryForDate(day, context);
    rows.push({ day, drinks: Number(nutrition.alcoholDrinks) || 0 });
  }
  return {
    rows,
    drinks: rows.reduce((sum, row) => sum + row.drinks, 0),
    drinkingDays: rows.filter((row) => row.drinks > 0.05).length,
  };
}

export function activitySummaryForDate(dateISO, {
  state = {},
  activityKcal = null,
} = {}) {
  const day = String(dateISO || '').slice(0, 10);
  const sameDay = (value) => String(value || '').slice(0, 10) === day;
  const sportRows = Array.isArray(state?.sportSessions) ? state.sportSessions : [];
  const workRows = Array.isArray(state?.workDays) ? state.workDays : [];
  const sumKeys = (rows, keys) => rows.reduce((acc, row) => acc + keys.reduce((value, key) => Number.isFinite(Number(row?.[key])) ? Number(row[key]) : value, 0), 0);
  const sport = sportRows.filter((row) => sameDay(row.started_at || row.startedAt));
  const work = workRows.filter((row) => sameDay(row.work_date || row.workDate));
  return {
    sportCount: sport.length,
    sportKcal: Number(activityKcal?.sportKcal ?? sumKeys(sport, ['estimated_kcal', 'estimatedKcal'])) || 0,
    workCount: work.length,
    workKcal: Number(activityKcal?.workKcal ?? sumKeys(work, ['estimated_kcal', 'estimatedKcal'])) || 0,
    workMinutes: sumKeys(work, ['duration_minutes', 'durationMinutes']),
  };
}

export function healthSummaryForDate(dateISO, {
  activity = null,
  state = {},
  foods = [],
  sleepRows = {},
  readBodyMetric = () => null,
  nutritionGoal = { mode: 'bulk', surplusKcal: 350, deficitKcal: 300 },
  todayISO = '',
  now = new Date(),
  alcoholForGrams = null,
} = {}) {
  const normalizedGoal = normalizeNutritionGoal(nutritionGoal);
  const nutrition = nutritionSummaryForDate(dateISO, { state, foods, alcoholForGrams, todayISO });
  const sleep = sleepSummaryForDate(dateISO, { rows: sleepRows, todayISO });
  const sportKcal = Number(activity?.sportKcal) || 0;
  const workKcal = Number(activity?.workKcal) || 0;
  const activityKcal = sportKcal + workKcal;
  const baseline = baselineKcal({ readBodyMetric, now });
  const nutritionSurplusKcal = normalizedGoal.mode === 'bulk' ? normalizedGoal.surplusKcal : 0;
  const nutritionDeficitKcal = normalizedGoal.mode === 'cut' ? normalizedGoal.deficitKcal : 0;
  const nutritionGoalOffsetKcal = nutritionSurplusKcal - nutritionDeficitKcal;
  const needsKcal = Math.max(1200, baseline + activityKcal + nutritionGoalOffsetKcal);
  const day = String(dateISO || '').slice(0, 10);
  const today = String(todayISO || new Date().toISOString().slice(0, 10));
  const hourNow = day === today ? (now.getHours() + now.getMinutes() / 60) : 23.99;
  const dayProgress = hourNow < 9 ? 0.18 : hourNow < 12 ? 0.34 : hourNow < 15 ? 0.58 : hourNow < 18 ? 0.72 : hourNow < 21 ? 0.90 : 1;
  const expectedKcalNow = Math.max(250, needsKcal * dayProgress);
  const balance = nutrition.kcal - needsKcal;
  const currentBalance = nutrition.kcal - expectedKcalNow;
  const kcalGap = Math.abs(currentBalance);
  const kcalFreeBand = Math.max(260, expectedKcalNow * 0.18);
  const kcalWideBand = Math.max(850, expectedKcalNow * 0.55);
  const kcalScore = kcalGap <= kcalFreeBand
    ? 42
    : Math.max(0, 42 - ((kcalGap - kcalFreeBand) / Math.max(1, kcalWideBand - kcalFreeBand)) * 34);
  const hydrationScore = Math.min(24, (nutrition.drinkWaterMl / 2000) * 24);
  const proteinMultiplier = normalizedGoal.mode === 'bulk' ? 1.8 : normalizedGoal.mode === 'cut' ? 1.9 : 1.6;
  const proteinTarget = Math.max(70, (Number(readBodyMetric('weight', 70)) || 70) * proteinMultiplier);
  const proteinScore = Math.min(18, (nutrition.protein / proteinTarget) * 18);
  const loadScore = activityKcal > 1200 ? 8 : activityKcal > 850 ? 12 : activityKcal > 200 ? 16 : 12;
  const sleepBase = sleep.hours <= 0
    ? 8
    : (sleep.hours >= 7 && sleep.hours <= 9)
      ? 16
      : sleep.hours < 7
        ? Math.max(0, 16 - (7 - sleep.hours) * 5)
        : Math.max(0, 16 - (sleep.hours - 9) * 3);
  const sleepScore = sleep.quality === 'bad' ? Math.max(0, sleepBase - 5) : sleep.quality === 'good' ? Math.min(18, sleepBase + 2) : sleepBase;
  const alcoholWeek = alcoholWeekSummaryForDate(dateISO, { state, foods, alcoholForGrams, todayISO });
  const alcoholDrinks = Number(nutrition.alcoholDrinks) || 0;
  const alcoholWeeklyDrinks = Number(alcoholWeek.drinks) || 0;
  const alcoholScore = alcoholDrinks > 2.01
    ? Math.max(0, 10 - (alcoholDrinks - 2) * 5)
    : alcoholWeeklyDrinks > 10.01
      ? Math.max(0, 10 - (alcoholWeeklyDrinks - 10) * 1.5)
      : alcoholWeek.drinkingDays >= 6 && alcoholWeeklyDrinks > 0.1
        ? 7
        : alcoholDrinks > 0.05
          ? 9
          : 10;
  const score = Math.max(0, Math.min(100, Math.round(kcalScore + hydrationScore + proteinScore + loadScore + sleepScore + alcoholScore - 18)));
  const level = score >= 78 ? 'good' : score >= 58 ? 'warn' : 'bad';
  const label = score >= 78 ? 'Equilibre' : score >= 58 ? 'A surveiller' : 'A corriger';
  const reasons = [];
  if (kcalScore < 14) reasons.push("energie eloignee de l'objectif actuel");
  if (hydrationScore < 10) reasons.push('eau bue faible');
  if (proteinScore < 10) reasons.push('proteines sous cible');
  if (sleep.hours > 0 && sleepScore < 10) reasons.push('recuperation courte');
  if (alcoholDrinks > 2.01) reasons.push('alcool au-dessus du repere jour');
  else if (alcoholWeeklyDrinks > 10.01) reasons.push('alcool au-dessus du repere semaine');
  let advice = 'Equilibre correct entre besoins, nutrition, eau et charge.';
  if (!nutrition.mealCount) advice = 'Ajoute tes repas pour activer une lecture sante fiable.';
  else if (reasons.length) advice = `Score bas surtout: ${reasons.slice(0, 3).join(', ')}.`;
  else if (nutrition.drinkWaterMl < 1400) advice = "Hydratation a completer : l'objectif suit l'eau bue, pas l'eau des aliments.";
  else if (balance < -450 && activityKcal > 250) advice = 'Deficit marque avec activite : prevois proteines et glucides utiles.';
  else if (balance > 450) advice = 'Journee haute en kcal : vise leger, eau et legumes au prochain repas.';
  else if (sleep.hours > 0 && sleep.hours < 6.5) advice = 'Nuit courte : allege la charge et vise recuperation.';
  else if (activityKcal > 900) advice = 'Charge forte : pense recuperation, sommeil et proteines.';
  return {
    ...nutrition,
    baseline,
    needsKcal,
    nutritionGoalMode: normalizedGoal.mode,
    nutritionSurplusKcal,
    nutritionDeficitKcal,
    nutritionGoalOffsetKcal,
    expectedKcalNow,
    dayProgress,
    balance,
    currentBalance,
    activityKcal,
    sleepHours: sleep.hours,
    sleepQuality: sleep.quality,
    sleepNightDay: sleep.nightDay,
    kcalScore,
    hydrationScore,
    proteinScore,
    loadScore,
    sleepScore,
    alcoholScore,
    alcoholDrinks,
    alcoholWeeklyDrinks,
    alcoholDrinkingDays: alcoholWeek.drinkingDays,
    alcoholEntries: nutrition.alcoholEntries,
    alcoholWeekRows: alcoholWeek.rows,
    proteinTarget,
    score,
    level,
    label,
    advice,
    color: level === 'good' ? '#22c55e' : level === 'warn' ? '#f59e0b' : '#ef4444',
  };
}

export function healthActionRows(h) {
  const rows = [];
  const kcalLeftNow = Math.round(Number(h?.expectedKcalNow || 0) - Number(h?.kcal || 0));
  const kcalLeftDay = Math.round(Number(h?.needsKcal || 0) - Number(h?.kcal || 0));
  const waterLeft = Math.max(0, Math.round(2000 - Number(h?.drinkWaterMl || 0)));
  const proteinLeft = Math.max(0, Math.round(Number(h?.proteinTarget || 0) - Number(h?.protein || 0)));
  if (!Number(h?.mealCount || 0)) {
    rows.push({ tone: 'warn', title: 'Saisir la journée', body: 'Ajoute au moins un repas pour fiabiliser le score et les conseils.' });
  } else if (kcalLeftNow > 300) {
    rows.push({ tone: 'good', title: 'Energie maintenant', body: `Il manque environ ${kcalLeftNow} kcal a cette heure. Vise un repas simple ou un encas utile.` });
  } else if (kcalLeftNow < -350) {
    rows.push({ tone: 'warn', title: 'Energie haute', body: "Tu es deja haut pour l'heure. Garde le prochain apport plus leger, eau et legumes." });
  } else {
    rows.push({ tone: 'good', title: 'Energie stable', body: `Tu es proche du rythme du jour. Reste environ ${Math.max(0, kcalLeftDay)} kcal sur la journee.` });
  }
  if (waterLeft > 450) rows.push({ tone: 'info', title: 'Hydratation', body: `Encore ${waterLeft} ml d'eau bue a viser. L'eau des aliments reste separee.` });
  if (proteinLeft > 18) rows.push({ tone: 'info', title: 'Proteines', body: `Ajoute environ ${proteinLeft} g : fromage blanc, skyr, oeufs, poulet, thon ou whey.` });
  if (Number(h?.sleepHours || 0) <= 0) rows.push({ tone: 'warn', title: 'Sommeil', body: 'Renseigne la nuit pour que le score recuperation soit fiable.' });
  else if (Number(h.sleepHours) < 7) rows.push({ tone: 'warn', title: 'Recuperation', body: 'Nuit courte : garde la charge raisonnable et privilegie sommeil ce soir.' });
  if (Number(h?.alcoholDrinks || 0) > 2) rows.push({ tone: 'warn', title: 'Alcool', body: 'Tu depasses le repere jour de 2 verres standard. Vise eau, repas simple et pause alcool demain.' });
  else if (Number(h?.alcoholWeeklyDrinks || 0) > 10) rows.push({ tone: 'warn', title: 'Alcool semaine', body: 'La semaine depasse 10 verres standard. Planifie des jours sans alcool.' });
  if (Number(h?.activityKcal || 0) > 700) rows.push({ tone: 'info', title: 'Charge elevee', body: 'Sport + travail sont hauts : pense glucides utiles, proteines et repos.' });
  return rows.slice(0, 4);
}
