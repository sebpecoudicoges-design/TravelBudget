import { isDuplicateNutritionError, notesWithNutritionSyncId, nutritionSyncId, safeNumber, unwrap } from './nutritionRepository.js';

const mealFields = 'id,travel_id,meal_date,meal_type,label,water_ml,consumed_time';
const itemFields = 'food_key,label,grams,kcal,protein_g,carbs_g,fat_g,fiber_g';
const itemAmounts = ['grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'];
const normalizedTime = value => value ? String(value).replace(/^([0-9]{2}:[0-9]{2}):00(?:\.0+)?$/, '$1') : null;

function sameMeal(remote, draft) {
  return remote.travel_id === draft.travel_id
    && remote.meal_date === draft.meal_date && remote.meal_type === draft.meal_type && remote.label === draft.label
    && Number(remote.water_ml) === draft.water_ml && normalizedTime(remote.consumed_time) === normalizedTime(draft.consumed_time);
}

function sameItem(remote, draft) {
  return remote.food_key === draft.food_key && remote.label === draft.label
    && itemAmounts.every(key => remote[key] != null && Number(remote[key]) === draft[key]);
}

export async function syncNutritionLocalMeal({ client, tables, row, userId, travelId, fallbackDate, isCurrent = () => true }) {
  const meal = row?.meal || {};
  const item = row?.item;
  const syncId = nutritionSyncId(row);
  if (!syncId) throw new Error('Missing stable nutrition sync ID');
  const ensureCurrent = () => {
    if (!isCurrent()) throw new Error('Nutrition account or pending entry changed.');
  };
  const mealDraft = {
    user_id: userId,
    sync_id: syncId,
    travel_id: meal.travel_id === undefined ? (travelId || null) : meal.travel_id,
    meal_date: meal.meal_date || fallbackDate,
    meal_type: meal.meal_type || 'meal',
    label: meal.label || 'Repas',
    notes: notesWithNutritionSyncId(meal.notes, syncId),
    water_ml: safeNumber(meal.water_ml),
    consumed_time: meal.consumed_time || null,
  };
  const findMeal = async () => {
    ensureCurrent();
    return unwrap(await client.from(tables.meals).select(mealFields)
      .eq('user_id', userId).eq('sync_id', syncId).maybeSingle());
  };
  let remote = await findMeal();
  if (!remote) {
    ensureCurrent();
    // Do not replace a meal created by another replay between the read and insert.
    remote = unwrap(await client.from(tables.meals)
      .upsert(mealDraft, { onConflict: 'user_id,sync_id', ignoreDuplicates: true }).select(mealFields).maybeSingle());
    if (!remote) remote = await findMeal();
  }
  if (!remote?.id) throw new Error('Nutrition meal creation could not be confirmed.');
  const mealId = remote.id;
  const conflict = { mealId, skippedItem: true };
  if (!sameMeal(remote, mealDraft)) return conflict;

  const itemDraft = item ? {
    user_id: userId, meal_id: mealId, food_key: item.food_key || null,
    label: item.label || mealDraft.label || 'Aliment',
    ...Object.fromEntries(itemAmounts.map(key => [key, safeNumber(item[key])])),
  } : null;
  const readItems = async () => {
    ensureCurrent();
    const items = unwrap(await client.from(tables.items).select(itemFields)
      .eq('user_id', userId).eq('meal_id', mealId).limit(2));
    if (!Array.isArray(items)) throw new Error('Nutrition meal items could not be read.');
    return items;
  };
  const confirmed = { mealId, syncedItem: Boolean(item) };
  const matches = items => items.length === 1 && itemDraft && sameItem(items[0], itemDraft);
  const existing = await readItems();
  if (existing.length) return matches(existing) ? confirmed : conflict;
  if (!itemDraft) return confirmed;

  ensureCurrent();
  try {
    // If the response is lost, the next replay verifies the exact stored values.
    unwrap(await client.from(tables.items).insert(itemDraft));
    return confirmed;
  } catch (error) {
    if (!isDuplicateNutritionError(error)) throw error;
    const stored = await readItems();
    if (!stored.length) throw error;
    return matches(stored) ? confirmed : conflict;
  }
}
