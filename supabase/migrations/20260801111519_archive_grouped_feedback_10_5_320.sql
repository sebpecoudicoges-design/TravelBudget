-- Archive only feedback whose reported issue is fully handled in 10.5.320.
with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
)
update public.app_test_results r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.320'),
    treatment_notes = case r.id
      when '2035a57b-5927-427b-a1b3-b4edcb94df33'::uuid then 'Dashboard: rendu initial relance de facon bornee jusqu a disponibilite des wallets, du budget journalier et de la courbe.'
      when 'fff10f39-9ea9-414e-9ebc-b2829d4b08ed'::uuid then 'Transactions: mouvements internes verrouilles en lecture seule avant le RPC generique, avec explication utilisateur.'
      when '80faf976-0772-43d5-97c7-a23a48df6951'::uuid then 'Trip: placeholder de recherche francais corrige et protege par contrat i18n.'
      else coalesce(r.treatment_notes, 'Retour traite en 10.5.320.')
    end,
    updated_at = now()
where r.user_id = (select id from tester)
  and r.id in (
    '2035a57b-5927-427b-a1b3-b4edcb94df33'::uuid,
    'fff10f39-9ea9-414e-9ebc-b2829d4b08ed'::uuid,
    '80faf976-0772-43d5-97c7-a23a48df6951'::uuid
  )
  and r.completed_at is not null
  and r.archived_at is null;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
)
update public.app_test_module_reviews r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.320'),
    treatment_notes = case r.id
      when '37d3d8b8-20a3-4218-9dbc-cde4d0626a17'::uuid then 'Dashboard: retour consolide; le premier rendu attend maintenant les trois blocs critiques.'
      when '3975a363-35c9-4fd9-b69e-6eb8cdbeff92'::uuid then 'Transactions: retour consolide; l edition des transferts internes est desormais bloquee proprement.'
      when '20272e80-6ee6-4878-ab93-8bac9339b417'::uuid then 'Analyse: log informatif retire hors debug et modele Tresorerie pure verrouille par test sur encaissements et paiements reels.'
      else coalesce(r.treatment_notes, 'Revue traitee en 10.5.320.')
    end,
    updated_at = now()
where r.user_id = (select id from tester)
  and r.id in (
    '37d3d8b8-20a3-4218-9dbc-cde4d0626a17'::uuid,
    '3975a363-35c9-4fd9-b69e-6eb8cdbeff92'::uuid,
    '20272e80-6ee6-4878-ab93-8bac9339b417'::uuid
  )
  and r.completed_at is not null
  and r.archived_at is null;

-- Recreate one active retest for each user-visible correction, without
-- overwriting the dated result that was just archived.
with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), retests as (
  select s.campaign_id, s.id as scenario_id, tester.id as user_id
  from public.app_test_scenarios s
  join public.app_test_modules m on m.id = s.module_id
  cross join tester
  where s.campaign_id = '20000000-0000-4000-8000-000000000001'
    and (
      (m.module_key = 'dashboard' and s.sort_order = 1)
      or (m.module_key = 'transactions' and s.sort_order = 3)
      or (m.module_key = 'trip' and s.sort_order = 3)
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
set app_version = '10.5.320', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';
