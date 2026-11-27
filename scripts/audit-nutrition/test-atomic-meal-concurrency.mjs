// Creates two authenticated sessions against a fresh, local PostgreSQL cluster.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { loadNutritionAuditFixture, userA } from './fixture.mjs';
import { startNutritionAuditPostgres } from './local-postgres.mjs';

const [pgBin, driverPath] = process.argv.slice(2);
if (!pgBin || !driverPath) throw new Error('Usage: node test-atomic-meal-concurrency.mjs PG_BIN_DIR PG_NODE_MODULE');
const { connect, close } = await startNutritionAuditPostgres(pgBin, driverPath);

const args = (key, grams = 80) => [key, null, '2026-11-27', 'dinner', 'Synthetic meal',
  'tb_sync:' + key, 150, '18:15', JSON.stringify([
    { food_key: 'rice_cooked', label: 'Rice fixture', grams },
    { food_key: 'pasta_cooked', label: 'Pasta fixture', grams: 120 },
  ])];
const call = async (connection, key, grams) => (await connection.query(
  'select * from public.audit_nutrition_create_meal_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)',
  args(key, grams),
)).rows[0];
const row = async (connection, sql, args = []) => (await connection.query(sql, args)).rows[0];
async function observeBlocked(admin, waiting, holding) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await row(admin, 'select $2::int = any(pg_blocking_pids($1)) as blocked', [waiting, holding])).blocked) return;
    await delay(20);
  }
  throw new Error('Expected the racing operation to wait on the other session');
}
const startRacing = (connection, key, grams) => call(connection, key, grams)
  .then(value => ({ value }), error => ({ error }));
async function result(pending) {
  const got = await pending;
  if (got.error) throw got.error;
  return got.value;
}

try {
  const admin = await connect();
  await loadNutritionAuditFixture({ exec: sql => admin.query(sql), query: (...args) => admin.query(...args) });
  const a = await connect();
  const b = await connect();
  for (const client of [a, b]) {
    await client.query('set role authenticated');
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [userA]);
  }
  const pidA = (await row(a, 'select pg_backend_pid() as pid')).pid;
  const pidB = (await row(b, 'select pg_backend_pid() as pid')).pid;
  assert.notEqual(pidA, pidB);

  await a.query('begin');
  await call(a, 'same-key'); // The original caller is treated as never receiving confirmation.
  const replay = startRacing(b, 'same-key');
  await observeBlocked(admin, pidB, pidA);
  await a.query('commit');
  const confirmed = await result(replay);
  assert.equal(confirmed.status, 'already_applied');

  await a.query('begin');
  await call(a, 'rolled-back');
  const competing = startRacing(b, 'rolled-back', 82);
  await observeBlocked(admin, pidB, pidA);
  await a.query('rollback');
  assert.equal((await result(competing)).status, 'created');

  await a.query('begin');
  await a.query("update public.nutrition_meals set label = 'Edited remotely' where id = $1", [confirmed.meal_id]);
  const duringEdit = startRacing(b, 'same-key');
  await observeBlocked(admin, pidB, pidA);
  await a.query('commit');
  assert.deepEqual(await result(duringEdit), { meal_id: confirmed.meal_id, status: 'conflict' });
  const summary = (await admin.query(`select m.sync_id, m.label, array_agg(i.grams::int order by i.sort_order) as grams
    from public.nutrition_meals m join public.nutrition_meal_items i on i.meal_id = m.id
    group by m.id order by m.sync_id`)).rows;
  assert.deepEqual(summary, [
    { sync_id: 'rolled-back', label: 'Synthetic meal', grams: [82, 120] },
    { sync_id: 'same-key', label: 'Edited remotely', grams: [80, 120] },
  ]);
  for (const action of ['edit', 'delete', 'cancel-edit']) {
    const key = 'item-' + action;
    const created = await call(a, key);
    const item = await row(a, 'select id from public.nutrition_meal_items where meal_id = $1 and sort_order = 0', [created.meal_id]);
    await a.query('begin');
    const applied = await a.query(action === 'delete'
      ? 'delete from public.nutrition_meal_items where id = $1 and user_id = $2'
      : 'update public.nutrition_meal_items set grams = 91 where id = $1 and user_id = $2', [item.id, userA]);
    assert.equal(applied.rowCount, 1);
    const retry = startRacing(b, key);
    await observeBlocked(admin, pidB, pidA);
    await a.query(action === 'cancel-edit' ? 'rollback' : 'commit');
    assert.deepEqual(await result(retry), {
      meal_id: created.meal_id, status: action === 'cancel-edit' ? 'already_applied' : 'conflict',
    });
    const stored = (await a.query('select grams::int from public.nutrition_meal_items where meal_id = $1 order by sort_order',
      [created.meal_id])).rows.map(value => value.grams);
    assert.deepEqual(stored, action === 'delete' ? [120] : [action === 'edit' ? 91 : 80, 120]);
  }

  const replayFirst = await call(b, 'replay-first');
  const firstItem = await row(a, 'select id from public.nutrition_meal_items where meal_id = $1 and sort_order = 0', [replayFirst.meal_id]);
  await b.query('begin');
  assert.deepEqual(await call(b, 'replay-first'), { meal_id: replayFirst.meal_id, status: 'already_applied' });
  const laterEdit = a.query('update public.nutrition_meal_items set grams = 95 where id = $1 and user_id = $2',
    [firstItem.id, userA]).then(value => ({ value }), error => ({ error }));
  await observeBlocked(admin, pidA, pidB);
  await b.query('commit');
  assert.equal((await result(laterEdit)).rowCount, 1);
  assert.deepEqual(await call(b, 'replay-first'), { meal_id: replayFirst.meal_id, status: 'conflict' });
  assert.equal((await row(admin, 'select grams::int from public.nutrition_meal_items where id = $1', [firstItem.id])).grams, 95);
  // An old client can still add an item to an existing meal. The FK's parent
  // lock orders that insert with the replay's parent lock.
  const legacyAdd = await call(a, 'item-add');
  await a.query('begin');
  await a.query(`insert into public.nutrition_meal_items (user_id, meal_id, label, grams, sort_order)
    values ($1, $2, 'Extra portion', 30, 2)`, [userA, legacyAdd.meal_id]);
  const retryAdd = startRacing(b, 'item-add');
  await observeBlocked(admin, pidB, pidA);
  await a.query('commit');
  assert.deepEqual(await result(retryAdd), { meal_id: legacyAdd.meal_id, status: 'conflict' });
  assert.equal((await row(a, 'select count(*)::int as n from public.nutrition_meal_items where meal_id = $1',
    [legacyAdd.meal_id])).n, 3);
  console.log('PostgreSQL concurrency: replay, rollback, header update and independent item insert/update/delete serialized.');
} finally {
  await close();
}
