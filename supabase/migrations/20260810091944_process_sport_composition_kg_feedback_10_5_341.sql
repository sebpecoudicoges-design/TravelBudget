-- Close the validated Nutrition retest, archive the Sport feedback and preserve its lineage.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.341'),
    closure_notes = coalesce(closure_notes, 'Teste le 10/08/2026 puis traite le 10/08/2026. Le retest de saisie stable Alimentation 10.5.340 est confirme OK par le testeur : la saisie reste utilisable apres synchronisation.')
where id = '34000000-0000-4000-8000-000000000001'::uuid;

update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.341'),
    closure_notes = coalesce(closure_notes, 'Teste le 10/08/2026 puis traite le 10/08/2026. Les mesures corporelles sont bien enregistrees, mais Evolution composition ne montrait graisse et muscle qu en pourcentage. Le graphique expose maintenant graisse et muscle en kg et en pourcentage sur les 12 dernieres mesures; le muscle kg n est jamais invente si la source ne le fournit pas.')
where id = '33700000-0000-4000-8000-000000000001'::uuid;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '34100000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest evolution composition kg 10.5.341',
  'Ouvre Sport puis Profil et repere Evolution composition. Verifie les 12 dernieres mesures en clair et sombre, a 1440 px puis 390 px. Survole ou maintiens les barres pour controler les dates et valeurs.',
  'Le graphique affiche cinq series distinctes : poids kg, graisse %, graisse kg, muscle % et muscle kg. Les valeurs presentes correspondent aux pesees, les valeurs absentes restent absentes sans conversion artificielle, et aucune serie ne deborde sur mobile.',
  true,
  7
from public.app_test_scenarios parent
where parent.id = '33700000-0000-4000-8000-000000000001'::uuid
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
set app_version = '10.5.341', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
