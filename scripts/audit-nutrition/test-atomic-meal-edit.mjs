// Isolated PostgreSQL fixture. No app, account or remote data.
import assert from 'node:assert/strict';
import { loadNutritionAuditFixture, userA, travelA } from './fixture.mjs';
import { startNutritionAuditPostgres } from './local-postgres.mjs';

const [pgBin, driverPath] = process.argv.slice(2);
if (!pgBin || !driverPath) throw new Error('Usage: node test-atomic-meal-edit.mjs PG_BIN_DIR PG_NODE_MODULE');
const { connect, close } = await startNutritionAuditPostgres(pgBin, driverPath);
const key = 'synthetic-edit';
const initialItems = [
  { food_key: 'rice_cooked', label: 'Rice fixture', grams: 80, kcal: 130 },
  { food_key: 'pasta_cooked', label: 'Pasta fixture', grams: 120, kcal: 170 },
];
const one = async (db, query, params) => (await db.query(query, params)).rows[0];
try {
  const admin = await connect();
  await loadNutritionAuditFixture({ exec: sql => admin.query(sql), query: (...args) => admin.query(...args) });
  const writer = await connect();
  const observer = await connect();
  for (const db of [writer, observer]) {
    await db.query('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userA]);
  }
  const created = await one(writer, 'select * from public.audit_nutrition_create_meal_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [key, travelA, '2026-11-27', 'lunch', 'Original meal', 'Synthetic note', 200, '12:30', JSON.stringify(initialItems)]);
  const read = db => one(db, 'select revision, snapshot from public.audit_nutrition_read_meal_v1($1,$2)', [created.meal_id, key]);
  const old = await read(observer);
  const items = old.snapshot.items.map(({ sort_order, ...item }, i) => ({
    ...item, grams: i === 0 ? 90 : 140, kcal: i === 0 ? 145 : 198,
  }));
  const edit = (rev, proposed = items, label = 'Edited meal') => one(writer,
    'select * from public.audit_nutrition_edit_meal_v1($1,$2,$3,$4,$5,$6,$7,$8)',
    [created.meal_id, key, rev, '2026-11-28', 'dinner', label, 220, JSON.stringify(proposed)]);

  await assert.rejects(edit(old.revision, [items[0], { ...items[1], grams: -1 }]), { code: '23514' });
  assert.deepEqual(await read(observer), old, 'rejected second food left neither the first update nor header visible');
  await assert.rejects(edit(old.revision, [items[0]]), { code: '22023' });
  assert.deepEqual(await read(observer), old, 'incomplete form did not delete the omitted item');

  await writer.query('begin');
  const saved = await edit(old.revision);
  assert.equal(saved.status, 'updated');
  assert.notEqual(saved.revision, old.revision);
  assert.deepEqual(await read(observer), old, 'another connection saw no uncommitted header or foods');
  await writer.query('commit');
  const actual = await read(observer);
  assert.equal(actual.revision, saved.revision);
  assert.deepEqual(actual.snapshot.header, {
    ...old.snapshot.header, meal_date: '2026-11-28', meal_type: 'dinner', label: 'Edited meal', water_ml: 220,
  });
  assert.deepEqual(actual.snapshot.items, items.map((item, i) => ({ ...item, sort_order: i })));
  assert.deepEqual(await edit(old.revision, items, 'Older form'), { status: 'conflict', revision: saved.revision });
  assert.deepEqual(await read(observer), actual, 'older form did not overwrite the committed edit');
  console.log('Nutrition edit audit: invalid second item rolls back everything; committed edition preserves IDs/order; stale forms do not overwrite.');
} finally {
  await close();
}
