-- An interval greater than one represents a complete cadence before the first
-- selected weekday. Example: Monday 2026-08-17 + every 2 weeks on Thursday
-- starts on Thursday 2026-09-03, not Thursday 2026-08-20.

create or replace function public.recurring_align_rule_first_due()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_due date;
begin
  v_due := public.recurring_first_occurrence(
    new.rule_type, new.start_date, new.weekday, new.monthday, new.week_of_month
  );
  if new.rule_type = 'weekly'
     and coalesce(new.interval_count, 1) > 1
     and v_due > new.start_date then
    v_due := v_due + (7 * new.interval_count);
  end if;
  new.next_due_at := v_due;
  new.generated_until := null;
  return new;
end;
$function$;

drop trigger if exists recurring_rules_align_first_due on public.recurring_rules;
create trigger recurring_rules_align_first_due
before insert or update of rule_type, interval_count, weekday, monthday, week_of_month, start_date
on public.recurring_rules
for each row execute function public.recurring_align_rule_first_due();

revoke all on function public.recurring_align_rule_first_due() from public;
revoke all on function public.recurring_align_rule_first_due() from anon;
revoke all on function public.recurring_align_rule_first_due() from authenticated;

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

  if not found then raise exception 'recurring rule not found'; end if;
  if auth.uid() is not null and r.user_id <> auth.uid() then
    raise exception 'recurring rule not owned by current user' using errcode = '42501';
  end if;

  if p_preserve_custom then
    update public.transactions t
    set recurring_instance_status = 'detached', updated_at = now()
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
  if r.rule_type = 'weekly'
     and coalesce(r.interval_count, 1) > 1
     and v_first_due > r.start_date then
    v_first_due := v_first_due + (7 * r.interval_count);
  end if;

  update public.recurring_rules rr
  set next_due_at = v_first_due,
      generated_until = null,
      updated_at = now()
  where rr.id = r.id;

  select * into v_generated from public.recurring_generate_for_rule(r.id);

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

revoke all on function public.recurring_first_occurrence(text, date, integer, integer, integer) from authenticated;
revoke all on function public.recurring_reconcile_rule(uuid, boolean) from authenticated;
grant execute on function public.recurring_first_occurrence(text, date, integer, integer, integer) to service_role;
grant execute on function public.recurring_reconcile_rule(uuid, boolean) to service_role;

-- Repair only the cadence family whose first occurrence semantics changed.
do $block$
declare
  v_rule record;
begin
  for v_rule in
    select id from public.recurring_rules
    where is_active = true
      and coalesce(archived, false) = false
      and rule_type = 'weekly'
      and interval_count > 1
  loop
    perform public.recurring_reconcile_rule(v_rule.id);
  end loop;
end;
$block$;

update public.app_test_scenarios
set instructions = 'Dans Settings, modifie d abord une echeance future generee sans la marquer payee, par exemple sa date ou son montant. Modifie ensuite sa regle : choisis toutes les 2 semaines, jeudi, avec un debut un lundi, puis raccourcis au besoin la date de fin pour retirer une ancienne echeance.',
    expected_result = 'L echeance personnalisee reste strictement inchangee et devient independante de la regle. Toutes les autres projections obsoletes disparaissent. Avec un debut le lundi 17/08/2026, les nouvelles dates commencent le jeudi 03/09 puis continuent les 17/09, 01/10, etc., jamais chaque lundi ni chaque semaine.'
where id = '34300000-0000-4000-8000-000000000001'::uuid;
