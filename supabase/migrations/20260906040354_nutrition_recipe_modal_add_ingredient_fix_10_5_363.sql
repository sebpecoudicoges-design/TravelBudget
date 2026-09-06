-- Retest descendant: preserve the in-progress recipe draft when a new
-- ingredient row is added or removed in the modal.

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  md5(parent.campaign_id::text || ':nutrition-recipe-modal-add-ingredient-10.5.363')::uuid,
  parent.campaign_id, parent.module_id, parent.id,
  'Ajout ingredient sans perte de brouillon 10.5.363',
  'Dans la fenetre Creer une recette, saisis un nom et un premier ingredient avec son poids. Clique Ajouter un ingredient, puis renseigne la nouvelle ligne. Retire ensuite une ligne et controle la conservation des autres valeurs.',
  'Une ligne supplementaire apparait immediatement, les valeurs deja saisies restent presentes, la nouvelle ligne est focalisee et la suppression d une ligne ne recharge pas ni ne vide le brouillon.',
  true, 3631
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'nutrition'
  and parent.title = 'Fenetre de creation de recette 10.5.362'
on conflict (id) do nothing;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), scenario as (
  select id, campaign_id from public.app_test_scenarios
  where title = 'Ajout ingredient sans perte de brouillon 10.5.363'
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
set app_version = '10.5.363', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
