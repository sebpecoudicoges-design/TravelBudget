update public.app_test_modules module
set status = 'in_test', archived_at = null, archive_reason = null, updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'trip';

insert into public.app_test_scenarios (
  campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Reste à attribuer par participant 10.5.358',
  'Dans Trip, ajoute une dépense de 50 AUD, choisis la répartition Montants et saisis 18 AUD pour un participant. Complète ensuite la répartition, puis dépasse temporairement le total.',
  'La première saisie manuelle libère les autres montants automatiques. Le statut annonce Reste à attribuer : 32 AUD, puis Répartition complète à 50 AUD et enfin le dépassement avec son montant. La lecture reste nette à 390 px en thèmes clair et sombre.',
  true,
  3584
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'trip'
  and parent.title = 'Depense partagee'
  and not exists (
    select 1
    from public.app_test_scenarios existing
    where existing.campaign_id = parent.campaign_id
      and existing.title = 'Reste à attribuer par participant 10.5.358'
  );

update public.app_test_campaigns
set app_version = '10.5.358', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
