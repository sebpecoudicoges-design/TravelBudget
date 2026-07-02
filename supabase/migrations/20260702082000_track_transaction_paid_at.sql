alter table public.transactions
  add column if not exists paid_at timestamptz;

comment on column public.transactions.paid_at is
  'Timestamp when a transaction first became paid; used for wallet snapshot accounting.';

update public.transactions
set paid_at = case
  when coalesce(generated_by_rule, false)
    and recurring_instance_status = 'confirmed'
    then greatest(created_at, updated_at)
  else created_at
end
where pay_now is true
  and paid_at is null;

create or replace function public.set_transaction_paid_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.pay_now is true and new.paid_at is null then
      new.paid_at := now();
    end if;
    return new;
  end if;

  if new.pay_now is true and old.pay_now is distinct from true then
    new.paid_at := now();
  elsif new.pay_now is not true then
    new.paid_at := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists transactions_set_paid_at on public.transactions;
create trigger transactions_set_paid_at
before insert or update of pay_now on public.transactions
for each row execute function public.set_transaction_paid_at();

create or replace view public.v_wallet_transactions_effect as
select
  t.id as transaction_id,
  t.user_id,
  t.period_id,
  t.wallet_id,
  w.name as wallet_name,
  w.currency as wallet_currency,
  w.balance_snapshot_at,
  t.created_at,
  t.date_start,
  t.type,
  t.amount,
  t.currency as tx_currency,
  coalesce(t.pay_now, true) as pay_now,
  coalesce(t.is_internal, false) as is_internal,
  t.out_of_budget,
  t.affects_budget,
  t.trip_expense_id,
  t.trip_share_link_id,
  case
    when not coalesce(t.pay_now, true) then false
    when coalesce(t.is_internal, false) then false
    when w.balance_snapshot_at is not null
      and coalesce(t.paid_at, t.created_at) < w.balance_snapshot_at then false
    else true
  end as included_in_wallet_balance,
  case
    when not coalesce(t.pay_now, true) then 'unpaid'::text
    when coalesce(t.is_internal, false) then 'internal'::text
    when w.balance_snapshot_at is not null
      and coalesce(t.paid_at, t.created_at) < w.balance_snapshot_at then 'pre_snapshot'::text
    else null::text
  end as exclusion_reason,
  case
    when t.type = 'income' then t.amount
    when t.type = 'expense' then -t.amount
    else 0::numeric
  end as signed_amount,
  case
    when not coalesce(t.pay_now, true) then 0::numeric
    when coalesce(t.is_internal, false) then 0::numeric
    when w.balance_snapshot_at is not null
      and coalesce(t.paid_at, t.created_at) < w.balance_snapshot_at then 0::numeric
    when t.type = 'income' then t.amount
    when t.type = 'expense' then -t.amount
    else 0::numeric
  end as effective_signed_amount,
  t.paid_at,
  coalesce(t.paid_at, t.created_at) as wallet_effective_at
from public.transactions t
join public.wallets w on w.id = t.wallet_id and w.user_id = t.user_id
where t.user_id = auth.uid()
  and w.user_id = auth.uid();

create or replace view public.v_wallet_balances as
select
  w.id as wallet_id,
  w.user_id,
  w.period_id,
  w.name as wallet_name,
  w.currency as wallet_currency,
  w.type as wallet_type,
  w.balance as baseline_balance,
  w.balance_snapshot_at,
  coalesce(sum(v.effective_signed_amount), 0::numeric) as transactions_delta,
  w.balance + coalesce(sum(v.effective_signed_amount), 0::numeric) as effective_balance,
  count(v.transaction_id) filter (where v.included_in_wallet_balance) as included_tx_count,
  count(v.transaction_id) filter (where v.exclusion_reason = 'internal') as excluded_internal_count,
  count(v.transaction_id) filter (where v.exclusion_reason = 'unpaid') as excluded_unpaid_count,
  count(v.transaction_id) filter (where v.exclusion_reason = 'pre_snapshot') as excluded_pre_snapshot_count,
  max(v.wallet_effective_at) filter (where v.included_in_wallet_balance) as last_tx_created_at
from public.wallets w
left join public.v_wallet_transactions_effect v on v.wallet_id = w.id
where w.user_id = auth.uid()
group by w.id, w.user_id, w.period_id, w.name, w.currency, w.type, w.balance, w.balance_snapshot_at;
