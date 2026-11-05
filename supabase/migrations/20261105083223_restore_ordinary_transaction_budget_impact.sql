-- F3: restore ordinary budget impact on edit; no historical data rewrite.
-- Same RPC signature and ACL; source-managed transactions remain conservative.
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

  select * into v_existing
  from public.transactions
  where id = p_id and user_id = v_user_id;

  if not found then raise exception 'Transaction introuvable'; end if;
  if v_existing.internal_transfer_id is not null then
    raise exception 'Internal transfer transactions must be edited through wallet transfer actions';
  end if;
  if v_type not in ('expense', 'income') then raise exception 'Invalid transaction type'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Amount must be positive'; end if;
  if p_date_start is null then raise exception 'Transaction date is required'; end if;
  if p_date_end is not null and p_date_end < p_date_start then
    raise exception 'Transaction end date must be after start date';
  end if;
  if p_budget_date_start is not null
     and p_budget_date_end is not null
     and p_budget_date_end < p_budget_date_start then
    raise exception 'Budget end date must be after budget start date';
  end if;
  if nullif(trim(coalesce(p_currency, '')), '') is null then raise exception 'Currency is required'; end if;
  if nullif(trim(coalesce(p_category, '')), '') is null then raise exception 'Category is required'; end if;

  select w.period_id into v_period_id
  from public.wallets w
  where w.id = p_wallet_id and w.user_id = v_user_id;
  if v_period_id is null then raise exception 'Wallet invalide'; end if;

  v_new_status := v_existing.recurring_instance_status;
  if coalesce(v_existing.generated_by_rule, false) then
    v_new_status := case when coalesce(p_pay_now, false) then 'confirmed' else 'detached' end;
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
      -- Restore ordinary entries only. Source-managed cash movements and
      -- personal shares must keep their existing semantics through this RPC.
      affects_budget = case
        when p_out_of_budget then false
        when t.is_internal
          or t.trip_expense_id is not null or t.trip_share_link_id is not null
          or p_trip_expense_id is not null or p_trip_share_link_id is not null
          or lower(trim(coalesce(t.label, ''))) like '[trip] %'
          or lower(trim(t.category)) = 'ajustement wallet'
          or lower(trim(coalesce(t.label, ''))) like 'ajustement wallet %'
          or exists (select 1 from public.trip_expenses e where e.transaction_id = t.id)
          or exists (select 1 from public.trip_expense_budget_links l where l.transaction_id = t.id)
          or exists (select 1 from public.trip_settlement_events e where e.transaction_id = t.id)
          then t.affects_budget
        else true
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
  where t.id = p_id and t.user_id = v_user_id;
end;
$function$;
