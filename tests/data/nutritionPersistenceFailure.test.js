import { afterEach, expect, it, vi } from 'vitest';
import { saveLocalNutritionRows, saveLocalNutritionRowsOnce } from '../../src/data/nutritionRepository.js';

afterEach(() => vi.unstubAllGlobals());
it.each(['quota', 'denied', 'missing', 'safe-result'])('does not confirm a %s storage failure and retains the attempted payload', mode => {
  const existing = [{ syncId: 'old' }];
  const storage = { getItem: () => JSON.stringify(existing), setItem: vi.fn(() => {
    if (mode !== 'safe-result') throw new DOMException('blocked', mode === 'quota' ? 'QuotaExceededError' : 'SecurityError');
  }) };
  if (mode === 'missing') delete storage.setItem;
  if (mode === 'safe-result') vi.stubGlobal('window', { localStorage: storage, tbSafeLocalStorageSet: () => ({ ok: false }) });
  expect(saveLocalNutritionRows({ storage, key: 'pending', rows: [] })).toBe(false);
  try {
    saveLocalNutritionRowsOnce({ storage, key: 'pending', rows: [{ syncId: 'new' }] });
    expect.fail('Failure must propagate');
  } catch (error) {
    expect(error.code).toBe('NUTRITION_STORAGE_FAILED');
    expect(error.pendingRows).toEqual([{ syncId: 'new' }, ...existing]);
  }
  expect(JSON.parse(storage.getItem())).toEqual(existing);
});
it('accepts a recovered write from the safe-storage adapter', () => {
  const storage = {};
  vi.stubGlobal('window', { localStorage: storage, tbSafeLocalStorageSet: () => ({ ok: true, recovered: true }) });
  expect(saveLocalNutritionRows({ storage, key: 'pending', rows: [] })).toBe(true);
});
