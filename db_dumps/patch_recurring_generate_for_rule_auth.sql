-- Patch V9.7.1
-- Allow authenticated users to generate occurrences for their own recurring rules.
-- Keep service_role compatibility for admin/scheduled generation.

CREATE OR REPLACE FUNCTION public.recurring_generate_for_rule(p_rule_id uuid)
RETURNS TABLE(
  rule_id uuid,
  inserted_count integer,
  skipped_duplicates integer,
  generated_until date,
  next_due_at date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  r public.recurring_rules%rowtype;
  v_travel_end date;
  v_horizon date;
  v_due date;
  v_next_due date;
  v_period_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  select * into r
  from public.recurring_rules
  where id = p_rule_id;

  if not found then
    raise exception 'recurring rule not found';
  end if;

  if auth.uid() is not null and r.user_id <> auth.uid() then
    raise exception 'recurring rule not owned by current user'
      using errcode = '42501';
  end if;

  if not r.is_active or coalesce(r.archived, false) then
    return query
    select r.id, 0, 0, r.generated_until, r.next_due_at;
    return;
  end if;

  select t.end_date into v_travel_end
  from public.travels t
  where t.id = r.travel_id
    and t.user_id = r.user_id;

  if not found then
    raise exception 'travel not found for recurring rule';
  end if;

  if v_travel_end is null then
    raise exception 'travel.end_date is required';
  end if;

  v_horizon := v_travel_end;
  if r.end_date is not null and r.end_date < v_horizon then
    v_horizon := r.end_date;
  end if;

  v_due := coalesce(r.next_due_at, r.start_date);
  if v_due < r.start_date then
    v_due := r.start_date;
  end if;

  while v_due is not null and v_due <= v_horizon loop
    v_period_id := public.get_period_for_travel_date(r.travel_id, v_due);

    if v_period_id is null then
      raise exception 'no period for date %', v_due;
    end if;

    begin
      insert into public.transactions (
        user_id,
        wallet_id,
        period_id,
        travel_id,
        type,
        amount,
        currency,
        category,
        subcategory,
        label,
        date_start,
        date_end,
        budget_date_start,
        budget_date_end,
        pay_now,
        out_of_budget,
        night_covered,
        affects_budget,
        created_at,
        updated_at,
        recurring_rule_id,
        occurrence_date,
        generated_by_rule,
        recurring_instance_status,
        is_internal
      ) values (
        r.user_id,
        r.wallet_id,
        v_period_id,
        r.travel_id,
        r.type,
        r.amount,
        r.currency,
        coalesce(r.category, case when r.type = 'income' then 'Revenu' else 'Autre' end),
        r.subcategory,
        r.label,
        v_due,
        v_due,
        v_due,
        v_due,
        false,
        coalesce(r.out_of_budget, false),
        false,
        not coalesce(r.out_of_budget, false),
        now(),
        now(),
        r.id,
        v_due,
        true,
        'generated',
        false
      );

      v_inserted := v_inserted + 1;
    exception
      when unique_violation then
        v_skipped := v_skipped + 1;
    end;

    v_next_due := public.recurring_next_occurrence(
      r.rule_type,
      r.interval_count,
      r.weekday,
      r.monthday,
      r.week_of_month,
      v_due
    );

    if v_next_due is null then
      exit;
    end if;

    v_due := v_next_due;
  end loop;

  update public.recurring_rules rr
  set generated_until = v_horizon,
      next_due_at = case when v_due is null then rr.next_due_at else v_due end,
      updated_at = now()
  where rr.id = r.id;

  return query
  select r.id, v_inserted, v_skipped, v_horizon, v_due;
end;
$$;

REVOKE ALL ON FUNCTION public.recurring_generate_for_rule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recurring_generate_for_rule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recurring_generate_for_rule(uuid) TO service_role;
