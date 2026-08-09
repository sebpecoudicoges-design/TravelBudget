-- Treat the Sport first-load and history-presentation notes together.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.334'),
    closure_notes = coalesce(closure_notes, 'Premier chargement aligne sur la colonne SQL smoothed_1rm_kg. Les 7 seances recentes restent detaillees et les suivantes deviennent des lignes compactes avec toutes leurs actions.')
where id = '31de7fb4-a08c-b96f-c566-7fcdc5cfac19'::uuid;

update public.app_test_results
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.334'),
    treatment_notes = coalesce(treatment_notes, case
      when id = '4648bbdf-2130-4bd6-8afc-6b61de5fc7e0'::uuid
        then 'La lecture de progression demande maintenant smoothed_1rm_kg, colonne reelle de sport_exercise_metric_history ; le premier chargement ne doit plus produire de 400.'
      else 'L historique garde 7 cartes detaillees puis compacte les anciennes seances sans retirer Refaire, Ajuster, Modifier date ni Supprimer.'
    end),
    updated_at = now()
where scenario_id = '31de7fb4-a08c-b96f-c566-7fcdc5cfac19'::uuid
  and archived_at is null;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '33400000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest chargement et historique Sport 10.5.334',
  'Depuis un chargement frais, ouvre Sport avec la console visible. Ouvre ensuite Historique avec au moins 9 seances et teste une action sur une seance compacte.',
  'Aucune requete 400 ni erreur smoothed_e1rm_kg. Les 7 dernieres seances sont detaillees, les suivantes compactes, et Refaire, Ajuster, Modifier date et Supprimer restent disponibles.',
  true,
  4
from public.app_test_scenarios parent
where parent.id = '31de7fb4-a08c-b96f-c566-7fcdc5cfac19'::uuid
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
set app_version = '10.5.334', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
