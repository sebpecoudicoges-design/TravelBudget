<!-- atlas-meta
{
  "id": "sport.session",
  "dependencies": ["sync.offline"],
  "impacts": { "wallet": "none", "dailyBudget": "none", "analysis": "kpi", "trip": "none", "offline": "required", "android": "required" },
  "files": ["src/core/sportRules.js", "src/core/sportLibraryRules.js", "src/data/sportRepository.js", "src/features/sport/sportStore.js", "src/features/sport/sportTimerController.js", "src/features/sport/sportHistoryView.js", "public/legacy/js/45_sport_ui.js"],
  "tests": ["tests/core/sportRules.test.js", "tests/core/sportLibraryRules.test.js", "tests/data/sportRepository.test.js", "tests/features/sport/sportStore.test.js", "tests/features/sport/sportTimerController.test.js", "tests/ui/sportDomainContract.test.js", "tests/ui/sportFullscreenContract.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# sport.session — Création, exécution et sauvegarde d'une séance

## Utilisateur

Sport > programme ou séance libre, minuteur plein écran, séries, historique, modification et suppression.

## Source de vérité

- Séquence, calculs et lignes persistées : `src/core/sportRules.js`.
- Bibliothèque et normalisation : `src/core/sportLibraryRules.js` et catalogue Sport.
- Persistance/idempotence : `src/data/sportRepository.js`.
- État, timer et vues : `src/features/sport`.
- Intégration restante et modales : `public/legacy/js/45_sport_ui.js`.

## Données

- `sport_sessions`, exercices, séries, programmes et mesures associées.
- Store local optimiste et file de suppression différée.
- Identifiant de synchronisation pour éviter les séances dupliquées.

## Conséquences à vérifier

- Timer, pause, repos, ajout de série et finalisation.
- Calories et progression enregistrées une seule fois.
- Historique cohérent après édition, suppression et reconnexion.
- KPI Santé/Nutrition actualisés.
- Plein écran, son et persistance sur Android.

## Risques connus

- Double sauvegarde à la fin du timer.
- Enfants de séance absents du cache lors d'une suppression.
- Divergence entre séance programmée et séance réellement exécutée.
