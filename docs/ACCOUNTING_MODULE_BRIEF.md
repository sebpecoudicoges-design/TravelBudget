# Comptabilité personnelle TravelBudget

## Périmètre validé

Le 25 septembre 2026, le périmètre personnel a été retenu. Une première version locale est implémentée dans `src/features/accounting/`, accessible depuis Finances → Comptabilité. Elle suit l'accès de prévisualisation existant (administrateurs et testeurs). Aucun déploiement, aucune migration et aucune écriture serveur ne font partie de ce lot.

Les états sont des vues de gestion calculées depuis les sources existantes, avec traçabilité. Ils ne constituent pas un journal validé ou une clôture. Le périmètre comprend le voyage actif et ses transactions/comptes, ainsi que les biens associés et sans voyage, avec sélection d'une devise unique sans conversion. Il ne consolide pas tous les voyages du compte.

## Parcours livré

- **Synthèse** : résultat, trésorerie, patrimoine net recensé, taux d'épargne courant ; indicateurs cliquables avec formule.
- **Compte de résultat** : période sélectionnée, comparaison aux mêmes dates de l'année précédente, comptes dépliables, mouvements puis fiche source.
- **Bilan** : situation à la date de lecture, comptes positifs, biens bruts/amortis/nets, créances déclarées, découverts, autres dettes et patrimoine net par différence.
- **Mouvements** : éléments retenus et écartés avec motif, fiche de traçabilité et accès à l'éditeur de transaction lorsqu'elle est chargée dans l'application.
- **Paramétrage** : affectation des catégories à des regroupements personnels et soldes complémentaires par devise ; liens vers le paramétrage des biens et comptes.

Dates, devise et onglet sont conservés lors du parcours détail/retour. Le bilan reste une situation actuelle, indépendamment de la période du résultat. Un bilan historique nécessite une reprise des ouvertures et mouvements patrimoniaux.

## Règles de calcul

- Transactions ordinaires réglées à leur date de trésorerie. Les opérations futures ou non réglées restent dans les exclusions ; leurs créances/dettes ne sont pas déduites automatiquement.
- Quotes-parts personnelles Trip retenues même sans débit direct (`pay_now=false`), à partir des marqueurs internes/de partage et de l'affectation budgétaire. Débits bruts hors budget, lignes neutralisées et virements internes exclus du résultat.
- Les exclusions budgétaires ordinaires ne sont pas des exclusions comptables. Une catégorie peut être affectée explicitement à « Patrimoine / à rapprocher » ; ces opérations sont écartées du résultat et signalées.
- Achat lié à un bien : montant d'acquisition écarté des charges. Amortissement linéaire en fin de mois, dès le mois d'achat, avec durée, valeur résiduelle et quote-part. Le cumul arrondi puis différencié conserve les centimes. Le réglage budgétaire manuel ou « inclure au budget » ne modifie pas cette règle comptable.
- Propriété : propriétaire explicitement identifié comme soi ; aucune ligne de propriétaire implique 100 %. Une liste sans propriétaire personnel identifiable est exclue et signalée, sans reprendre arbitrairement le premier propriétaire.
- Cessions, financements et coûts annexes liés exclus du résultat et signalés comme à rapprocher ; biens vendus/archivés exclus avec avertissement, y compris pour une période historique. Les changements historiques de propriétaire ne sont pas reconstitués.
- Trésorerie : calcul partagé `computeWalletBalanceRows` sur les soldes de référence et mouvements réglés. Comptes archivés inclus pour ne pas perdre leur solde. Les découverts figurent au financement et ne sont pas additionnés deux fois aux dettes.
- Taux d'épargne : `(revenus − charges hors amortissements) / revenus`. Non disponible sans revenu positif ; ce ratio n'est pas la variation de trésorerie et peut être négatif.

## Complétude et stockage

Un montant inconnu reste « Non disponible ». Les autres dettes et créances doivent être déclarées explicitement, y compris zéro, pour calculer le patrimoine net recensé. Elles doivent couvrir seulement le périmètre/devise choisi et exclure les postes déjà présents. La déclaration est datée du bilan, à reconfirmer pour une nouvelle date de lecture.

Les réglages sont locaux à l'appareil et isolés par utilisateur/voyage (`tb-accounting-v1`), avec montants par devise. Ils ne sont pas synchronisés ni inclus dans l'export général. Un échec d'enregistrement conserve le réglage précédent et affiche une erreur. Une future synchronisation devra définir le schéma, les politiques d'accès, la sauvegarde et la reprise de ces réglages.

Les lectures paginées conservent la RLS et les filtres utilisateur/voyage. Le chargement est atomique : une table indisponible ne produit pas un état partiellement silencieux. Le changement de compte efface les données affichées et invalide les lectures en vol. Hors ligne, seule une dernière lecture de la même session/périmètre est réutilisable, signalée et datée ; sans lecture préalable, un état de reprise est affiché.

## Vérification

Fixture EUR : solde d'ouverture 2 000, achat lié 1 200, dotation mensuelle 100 → trésorerie 800, brut 1 200, amortissements cumulés 100, net 1 100, patrimoine net 1 900 après déclaration zéro dettes/créances, résultat −100.

Tests : `tests/features/accounting/`, `tests/ui/accountingViewContract.test.js`, `tests/e2e/accounting.spec.js`. Les parcours couvrent les thèmes clair/sombre à 1440, 900, 600 et 390 px, détail/retour, affectation, soldes, erreurs et isolation des comptes. La feuille de style est chargée à la demande et utilise les tokens de `premium-theme.css` via leurs alias compatibles sombre.

Recherche de code mort : aucun ancien module comptable ou gestionnaire concurrent dans ce périmètre. Les helpers de trésorerie existants sont réutilisés ; aucune fonctionnalité existante supprimée.

## Étapes suivantes

Soldes d'ouverture traçables, journal équilibré avec clé unique d'événement source, reprise des ventes/financements/transferts de propriété, historique du bilan, synchronisation des paramètres, puis exports/clôtures si retenus. Ces fonctionnalités nécessitent un modèle persistant et des rapprochements avec les sources ; elles ne sont pas simulées par ce premier écran.
