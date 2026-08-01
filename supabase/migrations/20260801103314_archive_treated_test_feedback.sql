-- Preserve each completed test cycle and expose treatment/archive dates.
alter table public.app_test_results
  add column if not exists treated_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists treated_version text,
  add column if not exists treatment_notes text;

alter table public.app_test_module_reviews
  add column if not exists treated_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists treated_version text,
  add column if not exists treatment_notes text;

alter table public.app_test_modules
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text;

alter table public.app_test_results
  drop constraint if exists app_test_results_scenario_id_user_id_key;
alter table public.app_test_module_reviews
  drop constraint if exists app_test_module_reviews_module_id_user_id_key;

create unique index if not exists app_test_results_active_scenario_user_idx
  on public.app_test_results (scenario_id, user_id)
  where archived_at is null;
create unique index if not exists app_test_module_reviews_active_module_user_idx
  on public.app_test_module_reviews (module_id, user_id)
  where archived_at is null;
create index if not exists app_test_results_user_archive_idx
  on public.app_test_results (user_id, campaign_id, archived_at);
create index if not exists app_test_module_reviews_user_archive_idx
  on public.app_test_module_reviews (user_id, campaign_id, archived_at);
create index if not exists app_test_results_campaign_idx
  on public.app_test_results (campaign_id);
create index if not exists app_test_results_scenario_campaign_idx
  on public.app_test_results (scenario_id, campaign_id);
create index if not exists app_test_module_reviews_campaign_idx
  on public.app_test_module_reviews (campaign_id);
create index if not exists app_test_module_reviews_module_campaign_idx
  on public.app_test_module_reviews (module_id, campaign_id);
create index if not exists app_test_scenarios_module_campaign_idx
  on public.app_test_scenarios (module_id, campaign_id);

-- Cautions is intentionally retired. Its five settled business rows stay in the
-- database for factual history and account export/deletion, while the test module
-- and its completed feedback leave the active campaign.
update public.app_test_modules
set archived_at = coalesce(archived_at, now()),
    archive_reason = 'Module retire en 10.5.319 apres verification: 5 cautions historiques, toutes soldees.',
    updated_at = now()
where campaign_id = '20000000-0000-4000-8000-000000000001'
  and module_key = 'cautions';

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), treated_scenarios as (
  select s.id
  from public.app_test_scenarios s
  join public.app_test_modules m on m.id = s.module_id
  where s.campaign_id = '20000000-0000-4000-8000-000000000001'
    and (
      m.module_key = 'cautions'
      or (m.module_key = 'dashboard' and s.sort_order in (1, 2, 6))
      or (m.module_key = 'project' and s.sort_order in (1, 2))
    )
)
update public.app_test_results r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.319'),
    treatment_notes = coalesce(r.treatment_notes, 'Retour relu et traite dans le chantier 10.5.319.'),
    updated_at = now()
where r.user_id = (select id from tester)
  and r.scenario_id in (select id from treated_scenarios)
  and r.completed_at is not null
  and r.archived_at is null;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), treated_modules as (
  select id
  from public.app_test_modules
  where campaign_id = '20000000-0000-4000-8000-000000000001'
    and module_key in ('dashboard', 'cautions', 'project')
)
update public.app_test_module_reviews r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.319'),
    treatment_notes = coalesce(r.treatment_notes, 'Module relu et traite dans le chantier 10.5.319.'),
    updated_at = now()
where r.user_id = (select id from tester)
  and r.module_id in (select id from treated_modules)
  and r.completed_at is not null
  and r.archived_at is null;

-- Explicit retest rows keep the fixed Dashboard first paint and Project dark
-- theme visible in the active queue without overwriting the archived test dates.
with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), retests as (
  select s.campaign_id, s.id as scenario_id, tester.id as user_id
  from public.app_test_scenarios s
  join public.app_test_modules m on m.id = s.module_id
  cross join tester
  where s.campaign_id = '20000000-0000-4000-8000-000000000001'
    and ((m.module_key = 'dashboard' and s.sort_order = 1)
      or (m.module_key = 'project' and s.sort_order = 1))
)
insert into public.app_test_results (campaign_id, scenario_id, user_id, status, notes, completed_at)
select campaign_id, scenario_id, user_id, 'pending', null, null
from retests
where not exists (
  select 1 from public.app_test_results current_result
  where current_result.scenario_id = retests.scenario_id
    and current_result.user_id = retests.user_id
    and current_result.archived_at is null
);

update public.app_test_campaigns
set app_version = '10.5.319', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';
