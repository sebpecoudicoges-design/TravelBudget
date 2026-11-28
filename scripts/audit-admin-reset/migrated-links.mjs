// Tests two unchanged repository migrations on local, synthetic prerequisites.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startNutritionAuditPostgres } from '../audit-nutrition/local-postgres.mjs';

const [pgBin, driver] = process.argv.slice(2);
if (!pgBin || !driver) throw Error('Provide local PostgreSQL binaries and pg module.');
const db = await startNutritionAuditPostgres(pgBin, driver);
try {
  const c = await db.connect();
  await c.query(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
    CREATE TABLE public.wallets (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users);
    CREATE TABLE public.transactions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users,
      wallet_id uuid NOT NULL REFERENCES public.wallets, updated_at timestamptz,
      pay_now boolean, is_internal boolean);
    CREATE TABLE public.assets (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users);
    CREATE TABLE public.trip_expenses (id uuid PRIMARY KEY, trip_id uuid NOT NULL);
    CREATE TABLE public.trip_members (trip_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES auth.users);
  `);
  for (const file of ['20260712004235_asset_transaction_links_budget_policy.sql','20261030082844_wallet_transaction_reconciliation.sql']) {
    await c.query(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
  }
  const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0');
  for (const [user,wallet,txn,asset,link] of [[1,11,21,31,41],[2,12,22,32,42]]) {
    await c.query('INSERT INTO auth.users VALUES ($1)',[id(user)]);
    await c.query('INSERT INTO wallets VALUES ($1,$2)',[id(wallet),id(user)]);
    await c.query('INSERT INTO transactions (id,user_id,wallet_id) VALUES ($1,$2,$3)',[id(txn),id(user),id(wallet)]);
    await c.query('INSERT INTO assets VALUES ($1,$2)',[id(asset),id(user)]);
    await c.query('INSERT INTO asset_transaction_links (id,user_id,asset_id,transaction_id) VALUES ($1,$2,$3,$4)',[id(link),id(user),id(asset),id(txn)]);
    await c.query('INSERT INTO wallet_transaction_reconciliation (transaction_id,user_id,wallet_id) VALUES ($1,$2,$3)',[id(txn),id(user),id(wallet)]);
  }

  async function snapshot(owner) {
    const keys = ['wallets','transactions','assets','asset_transaction_links','wallet_transaction_reconciliation'];
    const tx = {};
    for (const key of keys) tx[key]=(await c.query('SELECT * FROM '+key+' WHERE user_id=$1',[owner])).rows;
    const {rows:accounts}=await c.query('SELECT id FROM auth.users ORDER BY id');
    return {...tx,accounts};
  }

  const a=await snapshot(id(1)), b=await snapshot(id(2));
  await c.query('BEGIN');
  await c.query('DELETE FROM wallet_transaction_reconciliation WHERE user_id=$1',[id(1)]);
  await assert.rejects(c.query('DELETE FROM transactions WHERE user_id=$1',[id(1)]),
    {code:'23514',constraint:'asset_transaction_links_target_chk'});
  await c.query('ROLLBACK');
  assert.deepEqual(await snapshot(id(1)),a);
  assert.deepEqual(await snapshot(id(2)),b);
  console.log('PASS current asset migration: a transaction-only asset link prevents deleting the transaction; earlier reconciliation change rolls back.');

  await c.query('BEGIN');
  await c.query('DELETE FROM assets WHERE user_id=$1',[id(1)]);
  await c.query('DELETE FROM transactions WHERE user_id=$1',[id(1)]);
  await c.query('DELETE FROM wallets WHERE user_id=$1',[id(1)]);
  await c.query('COMMIT');
  assert.deepEqual(await snapshot(id(2)),b);
  assert.deepEqual(await snapshot(id(1)),{wallets:[],transactions:[],assets:[],asset_transaction_links:[],wallet_transaction_reconciliation:[],accounts:a.accounts});
  console.log('PASS current cascades for a strictly private fixture: asset links and reconciliations are removed; login and second account remain unchanged.');
} finally {
  await db.close();
}
