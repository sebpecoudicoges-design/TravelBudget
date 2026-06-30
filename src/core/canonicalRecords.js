function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function cleanDate(value) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function canonicalTransaction(record = {}) {
  return {
    id: String(record.id || ''),
    userId: String(firstDefined(record.userId, record.user_id, '')),
    travelId: String(firstDefined(record.travelId, record.travel_id, '')) || null,
    walletId: String(firstDefined(record.walletId, record.wallet_id, '')),
    type: String(record.type || '').toLowerCase(),
    label: String(record.label || record.category || ''),
    category: String(record.category || 'Autre'),
    amount: Number(record.amount) || 0,
    currency: String(record.currency || 'EUR').toUpperCase(),
    cashDate: cleanDate(firstDefined(record.cashDate, record.dateStart, record.date_start, record.date)),
    budgetDateStart: cleanDate(firstDefined(record.budgetDateStart, record.budget_date_start, record.dateStart, record.date_start)),
    budgetDateEnd: cleanDate(firstDefined(record.budgetDateEnd, record.budget_date_end, record.dateEnd, record.date_end, record.budgetDateStart, record.budget_date_start)),
    payNow: !!firstDefined(record.payNow, record.pay_now, true),
    affectsBudget: !!firstDefined(record.affectsBudget, record.affects_budget, true),
    outOfBudget: !!firstDefined(record.outOfBudget, record.out_of_budget, false),
    offlineDedupeKey: String(firstDefined(record.offlineDedupeKey, record.offline_dedupe_key, '')) || null,
  };
}

export function canonicalNutritionEntry(record = {}) {
  const meal = record.meal || record;
  const item = record.item || null;
  return {
    id: String(record.syncId || meal.sync_id || meal.id || ''),
    userId: String(firstDefined(meal.userId, meal.user_id, '')),
    travelId: String(firstDefined(meal.travelId, meal.travel_id, '')) || null,
    date: cleanDate(firstDefined(meal.date, meal.mealDate, meal.meal_date)),
    mealType: String(firstDefined(meal.mealType, meal.meal_type, 'meal')),
    label: String(item?.label || meal.label || ''),
    foodKey: String(firstDefined(item?.foodKey, item?.food_key, '')) || null,
    grams: Number(item?.grams) || 0,
    waterMl: Number(firstDefined(meal.waterMl, meal.water_ml, 0)) || 0,
    kcal: Number(item?.kcal) || 0,
    proteinG: Number(firstDefined(item?.proteinG, item?.protein_g, 0)) || 0,
    carbsG: Number(firstDefined(item?.carbsG, item?.carbs_g, 0)) || 0,
    fatG: Number(firstDefined(item?.fatG, item?.fat_g, 0)) || 0,
  };
}

export function canonicalSportSession(record = {}) {
  const items = Array.isArray(record.items) ? record.items : [];
  return {
    id: String(record.id || ''),
    userId: String(firstDefined(record.userId, record.user_id, '')),
    travelId: String(firstDefined(record.travelId, record.travel_id, '')) || null,
    date: cleanDate(firstDefined(record.date, record.sessionDate, record.session_date, record.startedAt, record.started_at)),
    name: String(record.name || record.title || 'Seance'),
    durationSeconds: Math.max(0, Number(firstDefined(record.durationSeconds, record.duration_seconds, 0)) || 0),
    kcal: Math.max(0, Number(firstDefined(record.kcal, record.kcalEstimate, record.kcal_estimate, 0)) || 0),
    items: items.map((item) => ({
      exerciseId: String(firstDefined(item.exerciseId, item.exercise_id, '')) || null,
      name: String(item.name || item.label || ''),
      sets: Array.isArray(item.sets) ? item.sets : [],
    })),
  };
}

