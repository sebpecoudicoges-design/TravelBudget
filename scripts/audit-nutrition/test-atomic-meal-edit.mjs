// Isolated PostgreSQL fixture. No app, account or remote data.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
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
  const editAs = (db, rev, proposed = items, label = 'Edited meal') => one(db,
    'select * from public.audit_nutrition_edit_meal_v1($1,$2,$3,$4,$5,$6,$7,$8)',
    [created.meal_id, key, rev, '2026-11-28', 'dinner', label, 220, JSON.stringify(proposed)]);
  const edit = (...args) => editAs(writer, ...args);

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
  const holderPid = (await one(writer, 'select pg_backend_pid() as pid')).pid;
  const waiterPid = (await one(observer, 'select pg_backend_pid() as pid')).pid;
  assert.notEqual(holderPid, waiterPid);
  async function finishWhileWaiting(task, disposition) {
    const pending = task.then(value => ({ value }), error => ({ error }));
    let blocked = false;
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const status = await one(admin, 'select $2::int = any(pg_blocking_pids($1)) as blocked', [waiterPid, holderPid]);
        if (status.blocked) { blocked = true; break; }
        await delay(20);
      }
    } finally {
      await writer.query(blocked && disposition === 'commit' ? 'commit' : 'rollback');
    }
    const outcome = await pending;
    if (outcome.error) throw outcome.error;
    assert.equal(blocked, true, 'PostgreSQL should report blocking on the other authenticated session');
    return outcome.value;
  }
  const amended = grams => [{ ...items[0], grams }, items[1]];
  for (const disposition of ['commit', 'rollback']) {
    const before = await read(observer);
    const firstGrams = disposition === 'commit' ? 101 : 103;
    const laterGrams = disposition === 'commit' ? 102 : 104;
    await writer.query('begin');
    const first = await edit(before.revision, amended(firstGrams), 'First form');
    assert.equal(first.status, 'updated');
    const second = await finishWhileWaiting(
      editAs(observer, before.revision, amended(laterGrams), 'Second form'), disposition,
    );
    const after = await read(observer);
    assert.equal(after.revision, second.revision);
    if (disposition === 'commit') {
      assert.deepEqual(second, { status: 'conflict', revision: first.revision });
      assert.equal(after.snapshot.header.label, 'First form');
      assert.equal(after.snapshot.items[0].grams, firstGrams);
    } else {
      assert.equal(second.status, 'updated');
      assert.equal(after.snapshot.header.label, 'Second form');
      assert.equal(after.snapshot.items[0].grams, laterGrams);
    }
  }

  for (const disposition of ['commit', 'rollback']) {
    const before = await read(observer);
    await writer.query('begin');
    const direct = await writer.query(
      'update public.nutrition_meal_items set grams = $2 where id = $1 and meal_id = $3 and user_id = $4',
      [items[1].id, 151, created.meal_id, userA],
    );
    assert.equal(direct.rowCount, 1);
    const proposed = [
      { ...items[0], grams: 110 },
      { ...items[1], grams: disposition === 'rollback' ? 152 : 140 },
    ];
    const full = await finishWhileWaiting(editAs(observer, before.revision, proposed, 'Whole meal'), disposition);
    const after = await read(observer);
    assert.equal(full.revision, after.revision);
    if (disposition === 'commit') {
      assert.equal(full.status, 'conflict');
      assert.deepEqual(after.snapshot.header, before.snapshot.header);
      assert.deepEqual(after.snapshot.items, [before.snapshot.items[0], { ...before.snapshot.items[1], grams: 151 }]);
    } else {
      assert.equal(full.status, 'updated');
      assert.equal(after.snapshot.header.label, 'Whole meal');
      assert.deepEqual(after.snapshot.items, proposed.map((item, i) => ({ ...item, sort_order: i })));
    }
  }
  const replay = (syncId, contents) => one(writer,
    'select * from public.audit_nutrition_create_meal_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [syncId, null, '2026-11-27', 'meal', 'Synthetic portion', null, 0, null, JSON.stringify(contents)]);
  const portion = await replay('one-portion', [initialItems[0]]);
  const removedItem = await writer.query('delete from public.nutrition_meal_items where meal_id = $1 and user_id = $2',
    [portion.meal_id, userA]);
  assert.equal(removedItem.rowCount, 1);
  assert.deepEqual(await replay('one-portion', [initialItems[0]]), {
    meal_id: portion.meal_id, status: 'conflict',
  });
  const afterPortion = await one(observer,
    'select snapshot from public.audit_nutrition_read_meal_v1($1,$2)', [portion.meal_id, 'one-portion']);
  assert.deepEqual(afterPortion.snapshot.items, [], 'replay does not re-add an intentionally removed last food');
  assert.equal((await replay('hydration-without-items', [])).status, 'created');

  const beforeDelete = await read(observer);
  const removedMeal = await writer.query('delete from public.nutrition_meals where id = $1 and user_id = $2',
    [created.meal_id, userA]);
  assert.equal(removedMeal.rowCount, 1);
  assert.deepEqual(await editAs(observer, beforeDelete.revision), { status: 'unavailable', revision: null });
  assert.equal(await read(observer), undefined, 'the edit never creates a missing meal');
  const remaining = await one(observer, 'select count(*)::int as n from public.nutrition_meal_items where meal_id = $1',
    [created.meal_id]);
  assert.equal(remaining.n, 0);
  console.log('Nutrition edit audit: rollback, concurrent edits, last-food removal and missing meal verified on PostgreSQL.');
} finally {
  await close();
}
