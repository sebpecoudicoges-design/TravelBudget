-- Archive exactly seven scenario results and three module reviews handled in 10.5.321.
with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
)
update public.app_test_results r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.321'),
    treatment_notes = case r.id
      when '1450c34b-cd0a-4f74-a416-4d3e5f13bf7a'::uuid then 'Documents: libelles francais corriges et rail lateral modernise avec les commandes existantes conservees.'
      when 'e4122c06-a103-4e9e-b8cf-27197bd88a08'::uuid then 'Aide: demarrage rapide repliable, progression persistante et parcours mobile consolides.'
      when 'b2638653-39e8-4a56-ba18-2b5b40c90dfb'::uuid then 'Projet: scenario valide par le testeur; cycle consolide et archive sans retest inutile.'
      else coalesce(r.treatment_notes, 'Scenario relu, valide et archive dans le lot 10.5.321.')
    end,
    updated_at = now()
where r.user_id = (select id from tester)
  and r.id in (
    'b2638653-39e8-4a56-ba18-2b5b40c90dfb'::uuid,
    'd2a02437-b6ba-4c82-b419-6e5203022c40'::uuid,
    '78a8334a-bc55-4ea7-8bc4-7d729f1621f0'::uuid,
    'e4122c06-a103-4e9e-b8cf-27197bd88a08'::uuid,
    '1450c34b-cd0a-4f74-a416-4d3e5f13bf7a'::uuid,
    'bc1ca3ef-2d61-47b6-bd6d-6561811dc406'::uuid,
    '6a8c5bf0-257e-425b-86be-b121df9db47c'::uuid
  )
  and r.completed_at is not null
  and r.archived_at is null;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
)
update public.app_test_module_reviews r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.321'),
    treatment_notes = case r.id
      when '3637d1c3-239e-474c-b6b2-a60b629751d2'::uuid then 'Aide: diagnostic explique pour l utilisateur, contact support ajoute et demarrage rapide persistant.'
      when '06b55b7d-b6e3-4992-b241-043b190cf1d3'::uuid then 'Documents: textes francais et navigation laterale traites; apercu/CSP reste suivi dans le chantier Patrimoine.'
      when 'b502ee07-a124-4f45-b7aa-2339903f1c24'::uuid then 'Projet: revue Tout est OK consolidee et archivee.'
      else coalesce(r.treatment_notes, 'Revue traitee en 10.5.321.')
    end,
    updated_at = now()
where r.user_id = (select id from tester)
  and r.id in (
    'b502ee07-a124-4f45-b7aa-2339903f1c24'::uuid,
    '3637d1c3-239e-474c-b6b2-a60b629751d2'::uuid,
    '06b55b7d-b6e3-4992-b241-043b190cf1d3'::uuid
  )
  and r.completed_at is not null
  and r.archived_at is null;

-- Only user-visible changes needing confirmation receive a new active row.
with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), retests as (
  select s.campaign_id, s.id as scenario_id, tester.id as user_id
  from public.app_test_scenarios s
  join public.app_test_modules m on m.id = s.module_id
  cross join tester
  where s.campaign_id = '20000000-0000-4000-8000-000000000001'
    and (
      (m.module_key = 'help' and s.sort_order = 3)
      or (m.module_key = 'documents' and s.sort_order = 1)
    )
)
insert into public.app_test_results (campaign_id, scenario_id, user_id, status, notes, completed_at)
select campaign_id, scenario_id, user_id, 'pending', null, null
from retests
where not exists (
  select 1
  from public.app_test_results current_result
  where current_result.scenario_id = retests.scenario_id
    and current_result.user_id = retests.user_id
    and current_result.archived_at is null
);

update public.app_test_campaigns
set app_version = '10.5.321', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';
