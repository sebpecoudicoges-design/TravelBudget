# Projection et wallets — 10.5.375

## Correction du 19 octobre 2026

Les dépenses déjà payées diminuaient les wallets immédiatement, mais le KPI « Total wallets fin de période » et la courbe retiraient encore l'intégralité du budget des jours futurs. La projection déduisait donc deux fois la partie déjà financée du budget.

La règle part toujours des wallets réels. Pour chaque jour futur dans l'horizon choisi, elle retire `max(0, budget journalier - dépenses budgétées déjà payées affectées à ce jour)`. La répartition utilise les dates budgétaires, pas les dates de paiement, et la conversion de devise propre au jour. Les dépassements restent à charge ; un excédent d'un jour ne se reporte pas sur les autres. Les mouvements hors budget, internes et non payés ne donnent pas de crédit de prépaiement. Aucun montant ou date en base n'a été modifié.

Un horizon se terminant avant les dates budgétaires affiche toujours le débit déjà payé : il ne contient pas encore le budget futur qui pourrait le compenser. Les contrôles d'inclusion des impayés restent distincts.

Exemple de régression : avec 100 par jour du 9 au 14 décembre, un bateau de 226,26 réparti sur six jours ne modifie pas le solde final prévu après paiement. Ajouter un logement de 327,75 réparti sur les trois premiers jours entraîne un dépassement de 46,96 par jour sur ces trois jours, soit 140,88. Le solde final baisse de ce dépassement, pas de 554,01.

## Archiver et Trip

Cette livraison inclut les corrections préparées en 10.5.374, qui n'avaient pas été poussées ni déployées sur le site : [détails Trip et réorganisation des wallets](TRIP_WALLET_FIX_10_5_374.md). La sélection des cartes exclut les boutons portant le même `data-wallet-id` ; les événements de glisser-déposer sont liés une seule fois. La migration Trip était déjà appliquée côté serveur.

## Vérifications

- Tests de la règle partagée et exécution du véritable calcul KPI : paiement sous budget, dépassement journalier, limites d'horizon, chevauchement, conversion, dates camelCase et exclusions.
- Contrat reliant KPI et courbe à cette même règle ; suppression de deux anciens helpers de projection sans appel.
- Tests des wallets avec ordre mémorisé, initialisations répétées et commandes actives/archivées aux quatre largeurs, en clair/sombre et mode Android simulé.
- APK à installer sur téléphone pour valider la mise à jour réelle ; les tests navigateur ne remplacent pas ce contrôle.
