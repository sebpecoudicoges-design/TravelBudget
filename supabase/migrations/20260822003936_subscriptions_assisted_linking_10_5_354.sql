-- Add the assisted-linking and detailed-subscription retests without changing
-- ownership rules: the existing security-invoker RPC remains the only write path.
update public.app_test_modules module
set description = 'Règles récurrentes, prévu/réel, fiche détaillée et associations assistées validées manuellement.',
    instructions = 'Teste Vue d ensemble, Échéances, À associer et Règles. Sur mobile, les quatre onglets doivent rester visibles en grille 2 x 2.',
    status = 'in_test',
    archived_at = null,
    archive_reason = null,
    updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'subscriptions';

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select scenario.id, campaign.id, module.id, scenario.title, scenario.instructions, scenario.expected_result, true, scenario.sort_order
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id = campaign.id and module.module_key = 'subscriptions'
cross join (values
  ('35400000-0000-4000-8000-000000000001'::uuid, 'Associations assistées et doublons 10.5.354', 'Ouvre À associer avec une transaction ressemblant à un abonnement. Vérifie les raisons et confirme un rattachement. Recommence avec une échéance générée proche.', 'La première liaison exige une confirmation et disparaît ensuite de la file. Une échéance générée proche affiche Doublon possible et ne propose aucun rattachement direct.', 3541),
  ('35400000-0000-4000-8000-000000000002'::uuid, 'Fiche abonnement et onglets mobiles 10.5.354', 'Depuis Vue d ensemble, ouvre Voir la fiche. Vérifie les métriques, l historique et les actions en clair/sombre à 1440 et 390 px. Sur mobile, contrôle les quatre onglets.', 'La fiche sépare prévu, réel, prochaine échéance et transactions liées. Les actions restent utilisables et les onglets forment une grille 2 x 2 sans défilement horizontal.', 3542)
) as scenario(id, title, instructions, expected_result, sort_order)
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update
set title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

update public.app_test_campaigns
set app_version = '10.5.354', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
