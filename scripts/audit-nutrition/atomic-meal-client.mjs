// Audit only. Never imported by the application or used against production.
import { notesWithNutritionSyncId, unwrap } from '../../src/data/nutritionRepository.js';

export const atomicMealRpc = 'audit_nutrition_create_meal_v1';
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const stableId = /^[A-Za-z0-9_-]{1,128}$/;
const itemAmounts = ['grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function amount(value) {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Invalid saved nutrition amount');
  }
  return value;
}

function normalize(row, userId) {
  const meal = row?.meal;
  if (!isRecord(meal) || typeof userId !== 'string' || !uuid.test(userId) || meal.user_id !== userId) {
    throw new Error('Saved meal has no matching account');
  }
  const ids = [row.syncId, meal.sync_id].filter(value => value != null);
  const [syncId] = ids;
  if (typeof syncId !== 'string' || !stableId.test(syncId) || ids.some(id => id !== syncId)) {
    throw new Error('Saved meal has no unambiguous sync ID');
  }
  // Missing legacy date/travel needs review. Do not substitute today's date or active travel.
  if (typeof meal.meal_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(meal.meal_date)
      || (meal.travel_id !== null && (typeof meal.travel_id !== 'string' || !uuid.test(meal.travel_id)))) {
    throw new Error('Saved meal has no stable date or travel');
  }
  const hasItems = Object.hasOwn(row, 'items');
  const items = hasItems ? row.items : row.item == null ? [] : [row.item];
  if ((!hasItems && !Object.hasOwn(row, 'item')) || (hasItems && row.item != null)
      || !Array.isArray(items) || items.length > 100) {
    throw new Error('Ambiguous saved nutrition items');
  }
  const label = meal.label || 'Repas';
  return {
    p_sync_id: syncId, p_travel_id: meal.travel_id, p_meal_date: meal.meal_date,
    p_meal_type: meal.meal_type || 'meal', p_label: label,
    p_notes: notesWithNutritionSyncId(meal.notes, syncId),
    p_water_ml: amount(meal.water_ml), p_consumed_time: meal.consumed_time || null,
    p_items: Array.from(items, item => {
      if (!isRecord(item) || (item.user_id != null && item.user_id !== userId)) {
        throw new Error('Invalid saved nutrition item');
      }
      return {
        food_key: item.food_key || null, label: item.label || label,
        ...Object.fromEntries(itemAmounts.map(key => [key, amount(item[key])])),
      };
    }),
  };
}

// The transport must carry a fixed session for userId, not a shared client that
// lazily resolves the active session. isCurrent must cover account and row revision.
// Only a caller still owning that revision may remove the pending row.
export async function replayAtomicMeal({ transport, row, userId, isCurrent }) {
  const confirmCurrent = () => {
    if (typeof isCurrent !== 'function' || isCurrent() !== true) {
      throw new Error('Nutrition account or pending entry changed');
    }
  };
  confirmCurrent();
  if (transport?.userId !== userId || typeof transport?.rpc !== 'function') {
    throw new Error('Nutrition transport is not bound to the saved account');
  }
  const payload = normalize(row, userId);
  confirmCurrent();
  const response = await transport.rpc(atomicMealRpc, payload);
  confirmCurrent();
  const data = unwrap(response);
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    throw new Error('Unconfirmed atomic nutrition response');
  }
  const { meal_id: mealId, status } = data[0];
  if (typeof mealId !== 'string' || !uuid.test(mealId)
    || !['created', 'already_applied', 'conflict'].includes(status)) {
    throw new Error('Unconfirmed atomic nutrition response');
  }
  return { mealId, status, disposition: status === 'conflict' ? 'pending' : 'confirmed' };
}
