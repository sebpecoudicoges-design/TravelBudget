-- Retest descendant for the professional body-composition workspace.
-- Product/test metadata only: no health measurement is altered.

update public.app_test_modules module
set status = 'in_test', archived_at = null, archive_reason = null, updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'sport';

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  md5(parent.campaign_id::text || ':sport-body-analysis-10.5.366')::uuid,
  parent.campaign_id, parent.module_id, parent.id,
  'Corps interactif et comparaison de pesees 10.5.366',
  'Dans Sport > Profil > Impedancemetre, teste les onglets Vue d ensemble, Evolution et Comparer. Sur la silhouette, selectionne Graisse, Muscle, Eau puis Masse maigre. Compare ensuite deux dates et controle les valeurs, variations et le niveau de fiabilite. Refaire le parcours a 390 px en clair et sombre.',
  'Le corps change de couleur et de niveau sans rechargement. Les valeurs kg calculables depuis poids et pourcentage remontent, les donnees impossibles a deduire restent absentes, les deux pesees choisies se comparent, et aucun indicateur ni bouton ne deborde ou ne reste coupe.',
  true, 3661
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'sport'
  and parent.title = 'Analyse impedancemetrique interactive 10.5.361'
on conflict (id) do update set
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  parent_scenario_id = excluded.parent_scenario_id,
  required = excluded.required,
  sort_order = excluded.sort_order;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), scenario as (
  select id, campaign_id from public.app_test_scenarios
  where title = 'Corps interactif et comparaison de pesees 10.5.366'
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
set app_version = '10.5.366', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
