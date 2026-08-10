-- Close the reported freeze and preserve its lineage with a focused cross-device retest.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.338'),
    closure_notes = coalesce(closure_notes, 'Le gel restant lors de l ajout d aliment ou de repas favori a ete traite par ecriture locale groupee, rendu unique, verrou anti-double action et synchronisation reseau differee.')
where id = '33600000-0000-4000-8000-000000000001'::uuid;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '33800000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest ajout et favoris Alimentation 10.5.338',
  'Sur web puis mobile, ouvre Alimentation et ajoute deux aliments successifs. Enregistre ensuite un repas comme favori, applique ce favori et change immediatement de module pendant la synchronisation.',
  'Chaque action repond une seule fois, les ajouts apparaissent sans gel, le repas favori est disponible sans rechargement complet, la navigation reste utilisable et les lignes finissent par etre synchronisees sans doublon.',
  true,
  8
from public.app_test_scenarios parent
where parent.id = '33600000-0000-4000-8000-000000000001'::uuid
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
set app_version = '10.5.338', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
