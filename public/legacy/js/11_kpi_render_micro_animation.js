/* =========================
   KPI + Render (micro animation)
   ========================= */

function budgetClass(v) {
  if (v >= state.period.dailyBudgetBase * 0.7) return "good";
  if (v >= state.period.dailyBudgetBase * 0.35) return "warn";
  return "bad";
}

function _activeTravelIdKpi() {
  try { return String(window.state?.activeTravelId || state?.activeTravelId || ""); } catch (_) { return ""; }
}

function _txMatchesActiveTravelKpi(tx) {
  const activeTravelId = _activeTravelIdKpi();
  if (!activeTravelId) return true;
  const txTravelId = String(tx?.travelId || tx?.travel_id || "");
  return !txTravelId || txTravelId === activeTravelId;
}

function _txAffectsBudgetKpi(tx) {
  try { if (typeof window.tbTxAffectsBudget === 'function') return !!window.tbTxAffectsBudget(tx); } catch (_) {}
  const type = String(tx?.type || '').toLowerCase();
  if (type !== 'expense') return false;
  const affectsBudget = (tx?.affectsBudget === undefined || tx?.affectsBudget === null) ? true : !!tx?.affectsBudget;
  const outOfBudget = !!tx?.outOfBudget || !!tx?.out_of_budget;
  return affectsBudget && !outOfBudget;
}

function _txAffectsCashKpi(tx) {
  try { if (typeof window.tbTxAffectsCash === 'function') return !!window.tbTxAffectsCash(tx); } catch (_) {}
  const p = (tx?.payNow ?? tx?.pay_now);
  return (p === undefined) ? true : !!p;
}

function _kpiNormText(s) {
  try {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  } catch (_) {
    return String(s || "").toLowerCase().trim();
  }
}

function _kpiNutritionFoods() {
  try {
    if (Array.isArray(window.state?.nutritionFoods)) return window.state.nutritionFoods;
    const key = window.TB_CONST?.LS_KEYS?.nutrition_food_cache || "travelbudget_nutrition_food_cache_v1";
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

function _kpiFoodForNutritionItem(item) {
  const key = String(item?.food_key || item?.foodKey || "");
  return _kpiNutritionFoods().find((food) => String(food?.key || "") === key) || { key, name: item?.label || key, tags: [] };
}

function _kpiAlcoholForFood(food, grams) {
  try {
    if (window.Core?.nutritionRules?.alcoholForGrams) return window.Core.nutritionRules.alcoholForGrams(food, grams);
  } catch (_) {}
  const tags = Array.isArray(food?.tags) ? food.tags : [];
  const text = _kpiNormText(`${food?.key || ""} ${food?.name || ""} ${tags.join(" ")}`);
  if (/sans alcool|alcohol[-_ ]?free|0\s?%/.test(text)) return { gramsAlcohol: 0, standardDrinks: 0 };
  const isAlcohol = tags.some((tag) => ["alcool", "alcohol"].includes(_kpiNormText(tag)))
    || /\b(biere|beer|ipa|pinte|vin|wine|cidre|cider|whisky|vodka|rhum|gin|cocktail)\b/.test(text);
  if (!isAlcohol) return { gramsAlcohol: 0, standardDrinks: 0 };
  const abv = /vin|wine/.test(text) ? 0.125 : (/whisky|vodka|rhum|rum|gin|spiritueux/.test(text) ? 0.40 : (/ipa/.test(text) ? 0.06 : 0.05));
  const gramsAlcohol = Math.max(0, Number(grams) || Number(food?.servingGrams || food?.serving_grams) || 0) * abv * 0.789;
  return { gramsAlcohol, standardDrinks: gramsAlcohol / 10 };
}

function _kpiIsInternalMovementTx(tx) {
  if (!tx) return false;
  if (tx.internalTransferId || tx.internal_transfer_id) return true;
  try {
    if (typeof window.tbIsInternalMovement === "function" && window.tbIsInternalMovement(tx)) return true;
  } catch (_) {}
  if (tx.isInternal || tx.is_internal) return true;
  const cat = _kpiNormText(tx.category);
  const label = _kpiNormText(tx.label);
  return cat === "mouvement interne"
    || cat === "internal movement"
    || label.includes("[internal]")
    || label.includes("mouvement interne");
}

function _kpiIsTripLinkedTx(tx) {
  return !!(tx?.tripExpenseId || tx?.trip_expense_id || tx?.tripShareLinkId || tx?.trip_share_link_id);
}

function _kpiIsCashPendingProjectionTx(tx) {
  if (!tx) return false;
  if (!_txMatchesActiveTravelKpi(tx)) return false;
  if (_kpiIsInternalMovementTx(tx)) return false;
  if (_kpiIsTripLinkedTx(tx)) return false;
  if (_txAffectsCashKpi(tx)) return false;
  const type = String(tx.type || "").toLowerCase();
  if (type !== "income" && type !== "expense") return false;
  // If no wallet is attached, this is usually a budget-only technical line.
  if (!String(tx.walletId || tx.wallet_id || "").trim()) return false;
  return true;
}

function _kpiActivitySummaryForDate(dateISO) {
  const day = String(dateISO || '').slice(0, 10);
  const sameDay = (v) => String(v || '').slice(0, 10) === day;
  const activityKcal = (typeof window.tbActivityKcalForDay === "function")
    ? window.tbActivityKcalForDay(day)
    : null;
  const sportRows = Array.isArray(window.state?.sportSessions) ? window.state.sportSessions : [];
  const workRows = Array.isArray(window.state?.workDays) ? window.state.workDays : [];
  const sumKeys = (rows, keys) => rows.reduce((acc, row) => acc + keys.reduce((v, k) => Number.isFinite(Number(row?.[k])) ? Number(row[k]) : v, 0), 0);
  const sport = sportRows.filter((x) => sameDay(x.started_at || x.startedAt));
  const work = workRows.filter((x) => sameDay(x.work_date || x.workDate));
  return {
    sportCount: sport.length,
    sportKcal: Number(activityKcal?.sportKcal ?? sumKeys(sport, ['estimated_kcal', 'estimatedKcal'])) || 0,
    workCount: work.length,
    workKcal: Number(activityKcal?.workKcal ?? sumKeys(work, ['estimated_kcal', 'estimatedKcal'])) || 0,
    workMinutes: sumKeys(work, ['duration_minutes', 'durationMinutes']),
  };
}

function _kpiBodyMetric(key, fallback) {
  try {
    const ls = window.TB_CONST?.LS_KEYS || {};
    const map = {
      weight: ls.sport_body_weight || "travelbudget_sport_body_weight_v1",
      height: ls.sport_body_height || "travelbudget_sport_body_height_v1",
      birthdate: ls.body_birthdate || "travelbudget_body_birthdate_v1",
      age: ls.body_age || "travelbudget_body_age_v1",
      sex: ls.body_sex || "travelbudget_body_sex_v1",
      bmr: ls.body_bmr || "travelbudget_body_bmr_v1",
    };
    const raw = (key === "weight" || key === "height")
      ? (window.tbReadScopedLocalStorage ? window.tbReadScopedLocalStorage(map[key], fallback) : localStorage.getItem(map[key]))
      : localStorage.getItem(map[key]);
    return raw === null || raw === "" ? fallback : raw;
  } catch (_) {
    return fallback;
  }
}

function _kpiAgeFromBirthDate(value) {
  if (window.Core?.bodyEnergyRules?.ageFromBirthDate) return window.Core.bodyEnergyRules.ageFromBirthDate(value);
  const m = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  const now = new Date();
  let age = now.getFullYear() - Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const currentMonth = now.getMonth() + 1;
  if (currentMonth < month || (currentMonth === month && now.getDate() < day)) age -= 1;
  return age > 0 && age < 130 ? age : 0;
}

function _kpiBaselineKcal() {
  const custom = Number(_kpiBodyMetric("bmr", 0));
  if (Number.isFinite(custom) && custom > 900) return custom;
  const weight = Number(_kpiBodyMetric("weight", 70));
  const height = Number(_kpiBodyMetric("height", 175));
  const age = _kpiAgeFromBirthDate(_kpiBodyMetric("birthdate", "")) || Number(_kpiBodyMetric("age", 35));
  const sex = String(_kpiBodyMetric("sex", "male")).toLowerCase();
  const offset = sex === "female" || sex === "f" ? -161 : 5;
  const bmr = 10 * (Number.isFinite(weight) ? weight : 70)
    + 6.25 * (Number.isFinite(height) ? height : 175)
    - 5 * (Number.isFinite(age) ? age : 35)
    + offset;
  return Math.max(1200, Math.round(bmr));
}

function _kpiNutritionGoal() {
  try {
    if (typeof window.tbLoadHealthGoal === "function") return window.tbLoadHealthGoal();
    const key = `${window.TB_CONST?.LS_KEYS?.health_goal || "travelbudget_health_goal_v1"}::${window.sbUser?.id || "anon"}`;
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    const modeRaw = String(raw.mode || "bulk");
    return {
      mode: ["bulk", "maintenance", "cut"].includes(modeRaw) ? modeRaw : "maintenance",
      surplusKcal: Math.max(300, Math.min(500, Math.round(Number(raw.surplusKcal) || 350))),
      deficitKcal: Math.max(250, Math.min(500, Math.round(Number(raw.deficitKcal) || 300))),
    };
  } catch (_) {
    return { mode: "bulk", surplusKcal: 350, deficitKcal: 300 };
  }
}

function _kpiNutritionSummaryForDate(dateISO) {
  const day = String(dateISO || "").slice(0, 10);
  const sameDay = (v) => String(v || "").slice(0, 10) === day;
  const meals = (Array.isArray(window.state?.nutritionMeals) ? window.state.nutritionMeals : []).filter((meal) => sameDay(meal.meal_date || meal.mealDate));
  const mealIds = new Set(meals.map((meal) => String(meal.id || "")));
  const items = (Array.isArray(window.state?.nutritionMealItems) ? window.state.nutritionMealItems : []).filter((item) => mealIds.has(String(item.meal_id || item.mealId || "")));
  const hasItem = (meal) => items.some((item) => String(item.meal_id || item.mealId || "") === String(meal.id || ""));
  const isWaterOnly = (meal) => {
    const label = _kpiNormText(meal?.label);
    return !hasItem(meal) && (label === "eau" || label === "water");
  };
  const sum = (keyA, keyB) => items.reduce((acc, item) => acc + (Number(item?.[keyA] ?? item?.[keyB]) || 0), 0);
  const alcoholEntries = items.map((item) => {
    const food = _kpiFoodForNutritionItem(item);
    const alcohol = _kpiAlcoholForFood(food, Number(item?.grams) || Number(food?.servingGrams || food?.serving_grams) || 0);
    if (!Number(alcohol.standardDrinks || 0)) return null;
    return {
      label: item?.label || food?.name || food?.key || "Alcool",
      grams: Number(item?.grams) || 0,
      gramsAlcohol: Number(alcohol.gramsAlcohol) || 0,
      standardDrinks: Number(alcohol.standardDrinks) || 0,
    };
  }).filter(Boolean);
  return {
    mealCount: meals.length,
    itemCount: items.length,
    kcal: sum("kcal", "kcal"),
    protein: sum("protein_g", "proteinG"),
    carbs: sum("carbs_g", "carbsG"),
    fat: sum("fat_g", "fatG"),
    drinkWaterMl: meals.reduce((acc, meal) => acc + (isWaterOnly(meal) ? (Number(meal?.water_ml ?? meal?.waterMl) || 0) : 0), 0),
    foodWaterMl: meals.reduce((acc, meal) => acc + (!isWaterOnly(meal) ? (Number(meal?.water_ml ?? meal?.waterMl) || 0) : 0), 0),
    alcoholDrinks: alcoholEntries.reduce((acc, row) => acc + row.standardDrinks, 0),
    alcoholGrams: alcoholEntries.reduce((acc, row) => acc + row.gramsAlcohol, 0),
    alcoholEntries,
  };
}

function _kpiSleepSummaryForDate(dateISO) {
  const day = String(dateISO || "").slice(0, 10);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? day
    : (typeof window.toLocalISODate === "function" ? window.toLocalISODate(new Date()) : new Date().toISOString().slice(0, 10));
  const [y, m, d0] = base.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, d0 || 1));
  d.setUTCDate(d.getUTCDate() - 1);
  const nightDay = d.toISOString().slice(0, 10);
  const readRows = () => {
    try {
      if (window.state?.nutritionSleep && typeof window.state.nutritionSleep === "object") return window.state.nutritionSleep;
      const lsKey = window.TB_CONST?.LS_KEYS?.nutrition_sleep || "travelbudget_nutrition_sleep_v1";
      const scoped = `${lsKey}::${window.sbUser?.id || "anon"}`;
      return JSON.parse(localStorage.getItem(scoped) || "{}") || {};
    } catch (_) {
      return {};
    }
  };
  const rows = readRows();
  const row = rows[nightDay] || rows[day] || {};
  return { hours: Number(row.hours) || 0, quality: String(row.quality || "ok"), nightDay };
}

function _kpiOffsetDateISO(day, offsetDays) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) ? String(day) : (typeof window.toLocalISODate === "function" ? window.toLocalISODate(new Date()) : new Date().toISOString().slice(0, 10));
  const [y, m, d0] = base.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, d0 || 1));
  d.setUTCDate(d.getUTCDate() + (Number(offsetDays) || 0));
  return d.toISOString().slice(0, 10);
}

function _kpiAlcoholWeekSummaryForDate(dateISO) {
  const rows = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = _kpiOffsetDateISO(dateISO, -i);
    const nutrition = _kpiNutritionSummaryForDate(day);
    rows.push({ day, drinks: Number(nutrition.alcoholDrinks) || 0 });
  }
  return {
    rows,
    drinks: rows.reduce((sum, row) => sum + row.drinks, 0),
    drinkingDays: rows.filter((row) => row.drinks > 0.05).length,
  };
}

function _kpiHealthSummaryForDate(dateISO, activity) {
  const nutrition = _kpiNutritionSummaryForDate(dateISO);
  const sleep = _kpiSleepSummaryForDate(dateISO);
  const sportKcal = Number(activity?.sportKcal) || 0;
  const workKcal = Number(activity?.workKcal) || 0;
  const activityKcal = sportKcal + workKcal;
  const baseline = _kpiBaselineKcal();
  const nutritionGoal = _kpiNutritionGoal();
  const nutritionSurplusKcal = nutritionGoal.mode === "bulk" ? nutritionGoal.surplusKcal : 0;
  const nutritionDeficitKcal = nutritionGoal.mode === "cut" ? nutritionGoal.deficitKcal : 0;
  const nutritionGoalOffsetKcal = nutritionSurplusKcal - nutritionDeficitKcal;
  const needsKcal = Math.max(1200, baseline + activityKcal + nutritionGoalOffsetKcal);
  const day = String(dateISO || "").slice(0, 10);
  const today = (typeof window.toLocalISODate === "function" ? window.toLocalISODate(new Date()) : new Date().toISOString().slice(0, 10));
  const hourNow = day === today ? (new Date().getHours() + new Date().getMinutes() / 60) : 23.99;
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
  const proteinMultiplier = nutritionGoal.mode === "bulk" ? 1.8 : nutritionGoal.mode === "cut" ? 1.9 : 1.6;
  const proteinTarget = Math.max(70, (Number(_kpiBodyMetric("weight", 70)) || 70) * proteinMultiplier);
  const proteinScore = Math.min(18, (nutrition.protein / proteinTarget) * 18);
  const loadScore = activityKcal > 1200 ? 8 : activityKcal > 850 ? 12 : activityKcal > 200 ? 16 : 12;
  const sleepBase = sleep.hours <= 0
    ? 8
    : (sleep.hours >= 7 && sleep.hours <= 9)
      ? 16
      : sleep.hours < 7
        ? Math.max(0, 16 - (7 - sleep.hours) * 5)
        : Math.max(0, 16 - (sleep.hours - 9) * 3);
  const sleepScore = sleep.quality === "bad" ? Math.max(0, sleepBase - 5) : sleep.quality === "good" ? Math.min(18, sleepBase + 2) : sleepBase;
  const alcoholWeek = _kpiAlcoholWeekSummaryForDate(dateISO);
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
  const level = score >= 78 ? "good" : score >= 58 ? "warn" : "bad";
  const label = score >= 78 ? "Equilibre" : score >= 58 ? "A surveiller" : "A corriger";
  const reasons = [];
  if (kcalScore < 14) reasons.push("energie eloignee de l'objectif actuel");
  if (hydrationScore < 10) reasons.push("eau bue faible");
  if (proteinScore < 10) reasons.push("proteines sous cible");
  if (sleep.hours > 0 && sleepScore < 10) reasons.push("recuperation courte");
  if (alcoholDrinks > 2.01) reasons.push("alcool au-dessus du repere jour");
  else if (alcoholWeeklyDrinks > 10.01) reasons.push("alcool au-dessus du repere semaine");
  let advice = "Equilibre correct entre besoins, nutrition, eau et charge.";
  if (!nutrition.mealCount) advice = "Ajoute tes repas pour activer une lecture sante fiable.";
  else if (reasons.length) advice = `Score bas surtout: ${reasons.slice(0, 3).join(", ")}.`;
  else if (nutrition.drinkWaterMl < 1400) advice = "Hydratation a completer : l'objectif suit l'eau bue, pas l'eau des aliments.";
  else if (balance < -450 && activityKcal > 250) advice = "Deficit marque avec activite : prevois proteines et glucides utiles.";
  else if (balance > 450) advice = "Journee haute en kcal : vise leger, eau et legumes au prochain repas.";
  else if (sleep.hours > 0 && sleep.hours < 6.5) advice = "Nuit courte : allege la charge et vise recuperation.";
  else if (activityKcal > 900) advice = "Charge forte : pense recuperation, sommeil et proteines.";
  return {
    ...nutrition,
    baseline,
    needsKcal,
    nutritionGoalMode: nutritionGoal.mode,
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
    color: level === "good" ? "#22c55e" : level === "warn" ? "#f59e0b" : "#ef4444",
  };
}

function _kpiHealthActionRows(h) {
  const rows = [];
  const kcalLeftNow = Math.round(Number(h?.expectedKcalNow || 0) - Number(h?.kcal || 0));
  const kcalLeftDay = Math.round(Number(h?.needsKcal || 0) - Number(h?.kcal || 0));
  const waterLeft = Math.max(0, Math.round(2000 - Number(h?.drinkWaterMl || 0)));
  const proteinLeft = Math.max(0, Math.round(Number(h?.proteinTarget || 0) - Number(h?.protein || 0)));
  if (!Number(h?.mealCount || 0)) {
    rows.push({ tone: "warn", title: "Saisir la journée", body: "Ajoute au moins un repas pour fiabiliser le score et les conseils." });
  } else if (kcalLeftNow > 300) {
    rows.push({ tone: "good", title: "Energie maintenant", body: `Il manque environ ${kcalLeftNow} kcal a cette heure. Vise un repas simple ou un encas utile.` });
  } else if (kcalLeftNow < -350) {
    rows.push({ tone: "warn", title: "Energie haute", body: "Tu es deja haut pour l'heure. Garde le prochain apport plus leger, eau et legumes." });
  } else {
    rows.push({ tone: "good", title: "Energie stable", body: `Tu es proche du rythme du jour. Reste environ ${Math.max(0, kcalLeftDay)} kcal sur la journee.` });
  }
  if (waterLeft > 450) rows.push({ tone: "info", title: "Hydratation", body: `Encore ${waterLeft} ml d'eau bue a viser. L'eau des aliments reste separee.` });
  if (proteinLeft > 18) rows.push({ tone: "info", title: "Proteines", body: `Ajoute environ ${proteinLeft} g : fromage blanc, skyr, oeufs, poulet, thon ou whey.` });
  if (Number(h?.sleepHours || 0) <= 0) rows.push({ tone: "warn", title: "Sommeil", body: "Renseigne la nuit pour que le score recuperation soit fiable." });
  else if (Number(h.sleepHours) < 7) rows.push({ tone: "warn", title: "Recuperation", body: "Nuit courte : garde la charge raisonnable et privilegie sommeil ce soir." });
  if (Number(h?.alcoholDrinks || 0) > 2) rows.push({ tone: "warn", title: "Alcool", body: "Tu depasses le repere jour de 2 verres standard. Vise eau, repas simple et pause alcool demain." });
  else if (Number(h?.alcoholWeeklyDrinks || 0) > 10) rows.push({ tone: "warn", title: "Alcool semaine", body: "La semaine depasse 10 verres standard. Planifie des jours sans alcool." });
  if (Number(h?.activityKcal || 0) > 700) rows.push({ tone: "info", title: "Charge elevee", body: "Sport + travail sont hauts : pense glucides utiles, proteines et repos." });
  return rows.slice(0, 4);
}


try {
  window.tbComputeHealthSummaryForDate = function tbComputeHealthSummaryForDate(dateISO, activity) {
    return _kpiHealthSummaryForDate(dateISO, activity || _kpiActivitySummaryForDate(dateISO));
  };
} catch (_) {}
function remainingBudgetBaseFrom(dateStr) {
  const start = parseISODateOrNull(dateStr);
  const end = parseISODateOrNull(state.period.end);
  if (!start || !end) return 0;

  let sum = 0;
  forEachDateInclusive(start, end, (d) => {
    const ds = toLocalISODate(d);
    const b = getDailyBudgetForDate(ds);
    sum += Math.max(0, b);
  });
  return sum;
}

function projectedEndEUR() {
  const today = toLocalISODate(new Date());
  const remainingBase = remainingBudgetBaseFrom(today);
  const remainingEUR = amountToEUR(remainingBase, state.period.baseCurrency);
  return totalInEUR() - remainingEUR;
}

function netPendingEUR(rangeStartISO, rangeEndISO) {
  // Net of unpaid items (pay_now=false) within an optional date range:
  // + unpaid incomes, - unpaid expenses
  // Excludes internal/shadow rows (isInternal=true)
  //
  // A tx is included if its [dateStart,dateEnd] overlaps [rangeStartISO,rangeEndISO].
  // If no range is provided, includes all unpaid tx in the active period.
  const rs = rangeStartISO ? parseISODateOrNull(rangeStartISO) : null;
  const re = rangeEndISO ? parseISODateOrNull(rangeEndISO) : null;

  function _txOverlaps(tx) {
    if (!rs && !re) return true;
    const ds = parseISODateOrNull(tx.dateStart) || (tx.date ? new Date(Number(tx.date)) : null);
    const de = parseISODateOrNull(tx.dateEnd) || ds;
    if (!ds) return false;

    const a = clampMidnight(ds);
    const b = clampMidnight(de || ds);

    const r0 = rs ? clampMidnight(rs) : null;
    const r1 = re ? clampMidnight(re) : null;

    if (r0 && b < r0) return false;
    if (r1 && a > r1) return false;
    return true;
  }

  let net = 0;
  for (const tx of (state.transactions || [])) {
    if (!_kpiIsCashPendingProjectionTx(tx)) continue;
    if (!_txOverlaps(tx)) continue;

    const v = amountToEUR(Number(tx.amount) || 0, tx.currency);
    if (tx.type === "income") net += v;
    else if (tx.type === "expense") net -= v;
  }
  return net;
}

function _kpiDatesOverlap(aStartISO, aEndISO, bStartISO, bEndISO) {
  const as = parseISODateOrNull(aStartISO);
  const ae = parseISODateOrNull(aEndISO || aStartISO);
  const bs = parseISODateOrNull(bStartISO);
  const be = parseISODateOrNull(bEndISO || bStartISO);
  if (!as || !ae || !bs || !be) return true;
  const a0 = clampMidnight(as);
  const a1 = clampMidnight(ae);
  const b0 = clampMidnight(bs);
  const b1 = clampMidnight(be);
  return !(a1 < b0 || a0 > b1);
}

function _kpiTripNetRowInRange(row, rangeStartISO, rangeEndISO) {
  // Trip net balances are currently stored as a whole-trip balance. We scope them
  // by the trip's linked period so the KPI filter does not pull unrelated trips.
  const periodId = String(row?.periodId || row?.period_id || "");
  if (!periodId) return true;
  const periods = Array.isArray(state?.periods) ? state.periods : [];
  const p = periods.find((x) => String(x?.id || "") === periodId);
  if (!p) return true;
  return _kpiDatesOverlap(p.start || p.start_date, p.end || p.end_date, rangeStartISO, rangeEndISO);
}

function fmtKPICompact(v) {
  const n = Number(v);
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e7) {
    try {
      return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
    } catch (_) {}
  }
  return String(Math.round(n));
}

function projectedEndDisplayWithOptions(opts) {
  // KPI "Fin période":
  //   trésorerie actuelle (wallets) - prévision quotidienne (budget/jour) jusqu'à la fin
  //   + optionnel: inclure les entrées/dépenses non payées/reçues (toggle)
  // Par défaut, l'horizon = segment courant. opts.scope='period' => horizon = fin de période.

  const includeUnpaid = !!opts?.includeUnpaid;
const scopeRaw = String(opts?.scope || "segment");
const scope = scopeRaw.toLowerCase();
const todayISO = (typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : toLocalISODate(new Date());

  function _eurRateForDate(cur, dateISO) {
    const c = String(cur || "EUR").toUpperCase();
    if (c === "EUR") return 1;

    // Period base currency: prefer period eurBaseRate (1 EUR = X BASE)
    const periodBase = String(state?.period?.baseCurrency || "").toUpperCase();
    const periodRate = Number(state?.period?.eurBaseRate);
    if (periodBase && c === periodBase && Number.isFinite(periodRate) && periodRate > 0) return periodRate;

    // Segment override (fixed)
    if (typeof getBudgetSegmentForDate === "function") {
      const seg = getBudgetSegmentForDate(dateISO);
      const segCur = String(seg?.baseCurrency || "").toUpperCase();
      const segMode = String(seg?.fxMode || "").toLowerCase();
      const segRate = Number(seg?.eurBaseRateFixed);
      if (segCur && c === segCur && segMode === "fixed" && Number.isFinite(segRate) && segRate > 0) return segRate;
    }

    // Live FX cache
    if (typeof window.fxGetEurRates === "function") {
      const rates = window.fxGetEurRates() || {};
      const r = Number(rates[c]);
      if (Number.isFinite(r) && r > 0) return r;
    }

    return null;
  }

  function _toEURSafe(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const c = String(cur || "EUR").toUpperCase();
    if (c === "EUR") return a;
    const r = _eurRateForDate(c, dateISO);
    if (!(Number.isFinite(r) && r > 0)) {
      try {
        window.__kpiFxMiss = window.__kpiFxMiss || {};
        const k = c + "->EUR";
        window.__kpiFxMiss[k] = (window.__kpiFxMiss[k] || 0) + 1;
      } catch (_) {}
      return 0;
    }
    // 1 EUR = r CUR => CUR -> EUR = / r
    return a / r;
  }
  function _tripNetBalancesEUR(dateISO, rangeStartISO, rangeEndISO) {
    const rows = Array.isArray(state?.tripNetBalances) && state.tripNetBalances.length
      ? state.tripNetBalances
      : (Array.isArray(window.__tripState?.globalNetRows) ? window.__tripState.globalNetRows : []);
    const byTrip = new Map();
    for (const row of rows) {
      const net = Number(row?.net || 0);
      if (!Number.isFinite(net) || Math.abs(net) < 0.000001) continue;
      if (!_kpiTripNetRowInRange(row, rangeStartISO, rangeEndISO)) continue;
      const cur = String(row?.currency || state?.period?.baseCurrency || "EUR").toUpperCase();
      let converted = null;
      if (cur === "EUR") {
        converted = net;
      } else {
        try {
          if (typeof window.fxConvert === "function") converted = window.fxConvert(net, cur, "EUR");
        } catch (_) {}
      }
      if (converted === null || !Number.isFinite(converted)) continue;
      const key = String(row?.tripId || row?.trip_id || row?.tripName || row?.trip_name || "trip");
      byTrip.set(key, (byTrip.get(key) || 0) + converted);
    }
    let out = 0;
    for (const v of byTrip.values()) {
      if (Math.abs(Number(v) || 0) >= 1) out += v;
    }
    return out;
  }

  // Total wallets now in EUR
  let totalNowEUR = 0;
  for (const w of (state.wallets || [])) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
  ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
  : (Number(w.balance) || 0);
    const cur = w.currency || "EUR";
    totalNowEUR += _toEURSafe(bal, cur, todayISO);
  }

  // Pending (unpaid/unreceived) in EUR
const horizonStartISO = String(opts?.rangeStartISO || todayISO);

// Horizon end (default: provided range end; else resolve from scope)
let horizonEndISO = String(opts?.rangeEndISO || (state?.period?.end || todayISO));
try {
  if (!opts?.rangeEndISO) {
    if (scope === "period") {
      horizonEndISO = String(state?.period?.end || todayISO);
    } else if (scopeRaw.startsWith("seg:")) {
      const segId = scopeRaw.slice(4);
      const seg = (state.budgetSegments || []).find(s => String(s.id) === String(segId));
      if (seg && (seg.end || seg.end_date)) horizonEndISO = String(seg.end || seg.end_date);
    } else if (scopeRaw.startsWith("range:")) {
      const parts = scopeRaw.split(":");
      if (parts[2]) horizonEndISO = String(parts[2]);
    } else if (typeof getBudgetSegmentForDate === "function") {
      const seg0 = getBudgetSegmentForDate(todayISO);
      if (seg0 && (seg0.end || seg0.end_date)) horizonEndISO = String(seg0.end || seg0.end_date);
    }
  }
} catch (_) {}

  const pendingEUR = includeUnpaid
    ? ((Number(netPendingEUR(horizonStartISO, horizonEndISO)) || 0) + _tripNetBalancesEUR(todayISO, horizonStartISO, horizonEndISO))
    : 0;

  // Forecast daily budget (sum of daily budgets) in EUR
  let forecastEUR = 0;
  const start = parseISODateOrNull(todayISO);
  const end = parseISODateOrNull(horizonEndISO);
  if (start && end) {
    forEachDateInclusive(start, end, (d) => {
      const ds = toLocalISODate(d);
      let cur = String(state?.period?.baseCurrency || "EUR").toUpperCase();
      let daily = Number(state?.period?.dailyBudgetBase || 0);
      try {
        if (ds === todayISO && typeof getDailyBudgetInfoForDate === "function") {
          const info = getDailyBudgetInfoForDate(ds);
          const infoCur = String(info?.baseCurrency || '').toUpperCase();
          const remaining = Number(info?.remaining);
          if (infoCur) cur = infoCur;
          if (Number.isFinite(remaining)) daily = Math.max(0, remaining);
        } else if (typeof getBudgetSegmentForDate === "function") {
          const seg = getBudgetSegmentForDate(ds);
          if (seg) {
            const segCur = String(seg?.baseCurrency || seg?.base_currency || "").toUpperCase();
            const segDaily = Number(seg?.dailyBudgetBase ?? seg?.daily_budget_base);
            if (segCur) cur = segCur;
            if (Number.isFinite(segDaily)) daily = segDaily;
          }
        }
      } catch (_) {}

      forecastEUR += _toEURSafe(Math.max(0, daily), cur, ds);
    });
  }

  return (totalNowEUR + pendingEUR) - forecastEUR;
}


function _toBaseForDate(amount, cur, dateISO) {
  const a = Number(amount) || 0;
  const from = String(cur || "EUR").toUpperCase();
  const base = String(state?.period?.baseCurrency || "EUR").toUpperCase();
  if (from === base) return a;

  const rFrom = _eurRateForDate(from, dateISO);
  const rBase = _eurRateForDate(base, dateISO);

  // If we can't convert reliably, return 0 (better than exploding projections).
  if (!(rFrom && rBase)) {
    // Optional debug hook (throttled)
    try {
      window.__kpiFxMiss = window.__kpiFxMiss || {};
      const k = from + "->" + base;
      window.__kpiFxMiss[k] = (window.__kpiFxMiss[k] || 0) + 1;
    } catch (_) {}
    return 0;
  }

  // EUR pivot: amount(from) / (EUR->from) = EUR, then * (EUR->base)
  return (a / rFrom) * rBase;
}


// NOTE: orphaned projection snippet removed (was causing Illegal return statement at top-level).



/* =========================
   CASH helpers
   ========================= */

// Cash wallets definition:
// - Prefer explicit wallet.type === 'cash' (Option 2)
// - Fallback: name contains "cash" (legacy)
function _getCashWallets() {
  const ws = (state.wallets || []);
  // Strict and deterministic: cash KPI = wallets explicitly typed as cash.
  return ws.filter(w => String(w?.type || "").toLowerCase() === "cash");
}

// Amount convertible to BASE with current engine:
// - BASE currency itself
// - EUR (via EUR-BASE)
// Otherwise: not convertible (FX missing)
function _toBaseSafe(amount, currency) {
  const base = (typeof window.getDisplayCurrency === 'function') ? window.getDisplayCurrency(window.getDisplayDateISO()) : state?.period?.baseCurrency;
  const cur = String(currency || "");
  const amt = Number(amount) || 0;

  if (!base || !cur) return { ok: false, v: 0 };

  // ✅ If cross-rate plugin is present, use it
  if (typeof window.fxConvert === "function") {
    const out = window.fxConvert(amt, cur, base);
    if (out === null) return { ok: false, v: 0 };
    return { ok: true, v: out };
  }

  // Fallback (old engine)
  if (cur === base) return { ok: true, v: amt };
  if (cur === "EUR") {
    const r = Number(state.exchangeRates["EUR-BASE"]) || 0;
    if (!r) return { ok: false, v: 0 };
    return { ok: true, v: amt * r };
  }

  return { ok: false, v: 0 };
}


function _sumCashWalletsBase() {
  const base = (typeof window.getDisplayCurrency === 'function') ? window.getDisplayCurrency(window.getDisplayDateISO()) : state?.period?.baseCurrency;
  let totalBase = 0;
  const excluded = []; // {name,currency,balance}

  for (const w of _getCashWallets()) {
    const cur = w.currency || base;
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
      : (Number(w.balance) || 0);

    // If the wallet is empty, don't surface it as "FX exclu"
    if (!bal) continue;

    const conv = _toBaseSafe(bal, cur);

    if (conv.ok) totalBase += conv.v;
    else excluded.push({ name: w.name || "Wallet", currency: cur, balance: bal });
  }

  return { totalBase, excluded };
}

/* =========================
   Cash runway (UX): based on real cash expenses
   ========================= */
function cashRunwayInfo(windowDays = 7) {
  const cashWallets = _getCashWallets();
  if (!cashWallets.length) return null;

  const { totalBase, excluded } = _sumCashWalletsBase();
  const base = state.period.baseCurrency;

  const cashWalletIds = new Set(cashWallets.map(w => w.id));

  const today = clampMidnight(new Date());

  // Prefer since period start; else last N days
  const ps = parseISODateOrNull(state?.period?.start);
  const start = ps ? clampMidnight(ps) : (() => {
    const s = new Date(today);
    s.setDate(s.getDate() - Math.max(1, Number(windowDays) || 7) + 1);
    return clampMidnight(s);
  })();

  let sumExpenseBase = 0;

  function _normStr(s) {
    try {
      return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    } catch (_) {
      return String(s || "").toLowerCase().trim();
    }
  }

  function _isInternalMovement(tx) {
    // Exclude internal transfers from "burn" (cash runway), e.g. cash↔bank moves.
    const cat = _normStr(tx?.category);
    const label = _normStr(tx?.label);
    if (cat === "mouvement interne" || cat === "internal movement") return true;
    if (label.includes("[internal]") || label.includes("mouvement interne")) return true;
    return false;
  }


  for (const tx of (state.transactions || [])) {
    if (!tx) continue;
    if (!_txMatchesActiveTravelKpi(tx)) continue;
    if (tx.type !== "expense") continue;
    try { if (typeof window.tbIsInternalMovement === 'function' ? window.tbIsInternalMovement(tx) : _isInternalMovement(tx)) continue; } catch (_) { if (_isInternalMovement(tx)) continue; }
    const _paid2 = _txAffectsCashKpi(tx);
    if (!_paid2) continue; // runway = real cash out

    const walletId = String(tx?.walletId ?? tx?.wallet_id ?? '');
    if (cashWalletIds.size && walletId && !cashWalletIds.has(walletId)) continue;

    const d = parseISODateOrNull((typeof tbTxCashDate === 'function') ? tbTxCashDate(tx) : tx.dateStart);
    if (!d) continue;
    const dd = clampMidnight(d);
    if (dd < start || dd > today) continue;

    const cur = tx.currency || base;
    const conv = _toBaseSafe(Number(tx.amount) || 0, cur);
    if (conv.ok) sumExpenseBase += conv.v;
  }

  const days = Math.max(1, dayCountInclusive(start, today));
  const burnPerDay = sumExpenseBase / days;

  const daysLeft = (burnPerDay > 0) ? (totalBase / burnPerDay) : Infinity;

  return {
    totalBase,
    burnPerDay,
    daysLeft,
    excluded,
    windowDays: days,
  };
}

/* =========================
   Cash conservative cover (UX): based on allocations/budget usage
   ========================= */
function cashConservativeInfo() {
  const cashWallets = _getCashWallets();
  if (!cashWallets.length) return null;

  const { totalBase, excluded } = _sumCashWalletsBase();
  const base = state.period.baseCurrency;

  const today = clampMidnight(new Date());
  const ps = parseISODateOrNull(state?.period?.start);
  const start = ps ? clampMidnight(ps) : clampMidnight(new Date(today));

  // measure completed days (to yesterday)
  const end = new Date(today);
  end.setDate(end.getDate() - 1);

  let sumAllocated = 0;
  let activeDays = 0;

  const s = start;
  const e = (end >= start) ? end : today;

  forEachDateInclusive(s, e, (d) => {
    const ds = toLocalISODate(d);
    if (!periodContains(ds)) return;

    const remaining = getDailyBudgetForDate(ds);
    const allocated = (Number(state.period.dailyBudgetBase || 0) - remaining);

    if (allocated > 0) {
      sumAllocated += allocated;
      activeDays += 1;
    }
  });

  const burnPerDay =
    (activeDays > 0) ? (sumAllocated / activeDays) : Number(state.period.dailyBudgetBase || 0);

  const daysLeft = (burnPerDay > 0) ? (totalBase / burnPerDay) : Infinity;

  return {
    totalBase,
    burnPerDay,
    daysLeft,
    excluded,
    activeDays,
  };
}

function _daysPill(daysLeft, labelPrefix) {
  const thresholds = { warn: 7, urgent: 4, critical: 2 };

  if (!isFinite(daysLeft)) {
    return { level: "good", text: `${labelPrefix}: ∞` };
  }

  const dl = Math.max(0, daysLeft);
  const j = Math.ceil(dl);

  if (dl <= thresholds.critical) return { level: "bad", text: `${labelPrefix}: J-${j} (URGENT)` };
  if (dl <= thresholds.urgent) return { level: "warn", text: `${labelPrefix}: J-${j} (bientôt)` };
  if (dl <= thresholds.warn) return { level: "warn", text: `${labelPrefix}: J-${j}` };
  return { level: "good", text: `${labelPrefix}: ~${Math.floor(dl)} j` };
}

function _renderTodayDetailsHTML(dateStr) {
  const info = (typeof getDailyBudgetInfoForDate === "function")
    ? getDailyBudgetInfoForDate(dateStr)
    : { baseCurrency: state?.period?.baseCurrency };
  const fallbackBase = String(info?.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase();
  const details = Array.isArray(info?.rows) ? info.rows : [];
  return window.TBKpiView?.renderKpiTodayDetails?.({
    rows: details,
    fallbackBase,
    emptyLabel: "Aucun détail",
  }) || "";
}

function _sumWalletsDisplay(dateStr) {
  const base = (typeof window.getDisplayCurrency === "function") ? window.getDisplayCurrency(dateStr) : (state?.period?.baseCurrency || "EUR");
  let total = 0;
  for (const w of (state.wallets || [])) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
      : (Number(w.balance) || 0);
    const cur = w.currency || base;
    if (typeof window.amountToDisplayForDate === "function") {
      total += window.amountToDisplayForDate(bal, cur, dateStr);
    } else {
      total += amountToBase(bal, cur);
    }
  }
  return total;
}


function _addDaysISO(dateStr, days) {
  const d = parseISODateOrNull(dateStr);
  if (!d) return dateStr;
  const x = new Date(d);
  x.setDate(x.getDate() + (Number(days) || 0));
  return toLocalISODate(x);
}

function _pilotageInsights(scopeMeta) {
  const today = toLocalISODate(new Date());
  const kind = String(scopeMeta?.kind || "segment");
  const startISO = String(scopeMeta?.startISO || "").slice(0,10);
  const endISO = String(scopeMeta?.endISO || "").slice(0,10);

  // Pilotage should align with the user's projection toggle.
  // If enabled, we include pending amounts (to pay / to receive) in the balance.
  const includePending = (localStorage.getItem("travelbudget_kpi_projection_include_unpaid_v1") === "1");

  // Anchor day for calculations:
  // - default: today
  // - if scope starts in the future, anchor = scope start
  // - if scope ended in the past, nothing useful to show
  let anchorISO = today;
  const tD = parseISODateOrNull(today);
  const sD = parseISODateOrNull(startISO);
  const eD = parseISODateOrNull(endISO);
  if (!tD || !eD) return null;
  if (sD && clampMidnight(sD) > clampMidnight(tD)) anchorISO = startISO;
  const aD = parseISODateOrNull(anchorISO);
  if (!aD) return null;
  if (clampMidnight(aD) > clampMidnight(eD)) return null;

  const info = (typeof getDailyBudgetInfoForDate === "function")
    ? getDailyBudgetInfoForDate(anchorISO)
    : { remaining: getDailyBudgetForDate(anchorISO), daily: state?.period?.dailyBudgetBase || 0, baseCurrency: state?.period?.baseCurrency || "EUR" };

  const base = String(info.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase();
  if (!base) return null;

  // Remaining horizon (inclusive)
  const daysRemaining = Math.max(1, dayCountInclusive(clampMidnight(aD), clampMidnight(eD)));

  // --- FX helpers (pilotage must be stable even when the scope spans multiple segments/currencies)
  function _pilotRatesForDate(dateISO) {
    try {
      if (typeof getBudgetSegmentForDate === "function" && typeof fxRatesForSegment === "function") {
        const seg = getBudgetSegmentForDate(dateISO);
        return fxRatesForSegment(seg);
      }
    } catch (_) {}
    return (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
  }

  function _toEUR(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const c = String(cur || "EUR").toUpperCase();
    if (c === "EUR") return a;
    try {
      if (typeof window.fxConvert === "function") {
        const rates = _pilotRatesForDate(dateISO || today);
        const out = window.fxConvert(a, c, "EUR", rates);
        if (out !== null && isFinite(out)) return out;
      }
    } catch (_) {}
    if (typeof amountToEUR === "function") return amountToEUR(a, c);
    return a;
  }

  function _fromEUR(amountEUR, toCur, dateISO) {
    const a = Number(amountEUR) || 0;
    const c = String(toCur || "EUR").toUpperCase();
    if (c === "EUR") return a;
    try {
      if (typeof window.fxConvert === "function") {
        const rates = _pilotRatesForDate(dateISO || today);
        const out = window.fxConvert(a, "EUR", c, rates);
        if (out !== null && isFinite(out)) return out;
      }
    } catch (_) {}
    // fallback legacy: if only EUR<->BASE is supported, this may be approximate.
    if (typeof eurToAmount === "function") return eurToAmount(a, c);
    return a;
  }

  // Balance in EUR (pivot), optionally including pending.
  let walletTotalEUR = 0;
  for (const w of (state.wallets || [])) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
      : (Number(w.balance) || 0);
    const cur = String(w.currency || "EUR").toUpperCase();
    walletTotalEUR += _toEUR(bal, cur, anchorISO);
  }

  let pendingEUR = 0;
  try {
    if (includePending && typeof netPendingEUR === "function") {
      pendingEUR = Number(netPendingEUR(anchorISO, endISO)) || 0;
    }
    if (includePending) {
      const rows = Array.isArray(state?.tripNetBalances) && state.tripNetBalances.length
        ? state.tripNetBalances
        : (Array.isArray(window.__tripState?.globalNetRows) ? window.__tripState.globalNetRows : []);
      const byTrip = new Map();
      for (const row of rows) {
        const net = Number(row?.net || 0);
        if (!_kpiTripNetRowInRange(row, anchorISO, endISO)) continue;
        if (Number.isFinite(net) && Math.abs(net) > 0.000001) {
          const cur = String(row?.currency || state?.period?.baseCurrency || "EUR").toUpperCase();
          let converted = null;
          try {
            if (typeof window.fxConvert === "function") {
              converted = window.fxConvert(net, cur, "EUR");
              if (converted === null || !Number.isFinite(converted)) converted = window.fxConvert(net, cur, "EUR", _pilotRatesForDate(anchorISO));
            }
          } catch (_) {}
          if (converted !== null && Number.isFinite(converted)) {
            const key = String(row?.tripId || row?.trip_id || row?.tripName || row?.trip_name || "trip");
            byTrip.set(key, (byTrip.get(key) || 0) + converted);
          }
        }
      }
      for (const v of byTrip.values()) {
        if (Math.abs(Number(v) || 0) >= 1) pendingEUR += v;
      }
    }
  } catch (_) {}

  const balanceEUR = walletTotalEUR + pendingEUR;
  const balanceBase = _fromEUR(balanceEUR, base, anchorISO);

  // Planned spend over the horizon (uses the daily budgets of each segment, converted to EUR).
  let plannedSpendEUR = 0;
  try {
    const segs = Array.isArray(state?.budgetSegments) ? state.budgetSegments.slice() : [];
    segs.sort((a,b) => String(a.start||a.start_date||"").localeCompare(String(b.start||b.start_date||"")));
    const a0 = clampMidnight(aD);
    const e0 = clampMidnight(eD);
    for (const seg of segs) {
      const ss = String(seg.start || seg.start_date || "").slice(0,10);
      const ee = String(seg.end || seg.end_date || "").slice(0,10);
      const sDt = parseISODateOrNull(ss);
      const eDt = parseISODateOrNull(ee);
      if (!sDt || !eDt) continue;
      const sM = clampMidnight(sDt);
      const eM = clampMidnight(eDt);
      // overlap with [anchor, end]
      const lo = (sM > a0) ? sM : a0;
      const hi = (eM < e0) ? eM : e0;
      if (lo > hi) continue;
      const days = Math.max(1, dayCountInclusive(lo, hi));
      const segBase = String(seg.baseCurrency || seg.base_currency || base).toUpperCase();
      const segDaily = Number(seg.dailyBudgetBase || seg.daily_budget_base || seg.daily || seg.daily_budget || 0) || 0;
      const dailyEUR = _toEUR(segDaily, segBase, ss || anchorISO);
      plannedSpendEUR += dailyEUR * days;
    }
  } catch (_) {}

  // If we couldn't compute from segments (unexpected state), fallback to current daily * days.
  const fallbackDaily = Number(info.daily || 0);
  if (!(plannedSpendEUR > 0)) {
    plannedSpendEUR = _toEUR(fallbackDaily, base, anchorISO) * daysRemaining;
  }

  const avgPlannedDailyEUR = plannedSpendEUR / daysRemaining;
  const currentDaily = _fromEUR(avgPlannedDailyEUR, base, anchorISO);

  // Cible: finir à 0 (on pourra rendre paramétrable plus tard)
  const targetEnd = 0;

  // Recommended daily (average) to reach target at end of horizon.
  const recommendedDaily = (balanceBase - targetEnd) / daysRemaining;

  // Si tu gardes ton budget actuel, où tu finis ?
  // Projected end balance if we follow the planned daily budgets across segments.
  const projectedEndEUR = balanceEUR - plannedSpendEUR;
  const projectedEndBalance = _fromEUR(projectedEndEUR, base, anchorISO);

  // Jusqu’à quand tu tiens avec le budget actuel (date estimée)
  const daysAtCurrent = (currentDaily > 0) ? Math.floor(balanceBase / currentDaily) : Infinity;
  const zeroDate = isFinite(daysAtCurrent)
    ? _addDaysISO(anchorISO, Math.max(0, daysAtCurrent))
    : "—";

  // Décision courte
  let decision = "Aligné";
  let decisionLevel = "good";

  if (currentDaily <= 0) {
    decision = "Budget/j invalide";
    decisionLevel = "warn";
  } else {
    const ratio = recommendedDaily / currentDaily;
    if (ratio < 0.95) {
      decision = "Réduire";
      decisionLevel = "warn";
      if (ratio < 0.75) decisionLevel = "bad";
    } else if (ratio > 1.05) {
      decision = "Augmenter";
      decisionLevel = "good";
    } else {
      decision = "Aligné";
      decisionLevel = "good";
    }
  }

  return {
    kind,
    base,
    today: anchorISO,
    end: endISO,
    start: startISO,
    daysRemaining,
    balanceBase,
    currentDaily,
    recommendedDaily,
    projectedEndBalance,
    zeroDate,
    decision,
    decisionLevel,
  };
}

function _signPillClass(v) {
  if (v >= 0) return "good";
  // négatif : on passe warn puis bad
  const abs = Math.abs(v);
  if (abs < (state.period.dailyBudgetBase || 1) * 3) return "warn";
  return "bad";
}

/* =========================
   KPI render
   ========================= */
function renderKPI() {
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("kpi:render"); } catch (_) {}
  const __out = (function(){

  const kpi = document.getElementById("kpi");
  const T = window.tbT || ((k) => k);

  // ✅ GUARD: si la vue n'a pas encore monté le conteneur KPI, on ne fait rien.
  if (!kpi) return;

  const today = toLocalISODate(new Date());
  // Display date can later be driven by UI (state.uiDateISO). If absent, it defaults to today.
  const displayDateISO = (typeof window.getDisplayDateISO === "function") ? window.getDisplayDateISO() : today;
  try {
    const hasActivity = window.state?.activityDataLoaded === true
      && Array.isArray(window.state?.sportSessions)
      && Array.isArray(window.state?.workDays);
    if (!hasActivity && !window.__TB_KPI_ACTIVITY_LOADING__ && typeof window.tbEnsureActivityData === "function") {
      window.__TB_KPI_ACTIVITY_LOADING__ = true;
      window.tbEnsureActivityData({ reason: "kpi" })
        .then((result) => {
          window.__TB_KPI_ACTIVITY_LOADING__ = false;
          if (result?.loaded && typeof renderKPI === "function") renderKPI();
        })
        .catch(() => { window.__TB_KPI_ACTIVITY_LOADING__ = false; });
    }
  } catch (_) {}
  const infoToday = (typeof getDailyBudgetInfoForDate === "function")
    ? getDailyBudgetInfoForDate(displayDateISO)
    : { remaining: getDailyBudgetForDate(displayDateISO), daily: state.period.dailyBudgetBase, baseCurrency: state.period.baseCurrency };
  const base = String(infoToday.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase();

  // FX KPI: 1€ expressed in current base currency (of display date segment)
  let fxRateText = "—";
  try {
    const rates = (typeof fxRatesForSegment === "function" && typeof getBudgetSegmentForDate === "function")
      ? fxRatesForSegment(getBudgetSegmentForDate(displayDateISO))
      : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
    if (base === "EUR") {
      fxRateText = "1€ = 1.00 EUR";
    } else if (typeof window.fxConvert === "function") {
      const v = window.fxConvert(1, "EUR", base, rates);
      if (v !== null && isFinite(v)) fxRateText = `1€ = ${Number(v).toFixed(3)} ${base}`;
    }
  } catch (_) {}


  const budgetToday = Number(infoToday.remaining) || getDailyBudgetForDate(displayDateISO);
  const includeUnpaid = (localStorage.getItem("travelbudget_kpi_projection_include_unpaid_v1") === "1");
  const kpiScope = (localStorage.getItem("travelbudget_kpi_projection_scope_v1") || "segment");
  const displayCur = base;              // for "Aujourd'hui" / budget KPIs (segment currency of display day)
  // Account base currency: controls display for Total wallets + Projection (not segment-dependent)
  const displayCurPivot = String((state?.user?.baseCurrency) || "EUR").toUpperCase();

  function _toEUR(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const c = String(cur || "EUR").toUpperCase();
    if (c === "EUR") return a;

    if (typeof window.fxConvert === "function" && typeof getBudgetSegmentForDate === "function") {
      const seg = getBudgetSegmentForDate(dateISO || today);
      const rates = (typeof fxRatesForSegment === "function")
        ? fxRatesForSegment(seg)
        : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
      const out = window.fxConvert(a, c, "EUR", rates);
      if (out !== null && isFinite(out)) return out;
    }

    // fallback legacy (only reliable for BASE<->EUR)
    if (typeof amountToEUR === "function") return amountToEUR(a, c);
    return a;
  }

  function _toPivot(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const from = String(cur || "EUR").toUpperCase();
    const to = String(displayCurPivot || "EUR").toUpperCase();
    if (from === to) return a;

    // Prefer cross FX engine (supports non-EUR cross via EUR pivot)
    if (typeof window.fxConvert === "function" && typeof getBudgetSegmentForDate === "function") {
      const seg = getBudgetSegmentForDate(dateISO || today);
      const rates = (typeof fxRatesForSegment === "function")
        ? fxRatesForSegment(seg)
        : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
      const out = window.fxConvert(a, from, to, rates);
      if (out !== null && isFinite(out)) return out;
    }

    // Fallback: go through EUR
    const eur = _toEUR(a, from, dateISO);
    if (to === "EUR") return eur;
    try {
      const seg = (typeof getBudgetSegmentForDate === "function") ? getBudgetSegmentForDate(dateISO || today) : null;
      const rates = (typeof fxRatesForSegment === "function")
        ? fxRatesForSegment(seg)
        : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
      const out2 = (typeof window.fxConvert === "function") ? window.fxConvert(eur, "EUR", to, rates) : null;
      if (out2 !== null && isFinite(out2)) return out2;
    } catch (_) {}
    return eur;
  }

  function _toPivotStrict(amount, cur, dateISO) {
    const a = Number(amount) || 0;
    const from = String(cur || "EUR").toUpperCase();
    const to = String(displayCurPivot || "EUR").toUpperCase();
    if (from === to) return a;
    try {
      if (typeof window.fxConvert === "function") {
        const direct = window.fxConvert(a, from, to);
        if (direct !== null && isFinite(direct)) return direct;
        const seg = (typeof getBudgetSegmentForDate === "function") ? getBudgetSegmentForDate(dateISO || today) : null;
        const rates = (typeof fxRatesForSegment === "function")
          ? fxRatesForSegment(seg)
          : (typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {});
        const out = window.fxConvert(a, from, to, rates);
        if (out !== null && isFinite(out)) return out;
      }
    } catch (_) {}
    return null;
  }

  function _tripNetBalancesPivot(dateISO, rangeStartISO, rangeEndISO) {
    const rows = Array.isArray(state?.tripNetBalances) && state.tripNetBalances.length
      ? state.tripNetBalances
      : (Array.isArray(window.__tripState?.globalNetRows) ? window.__tripState.globalNetRows : []);
    const byTrip = new Map();
    for (const row of rows) {
      const net = Number(row?.net || 0);
      if (!Number.isFinite(net) || Math.abs(net) < 0.000001) continue;
      if (!_kpiTripNetRowInRange(row, rangeStartISO, rangeEndISO)) continue;
      const converted = _toPivotStrict(net, row?.currency || state?.period?.baseCurrency || "EUR", dateISO);
      if (converted === null || !isFinite(converted)) continue;
      const key = String(row?.tripId || row?.trip_id || row?.tripName || row?.trip_name || "trip");
      byTrip.set(key, (byTrip.get(key) || 0) + converted);
    }
    let out = 0;
    for (const v of byTrip.values()) {
      if (Math.abs(Number(v) || 0) >= 1) out += v;
    }
    return out;
  }

  // Total wallets:
  // - primary value in account base currency (pivot)
  // - secondary value in the current display segment currency (display date segment)
  let walletTotalEUR = 0; // kept name for backward compat in template
  let walletTotalBase = 0;
  for (const w of (state.wallets || [])) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? Number(window.tbGetWalletEffectiveBalance(w.id) || 0)
      : (Number(w.balance) || 0);
    const cur = w.currency || "EUR";
    walletTotalEUR += _toPivot(bal, cur, displayDateISO);

    // Segment/base view for the current display date
    if (typeof window.amountToDisplayForDate === "function") {
      walletTotalBase += window.amountToDisplayForDate(bal, cur, displayDateISO);
    } else if (typeof window.amountToBudgetBaseForDate === "function") {
      walletTotalBase += window.amountToBudgetBaseForDate(bal, cur, displayDateISO);
    } else {
      walletTotalBase += bal;
    }
  }

  function _kpiResolveHorizonEndISO(scope, todayISO) {
    let endISO = state?.period?.end;
    try {
      if (String(scope||"segment").toLowerCase() !== "period" && typeof getBudgetSegmentForDate === "function") {
        const seg0 = getBudgetSegmentForDate(todayISO);
        if (seg0 && (seg0.end || seg0.end_date)) endISO = String(seg0.end || seg0.end_date);
      }
    } catch (_) {}
    return endISO;
  }
  const _kpiHorizonEndISO = _kpiResolveHorizonEndISO(kpiScope, displayDateISO);
  let pendingTransactionsEUR = 0;
  let pendingTripsDisplay = 0;
  let pendingDisplay = 0;
  let totalDisplay = walletTotalEUR;
  let projEndEUR = 0;
  let projEndDisplay = 0;
  let pendingDetailHTML = "";

  // =========================
  // KPI scope selector (V6.6.91)
  // - fixes ReferenceError: scopeOptionsHTML is not defined
  // - supports: segment / period / seg:<id> / range:<start>:<end>
  // =========================
  function _kpiParseScope(raw) {
    const s = String(raw || "segment");
    const low = s.toLowerCase();
    if (low === "segment" || low === "period") return { kind: low, raw: s };
    if (s.startsWith("seg:")) return { kind: "seg", segId: s.slice(4), raw: s };
    if (s.startsWith("range:")) {
      const p = s.split(":");
      return { kind: "range", startISO: p[1] || "", endISO: p[2] || "", raw: s };
    }
    if (low === "range") return { kind: "range", startISO: "", endISO: "", raw: s };
    return { kind: "segment", raw: s };
  }

  function _kpiResolveRange(parsed, refISO) {
    // Default custom range = current segment of ref date, or period bounds.
    let startISO = String(parsed?.startISO || "");
    let endISO = String(parsed?.endISO || "");
    if (startISO && endISO) return { startISO, endISO };
    try {
      if (typeof getBudgetSegmentForDate === "function") {
        const seg = getBudgetSegmentForDate(refISO);
        if (seg) {
          startISO = String(seg.start || seg.start_date || "").slice(0,10);
          endISO = String(seg.end || seg.end_date || "").slice(0,10);
        }
      }
    } catch (_) {}
    if (!startISO) startISO = String(state?.period?.start || "").slice(0,10);
    if (!endISO) endISO = String(state?.period?.end || "").slice(0,10);
    return { startISO, endISO };
  }

  const _parsedScope = _kpiParseScope(kpiScope);
  const _rrPilot = _kpiResolveRange(_parsedScope, displayDateISO);
  const _scopeValForSelect = (_parsedScope.kind === "seg")
    ? `seg:${_parsedScope.segId}`
    : (_parsedScope.kind === "range")
      ? "range"
      : _parsedScope.kind;

  // Build scope options HTML once per render
  const _segs = Array.isArray(state?.budgetSegments) ? state.budgetSegments.slice() : [];
  _segs.sort((a,b) => String(a.start||a.start_date||"").localeCompare(String(b.start||b.start_date||"")));
  const _lang = (window.tbGetLang && tbGetLang()) || "fr";
  const _labSeg = (_lang === "en") ? "Current segment" : "Segment courant";
  const _labPeriod = (_lang === "en") ? "Whole period" : "Toute la période";
  const _labRange = (_lang === "en") ? "Date range…" : "Date à date…";
  const _labPer = (_lang === "en") ? "Period" : "Periode";

  function _pendingTxOverlaps(tx, rangeStartISO, rangeEndISO) {
    const ds = String(tx?.dateStart || tx?.date_start || tx?.date || "").slice(0, 10);
    const de = String(tx?.dateEnd || tx?.date_end || ds || "").slice(0, 10);
    return _kpiDatesOverlap(ds, de, rangeStartISO, rangeEndISO);
  }

  function _pendingAmountText(value, cur) {
    const n = Number(value) || 0;
    const sign = n >= 0 ? "+" : "-";
    let amount = String(Math.round(Math.abs(n)));
    try {
      amount = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.abs(n));
    } catch (_) {}
    return `${sign} ${amount} ${cur}`;
  }

  function _pendingProjectionItems(rangeStartISO, rangeEndISO) {
    const items = [];
    for (const tx of (state.transactions || [])) {
      if (!_kpiIsCashPendingProjectionTx(tx)) continue;
      if (!_pendingTxOverlaps(tx, rangeStartISO, rangeEndISO)) continue;
      const type = String(tx.type || "").toLowerCase();
      const label = String(tx.label || tx.subcategory || tx.category || (type === "income" ? "Entrée prévue" : "Dépense prévue"));
      const dateISO = String(tx.dateStart || tx.date_start || rangeStartISO || displayDateISO).slice(0, 10);
      const amount = _toPivot(Number(tx.amount) || 0, tx.currency || "EUR", dateISO);
      items.push({
        kind: type === "income" ? "receive" : "pay",
        source: type === "income" ? (_lang === "en" ? "Receivable" : "À recevoir") : (_lang === "en" ? "Payable" : "À payer"),
        label,
        value: type === "income" ? amount : -amount,
      });
    }

    const tripRows = Array.isArray(state?.tripNetBalances) && state.tripNetBalances.length
      ? state.tripNetBalances
      : (Array.isArray(window.__tripState?.globalNetRows) ? window.__tripState.globalNetRows : []);
    const tripItems = new Map();
    for (const row of tripRows) {
      const net = Number(row?.net || 0);
      if (!Number.isFinite(net) || Math.abs(net) < 0.000001) continue;
      if (!_kpiTripNetRowInRange(row, rangeStartISO, rangeEndISO)) continue;
      const v = _toPivotStrict(net, row?.currency || state?.period?.baseCurrency || "EUR", rangeStartISO || displayDateISO);
      if (v === null || !isFinite(v)) continue;
      const tripName = String(row?.tripName || row?.trip_name || "Trip");
      const key = String(row?.tripId || row?.trip_id || tripName);
      const prev = tripItems.get(key) || { label: tripName, value: 0 };
      prev.value += v;
      tripItems.set(key, prev);
    }
    for (const it of tripItems.values()) {
      if (Math.abs(Number(it.value) || 0) < 1) continue;
      items.push({
        kind: it.value >= 0 ? "receive" : "pay",
        source: it.value >= 0 ? (_lang === "en" ? "Trip receivable" : "À recevoir Trip") : (_lang === "en" ? "Trip payable" : "À payer Trip"),
        label: it.label,
        value: it.value,
      });
    }
    const grouped = new Map();
    for (const it of items) {
      const key = [it.kind, _kpiNormText(it.source), _kpiNormText(it.label)].join("|");
      const prev = grouped.get(key);
      if (prev) {
        prev.value += Number(it.value || 0);
        prev.count += 1;
      } else {
        grouped.set(key, Object.assign({ count: 1 }, it));
      }
    }
    return Array.from(grouped.values())
      .filter((it) => Math.abs(Number(it.value || 0)) >= 1)
      .sort((a, b) => Math.abs(Number(b.value || 0)) - Math.abs(Number(a.value || 0)));
  }

  const _pendingRangeStartISO = String(_rrPilot.startISO || displayDateISO).slice(0, 10);
  const _pendingRangeEndISO = String(_rrPilot.endISO || _kpiHorizonEndISO || displayDateISO).slice(0, 10);
  pendingTransactionsEUR = includeUnpaid ? (Number(netPendingEUR(_pendingRangeStartISO, _pendingRangeEndISO)) || 0) : 0;
  pendingTripsDisplay = includeUnpaid ? _tripNetBalancesPivot(displayDateISO, _pendingRangeStartISO, _pendingRangeEndISO) : 0;
  pendingDisplay = includeUnpaid ? (_toPivot(pendingTransactionsEUR, "EUR", displayDateISO) + pendingTripsDisplay) : 0;
  totalDisplay = walletTotalEUR + (includeUnpaid ? pendingDisplay : 0);
  projEndEUR = projectedEndDisplayWithOptions({ includeUnpaid, scope: kpiScope, rangeStartISO: _pendingRangeStartISO, rangeEndISO: _pendingRangeEndISO });
  projEndDisplay = _toPivot(projEndEUR, "EUR", displayDateISO);
  if (includeUnpaid) {
    const items = _pendingProjectionItems(_pendingRangeStartISO, _pendingRangeEndISO);
    const empty = _lang === "en" ? "No receivable/payable item in this range." : "Aucun élément à recevoir / à payer dans cette plage.";
    const detailLabel = _lang === "en" ? "Details" : "Détail";
    const rangeLabel = `${_pendingRangeStartISO} → ${_pendingRangeEndISO}`;
    pendingDetailHTML = window.TBKpiView?.renderKpiPendingDetail?.({
      items,
      max: 8,
      rangeLabel,
      detailLabel,
      emptyLabel: empty,
      moreLabel: _lang === "en" ? "more" : "autre(s)",
      currency: displayCurPivot,
      amountText: _pendingAmountText,
      esc: escapeHTML,
    }) || "";
  }
  const scopeOptionsHTML = [
    `<option value="segment">${_labSeg}</option>`,
    `<option value="period">${_labPeriod}</option>`,
    ..._segs.map((s, idx) => {
      const id = String(s.id || "");
      const ss = String(s.start || s.start_date || "").slice(0,10);
      const ee = String(s.end || s.end_date || "").slice(0,10);
      const label = `${_labPer} ${idx+1} : ${ss} → ${ee}`;
      return `<option value="seg:${id}">${label}</option>`;
    }),
    `<option value="range">${_labRange}</option>`
  ].join("");

  const runway = cashRunwayInfo();        // dépenses cash réelles
  const cover  = cashConservativeInfo();  // burn prudent (budget/alloc)

 // 🔥 Cash fallback model (bank unavailable scenario)
// Stock = cash only
// Burn = total real expenses (runway)

const cashTotalBase = runway ? runway.totalBase : 0;
const cashBurnBase  = (runway && isFinite(runway.burnPerDay))
  ? runway.burnPerDay
  : 0;

const criticalDays = runway ? runway.daysLeft : Infinity;
const driver = "Dépenses";

  const todayDetailsHTML = _renderTodayDetailsHTML(displayDateISO);
  const todayBudget = getDailyBudgetForDate(displayDateISO);
  const activityToday = _kpiActivitySummaryForDate(displayDateISO);
  const healthToday = _kpiHealthSummaryForDate(displayDateISO, activityToday);
  const healthActions = _kpiHealthActionRows(healthToday);
  const todayPillClass = budgetClass(todayBudget);

  let level = "good";
  if (!isFinite(criticalDays)) level = "good";
  else if (criticalDays <= 2) level = "bad";
  else if (criticalDays <= 7) level = "warn";
  else level = "good";

  const daysText = !isFinite(criticalDays)
    ? "∞"
    : String(Math.max(0, Math.ceil(criticalDays)));

  const excluded = (cover?.excluded?.length ? cover.excluded : (runway?.excluded || []));
  const exclCurrencies = [...new Set(excluded.map(x => x.currency).filter(Boolean))];
  const fxNote = exclCurrencies.length ? `FX exclu : ${exclCurrencies.join(", ")}` : "";
  const pilot = _pilotageInsights({ kind: _parsedScope.kind, startISO: _rrPilot.startISO, endISO: _rrPilot.endISO });

  const renderKpiMiniCard = (opts) => window.TBKpiView?.renderKpiMiniCard?.({ esc: escapeHTML, ...opts }) || "";
  const activeTravel = (state.travels || []).find(x => String(x.id) === String(state?.activeTravelId || "")) || null;
  const activeTravelLabel = activeTravel
    ? String(activeTravel.name || "").trim() || `Voyage ${String(activeTravel.start || "").slice(0,10)} -> ${String(activeTravel.end || "").slice(0,10)}`
    : `Voyage ${String(state?.period?.start || "").slice(0,10)} -> ${String(state?.period?.end || "").slice(0,10)}`;
  const activeTravelValue = String(state?.activeTravelId || state?.period?.id || "");
  const travelOptionHTML = `<option value="${escapeHTML(activeTravelValue)}" selected>${escapeHTML(activeTravelLabel)}</option>`;
  const scopeHelpHTML = (typeof window.tbHelp === "function" && window.tbT) ? tbHelp(tbT("dashboard.help.scope")) : "";

  // Inject responsive CSS once
  if (!document.getElementById("kpiResponsiveStyles")) {
    const st = document.createElement("style");
    st.id = "kpiResponsiveStyles";
    st.textContent = window.TBKpiView?.renderKpiResponsiveStyles?.() || "";
    document.head.appendChild(st);
  }

  // #kpi container is already a .card in index.html; avoid nesting cards.
  kpi.innerHTML = `
      ${window.TBKpiView?.renderKpiHeader?.({
        title: "KPIs",
        travelOptionHtml: travelOptionHTML,
        scopeOptionsHtml: scopeOptionsHTML,
        scopeValue: _scopeValForSelect,
        helpHtml: scopeHelpHTML,
        dateISO: displayDateISO,
        esc: escapeHTML,
      }) || ""}

      <div class="kpi-layout" style="display:grid; gap:16px; margin-top:14px; align-items:start;">

        <!-- LEFT: KPIs -->
        <div>
          <!-- KPI mini-cards -->
          <div class="kpi-mini-grid" style="display:grid; gap:14px;">
            ${renderKpiMiniCard({ title: T("kpi.available_budget"), valueHtml: `${budgetToday.toFixed(0)} <span class="muted kpi-mini-unit">${escapeHTML(base)}</span>`, footerHtml: escapeHTML(T("kpi.today")) })}

            ${renderKpiMiniCard({ title: "Total wallets", valueHtml: `${escapeHTML(fmtKPICompact(walletTotalEUR))} <span class="muted kpi-mini-unit">${escapeHTML(displayCurPivot)}</span>`, footerHtml: `≈ ${escapeHTML(fmtKPICompact(walletTotalBase))} ${escapeHTML(displayCur)}` })}

            ${renderKpiMiniCard({ title: "Sport fait", valueHtml: `${Math.round(activityToday.sportKcal)} <span class="muted kpi-mini-unit">kcal</span>`, footerHtml: `${Math.round(activityToday.sportCount)} séance(s)` })}

            ${renderKpiMiniCard({ title: "Travail fait", valueHtml: `${Math.round(activityToday.workKcal)} <span class="muted kpi-mini-unit">kcal</span>`, footerHtml: `${Math.round(activityToday.workMinutes / 60 * 10) / 10}h · ${Math.round(activityToday.workCount)} journée(s)` })}

            ${window.TBKpiView?.renderKpiHealthCard?.({ healthToday, healthActions, esc: escapeHTML }) || ""}

            ${renderKpiMiniCard({ title: T("kpi.period_end"), valueHtml: `${escapeHTML(fmtKPICompact(projEndDisplay))} <span class="muted kpi-mini-unit">${escapeHTML(displayCurPivot)}</span>`, footerHtml: escapeHTML(T("kpi.projection")), extraHtml: window.TBKpiView?.renderKpiPendingToggle?.({
              includeUnpaid,
              label: T("kpi.include_pending"),
              netLabel: "Net",
              pendingDisplay,
              currency: displayCurPivot,
              pendingDetailHtml: pendingDetailHTML,
              esc: escapeHTML,
            }) || "" })}

	            ${renderKpiMiniCard({ title: T("kpi.fx_period"), valueHtml: escapeHTML(fxRateText), footerHtml: escapeHTML(T("kpi.fx_period_hint")), compact: true })}

	            ${window.TBKpiView?.renderKpiFxCalculator?.({
                title: tbT ? tbT("kpi.fxcalc.title") : "Convertisseur",
                esc: escapeHTML,
              }) || ""}
          </div>

        </div>

        ${window.TBKpiView?.renderKpiTodayPanel?.({
          dateISO: displayDateISO,
          todayLabel: T("kpi.today"),
          steeringLabel: T("kpi.steering"),
          dailyBudget: todayBudget,
          base,
          todayPillClass,
          todayDetailsHtml: todayDetailsHTML,
          pilot,
          recommendedBudgetLabel: T("kpi.recommended_budget"),
          recommendedBudgetRangeLabel: T("kpi.recommended_budget_range"),
          endBalanceLabel: T("kpi.end_balance"),
          rangeEndBalanceLabel: T("kpi.range_end_balance"),
          estimatedBreakLabel: T("kpi.estimated_break"),
          daysRemainingLabel: T("kpi.days_remaining"),
          cashLabel: "Cash",
          daysLabel: T("kpi.days"),
          stockLabel: T("kpi.stock"),
          burnLabel: T("kpi.burn"),
          cashDaysText: daysText,
          cashLevel: level,
          cashDriver: driver,
          cashTotalText: fmtMoney(cashTotalBase, base),
          cashBurnText: fmtMoney(cashBurnBase, base),
          fxNote,
          moneyText: fmtMoney,
          signPillClass: _signPillClass,
          esc: escapeHTML,
        }) || ""}
      </div>
  `;

  // Bind KPI selectors (period + scope) for projection horizon
  try {
    const selP = kpi.querySelector("#kpiPeriodSelect");
    const selS = kpi.querySelector("#kpiScopeSelect");

    // Keep UI aligned with persisted values after each render
    if (selS) {
      try { selS.value = String((_scopeValForSelect || "segment")); } catch (_) {}
    }

// Range UI setup
try {
  const box = kpi.querySelector("#kpiRangeBox");
  const aEl = kpi.querySelector("#kpiRangeStart");
  const bEl = kpi.querySelector("#kpiRangeEnd");
  const applyEl = kpi.querySelector("#kpiRangeApply");
  if (box && aEl && bEl) {
    const si = _kpiParseScope(kpiScope);
    const rr = _kpiResolveRange(si, displayDateISO);
    aEl.value = rr.startISO || "";
    bEl.value = rr.endISO || "";
    box.style.display = (String((_scopeValForSelect||"")) === "range") ? "flex" : "none";

    if (!box.dataset.bound) {
      box.dataset.bound = "1";
      const saveRange = (opts = {}) => {
        const SCOPE_KEY = (TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.kpi_projection_scope) || "travelbudget_kpi_projection_scope_v1";
        const a = String(aEl.value || "");
        const b = String(bEl.value || "");
        if (a && b) {
          const vv = `range:${a}:${b}`;
          try { localStorage.setItem(SCOPE_KEY, vv); } catch (_) {}
          if (opts.apply) {
            try { if (typeof renderKPI === "function") renderKPI(); } catch (_) {}
            try {
              if (typeof window.tbEnsureCashflowCurve === "function") window.tbEnsureCashflowCurve("kpi-range-change");
              else if (typeof window.tbRequestCashflowRender === "function") window.tbRequestCashflowRender("kpi-range-change");
              else if (typeof window.renderCashflowChart === "function") window.renderCashflowChart();
              else if (typeof renderCashflowChart === "function") renderCashflowChart();
            } catch (_) {}
            try { if (typeof window.redrawCharts === "function") window.redrawCharts(); } catch (_) {}
          }
        }
      };
      box.addEventListener("pointerdown", (ev) => { try { ev.stopPropagation(); } catch (_) {} });
      box.addEventListener("mousedown", (ev) => { try { ev.stopPropagation(); } catch (_) {} });
      aEl.addEventListener("change", () => saveRange());
      bEl.addEventListener("change", () => saveRange());
      if (applyEl) applyEl.addEventListener("click", () => saveRange({ apply: true }));
    }
  }
} catch (_) {}

    if (selP) {
      selP.dataset.bound = "1";
    }

    if (selS && !selS.dataset.bound) {
      selS.dataset.bound = "1";
      selS.addEventListener("change", (e) => {
        const v = String(e?.target?.value || "segment");
        try {
          const box = document.getElementById("kpiRangeBox");
          if (box) box.style.display = (v === "range") ? "flex" : "none";
        } catch (_) {}
        const SCOPE_KEY = (TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.kpi_projection_scope) || "travelbudget_kpi_projection_scope_v1";
        // Range mode stores as "range:YYYY-MM-DD:YYYY-MM-DD"
        if (v === "range") {
          try {
            const a = String((document.getElementById("kpiRangeStart")||{}).value || "");
            const b = String((document.getElementById("kpiRangeEnd")||{}).value || "");
            const vv = (a && b) ? `range:${a}:${b}` : "range";
            localStorage.setItem(SCOPE_KEY, vv);
          } catch (_) {}
          return;
        } else {
          try { localStorage.setItem(SCOPE_KEY, v); } catch (_) {}
        }
        try { if (typeof renderKPI === "function") renderKPI(); } catch (_) {}
        // Keep curve aligned with KPI scope (no separate curve filter)
        try {
          if (typeof window.tbEnsureCashflowCurve === "function") window.tbEnsureCashflowCurve("kpi-scope-change");
          else if (typeof window.tbRequestCashflowRender === "function") window.tbRequestCashflowRender("kpi-scope-change");
          else if (typeof window.renderCashflowChart === "function") window.renderCashflowChart();
          else if (typeof renderCashflowChart === "function") renderCashflowChart();
        } catch (_) {}

        // Keep pie chart aligned too, if charts exist.
        try { if (typeof window.redrawCharts === "function") window.redrawCharts(); } catch (_) {}
});
    }

    // FX calculator binding
    try {
      const aEl = kpi.querySelector("#kpiFxCalcAmount");
      const fEl = kpi.querySelector("#kpiFxCalcFrom");
      const tEl = kpi.querySelector("#kpiFxCalcTo");
      const sEl = kpi.querySelector("#kpiFxCalcSwap");
      const oEl = kpi.querySelector("#kpiFxCalcOut");
      if (aEl && fEl && tEl && oEl && !aEl.dataset.bound) {
        aEl.dataset.bound = "1";
        const AKEY = (TB_CONST?.LS_KEYS?.fx_calc_amount) || "travelbudget_fx_calc_amount_v1";
        const FKEY = (TB_CONST?.LS_KEYS?.fx_calc_from) || "travelbudget_fx_calc_from_v1";
        const TKEY = (TB_CONST?.LS_KEYS?.fx_calc_to) || "travelbudget_fx_calc_to_v1";

        const rates = (typeof window.fxGetEurRates === "function") ? (window.fxGetEurRates() || {}) : {};
        const curSet = new Set(["EUR"]);
        try { Object.keys(rates || {}).forEach(k => curSet.add(String(k || "").toUpperCase())); } catch (_) {}
        try { (state.wallets || []).forEach(w => curSet.add(String(w?.currency || "").toUpperCase())); } catch (_) {}
        try { (state.budgetSegments || state.segments || []).forEach(s => curSet.add(String(s?.baseCurrency || s?.base_currency || "").toUpperCase())); } catch (_) {}
        curSet.add(String(state?.period?.baseCurrency || state?.period?.base_currency || "").toUpperCase());
        const curs = Array.from(curSet).filter(Boolean).sort();

        const optHTML = curs.map(c => `<option value="${c}">${c}</option>`).join("");
        fEl.innerHTML = optHTML;
        tEl.innerHTML = optHTML;

        // Defaults: from = account currency, to = current period/segment currency
        const accountBase = String(
  state?.settings?.baseCurrency ||
  state?.settings?.base_currency ||
  state?.profile?.baseCurrency ||
  state?.profile?.base_currency ||
  state?.account?.baseCurrency ||
  state?.account?.base_currency ||
  base ||
  "EUR"
).toUpperCase();
        const periodBase = String(
          (window.__TB_ACTIVE_SEG && (__TB_ACTIVE_SEG.baseCurrency || __TB_ACTIVE_SEG.base_currency)) ||
          base ||
          state?.period?.baseCurrency ||
          state?.period?.base_currency ||
          "EUR"
        ).toUpperCase();

        const savedA = (localStorage.getItem(AKEY) || "").trim();
        const savedF = (localStorage.getItem(FKEY) || "").trim().toUpperCase();
        const savedT = (localStorage.getItem(TKEY) || "").trim().toUpperCase();

        aEl.value = savedA || "";
        const fallbackCurrency = curs.includes(accountBase)
  ? accountBase
  : (curs.includes(periodBase) ? periodBase : curs[0]);

fEl.value = curs.includes(savedF) ? savedF : fallbackCurrency;
tEl.value = curs.includes(savedT)
  ? savedT
  : (curs.includes(periodBase) ? periodBase : fallbackCurrency);

        const fmtOut = (x, cur) => {
          const n = Number(x);
          if (!isFinite(n)) return "—";
          const s = (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
          return `${s} ${cur}`;
        };

        const compute = () => {
          const amt = Number(aEl.value);
          const from = String(fEl.value || "EUR");
          const to = String(tEl.value || "EUR");
          if (!isFinite(amt)) { oEl.textContent = "—"; return; }
          let out = null;
          try {
            if (typeof window.fxConvert === "function") out = window.fxConvert(amt, from, to, rates);
          } catch (_) {}
          // Fallbacks using existing pivots
          if (out === null || !isFinite(out)) {
            try {
              if (to === "EUR") out = amountToEUR(amt, from);
              else if (from === "EUR") out = eurToAmount(amt, to);
            } catch (_) {}
          }
          oEl.textContent = fmtOut(out, to);

          try { localStorage.setItem(AKEY, String(aEl.value || "")); } catch (_) {}
          try { localStorage.setItem(FKEY, from); } catch (_) {}
          try { localStorage.setItem(TKEY, to); } catch (_) {}
        };

        [aEl, fEl, tEl].forEach(el => el.addEventListener("input", compute));
        [aEl, fEl, tEl].forEach(el => el.addEventListener("change", compute));

        if (sEl && !sEl.dataset.bound) {
         sEl.dataset.bound = "1";
         sEl.addEventListener("click", () => {
           const from = fEl.value;
           fEl.value = tEl.value;
           tEl.value = from;
           compute();
         });
        }

compute();
      }
    } catch (_) {}
  } catch (e) {
    console.warn(e);
  }

  // Toggle: include unpaid (forecast) in KPI projection
  const _tog = document.getElementById("kpiIncludeUnpaidToggle");
  if (_tog) {
    _tog.onchange = () => {
      localStorage.setItem((TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.kpi_projection_include_unpaid) || "travelbudget_kpi_projection_include_unpaid_v1", _tog.checked ? "1" : "0");
      if (window.tbRequestRenderAll) tbRequestRenderAll("kpi:toggle"); else renderKPI();
    };
  }

  })();
  try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("kpi:render"); } catch (_) {}
  return __out;
}

