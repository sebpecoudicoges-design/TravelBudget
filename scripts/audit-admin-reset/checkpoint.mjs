// Disposable fixture: this does not reset an account, call Storage, or run a worker.
import assert from 'node:assert/strict';
import { startNutritionAuditPostgres } from '../audit-nutrition/local-postgres.mjs';

const [pgBin, driver] = process.argv.slice(2);
if (!pgBin || !driver) throw Error('Provide local PostgreSQL binaries and pg module.');
const db = await startNutritionAuditPostgres(pgBin, driver);
try {
  const writer = await db.connect();
  const observer = await db.connect();
  await writer.query(`
    CREATE TABLE fixture_account (id int PRIMARY KEY);
    CREATE TABLE fixture_metadata (
      id int PRIMARY KEY,
      account int NOT NULL CONSTRAINT fixture_owner REFERENCES fixture_account
        DEFERRABLE INITIALLY DEFERRED,
      reset_marked boolean NOT NULL DEFAULT false
    );
    CREATE TABLE fixture_receipt (
      request text PRIMARY KEY,
      account int NOT NULL REFERENCES fixture_account,
      sql_state text NOT NULL CHECK (sql_state = 'committed')
    );
    CREATE TABLE fixture_pending_object (
      request text NOT NULL REFERENCES fixture_receipt,
      bucket text NOT NULL,
      object_key text NOT NULL,
      observed_identity text NOT NULL,
      PRIMARY KEY (request, bucket, object_key)
    );
    INSERT INTO fixture_account VALUES (1),(2);
    INSERT INTO fixture_metadata (id, account) VALUES (11,1),(21,2);
  `);

  const snapshot = async client => (await client.query(`
    SELECT jsonb_build_object(
      'metadata', (SELECT jsonb_agg(t ORDER BY id) FROM fixture_metadata t),
      'receipts', (SELECT coalesce(jsonb_agg(t ORDER BY request), '[]'::jsonb) FROM fixture_receipt t),
      'pending', (SELECT coalesce(jsonb_agg(t ORDER BY request), '[]'::jsonb) FROM fixture_pending_object t),
      'accounts', (SELECT array_agg(id ORDER BY id) FROM fixture_account)
    ) AS snapshot
  `)).rows[0].snapshot;
  const clean = await snapshot(observer);

  async function stage(request) {
    await writer.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await writer.query('UPDATE fixture_metadata SET reset_marked = true WHERE account = $1', [1]);
    await writer.query("INSERT INTO fixture_receipt VALUES ($1,$2,'committed')", [request, 1]);
    await writer.query('INSERT INTO fixture_pending_object VALUES ($1,$2,$3,$4)',
      [request, 'fixture-bucket', 'account-1/document-1', 'fixture-identity-1']);
  }

  await stage('rolled-back');
  assert.equal((await snapshot(writer)).pending.length, 1);
  assert.deepEqual(await snapshot(observer), clean, 'a second connection cannot act before commit');
  await writer.query('UPDATE fixture_metadata SET account = 99 WHERE id = 11');
  await assert.rejects(writer.query('COMMIT'), { code: '23503', constraint: 'fixture_owner' });
  assert.deepEqual(await snapshot(observer), clean, 'failed commit must expose neither mark, receipt nor cleanup');

  await stage('committed-once');
  assert.deepEqual(await snapshot(observer), clean);
  await writer.query('COMMIT');
  // The caller is no longer consulted. A fresh connection simulates recovery
  // after committing SQL but losing its reply before any external action.
  const resumed = await db.connect();
  assert.deepEqual(await snapshot(resumed), {
    accounts: [1, 2],
    metadata: [{ id: 11, account: 1, reset_marked: true }, clean.metadata[1]],
    receipts: [{ request: 'committed-once', account: 1, sql_state: 'committed' }],
    pending: [{
      request: 'committed-once', bucket: 'fixture-bucket',
      object_key: 'account-1/document-1', observed_identity: 'fixture-identity-1',
    }],
  });
  console.log('PASS: the checkpoint and exact object manifest are invisible before commit, absent after rollback, and recoverable from a new connection after commit. The neighboring account is unchanged.');
} finally {
  await db.close();
}
