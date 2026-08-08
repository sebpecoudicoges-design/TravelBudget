-- Process the UI stability feedback while preserving the original test episodes.
with targets(scenario_id, treatment_notes) as (
  values
    ('dc740d27-8ed4-03f0-bf98-f1cec57df173'::uuid, 'Dashboard: la vue est rejouee apres le chargement serveur et attend aussi l etat lazy du budget journalier avant le premier affichage.'),
    ('1477211e-f702-f2e5-f0db-7739431c95c0'::uuid, 'Transactions: notifications partagees disponibles des le boot, refus en rouge avec explication et mutations confirmees en vert.'),
    ('28e413d5-f0a7-0e50-5230-551dcc07a4e1'::uuid, 'Settings Compte: champs bornes a 240 px, trois colonnes compactes sur desktop, deux sur tablette et une sur mobile.'),
    ('27b50182-9367-8098-942b-3379fe4e56fd'::uuid, 'Aide: les anciens tooltips natifs sont remplaces par une explication persistante fermee au clic exterieur ou avec Echap.')
), clean_ok(scenario_id) as (
  values
    ('a4f5208f-9ef3-011f-ad48-58e4aa9adb81'::uuid),
    ('3b651f7e-5fe0-84b7-80b3-f5b049b10028'::uuid),
    ('4f587a2b-cfad-a7e4-ba81-417e48643cee'::uuid),
    ('3fbadd3c-9506-ad1f-a223-48c634c56e16'::uuid),
    ('ec789d08-7ae5-43cd-7f0c-b3efe563aeb9'::uuid),
    ('74f68af4-da90-c354-b5ad-1e4c9138876b'::uuid),
    ('6a7c9c3c-3420-0908-ad09-0893335b3d2b'::uuid),
    ('612e3c61-7b47-fd1e-9ab7-6ed7291c295a'::uuid),
    ('bcbecd76-c622-03b9-0eb4-af3b4ca8669d'::uuid),
    ('4b3494c4-4c65-3285-fa80-76b421f53ed9'::uuid),
    ('803590d3-be31-6c49-7e68-195d9cdde4c5'::uuid),
    ('877a3c82-c828-0044-9b5a-a5180018dd54'::uuid),
    ('52a1e8ce-da2f-2f21-421d-7c1387be1709'::uuid)
), closures as (
  select scenario_id, treatment_notes from targets
  union all
  select scenario_id, 'Scenario valide sans reserve par le testeur puis clos globalement en 10.5.325.' from clean_ok
)
update public.app_test_scenarios s
set closed_at = coalesce(s.closed_at, now()),
    closed_version = coalesce(s.closed_version, '10.5.325'),
    closure_notes = coalesce(s.closure_notes, closures.treatment_notes)
from closures
where s.id = closures.scenario_id;

with targets(scenario_id, treatment_notes) as (
  values
    ('dc740d27-8ed4-03f0-bf98-f1cec57df173'::uuid, 'Dashboard: premier affichage rejoue apres hydratation des donnees.'),
    ('1477211e-f702-f2e5-f0db-7739431c95c0'::uuid, 'Transactions: retours rouge/vert uniformises.'),
    ('28e413d5-f0a7-0e50-5230-551dcc07a4e1'::uuid, 'Settings: grille Compte rendue compacte et responsive.'),
    ('27b50182-9367-8098-942b-3379fe4e56fd'::uuid, 'Aide: explications contextuelles persistantes.')
), clean_ok(scenario_id) as (
  values
    ('a4f5208f-9ef3-011f-ad48-58e4aa9adb81'::uuid), ('3b651f7e-5fe0-84b7-80b3-f5b049b10028'::uuid),
    ('4f587a2b-cfad-a7e4-ba81-417e48643cee'::uuid), ('3fbadd3c-9506-ad1f-a223-48c634c56e16'::uuid),
    ('ec789d08-7ae5-43cd-7f0c-b3efe563aeb9'::uuid), ('74f68af4-da90-c354-b5ad-1e4c9138876b'::uuid),
    ('6a7c9c3c-3420-0908-ad09-0893335b3d2b'::uuid), ('612e3c61-7b47-fd1e-9ab7-6ed7291c295a'::uuid),
    ('bcbecd76-c622-03b9-0eb4-af3b4ca8669d'::uuid), ('4b3494c4-4c65-3285-fa80-76b421f53ed9'::uuid),
    ('803590d3-be31-6c49-7e68-195d9cdde4c5'::uuid), ('877a3c82-c828-0044-9b5a-a5180018dd54'::uuid),
    ('52a1e8ce-da2f-2f21-421d-7c1387be1709'::uuid)
), treatments as (
  select scenario_id, treatment_notes from targets
  union all
  select scenario_id, 'Retour OK sans note: valide et archive globalement en 10.5.325.' from clean_ok
)
update public.app_test_results r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.325'),
    treatment_notes = coalesce(r.treatment_notes, treatments.treatment_notes),
    updated_at = now()
from treatments
where r.scenario_id = treatments.scenario_id
  and r.archived_at is null;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions, expected_result, required, sort_order
)
select child.id, parent.campaign_id, parent.module_id, child.parent_id, child.title, child.instructions, child.expected_result, true, child.sort_order
from (values
  ('32500000-0000-4000-8000-000000000001'::uuid, 'dc740d27-8ed4-03f0-bf98-f1cec57df173'::uuid, 7, 'Retest premier chargement 10.5.325', 'Depuis une session connectee, recharge completement l application et reste sur Dashboard jusqu a la disparition du chargement.', 'Wallets, budget journalier, KPI et courbe apparaissent au premier affichage sans visiter un autre module.'),
  ('32500000-0000-4000-8000-000000000002'::uuid, '1477211e-f702-f2e5-f0db-7739431c95c0'::uuid, 4, 'Retest notifications Transactions 10.5.325', 'Tente une action interdite sur une transaction protegee, puis cree, modifie et supprime une transaction de test.', 'Chaque refus affiche une bulle rouge explicative en bas a droite et chaque action reussie une bulle verte.'),
  ('32500000-0000-4000-8000-000000000003'::uuid, '28e413d5-f0a7-0e50-5230-551dcc07a4e1'::uuid, 4, 'Retest grille Compte 10.5.325', 'Ouvre Settings Compte sur desktop puis mobile et verifie email, WhatsApp, naissance, poids, taille, devise et mode.', 'Les champs restent compacts, ne recouvrent jamais la colonne suivante et passent a une colonne sur mobile.'),
  ('32500000-0000-4000-8000-000000000004'::uuid, '27b50182-9367-8098-942b-3379fe4e56fd'::uuid, 4, 'Retest aides persistantes 10.5.325', 'Clique plusieurs boutons ? dans Aide, Dashboard et Settings, attends quelques secondes, puis ferme au clic exterieur et avec Echap.', 'L explication reste lisible tant que tu ne la fermes pas et ne deborde pas sur mobile.')
) as child(id, parent_id, sort_order, title, instructions, expected_result)
join public.app_test_scenarios parent on parent.id = child.parent_id
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
set app_version = '10.5.325', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';
