-- Reopen a focused visual retest for the public Project page without altering
-- the archived feedback history from the previous interface pass.
update public.app_test_modules module
set status = 'in_test', archived_at = null, archive_reason = null, updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'project';

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  md5(parent.campaign_id::text || ':project-page-10.5.359')::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Page Projet compacte et responsive 10.5.359',
  'Ouvre la page Projet en clair puis sombre, a 1440 px et sur mobile. Controle le premier ecran, les interactions Demo, Modules, Parcours, Lab, Atlas, la fresque et le telechargement Android.',
  'Le message principal et la demonstration sont visibles des le premier ecran. Version, APK et Pecloud sont regroupes sans repetition. Aucun debordement ni controle flottant ne masque le contenu a 390 px; les sections restent lisibles et interactives dans les deux themes.',
  true,
  3591
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'project'
  and parent.title = 'Page Projet premium'
  and not exists (
    select 1
    from public.app_test_scenarios existing
    where existing.campaign_id = parent.campaign_id
      and existing.title = 'Page Projet compacte et responsive 10.5.359'
  );

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), scenario as (
  select s.id, s.campaign_id
  from public.app_test_scenarios s
  where s.title = 'Page Projet compacte et responsive 10.5.359'
    and s.campaign_id = '20000000-0000-4000-8000-000000000001'::uuid
)
insert into public.app_test_results (campaign_id, scenario_id, user_id, status, notes, completed_at)
select scenario.campaign_id, scenario.id, tester.id, 'pending', null, null
from scenario cross join tester
where not exists (
  select 1 from public.app_test_results current_result
  where current_result.scenario_id = scenario.id
    and current_result.user_id = tester.id
    and current_result.archived_at is null
);

update public.app_test_campaigns
set app_version = '10.5.359', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
