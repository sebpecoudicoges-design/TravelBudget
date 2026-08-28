-- The fix is application-side. This migration only reopens the shared daily
-- budget journey and preserves a focused retest in the existing campaign.
update public.app_test_modules module
set status = 'in_test', archived_at = null, archive_reason = null, updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key in ('dashboard', 'analysis');

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '35700000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Avoirs dans le budget journalier 10.5.357',
  'Sur une même journée, utilise une dépense Transport / Essence et une entrée positive dans la même catégorie, notamment une quote-part reçue depuis Trip. Compare le budget journalier du Dashboard, la courbe et Analyse.',
  'Le budget utilisé est net : les dépenses augmentent la consommation et les remboursements ou quote-parts personnelles la diminuent. Un revenu ordinaire comme Salaire ne réduit jamais les dépenses. Dashboard, courbe et Analyse affichent le même résultat, y compris lorsqu il devient négatif.',
  true,
  3571
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'dashboard'
  and parent.sort_order = 4
limit 1
on conflict (id) do update
set parent_scenario_id = excluded.parent_scenario_id,
    title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

update public.app_test_scenarios
set expected_result = 'La trésorerie affiche le montant intégral réellement encaissé et débité sous Transport puis Transport › Essence. Le moteur budgétaire partagé déduit uniquement les quote-parts personnelles reçues; Dashboard, budget journalier, courbe et Analyse restent identiques, sans double comptage.'
where id = '35600000-0000-4000-8000-000000000001'::uuid;

update public.app_test_campaigns
set app_version = '10.5.357', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
