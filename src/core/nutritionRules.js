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

export function nutritionGoalTargets({ spentKcal = 0, weightKg = 70, mode = 'maintenance', surplusKcal = 0, deficitKcal = 0 } = {}) {
  const modeRaw = str(mode, 'maintenance');
  const cleanMode = ['bulk', 'maintenance', 'cut'].includes(modeRaw) ? modeRaw : 'maintenance';
  const kg = Math.max(30, num(weightKg, 70));
  const cleanSurplus = cleanMode === 'bulk'
    ? Math.max(300, Math.min(500, Math.round(num(surplusKcal, 350))))
    : 0;
  const cleanDeficit = cleanMode === 'cut'
    ? Math.max(250, Math.min(500, Math.round(num(deficitKcal, 300))))
    : 0;
  const offsetKcal = cleanSurplus - cleanDeficit;
  const targetKcal = Math.max(1200, Math.round(num(spentKcal, 0) + offsetKcal));
  const proteinPerKg = cleanMode === 'bulk' ? 1.8 : cleanMode === 'cut' ? 1.9 : 1.6;
  const fatPerKg = cleanMode === 'bulk' ? 0.9 : cleanMode === 'cut' ? 0.75 : 0.8;
  const protein = Math.max(70, Math.round(kg * proteinPerKg));
  const fat = Math.max(42, Math.round(kg * fatPerKg));
  const carbs = Math.max(90, Math.round((targetKcal - protein * 4 - fat * 9) / 4));
  return {
    mode: cleanMode,
    surplusKcal: cleanSurplus,
    deficitKcal: cleanDeficit,
    offsetKcal,
    targetKcal,
    protein,
    proteinPerKg,
    fat,
    fatPerKg,
    carbs,
  };
}

function norm(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export const NUTRITION_MEAL_TYPE_ORDER = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'snack', 'meal'];

export function normalizeNutritionText(value) {
  return norm(value);
}

export function mealTypeFromHour(hour = new Date().getHours()) {
  const h = num(hour, 12);
  if (h < 10) return 'breakfast';
  if (h < 12) return 'morning_snack';
  if (h < 15) return 'lunch';
  if (h < 18) return 'afternoon_snack';
  return 'dinner';
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

export function foodCategory(food = {}) {
  const f = normalizeFoodRow(food) || food || {};
  const tags = Array.isArray(f.tags) ? f.tags.map(norm) : [];
  if (tags.includes('plat')) return 'dishes';
  if (tags.includes('fruit')) return 'fruits';
  if (tags.some((tag) => ['laitage', 'fromage'].includes(tag))) return 'dairy';
  if (tags.some((tag) => ['base', 'riz', 'pates', 'semoule', 'glucides', 'pain'].includes(tag))) return 'carbs';
  if (tags.some((tag) => ['proteines', 'boeuf', 'poulet', 'poisson', 'oeuf', 'vegetarien'].includes(tag))) return 'protein';
  if (tags.some((tag) => ['snack', 'gateau', 'chocolat'].includes(tag))) return 'snacks';
  if (tags.includes('boisson')) return 'drinks';
  const text = norm(`${f.key || ''} ${f.name || ''}`);
  if (/banane|pomme|poire|orange|kiwi|fraise|raisin|peche|mangue|melon|pasteque|fruit|compote|datte|myrtille|framboise/.test(text)) return 'fruits';
  if (/yaourt|fromage|skyr|lait|mozzarella|emmental|cheddar|feta|chevre|cottage|laitage/.test(text)) return 'dairy';
  if (/riz|pate|pain|baguette|quinoa|semoule|couscous|boulgour|pomme de terre|tortilla|bagel|porridge|avoine|muesli|granola|cereale/.test(text)) return 'carbs';
  if (/poulet|dinde|boeuf|steak|thon|saumon|cabillaud|crevette|oeuf|tofu|tempeh|lentille|pois chiche|whey|proteine/.test(text)) return 'protein';
  if (/biscuit|gateau|belvita|barre|chocolat|cookie|chips|cracker|donut|muffin|gaufre|snack|galette/.test(text)) return 'snacks';
  if (/eau|cafe|the|biere|cidre|jus|cola|boisson|latte|cappuccino|smoothie/.test(text)) return 'drinks';
  if (/burger|sandwich|wrap|bowl|pizza|salade|soupe|curry|chili|lasagne|kebab|tacos|burrito|omelette|plat|croque|panini|gratin|hachis|tartiflette|raclette|paella|risotto|dahl|falafel|shakshuka|saumon pommes|poulet pommes|bourguignon|blanquette|couscous|moussaka|ravioli|gnocchi|ramen|pad thai|bo bun|fajitas|quesadilla|hot dog|sushi/.test(text)) return 'dishes';
  return 'all';
}

export function filterCatalogFoods({ foods = [], query = '', category = 'all', limit = 18 } = {}) {
  const q = norm(query);
  const cat = str(category, 'all');
  return (Array.isArray(foods) ? foods : [])
    .map(normalizeFoodRow)
    .filter(Boolean)
    .filter((food) => {
      const matchesText = !q || norm(food.name).includes(q) || norm(food.key).includes(q);
      const matchesCat = cat === 'all' || foodCategory(food) === cat;
      return matchesText && matchesCat;
    })
    .slice(0, Math.max(1, num(limit, 18)));
}

export function buildTypeTotalsForDay(meals = [], items = []) {
  const mealTypes = new Map();
  (Array.isArray(meals) ? meals : []).forEach((meal) => {
    mealTypes.set(String(meal?.id || ''), str(meal?.meal_type || meal?.mealType, 'meal'));
  });
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const type = mealTypes.get(String(item?.meal_id || item?.mealId || '')) || 'meal';
    if (!acc[type]) acc[type] = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    acc[type].kcal += num(item?.kcal, 0);
    acc[type].protein += num(item?.protein_g ?? item?.protein, 0);
    acc[type].carbs += num(item?.carbs_g ?? item?.carbs, 0);
    acc[type].fat += num(item?.fat_g ?? item?.fat, 0);
    return acc;
  }, {});
}

function defaultDay(value) {
  const raw = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return '';
}

export function buildDailyNutritionSummaries({ meals = [], items = [], foods = [], toDay = defaultDay } = {}) {
  const foodByKey = new Map((Array.isArray(foods) ? foods : []).map((food) => {
    const normalized = normalizeFoodRow(food);
    return normalized ? [normalized.key, normalized] : null;
  }).filter(Boolean));
  const byDay = new Map();
  const ensureType = (row, type) => {
    const key = NUTRITION_MEAL_TYPE_ORDER.includes(type) ? type : 'meal';
    if (!row.types[key]) row.types[key] = { type: key, meals: [], items: [], kcal: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0 };
    return row.types[key];
  };
  (Array.isArray(meals) ? meals : []).forEach((meal) => {
    const day = toDay(meal?.meal_date || meal?.mealDate);
    if (!day) return;
    if (!byDay.has(day)) byDay.set(day, { day, meals: [], waterMl: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, alcoholDrinks: 0, alcoholGrams: 0, alcoholEntries: [], types: {} });
    const row = byDay.get(day);
    const typeRow = ensureType(row, str(meal?.meal_type || meal?.mealType, 'meal'));
    row.meals.push(meal);
    row.waterMl += num(meal?.water_ml ?? meal?.waterMl, 0);
    typeRow.meals.push(meal);
    typeRow.waterMl += num(meal?.water_ml ?? meal?.waterMl, 0);
  });
  const mealToDay = new Map();
  const mealToType = new Map();
  (Array.isArray(meals) ? meals : []).forEach((meal) => {
    mealToDay.set(String(meal?.id || ''), toDay(meal?.meal_date || meal?.mealDate));
    mealToType.set(String(meal?.id || ''), str(meal?.meal_type || meal?.mealType, 'meal'));
  });
  (Array.isArray(items) ? items : []).forEach((item) => {
    const mealId = String(item?.meal_id || item?.mealId || '');
    const day = mealToDay.get(mealId);
    const row = day ? byDay.get(day) : null;
    if (!row) return;
    const typeRow = ensureType(row, mealToType.get(mealId) || 'meal');
    const kcal = num(item?.kcal, 0);
    const protein = num(item?.protein_g ?? item?.protein, 0);
    const carbs = num(item?.carbs_g ?? item?.carbs, 0);
    const fat = num(item?.fat_g ?? item?.fat, 0);
    typeRow.items.push(item);
    typeRow.kcal += kcal;
    typeRow.protein += protein;
    typeRow.carbs += carbs;
    typeRow.fat += fat;
    row.kcal += kcal;
    row.protein += protein;
    row.carbs += carbs;
    row.fat += fat;
    const food = foodByKey.get(String(item?.food_key || item?.foodKey || '')) || { key: item?.food_key || item?.foodKey, name: item?.label || '', tags: [] };
    const alcohol = alcoholForGrams(food, num(item?.grams, 0));
    if (alcohol.standardDrinks > 0) {
      const entry = {
        label: item?.label || food.name || food.key,
        grams: num(item?.grams, 0),
        gramsAlcohol: alcohol.gramsAlcohol,
        standardDrinks: alcohol.standardDrinks,
      };
      row.alcoholDrinks += alcohol.standardDrinks;
      row.alcoholGrams += alcohol.gramsAlcohol;
      row.alcoholEntries.push(entry);
      typeRow.alcoholDrinks = num(typeRow.alcoholDrinks, 0) + alcohol.standardDrinks;
    }
  });
  return Array.from(byDay.values()).map((row) => ({
    ...row,
    typeRows: NUTRITION_MEAL_TYPE_ORDER.map((type) => row.types[type]).filter(Boolean),
  })).sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, 21);
}

export function mealMomentTargets({ needsKcal = 0, typeTotals = {}, currentType = 'dinner' } = {}) {
  const rows = [
    { type: 'breakfast', pct: 0.22, minPct: 0.14, maxPct: 0.30, color: '#38bdf8' },
    { type: 'morning_snack', pct: 0.08, minPct: 0.04, maxPct: 0.14, color: '#a78bfa' },
    { type: 'lunch', pct: 0.35, minPct: 0.24, maxPct: 0.44, color: '#22c55e' },
    { type: 'afternoon_snack', pct: 0.10, minPct: 0.05, maxPct: 0.16, color: '#f59e0b' },
    { type: 'dinner', pct: 0.25, minPct: 0.16, maxPct: 0.34, color: '#fb7185' },
  ];
  const totalNeed = Math.max(0, num(needsKcal, 0));
  const baseRows = rows.map((row) => {
    const baseKcal = Math.round(totalNeed * row.pct);
    return { ...row, baseKcal, kcal: baseKcal };
  });
  const currentIndex = Math.max(0, baseRows.findIndex((row) => row.type === currentType));
  const passedRows = baseRows.slice(0, currentIndex);
  const futureRows = baseRows.slice(currentIndex);
  const passedBase = passedRows.reduce((sum, row) => sum + num(row.baseKcal, 0), 0);
  const passedConsumed = passedRows.reduce((sum, row) => sum + num(typeTotals?.[row.type]?.kcal, 0), 0);
  const adjustment = passedBase - passedConsumed;
  const futureBase = futureRows.reduce((sum, row) => sum + num(row.baseKcal, 0), 0);
  if (!futureBase || Math.abs(adjustment) < 40) return baseRows;
  return baseRows.map((row, idx) => {
    if (idx < currentIndex) return row;
    const share = num(row.baseKcal, 0) / futureBase;
    const adapted = num(row.baseKcal, 0) + adjustment * share;
    const min = totalNeed * num(row.minPct, row.pct * 0.65);
    const max = totalNeed * num(row.maxPct, row.pct * 1.35);
    return { ...row, kcal: Math.round(Math.max(min, Math.min(max, adapted))), adjustedKcal: Math.round(adapted) };
  });
}
