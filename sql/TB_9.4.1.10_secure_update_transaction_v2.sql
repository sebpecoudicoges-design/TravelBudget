-- TB 9.4.1.10 - secure canonical update_transaction_v2
-- Apply on Supabase remote DB.

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
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_period_id uuid;
  v_existing public.transactions%rowtype;
  v_new_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_existing
  from public.transactions t
  where t.id = p_id
    and t.user_id = v_user_id;

  if not found then
    raise exception 'Transaction introuvable ou non autorisée';
  end if;

  select w.period_id
    into v_period_id
  from public.wallets w
  where w.id = p_wallet_id
    and w.user_id = v_user_id;

  if v_period_id is null then
    raise exception 'Wallet invalide';
  end if;

  -- rollback old wallet effect
  if coalesce(v_existing.pay_now, false) then
    if v_existing.type = 'expense' then
      update public.wallets
      set balance = balance + v_existing.amount
      where id = v_existing.wallet_id and user_id = v_user_id;
    else
      update public.wallets
      set balance = balance - v_existing.amount
      where id = v_existing.wallet_id and user_id = v_user_id;
    end if;
  end if;

  -- apply new wallet effect
  if coalesce(p_pay_now, false) then
    if p_type = 'expense' then
      update public.wallets
      set balance = balance - p_amount
      where id = p_wallet_id and user_id = v_user_id;
    else
      update public.wallets
      set balance = balance + p_amount
      where id = p_wallet_id and user_id = v_user_id;
    end if;
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
      type = p_type,
      amount = p_amount,
      currency = p_currency,
      category = p_category,
      subcategory = p_subcategory,
      label = p_label,
      date_start = p_date_start,
      date_end = p_date_end,
      budget_date_start = coalesce(p_budget_date_start, p_date_start),
      budget_date_end = coalesce(p_budget_date_end, p_budget_date_start, p_date_end, p_date_start),
      pay_now = p_pay_now,
      out_of_budget = p_out_of_budget,
      night_covered = p_night_covered,
      affects_budget = case when p_out_of_budget then false else coalesce(t.affects_budget, true) end,
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
$$;
