-- Close the original Sport timer feedback and keep a descendant retest.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.335'),
    closure_notes = coalesce(closure_notes, 'Le module propose un choix Guide ou Libre et ne rend qu un minuteur. La distance reelle du chrono libre reste vide avant saisie et le bouton de fin indique Fini.')
where id = 'bc456519-3152-b7be-065e-8e5d250b9caf'::uuid;

update public.app_test_results
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.335'),
    treatment_notes = coalesce(treatment_notes, 'Ajout d un choix persistant Guide ou Libre avec un seul minuteur visible. Le chrono actif verrouille ce choix. La cible catalogue 3 km n est plus presentee comme distance realisee et Arreter devient Fini.'),
    updated_at = now()
where scenario_id = 'bc456519-3152-b7be-065e-8e5d250b9caf'::uuid
  and archived_at is null;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '33500000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest choix du minuteur Sport 10.5.335',
  'Ouvre Sport, passe de Guide a Libre puis lance Course facile. Observe le resume avant et pendant le chrono, termine avec Fini, saisis la distance et sauvegarde.',
  'Un seul minuteur est visible. Le choix reste memorise et ne change plus pendant un chrono actif. Aucun 3 km realise n apparait avant saisie ; Fini ouvre les champs de resultat et la distance saisie est sauvegardee.',
  true,
  5
from public.app_test_scenarios parent
where parent.id = 'bc456519-3152-b7be-065e-8e5d250b9caf'::uuid
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
set app_version = '10.5.335', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
