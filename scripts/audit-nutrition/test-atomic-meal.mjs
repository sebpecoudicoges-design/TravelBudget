// Strictly isolated: supply the local module for the pinned in-memory PGlite.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { loadNutritionAuditFixture, userA, userB, travelA } from './fixture.mjs';

const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const db = new PGlite();
const food = (key, grams) => ({ food_key: key, label: key, grams, kcal: 20, protein_g: 1, carbs_g: 2, fat_g: 3, fiber_g: 4 });
const twoItems = [food('rice_cooked', 80), food('pasta_cooked', 120)];
const payload = (key, items = twoItems, label = 'Synthetic meal', travel = null) =>
  [key, travel, '2026-11-27', 'lunch', label, `tb_sync:${key}`, 200, '12:30', JSON.stringify(items)];
const call = async args => (await db.query(
  'select * from public.audit_nutrition_create_meal_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)', args,
)).rows[0];
const counts = async () => (await db.query(`select
  (select count(*)::int from public.nutrition_meals) as meals,
  (select count(*)::int from public.nutrition_meal_items) as items`)).rows[0];
const setUser = async user => db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
const checkCode = code => error => error.code === code;

try {
  await loadNutritionAuditFixture(db);

  await db.exec('set role authenticated');
  await setUser(userA);
  await assert.rejects(call(payload('retry', [twoItems[0], food('pasta_cooked', -1)])), checkCode('23514'));
  assert.deepEqual(await counts(), { meals: 0, items: 0 }, 'constraint failure did not keep a partial meal');
  const made = await call(payload('retry', twoItems, 'Synthetic meal', travelA));
  assert.equal(made.status, 'created');
  assert.deepEqual(await call(payload('retry', twoItems, 'Synthetic meal', travelA)), { ...made, status: 'already_applied' });
  assert.deepEqual(await call(payload('retry', [food('rice_cooked', 81), twoItems[1]], 'Synthetic meal', travelA)),
    { ...made, status: 'conflict' });
  assert.deepEqual(await call(payload('retry', twoItems, 'Changed header', travelA)), { ...made, status: 'conflict' });
  assert.deepEqual(await counts(), { meals: 1, items: 2 });
  assert.deepEqual((await db.query('select grams::int from public.nutrition_meal_items order by sort_order')).rows,
    [{ grams: 80 }, { grams: 120 }]);

  const hydrationOnly = await call(payload('water', []));
  assert.equal(hydrationOnly.status, 'created');
  assert.deepEqual(await call(payload('water', [])), { ...hydrationOnly, status: 'already_applied' });
  await db.query(`insert into public.nutrition_meals(user_id, sync_id, meal_date, meal_type, label, notes, water_ml, consumed_time)
    values ($1, 'legacy-partial', '2026-11-27', 'lunch', 'Synthetic meal', 'tb_sync:legacy-partial', 200, '12:30')`, [userA]);
  assert.equal((await call(payload('legacy-partial'))).status, 'conflict');
  assert.deepEqual(await counts(), { meals: 3, items: 2 }, 'legacy partial row was not silently changed');

  await setUser(userB);
  assert.deepEqual(await counts(), { meals: 0, items: 0 });
  const separate = await call(payload('retry'));
  assert.equal(separate.status, 'created');
  assert.notEqual(separate.meal_id, made.meal_id);
  assert.deepEqual(await counts(), { meals: 1, items: 2 });
  await db.exec('reset role; set role anon');
  const allowed = await db.query(`select has_function_privilege(
    'public.audit_nutrition_create_meal_v1(text,uuid,date,text,text,text,numeric,time,jsonb)'::regprocedure, 'EXECUTE') as allowed`);
  assert.equal(allowed.rows[0].allowed, false);
  console.log('Nutrition SQL audit: rollback, retry, exact repeat, conflict, hydration, legacy partial, account isolation and EXECUTE scope OK.');
} finally {
  await db.close();
}
