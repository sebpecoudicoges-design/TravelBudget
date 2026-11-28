import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startNutritionAuditPostgres } from '../audit-nutrition/local-postgres.mjs';

const [pgBin, driverPath] = process.argv.slice(2);
if (!pgBin || !driverPath) throw Error('Provide local PostgreSQL binaries and pg module.');
const preview = await readFile(new URL('./preview.sql', import.meta.url), 'utf8');
const db = await startNutritionAuditPostgres(pgBin, driverPath);
try {
  const c = await db.connect();
  await c.query(`
    CREATE TABLE fixture_logins (id int PRIMARY KEY);
    CREATE TABLE settings (user_id int PRIMARY KEY REFERENCES fixture_logins);
    CREATE TABLE transactions (id int PRIMARY KEY, user_id int NOT NULL REFERENCES fixture_logins);
    CREATE TABLE trip_groups (id int PRIMARY KEY, user_id int REFERENCES fixture_logins);
    CREATE TABLE trip_expenses (id int PRIMARY KEY, trip_id int REFERENCES trip_groups,
      transaction_id int CONSTRAINT trip_expenses_transaction_fk REFERENCES transactions DEFERRABLE INITIALLY DEFERRED,
      amount_cents int NOT NULL);
    INSERT INTO fixture_logins VALUES (1), (2), (3), (4);
    INSERT INTO settings VALUES (1), (2), (3);
    INSERT INTO transactions VALUES (10,1), (20,2), (30,3), (31,3);
    INSERT INTO trip_groups VALUES (200,2), (300,3), (401,NULL);
    INSERT INTO trip_expenses VALUES (201,200,10,1250), (301,300,30,1500), (402,401,20,2500);
  `);
  const snapshot = async () => (await c.query(`SELECT jsonb_build_object(
    'logins',(SELECT jsonb_agg(t ORDER BY id) FROM fixture_logins t),
    'transactions',(SELECT jsonb_agg(t ORDER BY id) FROM transactions t),
    'groups',(SELECT jsonb_agg(t ORDER BY id) FROM trip_groups t),
    'expenses',(SELECT jsonb_agg(t ORDER BY id) FROM trip_expenses t),
    'settings',(SELECT jsonb_agg(t ORDER BY user_id) FROM settings t)) AS data`)).rows[0].data;
  const original = await snapshot();
  await c.query('BEGIN READ ONLY');
  for (const [account, private_transactions, protected_trip_links, own_trip_links, status] of [
    [1,1,1,0,'blocked_protected_trip'],
    [2,1,1,0,'blocked_protected_trip'],
    [3,2,0,1,'requires_full_dependency_check'],
    [4,0,0,0,'requires_full_dependency_check'],
  ]) {
    const { rows } = await c.query(preview,[account]);
    assert.deepEqual(rows,[{private_transactions,protected_trip_links,own_trip_links,status}]);
  }
  await c.query('COMMIT');
  assert.deepEqual(await snapshot(),original);
  console.log('PASS: read-only preview protects other and unowned Trip links; no false clearance.');

  // Prove that the real deferred FK aborts a single transaction, not just a mocked call.
  // All IDs and all physical storage here are created by this test.
  await c.query('BEGIN');
  await c.query('DELETE FROM settings WHERE user_id = $1',[1]);
  await c.query('DELETE FROM transactions WHERE user_id = $1',[1]);
  await assert.rejects(c.query('COMMIT'), {code:'23503', constraint:'trip_expenses_transaction_fk'});
  assert.deepEqual(await snapshot(),original);
  console.log('PASS: deferred constraint failure rolls back all earlier writes; both accounts and Trip remain intact.');

  // A normal Trip write can arrive after a preview. A preview must never be
  // treated as authorization or as an enduring claim that deletion is safe.
  const writer = await db.connect();
  await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  const early = (await c.query(preview,[3])).rows[0];
  assert.equal(early.protected_trip_links,0);
  await c.query('DELETE FROM settings WHERE user_id = $1',[3]);
  await writer.query('INSERT INTO trip_expenses VALUES ($1,$2,$3,$4)',[203,200,31,1800]);
  const { rows: [inserted] } = await writer.query('SELECT * FROM trip_expenses WHERE id = $1',[203]);
  assert.equal(inserted.amount_cents,1800);
  await c.query('DELETE FROM trip_expenses WHERE id = $1',[301]);
  await c.query('DELETE FROM transactions WHERE user_id = $1',[3]);
  await assert.rejects(c.query('COMMIT'), {code:'23503', constraint:'trip_expenses_transaction_fk'});
  assert.deepEqual(await snapshot(),{...original,expenses:[original.expenses[0],inserted,...original.expenses.slice(1)]});
  console.log('PASS: late third-party Trip change survives; all proposed reset writes roll back.');
} finally {
  await db.close();
}
