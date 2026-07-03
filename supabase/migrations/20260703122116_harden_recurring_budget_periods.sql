-- Recurring occurrences always belong to the budget period covering their
-- occurrence date. Paid/confirmed rows remain immutable historical records.

create or replace function public.recurring_assign_budget_period()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_rule public.recurring_rules%rowtype;
  v_budget_date date;
  v_period_id uuid;
begin
  if not coalesce(new.generated_by_rule, false) or new.recurring_rule_id is null then
    return new;
  end if;

  select * into v_rule
  from public.recurring_rules
  where id = new.recurring_rule_id;

  if not found then
    raise exception 'recurring rule not found for generated transaction';
  end if;

  if new.user_id is distinct from v_rule.user_id then
    raise exception 'generated transaction user does not match recurring rule';
  end if;

  v_budget_date := coalesce(new.occurrence_date, new.budget_date_start, new.date_start);
  if v_budget_date is null then
    raise exception 'generated transaction requires an occurrence date';
  end if;

  v_period_id := public.get_period_for_travel_date(v_rule.travel_id, v_budget_date);
  if v_period_id is null then
    raise exception 'no budget period for recurring occurrence date %', v_budget_date;
  end if;

  new.travel_id := v_rule.travel_id;
  new.period_id := v_period_id;
  new.occurrence_date := v_budget_date;
  new.budget_date_start := v_budget_date;
  new.budget_date_end := v_budget_date;
  return new;
end;
$function$;

drop trigger if exists transactions_recurring_budget_period on public.transactions;
create trigger transactions_recurring_budget_period
before insert or update of recurring_rule_id, occurrence_date, budget_date_start, date_start, travel_id, period_id
on public.transactions
for each row execute function public.recurring_assign_budget_period();

revoke execute on function public.recurring_assign_budget_period() from public;
revoke execute on function public.recurring_assign_budget_period() from anon;
revoke execute on function public.recurring_assign_budget_period() from authenticated;

create or replace function public.recurring_generate_for_rule(p_rule_id uuid)
returns table(rule_id uuid, inserted_count integer, skipped_duplicates integer, generated_until date, next_due_at date)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.recurring_rules%rowtype;
  v_travel_end date;
  v_horizon date;
  v_due date;
  v_next_due date;
  v_period_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_occurrence_count integer := 0;
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
    return query select r.id, 0, 0, r.generated_until, r.next_due_at;
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

  -- Re-evaluate mutable generated rows after a period split or date change.
  update public.transactions t
  set period_id = public.get_period_for_travel_date(r.travel_id, coalesce(t.occurrence_date, t.budget_date_start, t.date_start)),
      travel_id = r.travel_id,
      budget_date_start = coalesce(t.occurrence_date, t.budget_date_start, t.date_start),
      budget_date_end = coalesce(t.occurrence_date, t.budget_date_start, t.date_start),
      updated_at = now()
  where t.recurring_rule_id = r.id
    and t.user_id = r.user_id
    and coalesce(t.generated_by_rule, false)
    and coalesce(t.pay_now, false) = false
    and coalesce(t.recurring_instance_status, 'generated') <> 'confirmed'
    and public.get_period_for_travel_date(r.travel_id, coalesce(t.occurrence_date, t.budget_date_start, t.date_start)) is not null;

  select count(*)::integer into v_occurrence_count
  from public.transactions t
  where t.recurring_rule_id = r.id
    and t.user_id = r.user_id
    and coalesce(t.generated_by_rule, false)
    and coalesce(t.recurring_instance_status, 'generated') <> 'skipped';

  v_horizon := v_travel_end;
  if r.end_date is not null and r.end_date < v_horizon then
    v_horizon := r.end_date;
  end if;

  v_due := coalesce(r.next_due_at, r.start_date);
  if v_due < r.start_date then v_due := r.start_date; end if;

  while v_due is not null and v_due <= v_horizon loop
    if r.max_occurrences is not null and v_occurrence_count >= r.max_occurrences then
      exit;
    end if;

    v_period_id := public.get_period_for_travel_date(r.travel_id, v_due);
    if v_period_id is null then
      raise exception 'no budget period for recurring occurrence date %', v_due;
    end if;

    begin
      insert into public.transactions (
        user_id, wallet_id, period_id, travel_id, type, amount, currency,
        category, subcategory, label, date_start, date_end,
        budget_date_start, budget_date_end, pay_now, out_of_budget,
        night_covered, affects_budget, created_at, updated_at,
        recurring_rule_id, occurrence_date, generated_by_rule,
        recurring_instance_status, is_internal
      ) values (
        r.user_id, r.wallet_id, v_period_id, r.travel_id, r.type, r.amount, r.currency,
        coalesce(r.category, case when r.type = 'income' then 'Revenu' else 'Autre' end),
        r.subcategory, r.label, v_due, v_due, v_due, v_due, false,
        coalesce(r.out_of_budget, false), false, not coalesce(r.out_of_budget, false),
        now(), now(), r.id, v_due, true, 'generated', false
      );
      v_inserted := v_inserted + 1;
      v_occurrence_count := v_occurrence_count + 1;
    exception
      when unique_violation then v_skipped := v_skipped + 1;
    end;

    v_next_due := public.recurring_next_occurrence(
      r.rule_type, r.interval_count, r.weekday, r.monthday, r.week_of_month, v_due
    );
    if v_next_due is null then exit; end if;
    v_due := v_next_due;
  end loop;

  update public.recurring_rules rr
  set generated_until = v_horizon,
      next_due_at = case when v_due is null then rr.next_due_at else v_due end,
      updated_at = now()
  where rr.id = r.id;

  return query select r.id, v_inserted, v_skipped, v_horizon, v_due;
end;
$function$;

revoke all on function public.recurring_generate_for_rule(uuid) from public;
grant execute on function public.recurring_generate_for_rule(uuid) to authenticated;
grant execute on function public.recurring_generate_for_rule(uuid) to service_role;

-- Backfill only mutable occurrences. Confirmed rows keep their historical period.
update public.transactions t
set period_id = public.get_period_for_travel_date(r.travel_id, coalesce(t.occurrence_date, t.budget_date_start, t.date_start)),
    travel_id = r.travel_id,
    budget_date_start = coalesce(t.occurrence_date, t.budget_date_start, t.date_start),
    budget_date_end = coalesce(t.occurrence_date, t.budget_date_start, t.date_start),
    updated_at = now()
from public.recurring_rules r
where t.recurring_rule_id = r.id
  and t.user_id = r.user_id
  and coalesce(t.generated_by_rule, false)
  and coalesce(t.pay_now, false) = false
  and coalesce(t.recurring_instance_status, 'generated') <> 'confirmed'
  and public.get_period_for_travel_date(r.travel_id, coalesce(t.occurrence_date, t.budget_date_start, t.date_start)) is not null;
