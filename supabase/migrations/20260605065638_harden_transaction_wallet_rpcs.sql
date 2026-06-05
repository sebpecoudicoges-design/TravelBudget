-- Harden browser-callable transaction RPCs against forged user ids and direct
-- mutation of internal transfer rows. Transfer rows must be managed through
-- create/delete_wallet_transfer_v1 to keep paired transactions consistent.

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
  p_budget_date_end date default null
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
    fx_base_currency_snapshot, fx_tx_currency_snapshot
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
    p_fx_base_currency_snapshot, p_fx_tx_currency_snapshot
  )
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.update_transaction_v2(
  p_id uuid,
  p_wallet_id uuid,
  p_type text,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_label text,
  p_date_start date,
  p_date_end date,
  p_pay_now boolean default false,
  p_out_of_budget boolean default false,
  p_night_covered boolean default false,
  p_user_id uuid default null,
  p_subcategory text default null,
  p_trip_expense_id uuid default null,
  p_trip_share_link_id uuid default null,
  p_fx_rate_snapshot numeric default null,
  p_fx_source_snapshot text default null,
  p_fx_snapshot_at timestamptz default null,
  p_fx_base_currency_snapshot text default null,
  p_fx_tx_currency_snapshot text default null,
  p_budget_date_start date default null,
  p_budget_date_end date default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_existing public.transactions%rowtype;
  v_period_id uuid;
  v_new_status text;
  v_type text := lower(trim(coalesce(p_type, '')));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is not null and p_user_id <> v_user_id then
    raise exception 'Invalid user context';
  end if;

  select *
    into v_existing
  from public.transactions
  where id = p_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Transaction introuvable';
  end if;

  if v_existing.internal_transfer_id is not null then
    raise exception 'Internal transfer transactions must be edited through wallet transfer actions';
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

  select w.period_id
    into v_period_id
  from public.wallets w
  where w.id = p_wallet_id
    and w.user_id = v_user_id;

  if v_period_id is null then
    raise exception 'Wallet invalide';
  end if;

  v_new_status := v_existing.recurring_instance_status;

  if coalesce(v_existing.generated_by_rule, false) then
    if coalesce(p_pay_now, false) then
      v_new_status := 'confirmed';
    elsif coalesce(v_existing.recurring_instance_status, 'generated') = 'confirmed' then
      v_new_status := 'generated';
    elsif v_new_status is null then
      v_new_status := 'generated';
    end if;
  end if;

  update public.transactions t
  set wallet_id = p_wallet_id,
      period_id = v_period_id,
      type = v_type,
      amount = p_amount,
      currency = upper(trim(p_currency)),
      category = trim(p_category),
      subcategory = nullif(trim(coalesce(p_subcategory, '')), ''),
      label = p_label,
      date_start = p_date_start,
      date_end = coalesce(p_date_end, p_date_start),
      budget_date_start = coalesce(p_budget_date_start, p_date_start),
      budget_date_end = coalesce(p_budget_date_end, p_budget_date_start, p_date_end, p_date_start),
      pay_now = p_pay_now,
      out_of_budget = p_out_of_budget,
      night_covered = p_night_covered,
      affects_budget = case
        when p_out_of_budget then false
        else coalesce(t.affects_budget, true)
      end,
      trip_expense_id = p_trip_expense_id,
      trip_share_link_id = p_trip_share_link_id,
      recurring_instance_status = v_new_status,
      fx_rate_snapshot = coalesce(t.fx_rate_snapshot, p_fx_rate_snapshot),
      fx_source_snapshot = coalesce(t.fx_source_snapshot, p_fx_source_snapshot),
      fx_snapshot_at = coalesce(t.fx_snapshot_at, p_fx_snapshot_at),
      fx_base_currency_snapshot = coalesce(t.fx_base_currency_snapshot, p_fx_base_currency_snapshot),
      fx_tx_currency_snapshot = coalesce(t.fx_tx_currency_snapshot, p_fx_tx_currency_snapshot),
      updated_at = now()
  where t.id = p_id
    and t.user_id = v_user_id;
end;
$function$;

create or replace function public.delete_transaction(p_tx_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tx public.transactions%rowtype;
  v_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_tx
  from public.transactions
  where id = p_tx_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Transaction not found or not owned';
  end if;

  if v_tx.internal_transfer_id is not null then
    raise exception 'Internal transfer transactions must be deleted through wallet transfer actions';
  end if;

  delete from public.transactions t
  where t.id = p_tx_id
    and t.user_id = v_user_id;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'Transaction not found or not owned';
  end if;
end;
$function$;
