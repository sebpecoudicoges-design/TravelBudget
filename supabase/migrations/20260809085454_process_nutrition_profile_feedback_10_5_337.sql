-- Archive the three reviewed notes and close their original scenarios for every tester.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.337'),
    closure_notes = coalesce(closure_notes, case id
      when 'b661383e-d6aa-c84c-4b6c-089a0c3fcef0'::uuid then 'Ajout des synonymes de balances et calcul automatique modifiable des valeurs derivees.'
      when '3824488c-c550-a004-9212-728caea9540d'::uuid then 'Les donnees repas sont maintenant prechargees pour les KPI sans visite prealable du module Alimentation.'
      when '6f51d383-d219-a12a-b868-116c2c265eef'::uuid then 'Suppression du resume calorique duplique et clarification du reajustement des objectifs par repas.'
    end)
where id in (
  'b661383e-d6aa-c84c-4b6c-089a0c3fcef0'::uuid,
  '3824488c-c550-a004-9212-728caea9540d'::uuid,
  '6f51d383-d219-a12a-b868-116c2c265eef'::uuid
);

update public.app_test_results
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.337'),
    treatment_notes = coalesce(treatment_notes, case id
      when 'a4d909d9-2877-4a7b-9a0d-a9a2efd4c347'::uuid then 'Synonymes explicites pour les libelles des balances. IMC, masse graisseuse, masse maigre, eau et proteines en kg sont derives si absents et restent editables.'
      when '7a1c0602-00a2-46a8-a66f-5dc8d655ab29'::uuid then 'Prechargement borne sur 21 jours des repas, elements et sommeil lors du premier rendu KPI.'
      when 'c942a613-55a7-4fbb-bf71-eda2216337f9'::uuid then 'Bloc besoins consommes duplique retire. Chaque cible repas indique maintenant qu elle est incluse dans la cible journaliere.'
    end),
    updated_at = now()
where id in (
  'a4d909d9-2877-4a7b-9a0d-a9a2efd4c347'::uuid,
  '7a1c0602-00a2-46a8-a66f-5dc8d655ab29'::uuid,
  'c942a613-55a7-4fbb-bf71-eda2216337f9'::uuid
);

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '33700000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest mesures corporelles guidees 10.5.337',
  'Ouvre Sport puis Profil et mesures. Lance une nouvelle mesure avec le poids, la taille du profil et quelques pourcentages fournis par la balance. Compare les synonymes et les valeurs en kg, puis modifie manuellement une valeur calculee avant d enregistrer.',
  'Les synonymes permettent d identifier chaque valeur. IMC, graisse kg, masse maigre, eau kg et proteines kg sont pre-remplis quand leurs donnees sources existent, et chaque champ reste modifiable.',
  true,
  6
from public.app_test_scenarios parent
where parent.id = 'b661383e-d6aa-c84c-4b6c-089a0c3fcef0'::uuid
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

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '33700000-0000-4000-8000-000000000002'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest KPI Nutrition au premier chargement 10.5.337',
  'Recharge completement l application sur Dashboard sans ouvrir Alimentation. Observe les KPI du jour, puis ouvre Alimentation et compare les valeurs.',
  'Les repas, calories et donnees de sommeil recentes apparaissent dans les KPI des le premier chargement et restent identiques apres ouverture d Alimentation.',
  true,
  6
from public.app_test_scenarios parent
where parent.id = '3824488c-c550-a004-9212-728caea9540d'::uuid
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

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '33700000-0000-4000-8000-000000000003'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest objectifs repas lisibles 10.5.337',
  'Ouvre Alimentation sur une journee avec plusieurs repas, dont un repas au-dessus de sa cible. Controle le sommet, le jour selectionne et la timeline du repas suivant.',
  'Le resume calories et macros n est affiche qu une fois. La timeline explique que la cible reajustee du repas suivant reste incluse dans l objectif calorique journalier.',
  true,
  7
from public.app_test_scenarios parent
where parent.id = '6f51d383-d219-a12a-b868-116c2c265eef'::uuid
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
set app_version = '10.5.337', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
