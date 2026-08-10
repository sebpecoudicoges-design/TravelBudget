-- The previous migration hit the module/sort unique key and reused the 10.5.338 row.
-- Restore that archived episode, then create its descendant at the next free order.
update public.app_test_scenarios
set parent_scenario_id = '33600000-0000-4000-8000-000000000001'::uuid,
    title = 'Retest ajout et favoris Alimentation 10.5.338',
    instructions = 'Sur web puis mobile, ouvre Alimentation et ajoute deux aliments successifs. Enregistre ensuite un repas comme favori, applique ce favori et change immediatement de module pendant la synchronisation.',
    expected_result = 'Chaque action repond une seule fois, les ajouts apparaissent sans gel, le repas favori est disponible sans rechargement complet, la navigation reste utilisable et les lignes finissent par etre synchronisees sans doublon.',
    closed_at = coalesce(closed_at, now()),
    closed_version = '10.5.339',
    closure_notes = 'Teste le 10/08/2026 puis traite le 10/08/2026. Le defilement restait possible mais les clics se figeaient apres les bulles de synchronisation. Cause: l ajout en ligne lancait a la fois la synchronisation Nutrition directe et la file hors ligne, puis cette file declenchait un rafraichissement global concurrent. Le chemin en ligne est maintenant unique; la file durable ne prend le relais que si des lignes restent en attente et les synchronisations Nutrition/Sport ne rafraichissent plus toute l application.'
where id = '33800000-0000-4000-8000-000000000001'::uuid;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '33900000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest synchro unique Alimentation 10.5.339',
  'Sur web puis mobile, ouvre Alimentation, ajoute un aliment puis applique un repas favori. Attends la confirmation de synchronisation, utilise aussitot un autre bouton Alimentation puis change de module. Reviens ensuite verifier les ajouts.',
  'Les clics restent actifs avant, pendant et apres la confirmation. Aucun rafraichissement global ni double synchronisation ne fige l ecran; la navigation fonctionne et chaque ligne apparait une seule fois.',
  true,
  9
from public.app_test_scenarios parent
where parent.id = '33800000-0000-4000-8000-000000000001'::uuid
on conflict (id) do update set
  parent_scenario_id = excluded.parent_scenario_id,
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  required = excluded.required,
  sort_order = excluded.sort_order,
  closed_at = null,
  closed_by = null,
  closed_version = null,
  closure_notes = null;
