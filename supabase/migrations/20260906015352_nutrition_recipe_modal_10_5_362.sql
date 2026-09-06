-- Retest descendant: the cooking workflow now runs in a dedicated accessible
-- modal instead of expanding inside the Nutrition page.

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
  md5(parent.campaign_id::text || ':nutrition-recipe-modal-10.5.362')::uuid,
  parent.campaign_id, parent.module_id, parent.id,
  'Fenetre de creation de recette 10.5.362',
  'Dans Alimentation > Repas, clique sur Creer une recette. Controle la fenetre, sa fermeture par la croix, Annuler, le fond et Echap. Cree ensuite une recette avec plusieurs ingredients, retire et ajoute une ligne, saisis le poids final et enregistre la portion.',
  'La creation reste dans une vraie fenetre au-dessus du module, les trois etapes et l apercu se mettent a jour sans recharger Alimentation, le clavier reste dans la fenetre, aucune saisie n est perdue lors de l ajout d une ligne, et le rendu reste utilisable a 390 px en clair et sombre.',
  true, 3621
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'nutrition'
  and parent.title = 'Atelier cuisine complet 10.5.361'
on conflict (id) do nothing;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), scenario as (
  select id, campaign_id from public.app_test_scenarios
  where title = 'Fenetre de creation de recette 10.5.362'
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
set app_version = '10.5.362', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
