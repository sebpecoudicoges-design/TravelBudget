-- Restore the original closed offline scenario that occupied sort_order 3.
update public.app_test_scenarios
set parent_scenario_id = null,
    title = 'Hors ligne et synchronisation',
    instructions = 'Teste un ajout en attente puis Synchroniser, Supprimer ou Vider.',
    expected_result = 'La file locale reste explicite et aucune saisie n est perdue silencieusement.',
    required = true,
    closed_at = coalesce(closed_at, '2026-08-08 06:45:00+00'::timestamptz),
    closed_version = coalesce(closed_version, '10.5.325'),
    closure_notes = coalesce(closure_notes, 'Scenario valide sans reserve par le testeur puis clos globalement en 10.5.325.')
where id = '803590d3-be31-6c49-7e68-195d9cdde4c5'::uuid;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions, expected_result, required, sort_order
)
select
  '33600000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Stabilite web Alimentation 10.5.336',
  'Sur le web, ouvre Alimentation avec plusieurs jours de repas deja saisis. Navigue dans l historique, ajoute un aliment et de l eau, puis change plusieurs fois de module pendant et apres la synchronisation. Surveille aussi la console.',
  'Les commandes restent reactives, la navigation permet toujours de quitter Alimentation, les donnees se synchronisent et aucun flot repetitif de POST app_error_logs en 403 ne remplit la console.',
  true,
  5
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
