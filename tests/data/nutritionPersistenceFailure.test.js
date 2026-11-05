import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { saveLocalNutritionRows, saveLocalNutritionRowsOnce, discardLocalNutritionRow, discardAllLocalNutritionRows, mergeSleepRows } from '../../src/data/nutritionRepository.js';

afterEach(() => vi.unstubAllGlobals());
it('keeps sync incomplete when the local acknowledgement cannot be persisted', async () => {
  const source = fs.readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
  const guard = source.slice(source.indexOf('  function requireNutritionWrite('), source.indexOf('  function localNutritionRowKey('));
  const sync = source.slice(source.indexOf('  async function syncLocalNutritionRows('), source.indexOf('  function loadFoodKeys('));
  const discard = vi.fn();
  const CACHE = {};
  const context = vm.createContext({ CACHE, window: {}, navigator: { onLine: true }, localStorage: {}, console,
    txt: fr => fr, n: Number, client: () => ({}), uid: () => 'u', localMealKey: () => 'k',
    loadLocalMeals: () => [{ syncId: 'stable', meal: {} }], nutritionSyncId: row => row.syncId,
    localDateISO: () => '2026-11-04', activeTravelId: () => 'trip', table: value => value,
    repository: () => ({ saveLocalNutritionRows: () => false, syncLocalRow: async () => {} }),
    publishNutrition() {}, discardNutritionQueue: discard });
  vm.runInContext(guard + sync, context);
  await expect(vm.runInContext('syncLocalNutritionRows("manual")', context)).rejects.toMatchObject({ code: 'NUTRITION_STORAGE_FAILED' });
  expect(discard).not.toHaveBeenCalled();
  expect(CACHE).toMatchObject({ syncPhase: 'error', syncingLocal: false });
});
it.each(['one', 'all', 'sleep'])('refuses to acknowledge failed %s changes and preserves the stored value', action => {
  const original = action === 'sleep' ? { '2026-11-03': { hours: 7 } } : [{ syncId: 'old' }];
  let raw = JSON.stringify(original);
  let blocked = true;
  const storage = { getItem: () => raw, setItem: (_key, value) => { if (blocked) throw new Error('denied'); raw = value; } };
  const update = () => action === 'one' ? discardLocalNutritionRow({ storage, key: 'k', rowKey: 'old' })
    : action === 'all' ? discardAllLocalNutritionRows({ storage, key: 'k' })
    : mergeSleepRows({ storage, key: 'k', rows: { '2026-11-03': { hours: 8 } } });
  expect(update).toThrow();
  expect(JSON.parse(raw)).toEqual(original);
  blocked = false; update();
  if (action === 'sleep') expect(JSON.parse(raw)['2026-11-03'].hours).toBe(8);
  else expect(JSON.parse(raw)).toEqual([]);
});
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
