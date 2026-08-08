-- Close the validated 10.5.325 retests globally, process the remaining Dashboard
-- failure and keep its history through a new linked retest.
with treatments(scenario_id, treatment_notes) as (
  values
    ('32500000-0000-4000-8000-000000000001'::uuid, 'Dashboard: le role serveur est maintenant resolu avant le montage de la premiere vue protegee, puis la synchronisation hydrate wallets, budget journalier, KPI et courbe.'),
    ('32500000-0000-4000-8000-000000000002'::uuid, 'Retest valide: les notifications Transactions rouges et vertes sont conformes.'),
    ('32500000-0000-4000-8000-000000000003'::uuid, 'Retest valide: la grille Compte reste compacte et responsive.'),
    ('32500000-0000-4000-8000-000000000004'::uuid, 'Retest valide: les aides contextuelles restent ouvertes jusqu a leur fermeture explicite.'),
    ('82d3a2a2-cb53-9e43-35ae-191c81d82348'::uuid, 'Retest valide: NEAT, travail, sport et TEF sont detailles sans double comptage.')
)
update public.app_test_scenarios s
set closed_at = coalesce(s.closed_at, now()),
    closed_version = coalesce(s.closed_version, '10.5.326'),
    closure_notes = coalesce(s.closure_notes, treatments.treatment_notes)
from treatments
where s.id = treatments.scenario_id;

with treatments(scenario_id, treatment_notes) as (
  values
    ('32500000-0000-4000-8000-000000000001'::uuid, 'Echec traite en 10.5.326: le garde d acces recevait le role user temporaire avant le chargement du profil testeur et pouvait maintenir la vue Validation.'),
    ('32500000-0000-4000-8000-000000000002'::uuid, 'Retour OK valide et archive globalement en 10.5.326.'),
    ('32500000-0000-4000-8000-000000000003'::uuid, 'Retour OK valide et archive globalement en 10.5.326.'),
    ('32500000-0000-4000-8000-000000000004'::uuid, 'Retour OK valide et archive globalement en 10.5.326.'),
    ('82d3a2a2-cb53-9e43-35ae-191c81d82348'::uuid, 'Retour OK valide et archive globalement en 10.5.326.')
)
update public.app_test_results r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.326'),
    treatment_notes = coalesce(r.treatment_notes, treatments.treatment_notes),
    updated_at = now()
from treatments
where r.scenario_id = treatments.scenario_id
  and r.archived_at is null;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '32600000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest role et premier Dashboard 10.5.326',
  'Depuis le compte testeur deja connecte, recharge completement l application et reste sur Dashboard jusqu a la disparition du chargement.',
  'La premiere vue reste Dashboard et wallets, budget journalier, KPI et courbe apparaissent sans ouvrir un autre module.',
  true,
  8
from public.app_test_scenarios parent
where parent.id = '32500000-0000-4000-8000-000000000001'::uuid
on conflict (module_id, sort_order) do update set
  parent_scenario_id = excluded.parent_scenario_id,
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  required = excluded.required,
  closed_at = null,
  closed_by = null,
  closed_version = null,
  closure_notes = null;

update public.app_test_campaigns
set app_version = '10.5.326', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';
