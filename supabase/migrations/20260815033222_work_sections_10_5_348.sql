insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select scenario.id, campaign.id, module.id, scenario.title, scenario.instructions, scenario.expected_result, true, scenario.sort_order
from public.app_test_campaigns campaign
join public.app_test_modules module
  on module.campaign_id = campaign.id
 and module.module_key = 'work'
cross join (values
  ('34800000-0000-4000-8000-000000000001'::uuid, 'Retest espaces Travail 10.5.348', 'Ouvrir successivement Aujourd hui, Parcours et Historique en clair et sombre, sur ordinateur puis mobile.', 'Les trois espaces sont distincts, toutes les commandes restent accessibles et aucun contenu ne deborde horizontalement.', 3481),
  ('34800000-0000-4000-8000-000000000002'::uuid, 'Retest journee et rythme Travail 10.5.348', 'Dans Aujourd hui, changer le rythme, marquer le repos, modifier duree, pause, MET et RPE puis enregistrer une journee liee a une mission.', 'La semaine et l estimation kcal reagissent immediatement; la journee enregistree conserve mission, temps, pause, intensite et notes.', 3482),
  ('34800000-0000-4000-8000-000000000003'::uuid, 'Retest parcours Travail 10.5.348', 'Dans Parcours, ouvrir ou modifier une mission, un revenu et une periode, puis verifier les dossiers et documents lies.', 'La fresque, les KPI multidevises et les actions Missions/Revenus/Periodes/Documents fonctionnent sans quitter leur espace.', 3483),
  ('34800000-0000-4000-8000-000000000004'::uuid, 'Retest historique Travail 10.5.348', 'Dans Historique, verifier les 12 dernieres journees puis cliquer Modifier sur une ligne.', 'Chaque ligne affiche date, duree, pause, MET, RPE et kcal; Modifier ramene automatiquement dans Aujourd hui avec le formulaire pre-rempli.', 3484)
) as scenario(id, title, instructions, expected_result, sort_order)
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update
set title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

update public.app_test_campaigns
set app_version = '10.5.348', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
