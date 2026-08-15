insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select scenario.id, campaign.id, module.id, scenario.title, scenario.instructions, scenario.expected_result, true, scenario.sort_order
from public.app_test_campaigns campaign
join public.app_test_modules module
  on module.campaign_id = campaign.id
 and module.module_key = 'sport'
cross join (values
  ('34500000-0000-4000-8000-000000000001'::uuid, 'Retest espaces Sport 10.5.345', 'Ouvrir Seance, Programme, Profil et progression puis Historique en clair et sombre, sur ordinateur et mobile.', 'Un seul espace est visible a la fois, chaque onglet reste accessible au clavier et aucune commande ni donnee ne deborde de la page.', 3451),
  ('34500000-0000-4000-8000-000000000002'::uuid, 'Retest Programme vers Seance 10.5.345', 'Depuis Programme, charger une seance favorite puis lancer la seance du jour.', 'Le plan est charge sans doublon et le module revient automatiquement dans Seance avec le minuteur guide ou libre toujours fonctionnel.', 3452),
  ('34500000-0000-4000-8000-000000000003'::uuid, 'Retest Profil et progression Sport 10.5.345', 'Dans Profil et progression, verifier radar, mobilite, mesures corporelles, Evolution composition et filtre de progression.', 'Les mesures et graphiques restent lisibles, editables et coherents; changer de filtre ne renvoie pas vers un autre espace.', 3453),
  ('34500000-0000-4000-8000-000000000004'::uuid, 'Retest Historique Sport 10.5.345', 'Depuis Historique, ouvrir une seance, modifier sa date, la refaire puis verifier les actions de synchronisation et suppression.', 'Toutes les actions restent disponibles; Refaire charge le plan et ouvre Seance, tandis que la synchronisation et la suppression ciblent uniquement la seance choisie.', 3454)
) as scenario(id, title, instructions, expected_result, sort_order)
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update
set title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

update public.app_test_campaigns
set app_version = '10.5.345',
    updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
