-- Keep the existing visual retest lineage, but make the multi-currency
-- overflow reported in 10.5.352 an explicit acceptance criterion.
update public.app_test_scenarios
set title = 'Lisibilite Abonnements multidevise 10.5.353',
    instructions = 'Ouvre Abonnements avec des entrees et sorties dans au moins deux devises. Compare Prevu, Paye ou Encaisse et Difference en clair puis sombre a 1440 et 390 px. Ouvre ensuite le rail admin sans le faire defiler.',
    expected_result = 'Chaque devise occupe sa propre ligne dans sa valeur. Aucun montant ne deborde dans la colonne ou la carte suivante. A 390 px, les deux premieres valeurs restent cote a cote et Difference passe dessous. Tests et Membres restent visibles dans le rail initial.'
where id = '35100000-0000-4000-8000-000000000002'::uuid;

update public.app_test_campaigns
set app_version = '10.5.353', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
