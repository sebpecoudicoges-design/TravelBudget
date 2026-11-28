// Disposable PostgreSQL fixture only. Nothing in this file is a deployment artifact.
import assert from 'node:assert/strict';
import { startNutritionAuditPostgres } from '../audit-nutrition/local-postgres.mjs';

const [pgBin, driverPath] = process.argv.slice(2);
if (!pgBin || !driverPath) throw Error('Provide local PostgreSQL binaries and pg module.');
const db = await startNutritionAuditPostgres(pgBin, driverPath);
try {
  const c = await db.connect();
  await c.query(`
  CREATE TABLE account (id int PRIMARY KEY);
  CREATE TABLE wallet (id int PRIMARY KEY, owner int NOT NULL REFERENCES account);
  CREATE TABLE txn (id int PRIMARY KEY, owner int NOT NULL REFERENCES account,
      wallet_id int NOT NULL REFERENCES wallet);
  CREATE TABLE trip (id int PRIMARY KEY, owner int NOT NULL REFERENCES account);
  CREATE TABLE member (trip_id int REFERENCES trip, account_id int REFERENCES account,
      PRIMARY KEY(trip_id,account_id));
  CREATE TABLE expense (trip_id int REFERENCES trip, author int NOT NULL REFERENCES account,
      txn_id int CONSTRAINT protected_txn REFERENCES txn DEFERRABLE INITIALLY DEFERRED);
  CREATE TABLE pre_txn_rows (owner int REFERENCES account, kind text, PRIMARY KEY(owner,kind));
  CREATE TABLE preferences (owner int PRIMARY KEY REFERENCES account);
  CREATE TABLE categories (owner int PRIMARY KEY REFERENCES account);
  CREATE TABLE mappings (owner int PRIMARY KEY REFERENCES account);
  CREATE TABLE extra_dependency (txn_id int CONSTRAINT late_dependency REFERENCES txn
      DEFERRABLE INITIALLY DEFERRED);
  INSERT INTO account VALUES (1),(2),(3),(4),(5),(6),(7),(8);
  INSERT INTO wallet SELECT id,id FROM account;
  INSERT INTO txn SELECT id,id,id FROM account;
  INSERT INTO trip SELECT id,id FROM account;
  INSERT INTO member SELECT id,id FROM account;
  INSERT INTO member VALUES (3,2),(5,2);
  INSERT INTO expense VALUES (2,2,4),(2,2,6),(3,2,3),(5,2,5);
  INSERT INTO pre_txn_rows SELECT id,kind FROM account CROSS JOIN
    unnest(ARRAY['attachment-links','document','folder','inbox','sport','asset']) AS kind;
  INSERT INTO preferences SELECT id FROM account;
  INSERT INTO categories SELECT id FROM account;
  INSERT INTO mappings SELECT id FROM account;
  INSERT INTO extra_dependency VALUES (7),(8);
  `);

  const snapshot=async()=> (await c.query(`SELECT jsonb_build_object(
    'accounts',(SELECT jsonb_agg(t ORDER BY id) FROM account t),
    'wallets',(SELECT jsonb_agg(t ORDER BY id) FROM wallet t),
    'transactions',(SELECT jsonb_agg(t ORDER BY id) FROM txn t),
    'trips',(SELECT jsonb_agg(t ORDER BY id) FROM trip t),
    'members',(SELECT jsonb_agg(t ORDER BY trip_id,account_id) FROM member t),
    'expenses',(SELECT jsonb_agg(t ORDER BY trip_id,author,txn_id) FROM expense t),
    'before_txn',(SELECT jsonb_agg(t ORDER BY owner,kind) FROM pre_txn_rows t),
    'preferences',(SELECT jsonb_agg(t ORDER BY owner) FROM preferences t),
    'categories',(SELECT jsonb_agg(t ORDER BY owner) FROM categories t),
    'mappings',(SELECT jsonb_agg(t ORDER BY owner) FROM mappings t),
    'deps',(SELECT jsonb_agg(t ORDER BY txn_id) FROM extra_dependency t)) obj`)).rows[0].obj;

  async function simulateReset(target,mode){
    assert.ok(['travel','all'].includes(mode));
    await c.query('BEGIN');
    try {
      // Test harness only: serialize synthetic writes for a deterministic scope
      // test. This is not a proposed broad lock for the hosted app.
      await c.query('LOCK TABLE txn, trip, member, expense IN SHARE ROW EXCLUSIVE MODE');
      const {rows:[guard]}=await c.query(`SELECT EXISTS (
        SELECT 1 FROM trip g JOIN member m ON m.trip_id=g.id
         WHERE g.owner=$1 AND m.account_id<>$1
        UNION ALL
        SELECT 1 FROM expense e JOIN trip g ON g.id=e.trip_id
         LEFT JOIN txn t ON t.id=e.txn_id
         WHERE (g.owner=$1 AND (e.author<>$1 OR (t.owner IS NOT NULL AND t.owner<>$1)))
            OR (g.owner<>$1 AND (t.owner=$1 OR e.author=$1))
      ) AS shared`,[target]);
      if (guard.shared) { await c.query('ROLLBACK'); return 'blocked_shared'; }
      await c.query('DELETE FROM pre_txn_rows WHERE owner=$1',[target]);
      await c.query('DELETE FROM expense WHERE trip_id IN (SELECT id FROM trip WHERE owner=$1)',[target]);
      await c.query('DELETE FROM member WHERE trip_id IN (SELECT id FROM trip WHERE owner=$1)',[target]);
      await c.query('DELETE FROM trip WHERE owner=$1',[target]);
      await c.query('DELETE FROM txn WHERE owner=$1',[target]);
      await c.query('DELETE FROM wallet WHERE owner=$1',[target]);
      if(mode==='all') {
        await c.query('DELETE FROM preferences WHERE owner=$1',[target]);
        await c.query('DELETE FROM categories WHERE owner=$1',[target]);
        await c.query('DELETE FROM mappings WHERE owner=$1',[target]);
      }
      await c.query('COMMIT');
      return 'committed';
    } catch(error) {
      await c.query('ROLLBACK');
      throw error;
    }
  }

  const initial=await snapshot();
  for (const [target, mode] of [[3,'travel'],[4,'travel'],[5,'all'],[6,'all']]){
    assert.equal(await simulateReset(target,mode),'blocked_shared');
    assert.deepEqual(await snapshot(),initial);
  }
  console.log('PASS both modes: shared owned Trips and links into other Trips are blocked without changes.');
  for (const [target, mode] of [[7,'travel'],[8,'all']]){
    await assert.rejects(simulateReset(target,mode), {code:'23503',constraint:'late_dependency'});
    assert.deepEqual(await snapshot(),initial);
  }
  console.log('PASS both modes: a late FK failure restores every changed fixture row and preserves all logins.');
  assert.equal(await simulateReset(1,'travel'),'committed');
  const travel=await snapshot();
  const removed=(state,target,mode)=>Object.fromEntries(Object.entries(state).map(([key,rows])=>{
    const scope={wallets:'owner',transactions:'owner',trips:'owner',members:'trip_id',before_txn:'owner',
      ...(mode==='all'?{preferences:'owner',categories:'owner',mappings:'owner'}:{})};
    return [key, scope[key]?rows.filter(r=>r[scope[key]]!==target):rows];
  }));
  assert.deepEqual(travel,removed(initial,1,'travel'));
  // Seed a further private case so the first successful run cannot mask differences.
  await c.query(`INSERT INTO account VALUES (9); INSERT INTO wallet VALUES (9,9);
    INSERT INTO txn VALUES (9,9,9); INSERT INTO trip VALUES(9,9); INSERT INTO member VALUES(9,9);
    INSERT INTO pre_txn_rows VALUES(9,'inbox'); INSERT INTO preferences VALUES(9);
    INSERT INTO categories VALUES(9); INSERT INTO mappings VALUES(9);`);
  const beforeAll=await snapshot();
  assert.equal(await simulateReset(9,'all'),'committed');
  assert.deepEqual(await snapshot(),removed(beforeAll,9,'all'));
  console.log('PASS private success: travel retains preferences/categories/mappings; all removes those rows but keeps login; unrelated rows are identical.');
} finally {
  await db.close();
}
