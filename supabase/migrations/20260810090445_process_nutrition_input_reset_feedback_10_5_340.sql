-- Archive the input-reset feedback and keep the retest lineage explicit.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.340'),
    closure_notes = coalesce(closure_notes, 'Teste le 10/08/2026 puis traite le 10/08/2026. La zone d ajout Alimentation semblait se recharger et empechait la saisie. Cause: chaque sonde Supabase reussie emettait un faux retour en ligne, puis Nutrition forcait un rechargement meme sans attente locale. Le retour en ligne n est maintenant emis que lors d une vraie transition; une synchro sans ligne est ignoree et la reconciliation est reportee tant qu un champ de saisie garde le focus.')
where id = '33900000-0000-4000-8000-000000000001'::uuid;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '34000000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest saisie stable Alimentation 10.5.340',
  'Sur web puis mobile, ouvre Alimentation et saisis lentement une recherche, une quantite puis des grammes. Attends quelques secondes entre les frappes, selectionne un aliment, enregistre-le et recommence aussitot une nouvelle saisie pendant la synchronisation.',
  'Aucun champ ne perd sa valeur ni son focus pendant la saisie. L ecran ne se reconstruit pas sur une simple sonde reseau; l ajout se synchronise, puis une nouvelle saisie reste possible sans reset ni doublon.',
  true,
  10
from public.app_test_scenarios parent
where parent.id = '33900000-0000-4000-8000-000000000001'::uuid
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

update public.app_test_campaigns
set app_version = '10.5.340', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
