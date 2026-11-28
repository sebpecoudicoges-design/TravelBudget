// Local PostgreSQL only: real, concurrent transactions and fictional meals/identities.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { loadNutritionAuditFixture, userA, userB } from './fixture.mjs';
import { startNutritionAuditPostgres } from './local-postgres.mjs';

const [pgBin, driverPath] = process.argv.slice(2);
if (!pgBin || !driverPath) throw new Error('Usage: node test-meal-key-lifecycle.mjs PG_BIN_DIR PG_NODE_MODULE');

const { connect, close } = await startNutritionAuditPostgres(pgBin, driverPath);
const one = async (db, sql, parameters) => (await db.query(sql, parameters)).rows[0];
const create = (db, key, grams = 80) => one(db, `select * from public.audit_nutrition_create_meal_v1(
  $1, null, '2026-11-28', 'dinner', 'Synthetic meal', null, 100, '19:00', $2)`, [
  key, JSON.stringify([{ food_key: 'rice_cooked', label: 'Synthetic food', grams }]),
]);
const insertLegacy = (db, user, key) => one(db, `insert into public.nutrition_meals (user_id, sync_id)
  values ($1, $2) returning id`, [user, key]);
const deleteMeal = (db, meal) => db.query('delete from public.nutrition_meals where id = $1', [meal]);
const registered = (db, user, key) => one(db,
  'select deleted from audit_nutrition_private.meal_keys where user_id = $1 and sync_id = $2', [user, key]);

function held(resultPromise) { return resultPromise.then(value => ({ value }), error => ({ error })); }
async function expectBlocked(admin, waiting, holder) {
  for (let n = 0; n < 100; n += 1) {
    if ((await one(admin, 'select $2 = any(pg_blocking_pids($1)) as blocked', [waiting, holder])).blocked) return;
    await delay(20);
  }
  throw new Error('Concurrent replay did not wait for the prior meal transaction');
}

try {
  const admin = await connect();
  await loadNutritionAuditFixture({ exec: sql => admin.query(sql), query: (...args) => admin.query(...args) });
  async function as(user) {
    const conn = await connect();
    await conn.query('set role authenticated');
    await conn.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    return conn;
  }
  const a = await as(userA), b = await as(userA), elsewhere = await as(userB);
  const preexisting = await insertLegacy(a, userA, 'preexisting-key');
  await admin.query(readFileSync(new URL('./meal-key-lifecycle.sql', import.meta.url), 'utf8'));

  assert.deepEqual(await one(admin, `select
    has_schema_privilege('authenticated', 'audit_nutrition_private', 'USAGE') as registry_usable,
    has_function_privilege('authenticated', 'audit_nutrition_private.track_meal_key()', 'EXECUTE') as trigger_callable`),
  { registry_usable: false, trigger_callable: false });

  const pidA = (await one(a, 'select pg_backend_pid() as pid')).pid;
  const pidB = (await one(b, 'select pg_backend_pid() as pid')).pid;
  for (const [key, insert, initialMeal] of [
    ['preexisting-key', () => insertLegacy(b, userA, 'preexisting-key'), preexisting.id],
    ['retry-rpc', () => create(b, 'retry-rpc'), (await create(a, 'retry-rpc')).meal_id],
  ]) {
    await a.query('begin');
    assert.equal((await deleteMeal(a, initialMeal)).rowCount, 1);
    const retry = held(insert());
    await expectBlocked(admin, pidB, pidA);
    await a.query('commit');
    assert.equal((await retry).error?.code, 'TBM01');
    assert.deepEqual(await registered(admin, userA, key), { deleted: true });
    assert.equal(await one(a, 'select id from public.nutrition_meals where sync_id = $1', [key]), undefined);
    assert.equal(await one(a, 'select id from public.nutrition_meal_items where meal_id = $1', [initialMeal]), undefined);
    await assert.rejects(() => create(a, key), { code: 'TBM01' });
  }

  const restored = await create(a, 'rolled-back-delete');
  await a.query('begin');
  await deleteMeal(a, restored.meal_id);
  const retry = held(create(b, 'rolled-back-delete'));
  await expectBlocked(admin, pidB, pidA);
  await a.query('rollback');
  assert.deepEqual((await retry).value, { meal_id: restored.meal_id, status: 'already_applied' });
  assert.deepEqual(await registered(admin, userA, 'rolled-back-delete'), { deleted: false });
  await assert.rejects(() => create(a, 'rolled-back-create', -1), { code: '23514' });
  assert.equal(await registered(admin, userA, 'rolled-back-create'), undefined);
  assert.equal((await create(a, 'rolled-back-create')).status, 'created');

  assert.equal((await create(elsewhere, 'retry-rpc')).status, 'created');
  const deletedElsewhere = await create(elsewhere, 'deleted-elsewhere');
  await deleteMeal(elsewhere, deletedElsewhere.meal_id);
  assert.deepEqual(await registered(admin, userB, 'deleted-elsewhere'), { deleted: true });
  const unkeyed = await insertLegacy(elsewhere, userB, null);
  assert.ok(unkeyed.id);
  assert.deepEqual(await one(admin, 'select count(*)::int as n from audit_nutrition_private.meal_keys where user_id = $1',
    [userB]), { n: 2 });
  await admin.query('delete from auth.users where id = $1', [userB]);
  assert.deepEqual(await one(admin, 'select count(*)::int as n from audit_nutrition_private.meal_keys where user_id = $1',
    [userB]), { n: 0 });
  assert.deepEqual(await one(admin, 'select count(*)::int as n from public.nutrition_meals where user_id = $1',
    [userB]), { n: 0 });
  assert.deepEqual(await registered(admin, userA, 'retry-rpc'), { deleted: true });

  await a.query("update public.nutrition_meals set label = 'Updated normally' where id = $1", [restored.meal_id]);
  await assert.rejects(() => a.query("update public.nutrition_meals set sync_id = 'changed-key' where id = $1",
    [restored.meal_id]), { code: 'TBM02' });
  console.log('Meal-key lifecycle verified: legacy and RPC replay, commit/rollback, independent account and account erasure.');
} finally {
  await close();
}
