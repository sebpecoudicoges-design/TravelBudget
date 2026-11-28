// Read-only audit inventory of legacy localStorage drafts. Not a replay client.
import { loadLocalNutritionRows } from '../../src/data/nutritionRepository.js';

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const stableId = /^[A-Za-z0-9_-]{1,128}$/;

export function reviewLegacyMealDrafts({ storage, key, userId }) {
  if (typeof userId !== 'string' || !uuid.test(userId)) throw new TypeError('Invalid review account');
  const rows = loadLocalNutritionRows({ storage, key, strict: true });
  const scoped = rows.filter(row => row.meal?.user_id === userId);
  const counts = new Map();
  const indexed = scoped.map(row => {
    const ids = [row.syncId, row.meal.sync_id].filter(value => value != null);
    for (const claim of new Set(ids)) {
      if (typeof claim === 'string' && stableId.test(claim)) counts.set(claim, (counts.get(claim) || 0) + 1);
    }
    const [id] = ids;
    if (!ids.length) return { row, status: 'legacy-unkeyed' };
    if (typeof id !== 'string' || !stableId.test(id) || ids.some(other => other !== id)) {
      return { row, status: 'identity-ambiguous' };
    }
    return { row, id, status: 'explicit-key' };
  });
  return {
    withheldCount: rows.length - scoped.length,
    drafts: indexed.map(({ row, id, status }) => ({
      row,
      // An explicit key only identifies a candidate. This inventory cannot
      // authorize replay, infer remote state, or assign a new identifier.
      status: id && counts.get(id) > 1 ? 'identity-ambiguous' : status,
    })),
  };
}
