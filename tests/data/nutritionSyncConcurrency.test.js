import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
import { loadLocalNutritionRows } from '../../src/data/nutritionRepository.js';

const source = fs.readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
const sync = source.slice(source.indexOf('  async function syncLocalNutritionRows('), source.indexOf('  function loadFoodKeys('));
const row = (id, label = id) => ({ syncId: id, meal: { label } });

it.each(['add', 'edit', 'edit-error', 'delete-error', 'account', 'read-error', 'remote-conflict'])('preserves concurrent nutrition changes: %s', async change => {
  let user = 'a';
  let rows = [row('first')];
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let unreadable = false;
  const run = vi.fn(async () => { await pending; if (change.endsWith('-error') && change !== 'read-error') throw new Error('Offline'); return { skippedItem: change === 'remote-conflict' }; });
  const discard = vi.fn();
  const context = vm.createContext({ CACHE: {}, window: {}, navigator: { onLine: true }, console: { warn() {} },
    txt: fr => fr, n: (value, fallback) => Number(value) || fallback, client: () => ({}), uid: () => user, localMealKey: () => user,
    loadLocalMeals: () => { if (unreadable) throw new Error('Read unavailable'); return structuredClone(rows); }, saveLocalMeals: value => { rows = structuredClone(value); },
    nutritionSyncId: entry => entry.syncId, localDateISO: () => '2026-11-23', activeTravelId: () => 'trip', table: x => x,
    repository: () => ({ syncLocalRow: run }), publishNutrition() {}, discardNutritionQueue: discard, isOfflineSkipError: () => false });
  vm.runInContext(sync, context);
  const sending = vm.runInContext('syncLocalNutritionRows("manual")', context);
  expect(run).toHaveBeenCalledOnce();
  if (change === 'add') rows.push(row('second'));
  if (change.startsWith('edit')) rows[0].meal.label = 'edited';
  if (change === 'delete-error') rows = [];
  if (change === 'account') { user = 'b'; rows = [row('other-user')]; }
  if (change === 'read-error') unreadable = true;
  release();
  if (unreadable) await expect(sending).rejects.toThrow('Read unavailable');
  else await sending;
  if (change === 'remote-conflict') {
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...row('first'), syncAttempts: 1 });
    expect(rows[0].syncError).toContain('modification locale conservee');
    expect(discard).not.toHaveBeenCalled();
    return;
  }
  const expected = { add: [row('second')], edit: [row('first', 'edited')], 'edit-error': [row('first', 'edited')], 'delete-error': [], account: [row('other-user')], 'read-error': [row('first')] }[change];
  expect(rows).toEqual(expected);
  if (expected.length) expect(discard).not.toHaveBeenCalled();
});

it('keeps repository replay as the sole writer instead of a duplicate legacy SQL path', () => {
  expect(sync).toContain('repository().syncLocalRow');
  expect(sync).not.toContain('c.from(');
  expect(source).not.toContain('function isDuplicateNutritionError(');
});

it.each(['{broken', 'null', '{}', '[null]'])('strict pending reads preserve malformed data: %s', raw => {
  const storage = { getItem: () => raw, setItem: vi.fn() };
  expect(() => loadLocalNutritionRows({ storage, key: 'pending', strict: true })).toThrow();
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(loadLocalNutritionRows({ storage: { getItem: () => null }, key: 'pending', strict: true })).toEqual([]);
});
