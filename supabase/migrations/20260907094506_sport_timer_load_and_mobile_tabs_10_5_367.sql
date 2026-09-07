-- Retests Sport only: no workout, set, program or body measurement is altered.

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
  md5(parent.campaign_id::text || ':sport-timer-load-carry-10.5.367')::uuid,
  parent.campaign_id, parent.module_id, parent.id,
  'Charge conservee entre series Sport 10.5.367',
  'Lance une seance guidee avec au moins deux series du meme exercice. Modifie la charge de la premiere serie, valide-la puis termine ou saute le repos. Recommence avec une charge inferieure a la charge initiale.',
  'La serie suivante du meme exercice reprend exactement la derniere charge validee, y compris en cas de baisse volontaire. Un autre exercice garde sa propre charge et la prochaine seance conserve ses regles de progression habituelles.',
  true, 3671
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'sport'
  and parent.title = 'Retest reprise de charge Sport 10.5.346'
on conflict (id) do update set
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  parent_scenario_id = excluded.parent_scenario_id,
  required = excluded.required,
  sort_order = excluded.sort_order;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  md5(parent.campaign_id::text || ':sport-mobile-tabs-10.5.367')::uuid,
  parent.campaign_id, parent.module_id, parent.id,
  'Quatre espaces Sport visibles sur mobile 10.5.367',
  'A 390 px, ouvre Sport en theme clair puis sombre. Controle la navigation avant de toucher la page et ouvre successivement Seance, Programme, Profil et progression puis Historique.',
  'Les quatre boutons sont visibles ensemble dans une grille 2 x 2, leurs libelles restent lisibles et chaque espace s ouvre sans defilement horizontal ni debordement de page.',
  true, 3672
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'sport'
  and parent.title = 'Retest espaces Sport 10.5.345'
on conflict (id) do update set
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  parent_scenario_id = excluded.parent_scenario_id,
  required = excluded.required,
  sort_order = excluded.sort_order;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), scenarios as (
  select id, campaign_id from public.app_test_scenarios
  where title in (
    'Charge conservee entre series Sport 10.5.367',
    'Quatre espaces Sport visibles sur mobile 10.5.367'
  )
)
insert into public.app_test_results (campaign_id, scenario_id, user_id, status, notes, completed_at)
select scenarios.campaign_id, scenarios.id, tester.id, 'pending', null, null
from scenarios cross join tester
where not exists (
  select 1 from public.app_test_results result
  where result.scenario_id = scenarios.id
    and result.user_id = tester.id
    and result.archived_at is null
);

update public.app_test_campaigns
set app_version = '10.5.367', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
