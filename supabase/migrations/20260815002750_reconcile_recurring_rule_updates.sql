-- Recurring rule edits are atomic: preserve user-edited occurrences, replace
-- mutable projections, then regenerate from the newly aligned first due date.

create or replace function public.recurring_first_occurrence(
  p_rule_type text,
  p_start_date date,
  p_weekday integer,
  p_monthday integer,
  p_week_of_month integer default null
)
returns date
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_candidate date;
  v_month_start date;
  v_last_day integer;
begin
  if p_start_date is null then
    return null;
  end if;

  case p_rule_type
    when 'weekly' then
      if p_weekday is null or p_weekday < 0 or p_weekday > 6 then
        raise exception 'weekday must be between 0 and 6 for weekly rules';
      end if;
      return p_start_date
        + ((p_weekday - extract(dow from p_start_date)::integer + 7) % 7);

    when 'every_x_months' then
      if p_monthday is null or p_monthday < 1 or p_monthday > 31 then
        raise exception 'monthday must be between 1 and 31 for monthly rules';
      end if;
      v_month_start := date_trunc('month', p_start_date)::date;
      v_last_day := extract(day from (v_month_start + interval '1 month - 1 day'))::integer;
      v_candidate := make_date(
        extract(year from v_month_start)::integer,
        extract(month from v_month_start)::integer,
        least(p_monthday, v_last_day)
      );
      if v_candidate < p_start_date then
        v_month_start := (v_month_start + interval '1 month')::date;
        v_last_day := extract(day from (v_month_start + interval '1 month - 1 day'))::integer;
        v_candidate := make_date(
          extract(year from v_month_start)::integer,
          extract(month from v_month_start)::integer,
          least(p_monthday, v_last_day)
        );
      end if;
      return v_candidate;

    when 'nth_weekday_month' then
      if p_weekday is null or p_week_of_month is null then
        raise exception 'weekday and week_of_month are required for nth weekday rules';
      end if;
      v_month_start := date_trunc('month', p_start_date)::date;
      v_candidate := public.nth_weekday_of_month(
        extract(year from v_month_start)::integer,
        extract(month from v_month_start)::integer,
        p_weekday,
        p_week_of_month
      );
      if v_candidate < p_start_date then
        v_month_start := (v_month_start + interval '1 month')::date;
        v_candidate := public.nth_weekday_of_month(
          extract(year from v_month_start)::integer,
          extract(month from v_month_start)::integer,
          p_weekday,
          p_week_of_month
        );
      end if;
      return v_candidate;

    when 'daily', 'monthly', 'yearly' then
      return p_start_date;

    else
      raise exception 'unsupported rule_type %', p_rule_type;
  end case;
end;
$function$;

revoke all on function public.recurring_first_occurrence(text, date, integer, integer, integer) from public;
grant execute on function public.recurring_first_occurrence(text, date, integer, integer, integer) to authenticated;
grant execute on function public.recurring_first_occurrence(text, date, integer, integer, integer) to service_role;

create or replace function public.recurring_reconcile_rule(
  p_rule_id uuid,
  p_preserve_custom boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.recurring_rules%rowtype;
  v_detached integer := 0;
  v_deleted integer := 0;
  v_generated record;
  v_first_due date;
begin
  select * into r
  from public.recurring_rules
  where id = p_rule_id
  for update;

  if not found then
    raise exception 'recurring rule not found';
  end if;
  if auth.uid() is not null and r.user_id <> auth.uid() then
    raise exception 'recurring rule not owned by current user' using errcode = '42501';
  end if;

  -- Older clients did not mark a customized generated occurrence as detached.
  -- Preserve any still-identifiable user exception before replacing projections.
  if p_preserve_custom then
    update public.transactions t
    set recurring_instance_status = 'detached',
        updated_at = now()
    where t.recurring_rule_id = r.id
      and t.user_id = r.user_id
      and coalesce(t.generated_by_rule, false)
      and coalesce(t.pay_now, false) = false
      and coalesce(t.recurring_instance_status, 'generated') = 'generated'
      and (
        t.wallet_id is distinct from r.wallet_id
        or t.type is distinct from r.type
        or t.amount is distinct from r.amount
        or t.currency is distinct from r.currency
        or t.category is distinct from coalesce(r.category, case when r.type = 'income' then 'Revenu' else 'Autre' end)
        or t.subcategory is distinct from r.subcategory
        or t.label is distinct from r.label
        or t.date_start is distinct from t.occurrence_date
        or t.date_end is distinct from t.occurrence_date
        or t.budget_date_start is distinct from t.occurrence_date
        or t.budget_date_end is distinct from t.occurrence_date
        or t.out_of_budget is distinct from r.out_of_budget
      );
    get diagnostics v_detached = row_count;
  end if;

  delete from public.transactions t
  where t.recurring_rule_id = r.id
    and t.user_id = r.user_id
    and coalesce(t.generated_by_rule, false)
    and coalesce(t.pay_now, false) = false
    and coalesce(t.recurring_instance_status, 'generated') = 'generated';
  get diagnostics v_deleted = row_count;

  v_first_due := public.recurring_first_occurrence(
    r.rule_type, r.start_date, r.weekday, r.monthday, r.week_of_month
  );

  update public.recurring_rules rr
  set next_due_at = v_first_due,
      generated_until = null,
      updated_at = now()
  where rr.id = r.id;

  select * into v_generated
  from public.recurring_generate_for_rule(r.id);

  return jsonb_build_object(
    'rule_id', r.id,
    'detached_count', v_detached,
    'deleted_count', v_deleted,
    'inserted_count', coalesce(v_generated.inserted_count, 0),
    'skipped_duplicates', coalesce(v_generated.skipped_duplicates, 0),
    'generated_until', v_generated.generated_until,
    'next_due_at', v_generated.next_due_at
  );
end;
$function$;

revoke all on function public.recurring_reconcile_rule(uuid, boolean) from public;
grant execute on function public.recurring_reconcile_rule(uuid, boolean) to authenticated;
grant execute on function public.recurring_reconcile_rule(uuid, boolean) to service_role;

create or replace function public.recurring_update_rule_v2(
  p_rule_id uuid,
  p_wallet_id uuid,
  p_label text,
  p_amount numeric,
  p_currency text,
  p_type text,
  p_category text,
  p_subcategory text,
  p_rule_type text,
  p_interval_count integer,
  p_weekday integer,
  p_monthday integer,
  p_start_date date,
  p_end_date date,
  p_max_occurrences integer,
  p_out_of_budget boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  r public.recurring_rules%rowtype;
  v_first_due date;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into r
  from public.recurring_rules
  where id = p_rule_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'recurring rule not found or not owned';
  end if;
  if not exists (
    select 1 from public.wallets w
    where w.id = p_wallet_id
      and w.user_id = v_uid
      and w.travel_id = r.travel_id
  ) then
    raise exception 'wallet not found in recurring rule travel';
  end if;
  if nullif(trim(coalesce(p_label, '')), '') is null then
    raise exception 'label is required';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'amount must be positive';
  end if;
  if lower(trim(coalesce(p_type, ''))) not in ('expense', 'income') then
    raise exception 'invalid transaction type';
  end if;
  if upper(trim(coalesce(p_currency, ''))) !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency';
  end if;
  if p_start_date is null or (p_end_date is not null and p_end_date < p_start_date) then
    raise exception 'invalid recurring rule dates';
  end if;
  if coalesce(p_interval_count, 0) < 1 then
    raise exception 'interval_count must be >= 1';
  end if;
  if p_max_occurrences is not null and p_max_occurrences < 1 then
    raise exception 'max_occurrences must be >= 1';
  end if;

  -- Protect existing customized occurrences against the rule-wide replacement
  -- while the previous rule template is still available for comparison.
  update public.transactions t
  set recurring_instance_status = 'detached',
      updated_at = now()
  where t.recurring_rule_id = r.id
    and t.user_id = r.user_id
    and coalesce(t.generated_by_rule, false)
    and coalesce(t.pay_now, false) = false
    and coalesce(t.recurring_instance_status, 'generated') = 'generated'
    and (
      t.wallet_id is distinct from r.wallet_id
      or t.type is distinct from r.type
      or t.amount is distinct from r.amount
      or t.currency is distinct from r.currency
      or t.category is distinct from coalesce(r.category, case when r.type = 'income' then 'Revenu' else 'Autre' end)
      or t.subcategory is distinct from r.subcategory
      or t.label is distinct from r.label
      or t.date_start is distinct from t.occurrence_date
      or t.date_end is distinct from t.occurrence_date
      or t.budget_date_start is distinct from t.occurrence_date
      or t.budget_date_end is distinct from t.occurrence_date
      or t.out_of_budget is distinct from r.out_of_budget
    );

  v_first_due := public.recurring_first_occurrence(
    p_rule_type, p_start_date, p_weekday, p_monthday, null
  );

  update public.recurring_rules rr
  set wallet_id = p_wallet_id,
      label = trim(p_label),
      amount = p_amount,
      currency = upper(trim(p_currency)),
      type = lower(trim(p_type)),
      category = nullif(trim(coalesce(p_category, '')), ''),
      subcategory = nullif(trim(coalesce(p_subcategory, '')), ''),
      rule_type = p_rule_type,
      interval_count = p_interval_count,
      weekday = p_weekday,
      monthday = p_monthday,
      week_of_month = null,
      start_date = p_start_date,
      end_date = p_end_date,
      max_occurrences = p_max_occurrences,
      out_of_budget = coalesce(p_out_of_budget, false),
      next_due_at = v_first_due,
      generated_until = null,
      updated_at = now()
  where rr.id = r.id;

  -- recurring_reconcile_rule now sees the new rule and atomically regenerates it.
  return public.recurring_reconcile_rule(r.id, false);
end;
$function$;

revoke all on function public.recurring_update_rule_v2(
  uuid, uuid, text, numeric, text, text, text, text, text, integer,
  integer, integer, date, date, integer, boolean
) from public;
grant execute on function public.recurring_update_rule_v2(
  uuid, uuid, text, numeric, text, text, text, text, text, integer,
  integer, integer, date, date, integer, boolean
) to authenticated;
grant execute on function public.recurring_update_rule_v2(
  uuid, uuid, text, numeric, text, text, text, text, text, integer,
  integer, integer, date, date, integer, boolean
) to service_role;

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
  where t.id = p_id and t.user_id = v_user_id;
end;
$function$;

-- One-time repair: active rules may contain projections left behind by older
-- edits. The reconciler preserves confirmed, skipped and detached occurrences.
do $block$
declare
  v_rule record;
begin
  for v_rule in
    select id from public.recurring_rules
    where is_active = true and coalesce(archived, false) = false
  loop
    perform public.recurring_reconcile_rule(v_rule.id);
  end loop;
end;
$block$;
