import { describe, expect, it } from 'vitest';
import { disposableStorageEntries, isQuotaExceededError, safeStorageSet } from '../../src/data/storageQuota.js';

class LimitedStorage {
  constructor(limit) { this.limit = limit; this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  removeItem(key) { this.map.delete(String(key)); }
  setItem(key, value) {
    const next = new Map(this.map);
    next.set(String(key), String(value));
    const size = [...next].reduce((sum, [k, v]) => sum + k.length + v.length, 0);
    if (size > this.limit) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError', code: 22 });
    this.map = next;
  }
}

describe('storage quota recovery', () => {
  it('recognizes browser quota errors', () => {
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaExceededError({ code: 1014 })).toBe(true);
    expect(isQuotaExceededError(new Error('other'))).toBe(false);
  });

  it('evicts reconstructible caches while preserving pending mutations', () => {
    const storage = new LimitedStorage(240);
    storage.setItem('travelbudget_offline_queue_v2_user', 'pending'.repeat(8));
    storage.setItem('travelbudget_nutrition_food_cache_v1', 'food'.repeat(20));

    const result = safeStorageSet(storage, 'travelbudget_active_travel_id_v1', 'travel-id');

    expect(result.ok).toBe(true);
    expect(result.recovered).toBe(true);
    expect(storage.getItem('travelbudget_offline_queue_v2_user')).toContain('pending');
    expect(storage.getItem('travelbudget_nutrition_food_cache_v1')).toBeNull();
    expect(storage.getItem('travelbudget_active_travel_id_v1')).toBe('travel-id');
  });

  it('orders disposable entries by recoverable size', () => {
    const storage = new LimitedStorage(500);
    storage.setItem('travelbudget_error_logs_v2', 'x'.repeat(40));
    storage.setItem('travelbudget_sport_library_v1', 'x'.repeat(80));
    expect(disposableStorageEntries(storage).map((row) => row.key)).toEqual([
      'travelbudget_sport_library_v1',
      'travelbudget_error_logs_v2',
    ]);
  });
});
