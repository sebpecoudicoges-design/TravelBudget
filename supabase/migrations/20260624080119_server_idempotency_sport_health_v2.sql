alter table public.transactions
  add column if not exists offline_dedupe_key text;

create unique index if not exists transactions_user_offline_dedupe_key_uidx
  on public.transactions(user_id, offline_dedupe_key);

alter table public.nutrition_meals
  add column if not exists sync_id text;

update public.nutrition_meals
set sync_id = substring(notes from 'tb_sync:([A-Za-z0-9_-]+)')
where sync_id is null
  and notes ~ 'tb_sync:[A-Za-z0-9_-]+';

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, sync_id
      order by created_at asc, id asc
    ) as rn
  from public.nutrition_meals
  where sync_id is not null
)
update public.nutrition_meals nm
set sync_id = null
from ranked r
where nm.id = r.id
  and r.rn > 1;

create unique index if not exists nutrition_meals_user_sync_id_uidx
  on public.nutrition_meals(user_id, sync_id);

create or replace function public.apply_transaction_v2(
  p_wallet_id uuid,
  p_type text,
  p_label text,
  p_amount numeric,
  p_currency text,
  p_date_start date,
  p_date_end date,
  p_category text,
  p_subcategory text default null,
  p_pay_now boolean default false,
  p_out_of_budget boolean default false,
  p_night_covered boolean default false,
  p_affects_budget boolean default true,
  p_trip_expense_id uuid default null,
  p_trip_share_link_id uuid default null,
  p_fx_rate_snapshot numeric default null,
  p_fx_source_snapshot text default null,
  p_fx_snapshot_at timestamptz default null,
  p_fx_base_currency_snapshot text default null,
  p_fx_tx_currency_snapshot text default null,
  p_user_id uuid default null,
  p_budget_date_start date default null,
  p_budget_date_end date default null,
  p_offline_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_period_id uuid;
  v_travel_id uuid;
  v_id uuid;
  v_type text := lower(trim(coalesce(p_type, '')));
  v_dedupe_key text := nullif(trim(coalesce(p_offline_dedupe_key, '')), '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is not null and p_user_id <> v_user_id then
    raise exception 'Invalid user context';
  end if;

  if v_type not in ('expense', 'income') then
    raise exception 'Invalid transaction type';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if p_date_start is null then
    raise exception 'Transaction date is required';
  end if;

  if p_date_end is not null and p_date_end < p_date_start then
    raise exception 'Transaction end date must be after start date';
  end if;

  if p_budget_date_start is not null
     and p_budget_date_end is not null
     and p_budget_date_end < p_budget_date_start then
    raise exception 'Budget end date must be after budget start date';
  end if;

  if nullif(trim(coalesce(p_currency, '')), '') is null then
    raise exception 'Currency is required';
  end if;

  if nullif(trim(coalesce(p_category, '')), '') is null then
    raise exception 'Category is required';
  end if;

  if v_dedupe_key is not null then
    select id into v_id
    from public.transactions
    where user_id = v_user_id
      and offline_dedupe_key = v_dedupe_key
    order by created_at desc
    limit 1;

    if v_id is not null then
      return v_id;
    end if;
  end if;

  select w.period_id, w.travel_id
    into v_period_id, v_travel_id
  from public.wallets w
  where w.id = p_wallet_id
    and w.user_id = v_user_id;

  if v_period_id is null then
    raise exception 'Wallet not found or not owned';
  end if;

  insert into public.transactions (
    user_id, wallet_id, period_id, travel_id,
    type, label, amount, currency,
    date_start, date_end,
    budget_date_start, budget_date_end,
    category, subcategory,
    pay_now, out_of_budget, night_covered,
    affects_budget,
    trip_expense_id, trip_share_link_id,
    fx_rate_snapshot, fx_source_snapshot, fx_snapshot_at,
    fx_base_currency_snapshot, fx_tx_currency_snapshot,
    offline_dedupe_key
  ) values (
    v_user_id, p_wallet_id, v_period_id, v_travel_id,
    v_type, p_label, p_amount, upper(trim(p_currency)),
    p_date_start, coalesce(p_date_end, p_date_start),
    coalesce(p_budget_date_start, p_date_start),
    coalesce(p_budget_date_end, p_budget_date_start, p_date_end, p_date_start),
    trim(p_category), nullif(trim(coalesce(p_subcategory, '')), ''),
    p_pay_now, p_out_of_budget, p_night_covered,
    coalesce(p_affects_budget, not coalesce(p_out_of_budget, false)),
    nullif(p_trip_expense_id, '00000000-0000-0000-0000-000000000000'::uuid),
    nullif(p_trip_share_link_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_fx_rate_snapshot, p_fx_source_snapshot, p_fx_snapshot_at,
    p_fx_base_currency_snapshot, p_fx_tx_currency_snapshot,
    v_dedupe_key
  )
  on conflict (user_id, offline_dedupe_key) do update
    set offline_dedupe_key = excluded.offline_dedupe_key
  returning id into v_id;

  return v_id;
end;
$function$;
