-- Close only the Settings account/preferences scenario handled in 10.5.322.
with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), target_scenario as (
  select s.id
  from public.app_test_scenarios s
  join public.app_test_modules m on m.id = s.module_id
  where s.campaign_id = '20000000-0000-4000-8000-000000000001'
    and m.module_key = 'settings'
    and s.sort_order = 1
  limit 1
)
update public.app_test_results r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.322'),
    treatment_notes = 'Settings Compte: champs alignes, sauvegarde globale pre-validee, seuil inclus et panneau Notifications mobile redondant retire.',
    updated_at = now()
where r.user_id = (select id from tester)
  and r.scenario_id = (select id from target_scenario)
  and r.completed_at is not null
  and r.archived_at is null;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), retest as (
  select s.campaign_id, s.id as scenario_id, tester.id as user_id
  from public.app_test_scenarios s
  join public.app_test_modules m on m.id = s.module_id
  cross join tester
  where s.campaign_id = '20000000-0000-4000-8000-000000000001'
    and m.module_key = 'settings'
    and s.sort_order = 1
)
insert into public.app_test_results (campaign_id, scenario_id, user_id, status, notes, completed_at)
select campaign_id, scenario_id, user_id, 'pending', null, null
from retest
where not exists (
  select 1 from public.app_test_results current_result
  where current_result.scenario_id = retest.scenario_id
    and current_result.user_id = retest.user_id
    and current_result.archived_at is null
);

update public.app_test_campaigns
set app_version = '10.5.322', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';
