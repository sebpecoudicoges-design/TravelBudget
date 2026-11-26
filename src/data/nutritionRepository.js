function requireClient(getClient) {
  const client = typeof getClient === 'function' ? getClient() : getClient;
  if (!client || typeof client.from !== 'function') throw new Error('Supabase indisponible');
  return client;
}

export function unwrap(result) {
  if (result?.error) throw result.error;
  if (result && Object.prototype.hasOwnProperty.call(result, 'data')) return result.data;
  return [];
}

export function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readJson(storage, key, fallback) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(key) || '');
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (_) {
    return fallback;
  }
}

export function writeJson(storage, key, value) {
  try {
    const raw = JSON.stringify(value);
    if (typeof window !== 'undefined' && typeof window.tbSafeLocalStorageSet === 'function' && storage === window.localStorage) {
      return window.tbSafeLocalStorageSet(key, raw)?.ok === true;
    } else {
      if (typeof storage?.setItem !== 'function') return false;
      storage.setItem(key, raw);
    }
    return true;
  } catch (_) {
    return false;
  }
}

export function loadCachedFoods({ storage, key }) {
  const rows = readJson(storage, key, []);
  return Array.isArray(rows) ? rows : [];
}

export function requireLocalWrite(ok, pendingRows) {
  if (ok) return;
  const error = new Error('Nutrition could not be saved on this device.');
  error.code = 'NUTRITION_STORAGE_FAILED';
  if (pendingRows) error.pendingRows = pendingRows;
  throw error;
}

export function saveCachedFoods({ storage, key, rows, limit = 500 }) {
  return writeJson(storage, key, (rows || []).slice(0, limit));
}

function readStoredCollection(storage, key, empty) {
    const raw = storage.getItem(key);
    const rows = raw === null ? empty : JSON.parse(raw);
    if (!rows || typeof rows !== 'object' || Array.isArray(rows) !== Array.isArray(empty)
      || Object.values(rows).some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error('Nutrition pending data is unreadable; saved data retained.');
    }
    return rows;
}

export function loadLocalNutritionRows({ storage, key, strict = false }) {
  if (strict) return readStoredCollection(storage, key, []);
  const rows = readJson(storage, key, []);
  return Array.isArray(rows) ? rows : [];
}

export function saveLocalNutritionRows({ storage, key, rows }) {
  // These are pending writes, not disposable food-cache entries.
  try { loadLocalNutritionRows({ storage, key, strict: true }); } catch (_) { return false; }
  return writeJson(storage, key, rows || []);
}

export function localNutritionRowKey(row, index = 0) {
  const raw = String(row?.syncId || row?.meal?.sync_id || row?.meal?.id || row?.item?.id || '').trim();
  return raw || `idx_${Math.max(0, safeNumber(index, 0))}`;
}

export function discardLocalNutritionRow({ storage, key, rowKey }) {
  const wanted = String(rowKey || '');
  const rows = loadLocalNutritionRows({ storage, key, strict: true });
  const next = rows.filter((row, index) => localNutritionRowKey(row, index) !== wanted);
  requireLocalWrite(saveLocalNutritionRows({ storage, key, rows: next }));
  return { removed: rows.length - next.length, remaining: next };
}

export function discardAllLocalNutritionRows({ storage, key }) {
  const rows = loadLocalNutritionRows({ storage, key, strict: true });
  requireLocalWrite(saveLocalNutritionRows({ storage, key, rows: [] }));
  return rows.length;
}

export function isOfflineSkipError(err) {
  return /offline mode|supabase request skipped|failed to fetch|network/i.test(String(err?.message || err || ''));
}

export function isDuplicateNutritionError(err) {
  return String(err?.code || '') === '23505'
    || /duplicate key|unique constraint|nutrition_meal_items_exact_dedupe/i.test(String(err?.message || err || ''));
}

export function nutritionSyncMarker(syncId) {
  const id = String(syncId || '').trim();
  return id ? `tb_sync:${id}` : '';
}

export function nutritionSyncId(row) {
  return String(row?.syncId || row?.meal?.sync_id || row?.meal?.id || '').trim();
}

export function notesWithNutritionSyncId(notes, syncId) {
  const marker = nutritionSyncMarker(syncId);
  const base = String(notes || '').trim();
  if (!marker) return base || null;
  if (base.includes(marker)) return base;
  return [base, marker].filter(Boolean).join(' ');
}

export function makeLocalNutritionRow({
  food,
  grams,
  nut,
  waterMl,
  consumedTime,
  mealType,
  mealDate,
  label,
  syncId,
  userId,
  travelId,
  now = () => new Date(),
  random = () => Math.random(),
}) {
  const stamp = String(syncId || '').replace(/^nutrition_/, '') || `${Date.now()}_${String(random()).slice(2)}`;
  const mealId = `local_meal_${stamp}`;
  const itemId = `local_item_${stamp}`;
  const rowSyncId = syncId || `nutrition_${stamp}`;
  const createdAt = now().toISOString();
  return {
    syncId: rowSyncId,
    meal: {
      id: mealId,
      sync_id: rowSyncId,
      user_id: userId || null,
      travel_id: travelId || null,
      meal_date: mealDate,
      meal_type: mealType || 'meal',
      label: label || food?.name || 'Repas',
      water_ml: safeNumber(waterMl, 0),
      consumed_time: consumedTime || null,
      notes: notesWithNutritionSyncId('', rowSyncId),
      created_at: createdAt,
    },
    item: safeNumber(grams, 0) > 0 ? {
      id: itemId,
      user_id: userId || null,
      meal_id: mealId,
      food_key: food?.key || null,
      label: label || food?.name || 'Aliment',
      grams: safeNumber(grams, 0),
      kcal: safeNumber(nut?.kcal, 0),
      protein_g: safeNumber(nut?.protein, 0),
      carbs_g: safeNumber(nut?.carbs, 0),
      fat_g: safeNumber(nut?.fat, 0),
      fiber_g: safeNumber(nut?.fiber, 0),
      created_at: createdAt,
    } : null,
  };
}

export function saveLocalNutritionRowOnce({ storage, key, row }) {
  return saveLocalNutritionRowsOnce({ storage, key, rows: row ? [row] : [] });
}

export function saveLocalNutritionRowsOnce({ storage, key, rows }) {
  const incoming = (Array.isArray(rows) ? rows : []).filter(Boolean);
  let stored;
  try { stored = loadLocalNutritionRows({ storage, key, strict: true }); }
  catch (_) { requireLocalWrite(false, incoming); }
  if (!incoming.length) return stored;
  const incomingKeys = new Set(incoming.map((row, index) => localNutritionRowKey(row, index)));
  const current = stored
    .filter((existing, index) => !incomingKeys.has(localNutritionRowKey(existing, index)));
  const next = [...incoming, ...current];
  requireLocalWrite(saveLocalNutritionRows({ storage, key, rows: next }), next);
  return next;
}

export function loadSleepRows({ storage, key, strict = false }) {
  if (strict) return readStoredCollection(storage, key, {});
  const rows = readJson(storage, key, {});
  return rows && typeof rows === 'object' && !Array.isArray(rows) ? rows : {};
}

export function visibleSleepRows(rows) {
  return Object.fromEntries(Object.entries(rows || {}).filter(([, row]) => row && !row.deleted));
}

export function createNutritionRepository(getClient) {
  return {
    loadCachedFoods,
    saveCachedFoods,
    loadLocalNutritionRows,
    saveLocalNutritionRows,
    localNutritionRowKey,
    discardLocalNutritionRow,
    discardAllLocalNutritionRows,
    isOfflineSkipError,
    isDuplicateNutritionError,
    nutritionSyncMarker,
    nutritionSyncId,
    notesWithNutritionSyncId,
    makeLocalNutritionRow,
    saveLocalNutritionRowOnce,
    saveLocalNutritionRowsOnce,
    loadSleepRows,
    visibleSleepRows,
    sleepWrites: () => import("./nutritionSleepRepository.js"),

    async syncLocalRow(args) {
      const { syncNutritionLocalMeal } = await import('./nutritionMealReplayRepository.js');
      return syncNutritionLocalMeal({ ...args, client: requireClient(getClient) });
    },

    async loadCookingWorkspace({ tables, userId, limit = 8 }) {
      const client = requireClient(getClient);
      const batchesResult = await client.from(tables.batches)
          .select('id,recipe_id,user_id,cooked_at,name,final_weight_g,final_weight_source,servings,precision_level,total_kcal,total_protein_g,total_carbs_g,total_fat_g,total_fiber_g,per_100g_snapshot,per_serving_snapshot,created_at')
          .eq('user_id', userId)
          .order('cooked_at', { ascending: false })
          .limit(Math.max(1, limit));
      return {
        batches: cleanArray(unwrap(batchesResult), limit),
      };
    },

    async saveCookingBatch({ tables, userId, recipe, batch }) {
      const client = requireClient(getClient);
      const recipeRow = unwrap(await client.from(tables.recipes).insert({
        user_id: userId,
        name: recipe.name,
        description: recipe.description || null,
        default_servings: Math.max(1, Math.round(safeNumber(batch.servings, 1))),
      }).select('id').single());
      const recipeId = recipeRow?.id;
      const ingredients = (batch.ingredients || []).map((row, index) => ({
        recipe_id: recipeId,
        user_id: userId,
        food_key: row.foodKey || null,
        label: row.label || 'Ingredient',
        quantity: safeNumber(row.initialWeightG, 0),
        unit: 'g',
        quantity_grams: safeNumber(row.initialWeightG, 0),
        initial_state: row.initialState || 'raw',
        cooking_method_code: row.cookingMethod || 'raw',
        sort_order: index,
      }));
      if (ingredients.length) unwrap(await client.from(tables.ingredients).insert(ingredients));
      const batchRow = unwrap(await client.from(tables.batches).insert({
        recipe_id: recipeId,
        user_id: userId,
        name: batch.name,
        estimated_final_weight_g: safeNumber(batch.estimatedFinalWeightG, 0),
        measured_final_weight_g: safeNumber(batch.measuredFinalWeightG, 0) || null,
        final_weight_g: safeNumber(batch.finalWeightG, 0),
        final_weight_source: batch.finalWeightSource || 'estimated',
        servings: Math.max(1, Math.round(safeNumber(batch.servings, 1))),
        precision_level: batch.precisionLevel || 'estimated',
        total_kcal: safeNumber(batch.total?.kcal, 0),
        total_protein_g: safeNumber(batch.total?.protein, 0),
        total_carbs_g: safeNumber(batch.total?.carbs, 0),
        total_fat_g: safeNumber(batch.total?.fat, 0),
        total_fiber_g: safeNumber(batch.total?.fiber, 0),
        per_100g_snapshot: batch.per100g || {},
        per_serving_snapshot: batch.perServing || {},
      }).select('id,recipe_id,cooked_at,name,final_weight_g,final_weight_source,servings,precision_level,total_kcal,total_protein_g,total_carbs_g,total_fat_g,total_fiber_g,per_100g_snapshot,per_serving_snapshot').single());
      const batchIngredients = (batch.ingredients || []).map((row, index) => ({
        batch_id: batchRow.id,
        user_id: userId,
        food_key: row.foodKey || null,
        label: row.label || 'Ingredient',
        initial_weight_g: safeNumber(row.initialWeightG, 0),
        initial_state: row.initialState || 'raw',
        cooking_method_code: row.cookingMethod || 'raw',
        nutrition_snapshot: row.nutrition || {},
        yield_factor_used: safeNumber(row.yieldFactor, 1),
        yield_source_used: row.factorScope || 'manual',
        retention_factors_used: {},
        estimated_cooked_weight_g: safeNumber(row.estimatedCookedWeightG, 0),
        measured_cooked_weight_g: safeNumber(row.measuredCookedWeightG, 0) || null,
        sort_order: index,
      }));
      if (batchIngredients.length) unwrap(await client.from(tables.batchIngredients).insert(batchIngredients));
      return { recipeId, batch: batchRow };
    },
  };
}

function cleanArray(value, limit = Infinity) {
  return (Array.isArray(value) ? value : []).slice(0, limit);
}
