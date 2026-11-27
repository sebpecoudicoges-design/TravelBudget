// Audit-only synthetic catalog and normal wallet journal journey.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startNutritionAuditPostgres } from '../audit-nutrition/local-postgres.mjs';

const [pgBin, driverPath] = process.argv.slice(2);
if (!pgBin || !driverPath) throw new Error('Usage: node test-reconciliation-contract.mjs PG_BIN_DIR PG_NODE_MODULE');
const db = await startNutritionAuditPostgres(pgBin, driverPath);
const [account, wallet, transaction] = [1, 2, 3].map(n => 'a4110000-0000-4000-8000-' + String(n).padStart(12, '0'));
const date = '2026-11-01T12:00:00+00:00';
const signature = 'public.set_wallet_transaction_reconciliation(uuid,boolean,timestamptz)';
try {
  const owner = await db.connect();
  await owner.query(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    create table public.wallets(id uuid primary key, user_id uuid not null references auth.users);
    create table public.transactions(
      id uuid primary key, user_id uuid not null references auth.users,
      wallet_id uuid references public.wallets, updated_at timestamptz,
      pay_now boolean not null, is_internal boolean not null
    );
    alter table public.wallets enable row level security;
    alter table public.transactions enable row level security;
    grant select on public.wallets to authenticated;
    grant select, update on public.transactions to authenticated;
    create policy own_wallet on public.wallets for select to authenticated using (user_id = auth.uid());
    create policy own_tx on public.transactions for all to authenticated using (user_id = auth.uid());
  `);
  await owner.query('insert into auth.users values ($1)', [account]);
  await owner.query('insert into public.wallets values ($1,$2)', [wallet, account]);
  await owner.query('insert into public.transactions values ($1,$2,$3,$4,true,false)', [transaction, account, wallet, date]);
  await owner.query(await readFile(new URL('../../supabase/migrations/20261030082844_wallet_transaction_reconciliation.sql', import.meta.url), 'utf8'));

  const catalog = (await owner.query(`select not p.prosecdef as invoker,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anonymous,
      exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute,
      (select relrowsecurity from pg_class where oid = 'public.wallet_transaction_reconciliation'::regclass) as rls
      from pg_proc p where p.oid = $1::regprocedure`, [signature])).rows[0];
  assert.deepEqual(catalog, { invoker: true, authenticated: true, anonymous: false, public_execute: false, rls: true });

  const journal = await db.connect();
  await journal.query('set role authenticated');
  await journal.query("select set_config('request.jwt.claim.sub',$1,false)", [account]);
  const clientAction = async reconciled => (await journal.query(
    'select public.set_wallet_transaction_reconciliation($1,$2,$3) as marker', [transaction, reconciled, date],
  )).rows[0].marker;
  const marked = await clientAction(true);
  assert.equal(marked.transaction_id, transaction);
  assert.equal(marked.wallet_id, wallet);
  assert.equal(marked.user_id, account);
  assert.equal(new Date(marked.transaction_updated_at).getTime(), new Date(date).getTime());
  assert.equal((await journal.query('select transaction_id from public.wallet_transaction_reconciliation')).rows.length, 1);
  assert.equal(await clientAction(false), null);
  assert.equal((await journal.query('select transaction_id from public.wallet_transaction_reconciliation')).rows.length, 0);
  assert.deepEqual((await journal.query('select id from public.transactions')).rows, [{ id: transaction }]);
  console.log('Wallet reconciliation: migration catalog, authenticated mark/unmark and unchanged transaction verified.');
} finally {
  await db.close();
}
