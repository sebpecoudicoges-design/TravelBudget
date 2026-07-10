function requireClient(getClient) {
  const client = typeof getClient === 'function' ? getClient() : getClient;
  if (!client || typeof client.from !== 'function') throw new Error('Supabase indisponible');
  return client;
}

function unwrap(result) {
  if (result?.error) throw result.error;
  if (result && Object.prototype.hasOwnProperty.call(result, 'data')) return result.data;
  return [];
}

function safeNumber(value, fallback = 0) {
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

function writeJson(storage, key, value) {
  try {
    const raw = JSON.stringify(value);
    if (typeof window !== 'undefined' && typeof window.tbSafeLocalStorageSet === 'function' && storage === window.localStorage) {
      window.tbSafeLocalStorageSet(key, raw);
    } else {
      storage?.setItem?.(key, raw);
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

export function saveCachedFoods({ storage, key, rows, limit = 500 }) {
  return writeJson(storage, key, (rows || []).slice(0, limit));
}

export function loadLocalNutritionRows({ storage, key }) {
  const rows = readJson(storage, key, []);
  return Array.isArray(rows) ? rows : [];
}

export function saveLocalNutritionRows({ storage, key, rows, limit = 200 }) {
  return writeJson(storage, key, (rows || []).slice(0, limit));
}

export function localNutritionRowKey(row, index = 0) {
  const raw = String(row?.syncId || row?.meal?.sync_id || row?.meal?.id || row?.item?.id || '').trim();
  return raw || `idx_${Math.max(0, safeNumber(index, 0))}`;
}

export function discardLocalNutritionRow({ storage, key, rowKey }) {
  const wanted = String(rowKey || '');
  const rows = loadLocalNutritionRows({ storage, key });
  const next = rows.filter((row, index) => localNutritionRowKey(row, index) !== wanted);
  saveLocalNutritionRows({ storage, key, rows: next });
  return { removed: rows.length - next.length, remaining: next };
}

export function discardAllLocalNutritionRows({ storage, key }) {
  const rows = loadLocalNutritionRows({ storage, key });
  saveLocalNutritionRows({ storage, key, rows: [] });
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
  if (!row) return [];
  const wanted = localNutritionRowKey(row, 0);
  const rows = loadLocalNutritionRows({ storage, key })
    .filter((existing) => localNutritionRowKey(existing, 0) !== wanted);
  const next = [row, ...rows];
  saveLocalNutritionRows({ storage, key, rows: next });
  return next;
}

export function loadSleepRows({ storage, key }) {
  const rows = readJson(storage, key, {});
  return rows && typeof rows === 'object' && !Array.isArray(rows) ? rows : {};
}

export function saveSleepRows({ storage, key, rows }) {
  return writeJson(storage, key, rows || {});
}

export function mergeSleepRows({ storage, key, rows, now = () => new Date() }) {
  const current = loadSleepRows({ storage, key });
  Object.entries(rows || {}).forEach(([day, row]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return;
    current[day] = {
      hours: safeNumber(row.hours, 0),
      quality: String(row.quality || 'ok'),
      updatedAt: row.updatedAt || row.updated_at || now().toISOString(),
    };
  });
  saveSleepRows({ storage, key, rows: current });
  return current;
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
    loadSleepRows,
    saveSleepRows,
    mergeSleepRows,

    async findMealBySyncId({ table, userId, syncId }) {
      if (!syncId) return null;
      const client = requireClient(getClient);
      const row = unwrap(await client
        .from(table)
        .select('id,label')
        .eq('user_id', userId)
        .eq('sync_id', syncId)
        .maybeSingle());
      return row || null;
    },

    async upsertMeal({ table, meal, userId, travelId, mealDate, syncId }) {
      const client = requireClient(getClient);
      const payload = {
        user_id: userId,
        travel_id: meal.travel_id || travelId,
        meal_date: mealDate || meal.meal_date,
        meal_type: meal.meal_type || 'meal',
        label: meal.label || 'Repas',
        notes: notesWithNutritionSyncId(meal.notes, syncId),
        water_ml: safeNumber(meal.water_ml, 0),
      };
      if (syncId) payload.sync_id = syncId;
      const query = syncId
        ? client.from(table).upsert(payload, { onConflict: 'user_id,sync_id' })
        : client.from(table).insert(payload);
      const inserted = unwrap(await query.select('id').single());
      return inserted?.id;
    },

    async hasDuplicateItem({ table, userId, mealId, item }) {
      const client = requireClient(getClient);
      const rows = unwrap(await client
        .from(table)
        .select('id')
        .eq('user_id', userId)
        .eq('meal_id', mealId)
        .eq('label', item.label || 'Aliment')
        .eq('grams', safeNumber(item.grams, 0))
        .eq('kcal', safeNumber(item.kcal, 0))
        .limit(1));
      return Array.isArray(rows) && rows.length > 0;
    },

    async insertMealItem({ table, userId, mealId, item }) {
      const client = requireClient(getClient);
      const payload = {
        user_id: userId,
        meal_id: mealId,
        food_key: item.food_key || null,
        label: item.label || 'Aliment',
        grams: safeNumber(item.grams, 0),
        kcal: safeNumber(item.kcal, 0),
        protein_g: safeNumber(item.protein_g, 0),
        carbs_g: safeNumber(item.carbs_g, 0),
        fat_g: safeNumber(item.fat_g, 0),
        fiber_g: safeNumber(item.fiber_g, 0),
      };
      return unwrap(await client.from(table).insert(payload));
    },

    async syncLocalRow({ tables, row, userId, travelId, fallbackDate }) {
      const meal = row?.meal || {};
      const item = row?.item || null;
      const syncId = nutritionSyncId(row);
      const mealDate = meal.meal_date || fallbackDate;
      let mealId = '';
      let existingMealLabel = '';
      const existingMeal = await this.findMealBySyncId({ table: tables.meals, userId, syncId });
      if (existingMeal) {
        mealId = existingMeal.id;
        existingMealLabel = existingMeal.label || '';
      }
      if (!mealId) {
        mealId = await this.upsertMeal({ table: tables.meals, meal, userId, travelId, mealDate, syncId });
      }
      if (item) {
        const itemLabel = item.label || meal.label || 'Aliment';
        if (existingMealLabel && itemLabel && existingMealLabel !== itemLabel) return { mealId, skippedItem: true };
        const duplicate = await this.hasDuplicateItem({
          table: tables.items,
          userId,
          mealId,
          item: { ...item, label: itemLabel },
        });
        if (!duplicate) {
          await this.insertMealItem({
            table: tables.items,
            userId,
            mealId,
            item: { ...item, label: itemLabel },
          });
        }
      }
      return { mealId, syncedItem: Boolean(item) };
    },
  };
}
