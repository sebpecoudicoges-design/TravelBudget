-- Archive the treated Trip review and preserve its history with a focused retest.
update public.app_test_module_reviews
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.332'),
    treatment_notes = coalesce(treatment_notes, 'Audit Trip clarifie : alerte rouge, diagnostic technique masque et actions Reparer / Contacter le support ajoutees.'),
    updated_at = now()
where id = 'a015419e-f04a-4637-a9fa-303f6cceaac6'::uuid
  and archived_at is null;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '33200000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest audit liens Trip 10.5.332',
  'Ouvre l historique Trip et repere une depense marquee Audit. Ouvre son detail, verifie le message puis teste Reparer et le lien support sans envoyer le message.',
  'L audit est rouge en clair et sombre. Aucun type technique ni UUID n est affiche. Reparer ouvre la modification de la depense et Contacter le support prepare un diagnostic.',
  true,
  5
from public.app_test_scenarios parent
where parent.id = '4b3494c4-4c65-3285-fa80-76b421f53ed9'::uuid
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
set app_version = '10.5.332', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
