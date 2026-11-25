// Strictly isolated: this script creates an in-memory PostgreSQL instance.
// The narrow fixture supplies table shapes, not the production policies or complete schema.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.argv[2] || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
  create role authenticated; create role anon;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select current_setting('request.jwt.claim.sub',true)::uuid $$;
  create table public.wallets(id uuid primary key,user_id uuid,period_id uuid,travel_id uuid);
  create table public.trip_members(id uuid primary key,trip_id uuid,auth_user_id uuid,name text);
  create table public.trip_participants(trip_id uuid,auth_user_id uuid,role text);
  create table public.transactions(
    id uuid primary key default gen_random_uuid(), user_id uuid,wallet_id uuid,period_id uuid,travel_id uuid,
    type text,label text,amount numeric,currency text,date_start date,date_end date,budget_date_start date,budget_date_end date,
    category text,subcategory text,pay_now boolean,out_of_budget boolean,night_covered boolean,affects_budget boolean,
    trip_expense_id uuid,trip_share_link_id uuid,fx_rate_snapshot numeric,fx_source_snapshot text,fx_snapshot_at timestamptz,
    fx_base_currency_snapshot text,fx_tx_currency_snapshot text,offline_dedupe_key text,created_at timestamptz default now(),
    internal_transfer_id uuid,unique(user_id,offline_dedupe_key)
  );
  create table public.trip_settlement_events(
    id uuid primary key,trip_id uuid,currency text,amount numeric check (amount > 0),from_member_id uuid,to_member_id uuid,
    created_by uuid,cancelled_at timestamptz,transaction_id uuid references public.transactions on delete set null
  );
  `);
  const rpc = readFileSync('supabase/migrations/20260624080119_server_idempotency_sport_health_v2.sql','utf8');
  await db.exec(rpc.slice(rpc.indexOf('create or replace function public.apply_transaction_v2(')));
  await db.exec(readFileSync('supabase/migrations/20261017015741_trip_settlement_atomic.sql','utf8'));
  const id = n => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const [uid, trip, from, to, wallet, period, travel, event, otherTx] = Array.from({ length: 9 }, (_, i) => id(i + 1));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  await db.query('insert into public.wallets values($1,$2,$3,$4)',[wallet,uid,period,travel]);
  await db.query("insert into public.trip_members values($1,$3,null,'Participant B'),($2,$3,$4,'Participant A')",[from,to,trip,uid]);
  await db.query("insert into public.trip_participants values($1,$2,'owner')",[trip,uid]);
  await db.query("insert into public.transactions(id,wallet_id,user_id,type,amount,currency) values($1,$2,$3,'income',5,'AUD')",[otherTx,wallet,uid]);
  const args = [event, trip, 'EUR', 25, from, to, wallet, 'AUD', 40, '2026-10-24', {}];
  const apply = () => db.query('select public.trip_apply_settlement_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as id',args);
  const cancel = () => db.query('select public.trip_cancel_settlement_v1($1)',[event]);
  await db.exec('set role authenticated');
  assert.equal((await apply()).rows[0].id,event);
  assert.equal((await apply()).rows[0].id,event);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select e.currency trip_currency,e.amount::int trip_amount,t.currency,t.amount::int amount,t.type,t.affects_budget,t.out_of_budget from public.trip_settlement_events e join public.transactions t on t.id=e.transaction_id')).rows,[{trip_currency:'EUR',trip_amount:25,currency:'AUD',amount:40,type:'income',affects_budget:false,out_of_budget:true}]);
  await db.exec('set role authenticated');
  await cancel();
  await cancel();
  await db.exec('reset role');
  assert.deepEqual((await db.query('select id from public.transactions')).rows,[{id:otherTx}]);
  assert.deepEqual((await db.query('select cancelled_at is not null as cancelled, transaction_id from public.trip_settlement_events')).rows,[{cancelled:true,transaction_id:null}]);
} finally {
  await db.close();
}
console.log('PASS: real isolated PostgreSQL apply/retry/cancel/cancel, one wallet transaction, unrelated credit preserved.');
