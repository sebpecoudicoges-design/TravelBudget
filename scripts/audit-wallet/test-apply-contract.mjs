// Audit-only synthetic catalog and normal Wallet creation/retry.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startNutritionAuditPostgres } from '../audit-nutrition/local-postgres.mjs';
import { buildApplyTransactionV2Args } from '../../src/core/transactionRpcPayload.js';

const [pgBin, driverPath] = process.argv.slice(2);
if (!pgBin || !driverPath) throw new Error('Usage: node test-apply-contract.mjs PG_BIN_DIR PG_NODE_MODULE');
const migration = async name => readFile(new URL('../../supabase/migrations/' + name + '.sql', import.meta.url), 'utf8');
const [account, wallet, period, travel] = [1, 2, 3, 4].map(n => 'a4110000-0000-4000-8000-' + String(n).padStart(12, '0'));
const db = await startNutritionAuditPostgres(pgBin, driverPath);
try {
  const owner = await db.connect();
  await owner.query(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.wallets(id uuid primary key, user_id uuid not null, period_id uuid not null, travel_id uuid);
    create table public.transactions(
      id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
      user_id uuid not null, wallet_id uuid not null references public.wallets, period_id uuid not null, travel_id uuid,
      type text, label text, amount numeric, currency text, date_start date, date_end date,
      budget_date_start date, budget_date_end date, category text, subcategory text,
      pay_now boolean, out_of_budget boolean, night_covered boolean, affects_budget boolean,
      trip_expense_id uuid, trip_share_link_id uuid, fx_rate_snapshot numeric, fx_source_snapshot text,
      fx_snapshot_at timestamptz, fx_base_currency_snapshot text, fx_tx_currency_snapshot text
    );
    create table public.nutrition_meals(id uuid primary key, user_id uuid, notes text, created_at timestamptz);
    create table public.nutrition_foods(
      key text primary key, user_id uuid, name text, serving_grams numeric, kcal_per_100g numeric,
      protein_per_100g numeric, carbs_per_100g numeric, fat_per_100g numeric, fiber_per_100g numeric,
      water_ml_per_100g numeric, tags text[], is_active boolean, updated_at timestamptz
    );
  `);
  await owner.query('insert into public.wallets values ($1,$2,$3,$4)', [wallet, account, period, travel]);
  await owner.query(await migration('20260605065638_harden_transaction_wallet_rpcs'));
  await owner.query(await migration('20260624080119_server_idempotency_sport_health_v2'));
  const overloads = async () => (await owner.query(`select p.pronargs, p.pronargdefaults, p.proargnames, p.prosecdef,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
      has_function_privilege('service_role', p.oid, 'EXECUTE') as service,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anonymous,
      exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'apply_transaction_v2' order by p.pronargs`)).rows;
  assert.deepEqual((await overloads()).map(row => row.pronargs), [23, 24]);
  await owner.query(await migration('20260624082449_restrict_apply_transaction_v2_idempotent_execute'));
  await owner.query(await migration('20260627225157_fix_trip_rpc_mobile_online_and_photo_foods'));
  const [{ proargnames, ...acl }] = await overloads();
  assert.equal((await overloads()).length, 1);
  assert.deepEqual(acl, { pronargs: 24, pronargdefaults: 16, prosecdef: true,
    authenticated: true, service: true, anonymous: false, public_execute: false });

  const client = await db.connect();
  await client.query('set role authenticated');
  await client.query("select set_config('request.jwt.claim.sub',$1,false)", [account]);
  const day = '2026-11-25';
  const args = buildApplyTransactionV2Args({
    walletId: wallet, type: 'expense', label: 'Train audit synthétique', amount: 12.50,
    currency: 'EUR', cashDate: day, category: 'Transport', payNow: true, offlineDedupeKey: 'synthetic-wallet-1',
  }, { userId: account, fxArgs: {
    p_fx_rate_snapshot: null, p_fx_source_snapshot: null, p_fx_snapshot_at: null,
    p_fx_base_currency_snapshot: null, p_fx_tx_currency_snapshot: null,
  } });
  assert.deepEqual(Object.keys(args).sort(), [...proargnames].sort());
  const create = async values => {
    const keys = proargnames.filter(key => Object.hasOwn(values, key));
    const parameters = keys.map((key, i) => key + ' => $' + (i + 1)).join(', ');
    return (await client.query('select public.apply_transaction_v2(' + parameters + ') as id',
      keys.map(key => values[key]))).rows[0].id;
  };
  const first = await create(args);
  assert.equal(await create(args), first);
  // The ordinary historical form can omit the final (defaulted) argument.
  const { p_offline_dedupe_key: _key, ...withoutKey } = args;
  const second = await create({ ...withoutKey, p_label: 'Billet distinct' });
  assert.notEqual(second, first);
  const rows = (await owner.query(`select id, label, amount::text, user_id, wallet_id, period_id, travel_id,
    offline_dedupe_key from transactions order by label collate "C"`)).rows;
  assert.deepEqual(rows, [
    { id: second, label: 'Billet distinct', amount: '12.5', user_id: account, wallet_id: wallet,
      period_id: period, travel_id: travel, offline_dedupe_key: null },
    { id: first, label: args.p_label, amount: '12.5', user_id: account, wallet_id: wallet,
      period_id: period, travel_id: travel, offline_dedupe_key: args.p_offline_dedupe_key },
  ]);
  console.log('Wallet creation: versioned overload retirement, catalog permissions, named arguments and normal retry verified.');
} finally {
  await db.close();
}
