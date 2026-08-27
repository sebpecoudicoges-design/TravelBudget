-- Retests for the 10.5.355 cross-domain usability lot. Existing RLS and
-- ownership policies remain unchanged; this migration only updates Test data.
update public.app_test_modules module
set status = 'in_test', archived_at = null, archive_reason = null, updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key in ('transactions', 'nutrition', 'analysis');

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select scenario.id, campaign.id, module.id, scenario.title, scenario.instructions, scenario.expected_result, true, scenario.sort_order
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id = campaign.id
cross join (values
  ('35500000-0000-4000-8000-000000000001'::uuid, 'transactions', 'Documents à la création 10.5.355', 'Crée une transaction avec au moins deux documents, puis ouvre Facture sur la ligne créée. Recommence hors ligne avec un document sélectionné.', 'La transaction est créée une seule fois, les deux documents sont présents dans Factures et liés à la ligne. Hors ligne, la création est bloquée avant écriture avec un message explicite.', 3551),
  ('35500000-0000-4000-8000-000000000002'::uuid, 'nutrition', 'Ajout de repas réactif 10.5.355', 'Dans Alimentation > Repas, sélectionne rapidement un aliment, modifie la quantité puis ajoute-le. Applique ensuite un repas favori et continue à utiliser les onglets pendant la synchronisation.', 'La sélection met à jour le formulaire sans rechargement visible. L ajout et le favori apparaissent immédiatement, sans gel, perte de focus prolongée ni double ligne.', 3552),
  ('35500000-0000-4000-8000-000000000003'::uuid, 'analysis', 'Avoir imputé à une dépense 10.5.355', 'Crée une dépense payée de 100 dans une catégorie puis une entrée encaissée de 25 dans la même catégorie. Ouvre Analyse sur la même période.', 'Le budget et la catégorie affichent 75 de dépense nette. La trésorerie réelle conserve 100 de sortie, 25 d entrée et un net de -75, sans double comptage.', 3553),
  ('35500000-0000-4000-8000-000000000004'::uuid, 'analysis', 'Sous-catégories des flux réels 10.5.355', 'Dans Analyse, sélectionne Périmètre Budget et Mode Flux réel. Vérifie les blocs Entrées et Sorties avec plusieurs sous-catégories.', 'Les entrées et sorties affichent une ventilation par sous-catégorie. Cette ventilation détaillée disparaît dans les autres combinaisons de périmètre ou de mode.', 3554)
) as scenario(id, module_key, title, instructions, expected_result, sort_order)
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = scenario.module_key
on conflict (id) do update
set title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

update public.app_test_campaigns
set app_version = '10.5.355', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
