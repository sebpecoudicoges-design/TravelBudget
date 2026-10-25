# Calcul de la courbe — 10.5.381

Le profil CPU du Dashboard connecté synthétique (1 200 transactions, 92 jours) identifie les lectures et conversions répétées des dates budgétaires parmi les principaux coûts. Chaque jour de la courbe parcourait toutes les transactions et reconstruisait leurs dates. Les temps inclusifs des fonctions dans le profil se recouvrent et ne doivent pas être additionnés.

La courbe prépare maintenant les dépenses éligibles, leurs bornes et leur montant journalier une fois par construction de série. Les conversions de devises restent effectuées à la date du point concerné. La préparation est locale au calcul, sans cache persistant entre comptes, filtres ou modifications des transactions. Les règles de projection des dépenses prépayées restent confiées à `dailyBudgetRules.remainingCashBudgetForDate`.

L'ancien helper `ensureCashflowChartAlias`, sans appel dans le dépôt, est supprimé. Le véritable conteneur `cashflowCurve`, ses contrôles et le rendu restent inchangés. Un contrat empêche le retour de ce helper inutilisé.

## Mesures et contrôles

Comparaison locale sans profilage CPU activé, sur le même scénario compilé :

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Dashboard prêt, desktop | 1,81 s | 1,42 s |
| Exécution JS cumulée, desktop | 1,21 s | 0,69 s |
| Dashboard prêt, mobile simulé | 12,30 s | 8,88 s |
| Exécution JS cumulée, mobile simulé | 8,57 s | 4,40 s |

Ce sont deux essais locaux, pas une garantie de gain sur téléphone. Le profilage ajoute lui-même du coût ; les chiffres ci-dessus sont mesurés sans cette instrumentation. Les quatre parcours terminent sans erreur. Les données et appels API sont synthétiques et aucun compte réel n'est modifié.

Cinq nouveaux tests couvrent les dépenses prépayées, les devises par jour, les exclusions, les quotes-parts Trip, les dates invalides, les montants négatifs, les changements de compte et de catégories. Le contrôle déterministe vérifie 2 400 lectures de dates pour 1 200 transactions, sans lecture supplémentaire pour les jours suivants. Les tests existants de projection restent applicables.

Le profilage se lance avec `TB_CPU_PROFILE=1` avant `npm run perf:startup`. Chaque parcours écrit un fichier `.cpuprofile` à côté du rapport JSON, ouvrable dans les outils de développement Chromium. Ne pas comparer directement ses temps avec une mesure non instrumentée.

## Livraison et suite

APK prévu pour ce lot : `travelbudget-10.5.381-20261025-080000-debug.apk`, package `com.travelbudget.app`, versionCode `10050381`. La page Projet et l'Atlas accompagnent la compilation. Les preuves de signature, de comparaison des sources embarquées et de téléchargement sont consignées dans le suivi de l'audit après vérification.

La validation sur compte réel et téléphone reste à réaliser. L'extraction progressive du legacy et les autres coûts de rendu restent ouverts dans la phase architecture/qualité. La phase base de données reste distincte.
