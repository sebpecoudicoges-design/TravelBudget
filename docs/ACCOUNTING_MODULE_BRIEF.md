# Comptabilité personnelle TravelBudget

## Périmètre validé

Le 25 septembre 2026, le périmètre personnel a été retenu. Une première version locale est implémentée dans `src/features/accounting/`, accessible depuis Finances → Comptabilité. Elle suit l'accès de prévisualisation existant (administrateurs et testeurs). Aucun déploiement, aucune migration et aucune écriture serveur ne font partie de ce lot.

Les états sont des vues de gestion calculées depuis les sources existantes, avec traçabilité. Ils ne constituent pas un journal validé ou une clôture. Le périmètre comprend le voyage actif et ses transactions/comptes, ainsi que les biens associés et sans voyage. Toutes les devises sont consolidées par défaut dans la devise de présentation choisie ; le mode « Devise seule » reste disponible. Le module ne consolide pas tous les voyages du compte.

## Parcours livré

- **Synthèse** : résultat, trésorerie, patrimoine net recensé, taux d'épargne courant ; indicateurs cliquables avec formule.
- **Compte de résultat** : période sélectionnée, comparaison aux mêmes dates de l'année précédente, comptes dépliables, mouvements puis fiche source.
- **Bilan** : situation à la date de lecture, comptes positifs, biens bruts/amortis/nets, créances déclarées, découverts, autres dettes et patrimoine net par différence.
- **Mouvements** : éléments retenus et écartés avec motif, fiche de traçabilité et accès à l'éditeur de transaction lorsqu'elle est chargée dans l'application.
- **Paramétrage** : déduction des comptes à partir des catégories/sous-catégories utilisées, corrections manuelles et soldes complémentaires en devises d'origine ; liens vers le paramétrage des biens et comptes/FX.

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

### Consolidation FX

Le module réutilise le fournisseur Frankfurter v2 et les helpers de séries historiques du domaine FX. [API officielle](https://frankfurter.dev/) : les requêtes publiques contiennent seulement paires de devises et dates, jamais les montants ou libellés. Une vérification réelle sur AUD/EUR au 24 septembre 2026 a confirmé le chargement du taux journalier.

Les opérations utilisent le taux à leur date ; les comptes et soldes déclarés celui de la date du bilan. Les biens amortissables et leurs dotations conservent le taux d'acquisition. La conversion des cumuls puis leur différence conserve les arrondis des amortissements. Les différences de change ne sont pas générées comme écritures d'un journal.

Le taux publié le plus récent à la date demandée est retenu, sans anticipation et avec une limite de sept jours (week-ends/jours fériés). Si le fournisseur ne permet pas la conversion, les taux manuels datés du module FX peuvent servir de repli ; un taux actuel n'est jamais présenté comme un taux historique. Pour un croisement manuel, les deux jambes EUR doivent être datées du même jour. La fiche source expose montant original, taux, date et origine. Un taux absent conserve la ligne visible avec un montant converti inconnu, et invalide les totaux qui en dépendent ; zéro n'exige pas de taux.

Les séries sont lues par paire/année avec trois requêtes simultanées au maximum, délai de 12 secondes par requête, cache de session de dix minutes et annulation lors d'un changement de compte ou de filtre. La mémoire cache contient seulement des taux publics. Les soldes complémentaires doivent être renseignés dans chaque devise concernée avant calcul du patrimoine net consolidé.

### Déduction des comptes

Les règles déterministes distinguent repas/courses, logement, transport, santé, loisirs, télécoms/abonnements, banque, visas, projets/formation, cadeaux/dons et assurances, ainsi que revenus d'activité et du patrimoine. Une sous-catégorie précise est prioritaire sur une catégorie générale : « Santé → Assurance santé » devient 612, alors que « Santé → Pharmacie » devient 604. Les codes restent ceux du plan de gestion personnelle, sans prétendre à un référentiel réglementaire.

Les cas ambigus (ventes, cautions, remboursements, matériel, retraits…) restent en « autres » avec un signalement à vérifier, sans exclusion automatique fondée sur leur seul nom. Les traitements des transactions liées à des biens ou à Trip gardent priorité. Les anciennes corrections par catégorie restent compatibles ; une correction par sous-catégorie est plus précise. Choisir « Auto » réactive explicitement la suggestion pour cette paire. L'interface indique l'origine et la raison de l'affectation ; aucun appel IA n'est nécessaire.

Un montant inconnu reste « Non disponible ». Les autres dettes et créances doivent être déclarées explicitement, y compris zéro, pour calculer le patrimoine net recensé. Elles doivent couvrir seulement le périmètre/devise choisi et exclure les postes déjà présents. La déclaration est datée du bilan, à reconfirmer pour une nouvelle date de lecture.

Les réglages sont locaux à l'appareil et isolés par utilisateur/voyage (`tb-accounting-v1`), avec montants par devise. Ils ne sont pas synchronisés ni inclus dans l'export général. Un échec d'enregistrement conserve le réglage précédent et affiche une erreur. Une future synchronisation devra définir le schéma, les politiques d'accès, la sauvegarde et la reprise de ces réglages.

Les lectures paginées conservent la RLS et les filtres utilisateur/voyage. Le chargement est atomique : une table indisponible ne produit pas un état partiellement silencieux. Le changement de compte efface les données affichées et invalide les lectures en vol. Hors ligne, seule une dernière lecture de la même session/périmètre est réutilisable, signalée et datée ; sans lecture préalable, un état de reprise est affiché.

## Vérification

Fixture EUR : solde d'ouverture 2 000, achat lié 1 200, dotation mensuelle 100 → trésorerie 800, brut 1 200, amortissements cumulés 100, net 1 100, patrimoine net 1 900 après déclaration zéro dettes/créances, résultat −100.

Tests : `tests/features/accounting/`, `tests/ui/accountingViewContract.test.js`, `tests/e2e/accounting.spec.js`. Les parcours couvrent les thèmes clair/sombre à 1440, 900, 600 et 390 px, détail/retour, affectation, soldes, erreurs et isolation des comptes. La feuille de style est chargée à la demande et utilise les tokens de `premium-theme.css` via leurs alias compatibles sombre.

Recherche de code mort : l'ancienne affectation par défaut 606/708 a été remplacée par le module de déduction ; les clés par catégorie sont conservées uniquement pour la compatibilité des réglages existants. Les helpers de trésorerie et FX existants sont réutilisés ; aucune fonctionnalité utile supprimée.

## Étapes suivantes

Soldes d'ouverture traçables, journal équilibré avec clé unique d'événement source, reprise des ventes/financements/transferts de propriété, historique du bilan, synchronisation des paramètres, puis exports/clôtures si retenus. Ces fonctionnalités nécessitent un modèle persistant et des rapprochements avec les sources ; elles ne sont pas simulées par ce premier écran.
