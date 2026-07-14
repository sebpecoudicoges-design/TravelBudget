# Travel Budget Project Atlas

L'Atlas est une couche mince de navigation, d'inventaire et d'analyse d'impact au-dessus de l'architecture V11. Il ne remplace ni la documentation V11, ni les tests, ni la validation humaine d'un comportement.

## Responsabilités

1. Indexer les sources de connaissance existantes depuis [README.md](README.md).
2. Générer les faits volatils dans [project-inventory.md](generated/project-inventory.md) et [project-inventory.json](generated/project-inventory.json).
3. Documenter les dépendances et conséquences à vérifier pour dix fonctions critiques dans [features/](features/).

## Règles de non-duplication

- [V11_ARCHITECTURE.md](V11_ARCHITECTURE.md) reste la source de vérité architecturale.
- Une fiche fonctionnelle pointe vers les fichiers et tests ; elle ne recopie pas leur implémentation.
- Les listes, nombres, version et commit provenant du dépôt sont générés automatiquement.
- Les sources de vérité métier, risques et impacts sont validés humainement dans les fiches.
- Une décision transversale durable est résumée dans [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) avec un lien vers sa source.

## Registre critique initial

| ID | Fonctionnalité | Fiche |
|---|---|---|
| `budget.transaction` | Transactions Budget | [transactions.md](features/transactions.md) |
| `budget.daily` | Budget journalier | [daily-budget.md](features/daily-budget.md) |
| `wallet.balance` | Solde wallet | [wallet-balance.md](features/wallet-balance.md) |
| `analysis.budget-actual` | Comparaison budget/réel | [budget-analysis.md](features/budget-analysis.md) |
| `trip.budget-link` | Liaison Trip/Budget | [trip-budget-link.md](features/trip-budget-link.md) |
| `work.income` | Missions, périodes et revenus | [work-income.md](features/work-income.md) |
| `sport.session` | Séance Sport | [sport-session.md](features/sport-session.md) |
| `nutrition.meal` | Repas Nutrition | [nutrition-meal.md](features/nutrition-meal.md) |
| `assets.movement` | Mouvement de patrimoine | [asset-movement.md](features/asset-movement.md) |
| `sync.offline` | Synchronisation offline | [offline-sync.md](features/offline-sync.md) |

## Matrice de régression

La matrice se trouve dans la section « Matrice d'impact déclarée » de l'[inventaire généré](generated/project-inventory.md). Le générateur retranscrit les métadonnées validées des fiches ; il ne déduit pas les impacts depuis le code.

Les valeurs signifient :

- `✓` : parcours à retester explicitement ;
- `KPI` : vérifier les indicateurs dépendants ;
- `Possible` : impact conditionnel à la liaison utilisée ;
- `—` : aucun impact direct déclaré.

## Commandes

```powershell
npm run atlas:generate
npm run docs:check
```

`docs:check` vérifie seulement des faits objectifs : présence des fichiers et tests cités, unicité des IDs, dépendances connues, validation renseignée, commit Git existant, avertissement des sorties générées et conformité de l'inventaire au dépôt courant.

Il ne prétend pas qu'une fonction est complète, stable ou suffisamment testée.
