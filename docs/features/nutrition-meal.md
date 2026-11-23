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
- La sélection rapide met à jour seulement les contrôles concernés ; les rendus complets après ajout ou favori sont regroupés à la frame suivante avant la synchronisation différée.

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
- Sélection, quantité et navigation restent réactives pendant l'écriture locale et la réconciliation distante.

## Risques connus

- Repas distant et copie locale partageant le même `sync_id`.
- Catalogue Supabase différent du fallback offline.
- Ingrédient ajouté deux fois lors d'une reconnexion.

## Acquittement des écritures locales

La synchronisation relit la réserve avant chaque envoi et avant son acquittement. Seule une entrée identique au contenu envoyé peut être retirée après succès ou recevoir son erreur. Les ajouts/modifications concurrents restent en attente ; une suppression locale n'est pas recréée par un échec tardif. Un changement de compte arrête le lot sans écrire dans la nouvelle réserve. Une lecture illisible bloque le rejeu et l'acquittement. Le repository est l'unique chemin d'écriture réseau ; un repas distant divergent conserve la demande locale pour résolution.

Limites : une requête déjà envoyée peut aboutir malgré une suppression locale ; les écritures localStorage ne sont pas transactionnelles entre onglets. La résolution métier des conflits et les suppressions distantes restent distinctes.

Les ajouts fusionnés, sauvegardes directes et suppressions refusent également une réserve illisible. La nouvelle saisie est transmise au mécanisme de récupération en cas de lecture refusée ; aucun remplacement par une liste vide. La lecture tolérante reste réservée aux usages d'affichage.
