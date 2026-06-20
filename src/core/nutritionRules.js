function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value, fallback = '') {
  const out = String(value ?? '').trim();
  return out || fallback;
}

export function normalizeFoodRow(row = {}) {
  const key = str(row.key || row.food_key);
  if (!key) return null;
  const servingGrams = Math.max(1, num(row.servingGrams || row.serving_grams, 100));
  return {
    key,
    name: str(row.name || row.name_fr || row.label, key),
    brand: str(row.brand),
    servingGrams,
    kcalPer100g: Math.max(0, num(row.kcalPer100g || row.kcal_per_100g, 0)),
    proteinPer100g: Math.max(0, num(row.proteinPer100g || row.protein_per_100g, 0)),
    carbsPer100g: Math.max(0, num(row.carbsPer100g || row.carbs_per_100g, 0)),
    fatPer100g: Math.max(0, num(row.fatPer100g || row.fat_per_100g, 0)),
    fiberPer100g: Math.max(0, num(row.fiberPer100g || row.fiber_per_100g, 0)),
    waterMlPer100g: Math.max(0, num(row.waterMlPer100g || row.water_ml_per_100g, 0)),
    tags: Array.isArray(row.tags) ? row.tags.map((tag) => str(tag)).filter(Boolean) : [],
    source: str(row.source, 'library'),
  };
}

export function nutritionForGrams(food = {}, grams = 0) {
  const f = normalizeFoodRow(food);
  if (!f) return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, waterMl: 0 };
  const ratio = Math.max(0, num(grams, f.servingGrams)) / 100;
  return {
    kcal: f.kcalPer100g * ratio,
    protein: f.proteinPer100g * ratio,
    carbs: f.carbsPer100g * ratio,
    fat: f.fatPer100g * ratio,
    fiber: f.fiberPer100g * ratio,
    waterMl: f.waterMlPer100g * ratio,
  };
}

export function sumNutrition(items = []) {
  return (Array.isArray(items) ? items : []).reduce((total, item) => {
    const values = item?.nutrition || nutritionForGrams(item?.food || item, item?.grams);
    return {
      kcal: total.kcal + num(values.kcal, 0),
      protein: total.protein + num(values.protein, 0),
      carbs: total.carbs + num(values.carbs, 0),
      fat: total.fat + num(values.fat, 0),
      fiber: total.fiber + num(values.fiber, 0),
      waterMl: total.waterMl + num(values.waterMl, 0),
    };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, waterMl: 0 });
}

export function energyBalance({ consumedKcal = 0, sportKcal = 0, workKcal = 0, bmr = 0 } = {}) {
  const spent = Math.max(0, num(bmr, 0)) + Math.max(0, num(sportKcal, 0)) + Math.max(0, num(workKcal, 0));
  const consumed = Math.max(0, num(consumedKcal, 0));
  return { consumedKcal: consumed, spentKcal: spent, balanceKcal: consumed - spent };
}

function norm(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function isAlcoholFood(food = {}) {
  const f = normalizeFoodRow(food);
  if (!f) return false;
  const text = norm(`${f.key} ${f.name} ${(f.tags || []).join(' ')}`);
  if (/sans alcool|alcohol[-_ ]?free|0\s?%/.test(text)) return false;
  return (f.tags || []).some((tag) => ['alcool', 'alcohol'].includes(norm(tag)))
    || /\b(biere|beer|ipa|pinte|vin|wine|cidre|cider|whisky|vodka|rhum|gin|cocktail)\b/.test(text);
}

export function alcoholAbv(food = {}) {
  const f = normalizeFoodRow(food);
  const text = norm(`${f?.key || ''} ${f?.name || ''} ${(f?.tags || []).join(' ')}`);
  if (/vin|wine/.test(text)) return 0.125;
  if (/whisky|vodka|rhum|rum|gin|spiritueux/.test(text)) return 0.40;
  if (/ipa/.test(text)) return 0.06;
  if (/cidre|cider/.test(text)) return 0.05;
  if (/biere|beer|pinte/.test(text)) return 0.05;
  return isAlcoholFood(f) ? 0.05 : 0;
}

export function alcoholForGrams(food = {}, grams = 0) {
  if (!isAlcoholFood(food)) return { gramsAlcohol: 0, standardDrinks: 0 };
  const ml = Math.max(0, num(grams, normalizeFoodRow(food)?.servingGrams || 0));
  const gramsAlcohol = ml * alcoholAbv(food) * 0.789;
  return { gramsAlcohol, standardDrinks: gramsAlcohol / 10 };
}
