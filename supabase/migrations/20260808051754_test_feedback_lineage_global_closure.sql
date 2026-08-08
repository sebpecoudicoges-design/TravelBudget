-- Preserve the complete feedback story and make closure a scenario-wide state.
alter table public.app_test_scenarios
  add column if not exists parent_scenario_id uuid references public.app_test_scenarios(id) on delete set null,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id) on delete set null,
  add column if not exists closed_version text,
  add column if not exists closure_notes text;

alter table public.app_test_results
  add column if not exists parent_result_id uuid references public.app_test_results(id) on delete set null,
  add column if not exists sequence_no integer not null default 1,
  add column if not exists superseded_at timestamptz;

with ranked as (
  select id,
         row_number() over (partition by scenario_id, user_id order by created_at, id)::integer as sequence_no,
         lag(id) over (partition by scenario_id, user_id order by created_at, id) as parent_result_id
  from public.app_test_results
)
update public.app_test_results r
set sequence_no = ranked.sequence_no,
    parent_result_id = ranked.parent_result_id
from ranked
where ranked.id = r.id;

-- Only the latest untreated feedback remains the editable episode.
with ordered as (
  select id, row_number() over (partition by scenario_id, user_id order by sequence_no desc, created_at desc) as latest_rank
  from public.app_test_results
  where archived_at is null
)
update public.app_test_results r
set superseded_at = coalesce(r.superseded_at, r.updated_at, now())
from ordered
where ordered.id = r.id and ordered.latest_rank > 1;

drop index if exists public.app_test_results_active_scenario_user_idx;
create unique index app_test_results_active_scenario_user_idx
  on public.app_test_results (scenario_id, user_id)
  where archived_at is null and superseded_at is null;
create unique index if not exists app_test_results_episode_idx
  on public.app_test_results (scenario_id, user_id, sequence_no);
create index if not exists app_test_results_parent_idx
  on public.app_test_results (parent_result_id);
create index if not exists app_test_scenarios_parent_idx
  on public.app_test_scenarios (parent_scenario_id);

-- Historical rows already treated, with no newer open feedback, become closed
-- for every tester instead of only disappearing for their original author.
with archived as (
  select r.scenario_id,
         max(r.treated_at) as last_treated_at,
         (array_agg(r.treated_version order by r.treated_at desc nulls last))[1] as treated_version
  from public.app_test_results r
  where r.archived_at is not null
  group by r.scenario_id
)
update public.app_test_scenarios s
set closed_at = archived.last_treated_at,
    closed_version = archived.treated_version,
    closure_notes = 'Cloture globale reprise depuis le dernier traitement archive.'
from archived
where s.closed_at is null
  and archived.scenario_id = s.id
  and archived.last_treated_at is not null
  and not exists (
    select 1 from public.app_test_results active
    where active.scenario_id = s.id
      and active.archived_at is null
      and active.superseded_at is null
  );

create or replace function public.close_app_test_scenario(
  p_scenario_id uuid,
  p_version text default null,
  p_notes text default null
) returns public.app_test_scenarios
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_scenario public.app_test_scenarios;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(coalesce(p.role, '')) = 'admin'
  ) then
    raise exception 'Cloture reservee aux administrateurs';
  end if;

  update public.app_test_scenarios
  set closed_at = v_now,
      closed_by = (select auth.uid()),
      closed_version = nullif(trim(p_version), ''),
      closure_notes = nullif(trim(p_notes), '')
  where id = p_scenario_id
  returning * into v_scenario;

  if v_scenario.id is null then raise exception 'Scenario introuvable'; end if;

  update public.app_test_results
  set treated_at = coalesce(treated_at, v_now),
      archived_at = coalesce(archived_at, v_now),
      treated_version = coalesce(treated_version, nullif(trim(p_version), '')),
      treatment_notes = coalesce(treatment_notes, nullif(trim(p_notes), '')),
      updated_at = v_now
  where scenario_id = p_scenario_id and archived_at is null;

  return v_scenario;
end;
$$;

revoke all on function public.close_app_test_scenario(uuid, text, text) from public;
grant execute on function public.close_app_test_scenario(uuid, text, text) to authenticated, service_role;

create or replace function public.append_app_test_feedback(p_scenario_id uuid)
returns public.app_test_results
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_campaign_id uuid;
  v_parent public.app_test_results;
  v_result public.app_test_results;
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and lower(coalesce(p.role, '')) in ('admin', 'test')
  ) then
    raise exception 'Compte test ou admin requis';
  end if;

  select s.campaign_id into v_campaign_id
  from public.app_test_scenarios s
  where s.id = p_scenario_id and s.closed_at is null;
  if v_campaign_id is null then raise exception 'Test clos ou introuvable'; end if;

  select * into v_parent
  from public.app_test_results r
  where r.scenario_id = p_scenario_id and r.user_id = v_user_id
  order by r.sequence_no desc, r.created_at desc
  limit 1
  for update;

  update public.app_test_results
  set superseded_at = coalesce(superseded_at, now()), updated_at = now()
  where scenario_id = p_scenario_id
    and user_id = v_user_id
    and archived_at is null
    and superseded_at is null;

  insert into public.app_test_results (
    campaign_id, scenario_id, user_id, status, parent_result_id, sequence_no
  ) values (
    v_campaign_id, p_scenario_id, v_user_id, 'pending', v_parent.id, coalesce(v_parent.sequence_no, 0) + 1
  ) returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.append_app_test_feedback(uuid) from public;
grant execute on function public.append_app_test_feedback(uuid) to authenticated, service_role;

-- The NEAT/TEF verification is explicitly derived from the existing calorie KPI test.
with nutrition as (
  select m.id as module_id, m.campaign_id,
         (array_agg(s.id) filter (where s.sort_order = 2))[1] as parent_scenario_id
  from public.app_test_modules m
  join public.app_test_scenarios s on s.module_id = m.id
  where m.campaign_id = '20000000-0000-4000-8000-000000000001'
    and m.module_key = 'nutrition'
  group by m.id, m.campaign_id
)
insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions, expected_result, required, sort_order
)
select md5(nutrition.module_id::text || ':4')::uuid,
       nutrition.campaign_id,
       nutrition.module_id,
       nutrition.parent_scenario_id,
       'NEAT, travail et TEF',
       'Regle le NEAT quotidien puis compare une journee sans ferme et une journee avec travail ou sport. Change aussi le TEF entre 8, 10 et 12 pour cent.',
       'Le besoin detaille base, NEAT, sport, travail et TEF sans double compter la ferme. Les reglages persistent et le besoin est recalcule.',
       true,
       4
from nutrition
on conflict (module_id, sort_order) do update set
  parent_scenario_id = excluded.parent_scenario_id,
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  required = excluded.required;

update public.app_test_campaigns
set app_version = '10.5.324', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';
