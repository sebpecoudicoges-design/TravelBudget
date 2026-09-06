-- Retest descendant: stabilize portion/gram conversions and verify the live
-- cooking-pot feedback without losing the existing recipe workflow.

update public.app_test_modules module
set status = 'in_test', archived_at = null, archive_reason = null, updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'nutrition';

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  md5(parent.campaign_id::text || ':nutrition-recipe-quantity-pot-10.5.365')::uuid,
  parent.campaign_id, parent.module_id, parent.id,
  'Quantites recette et marmite interactive 10.5.365',
  'Dans Alimentation > Repas, cree une recette. Pour un aliment dont la portion vaut 120 g, passe de Grammes a Portion : la quantite doit devenir 1 et le grammage 120 g. Saisis 1,5 portion et controle 180 g. Repasse en Grammes et controle que 180 g sont conserves. Modifie ensuite la quantite, ajoute plusieurs ingredients et renseigne un poids final. Controle aussi le rendu clair et sombre sur mobile.',
  'Le mode Portion demarre toujours a 1, le grammage calcule suit immediatement la portion, le mode Grammes reprend puis suit exactement les grammes saisis, et aucun ancien nombre n est reinterprete dans le nouveau mode. La marmite passe de vide a en preparation puis prete, son niveau et son resume evoluent sans rechargement, sans bloquer les champs ni deborder a 390 px.',
  true, 3651
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'nutrition'
  and parent.title = 'Ajout ingredient sans perte de brouillon 10.5.363'
on conflict (id) do nothing;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), scenario as (
  select id, campaign_id from public.app_test_scenarios
  where title = 'Quantites recette et marmite interactive 10.5.365'
)
insert into public.app_test_results (campaign_id, scenario_id, user_id, status, notes, completed_at)
select scenario.campaign_id, scenario.id, tester.id, 'pending', null, null
from scenario cross join tester
where not exists (
  select 1 from public.app_test_results result
  where result.scenario_id = scenario.id
    and result.user_id = tester.id
    and result.archived_at is null
);

update public.app_test_campaigns
set app_version = '10.5.365', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
