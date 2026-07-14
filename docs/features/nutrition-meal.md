<!-- atlas-meta
{
  "id": "nutrition.meal",
  "dependencies": ["sync.offline"],
  "impacts": { "wallet": "none", "dailyBudget": "none", "analysis": "kpi", "trip": "none", "offline": "required", "android": "required" },
  "files": ["src/core/nutritionRules.js", "src/data/nutritionRepository.js", "src/features/nutrition/nutritionStore.js", "src/features/nutrition/nutritionView.js", "public/legacy/js/48_nutrition_ui.js", "supabase/migrations/20260624080119_server_idempotency_sport_health_v2.sql", "supabase/migrations/20260625101456_dedupe_exact_nutrition_items.sql"],
  "tests": ["tests/core/nutritionRules.test.js", "tests/data/nutritionRepository.test.js", "tests/features/nutrition/nutritionStore.test.js", "tests/features/nutrition/nutritionView.test.js", "tests/ui/nutritionDomainContract.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# nutrition.meal — Création et synchronisation d'un repas

## Utilisateur

Nutrition > ajout rapide ou détaillé, favoris, portions, hydratation, sommeil et historique hebdomadaire.

## Source de vérité

- Normalisation et calculs nutritionnels : `src/core/nutritionRules.js`.
- Persistance et déduplication : `src/data/nutritionRepository.js`.
- État optimiste et vues : `src/features/nutrition`.
- Orchestration et compatibilité restantes : `public/legacy/js/48_nutrition_ui.js`.

## Données

- `nutrition_meals`, `nutrition_meal_items`, catalogue alimentaire et données de santé liées.
- `sync_id` au niveau repas ; contrainte de déduplication exacte pour les items.
- Catalogue fallback conservé pour le fonctionnement offline.

## Conséquences à vérifier

- Repas et ingrédients regroupés correctement.
- Totaux nutritionnels et KPI actualisés.
- Création optimiste confirmée sans conserver un doublon local.
- Rejeu offline et conflit serveur idempotents.
- Ajout, édition et suppression utilisables sur Android.

## Risques connus

- Repas distant et copie locale partageant le même `sync_id`.
- Catalogue Supabase différent du fallback offline.
- Ingrédient ajouté deux fois lors d'une reconnexion.
