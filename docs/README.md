# Documentation TravelBudget

Cette page est la porte d'entrée de la documentation. Elle oriente vers les sources existantes sans les recopier.

| Besoin | Source à consulter |
|---|---|
| Comprendre les couches et les règles de migration | [Architecture V11](V11_ARCHITECTURE.md) |
| Comprendre les repositories et la synchronisation | [Couche de données V11](V11_DATA_LAYER.md) |
| Voir l'avancement du refactoring | [Checklist V11](V11_REFACTOR_CHECKLIST.md) |
| Connaître les budgets de taille | [Budgets de performance](V11_PERFORMANCE_BUDGETS.md) |
| Utiliser les composants UI partagés | [Composants UI V11](V11_UI_COMPONENTS.md) |
| Comprendre le rôle et les limites de l'Atlas | [Project Atlas](PROJECT_ATLAS.md) |
| Voir les composants réellement présents | [Inventaire généré](generated/project-inventory.md) |
| Modifier une fonction critique | [Fiches fonctionnelles](features/) |
| Comprendre une décision structurante | [Décisions d'architecture](ARCHITECTURE_DECISIONS.md) |
| Vérifier un déploiement | [Checklist de déploiement](deployment_settings_checklist.md) |

## Qualité locale

- `npm test` : tests Vitest et contrats.
- `npm run test:e2e` : parcours Playwright.
- `npm run build` : build Vite.
- `npm run lint:syntax` : contrôle syntaxique JavaScript.
- `npm run lint:db` : contrôle des chaînes liées à la base.
- `npm run perf:budget` : budgets de taille des modules.
- `npm run atlas:generate` : régénère l'inventaire factuel et la matrice déclarée.
- `npm run docs:check` : vérifie les références objectives de l'Atlas.

Le détail des commandes et leur implémentation restent dans [package.json](../package.json) et `scripts/`.
