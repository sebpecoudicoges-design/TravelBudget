import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeLocalNutritionRow } from '../../src/data/nutritionRepository.js';
import { reviewLegacyMealDrafts } from './legacy-draft-review.mjs';
import { atomicMealRpc, replayAtomicMeal } from './atomic-meal-client.mjs';

const userId = '00000000-0000-4000-8000-000000000001';
const mealId = '00000000-0000-4000-8000-000000000002';
const saved = () => makeLocalNutritionRow({
  food: { key: 'rice_cooked', name: 'Rice' }, grams: 80, nut: { kcal: 60 },
  waterMl: 150, consumedTime: '18:15', mealType: 'dinner', mealDate: '2026-11-27',
  syncId: 'nutrition_offline-a', userId,
});
const result = (status = 'created') => ({ data: [{ meal_id: mealId, status }], error: null });
const replay = (rpc, input = {}) => replayAtomicMeal({
  transport: { userId, rpc, from: () => assert.fail('No legacy table writes') },
  userId, row: saved(), isCurrent: () => true, ...input,
});

test('lost reply and retries keep exactly the same serialized snapshot', async () => {
  const row = saved();
  const calls = [];
  for (const status of [null, 'created', 'already_applied', 'conflict']) {
    const job = replay(async (name, args) => {
      assert.equal(name, atomicMealRpc);
      calls.push(JSON.stringify(args));
      assert.equal(args.p_sync_id, row.syncId);
      assert.equal(args.p_notes, row.meal.notes);
      assert.equal(args.p_travel_id, null);
      assert.equal(args.p_meal_date, '2026-11-27');
      assert.deepEqual(args.p_items, [{
        food_key: 'rice_cooked', label: 'Rice', grams: 80, kcal: 60,
        protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0,
      }]);
      assert.ok(!('user_id' in args));
      if (!status) throw new TypeError('Lost response');
      return result(status);
    }, { row });
    if (!status) await assert.rejects(job, /Lost response/);
    else assert.deepEqual(await job, { mealId, status, disposition: status === 'conflict' ? 'pending' : 'confirmed' });
  }
  assert.equal(new Set(calls).size, 1);
});

test('water only and several items preserve the saved omission and order', async () => {
  const row = saved();
  await replay(async (_, args) => {
    assert.deepEqual(args.p_items, []);
    assert.equal(args.p_water_ml, 150);
    return result();
  }, { row: { ...row, item: null } });
  await replay(async (_, args) => {
    assert.deepEqual(args.p_items.map(item => item.grams), [80, 42]);
    return result();
  }, { row: { ...row, item: null, items: [row.item, { ...row.item, grams: 42 }] } });
});

test('only the account and pending revision that started the request can confirm it', async () => {
  const rpc = async () => assert.fail('No request for stale or mismatched context');
  await assert.rejects(replay(rpc, { isCurrent: () => false }), /changed/);
  await assert.rejects(replay(rpc, { isCurrent: undefined }), /changed/);
  await assert.rejects(replay(rpc, { transport: { userId: mealId, rpc } }), /not bound/);
  let revision = 1;
  let finish;
  const pending = replay(() => new Promise(resolve => { finish = resolve; }), { isCurrent: () => revision === 1 });
  revision += 1;
  finish(result());
  await assert.rejects(pending, /changed/);
});

test('incomplete or ambiguous legacy snapshots stay pending without a request', async () => {
  const row = saved();
  const { item: ignoredItem, ...withoutItems } = row;
  const variants = [
    withoutItems,
    { ...row, meal: { ...row.meal, user_id: mealId } },
    { ...row, syncId: 'conflicting-id' },
    { ...row, syncId: undefined, meal: { ...row.meal, sync_id: undefined } },
    { ...row, meal: { ...row.meal, meal_date: undefined } },
    { ...row, meal: { ...row.meal, travel_id: undefined } },
    { ...row, items: [] },
    { ...row, item: { ...row.item, grams: NaN } },
  ];
  for (const bad of variants) {
    await assert.rejects(replay(async () => assert.fail('No request for invalid snapshot'), { row: bad }),
      /Saved meal|Ambiguous|Invalid/);
  }
});

test('malformed response and unavailable RPC never confirm or fall back', async () => {
  for (const data of [null, [], {}, [null], result().data.concat(result().data),
    [{ meal_id: mealId, status: 'unknown' }], [{ meal_id: 'invalid', status: 'created' }]]) {
    await assert.rejects(replay(async () => ({ data })), /Unconfirmed/);
  }
  const unavailable = new Error('RPC not installed');
  let calls = 0;
  await assert.rejects(replay(async () => {
    calls += 1;
    return { data: null, error: unavailable };
  }), error => error === unavailable);
  assert.equal(calls, 1);
});

test('a retired key keeps the draft pending, with no new ID or legacy fallback', async () => {
  const row = saved();
  const snapshots = [];
  for (let retry = 0; retry < 2; retry++) {
    const state = await replay(async (name, payload) => {
      assert.equal(name, atomicMealRpc);
      snapshots.push(payload);
      return { error: { code: 'TBM01', message: 'Meal key is no longer available' } };
    }, { row });
    assert.deepEqual(state, { mealId: null, status: 'deleted', disposition: 'pending' });
  }
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].p_sync_id, row.syncId);
  assert.deepEqual(snapshots[0], snapshots[1]);
  await assert.rejects(replay(async () => ({
    error: { code: 'PGRST202', message: 'Meal key is no longer available' },
  })), error => error.code === 'PGRST202');
  let current = true;
  await assert.rejects(replay(async () => {
    current = false;
    return { error: { code: 'TBM01' } };
  }, { isCurrent: () => current }), /changed/);
});

test('legacy inventory keeps unkeyed meal contents readable but never sends or rewrites them', async () => {
  const { syncId, meal: { sync_id, ...meal }, ...rest } = saved();
  const row = { ...rest, meal };
  const raw = JSON.stringify([row, saved(), { ...row, meal: { ...meal, user_id: mealId } }]);
  const storage = { getItem: () => raw, setItem: () => assert.fail('Read only') };
  const read = () => reviewLegacyMealDrafts({ storage, key: 'fixture', userId });
  assert.deepEqual(read(), {
    withheldCount: 1,
    drafts: [{ row, status: 'legacy-unkeyed' }, { row: JSON.parse(raw)[1], status: 'explicit-key' }],
  });
  assert.deepEqual(read().drafts[0].row, row);
  assert.equal(typeof meal.id, 'string');
  assert.match(meal.notes, /tb_sync:/);
  await assert.rejects(replay(async () => assert.fail('No request for legacy snapshot'), { row }), /unambiguous sync ID/);
});

test('duplicate or conflicting explicit keys stay visible but are marked ambiguous', () => {
  const row = saved();
  const raw = JSON.stringify([row, { ...row, item: null }, { ...row, syncId: 'different' }]);
  const review = reviewLegacyMealDrafts({ storage: { getItem: () => raw }, key: 'fixture', userId });
  assert.deepEqual(review.drafts.map(draft => draft.status), Array(3).fill('identity-ambiguous'));
  assert.equal(review.drafts[1].row.item, null);
  const conflicting = JSON.stringify([row, { ...row, syncId: 'different' }]);
  assert.deepEqual(reviewLegacyMealDrafts({ storage: { getItem: () => conflicting }, key: 'fixture', userId })
    .drafts.map(draft => draft.status), Array(2).fill('identity-ambiguous'));
  assert.throws(() => reviewLegacyMealDrafts({ storage: { getItem: () => '{}' }, key: 'fixture', userId }), /unreadable/);
});
